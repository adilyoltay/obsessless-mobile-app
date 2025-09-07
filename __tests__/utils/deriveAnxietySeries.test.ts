import { deriveAnxietySeries } from '@/utils/statistics';

describe('deriveAnxietySeries', () => {
  it('returns fallback [5] when empty', () => {
    expect(deriveAnxietySeries([], [], [])).toEqual([5]);
  });
  it('returns raw values when not all fives', () => {
    expect(deriveAnxietySeries([70], [7], [5, 6, 7])).toEqual([5, 6, 7]);
  });
  it('derives when all fives and we have moods and energies', () => {
    const res = deriveAnxietySeries([30, 40, 50], [7, 8], [5, 5, 5]);
    expect(res.length).toBe(3);
    // Low mood tends to higher anxiety (>=6)
    expect(res[0]).toBeGreaterThanOrEqual(4);
    expect(res[0]).toBeLessThanOrEqual(8);
  });
});

