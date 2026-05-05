export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export const WORKOUT_DAYS: DayName[] = ['Monday', 'Tuesday', 'Thursday', 'Friday'];

export function dayNameOf(date: Date | string): DayName {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return DAY_NAMES[d.getDay()];
}

export function isoDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shortDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function buildMonthGrid(reference: Date): Array<Array<Date | null>> {
  const first = startOfMonth(reference);
  const last = endOfMonth(reference);
  const startDayIdx = first.getDay(); // 0=Sun

  const grid: Array<Array<Date | null>> = [];
  let week: Array<Date | null> = new Array(startDayIdx).fill(null);

  for (let day = 1; day <= last.getDate(); day++) {
    week.push(new Date(reference.getFullYear(), reference.getMonth(), day));
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    grid.push(week);
  }
  return grid;
}
