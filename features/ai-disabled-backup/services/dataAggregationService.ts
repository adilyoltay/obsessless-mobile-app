// supabaseService not needed after compulsion removal
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserDataAggregate {
  profile: any;
  symptoms: any;
  performance: any;
  patterns: any;
}

class AIDataAggregationService {
  private static instance: AIDataAggregationService;
  static getInstance(): AIDataAggregationService {
    if (!AIDataAggregationService.instance) {
      AIDataAggregationService.instance = new AIDataAggregationService();
    }
    return AIDataAggregationService.instance;
  }

  async aggregateUserData(userId: string): Promise<UserDataAggregate> {
    // Pull core sources
    const [moodEntries] = await Promise.all([
      this.readRecentMoodEntries(userId, 14)
    ]);

    const performance = this.calculatePerformanceMetrics(moodEntries);
    const patterns = this.extractPatterns([], moodEntries);

    return {
      profile: {},
      symptoms: {},
      performance,
      patterns,
    };
  }

  async prepareForAI(aggregate: UserDataAggregate): Promise<any> {
    return {
      behavioral_data: {
        // ✅ REMOVED: therapy_count, therapy_completion_rate - ERP module deleted
        compulsion_count: aggregate.performance?.compulsionCount ?? 0,
        mood_entry_count: aggregate.performance?.moodCount ?? 0,
        consistency_rate: aggregate.performance?.overallCompletionRate ?? 100,
      },
    };
  }

  private async readRecentMoodEntries(userId: string, days: number): Promise<any[]> {
    const entries: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = `mood_entries_${userId}_${d.toISOString().split('T')[0]}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) entries.push(...JSON.parse(raw));
      } catch {}
    }
    return entries;
  }

  private extractPatterns(_compulsions: any[], moods: any[]): any {
    // Common triggers from moods
    const triggerCounts: Record<string, number> = {};
    for (const m of moods) {
      const list: string[] = Array.isArray(m?.triggers) ? m.triggers : [];
      list.forEach((t) => {
        const k = String(t || '').trim().toLowerCase();
        if (!k) return;
        triggerCounts[k] = (triggerCounts[k] || 0) + 1;
      });
    }
    const commonTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    // Peak anxiety times by hour buckets
    const hourSums: number[] = new Array(24).fill(0);
    const hourCounts: number[] = new Array(24).fill(0);
    for (const m of moods) {
      const ts = m?.timestamp ? new Date(m.timestamp) : null;
      const hour = ts && !isNaN(ts.getTime()) ? ts.getHours() : null;
      const anxiety = Number(m?.anxiety_level);
      if (hour !== null && !Number.isNaN(anxiety)) {
        hourSums[hour] += anxiety;
        hourCounts[hour] += 1;
      }
    }
    const hourAvg = hourSums.map((s, i) => (hourCounts[i] ? s / hourCounts[i] : 0));
    const topHours = hourAvg
      .map((avg, hour) => ({ hour, avg }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map((x) => `${x.hour}:00`);

    return {
      commonTriggers,
      peakAnxietyTimes: topHours,
    };
  }

  private calculatePerformanceMetrics(moods: any[]) {
    // ✅ REMOVED: erpSessions parameter and ERP calculations - ERP module deleted
    const compulsionCount = 0;
    const moodCount = Array.isArray(moods) ? moods.length : 0;
    let overallCompletionRate = 100;
    try {
      // Calculate completion based on data consistency
      const totalExpected = 30; // Days in month
      const actualEntries = compulsionCount + moodCount;
      overallCompletionRate = Math.min(100, Math.round((actualEntries / totalExpected) * 100));
    } catch {}
    return { compulsionCount, moodCount, overallCompletionRate };
  }
}

export const aiDataAggregator = AIDataAggregationService.getInstance();
export default aiDataAggregator;


