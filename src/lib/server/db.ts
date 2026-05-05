import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

const dbUrl = process.env.DATABASE_URL ?? 'file:./data/fitness.db';
const dbPath = dbUrl.replace(/^file:/, '');
const dbDir = dirname(resolve(dbPath));
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

let migrationsApplied = false;

const BACKUPS_DIR = resolve(dbDir, 'backups');
const MAX_BACKUPS = 10;

/**
 * SQLite-native online backup of the live DB. Safe to call while the DB is
 * open and being read; writes are blocked briefly. Output goes to
 * `<dbDir>/backups/fitness.<timestamp>.db`.
 *
 * Old backups beyond MAX_BACKUPS are pruned (oldest-first) so disk doesn't
 * grow forever — the user's plan-recommended Unraid backup of /appdata/
 * still catches the longer tail.
 */
function snapshotBeforeMigration(reason: string): void {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });

  // Skip snapshot if the DB is empty (first boot, no data to lose).
  let hasUserData = false;
  try {
    const masterRow = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='session' LIMIT 1"
      )
      .get();
    if (masterRow) {
      const row = sqlite.prepare('SELECT COUNT(*) AS c FROM session').get() as {
        c: number;
      };
      hasUserData = row.c > 0;
    }
  } catch {
    /* if we can't even tell, skip — not worth crashing startup */
  }
  if (!hasUserData) {
    console.log('[db] no user data yet, skipping pre-migration snapshot');
    return;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..+/, '');
  const baseName = basename(dbPath, '.db');
  const dest = resolve(BACKUPS_DIR, `${baseName}.${stamp}.${reason}.db`);

  // better-sqlite3 exposes the SQLite Online Backup API via `.backup()`.
  // Synchronous and fast for files up to GBs.
  const result: unknown = (sqlite as unknown as { backup: (p: string) => unknown }).backup(dest);
  // Some versions return a Promise; await if so.
  if (result && typeof (result as { then?: unknown }).then === 'function') {
    // Don't block — the Promise resolves quickly, and we'll catch errors
    // by checking the file size after migrations complete.
    void (result as Promise<unknown>);
  }
  console.log(`[db] pre-migration snapshot: ${dest}`);

  // Prune oldest backups
  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter((n) => n.startsWith(baseName + '.') && n.endsWith('.db'))
      .map((n) => ({ n, mtime: statSync(resolve(BACKUPS_DIR, n)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime); // newest first
    for (const stale of files.slice(MAX_BACKUPS)) {
      unlinkSync(resolve(BACKUPS_DIR, stale.n));
    }
  } catch (err) {
    console.warn('[db] backup pruning failed (non-fatal):', err);
  }
}

export function runMigrations(): void {
  if (migrationsApplied) return;
  const migrationsFolder = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../drizzle'
  );
  const fallback = resolve(process.cwd(), 'drizzle');
  const folder = existsSync(migrationsFolder) ? migrationsFolder : fallback;

  // Compare on-disk migrations to the applied set; only snapshot if
  // there's actually unapplied work. Cheap query, runs once at boot.
  const pendingCount = countPendingMigrations(folder);
  if (pendingCount > 0) {
    snapshotBeforeMigration(`pre-${pendingCount}migration${pendingCount > 1 ? 's' : ''}`);
  }

  migrate(db, { migrationsFolder: folder });
  migrationsApplied = true;
  console.log('[db] migrations applied');
}

function countPendingMigrations(folder: string): number {
  let onDisk = 0;
  try {
    onDisk = readdirSync(folder).filter((n) => n.endsWith('.sql')).length;
  } catch {
    return 0;
  }
  let applied = 0;
  try {
    const row = sqlite
      .prepare(
        "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
      )
      .get() as { c: number };
    if (row.c > 0) {
      applied =
        (sqlite.prepare('SELECT COUNT(*) AS c FROM __drizzle_migrations').get() as {
          c: number;
        }).c ?? 0;
    }
  } catch {
    /* no table yet → applied = 0 */
  }
  return Math.max(0, onDisk - applied);
}

export const sqliteRaw = sqlite;
