import { error } from '@sveltejs/kit';
import {
  getDayByName,
  getExercisesForDay,
  getOrCreateSession,
  getSetsForSession,
  getSuggestedWeight
} from '$lib/server/queries';
import { dayNameOf, WORKOUT_DAYS, type DayName } from '$lib/dates';

export async function load({ params }) {
  const date = params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'invalid date');

  const dayName = dayNameOf(date) as DayName;
  if (!WORKOUT_DAYS.includes(dayName)) {
    return {
      date,
      dayName,
      isWorkoutDay: false as const
    };
  }

  const day = getDayByName(dayName);
  if (!day) error(404, `no template for ${dayName}`);

  const exercises = getExercisesForDay(day.id);
  const session = getOrCreateSession(date, day.id);
  const sets = getSetsForSession(session.id);

  const suggestions = exercises.map((ex) => ({
    exerciseTemplateId: ex.id,
    suggestion: getSuggestedWeight(ex.id, ex.repHigh)
  }));

  return {
    date,
    dayName,
    isWorkoutDay: true as const,
    day,
    exercises,
    session,
    sets,
    suggestions
  };
}
