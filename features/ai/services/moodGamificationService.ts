/**
 * 🎮 Mood Gamification Service
 * 
 * Advanced gamification system for mood tracking including:
 * - Mood-specific scoring with psychological rewards
 * - Achievement system with progression tracking
 * - Consistency bonuses and streak multipliers
 * - Improvement tracking and milestone rewards
 * - Dynamic challenges and personalized goals
 * - Motivational insights and progress celebrations
 * 
 * Created: Jan 2025 - Part of Mood Screen AI Enhancement Project
 */

import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { MoodEntry } from '@/services/moodTrackingService';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface MoodPoints {
  basePoints: number;
  consistencyBonus: number;
  honestyBonus: number;
  improvementBonus: number;
  detailBonus: number;
  streakMultiplier: number;
  totalPoints: number;
  breakdown: {
    reason: string;
    points: number;
  }[];
}

export interface MoodAchievement {
  id: string;
  name: string;
  description: string;
  badge: string;
  points: number;
  category: 'tracking' | 'consistency' | 'improvement' | 'insight' | 'milestone';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  condition: (history: MoodEntry[], stats: any) => boolean;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
  unlockedAt?: Date;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface MoodChallenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  difficulty: 'easy' | 'medium' | 'hard';
  targetValue: number;
  currentProgress: number;
  reward: {
    points: number;
    badge?: string;
    title?: string;
  };
  expiresAt: Date;
  completed: boolean;
}

export interface MoodGamificationStats {
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  averageMood: number;
  improvementRate: number;
  achievements: MoodAchievement[];
  activeChallenges: MoodChallenge[];
  recentMilestones: string[];
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

export class MoodGamificationService {
  private static instance: MoodGamificationService;
  
  static getInstance(): MoodGamificationService {
    if (!MoodGamificationService.instance) {
      MoodGamificationService.instance = new MoodGamificationService();
    }
    return MoodGamificationService.instance;
  }

  /**
   * 🎮 Calculate mood tracking points for a new entry
   */
  async calculateMoodPoints(
    userId: string,
    entry: MoodEntry,
    userHistory: MoodEntry[]
  ): Promise<MoodPoints> {
    console.log('🎮 Calculating mood points...');

    const startTime = Date.now();

    // Track gamification start
    await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
      userId,
      dataType: 'mood_gamification',
      entryCount: userHistory.length,
      timestamp: startTime
    });

