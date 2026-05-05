import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

export function runMigrations(): void {
  if (migrationsApplied) return;
  const migrationsFolder = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../drizzle'
  );
  const fallback = resolve(process.cwd(), 'drizzle');
  const folder = existsSync(migrationsFolder) ? migrationsFolder : fallback;
  migrate(db, { migrationsFolder: folder });
  migrationsApplied = true;
  console.log('[db] migrations applied');
}

export const sqliteRaw = sqlite;
