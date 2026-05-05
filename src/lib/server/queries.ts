import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import {
  bodyweightLog,
  photoLog,
  session,
  sessionExercise,
  sessionSet,
  workoutTemplateDay,
  workoutTemplateExercise,
  type WorkoutTemplateExercise
} from './schema';

// Templates ----------

// Note on soft-delete: list/active queries filter out deleted templates so
// they don't clutter the picker. Lookups by ID intentionally include deleted
// rows so that history pages still render the original exercise name.

export function listDays() {
  return db
    .select()
    .from(workoutTemplateDay)
    .where(isNull(workoutTemplateDay.deletedAt))
    .orderBy(workoutTemplateDay.ordering)
    .all();
}

export function getDayByName(dayName: string) {
  return db
    .select()
    .from(workoutTemplateDay)
    .where(
      and(eq(workoutTemplateDay.dayName, dayName), isNull(workoutTemplateDay.deletedAt))
    )
    .get();
}

export function getDayById(id: number) {
  // Lookups by ID return soft-deleted rows too — history pages need them.
  return db.select().from(workoutTemplateDay).where(eq(workoutTemplateDay.id, id)).get();
}

export function getExercisesForDay(dayId: number): WorkoutTemplateExercise[] {
  return db
    .select()
    .from(workoutTemplateExercise)
    .where(
      and(
        eq(workoutTemplateExercise.dayId, dayId),
        isNull(workoutTemplateExercise.deletedAt)
      )
    )
    .orderBy(workoutTemplateExercise.ordering)
    .all();
}

export function getExerciseById(id: number) {
  return db
    .select()
    .from(workoutTemplateExercise)
    .where(eq(workoutTemplateExercise.id, id))
    .get();
}

// Sessions ----------

export function getOrCreateSession(date: string, dayId: number) {
  const existing = db
    .select()
    .from(session)
    .where(and(eq(session.date, date), eq(session.dayId, dayId)))
    .get();
  if (existing) return existing;
  const created = db
    .insert(session)
    .values({ date, dayId, notes: '' })
    .returning()
    .all();
  return created[0];
}

export function getSessionByDate(date: string) {
  return db.select().from(session).where(eq(session.date, date)).get();
}

export function markSessionComplete(sessionId: number) {
  return db
    .update(session)
    .set({ completedAt: new Date().toISOString() })
    .where(eq(session.id, sessionId))
    .run();
}

export function deleteSession(sessionId: number) {
  return db.delete(session).where(eq(session.id, sessionId)).run();
}

export function listSessionsInRange(startDate: string, endDate: string) {
  return db
    .select()
    .from(session)
    .where(and(gte(session.date, startDate), sql`${session.date} <= ${endDate}`))
    .all();
}

// Session-exercise (the per-(session, exercise) instance) ----------

export function getOrCreateSessionExercise(
  sessionId: number,
  exerciseTemplateId: number
) {
  const existing = db
    .select()
    .from(sessionExercise)
    .where(
      and(
        eq(sessionExercise.sessionId, sessionId),
        eq(sessionExercise.exerciseTemplateId, exerciseTemplateId)
      )
    )
    .get();
  if (existing) return existing;

  const ex = getExerciseById(exerciseTemplateId);
  const ordering = ex?.ordering ?? 0;

  const created = db
    .insert(sessionExercise)
    .values({ sessionId, exerciseTemplateId, ordering })
    .returning()
    .all();
  return created[0];
}

export function getSessionExercisesForSession(sessionId: number) {
  return db
    .select()
    .from(sessionExercise)
    .where(eq(sessionExercise.sessionId, sessionId))
    .orderBy(sessionExercise.ordering)
    .all();
}

// Sets ----------

export interface LogSetInput {
  sessionExerciseId: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  feltEasy: boolean;
  clientId: string;
}

/**
 * Upsert a set keyed on (session_exercise_id, set_number). Editing a set
 * updates the existing row instead of creating a duplicate. The clientId
 * is also unique, so a retry of the same request is dedupe'd separately.
 */
export function logSet(input: LogSetInput) {
  // Retry of same client request → return existing row unchanged.
  const byClient = db
    .select()
    .from(sessionSet)
    .where(eq(sessionSet.clientId, input.clientId))
    .get();
  if (byClient) return byClient;

  // Existing set at the same position → UPDATE.
  const byPos = db
    .select()
    .from(sessionSet)
    .where(
      and(
        eq(sessionSet.sessionExerciseId, input.sessionExerciseId),
        eq(sessionSet.setNumber, input.setNumber)
      )
    )
    .get();

  if (byPos) {
    db.update(sessionSet)
      .set({
        weight: input.weight,
        reps: input.reps,
        feltEasy: input.feltEasy,
        loggedAt: new Date().toISOString(),
        clientId: input.clientId
      })
      .where(eq(sessionSet.id, byPos.id))
      .run();
    return { ...byPos, ...input };
  }

  // Otherwise INSERT.
  const created = db.insert(sessionSet).values(input).returning().all();
  return created[0];
}

export function getSetsForSession(sessionId: number) {
  // Returns sets joined with their session_exercise so callers can group.
  return db
    .select({
      id: sessionSet.id,
      sessionExerciseId: sessionSet.sessionExerciseId,
      exerciseTemplateId: sessionExercise.exerciseTemplateId,
      setNumber: sessionSet.setNumber,
      weight: sessionSet.weight,
      reps: sessionSet.reps,
      feltEasy: sessionSet.feltEasy,
      loggedAt: sessionSet.loggedAt
    })
    .from(sessionSet)
    .innerJoin(sessionExercise, eq(sessionSet.sessionExerciseId, sessionExercise.id))
    .where(eq(sessionExercise.sessionId, sessionId))
    .orderBy(sessionExercise.ordering, sessionSet.setNumber)
    .all();
}

