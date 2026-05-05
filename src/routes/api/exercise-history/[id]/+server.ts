import { json } from '@sveltejs/kit';
import { getExerciseHistory } from '$lib/server/queries';

export async function GET({ params, url }) {
  const id = Number(params.id);
  const limit = Number(url.searchParams.get('limit') ?? 8);
  return json(getExerciseHistory(id, limit));
}
