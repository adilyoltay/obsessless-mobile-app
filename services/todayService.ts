import AsyncStorage from '@react-native-async-storage/async-storage';
import moodTracker, { type MoodEntry } from '@/services/moodTrackingService';
import { StorageKeys } from '@/utils/storage';
import { isSameDayInUserTimezone, toUserLocalDate, getUserDateString } from '@/utils/timezoneUtils';

export type TodayStats = {
  healingPoints: number; // caller provides from store; kept for compatibility
  moodCheckins: number;
  breathworkSessions: number;
  weeklyProgress: { mood: number; breathwork: number };
  breathworkAnxietyDelta: number;
};

export type MoodJourneyData = {
  weeklyEntries: MoodEntry[];
  todayAverage: number;
  weeklyTrend: 'up' | 'down' | 'stable';
  weeklyEnergyAvg: number;
  weeklyAnxietyAvg: number;
};

export type TodayData = {
  todayStats: TodayStats;
  moodJourneyData: MoodJourneyData | null;
  // returned for caching/other consumers
  moodEntries: MoodEntry[];
  allBreathworkSessions: any[];
};

export const todayService = {
  async getTodayData(userId: string, healingPointsTotal: number, healingPointsToday: number): Promise<TodayData> {
    // Dates in user timezone
    const todayUserDate = toUserLocalDate(new Date());
    const weekAgoUserDate = new Date(todayUserDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1) Mood entries (last 7 days)
    const moodEntries = await moodTracker.getMoodEntries(userId, 7);
    const todayMood = moodEntries.filter((m) => isSameDayInUserTimezone(m.timestamp, new Date()));

    // 2) Breathwork sessions
    const breathworkKey = StorageKeys.BREATH_SESSIONS(userId);
    const breathworkData = await AsyncStorage.getItem(breathworkKey);
    const allBreathworkSessions = breathworkData ? JSON.parse(breathworkData) : [];
    const todayBreathwork = allBreathworkSessions.filter((s: any) => isSameDayInUserTimezone(s.timestamp, new Date()));
    const weeklyBreathwork = allBreathworkSessions.filter((s: any) => {
      const sessionUserDate = toUserLocalDate(s.timestamp);
      return sessionUserDate >= weekAgoUserDate;
    });

    // Breathwork anxiety reduction avg
    let breathworkAnxietyDelta = 0;
    const validWeekly = weeklyBreathwork.filter((s: any) => s.anxiety_before != null && s.anxiety_after != null);
    if (validWeekly.length > 0) {
      const totalReduction = validWeekly.reduce((sum: number, s: any) => sum + (s.anxiety_before - s.anxiety_after), 0);
      breathworkAnxietyDelta = Math.round((totalReduction / validWeekly.length) * 10) / 10;
    }

    const todayStats: TodayStats = {
      healingPoints: healingPointsToday,
      moodCheckins: todayMood.length,
      breathworkSessions: todayBreathwork.length,
      weeklyProgress: {
        mood: moodEntries.length,
        breathwork: weeklyBreathwork.length,
      },
      breathworkAnxietyDelta,
    };

    // 3) Mood Journey aggregates
    let moodJourneyData: MoodJourneyData | null = null;
    if (moodEntries.length > 0) {
      // ✅ NORMALIZE TO EXACT 7 DAYS (TODAY .. TODAY-6) IN USER TIMEZONE
      const dayKeys: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayKeys.push(getUserDateString(d)); // [today, yesterday, ...]
      }

      // Group entries by user day string for quick lookup
      const grouped = new Map<string, MoodEntry[]>();
      for (const entry of moodEntries) {
        const key = getUserDateString(entry.timestamp);
        const list = grouped.get(key) || [];
        list.push(entry);
        grouped.set(key, list);
      }

      // Build normalized 7-day array (descending: today first)
      const normalizedDaily: MoodEntry[] = dayKeys.map((key) => {
        const list = grouped.get(key) || [];
        const moodAvg = list.length > 0
          ? Math.round((list.reduce((s, e) => s + (e.mood_score || 0), 0) / list.length))
          : 0;
        // Synthetic entry for the day
        return {
          id: `day-${key}`,
          user_id: userId,
          mood_score: moodAvg,
          energy_level: list.length > 0 ? Math.round(list.reduce((s, e) => s + (e.energy_level || 0), 0) / list.length) : 0,
          anxiety_level: list.length > 0 ? Math.round(list.reduce((s, e) => s + (e.anxiety_level || 0), 0) / list.length) : 0,
          notes: '',
          triggers: [],
          activities: [],
          timestamp: new Date(`${key}T00:00:00.000Z`).toISOString(),
          synced: true,
        } as MoodEntry;
      });

      const todayAverage = todayMood.length > 0
        ? todayMood.reduce((sum: number, entry: any) => sum + entry.mood_score, 0) / todayMood.length
        : 0;

      // Keep energy/anxiety averages from actual entries (not normalized)
      const weeklyEntriesWithData = moodEntries.filter((entry: any) => entry.energy_level != null && entry.anxiety_level != null);
      const weeklyEnergyAvg = weeklyEntriesWithData.length > 0
        ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.energy_level, 0) / weeklyEntriesWithData.length
        : 0;
      const weeklyAnxietyAvg = weeklyEntriesWithData.length > 0
        ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.anxiety_level, 0) / weeklyEntriesWithData.length
        : 0;

      // Trend based on first non-zero vs last non-zero in normalized range
      const nonZero = normalizedDaily.filter(e => (e.mood_score || 0) > 0);
      const weeklyTrend: 'up' | 'down' | 'stable' = nonZero.length >= 2
        ? (nonZero[0].mood_score > nonZero[nonZero.length - 1].mood_score ? 'up' : 'down')
        : 'stable';

      moodJourneyData = {
        weeklyEntries: normalizedDaily, // length 7, today-first (card reverses internally)
        todayAverage,
        weeklyTrend,
        weeklyEnergyAvg,
        weeklyAnxietyAvg,
      };
    }

    return {
      todayStats,
      moodJourneyData,
      moodEntries,
      allBreathworkSessions,
    };
  }
};

export default todayService;
