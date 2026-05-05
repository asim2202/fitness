import { runMigrations } from './db';
import { seedIfEmpty } from './seed';

runMigrations();
seedIfEmpty();
console.log('done');
