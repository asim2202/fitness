import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './db';
import { workoutTemplateDay, workoutTemplateExercise } from './schema';

interface SeedExercise {
  ordering: number;
  name: string;
  default_sets: number;
  rep_low: number | null;
  rep_high: number | null;
  rest_seconds: number;
  notes_md: string;
}

interface SeedDay {
  day_name: string;
  title: string;
  ordering: number;
  exercises: SeedExercise[];
}

interface SeedFile {
  name: string;
  description: string;
  days: SeedDay[];
}

function readSeed(): SeedFile {
  const candidates = [
    resolve(process.cwd(), 'seed/default-plan.json'),
    resolve(process.cwd(), '../seed/default-plan.json'),
    resolve(process.cwd(), 'build/seed/default-plan.json')
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as SeedFile;
    } catch {
      // try next
    }
  }
  throw new Error(
    `Could not find seed/default-plan.json. Tried:\n  ${candidates.join('\n  ')}`
  );
}

export function seedIfEmpty(): void {
  const existing = db.select().from(workoutTemplateDay).all();
  if (existing.length > 0) {
    console.log('[seed] templates already present, skipping');
    return;
  }
  const seed = readSeed();
  console.log(`[seed] loading "${seed.name}" (${seed.days.length} days)`);

  for (const day of seed.days) {
    const insertedDays = db
      .insert(workoutTemplateDay)
      .values({
        dayName: day.day_name,
        title: day.title,
        ordering: day.ordering
      })
      .returning()
      .all();
    const insertedDay = insertedDays[0];

    for (const ex of day.exercises) {
      db.insert(workoutTemplateExercise)
        .values({
          dayId: insertedDay.id,
          ordering: ex.ordering,
          name: ex.name,
          defaultSets: ex.default_sets,
          repLow: ex.rep_low,
          repHigh: ex.rep_high,
          restSeconds: ex.rest_seconds,
          notesMd: ex.notes_md
        })
        .run();
    }
  }
  console.log('[seed] templates inserted');
}
