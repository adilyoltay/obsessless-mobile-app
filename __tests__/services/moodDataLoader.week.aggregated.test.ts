import { moodDataLoader } from '@/services/moodDataLoader';

jest.mock('@/services/moodTrackingService', () => {
  return {
    __esModule: true,
    default: {
      getMoodEntries: jest.fn(async (_userId: string, _days: number) => {
        const now = new Date();
        const ymd = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };
        const dateMinus = (n: number) => {
          const d = new Date(now);
          d.setDate(d.getDate() - n);
          d.setHours(12, 0, 0, 0); // mid-day to avoid TZ edge cases
          return d;
        };
        // Today: 3 entries → mood 40, 50(neutral), 60; energy 4, 6(neutral), 8
        const today = dateMinus(0).toISOString();
        // Yesterday: only neutrals 50/6
        const yesterday = dateMinus(1).toISOString();
        // Two days ago: single non-neutral 70/9
        const twoDaysAgo = dateMinus(2).toISOString();

        return [
          { id: 't1', user_id: 'u', mood_score: 40, energy_level: 4, anxiety_level: 5, notes: '', triggers: [], timestamp: today },
          { id: 't2', user_id: 'u', mood_score: 50, energy_level: 6, anxiety_level: 5, notes: '', triggers: [], timestamp: today },
          { id: 't3', user_id: 'u', mood_score: 60, energy_level: 8, anxiety_level: 5, notes: '', triggers: [], timestamp: today },

          { id: 'y1', user_id: 'u', mood_score: 50, energy_level: 6, anxiety_level: 5, notes: '', triggers: [], timestamp: yesterday },
          { id: 'y2', user_id: 'u', mood_score: 50, energy_level: 6, anxiety_level: 5, notes: '', triggers: [], timestamp: yesterday },

          { id: 'd2', user_id: 'u', mood_score: 70, energy_level: 9, anxiety_level: 5, notes: '', triggers: [], timestamp: twoDaysAgo },
        ];
      }),
    },
  };
});

describe('moodDataLoader week aggregated(day)', () => {
  it('produces granularity=day with finite p50 where real data exists and correct countReal', async () => {
    const data = await moodDataLoader.loadTimeRange('u', 'week');
    expect(data.aggregated).toBeTruthy();
    expect(data.aggregated!.granularity).toBe('day');
    const items = data.aggregated!.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(3); // at least today + 2 previous

    // Find buckets by date key
    const ymd = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const now = new Date();
    const todayKey = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const yesterdayKey = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const twoDaysKey = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));

    const todayBucket = items.find(b => b.date === todayKey)!;
    expect(todayBucket).toBeTruthy();
    // Two non-neutral mood values: 40 and 60 → p50 should be 50 (interpolated), countReal=2
    expect(Number.isFinite(todayBucket.mood.p50 as any)).toBe(true);
    expect(Math.round((todayBucket.mood.p50 as number))).toBe(50);
    expect(todayBucket.countReal).toBe(2);
    // Count includes neutrals too (3 entries today)
    expect(todayBucket.count).toBeGreaterThanOrEqual(3);

    const yesterdayBucket = items.find(b => b.date === yesterdayKey)!;
    expect(yesterdayBucket).toBeTruthy();
    // Only neutrals → mood p50 is NaN, countReal undefined or 0
    expect(Number.isNaN(yesterdayBucket.mood.p50 as any)).toBe(true);
    expect(yesterdayBucket.countReal === 0 || typeof yesterdayBucket.countReal === 'undefined').toBe(true);

    const twoDaysBucket = items.find(b => b.date === twoDaysKey)!;
    expect(twoDaysBucket).toBeTruthy();
    // Single non-neutral 70 → p50=70, countReal=1
    expect(Number.isFinite(twoDaysBucket.mood.p50 as any)).toBe(true);
    expect(Math.round((twoDaysBucket.mood.p50 as number))).toBe(70);
    expect(twoDaysBucket.countReal).toBe(1);
  });
});

