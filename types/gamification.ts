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
}

export interface AchievementDefinition {
  id: string; // 'first_erp', 'habituation_observer', etc.
  title: string;
  description: string;
  category: 'ERP' | 'Resistance' | 'Mindfulness';
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
  | 'compulsion_recorded'
  | 'erp_completed'
  | 'high_resistance'
  | 'anxiety_reduced'
  | 'daily_goal_met'
  | 'erp_quick_start'
  | 'planning_ahead'
  | 'compulsion_quick_entry'
  | 'pattern_recognition'
  | 'consistent_tracking'
  | 'resistance_improvement';

export interface MicroReward {
  points: number;
  message: string;
  trigger: MicroRewardTrigger;
} 