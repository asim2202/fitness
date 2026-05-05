import { json, error } from '@sveltejs/kit';
import {
  deleteSession,
  getDayById,
  getDayByName,
  getOrCreateSession,
  getSessionByDate,
  markSessionComplete
} from '$lib/server/queries';

export async function POST({ request }) {
  const body = await request.json();
  const date = String(body.date ?? '');
  if (!date) error(400, 'date required');

  // Accept either dayId (preferred — works for any template) or dayName.
  const dayId = body.dayId == null ? null : Number(body.dayId);
  const dayName = body.dayName == null ? null : String(body.dayName);

  let day = dayId ? getDayById(dayId) : null;
  if (!day && dayName) day = getDayByName(dayName);
  if (!day) error(400, 'dayId or dayName required');

  // getOrCreateSession is naturally idempotent on (date, dayId) — returns
  // the existing row if one exists. So a clientId isn't strictly needed,
  // but accepted to keep the API shape consistent across endpoints.
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

export async function DELETE({ url }) {
  const id = Number(url.searchParams.get('id'));
  if (!id) error(400, 'id required');
  deleteSession(id);
  return json({ ok: true });
}
