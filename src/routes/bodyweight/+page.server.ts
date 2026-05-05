import { isoDate } from '$lib/dates';
import { listBodyweightInRange } from '$lib/server/queries';

export async function load() {
  const today = new Date();
  const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const entries = listBodyweightInRange(isoDate(ninetyAgo), isoDate(today));
  return { entries, today: isoDate(today) };
}