// History ----------

export interface ExerciseSessionHistory {
  sessionExerciseId: number;
  sessionId: number;
  date: string;
  sets: Array<{
    setNumber: number;
    weight: number | null;
    reps: number | null;
    feltEasy: boolean;
  }>;
}

export function getExerciseHistory(
  exerciseTemplateId: number,
  limit = 8
): ExerciseSessionHistory[] {
  // Fetch the most recent N session_exercise rows for this template.
  const seRows = db
    .select({
      id: sessionExercise.id,
      sessionId: sessionExercise.sessionId,
      date: session.date
    })
    .from(sessionExercise)
    .innerJoin(session, eq(sessionExercise.sessionId, session.id))
    .where(eq(sessionExercise.exerciseTemplateId, exerciseTemplateId))
    .orderBy(desc(session.date))
    .limit(limit)
    .all();

  if (seRows.length === 0) return [];

  // Fetch sets for those session_exercise rows in one query.
  const seIds = seRows.map((r) => r.id);
  const setRows = db
    .select()
    .from(sessionSet)
    .where(sql`${sessionSet.sessionExerciseId} IN (${sql.join(seIds, sql`, `)})`)
    .orderBy(sessionSet.sessionExerciseId, sessionSet.setNumber)
    .all();

  return seRows.map((se) => ({
    sessionExerciseId: se.id,
    sessionId: se.sessionId,
    date: se.date,
    sets: setRows
      .filter((s) => s.sessionExerciseId === se.id)
      .map((s) => ({
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        feltEasy: s.feltEasy
      }))
  }));
}

export interface PerSetSuggestion {
  setNumber: number;
  weight: number | null;
  reps: number | null;
}

export interface ExerciseSuggestion {
  bumped: boolean;
  bumpAmount: number;
  reason: string;
  perSet: PerSetSuggestion[];
}

export function getExerciseSuggestion(
  exerciseTemplateId: number,
  repHigh: number | null,
  excludeSessionId: number | null = null
): ExerciseSuggestion {
  const history = getExerciseHistory(exerciseTemplateId, 5);
  // Use the most recent session that's NOT the current one (so we don't
  // suggest based on what the user just logged in this session).
  const last = history.find(
    (h) => excludeSessionId == null || h.sessionId !== excludeSessionId
  );

  if (!last || last.sets.length === 0) {
    return { bumped: false, bumpAmount: 0, reason: 'no prior session', perSet: [] };
  }

  const allSetsHitTopRange =
    repHigh != null && last.sets.every((s) => s.reps != null && s.reps >= repHigh);
  const anyEasy = last.sets.some((s) => s.feltEasy);
  const bumped = allSetsHitTopRange && anyEasy;
  const bumpAmount = bumped ? 1 : 0;

  return {
    bumped,
    bumpAmount,
    reason: bumped
      ? `Hit ${repHigh}+ on every set last time and ticked "felt easy" — bumping pin by 1.`
      : 'matching last session',
    perSet: last.sets.map((s) => ({
      setNumber: s.setNumber,
      weight: s.weight == null ? null : s.weight + bumpAmount,
      reps: s.reps
    }))
  };
}

// Bodyweight ----------

export function listBodyweightInRange(startDate: string, endDate: string) {
  return db
    .select()
    .from(bodyweightLog)
    .where(and(gte(bodyweightLog.date, startDate), sql`${bodyweightLog.date} <= ${endDate}`))
    .orderBy(bodyweightLog.date)
    .all();
}

export function lastBodyweightEntry() {
  return db.select().from(bodyweightLog).orderBy(desc(bodyweightLog.date)).limit(1).get();
}

export interface UpsertBodyweightInput {
  date: string;
  weightKg: number;
  waistCm: number | null;
  note: string;
}

export function upsertBodyweight(input: UpsertBodyweightInput) {
  const existing = db
    .select()
    .from(bodyweightLog)
    .where(eq(bodyweightLog.date, input.date))
    .get();
  if (existing) {
    db.update(bodyweightLog)
      .set({ weightKg: input.weightKg, waistCm: input.waistCm, note: input.note })
      .where(eq(bodyweightLog.id, existing.id))
      .run();
    return { ...existing, ...input };
  }
  const created = db.insert(bodyweightLog).values(input).returning().all();
  return created[0];
}

// Photos ----------

export function listPhotos() {
  return db.select().from(photoLog).orderBy(desc(photoLog.takenAt)).all();
}

export interface InsertPhotoInput {
  takenAt: string;
  filePath: string;
  angle: string | null;
  note: string;
  clientId: string | null;
}

export function getPhotoByClientId(clientId: string) {
  return db.select().from(photoLog).where(eq(photoLog.clientId, clientId)).get();
}

export function insertPhoto(input: InsertPhotoInput) {
  if (input.clientId) {
    const existing = getPhotoByClientId(input.clientId);
    if (existing) return existing;
  }
  const created = db.insert(photoLog).values(input).returning().all();
  return created[0];
}

export function deletePhoto(id: number) {
  return db.delete(photoLog).where(eq(photoLog.id, id)).returning().get();
}