    try {
      const breakdown: { reason: string; points: number }[] = [];

      // 1. BASE POINTS - Always given for logging
      const basePoints = 10;
      breakdown.push({ reason: 'Mood kaydı oluşturma', points: basePoints });

      // 2. CONSISTENCY BONUS - Consecutive days
      const consecutiveDays = this.calculateConsecutiveDays(userHistory);
      const consistencyBonus = Math.min(consecutiveDays * 2, 30);
      if (consistencyBonus > 0) {
        breakdown.push({ reason: `${consecutiveDays} gün ardışık kayıt`, points: consistencyBonus });
      }

      // 3. HONESTY BONUS - Rewarding honest low mood tracking
      let honestyBonus = 0;
      if (entry.mood_score < 40) {
        honestyBonus = 8; // More points for honest low mood tracking
        breakdown.push({ reason: 'Dürüst duygusal takip', points: honestyBonus });
      }

      // 4. IMPROVEMENT BONUS - Mood improvement over time
      const improvementBonus = this.calculateImprovementBonus(entry, userHistory);
      if (improvementBonus > 0) {
        breakdown.push({ reason: 'Mood iyileşmesi', points: improvementBonus });
      }

      // 5. DETAIL BONUS - Extra information provided
      let detailBonus = 0;
      if (entry.notes && entry.notes.length > 20) detailBonus += 5;
      if (entry.triggers && entry.triggers.length > 0) detailBonus += 3;
      if (entry.activities && entry.activities.length > 0) detailBonus += 3;
      if (detailBonus > 0) {
        breakdown.push({ reason: 'Detaylı bilgi paylaşımı', points: detailBonus });
      }

      // 6. STREAK MULTIPLIER - Long streaks get bonus multiplier
      const currentStreak = this.calculateStreak(userHistory);
      let streakMultiplier = 1.0;
      if (currentStreak >= 30) streakMultiplier = 1.5;
      else if (currentStreak >= 14) streakMultiplier = 1.3;
      else if (currentStreak >= 7) streakMultiplier = 1.2;

      if (streakMultiplier > 1) {
        breakdown.push({ 
          reason: `${currentStreak} gün seri bonusu`, 
          points: Math.round((basePoints + consistencyBonus) * (streakMultiplier - 1))
        });
      }

      // 7. SPECIAL BONUSES
      const specialBonuses = this.calculateSpecialBonuses(entry, userHistory);
      breakdown.push(...specialBonuses);

      // Calculate totals
      const rawTotal = basePoints + consistencyBonus + honestyBonus + improvementBonus + detailBonus;
      const totalPoints = Math.round(rawTotal * streakMultiplier + specialBonuses.reduce((sum, b) => sum + b.points, 0));

      const result: MoodPoints = {
        basePoints,
        consistencyBonus,
        honestyBonus,
        improvementBonus,
        detailBonus,
        streakMultiplier,
        totalPoints,
        breakdown
      };

      // Track successful calculation
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'mood_gamification_points',
        insightsCount: 1,
        processingTime: Date.now() - startTime,
        pointsAwarded: totalPoints,
        streakDays: currentStreak
      });

      console.log(`🎮 Points calculated: ${totalPoints} (streak: ${currentStreak})`);
      return result;

    } catch (error) {
      console.error('❌ Mood gamification points calculation failed:', error);
      
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        userId,
        component: 'moodGamification',
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      // Return minimal fallback points
      return {
        basePoints: 10,
        consistencyBonus: 0,
        honestyBonus: 0,
        improvementBonus: 0,
        detailBonus: 0,
        streakMultiplier: 1,
        totalPoints: 10,
        breakdown: [{ reason: 'Mood kaydı oluşturma', points: 10 }]
      };
    }
  }

  /**
   * 🏆 Check for unlocked achievements
   */
  async checkAchievements(
    userId: string,
    userHistory: MoodEntry[],
    totalPoints?: number
  ): Promise<MoodAchievement[]> {
    console.log('🏆 Checking mood achievements...');

    const unlockedAchievements: MoodAchievement[] = [];
    const stats = this.calculateMoodStats(userHistory);

    // Get all available achievements
    const allAchievements = this.getAllMoodAchievements();

    for (const achievement of allAchievements) {
      if (achievement.condition(userHistory, { ...stats, totalPoints })) {
        achievement.unlockedAt = new Date();
        
        // Calculate progress for display
        if (achievement.id.includes('streak')) {
          achievement.progress = {
            current: stats.currentStreak,
            target: this.getAchievementTarget(achievement.id),
            percentage: Math.min(100, (stats.currentStreak / this.getAchievementTarget(achievement.id)) * 100)
          };
        }

        unlockedAchievements.push(achievement);

        // Track achievement unlock
        await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
          userId,
          source: 'mood_achievement_unlocked',
          achievementId: achievement.id,
          achievementTier: achievement.tier,
          achievementRarity: achievement.rarity,
          pointsAwarded: achievement.points
        });

        console.log(`🏆 Achievement unlocked: ${achievement.name} (${achievement.points} points)`);
      }
    }

    return unlockedAchievements;
  }

  /**
   * 🎯 Generate dynamic challenges
   */
  async generateDynamicChallenges(
    userId: string,
    userHistory: MoodEntry[],
    currentChallenges: MoodChallenge[]
  ): Promise<MoodChallenge[]> {
    console.log('🎯 Generating dynamic mood challenges...');

    const newChallenges: MoodChallenge[] = [];
    const stats = this.calculateMoodStats(userHistory);

    // Only generate if user has fewer than 3 active challenges
    if (currentChallenges.length < 3) {
      const challengeTemplates = this.getChallengeTemplates(stats);
      
      const challengesToGenerate = Math.min(3 - currentChallenges.length, 2);
      
      for (let i = 0; i < challengesToGenerate; i++) {
        const template = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)];
        
        const challenge: MoodChallenge = {
          id: `challenge_${Date.now()}_${i}`,
          title: template.title,
          description: template.description,
          type: template.type,
          difficulty: template.difficulty,
          targetValue: template.targetValue,
          currentProgress: 0,
          reward: template.reward,
          expiresAt: this.calculateExpirationDate(template.type),
          completed: false
        };

        newChallenges.push(challenge);
      }

      // Track challenge generation
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'mood_challenges_generated',
        challengesCount: newChallenges.length,
        challengeTypes: newChallenges.map(c => c.type)
      });

      console.log(`🎯 Generated ${newChallenges.length} new challenges`);
    }

    return newChallenges;
  }

  /**
   * 📊 Calculate comprehensive mood gamification stats
   */
  calculateMoodGamificationStats(
    userHistory: MoodEntry[],
    totalPoints: number = 0,
    achievements: MoodAchievement[] = [],
    challenges: MoodChallenge[] = []
  ): MoodGamificationStats {
    const stats = this.calculateMoodStats(userHistory);
    
    // Calculate level from points (every 100 points = 1 level)
    const currentLevel = Math.floor(totalPoints / 100) + 1;
    const pointsToNextLevel = 100 - (totalPoints % 100);

    // Recent milestones
    const recentMilestones: string[] = [];
    if (stats.currentStreak >= 7 && stats.currentStreak < 14) {
      recentMilestones.push('1 hafta seri kayıt!');
    } else if (stats.currentStreak >= 30) {
      recentMilestones.push('1 ay seri kayıt! 🔥');
    }
    
    if (stats.totalEntries >= 100) {
      recentMilestones.push('100+ mood kaydı!');
    }

    if (stats.improvementRate > 20) {
      recentMilestones.push('Büyük mood iyileşmesi!');
    }

    return {
      totalPoints,
      currentLevel,
      pointsToNextLevel,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      totalEntries: stats.totalEntries,
      averageMood: stats.averageMood,
      improvementRate: stats.improvementRate,
      achievements,
      activeChallenges: challenges.filter(c => !c.completed && c.expiresAt > new Date()),
      recentMilestones
    };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private calculateConsecutiveDays(history: MoodEntry[]): number {
    if (history.length === 0) return 0;

    const sortedEntries = history.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let consecutiveDays = 1; // Today counts
    let currentDate = new Date(sortedEntries[0].timestamp);
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 1; i < sortedEntries.length; i++) {
      const entryDate = new Date(sortedEntries[i].timestamp);
      entryDate.setHours(0, 0, 0, 0);
      
      const daysDiff = (currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1) {
        consecutiveDays++;
        currentDate = entryDate;
      } else {
        break;
      }
    }

    return consecutiveDays;
  }

  private calculateImprovementBonus(entry: MoodEntry, history: MoodEntry[]): number {
    if (history.length < 2) return 0;

    const recentEntries = history
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    const previousEntry = recentEntries[1]; // Previous entry
    if (!previousEntry) return 0;

    const improvement = entry.mood_score - previousEntry.mood_score;
    
    if (improvement > 0) {
      return Math.min(15, Math.round(improvement / 5) * 3);
    }

    return 0;
  }

  private calculateStreak(history: MoodEntry[]): number {
    return this.calculateConsecutiveDays(history);
  }

  private calculateSpecialBonuses(entry: MoodEntry, history: MoodEntry[]): { reason: string; points: number }[] {
    const bonuses: { reason: string; points: number }[] = [];
    
    // First entry of the day bonus
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEntries = history.filter(e => {
      const entryDate = new Date(e.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    if (todayEntries.length === 1) {
      bonuses.push({ reason: 'Günün ilk kaydı', points: 5 });
    }

    // Weekly milestone bonus
    if (history.length > 0 && (history.length + 1) % 7 === 0) {
      bonuses.push({ reason: 'Haftalık kilometre taşı', points: 20 });
    }

    // High mood celebration bonus
    if (entry.mood_score >= 80) {
      bonuses.push({ reason: 'Yüksek mood kutlaması', points: 12 });
    }

    // Recovery bonus - good mood after bad mood
    const recentLowMood = history
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
      .some(e => e.mood_score < 40);
    
    if (recentLowMood && entry.mood_score > 60) {
      bonuses.push({ reason: 'Mood iyileşme bonusu', points: 10 });
    }

    return bonuses;
  }

  private calculateMoodStats(history: MoodEntry[]) {
    const sortedHistory = history.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const totalEntries = history.length;
    const averageMood = totalEntries > 0 
      ? Math.round(history.reduce((sum, entry) => sum + entry.mood_score, 0) / totalEntries)
      : 50;

    const currentStreak = this.calculateStreak(history);
    
    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = new Date(0);

    sortedHistory.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      
      const daysDiff = (entryDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff === 1 || lastDate.getTime() === 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
      
      lastDate = entryDate;
    });

    // Calculate improvement rate (last 7 days vs previous 7 days)
    let improvementRate = 0;
    if (totalEntries >= 14) {
      const recent7 = sortedHistory.slice(-7);
      const previous7 = sortedHistory.slice(-14, -7);
      
      const recentAvg = recent7.reduce((sum, e) => sum + e.mood_score, 0) / 7;
      const previousAvg = previous7.reduce((sum, e) => sum + e.mood_score, 0) / 7;
      
      improvementRate = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    }

    return {
      totalEntries,
      averageMood,
      currentStreak,
      longestStreak,
      improvementRate
    };
  }

  private getAllMoodAchievements(): MoodAchievement[] {
    return [
      // TRACKING CATEGORY
      {
        id: 'first_entry',
        name: 'İlk Adım',
        description: 'İlk mood kaydınızı oluşturdunuz',
        badge: '🌱',
        points: 25,
        category: 'tracking',
        tier: 'bronze',
        condition: (history) => history.length >= 1,
        rarity: 'common'
      },
      {
        id: 'week_tracker',
        name: 'Haftalık Takipçi',
        description: '7 gün boyunca mood kaydı yapın',
        badge: '📊',
        points: 100,
        category: 'tracking',
        tier: 'bronze',
        condition: (history) => this.calculateConsecutiveDays(history) >= 7,
        rarity: 'common'
      },
      {
        id: 'month_champion',
        name: 'Aylık Şampiyon',
        description: '30 gün boyunca mood kaydı yapın',
        badge: '🏆',
        points: 500,
        category: 'tracking',
        tier: 'gold',
        condition: (history) => this.calculateConsecutiveDays(history) >= 30,
        rarity: 'rare'
      },

      // CONSISTENCY CATEGORY
      {
        id: 'consistent_tracker',
        name: 'Tutarlı Takipçi',
        description: '14 gün ardışık kayıt yapın',
        badge: '⏰',
        points: 200,
        category: 'consistency',
        tier: 'silver',
        condition: (history) => this.calculateConsecutiveDays(history) >= 14,
        rarity: 'uncommon'
      },
      {
        id: 'dedication_master',
        name: 'Adanmışlık Ustası',
        description: '100 gün ardışık kayıt yapın',
        badge: '💎',
        points: 2000,
        category: 'consistency',
        tier: 'platinum',
        condition: (history) => this.calculateConsecutiveDays(history) >= 100,
        rarity: 'legendary'
      },

      // IMPROVEMENT CATEGORY
      {
        id: 'mood_booster',
        name: 'Mood Yükseltici',
        description: 'Haftalık mood ortalamanızı 20 puan artırın',
        badge: '📈',
        points: 150,
        category: 'improvement',
        tier: 'silver',
        condition: (history, stats) => stats && stats.improvementRate >= 20,
        rarity: 'uncommon'
      },
      {
        id: 'happiness_seeker',
        name: 'Mutluluk Arayıcısı',
        description: '5 kez üst üste 80+ mood kaydı yapın',
        badge: '😊',
        points: 300,
        category: 'improvement',
        tier: 'gold',
        condition: (history) => {
          const recent5 = history
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5);
          return recent5.length === 5 && recent5.every(e => e.mood_score >= 80);
        },
        rarity: 'rare'
      },

      // INSIGHT CATEGORY
      {
        id: 'emotional_awareness',
        name: 'Duygusal Farkındalık',
        description: '10 farklı trigger tanımlayın',
        badge: '🎭',
        points: 125,
        category: 'insight',
        tier: 'bronze',
        condition: (history) => {
          const uniqueTriggers = new Set();
          history.forEach(entry => {
            if (entry.triggers) {
              entry.triggers.forEach(trigger => uniqueTriggers.add(trigger));
            }
          });
          return uniqueTriggers.size >= 10;
        },
        rarity: 'common'
      },
      {
        id: 'honest_tracker',
        name: 'Dürüst Takipçi',
        description: 'Zor zamanları da kaydetmekten korkmayın (5 kez düşük mood)',
        badge: '💯',
        points: 100,
        category: 'insight',
        tier: 'silver',
        condition: (history) => history.filter(e => e.mood_score < 40).length >= 5,
        rarity: 'uncommon'
      },

      // MILESTONE CATEGORY
      {
        id: 'century_club',
        name: 'Yüzler Kulübü',
        description: '100 mood kaydı oluşturun',
        badge: '💯',
        points: 750,
        category: 'milestone',
        tier: 'gold',
        condition: (history) => history.length >= 100,
        rarity: 'rare'
      },
      {
        id: 'mood_master',
        name: 'Mood Ustası',
        description: '500 mood kaydı oluşturun',
        badge: '🎖️',
        points: 2500,
        category: 'milestone',
        tier: 'platinum',
        condition: (history) => history.length >= 500,
        rarity: 'epic'
      }
    ];
  }

  private getAchievementTarget(achievementId: string): number {
    const targets: Record<string, number> = {
      'week_tracker': 7,
      'consistent_tracker': 14,
      'month_champion': 30,
      'dedication_master': 100,
      'century_club': 100,
      'mood_master': 500
    };
    
    return targets[achievementId] || 1;
  }

  private getChallengeTemplates(stats: any) {
    return [
      // Daily challenges
      {
        title: 'Günlük Mood Takibi',
        description: 'Bugün mood kaydınızı yapın ve 5+ puan kazanın',
        type: 'daily' as const,
        difficulty: 'easy' as const,
        targetValue: 1,
        reward: { points: 25 }
      },
      {
        title: 'Detaylı Analiz',
        description: 'Bugün mood kaydınızda notlar ve tetikleyici ekleyin',
        type: 'daily' as const,
        difficulty: 'medium' as const,
        targetValue: 1,
        reward: { points: 40 }
      },

      // Weekly challenges
      {
        title: 'Haftalık Tutarlılık',
        description: '7 gün boyunca her gün mood kaydı yapın',
        type: 'weekly' as const,
        difficulty: 'medium' as const,
        targetValue: 7,
        reward: { points: 150, badge: '⭐' }
      },
      {
        title: 'Mood İyileştirme',
        description: 'Bu hafta ortalama mood scorunuzu 10 puan artırın',
        type: 'weekly' as const,
        difficulty: 'hard' as const,
        targetValue: 10,
        reward: { points: 200, title: 'Mood Booster' }
      },

      // Monthly challenges  
      {
        title: 'Aylık Dedikasyon',
        description: '30 gün boyunca düzenli mood takibi yapın',
        type: 'monthly' as const,
        difficulty: 'hard' as const,
        targetValue: 30,
        reward: { points: 500, badge: '🏆', title: 'Dedication Master' }
      }
    ];
  }

  private calculateExpirationDate(type: MoodChallenge['type']): Date {
    const now = new Date();
    
    switch (type) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(23, 59, 59, 999);
        return now;
        
      case 'weekly':
        now.setDate(now.getDate() + 7);
        return now;
        
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        return now;
        
      default:
        now.setDate(now.getDate() + 1);
        return now;
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const moodGamificationService = MoodGamificationService.getInstance();
export default moodGamificationService;
