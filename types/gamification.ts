// Gamification Types for ObsessLess
// Based on PILLAR 4: Anlamlı Oyunlaştırma ve Motivasyon

export interface UserGamificationProfile {
  streakCurrent: number;
  streakBest: number;
  unlockedAchievements: string[]; // Achievement IDs
  healingPointsToday: number;
  healingPointsTotal: number;
  streakLevel: 'seedling' | 'warrior' | 'master'; // Fidan 🌱, Savaşçı ⚔️, Usta 🧘
  lastActivityDate: string; // ISO date string
  // Optional gamification runtime flags (persisted offline)
  lastFirstActivityAwardDate?: string; // YYYY-MM-DD of last first-activity bonus
  streakMilestonesAwarded?: number[]; // e.g., [7,21]
  modulesActiveDate?: string; // YYYY-MM-DD for modulesActiveToday
  modulesActiveToday?: string[]; // unique modules touched today (e.g., ['mood','breathwork'])
  multiModuleDayAwarded?: 0 | 1 | 2 | 3; // highest threshold awarded today
  // Weekly consistency tracking
  weekKey?: string; // e.g., 2025-W35
  activeDaysThisWeek?: number; // number of days with at least one activity
  weeklyConsistencyAwarded?: boolean; // if weekly consistency bonus given
}

export interface AchievementDefinition {
  id: string; // 'first_session', 'habituation_observer', etc.
  title: string;
  description: string;
  category: 'Resistance' | 'Mindfulness';
  icon: string; // MaterialCommunityIcons name
  rarity: 'Common' | 'Rare' | 'Epic';
  criteria: {
    type: 'milestone' | 'count' | 'percentage' | 'streak';
    target: number;
    currentProgress?: number;
  };
  healingPoints: number;
  unlockedAt?: Date;
}

export interface StreakInfo {
  current: number;
  best: number;
  level: 'seedling' | 'warrior' | 'master';
  levelName: string;
  levelDescription: string;
  nextLevelAt?: number;
  icon: string;
}

export interface HealingPoints {
  today: number;
  total: number;
  weeklyBonus: boolean; // Weekend 2x bonus
  lastEarnedAt?: Date;
}

// Micro-reward triggers
export type MicroRewardTrigger =
  | 'voice_mood_checkin'
  | 'mood_manual_checkin'
  | 'breathwork_completed'
  | 'first_activity_of_day'
  | 'streak_milestone_7'
  | 'streak_milestone_21'
  | 'multi_module_day_2'
  | 'multi_module_day_3'
  | 'weekly_consistency_5';

export interface MicroReward {
  points: number;
  message: string;
  trigger: MicroRewardTrigger;
} 
