import { getUtcDayKey, toLocalStartOfDay, calcDayDiffUTC } from '@/utils/timezoneUtils';

describe('timezoneUtils helpers', () => {
  it('getUtcDayKey returns YYYY-MM-DD based on UTC calendar day', () => {
    // 22:30 UTC-3 equals next day in UTC
    const iso = '2025-01-01T23:30:00-03:00'; // 2025-01-02T02:30:00Z
    expect(getUtcDayKey(iso)).toBe('2025-01-02');
    // Zulu UTC preserves day
    expect(getUtcDayKey('2025-01-02T00:00:00Z')).toBe('2025-01-02');
  });

  it('toLocalStartOfDay sets local midnight', () => {
    const d = toLocalStartOfDay('2025-06-01T18:45:00Z');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it('calcDayDiffUTC measures whole-day difference by UTC keys', () => {
    expect(calcDayDiffUTC('2025-01-01T23:00:00Z', '2025-01-02T00:15:00Z')).toBe(1);
    expect(calcDayDiffUTC('2025-01-03T10:00:00Z', '2025-01-01T00:00:00Z')).toBe(-2);
  });
});

