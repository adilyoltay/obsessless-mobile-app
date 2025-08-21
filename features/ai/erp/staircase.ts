/**
 * 🪜 ERP Staircase - Deterministic difficulty progression for ERP sessions
 * 
 * This module implements a deterministic staircase algorithm for ERP difficulty
 * progression with floor/ceiling limits and plateau detection.
 * 
 * Rules:
 * - +1 difficulty on successful completion (≥70% tolerance)
 * - -1 difficulty on early dropout (<30% completion)
 * - No change on plateau (30-70% completion)
 * - Hard floor and ceiling limits
 * - Max delta per session: ±1
 * 
 * @module ERPStaircase
 * @since v1.0.0
 */

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackERPStaircase } from '../telemetry/aiTelemetry';

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

const CONFIG = {
  difficulty: {
    floor: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_ERP_DIFFICULTY_FLOOR || '1'
    ),
    ceiling: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_ERP_DIFFICULTY_CEILING || '10'
    ),
    maxDelta: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_ERP_DIFFICULTY_MAX_DELTA || '1'
    ),
  },
  thresholds: {
    dropPromotion: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_ERP_DROP_PROMOTION_THRESHOLD || '0.30'
    ),
    reboundDemotion: parseFloat(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_ERP_REBOUND_DEMOTION_THRESHOLD || '0.20'
    ),
  },
};

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * ERP session performance metrics
 */
export interface SessionPerformance {
  completionRate: number; // 0.0 - 1.0
  anxietyReduction: number; // Pre-post anxiety delta
  habituation: boolean; // Was habituation achieved?
  timeSpent: number; // Minutes
  targetTime: number; // Expected minutes
  dropoutReason?: 'anxiety' | 'time' | 'user_exit' | 'technical';
}

/**
 * Difficulty adjustment result
 */
export interface DifficultyAdjustment {
  previousDifficulty: number;
  newDifficulty: number;
  delta: number;
  reason: string;
  plateauDetected: boolean;
  hitLimit: 'floor' | 'ceiling' | null;
}

/**
 * User ERP history
 */
interface UserERPHistory {
  userId: string;
  currentDifficulty: number;
  lastSessionDate: string;
  sessionHistory: Array<{
    date: string;
    difficulty: number;
    performance: SessionPerformance;
    adjustment: DifficultyAdjustment;
  }>;
  plateauCount: number;
  promotionStreak: number;
  demotionStreak: number;
}

// =============================================================================
// 🪜 ERP STAIRCASE IMPLEMENTATION
// =============================================================================

/**
 * ERP Staircase difficulty manager
 */
export class ERPStaircase {
  private static instance: ERPStaircase;
  private userHistories: Map<string, UserERPHistory> = new Map();
  private storageKey = 'erp_staircase_history';
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ERPStaircase {
    if (!ERPStaircase.instance) {
      ERPStaircase.instance = new ERPStaircase();
    }
    return ERPStaircase.instance;
  }

  /**
   * Initialize the staircase manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load user histories from storage
      await this.loadHistories();
      
      this.isInitialized = true;
      console.log('✅ ERPStaircase initialized');
    } catch (error) {
      console.error('❌ ERPStaircase initialization failed:', error);
      this.userHistories.clear();
      this.isInitialized = true;
    }
  }

  /**
   * Get current difficulty for user
   */
  async getCurrentDifficulty(userId: string): Promise<number> {
    const history = await this.getOrCreateHistory(userId);
    return history.currentDifficulty;
  }

