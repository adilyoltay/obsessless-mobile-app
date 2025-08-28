/**
 * AI Gamification Fallback - Phase 2
 */

// Types for compatibility
export interface UnifiedPointsCalculation {
  basePoints: number;
  multiplier: number;
  bonuses: string[];
}

export interface UnifiedMission {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export const unifiedGamificationService = {
  awardMicroReward: async (userId: string, action?: string) => {
    // AI gamification disabled - return static reward
    return {
      points: 5,
      level: 1,
      streak: 1,
      healingPoints: 5
    };
  },
  
  calculateContextualReward: async (context: any) => {
    return { points: 1, multiplier: 1 };
  },
  
  awardUnifiedPoints: async (...args: any[]) => {
    // AI unified points disabled - return static reward
    return {
      points: 5,
      totalPoints: 5,
      multiplier: 1,
      bonuses: [],
      breakdown: {
        base: 5,
        bonuses: 0
      }
    };
  }
};
