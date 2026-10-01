import { EXPIRATION_THRESHOLDS, severityForDays } from './stock-alert.entity';

describe('severityForDays', () => {
  it('is critical within a week of the expiration date', () => {
    expect(severityForDays(0)).toBe('critical');
    expect(severityForDays(1)).toBe('critical');
    expect(severityForDays(7)).toBe('critical');
  });

  it('is critical for a batch that has already expired', () => {
    expect(severityForDays(-1)).toBe('critical');
    expect(severityForDays(-30)).toBe('critical');
  });

  it('is warning inside the second week', () => {
    expect(severityForDays(8)).toBe('warning');
    expect(severityForDays(14)).toBe('warning');
  });

  it('is information beyond that', () => {
    expect(severityForDays(15)).toBe('info');
    expect(severityForDays(30)).toBe('info');
  });
});

describe('EXPIRATION_THRESHOLDS', () => {
  it('is the set of boundaries staff asked to be warned at', () => {
    expect(EXPIRATION_THRESHOLDS).toEqual([30, 14, 7, 1]);
  });
});
