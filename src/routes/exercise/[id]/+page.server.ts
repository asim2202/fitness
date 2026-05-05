import { error } from '@sveltejs/kit';
import { getExerciseById, getExerciseHistory } from '$lib/server/queries';

export async function load({ params }) {
  const id = Number(params.id);
  if (!id) error(400, 'invalid id');
  const exercise = getExerciseById(id);
  if (!exercise) error(404, 'unknown exercise');
  const history = getExerciseHistory(id, 12);
  return { exercise, history };
}
