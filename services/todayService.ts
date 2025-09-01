import AsyncStorage from '@react-native-async-storage/async-storage';
import moodTracker, { type MoodEntry } from '@/services/moodTrackingService';
import { StorageKeys } from '@/utils/storage';
import { isSameDayInUserTimezone, toUserLocalDate } from '@/utils/timezoneUtils';

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
      const todayAverage = todayMood.length > 0
        ? todayMood.reduce((sum: number, entry: any) => sum + entry.mood_score, 0) / todayMood.length
        : 0;

      const weeklyEntriesWithData = moodEntries.filter((entry: any) => entry.energy_level != null && entry.anxiety_level != null);
      const weeklyEnergyAvg = weeklyEntriesWithData.length > 0
        ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.energy_level, 0) / weeklyEntriesWithData.length
        : 0;
      const weeklyAnxietyAvg = weeklyEntriesWithData.length > 0
        ? weeklyEntriesWithData.reduce((sum: number, entry: any) => sum + entry.anxiety_level, 0) / weeklyEntriesWithData.length
        : 0;

      const weeklyTrend: 'up' | 'down' | 'stable' = moodEntries.length >= 2
        ? (moodEntries[0]?.mood_score > moodEntries[moodEntries.length - 1]?.mood_score ? 'up' : 'down')
        : 'stable';

      moodJourneyData = {
        weeklyEntries: moodEntries.slice(0, 7),
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