  /**
   * Calculate next difficulty based on performance
   */
  async calculateNextDifficulty(
    userId: string,
    performance: SessionPerformance
  ): Promise<DifficultyAdjustment> {
    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    const history = await this.getOrCreateHistory(userId);
    const currentDifficulty = history.currentDifficulty;
    
    // Apply staircase algorithm
    const adjustment = this.applyStaircaseRules(currentDifficulty, performance, history);
    
    // Update history
    history.currentDifficulty = adjustment.newDifficulty;
    history.lastSessionDate = new Date().toISOString();
    
    // Update streaks
    if (adjustment.delta > 0) {
      history.promotionStreak++;
      history.demotionStreak = 0;
    } else if (adjustment.delta < 0) {
      history.demotionStreak++;
      history.promotionStreak = 0;
    } else {
      // Plateau
      history.plateauCount++;
    }
    
    // Add to session history
    history.sessionHistory.push({
      date: new Date().toISOString(),
      difficulty: currentDifficulty,
      performance,
      adjustment,
    });
    
    // Keep only last 30 sessions
    if (history.sessionHistory.length > 30) {
      history.sessionHistory = history.sessionHistory.slice(-30);
    }
    
    // Save to storage
    await this.saveHistories();
    
    // Log adjustment
    if (__DEV__) {
      console.log('🪜 ERP Difficulty Adjustment:', {
        user: userId,
        from: adjustment.previousDifficulty,
        to: adjustment.newDifficulty,
        delta: adjustment.delta,
        reason: adjustment.reason,
      });
    }
    
    return adjustment;
  }

  /**
   * Get user progression statistics
   */
  async getProgressionStats(userId: string): Promise<{
    currentDifficulty: number;
    averageDifficulty: number;
    totalSessions: number;
    promotions: number;
    demotions: number;
    plateaus: number;
    currentStreak: {
      type: 'promotion' | 'demotion' | 'plateau';
      count: number;
    };
    trend: 'improving' | 'declining' | 'stable';
  }> {
    const history = await this.getOrCreateHistory(userId);
    const sessions = history.sessionHistory;
    
    if (sessions.length === 0) {
      return {
        currentDifficulty: history.currentDifficulty,
        averageDifficulty: history.currentDifficulty,
        totalSessions: 0,
        promotions: 0,
        demotions: 0,
        plateaus: 0,
        currentStreak: { type: 'plateau', count: 0 },
        trend: 'stable',
      };
    }
    
    // Calculate statistics
    let totalDifficulty = 0;
    let promotions = 0;
    let demotions = 0;
    let plateaus = 0;
    
    for (const session of sessions) {
      totalDifficulty += session.difficulty;
      if (session.adjustment.delta > 0) promotions++;
      else if (session.adjustment.delta < 0) demotions++;
      else plateaus++;
    }
    
    // Determine current streak
    let currentStreak: { type: 'promotion' | 'demotion' | 'plateau'; count: number };
    if (history.promotionStreak > 0) {
      currentStreak = { type: 'promotion', count: history.promotionStreak };
    } else if (history.demotionStreak > 0) {
      currentStreak = { type: 'demotion', count: history.demotionStreak };
    } else {
      currentStreak = { type: 'plateau', count: history.plateauCount };
    }
    
    // Calculate trend (last 5 sessions)
    const recentSessions = sessions.slice(-5);
    const recentDelta = recentSessions.reduce((sum, s) => sum + s.adjustment.delta, 0);
    let trend: 'improving' | 'declining' | 'stable';
    if (recentDelta > 1) trend = 'improving';
    else if (recentDelta < -1) trend = 'declining';
    else trend = 'stable';
    
    return {
      currentDifficulty: history.currentDifficulty,
      averageDifficulty: totalDifficulty / sessions.length,
      totalSessions: sessions.length,
      promotions,
      demotions,
      plateaus,
      currentStreak,
      trend,
    };
  }

