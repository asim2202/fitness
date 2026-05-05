import { json, error } from '@sveltejs/kit';
import { getOrCreateSessionExercise, logSet } from '$lib/server/queries';

export async function POST({ request }) {
  const body = await request.json();
  const sessionId = Number(body.sessionId);
  const exerciseTemplateId = Number(body.exerciseTemplateId);
  const setNumber = Number(body.setNumber);
  const clientId = String(body.clientId ?? '');

  if (!sessionId || !exerciseTemplateId || !setNumber || !clientId) {
    error(400, 'sessionId, exerciseTemplateId, setNumber, clientId required');
  }

  // Server resolves the (session, exercise) → session_exercise row.
  const sessExercise = getOrCreateSessionExercise(sessionId, exerciseTemplateId);

  const created = logSet({
    sessionExerciseId: sessExercise.id,
    setNumber,
    weight: body.weight == null ? null : Number(body.weight),
    reps: body.reps == null ? null : Number(body.reps),
    feltEasy: Boolean(body.feltEasy),
    clientId
  });
  return json(created);
}
