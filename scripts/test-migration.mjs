// Verifies that 0001_session_exercise_layer.sql cleanly upgrades a DB
// that already has session/session_set rows from the v0 schema.

import Database from 'better-sqlite3';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DB_PATH = './data/test-migration.db';
for (const ext of ['', '-wal', '-shm']) {
  const p = DB_PATH + ext;
  if (existsSync(p)) rmSync(p);
}

// Apply v0 schema
const v0 = readFileSync('drizzle/0000_initial.sql', 'utf8');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
for (const stmt of v0.split('--> statement-breakpoint')) {
  const trimmed = stmt.trim();
  if (trimmed) db.exec(trimmed);
}

// Mark v0 as applied so the runtime migrator only runs v1
db.exec(`CREATE TABLE __drizzle_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash text NOT NULL,
  created_at numeric
);`);
const v0Hash = createHash('sha256').update(v0).digest('hex');
db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
  .run(v0Hash, Date.now());

// Seed templates the migration JOINs against
db.exec(`INSERT INTO workout_template_day (day_name, title, ordering)
         VALUES ('Monday', 'Chest+Tri', 1), ('Tuesday', 'Back+Bi', 2);`);
db.exec(`INSERT INTO workout_template_exercise
         (day_id, ordering, name, default_sets, rep_low, rep_high, rest_seconds, notes_md)
         VALUES
           (1, 1, 'Chest Press', 3, 8, 12, 90, ''),
           (2, 1, 'Lat PD wide', 3, 10, 12, 90, ''),
           (2, 2, 'Seated Row', 3, 10, 12, 90, '');`);

// Realistic user data: yesterday's Back+Bi + today's in-progress Chest+Tri.
// Includes a deliberate duplicate at (session=2, exercise=1, set=1) — that
// row exists in the user's actual prod DB because the old schema had no
// UNIQUE constraint and the edit-a-logged-set path inserted instead of
// updating. The migration must keep the LATEST-logged row and drop the rest.
db.exec(`INSERT INTO session (date, day_id)
         VALUES ('2026-05-04', 2), ('2026-05-05', 1);`);
db.exec(`INSERT INTO session_set
         (session_id, exercise_template_id, set_number, weight, reps, felt_easy, logged_at, client_id)
         VALUES
           (1, 2, 1, 50.0, 12, 0, '2026-05-04T10:00:00Z', 'cid-1'),
           (1, 2, 2, 50.0, 11, 1, '2026-05-04T10:01:00Z', 'cid-2'),
           (1, 2, 3, 50.0, 10, 0, '2026-05-04T10:02:00Z', 'cid-3'),
           (1, 3, 1, 60.0, 10, 0, '2026-05-04T10:05:00Z', 'cid-4'),
           (1, 3, 2, 60.0, 9,  0, '2026-05-04T10:06:00Z', 'cid-5'),
           -- Today: session 2, exercise 1, set 1 — first attempt
           (2, 1, 1, 40.0, 12, 1, '2026-05-05T08:00:00Z', 'cid-6'),
           -- Same position, EDITED later (the dup): higher weight, fewer reps
           (2, 1, 1, 45.0, 10, 0, '2026-05-05T08:01:30Z', 'cid-6-edit'),
           (2, 1, 2, 40.0, 11, 0, '2026-05-05T08:03:00Z', 'cid-7');`);

const preSets = db.prepare('SELECT COUNT(*) c FROM session_set').get().c;
const preDups = db.prepare(`
  SELECT COUNT(*) AS c FROM (
    SELECT 1 FROM session_set
    GROUP BY session_id, exercise_template_id, set_number
    HAVING COUNT(*) > 1
  )
`).get().c;
console.log(`Pre-migration: 2 sessions, ${preSets} session_sets (${preDups} duplicate position(s))`);
db.close();

// Now run v1 via the application's migrator
const env = { ...process.env, DATABASE_URL: `file:${DB_PATH}` };
const { spawnSync } = await import('node:child_process');
const result = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--import', 'tsx/esm',
    '-e',
    `import('./src/lib/server/db.ts').then(({ runMigrations }) => runMigrations());`
  ],
  { env, stdio: 'inherit' }
);
if (result.status !== 0) {
  console.error('Migration FAILED');
  process.exit(1);
}

// Re-open and verify
const db2 = new Database(DB_PATH);
db2.pragma('foreign_keys = ON');

const counts = {
  sessions: db2.prepare('SELECT COUNT(*) c FROM session').get().c,
  session_exercise: db2.prepare('SELECT COUNT(*) c FROM session_exercise').get().c,
  session_set: db2.prepare('SELECT COUNT(*) c FROM session_set').get().c
};
console.log('Post-migration counts:', counts);

// Expected: 2 sessions, 3 session_exercise (S1+ex2, S1+ex3, S2+ex1).
// 8 session_sets pre-dedup, 7 post (one duplicate dropped, latest kept).
const expected = { sessions: 2, session_exercise: 3, session_set: 7 };
let ok = true;
for (const k of Object.keys(expected)) {
  if (counts[k] !== expected[k]) {
    console.error(`FAIL: ${k} = ${counts[k]}, expected ${expected[k]}`);
    ok = false;
  }
}

// Verify the join works and produces the original data
const rows = db2.prepare(`
  SELECT s.date, e.name, ss.set_number, ss.weight, ss.reps, ss.felt_easy, ss.client_id
  FROM session_set ss
  JOIN session_exercise se ON se.id = ss.session_exercise_id
  JOIN session s            ON s.id  = se.session_id
  JOIN workout_template_exercise e ON e.id = se.exercise_template_id
  ORDER BY s.date, se.ordering, ss.set_number
`).all();
console.log('Joined view of all sets:');
for (const r of rows) console.log(' ', r);

// Verify dedup: the surviving (S2, ex1, set 1) should be the EDITED row
// (weight 45, reps 10, client_id 'cid-6-edit') — NOT the original.
const dupRow = db2.prepare(`
  SELECT ss.weight, ss.reps, ss.client_id
  FROM session_set ss
  JOIN session_exercise se ON se.id = ss.session_exercise_id
  WHERE se.session_id = 2 AND se.exercise_template_id = 1 AND ss.set_number = 1
`).get();
if (dupRow.client_id !== 'cid-6-edit' || dupRow.weight !== 45) {
  console.error('FAIL: dedup kept the wrong row:', dupRow);
  ok = false;
} else {
  console.log('Dedup kept latest-logged row:', dupRow, '✓');
}

// Verify the unique constraints exist
const idxList = db2.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('session_exercise', 'session_set')").all();
console.log('Indexes:', idxList);

// Verify foreign keys still pass
const fk = db2.pragma('foreign_key_check');
if (fk.length > 0) {
  console.error('FAIL: foreign key violations:', fk);
  ok = false;
} else {
  console.log('FK check: clean');
}

// Verify the unique constraint actually fires when violated.
let threw = false;
try {
  // Pick a known-occupied position from the seed data (session_exercise_id=1
  // already has set_number=1 after backfill). Inserting another at the same
  // spot must fail.
  db2.prepare(`INSERT INTO session_set
               (session_exercise_id, set_number, weight, reps, felt_easy, client_id)
               VALUES (1, 1, 100, 5, 0, 'should-fail')`).run();
} catch {
  threw = true;
}
if (!threw) {
  console.error('FAIL: duplicate (session_exercise_id, set_number) was allowed!');
  ok = false;
} else {
  console.log('Unique (session_exercise_id, set_number): enforced ✓');
}

db2.close();
process.exit(ok ? 0 : 1);
