import { json, error } from '@sveltejs/kit';
import {
  getDayByName,
  getOrCreateSession,
  getSessionByDate,
  markSessionComplete
} from '$lib/server/queries';

export async function POST({ request }) {
  const body = await request.json();
  const date = String(body.date ?? '');
  const dayName = String(body.dayName ?? '');
  if (!date || !dayName) error(400, 'date and dayName required');

  const day = getDayByName(dayName);
  if (!day) error(404, `unknown day: ${dayName}`);

  const session = getOrCreateSession(date, day.id);
  return json(session);
}

export async function GET({ url }) {
  const date = url.searchParams.get('date');
  if (!date) error(400, 'date required');
  return json(getSessionByDate(date) ?? null);
}

export async function PATCH({ request }) {
  const body = await request.json();
  const sessionId = Number(body.sessionId);
  if (!sessionId) error(400, 'sessionId required');
  if (body.complete) markSessionComplete(sessionId);
  return json({ ok: true });
}
