import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations, sqliteRaw } from './db';
import {
  getExerciseSuggestion,
  getOrCreateSession,
  getOrCreateSessionExercise,
  logSet
} from './queries';

beforeAll(() => {
  runMigrations();
  // Templates: one day with one exercise (rep range 8-12, default 3 sets)
  sqliteRaw.exec(`
    INSERT INTO workout_template_day (day_name, title, ordering)
    VALUES ('Monday', 'Test', 1);

    INSERT INTO workout_template_exercise
      (day_id, ordering, name, default_sets, rep_low, rep_high, rest_seconds, notes_md)
    VALUES (1, 1, 'Test Press', 3, 8, 12, 90, '');
  `);
});

beforeEach(() => {
  // Reset history between tests; keep templates.
  sqliteRaw.exec('DELETE FROM session_set');
  sqliteRaw.exec('DELETE FROM session_exercise');
  sqliteRaw.exec('DELETE FROM session');
});

describe('logSet', () => {
  it('inserts a new set when none exists at that position', () => {
    const sess = getOrCreateSession('2026-05-05', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    const result = logSet({
      sessionExerciseId: se.id,
      setNumber: 1,
      weight: 50,
      reps: 10,
      feltEasy: false,
      clientId: 'cid-1'
    });
    expect(result.weight).toBe(50);
    expect(result.reps).toBe(10);

    const count = sqliteRaw.prepare('SELECT COUNT(*) AS c FROM session_set').get() as { c: number };
    expect(count.c).toBe(1);
  });

  it('returns the same row when the same clientId is sent twice (retry-dedupe)', () => {
    const sess = getOrCreateSession('2026-05-05', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    const a = logSet({
      sessionExerciseId: se.id,
      setNumber: 1,
      weight: 50,
      reps: 10,
      feltEasy: false,
      clientId: 'cid-retry'
    });
    const b = logSet({
      sessionExerciseId: se.id,
      setNumber: 1,
      weight: 999, // different value — must be IGNORED on retry
      reps: 999,
      feltEasy: true,
      clientId: 'cid-retry'
    });
    expect(b.id).toBe(a.id);
    expect(b.weight).toBe(50); // original wins, retry doesn't overwrite
  });

  it('updates the existing row when a different clientId hits the same (sessionExercise, setNumber)', () => {
    const sess = getOrCreateSession('2026-05-05', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    logSet({
      sessionExerciseId: se.id,
      setNumber: 1,
      weight: 50,
      reps: 10,
      feltEasy: false,
      clientId: 'cid-original'
    });
    const updated = logSet({
      sessionExerciseId: se.id,
      setNumber: 1,
      weight: 55,
      reps: 8,
      feltEasy: true,
      clientId: 'cid-edit' // user edited the set
    });
    expect(updated.weight).toBe(55);
    expect(updated.reps).toBe(8);
    expect(updated.feltEasy).toBe(true);

    // Still only one row at that position
    const count = sqliteRaw
      .prepare(
        'SELECT COUNT(*) AS c FROM session_set WHERE session_exercise_id = ? AND set_number = 1'
      )
      .get(se.id) as { c: number };
    expect(count.c).toBe(1);
  });

  it('keeps sets in different sessions completely isolated', () => {
    const sessA = getOrCreateSession('2026-05-04', 1);
    const sessB = getOrCreateSession('2026-05-05', 1);
    const seA = getOrCreateSessionExercise(sessA.id, 1);
    const seB = getOrCreateSessionExercise(sessB.id, 1);
    logSet({ sessionExerciseId: seA.id, setNumber: 1, weight: 40, reps: 12, feltEasy: false, clientId: 'a-1' });
    logSet({ sessionExerciseId: seB.id, setNumber: 1, weight: 50, reps: 12, feltEasy: false, clientId: 'b-1' });

    const aSets = sqliteRaw.prepare('SELECT weight FROM session_set WHERE session_exercise_id = ?').all(seA.id) as { weight: number }[];
    const bSets = sqliteRaw.prepare('SELECT weight FROM session_set WHERE session_exercise_id = ?').all(seB.id) as { weight: number }[];
    expect(aSets).toEqual([{ weight: 40 }]);
    expect(bSets).toEqual([{ weight: 50 }]);
  });
});

describe('getExerciseSuggestion', () => {
  it('returns no suggestion when there is no prior session', () => {
    const s = getExerciseSuggestion(1, 12);
    expect(s.bumped).toBe(false);
    expect(s.bumpAmount).toBe(0);
    expect(s.perSet).toEqual([]);
  });

  it('returns previous set values without bumping when not all sets hit top of range', () => {
    const sess = getOrCreateSession('2026-05-04', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    logSet({ sessionExerciseId: se.id, setNumber: 1, weight: 50, reps: 12, feltEasy: true, clientId: 'a' });
    logSet({ sessionExerciseId: se.id, setNumber: 2, weight: 50, reps: 11, feltEasy: false, clientId: 'b' });
    logSet({ sessionExerciseId: se.id, setNumber: 3, weight: 50, reps: 10, feltEasy: false, clientId: 'c' });

    const s = getExerciseSuggestion(1, 12);
    expect(s.bumped).toBe(false);
    expect(s.bumpAmount).toBe(0);
    expect(s.perSet).toHaveLength(3);
    expect(s.perSet[0]).toEqual({ setNumber: 1, weight: 50, reps: 12 });
    expect(s.perSet[2]).toEqual({ setNumber: 3, weight: 50, reps: 10 });
  });

  it('bumps weight by 1 when ALL sets hit top of range AND any felt easy', () => {
    const sess = getOrCreateSession('2026-05-04', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    logSet({ sessionExerciseId: se.id, setNumber: 1, weight: 50, reps: 12, feltEasy: true, clientId: 'a' });
    logSet({ sessionExerciseId: se.id, setNumber: 2, weight: 50, reps: 12, feltEasy: false, clientId: 'b' });
    logSet({ sessionExerciseId: se.id, setNumber: 3, weight: 50, reps: 12, feltEasy: false, clientId: 'c' });

    const s = getExerciseSuggestion(1, 12);
    expect(s.bumped).toBe(true);
    expect(s.bumpAmount).toBe(1);
    expect(s.perSet[0].weight).toBe(51); // bumped
    expect(s.perSet[1].weight).toBe(51);
    expect(s.perSet[2].weight).toBe(51);
  });

  it('does not bump if all sets hit top range but no set felt easy', () => {
    const sess = getOrCreateSession('2026-05-04', 1);
    const se = getOrCreateSessionExercise(sess.id, 1);
    logSet({ sessionExerciseId: se.id, setNumber: 1, weight: 50, reps: 12, feltEasy: false, clientId: 'a' });
    logSet({ sessionExerciseId: se.id, setNumber: 2, weight: 50, reps: 12, feltEasy: false, clientId: 'b' });
    logSet({ sessionExerciseId: se.id, setNumber: 3, weight: 50, reps: 12, feltEasy: false, clientId: 'c' });

    const s = getExerciseSuggestion(1, 12);
    expect(s.bumped).toBe(false);
    expect(s.perSet[0].weight).toBe(50);
  });

  it('excludes the current session so it suggests from the LAST workout, not the in-progress one', () => {
    const yesterday = getOrCreateSession('2026-05-04', 1);
    const yesterdaySE = getOrCreateSessionExercise(yesterday.id, 1);
    logSet({ sessionExerciseId: yesterdaySE.id, setNumber: 1, weight: 40, reps: 10, feltEasy: false, clientId: 'y1' });

    const today = getOrCreateSession('2026-05-05', 1);
    const todaySE = getOrCreateSessionExercise(today.id, 1);
    logSet({ sessionExerciseId: todaySE.id, setNumber: 1, weight: 99, reps: 99, feltEasy: false, clientId: 't1' });

    const s = getExerciseSuggestion(1, 12, today.id);
    expect(s.perSet[0].weight).toBe(40); // yesterday's, not today's mid-workout 99
  });
});
