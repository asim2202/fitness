import { json, error } from '@sveltejs/kit';
import {
  getPhotoByClientId,
  insertPhoto,
  listPhotos,
  deletePhoto
} from '$lib/server/queries';
import { savePhoto, deletePhotoFile } from '$lib/server/photos';

export async function GET() {
  return json(listPhotos());
}

export async function POST({ request }) {
  const form = await request.formData();
  const file = form.get('photo');
  if (!(file instanceof File)) error(400, 'photo file required');

  const clientId = (form.get('clientId') as string | null) || null;

  // Spam-tap dedupe: same clientId already uploaded? Return that row, don't
  // re-save the file. Without this, every retry creates a new copy on disk.
  if (clientId) {
    const existing = getPhotoByClientId(clientId);
    if (existing) return json(existing);
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const bytes = await file.arrayBuffer();
  const filename = await savePhoto(bytes, ext);

  const takenAt = String(form.get('takenAt') ?? new Date().toISOString());
  const angle = (form.get('angle') as string | null) || null;
  const note = String(form.get('note') ?? '');

  const created = insertPhoto({ takenAt, filePath: filename, angle, note, clientId });
  return json(created);
}

export async function DELETE({ url }) {
  const id = Number(url.searchParams.get('id'));
  if (!id) error(400, 'id required');
  const removed = deletePhoto(id);
  if (removed) await deletePhotoFile(removed.filePath);
  return json({ ok: true });
}
