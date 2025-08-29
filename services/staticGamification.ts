/**
 * Static Gamification Service
 * 
 * AI tabanlı gamification yerine kullanılacak basit gamification servisi.
 * Basit kurallar ve static hesaplamalar kullanır.
 */

// Types from original gamification
export interface UnifiedPointsCalculation {
  basePoints: number;
  bonusMultiplier: number;
  streakBonus: number;
  totalPoints: number;
  reason: string;
}

export interface UnifiedMission {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  pointsReward: number;
  completed: boolean;
  type: 'daily' | 'weekly' | 'monthly';
}

// Static point calculation rules
export const calculateMoodEntryPoints = (streak: number = 0): UnifiedPointsCalculation => {
  const basePoints = 10; // Her mood entry için sabit puan
  const streakBonus = Math.min(streak * 2, 50); // Max 50 bonus
  const bonusMultiplier = streak > 7 ? 1.5 : 1.0; // 7+ günlük streak'te %50 bonus
  
  const totalPoints = Math.round((basePoints + streakBonus) * bonusMultiplier);
  
  return {
    basePoints,
    bonusMultiplier,
    streakBonus,
    totalPoints,
    reason: `Mood entry (${streak} günlük streak)`
  };
};

export const calculateCheckinPoints = (streak: number = 0): UnifiedPointsCalculation => {
  const basePoints = 5; // Check-in için daha az puan
  const streakBonus = Math.min(streak, 25); // Max 25 bonus
  const bonusMultiplier = 1.0; // Check-in'de multiplier yok
  
  const totalPoints = basePoints + streakBonus;
  
  return {
    basePoints,
    bonusMultiplier,
    streakBonus,
    totalPoints,
    reason: `Voice check-in (${streak} günlük streak)`
  };
};

// Static mission generator
export const generateDailyMissions = (): UnifiedMission[] => {
  return [
    {
      id: 'daily_mood_entry',
      title: 'Günlük Mood Kaydı',
      description: 'Bugün en az 1 mood kaydı yap',
      targetCount: 1,
      currentCount: 0,
      pointsReward: 20,
      completed: false,
      type: 'daily'
    },
    {
      id: 'daily_checkin',
      title: 'Günlük Check-in',
      description: 'Bugün sesli check-in yap',
      targetCount: 1,
      currentCount: 0,
      pointsReward: 15,
      completed: false,
      type: 'daily'
    }
  ];
};

export const generateWeeklyMissions = (): UnifiedMission[] => {
  return [
    {
      id: 'weekly_consistency',
      title: 'Haftalık Tutarlılık',
      description: '7 gün boyunca mood kaydı yap',
      targetCount: 7,
      currentCount: 0,
      pointsReward: 100,
      completed: false,
      type: 'weekly'
    }
  ];
};

// Unified gamification service for backward compatibility
export const unifiedGamificationService = {
  calculateMoodEntryPoints,
  calculateCheckinPoints,
  generateDailyMissions,
  generateWeeklyMissions,
  
  // Additional methods that might be needed
  calculateStreakBonus: (streak: number) => Math.min(streak * 2, 50),
  getMissionProgress: (missionId: string, currentCount: number, targetCount: number) => ({
    id: missionId,
    progress: Math.min(currentCount / targetCount, 1),
    completed: currentCount >= targetCount
  })
};

// Default export for easier imports
export default {
  calculateMoodEntryPoints,
  calculateCheckinPoints,
  generateDailyMissions,
  generateWeeklyMissions,
  unifiedGamificationService
};
