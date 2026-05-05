import { error } from '@sveltejs/kit';
import { photoFullPath } from '$lib/server/photos';
import { createReadStream, statSync } from 'node:fs';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  gif: 'image/gif'
};

export async function GET({ params }) {
  const name = String(params.name ?? '');
  const fullPath = photoFullPath(name);
  if (!fullPath) error(404, 'not found');
  let size: number;
  try {
    size = statSync(fullPath).size;
  } catch {
    error(404, 'not found');
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const stream = createReadStream(fullPath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'content-length': String(size),
      'cache-control': 'private, max-age=86400'
    }
  });
}
