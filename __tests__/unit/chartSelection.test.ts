import { getXLabelVisibility, formatXLabel } from '@/components/mood/helpers/chartSelection';

describe('chart selection helpers', () => {
  test('getXLabelVisibility respects day spacing', () => {
    // contentWidth small -> step 4
    expect(getXLabelVisibility(0, 24, 'day', 200)).toBe(true);
    expect(getXLabelVisibility(1, 24, 'day', 200)).toBe(false);
    expect(getXLabelVisibility(4, 24, 'day', 200)).toBe(true);
  });

  test('getXLabelVisibility shows edges', () => {
    expect(getXLabelVisibility(0, 10, 'month', 300)).toBe(true);
    expect(getXLabelVisibility(9, 10, 'month', 300)).toBe(true);
  });

  test('formatXLabel day uses HH', () => {
    const item: any = { date: '2025-09-07#03' };
    expect(formatXLabel(item, 'day', 'tr-TR')).toBe('03');
  });

  test('formatXLabel week uses weekday short', () => {
    const item: any = { date: '2025-09-08' }; // Monday
    const res = formatXLabel(item, 'week', 'tr-TR');
    expect(['Pz','Pt','Sa','Ça','Pe','Cu','Ct']).toContain(res);
  });

  test('formatXLabel 6months uses month short', () => {
    const item: any = { date: '2025-01-01' };
    const res = formatXLabel(item, '6months', 'tr-TR');
    expect(res.length).toBeGreaterThanOrEqual(2);
  });
});

