import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import {
  bodyweightLog,
  photoLog,
  session,
  sessionSet,
  workoutTemplateDay,
  workoutTemplateExercise,
  type WorkoutTemplateExercise
} from './schema';

export function listDays() {
  return db.select().from(workoutTemplateDay).orderBy(workoutTemplateDay.ordering).all();
}

export function getDayByName(dayName: string) {
  return db
    .select()
    .from(workoutTemplateDay)
    .where(eq(workoutTemplateDay.dayName, dayName))
    .get();
}

export function getDayById(id: number) {
  return db.select().from(workoutTemplateDay).where(eq(workoutTemplateDay.id, id)).get();
}

export function getExercisesForDay(dayId: number): WorkoutTemplateExercise[] {
  return db
    .select()
    .from(workoutTemplateExercise)
    .where(eq(workoutTemplateExercise.dayId, dayId))
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

export function getSetsForSession(sessionId: number) {
  return db
    .select()
    .from(sessionSet)
    .where(eq(sessionSet.sessionId, sessionId))
    .orderBy(sessionSet.setNumber)
    .all();
}

export function getSetsForSessionAndExercise(sessionId: number, exerciseTemplateId: number) {
  return db
    .select()
    .from(sessionSet)
    .where(
      and(
        eq(sessionSet.sessionId, sessionId),
        eq(sessionSet.exerciseTemplateId, exerciseTemplateId)
      )
    )
    .orderBy(sessionSet.setNumber)
    .all();
}

export interface LogSetInput {
  sessionId: number;
  exerciseTemplateId: number;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  feltEasy: boolean;
  clientId: string;
}

export function logSet(input: LogSetInput) {
  // dedupe via clientId — if the same clientId is sent twice, return the existing row
  const existing = db
    .select()
    .from(sessionSet)
    .where(eq(sessionSet.clientId, input.clientId))
    .get();
  if (existing) return existing;

  const created = db
    .insert(sessionSet)
    .values({
      sessionId: input.sessionId,
      exerciseTemplateId: input.exerciseTemplateId,
      setNumber: input.setNumber,
      weight: input.weight,
      reps: input.reps,
      feltEasy: input.feltEasy,
      clientId: input.clientId
    })
    .returning()
    .all();
  return created[0];
}

export interface ExerciseSessionHistory {
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
  const rows = db
    .select({
      sessionId: sessionSet.sessionId,
      date: session.date,
      setNumber: sessionSet.setNumber,
      weight: sessionSet.weight,
      reps: sessionSet.reps,
      feltEasy: sessionSet.feltEasy
    })
    .from(sessionSet)
    .innerJoin(session, eq(sessionSet.sessionId, session.id))
    .where(eq(sessionSet.exerciseTemplateId, exerciseTemplateId))
    .orderBy(desc(session.date), sessionSet.setNumber)
    .all();

  const byDate = new Map<number, ExerciseSessionHistory>();
  for (const row of rows) {
    let entry = byDate.get(row.sessionId);
    if (!entry) {
      entry = { sessionId: row.sessionId, date: row.date, sets: [] };
      byDate.set(row.sessionId, entry);
    }
    entry.sets.push({
      setNumber: row.setNumber,
      weight: row.weight,
      reps: row.reps,
      feltEasy: row.feltEasy
    });
  }
  const arr = Array.from(byDate.values());
  arr.forEach((s) => s.sets.sort((a, b) => a.setNumber - b.setNumber));
  return arr.slice(0, limit);
}

export interface SuggestedWeight {
  weight: number | null;
  bumped: boolean;
  reason: string;
}

export function getSuggestedWeight(
  exerciseTemplateId: number,
  repHigh: number | null
): SuggestedWeight {
  const history = getExerciseHistory(exerciseTemplateId, 1);
  const last = history[0];
  if (!last || last.sets.length === 0) {
    return { weight: null, bumped: false, reason: 'no prior session' };
  }

  const topSet = last.sets.reduce(
    (best, s) => ((s.weight ?? -Infinity) > (best.weight ?? -Infinity) ? s : best),
    last.sets[0]
  );

  const lastWeight = topSet.weight;
  if (lastWeight == null) {
    return { weight: null, bumped: false, reason: 'last session had no weight logged' };
  }

  const allSetsHitTopRange =
    repHigh != null &&
    last.sets.every((s) => s.reps != null && s.reps >= repHigh);
  const anyEasy = last.sets.some((s) => s.feltEasy);

  if (allSetsHitTopRange && anyEasy) {
    return {
      weight: lastWeight + 1,
      bumped: true,
      reason: `Hit ${repHigh}+ on every set last time and ticked "felt easy" — bumping pin by 1.`
    };
  }
  return { weight: lastWeight, bumped: false, reason: 'matching last session' };
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
}

export function insertPhoto(input: InsertPhotoInput) {
  const created = db.insert(photoLog).values(input).returning().all();
  return created[0];
}

export function deletePhoto(id: number) {
  return db.delete(photoLog).where(eq(photoLog.id, id)).returning().get();
}
