import { DAY_MS, daysUntil, startOfDayUtc } from './dates';

describe('startOfDayUtc', () => {
  it('drops the time component in UTC', () => {
    const result = startOfDayUtc(new Date('2026-03-14T23:45:12.345Z'));

    expect(result.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  it('leaves a date already at midnight untouched', () => {
    const midnight = new Date('2026-01-01T00:00:00.000Z');

    expect(startOfDayUtc(midnight).getTime()).toBe(midnight.getTime());
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-03-14T18:30:00.000Z');

  it('counts whole days, ignoring the clock', () => {
    expect(daysUntil('2026-03-14', now)).toBe(0);
    expect(daysUntil('2026-03-15', now)).toBe(1);
    expect(daysUntil('2026-03-21', now)).toBe(7);
    expect(daysUntil('2026-04-13', now)).toBe(30);
  });

  it('is negative once the date has passed', () => {
    expect(daysUntil('2026-03-13', now)).toBe(-1);
    expect(daysUntil('2026-03-04', now)).toBe(-10);
  });

  it('ignores a time component on the stored date', () => {
    expect(daysUntil('2026-03-21T00:00:00.000Z', now)).toBe(7);
  });

  it('returns null for a missing or unparseable date', () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('', now)).toBeNull();
    expect(daysUntil('not-a-date', now)).toBeNull();
  });
});

describe('DAY_MS', () => {
  it('is one day in milliseconds', () => {
    expect(DAY_MS).toBe(86_400_000);
  });
});
