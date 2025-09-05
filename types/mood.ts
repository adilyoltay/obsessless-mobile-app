export type TimeRange = 'day' | 'week' | 'month' | '6months' | 'year';

export interface EmotionDistribution {
  emotion: string;
  percentage: number;
}

export interface TriggerFrequency {
  trigger: string;
  count: number;
}

export interface MoodEntryLite {
  id: string;
  user_id: string;
  mood_score: number; // 0..100
  energy_level: number; // 1..10
  anxiety_level: number; // 1..10
  notes?: string;
  triggers?: string[];
  timestamp: string; // ISO
}

export interface DailyAverage {
  date: string; // YYYY-MM-DD
  averageMood: number; // 0..100
  averageEnergy: number; // 1..10
  averageAnxiety: number; // 1..10
  count: number;
}

export interface HourlyAverage {
  hour: number; // 0..23
  dateKey: string; // YYYY-MM-DD#HH
  averageMood: number; // 0..100
  averageEnergy: number; // 1..10
  averageAnxiety: number; // 1..10
  count: number;
}

export interface RawDataPoint {
  id: string;
  timestamp: string;
  mood_score: number; // 0..100
  energy_level: number; // 1..10
  anxiety_level?: number; // 1..10
  notes?: string;
  triggers?: string[];
  confidence?: number; // 0..1 (optional)
  source?: 'voice' | 'manual' | 'apple_health' | string;
}

// Apple Health tarzı toplulaştırılmış veri yapısı
// Interquartile Range structure
export type IQR = { p25: number; p50: number; p75: number };

// Unified aggregated bucket with IQR-first design
export interface AggregatedData {
  date: string;   // bucket başlangıcı (YYYY-MM-DD; hafta için Pazartesi, ay için YYYY-MM-01)
  label: string;  // "1–7 Oca" | "Ocak 2025"
  count: number;  // toplam giriş
  mood: IQR & { min?: number; max?: number };
  energy: IQR;
  anxiety: IQR;
  // Geriye dönük alanlar (kademeli kaldırma için opsiyonel):
  avg?: number; min?: number; max?: number; p10?: number; p50?: number; p90?: number; entries?: MoodEntryLite[];
}

export interface MoodJourneyExtended {
  // Existing-like fields
  weeklyEntries: MoodEntryLite[];
  todayAverage: number;
  weeklyTrend: 'up' | 'down' | 'stable';
  weeklyEnergyAvg: number;
  weeklyAnxietyAvg: number;

  // New ranges
  monthlyEntries?: MoodEntryLite[];
  sixMonthEntries?: MoodEntryLite[];
  yearlyEntries?: MoodEntryLite[];

  // Statistics
  statistics: {
    timeRange: TimeRange;
    totalEntries: number;
    averageMood: number; // 0..100
    averageEnergy: number; // 1..10
    averageAnxiety: number; // 1..10
    moodVariance: number;
    dominantEmotions: EmotionDistribution[];
    peakTimes: { hour: number; count: number }[];
    triggers: TriggerFrequency[];
  };

  // Raw points grouped by date (YYYY-MM-DD)
  rawDataPoints: Record<string, {
    entries: RawDataPoint[];
    min: number;
    max: number;
    variance: number;
  }>;
  // Hourly points for 'day' range (key: YYYY-MM-DD#HH)
  rawHourlyDataPoints?: Record<string, {
    entries: RawDataPoint[];
    min: number;
    max: number;
    variance: number;
  }>;

  // Daily aggregates for bar chart
  dailyAverages: DailyAverage[];
  // Hourly averages for 'day'
  hourlyAverages?: HourlyAverage[];

  // Seçili aralığa uygun aggregate veri (haftalık/aylık)
  aggregated?: {
    granularity: 'day' | 'week' | 'month';
    data: AggregatedData[];
  };
}
