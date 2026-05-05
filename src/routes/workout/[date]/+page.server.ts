import { error } from '@sveltejs/kit';
import {
  getDayById,
  getExercisesForDay,
  getOrCreateSession,
  getSessionByDate,
  getSetsForSession,
  getSuggestedWeight,
  listDays
} from '$lib/server/queries';
import { dayNameOf } from '$lib/dates';

export async function load({ params, url }) {
  const date = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'invalid date');

  const dayName = dayNameOf(date);

  // If a session already exists for this date, render it.
  let sess = getSessionByDate(date);

  // If a ?pick=<dayId> param is supplied, create the session for that template.
  const pick = Number(url.searchParams.get('pick') ?? 0);
  if (!sess && pick) {
    const tpl = getDayById(pick);
    if (!tpl) error(404, 'unknown workout template');
    sess = getOrCreateSession(date, tpl.id);
  }

  if (!sess) {
    // No session: render a picker with all available templates.
    return {
      date,
      dayName,
      mode: 'picker' as const,
      templates: listDays()
    };
  }

  const day = getDayById(sess.dayId);
  if (!day) error(500, 'session refers to unknown template');
  const exercises = getExercisesForDay(day.id);
  const sets = getSetsForSession(sess.id);

  return {
    date,
    dayName,
    mode: 'session' as const,
    day,
    session: sess,
    exercises,
    sets,
    suggestions: exercises.map((ex) => ({
      exerciseTemplateId: ex.id,
      suggestion: getSuggestedWeight(ex.id, ex.repHigh)
    }))
  };
}
