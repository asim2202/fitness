import { json, error } from '@sveltejs/kit';
import { getExerciseById, getExerciseSuggestion } from '$lib/server/queries';

export async function GET({ url }) {
  const id = Number(url.searchParams.get('exerciseTemplateId'));
  if (!id) error(400, 'exerciseTemplateId required');
  const ex = getExerciseById(id);
  if (!ex) error(404, 'unknown exercise');
  return json(getExerciseSuggestion(id, ex.repHigh));
}
