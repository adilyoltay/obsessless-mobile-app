import { normalizeValence, getEnergyGradient } from '@/utils/chartUtils';

describe('Chart Calculations', () => {
  test('normalizeValence maps 0..100 to -1..1', () => {
    expect(normalizeValence(100)).toBeCloseTo(1);
    expect(normalizeValence(50)).toBeCloseTo(0);
    expect(normalizeValence(0)).toBeCloseTo(-1);
  });

  test('getEnergyGradient returns gradient tuple', () => {
    const g = getEnergyGradient(8);
    expect(Array.isArray(g)).toBe(true);
    expect(g.length).toBe(2);
    expect(g[0]).toMatch(/^#/);
  });
});

