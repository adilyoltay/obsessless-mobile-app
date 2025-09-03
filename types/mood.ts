export type TimeRange = 'week' | 'month' | '6months' | 'year';

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
export interface AggregatedData {
  date: string; // YYYY-MM-DD (hafta için Pazartesi), ay için YYYY-MM-01
  label: string; // Görsel etiket (örn. "1-7 Oca" veya "Ocak 2025")
  averageMood: number;
  averageEnergy: number;
  min: number;
  max: number;
  variance?: number;
  p10?: number;
  p50?: number;
  p90?: number;
  count: number; // toplam giriş sayısı
  entries: MoodEntryLite[]; // detay için ham girdiler
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

  // Daily aggregates for bar chart
  dailyAverages: DailyAverage[];

  // Seçili aralığa uygun aggregate veri (haftalık/aylık)
  aggregated?: {
    granularity: 'day' | 'week' | 'month';
    data: AggregatedData[];
  };
}
