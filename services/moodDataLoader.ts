import { InteractionManager } from 'react-native';
import moodTracker from '@/services/moodTrackingService';
import { formatDateYMD } from '@/utils/chartUtils';
import { getUserDateString, toUserLocalDate } from '@/utils/timezoneUtils';
import type { MoodJourneyExtended, TimeRange, MoodEntryLite, DailyAverage, EmotionDistribution, TriggerFrequency, RawDataPoint } from '@/types/mood';

type CacheEntry = { data: MoodJourneyExtended; timestamp: number };

export class OptimizedMoodDataLoader {
  private cache = new Map<string, CacheEntry>();

  async loadTimeRange(userId: string, range: TimeRange): Promise<MoodJourneyExtended> {
    const cacheKey = `${userId}-${range}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }

    // Filters should reflect selected range immediately; load full range now
    const data = await this.loadFullRange(userId, range);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  private async loadProgressively(userId: string, range: TimeRange): Promise<MoodJourneyExtended> {
    const quickData = await this.loadWeek(userId);
    InteractionManager.runAfterInteractions(async () => {
      if (range !== 'week') {
        const fullData = await this.loadFullRange(userId, range);
        const ck = `${userId}-${range}`;
        this.cache.set(ck, { data: fullData, timestamp: Date.now() });
      }
    });
    return quickData;
  }

  private async loadWeek(userId: string): Promise<MoodJourneyExtended> {
    return this.loadFullRange(userId, 'week');
  }

  private daysForRange(range: TimeRange): number {
    switch (range) {
      case 'week': return 7;
      case 'month': return 30;
      case '6months': return 183;
      case 'year': return 365;
      default: return 7;
    }
  }

  private async loadFullRange(userId: string, range: TimeRange): Promise<MoodJourneyExtended> {
    const days = this.daysForRange(range);
    const entries = await moodTracker.getMoodEntries(userId, days);

    const lite: MoodEntryLite[] = (entries || []).map((e) => ({
      id: e.id,
      user_id: e.user_id,
      mood_score: e.mood_score || 0,
      energy_level: e.energy_level || 6,
      anxiety_level: e.anxiety_level || 5,
      notes: e.notes || '',
      triggers: e.triggers || [],
      timestamp: e.timestamp,
    }));

    // Group by date (user timezone)
    const byDate = new Map<string, RawDataPoint[]>();
    for (const e of lite) {
      const d = getUserDateString(e.timestamp);
      const arr = byDate.get(d) || [];
      arr.push({ id: e.id, timestamp: e.timestamp, mood_score: e.mood_score, energy_level: e.energy_level });
      byDate.set(d, arr);
    }

    // Daily averages - NORMALIZE to include all days in selected range
    const today = toUserLocalDate(new Date());
    const start = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      dayKeys.push(formatDateYMD(d));
    }
    const dailyAverages: DailyAverage[] = dayKeys.map((d) => {
      const list = byDate.get(d) || [];
      const avgMood = list.length ? Math.round(list.reduce((s, p) => s + p.mood_score, 0) / list.length) : 0;
      const avgEnergy = list.length ? Math.round(list.reduce((s, p) => s + (p.energy_level || 0), 0) / list.length) : 0;
      const avgAnx = list.length ? Math.round(list.reduce((s, p) => s + (typeof (p as any).anxiety_level === 'number' ? (p as any).anxiety_level : 5), 0) / list.length) : 0;
      return { date: d, averageMood: avgMood, averageEnergy: avgEnergy, averageAnxiety: avgAnx, count: list.length };
    });

    // Compute stats
    const totalEntries = lite.length;
    const averageMood = Math.round((lite.reduce((s, e) => s + e.mood_score, 0) / (lite.length || 1)) * 10) / 10;
    const averageEnergy = Math.round((lite.reduce((s, e) => s + e.energy_level, 0) / (lite.length || 1)) * 10) / 10;
    const averageAnxiety = Math.round((lite.reduce((s, e) => s + e.anxiety_level, 0) / (lite.length || 1)) * 10) / 10;

    const moodVariance = (() => {
      if (lite.length <= 1) return 0;
      const mean = lite.reduce((s, e) => s + e.mood_score, 0) / lite.length;
      const variance = lite.reduce((s, e) => s + Math.pow(e.mood_score - mean, 2), 0) / (lite.length - 1);
      return Math.round(variance * 100) / 100;
    })();

    const dominantEmotions: EmotionDistribution[] = (() => {
      const buckets = {
        'Heyecanlı': lite.filter(e => e.mood_score >= 90).length,
        'Enerjik': lite.filter(e => e.mood_score >= 80 && e.mood_score < 90).length,
        'Mutlu': lite.filter(e => e.mood_score >= 70 && e.mood_score < 80).length,
        'Sakin': lite.filter(e => e.mood_score >= 60 && e.mood_score < 70).length,
        'Normal': lite.filter(e => e.mood_score >= 50 && e.mood_score < 60).length,
        'Endişeli': lite.filter(e => e.mood_score >= 40 && e.mood_score < 50).length,
        'Sinirli': lite.filter(e => e.mood_score >= 30 && e.mood_score < 40).length,
        'Üzgün': lite.filter(e => e.mood_score >= 20 && e.mood_score < 30).length,
        'Kızgın': lite.filter(e => e.mood_score < 20).length,
      } as Record<string, number>;
      const total = lite.length || 1;
      return Object.entries(buckets)
        .filter(([_, c]) => c > 0)
        .map(([emotion, c]) => ({ emotion, percentage: Math.round((c / total) * 100) }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3);
    })();

    const peakTimes: { hour: number; count: number }[] = (() => {
      const hours = new Array(24).fill(0);
      for (const e of lite) {
        const h = new Date(e.timestamp).getHours();
        hours[h]++;
      }
      return hours.map((c, h) => ({ hour: h, count: c })).filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
    })();

    const triggers: TriggerFrequency[] = (() => {
      const map = new Map<string, number>();
      lite.forEach(e => (e.triggers || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
      return Array.from(map.entries()).map(([trigger, count]) => ({ trigger, count })).sort((a, b) => b.count - a.count);
    })();

    const rawDataPoints: MoodJourneyExtended['rawDataPoints'] = {};
    for (const [date, points] of byDate.entries()) {
      const ms = points.map(p => p.mood_score);
      const min = Math.min(...ms);
      const max = Math.max(...ms);
      const mean = ms.reduce((s, n) => s + n, 0) / (ms.length || 1);
      const variance = ms.length > 1 ? ms.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / (ms.length - 1) : 0;
      rawDataPoints[date] = { entries: points, min, max, variance };
    }

    // Weekly aggregates for compatibility
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      weekKeys.push(formatDateYMD(d));
    }
    const weeklyEntries: MoodEntryLite[] = weekKeys.map((k) => {
      const list = byDate.get(k) || [];
      const avg = list.length ? Math.round(list.reduce((s, p) => s + p.mood_score, 0) / list.length) : 0;
      const energy = list.length ? Math.round(list.reduce((s, p) => s + (p.energy_level || 6), 0) / list.length) : 0;
      const anxiety = list.length ? 5 : 0; // Not tracked per point in this layer
      return {
        id: `day-${k}`,
        user_id: userId,
        mood_score: avg,
        energy_level: energy,
        anxiety_level: anxiety,
        notes: '',
        triggers: [],
        timestamp: new Date(`${k}T00:00:00.000Z`).toISOString(),
      };
    });

    const todayList = byDate.get(formatDateYMD(today)) || [];
    const todayAverage = todayList.length ? todayList.reduce((s, p) => s + p.mood_score, 0) / todayList.length : 0;
    const nonZero = weeklyEntries.filter(e => (e.mood_score || 0) > 0);
    let weeklyTrend: 'up' | 'down' | 'stable' = 'stable';
    if (nonZero.length >= 2) {
      const first = nonZero[0].mood_score || 0;
      const last = nonZero[nonZero.length - 1].mood_score || 0;
      weeklyTrend = first > last ? 'up' : first < last ? 'down' : 'stable';
    }

    const weeklyEnergyAvg = lite.length ? lite.reduce((s, e) => s + (e.energy_level || 6), 0) / lite.length : 0;
    const weeklyAnxietyAvg = lite.length ? lite.reduce((s, e) => s + (e.anxiety_level || 5), 0) / lite.length : 0;

    const extended: MoodJourneyExtended = {
      weeklyEntries,
      todayAverage,
      weeklyTrend,
      weeklyEnergyAvg,
      weeklyAnxietyAvg,
      statistics: {
        timeRange: range,
        totalEntries,
        averageMood,
        averageEnergy,
        averageAnxiety,
        moodVariance,
        dominantEmotions,
        peakTimes,
        triggers,
      },
      rawDataPoints,
      dailyAverages,
      // Optionally attach full arrays for larger ranges
      monthlyEntries: range === 'month' ? weeklyEntries : undefined,
      sixMonthEntries: range === '6months' ? weeklyEntries : undefined,
      yearlyEntries: range === 'year' ? weeklyEntries : undefined,
    };

    return extended;
  }
}

export const moodDataLoader = new OptimizedMoodDataLoader();
