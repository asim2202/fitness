import { isoDate, startOfMonth, endOfMonth } from '$lib/dates';
import {
  lastBodyweightEntry,
  listDays,
  listSessionsInRange
} from '$lib/server/queries';

export async function load() {
  const today = new Date();
  const start = isoDate(startOfMonth(today));
  const end = isoDate(endOfMonth(today));

  return {
    days: listDays(),
    sessions: listSessionsInRange(start, end),
    lastWeight: lastBodyweightEntry(),
    today: isoDate(today)
  };
}
