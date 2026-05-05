import {
  listDays,
  listSessionsInRange,
  lastBodyweightEntry
} from '$lib/server/queries';
import { isoDate, startOfMonth, endOfMonth } from '$lib/dates';

export async function load() {
  const today = new Date();
  const start = isoDate(startOfMonth(today));
  const end = isoDate(endOfMonth(today));
  const days = listDays();
  const sessions = listSessionsInRange(start, end);
  const lastWeight = lastBodyweightEntry();

  return {
    days,
    sessions,
    lastWeight,
    today: isoDate(today)
  };
}
