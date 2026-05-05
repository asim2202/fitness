import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const workoutTemplateDay = sqliteTable('workout_template_day', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dayName: text('day_name').notNull(),
  title: text('title').notNull(),
  ordering: integer('ordering').notNull(),
  deletedAt: text('deleted_at')
});

export const workoutTemplateExercise = sqliteTable('workout_template_exercise', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dayId: integer('day_id')
    .notNull()
    .references(() => workoutTemplateDay.id, { onDelete: 'cascade' }),
  ordering: integer('ordering').notNull(),
  name: text('name').notNull(),
  defaultSets: integer('default_sets').notNull(),
  repLow: integer('rep_low'),
  repHigh: integer('rep_high'),
  restSeconds: integer('rest_seconds').notNull(),
  notesMd: text('notes_md').notNull().default(''),
  deletedAt: text('deleted_at')
});

export const session = sqliteTable('session', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  dayId: integer('day_id')
    .notNull()
    .references(() => workoutTemplateDay.id),
  completedAt: text('completed_at'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const sessionExercise = sqliteTable(
  'session_exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    exerciseTemplateId: integer('exercise_template_id')
      .notNull()
      .references(() => workoutTemplateExercise.id),
    ordering: integer('ordering').notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => ({
    uniq: unique('session_exercise_unique').on(t.sessionId, t.exerciseTemplateId)
  })
);

export const sessionSet = sqliteTable(
  'session_set',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionExerciseId: integer('session_exercise_id')
      .notNull()
      .references(() => sessionExercise.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    weight: real('weight'),
    reps: integer('reps'),
    feltEasy: integer('felt_easy', { mode: 'boolean' }).notNull().default(false),
    loggedAt: text('logged_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    clientId: text('client_id').unique()
  },
  (t) => ({
    uniq: unique('session_set_unique').on(t.sessionExerciseId, t.setNumber)
  })
);

export const bodyweightLog = sqliteTable('bodyweight_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  weightKg: real('weight_kg').notNull(),
  waistCm: real('waist_cm'),
  note: text('note').notNull().default(''),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const photoLog = sqliteTable('photo_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  takenAt: text('taken_at').notNull(),
  filePath: text('file_path').notNull(),
  angle: text('angle'),
  note: text('note').notNull().default(''),
  clientId: text('client_id').unique(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export type WorkoutTemplateDay = typeof workoutTemplateDay.$inferSelect;
export type WorkoutTemplateExercise = typeof workoutTemplateExercise.$inferSelect;
export type Session = typeof session.$inferSelect;
export type SessionExercise = typeof sessionExercise.$inferSelect;
export type SessionSet = typeof sessionSet.$inferSelect;
export type BodyweightLog = typeof bodyweightLog.$inferSelect;
export type PhotoLog = typeof photoLog.$inferSelect;
