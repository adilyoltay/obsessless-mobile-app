import { quantiles, recencyAlpha, jitterXY, energyToColor } from '@/utils/statistics';

describe('quantiles()', () => {
  it('handles empty array', () => {
    const q = quantiles([]);
    expect(q.p25).toBeNaN();
    expect(q.p50).toBeNaN();
    expect(q.p75).toBeNaN();
  });
  it('single element', () => {
    const q = quantiles([42]);
    expect(q).toEqual({ p25: 42, p50: 42, p75: 42 });
  });
  it('monotonic sequence', () => {
    const q = quantiles([0, 10, 20, 30, 40, 50, 60, 70]);
    expect(q.p50).toBeCloseTo(35, 6);
    expect(q.p25).toBeCloseTo(17.5, 6);
    expect(q.p75).toBeCloseTo(52.5, 6);
  });
});

describe('recencyAlpha()', () => {
  it('maps to [0.5,1.0]', () => {
    const a0 = recencyAlpha(0, 0, 1000);
    const aMid = recencyAlpha(500, 0, 1000);
    const a1 = recencyAlpha(1000, 0, 1000);
    expect(a0).toBeCloseTo(0.5, 6);
    expect(aMid).toBeGreaterThan(0.5);
    expect(a1).toBeCloseTo(1.0, 6);
  });
});

describe('jitterXY()', () => {
  it('deterministic for same seedKey', () => {
    const a = jitterXY('seed-123');
    const b = jitterXY('seed-123');
    expect(a).toEqual(b);
  });
  it('bounded by xMax/yMax', () => {
    const { jx, jy } = jitterXY('abc', 10, 2);
    expect(Math.abs(jx)).toBeLessThanOrEqual(10);
    expect(Math.abs(jy)).toBeLessThanOrEqual(2);
  });
});

describe('energyToColor()', () => {
  it('returns hsla string', () => {
    const c = energyToColor(5, 0.8, false);
    expect(c.startsWith('hsla(')).toBe(true);
  });
});
