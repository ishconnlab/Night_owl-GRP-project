export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight UTC on the day the given date falls on. Used so "today" and "days
 * remaining" are computed in the same timezone the queries bucket revenue in.
 */
export function startOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Whole days from today until `isoDate`. Negative once the date has passed, so
 * `0` is expiring today and `-1` is already expired.
 */
export function daysUntil(isoDate: string | null, now = new Date()): number | null {
  if (!isoDate) return null;

  // expiration_date is a DATE column: compare at day granularity, ignoring the
  // time component, so a batch is never a day early because of the clock.
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(target.getTime())) return null;

  return Math.round((target.getTime() - startOfDayUtc(now).getTime()) / DAY_MS);
}
