import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const dbUrl = process.env.DATABASE_URL ?? 'file:./data/fitness.db';
const dbPath = dbUrl.replace(/^file:/, '');
export const photosDir = resolve(dirname(dbPath), 'photos');
if (!existsSync(photosDir)) mkdirSync(photosDir, { recursive: true });

export async function savePhoto(
  bytes: ArrayBuffer | Uint8Array,
  ext = 'jpg'
): Promise<string> {
  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  const filename = `${randomUUID()}.${safeExt}`;
  const fullPath = resolve(photosDir, filename);
  await writeFile(fullPath, Buffer.from(bytes as ArrayBuffer));
  return filename;
}

export async function deletePhotoFile(filename: string): Promise<void> {
  // sanitize: only allow uuid-style filenames inside photosDir
  if (!/^[a-f0-9-]+\.[a-z0-9]{1,5}$/i.test(filename)) return;
  const fullPath = resolve(photosDir, filename);
  if (!fullPath.startsWith(photosDir)) return;
  try {
    await unlink(fullPath);
  } catch {
    // already gone
  }
}

export function photoFullPath(filename: string): string | null {
  if (!/^[a-f0-9-]+\.[a-z0-9]{1,5}$/i.test(filename)) return null;
  const fullPath = resolve(photosDir, filename);
  if (!fullPath.startsWith(photosDir)) return null;
  return fullPath;
}
