// Vitest setup. Uses an isolated SQLite file per test run so tests can't
// stomp on dev data and don't need any external services.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'fitness-test-'));
process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`;
