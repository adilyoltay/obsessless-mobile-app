import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  sync: {
    successRate: number;
    avgResponseMs: number;
    deadLetters: number;
    recommendedBatch: number;
    conflictRate?: number;
  };
  ai?: {
    avgLatencyMs?: number;
    requests?: number;
    failures?: number;
    cacheHits?: number;
    dataQuality?: number; // 0-1
  };
}

class PerformanceMetricsService {
  private static instance: PerformanceMetricsService;
  private readonly STORAGE_KEY = 'perf_metrics_daily';

  static getInstance(): PerformanceMetricsService {
    if (!PerformanceMetricsService.instance) {
      PerformanceMetricsService.instance = new PerformanceMetricsService();
    }
    return PerformanceMetricsService.instance;
  }

  private toDateKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  async recordToday(partial: { date?: string; sync?: Partial<DailyMetrics['sync']>; ai?: Partial<DailyMetrics['ai']> }): Promise<void> {
    const raw = await AsyncStorage.getItem(this.STORAGE_KEY);
    const list: DailyMetrics[] = raw ? JSON.parse(raw) : [];
    const todayKey = this.toDateKey(new Date());
    const idx = list.findIndex(m => m.date === todayKey);
    const existing: DailyMetrics = idx >= 0 ? list[idx] : { date: todayKey, sync: { successRate: 1, avgResponseMs: 0, deadLetters: 0, recommendedBatch: 1 } };
    const merged: DailyMetrics = {
      ...existing,
      ...partial,
      sync: { ...existing.sync, ...(partial.sync || {}) },
      ai: { ...(existing.ai || {}), ...(partial.ai || {}) },
      date: todayKey,
    };
    if (idx >= 0) list[idx] = merged; else list.push(merged);
    // keep last 30 days
    const trimmed = list.sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
  }

  async getLastNDays(n: number = 7): Promise<DailyMetrics[]> {
    const raw = await AsyncStorage.getItem(this.STORAGE_KEY);
    const list: DailyMetrics[] = raw ? JSON.parse(raw) : [];
    return list.sort((a,b) => a.date.localeCompare(b.date)).slice(-n);
  }
}

export const performanceMetricsService = PerformanceMetricsService.getInstance();
export default performanceMetricsService;


