import { getTrendFromP50 } from '@/utils/trend';

describe('getTrendFromP50', () => {
  it('returns stable for empty or single value', () => {
    expect(getTrendFromP50([])).toBe('stable');
    expect(getTrendFromP50([50])).toBe('stable');
  });
  it('ignores NaN and non-finite values', () => {
    expect(getTrendFromP50([NaN as any, undefined as any, null as any, 40, 60])).toBe('up');
  });
  it('applies threshold', () => {
    expect(getTrendFromP50([50, 55], 10)).toBe('stable');
    expect(getTrendFromP50([50, 61], 10)).toBe('up');
    expect(getTrendFromP50([60, 49], 10)).toBe('down');
  });
});

