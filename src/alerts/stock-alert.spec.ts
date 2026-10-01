import {
  EXPIRATION_THRESHOLDS,
  severityForDays,
} from './entities/stock-alert.entity';

describe('severityForDays', () => {
  it('is critical at 7 days or fewer', () => {
    expect(severityForDays(7)).toBe('critical');
    expect(severityForDays(1)).toBe('critical');
    expect(severityForDays(0)).toBe('critical');
    expect(severityForDays(-3)).toBe('critical');
  });

  it('is warning above 7 and up to 14 days', () => {
    expect(severityForDays(8)).toBe('warning');
    expect(severityForDays(14)).toBe('warning');
  });

  it('is info beyond 14 days', () => {
    expect(severityForDays(15)).toBe('info');
    expect(severityForDays(30)).toBe('info');
  });
});

describe('EXPIRATION_THRESHOLDS', () => {
  it('is the 30/14/7/1 ladder staff asked for', () => {
    expect(EXPIRATION_THRESHOLDS).toEqual([30, 14, 7, 1]);
  });
});
