import { InteractionManager } from 'react-native';
import moodTracker from '@/services/moodTrackingService';
import { formatDateYMD } from '@/utils/chartUtils';
import { getUserDateString, toUserLocalDate } from '@/utils/timezoneUtils';
import type { MoodJourneyExtended, TimeRange, MoodEntryLite, DailyAverage, EmotionDistribution, TriggerFrequency, RawDataPoint, AggregatedData } from '@/types/mood';
import { quantiles, deriveAnxietySeries } from '@/utils/statistics';
import { getTrendFromP50 } from '@/utils/trend';
import { getWeekStart, formatWeekKey, getWeekLabel, getMonthKey, getMonthLabel, calculateVariance, average } from '@/utils/dateAggregation';

type CacheEntry = { data: MoodJourneyExtended; timestamp: number };

export class OptimizedMoodDataLoader {
  private cache = new Map<string, CacheEntry>();

  /**
   * Invalidate cached datasets.
   * - If no args are provided, clears the entire cache.
   * - If `userId` is provided, clears all keys for that user.
   * - If `range` is also provided, clears only that user's keys for the range (including paged variants).
   */
  invalidate(userId?: string, range?: TimeRange): void {
    if (!userId) {
      this.cache.clear();
      return;
    }
    const prefix = range ? `${userId}-${range}` : `${userId}-`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  async loadTimeRange(userId: string, range: TimeRange): Promise<MoodJourneyExtended> {
    // NUCLEAR OPTION: Clear all cache for 6months/year to prevent granularity mixing
    if (range === '6months' || range === 'year') {
      this.cache.clear();
    }
    
    const cacheKey = `${userId}-${range}`;
    const cached = this.cache.get(cacheKey);
    
    // CRITICAL FIX: Shorter cache TTL for aggregate views to prevent granularity conflicts  
    const cacheTTL = (range === 'month' || range === '6months' || range === 'year') ? 1 * 60 * 1000 : 5 * 60 * 1000;
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      // Extra granularity validation for aggregate modes
      if (range === 'week' && cached.data.aggregated?.granularity !== 'day') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else if (range === 'month' && cached.data.aggregated?.granularity !== 'week') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else if ((range === '6months' || range === 'year') && cached.data.aggregated?.granularity !== 'month') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else {
        return cached.data;
      }
    }

    // Filters should reflect selected range immediately; load full range now
    const data = await this.loadFullRange(userId, range);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Load a specific page anchored to a custom end date (inclusive), instead of "today".
   * Useful for pagination when scrubbing beyond the visible window.
   */
  async loadTimeRangeAt(userId: string, range: TimeRange, endDate: Date): Promise<MoodJourneyExtended> {
    // NUCLEAR OPTION: Clear all cache for 6months/year to prevent granularity mixing
    if (range === '6months' || range === 'year') {
      this.cache.clear();
    }
    
    // Normalize endDate to user local date at 00:00
    const end = toUserLocalDate(endDate);
    end.setHours(0, 0, 0, 0);
    const endKey = formatDateYMD(end);
    const cacheKey = `${userId}-${range}-${endKey}`;
    const cached = this.cache.get(cacheKey);
    
    // CRITICAL FIX: Shorter cache TTL for aggregate views to prevent granularity conflicts
    const cacheTTL = (range === 'month' || range === '6months' || range === 'year') ? 1 * 60 * 1000 : 5 * 60 * 1000;
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      // Extra granularity validation for aggregate modes
      if (range === 'week' && cached.data.aggregated?.granularity !== 'day') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else if (range === 'month' && cached.data.aggregated?.granularity !== 'week') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else if ((range === '6months' || range === 'year') && cached.data.aggregated?.granularity !== 'month') {
        this.cache.delete(cacheKey); // Invalid granularity, refetch
      } else {
        return cached.data;
      }
    }
    
    const data = await this.loadFullRange(userId, range, end);
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
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case '6months': return 183;
      case 'year': return 365;
      default: return 7;
    }
  }

  private async loadFullRange(userId: string, range: TimeRange, endDateOverride?: Date): Promise<MoodJourneyExtended> {
    try {
      const days = this.daysForRange(range);
      // Anchor the window to the provided end date (or today) in user's local timezone
      let today: Date;
      try {
        today = endDateOverride ? toUserLocalDate(endDateOverride) : toUserLocalDate(new Date());
        if (!isFinite(today.getTime())) {
          console.warn('MoodDataLoader: Invalid date from toUserLocalDate, using fallback');
          today = new Date();
        }
      } catch (dateError) {
        console.warn('MoodDataLoader: Error in toUserLocalDate, using fallback:', dateError);
        today = new Date();
      }
      
      today.setHours(0, 0, 0, 0);
      
      // Validate today again after setHours
      if (!isFinite(today.getTime())) {
        console.error('MoodDataLoader: Invalid date after setHours, using current time');
        today = new Date();
        today.setHours(0, 0, 0, 0);
      }
      
      const dayMs = 24 * 60 * 60 * 1000;
      const startWindow = new Date(today.getTime() - (days - 1) * dayMs);
      
      // Validate startWindow
      if (!isFinite(startWindow.getTime())) {
        console.error('MoodDataLoader: Invalid startWindow calculated');
        throw new Error('Invalid date calculation in loadFullRange');
      }

    // Ensure we fetch enough history to cover older pages (when endDateOverride < now)
    const nowLocal = toUserLocalDate(new Date());
    const lagDays = Math.max(0, Math.ceil((nowLocal.getTime() - today.getTime()) / dayMs));
    const fetchDays = days + lagDays;

    // Fetch combined (local+remote) entries for a sufficiently large window
    const entries = await moodTracker.getMoodEntries(userId, fetchDays);

    // Map to lite and filter strictly to the requested window [startWindow, today]
    const lite: MoodEntryLite[] = (entries || []).map((e) => ({
      id: e.id,
      user_id: e.user_id,
      mood_score: e.mood_score != null ? e.mood_score : 50, // FIXED: 50 center instead of 0
      energy_level: e.energy_level || 6,
      anxiety_level: e.anxiety_level != null ? e.anxiety_level : 5,
      notes: e.notes || '',
      triggers: e.triggers || [],
      timestamp: e.timestamp,
    })).filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= startWindow.getTime() && t < (today.getTime() + dayMs);
    });

    // Group by date (user timezone)
    const byDate = new Map<string, RawDataPoint[]>();
    for (const e of lite) {
      const d = getUserDateString(e.timestamp);
      const arr = byDate.get(d) || [];
      // Preserve anxiety_level so weekly overlays and averages reflect real values
      arr.push({ id: e.id, timestamp: e.timestamp, mood_score: e.mood_score, energy_level: e.energy_level, anxiety_level: (e as any).anxiety_level });
      byDate.set(d, arr);
    }

    // Daily averages - NORMALIZE to include all days in selected range
    const start = startWindow;
    const dayKeys: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      dayKeys.push(formatDateYMD(d));
    }
    let dailyAverages: DailyAverage[] = dayKeys.map((d) => {
      const list = byDate.get(d) || [];
      if (list.length === 0) {
        // Eksik günleri null taşı: sayısal alanları null, count=0
        return { date: d, averageMood: null as any, averageEnergy: null as any, averageAnxiety: null as any, count: 0 } as unknown as DailyAverage;
      }
      // CRITICAL FIX: Only use non-neutral values for daily averages
      const realMoods = list.filter(p => p.mood_score > 0 && p.mood_score !== 50);
      const realEnergies = list.filter(p => p.energy_level > 0 && p.energy_level !== 6);
      
      const avgMood = realMoods.length > 0 
        ? Math.round(realMoods.reduce((s, p) => s + p.mood_score, 0) / realMoods.length) // Only real mood data
        : null; // No real mood data for this day
        
      const avgEnergy = realEnergies.length > 0
        ? Math.round(realEnergies.reduce((s, p) => s + p.energy_level, 0) / realEnergies.length) // Only real energy data
        : null; // No real energy data for this day
      
      // IMPROVED: Smart daily anxiety calculation
      const dailyAnxValues = list.map(p => (p as any).anxiety_level).filter(v => v != null);
      const avgAnx = (() => {
        if (dailyAnxValues.length === 0) return null;
        
        // Check if all values are default 5s
        if (dailyAnxValues.every(v => v === 5)) {
          // Only derive if we have meaningful (non-neutral) mood/energy data
          if (avgMood != null && avgEnergy != null) {
            // Derive from this day's mood/energy
            const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10)));
            const e10 = Math.max(1, Math.min(10, avgEnergy));
            
            if (m10 <= 3) return 7;
            else if (m10 >= 8 && e10 <= 4) return 6;
            else if (m10 <= 5 && e10 >= 7) return 8;
            else if (m10 >= 7 && e10 >= 7) return 4;
            else return Math.max(2, Math.min(8, 6 - (m10 - 5)));
          }
          return null; // No meaningful data for derivation
        }
        
        // Use real anxiety values
        return Math.round(dailyAnxValues.reduce((s, v) => s + v, 0) / dailyAnxValues.length);
      })();
      return { date: d, averageMood: avgMood, averageEnergy: avgEnergy, averageAnxiety: avgAnx, count: list.length };
    });

    // Hourly breakdown for 'day' range
    let hourlyAverages: any[] | undefined;
    let rawHourlyDataPoints: any | undefined;
    if (range === 'day') {
      const dayKey = formatDateYMD(today);
      const entriesToday = lite.filter(e => formatDateYMD(new Date(e.timestamp)) === dayKey);
      const groupByHour = new Map<number, MoodEntryLite[]>();
      for (let h = 0; h < 24; h++) groupByHour.set(h, []);
      for (const e of entriesToday) {
        const h = new Date(e.timestamp).getHours();
        const arr = groupByHour.get(h)!;
        arr.push(e);
      }
      hourlyAverages = [];
      rawHourlyDataPoints = {};
      for (let h = 0; h < 24; h++) {
        const list = groupByHour.get(h)!;
        const count = list.length;
        
        // CRITICAL FIX: Only use non-neutral values for hourly averages
        const realMoodsHour = list.filter(p => p.mood_score > 0 && p.mood_score !== 50);
        const realEnergiesHour = list.filter(p => p.energy_level > 0 && p.energy_level !== 6);
        
        const avgMood = realMoodsHour.length > 0 
          ? Math.round(realMoodsHour.reduce((s, p) => s + p.mood_score, 0) / realMoodsHour.length)
          : null; // No real mood data for this hour
          
        const avgEnergy = realEnergiesHour.length > 0
          ? Math.round(realEnergiesHour.reduce((s, p) => s + p.energy_level, 0) / realEnergiesHour.length)
          : null; // No real energy data for this hour
        
        // IMPROVED: Smart hourly anxiety calculation
        const avgAnx = count ? (() => {
          const hourAnxValues = list.map(p => (p as any).anxiety_level).filter(v => v != null);
          if (hourAnxValues.length === 0) return null;
          
          // Check if all hourly values are default 5s
          if (hourAnxValues.every(v => v === 5)) {
            // Only derive if we have meaningful hourly mood/energy data
            if (avgMood != null && avgEnergy != null) {
              // Derive from this hour's mood/energy
              const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10)));
              const e10 = Math.max(1, Math.min(10, avgEnergy));
              
              if (m10 <= 3) return 7;
              else if (m10 >= 8 && e10 <= 4) return 6;
              else if (m10 <= 5 && e10 >= 7) return 8;
              else if (m10 >= 7 && e10 >= 7) return 4;
              else return Math.max(2, Math.min(8, 6 - (m10 - 5)));
            }
            return null; // No meaningful data for derivation
          }
          
          // Use real anxiety values
          return Math.round(hourAnxValues.reduce((s, v) => s + v, 0) / hourAnxValues.length);
        })() : null; // FIXED: null instead of 0 when no data
        const dateKey = `${dayKey}#${String(h).padStart(2,'0')}`;
        hourlyAverages.push({ hour: h, dateKey, averageMood: avgMood, averageEnergy: avgEnergy, averageAnxiety: avgAnx, count });
        const ms = list.map(p => p.mood_score);
        const min = count ? Math.min(...ms) : 0;
        const max = count ? Math.max(...ms) : 0;
        const mean = count ? ms.reduce((s, n) => s + n, 0) / count : 0;
        const variance = count > 1 ? ms.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / (count - 1) : 0;
        rawHourlyDataPoints[dateKey] = { entries: list, min, max, variance };
      }
      // For charting convenience, use hourly as the working 'dailyAverages' list in day mode
      dailyAverages = hourlyAverages.map((h) => ({
        date: h.dateKey,
        averageMood: h.averageMood,
        averageEnergy: h.averageEnergy,
        averageAnxiety: h.averageAnxiety,
        count: h.count,
      }));
    }

    // Compute stats
    const totalEntries = lite.length;
    // IMPROVED: Proper mood average calculation (0-100 scale)
    // CRITICAL FIX: Exclude neutral/fallback values from calculations
    const validMoods = lite.filter(e => e.mood_score > 0 && e.mood_score !== 50).map(e => e.mood_score); // Exclude neutral center
    const averageMood = validMoods.length > 0 
      ? Math.round((validMoods.reduce((s, v) => s + v, 0) / validMoods.length) * 10) / 10
      : null; // No fallback for averages - use null when no real data
    // CRITICAL FIX: Exclude neutral/fallback values from calculations  
    const validEnergies = lite.filter(e => e.energy_level > 0 && e.energy_level !== 6).map(e => e.energy_level); // Exclude neutral center
    const averageEnergy = validEnergies.length > 0 
      ? Math.round((validEnergies.reduce((s, v) => s + v, 0) / validEnergies.length) * 10) / 10
      : null; // No fallback for averages - use null when no real data
    // CRITICAL FIX: Calculate improved anxiety average first (moved up from below)
    const anxietyValues = lite.map(e => e.anxiety_level).filter(v => v != null);
    const averageAnxiety = (() => {
      if (anxietyValues.length === 0) return null; // No data
      
      // Check if majority are default 5s (likely fallback values)
      const fivesCount = anxietyValues.filter(v => v === 5).length;
      const nonFivesCount = anxietyValues.length - fivesCount;
      
      if (fivesCount > 0 && nonFivesCount === 0) {
        // All are 5s - try to derive from mood/energy pattern, but don't include in averages
        return null; // No real anxiety data available
      } else if (nonFivesCount >= fivesCount * 2) {
        // More real values than fallbacks - use only non-5s
        const realValues = anxietyValues.filter(v => v !== 5);
        return realValues.reduce((s, v) => s + v, 0) / realValues.length;
      } else {
        // Mixed data - use all values
        return anxietyValues.reduce((s, v) => s + v, 0) / anxietyValues.length;
      }
    })();

    // IMPROVED: Mood variance with valid moods only
    const moodVariance = (() => {
      if (validMoods.length <= 1) return 0;
      const mean = validMoods.reduce((s, v) => s + v, 0) / validMoods.length;
      const variance = validMoods.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (validMoods.length - 1);
      return Math.round(variance * 100) / 100;
    })();

    const dominantEmotions: EmotionDistribution[] = (() => {
      // CRITICAL FIX: Use only valid (non-neutral) moods for emotion distribution
      const realMoodEntries = lite.filter(e => e.mood_score > 0 && e.mood_score !== 50);
      const buckets = {
        'Heyecanlı': realMoodEntries.filter(e => e.mood_score >= 90).length,
        'Enerjik': realMoodEntries.filter(e => e.mood_score >= 80 && e.mood_score < 90).length,
        'Mutlu': realMoodEntries.filter(e => e.mood_score >= 70 && e.mood_score < 80).length,
        'Sakin': realMoodEntries.filter(e => e.mood_score >= 60 && e.mood_score < 70).length,
        'Normal': realMoodEntries.filter(e => e.mood_score >= 50 && e.mood_score < 60).length,
        'Endişeli': realMoodEntries.filter(e => e.mood_score >= 40 && e.mood_score < 50).length,
        'Sinirli': realMoodEntries.filter(e => e.mood_score >= 30 && e.mood_score < 40).length,
        'Üzgün': realMoodEntries.filter(e => e.mood_score >= 20 && e.mood_score < 30).length,
        'Kızgın': realMoodEntries.filter(e => e.mood_score < 20).length,
      } as Record<string, number>;
      const total = realMoodEntries.length || 1;
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
      const d = new Date(today.getTime() - i * dayMs);
      weekKeys.push(formatDateYMD(d));
    }
    const weeklyEntries: MoodEntryLite[] = weekKeys.map((k) => {
      const list = byDate.get(k) || [];
      const avg = list.length ? Math.round(list.reduce((s, p) => s + p.mood_score, 0) / list.length) : 0;
      // Exclude neutral energy=6 values from weekly average
      const realEnergyValues = list.filter(p => p.energy_level > 0 && p.energy_level !== 6);
      const energy = realEnergyValues.length ? Math.round(realEnergyValues.reduce((s, p) => s + (p.energy_level as number), 0) / realEnergyValues.length) : 0;
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
    const todayAverage = todayList.length ? todayList.reduce((s, p) => s + p.mood_score, 0) / todayList.length : 50; // FIXED: 50 center instead of 0
    // Unified: Weekly trend from daily p50 series
    const p50Series: number[] = dayKeys.map((d) => {
      const list = byDate.get(d) || [];
      const moods = list.map((p) => p.mood_score).filter((v) => Number.isFinite(v));
      const q = quantiles(moods as any);
      return Number.isFinite(q.p50 as any) ? Number(q.p50) : NaN;
    });
    const weeklyTrend = getTrendFromP50(p50Series, 10);

    const weeklyEnergyAvg = averageEnergy; // Use the same logic as averageEnergy  
    const weeklyAnxietyAvg = averageAnxiety; // Use the same logic as averageAnxiety

    // Quantiles imported from utils/statistics

    const toAggregatedBucket = (points: MoodEntryLite[], label: string, dateISO: string): AggregatedData => {
      // CRITICAL FIX: Only use non-neutral values for aggregation statistics
      const moods = points.filter(p => p.mood_score > 0 && p.mood_score !== 50).map(p => p.mood_score);
      const energies = points.filter(p => p.energy_level > 0 && p.energy_level !== 6).map(p => p.energy_level);
      
      // IMPROVED: Smart anxiety handling for aggregated buckets
      const rawAnx = points.map((p: any) => p.anxiety_level).filter(v => v != null) as number[];
      const anx = deriveAnxietySeries(moods, energies, rawAnx);
      
      const mq = quantiles(moods); // Will return NaN if no real mood data
      const eq = quantiles(energies); // Will return NaN if no real energy data
      const aq = quantiles(anx);
      // IMPROVED: Only calculate min/max when real data exists
      const min = moods.length ? Math.min(...moods) : NaN;
      const max = moods.length ? Math.max(...moods) : NaN;
      return {
        date: dateISO,
        label,
        count: points.length,
        countReal: moods.length,
        mood: { ...mq, min, max },
        energy: eq,
        anxiety: aq,
        entries: points,
        // Back-compat fields (optional) - use all original points for count, but real data for averages
        avg: moods.length ? (moods.reduce((s, v) => s + v, 0) / moods.length) : NaN,
        p50: mq.p50,
        min,
        max,
      };
    };

    // Build aggregate (haftalık/aylık) IQR-first
    const aggregated = (() => {
      if (range === 'week') {
        // Yeni: Haftalık görünüm için gün bazında aggregate (granularity=day)
        // dayKeys: seçilen haftadaki 7 günü içerir
        const items: AggregatedData[] = dayKeys
          .map((dayKey) => {
            const entriesForDay = lite.filter((e) => getUserDateString(e.timestamp) === dayKey);
            // Etiket olarak yalın tarih kullanıyoruz; tooltip içinde özel formatlanacak
            return toAggregatedBucket(entriesForDay as any, dayKey, dayKey);
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        return { granularity: 'day' as const, data: items };
      }
      if (range === 'month') {
        // Haftalık aggregate: son 30 gün içindeki tüm haftaları (Pazartesi başlangıç)
        const weekMap = new Map<string, MoodEntryLite[]>();
        for (const e of lite) {
          const wk = formatWeekKey(e.timestamp);
          if (!weekMap.has(wk)) weekMap.set(wk, []);
          weekMap.get(wk)!.push(e);
        }
        // Month view için minimum 4 haftalık bucket garantisi
        const allWeekKeys: string[] = [];
        
        // İlk önce dayKeys'ten haftaları topla
        const weekSet = new Set<string>();
        for (const dk of dayKeys) {
          const wk = formatWeekKey(dk);
          weekSet.add(wk);
        }
        
        // Set'i array'e çevir ve sırala
        const weekArray = Array.from(weekSet).sort();
        
        // Eğer 4 haftadan azsa, başa veya sona boş haftalar ekle
        if (weekArray.length > 0 && weekArray.length < 4) {
          const firstWeekDate = new Date(weekArray[0] + 'T00:00:00');
          const firstMonday = getWeekStart(firstWeekDate);
          
          // Önceki haftaları ekle (4 haftaya tamamla)
          const weeksToAdd = 4 - weekArray.length;
          for (let w = 1; w <= weeksToAdd; w++) {
            const prevWeek = new Date(firstMonday);
            prevWeek.setDate(firstMonday.getDate() - (w * 7));
            weekArray.unshift(formatDateYMD(prevWeek));
          }
        }
        
        // Final list
        allWeekKeys.push(...weekArray.sort());
        const items: AggregatedData[] = allWeekKeys
          .map((weekKey) => {
            const entriesForWeek = weekMap.get(weekKey) || [];
            return toAggregatedBucket(entriesForWeek as any, getWeekLabel(weekKey), weekKey);
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        return { granularity: 'week' as const, data: items };
      }
      else if (range === '6months' || range === 'year') {
        // CRITICAL FIX: Force month granularity only for 6months/year
        // Aylık aggregate: son 6/12 ayı eksiksiz üret
        const monthMap = new Map<string, MoodEntryLite[]>();
        for (const e of lite) {
          const mk = getMonthKey(e.timestamp);
          if (!monthMap.has(mk)) monthMap.set(mk, []);
          monthMap.get(mk)!.push(e);
        }
        const monthsBack = range === '6months' ? 5 : 11;
        const allMonthKeys: string[] = [];
        for (let i = monthsBack; i >= 0; i--) {
          const d = new Date(today);
          d.setMonth(d.getMonth() - i, 1);
          d.setHours(0, 0, 0, 0);
          const mk = getMonthKey(d);
          if (!allMonthKeys.includes(mk)) allMonthKeys.push(mk);
        }
        const items: AggregatedData[] = allMonthKeys
          .map((monthKey) => {
            const entriesForMonth = monthMap.get(monthKey) || [];
            return toAggregatedBucket(entriesForMonth as any, getMonthLabel(monthKey), `${monthKey}-01`);
          })
          .sort((a, b) => a.date.localeCompare(b.date));
        
        return { granularity: 'month' as const, data: items };
      }
      // week: no aggregate needed beyond daily; keep undefined
      return undefined;
    })();

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
      rawHourlyDataPoints,
      dailyAverages,
      hourlyAverages: hourlyAverages,
      aggregated,
      // Optionally attach full arrays for larger ranges
      monthlyEntries: range === 'month' ? weeklyEntries : undefined,
      sixMonthEntries: range === '6months' ? weeklyEntries : undefined,
      yearlyEntries: range === 'year' ? weeklyEntries : undefined,
    };

    return extended;
    } catch (error) {
      console.error('MoodDataLoader: loadFullRange error:', error);
      // Return safe fallback data instead of crashing
      return {
        weeklyEntries: [],
        todayAverage: 50,
        weeklyTrend: 'stable' as const,
        weeklyEnergyAvg: 6,
        weeklyAnxietyAvg: 5,
        statistics: {
          timeRange: range,
          totalEntries: 0,
          averageMood: 50,
          averageEnergy: 6,
          averageAnxiety: 5,
          moodVariance: 0,
          dominantEmotions: [],
          peakTimes: [],
          triggers: [],
        },
        rawDataPoints: {},
        rawHourlyDataPoints: {},
        dailyAverages: [],
        hourlyAverages: [],
        aggregated: { granularity: 'week', data: [] },
      };
    }
  }
}

export const moodDataLoader = new OptimizedMoodDataLoader();