  /**
   * Reset user difficulty to starting level
   */
  async resetDifficulty(userId: string, newDifficulty?: number): Promise<void> {
    const history = await this.getOrCreateHistory(userId);
    
    history.currentDifficulty = newDifficulty || Math.floor((CONFIG.difficulty.floor + CONFIG.difficulty.ceiling) / 2);
    history.sessionHistory = [];
    history.plateauCount = 0;
    history.promotionStreak = 0;
    history.demotionStreak = 0;
    history.lastSessionDate = new Date().toISOString();
    
    await this.saveHistories();
    
    console.log(`🔄 ERP difficulty reset for user ${userId} to level ${history.currentDifficulty}`);
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Apply staircase rules to determine difficulty adjustment
   */
  private applyStaircaseRules(
    currentDifficulty: number,
    performance: SessionPerformance,
    history: UserERPHistory
  ): DifficultyAdjustment {
    let newDifficulty = currentDifficulty;
    let delta = 0;
    let reason = '';
    let plateauDetected = false;
    let hitLimit: 'floor' | 'ceiling' | null = null;
    
    // Rule 1: Successful completion (≥70% tolerance) → Promote
    if (performance.completionRate >= 0.7 && performance.habituation) {
      delta = 1;
      reason = 'successful_completion_with_habituation';
    }
    // Rule 2: Early dropout (<30% completion) → Demote
    else if (performance.completionRate < CONFIG.thresholds.dropPromotion) {
      delta = -1;
      reason = `early_dropout_${performance.dropoutReason || 'unknown'}`;
    }
    // Rule 3: Anxiety rebound (<20% reduction) → Demote
    else if (performance.anxietyReduction < CONFIG.thresholds.reboundDemotion) {
      delta = -1;
      reason = 'anxiety_rebound';
    }
    // Rule 4: Plateau (30-70% completion) → No change
    else {
      delta = 0;
      reason = 'plateau_detected';
      plateauDetected = true;
    }
    
    // Apply max delta constraint
    delta = Math.max(-CONFIG.difficulty.maxDelta, Math.min(CONFIG.difficulty.maxDelta, delta));
    
    // Apply new difficulty
    newDifficulty = currentDifficulty + delta;
    
    // Apply floor/ceiling limits
    if (newDifficulty < CONFIG.difficulty.floor) {
      newDifficulty = CONFIG.difficulty.floor;
      hitLimit = 'floor';
      reason += '_hit_floor';
    } else if (newDifficulty > CONFIG.difficulty.ceiling) {
      newDifficulty = CONFIG.difficulty.ceiling;
      hitLimit = 'ceiling';
      reason += '_hit_ceiling';
    }
    
    // Check for streak-based adjustments
    if (history.promotionStreak >= 3 && delta === 0) {
      // Consider small promotion after consistent success
      if (newDifficulty < CONFIG.difficulty.ceiling) {
        newDifficulty++;
        delta = 1;
        reason = 'streak_bonus_promotion';
      }
    } else if (history.demotionStreak >= 3 && delta === 0) {
      // Consider small demotion after consistent struggle
      if (newDifficulty > CONFIG.difficulty.floor) {
        newDifficulty--;
        delta = -1;
        reason = 'streak_based_demotion';
      }
    }
    
    return {
      previousDifficulty: currentDifficulty,
      newDifficulty,
      delta: newDifficulty - currentDifficulty,
      reason,
      plateauDetected,
      hitLimit,
    };
  }

  /**
   * Get or create user history
   */
  private async getOrCreateHistory(userId: string): Promise<UserERPHistory> {
    if (!this.userHistories.has(userId)) {
      const history: UserERPHistory = {
        userId,
        currentDifficulty: Math.floor((CONFIG.difficulty.floor + CONFIG.difficulty.ceiling) / 2),
        lastSessionDate: new Date().toISOString(),
        sessionHistory: [],
        plateauCount: 0,
        promotionStreak: 0,
        demotionStreak: 0,
      };
      this.userHistories.set(userId, history);
    }
    return this.userHistories.get(userId)!;
  }

  /**
   * Load histories from storage
   */
  private async loadHistories(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Convert array to Map
        if (Array.isArray(data)) {
          this.userHistories = new Map(data);
        }
      }
    } catch (error) {
      console.error('Error loading ERP histories:', error);
      this.userHistories.clear();
    }
  }

  /**
   * Save histories to storage
   */
  private async saveHistories(): Promise<void> {
    try {
      // Convert Map to array for storage
      const data = Array.from(this.userHistories.entries());
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving ERP histories:', error);
    }
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

// Export singleton instance
export const erpStaircase = ERPStaircase.getInstance();

// Export types
export default ERPStaircase;
export type { SessionPerformance, DifficultyAdjustment, UserERPHistory };
