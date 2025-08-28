/**
 * 💰 Token Budget Manager - LLM usage budget control
 * 
 * This module manages token usage budgets and rate limiting for LLM calls.
 * Implements both per-user daily soft limits and rate limiting per 10 minutes.
 * 
 * Features:
 * - Daily token budget tracking
 * - 10-minute rate limiting
 * - Per-user budget isolation
 * - Persistent storage across sessions
 * 
 * @module TokenBudgetManager
 * @since v1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

const CONFIG = {
  dailyTokenSoftLimit: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT || '20000'
  ),
  rateLimitPer10Min: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_RATE_LIMIT_PER_10MIN || '3'
  ),
};

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * User budget data
 */
interface UserBudget {
  userId: string;
  dailyTokensUsed: number;
  dailyTokensRemaining: number;
  lastResetDate: string; // ISO date string
  recentRequests: number[]; // Timestamps of recent requests
}

/**
 * Budget check result
 */
interface BudgetCheckResult {
  canProceed: boolean;
  reason?: 'daily_limit' | 'rate_limit' | 'ok';
  tokensRemaining: number;
  nextAvailableAt?: number; // Timestamp
}

// =============================================================================
// 💰 TOKEN BUDGET MANAGER IMPLEMENTATION
// =============================================================================

/**
 * Token budget manager class
 */
export class TokenBudgetManager {
  private budgets: Map<string, UserBudget> = new Map();
  private storageKey = 'ai_token_budgets';
  private isInitialized = false;

  constructor() {
    // Constructor
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load existing budgets from storage
      await this.loadBudgets();
      
      // Clean up old data
      await this.cleanupOldData();
      
      this.isInitialized = true;
      console.log('✅ TokenBudgetManager initialized');
    } catch (error) {
      console.error('❌ TokenBudgetManager initialization failed:', error);
      // Continue with empty budgets on error
      this.budgets.clear();
      this.isInitialized = true;
    }
  }

  /**
   * Check if a request can be made for a user
   */
  async canMakeRequest(userId: string): Promise<boolean> {
    const result = await this.checkBudget(userId);
    return result.canProceed;
  }

  /**
   * Detailed budget check
   */
  async checkBudget(userId: string): Promise<BudgetCheckResult> {
    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Get or create user budget
    const budget = this.getOrCreateBudget(userId);

    // Check if daily reset is needed
    if (this.needsDailyReset(budget)) {
      await this.resetDailyBudget(budget);
    }

    // Check daily token limit
    if (budget.dailyTokensRemaining <= 0) {
      return {
        canProceed: false,
        reason: 'daily_limit',
        tokensRemaining: 0,
        nextAvailableAt: this.getNextResetTime(),
      };
    }

    // Check rate limit (requests per 10 minutes)
    const rateLimitCheck = this.checkRateLimit(budget);
    if (!rateLimitCheck.canProceed) {
      return rateLimitCheck;
    }

    return {
      canProceed: true,
      reason: 'ok',
      tokensRemaining: budget.dailyTokensRemaining,
    };
  }

  /**
   * Record token usage
   */
  async recordUsage(userId: string, tokensUsed: number): Promise<void> {
    const budget = this.getOrCreateBudget(userId);
    
    // Update token counts
    budget.dailyTokensUsed += tokensUsed;
    budget.dailyTokensRemaining = Math.max(0, budget.dailyTokensRemaining - tokensUsed);
    
    // Record request timestamp
    budget.recentRequests.push(Date.now());
    
    // Clean old request timestamps (keep only last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    budget.recentRequests = budget.recentRequests.filter(ts => ts > tenMinutesAgo);
    
    // Save to storage
    await this.saveBudgets();
    
    // Log usage
    if (__DEV__) {
      console.log(`💰 Token usage recorded: ${tokensUsed} tokens for user ${userId}`);
      console.log(`   Remaining today: ${budget.dailyTokensRemaining}/${CONFIG.dailyTokenSoftLimit}`);
    }
  }

  /**
   * Get remaining tokens for a user
   */
  async getRemainingTokens(userId: string): Promise<number> {
    const budget = this.getOrCreateBudget(userId);
    
    if (this.needsDailyReset(budget)) {
      await this.resetDailyBudget(budget);
    }
    
    return budget.dailyTokensRemaining;
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(userId: string): Promise<{
    dailyUsed: number;
    dailyRemaining: number;
    dailyLimit: number;
    recentRequests: number;
    canMakeRequest: boolean;
  }> {
    const budget = this.getOrCreateBudget(userId);
    const canMakeRequest = await this.canMakeRequest(userId);
    
    // Clean old request timestamps
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentRequests = budget.recentRequests.filter(ts => ts > tenMinutesAgo).length;
    
    return {
      dailyUsed: budget.dailyTokensUsed,
      dailyRemaining: budget.dailyTokensRemaining,
      dailyLimit: CONFIG.dailyTokenSoftLimit,
      recentRequests,
      canMakeRequest,
    };
  }

  /**
   * Reset all budgets (admin function)
   */
  async resetAllBudgets(): Promise<void> {
    this.budgets.clear();
    await this.saveBudgets();
    console.log('🔄 All token budgets reset');
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Get or create budget for user
   */
  private getOrCreateBudget(userId: string): UserBudget {
    if (!this.budgets.has(userId)) {
      const budget: UserBudget = {
        userId,
        dailyTokensUsed: 0,
        dailyTokensRemaining: CONFIG.dailyTokenSoftLimit,
        lastResetDate: new Date().toISOString().split('T')[0],
        recentRequests: [],
      };
      this.budgets.set(userId, budget);
    }
    return this.budgets.get(userId)!;
  }

  /**
   * Check if daily reset is needed
   */
  private needsDailyReset(budget: UserBudget): boolean {
    const today = new Date().toISOString().split('T')[0];
    return budget.lastResetDate !== today;
  }

  /**
   * Reset daily budget
   */
  private async resetDailyBudget(budget: UserBudget): Promise<void> {
    budget.dailyTokensUsed = 0;
    budget.dailyTokensRemaining = CONFIG.dailyTokenSoftLimit;
    budget.lastResetDate = new Date().toISOString().split('T')[0];
    budget.recentRequests = [];
    
    await this.saveBudgets();
    console.log(`🔄 Daily budget reset for user ${budget.userId}`);
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(budget: UserBudget): BudgetCheckResult {
    // Clean old timestamps
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    budget.recentRequests = budget.recentRequests.filter(ts => ts > tenMinutesAgo);
    
    // Check if under rate limit
    if (budget.recentRequests.length >= CONFIG.rateLimitPer10Min) {
      // Find when the oldest request will expire
      const oldestRequest = Math.min(...budget.recentRequests);
      const nextAvailable = oldestRequest + 10 * 60 * 1000;
      
      return {
        canProceed: false,
        reason: 'rate_limit',
        tokensRemaining: budget.dailyTokensRemaining,
        nextAvailableAt: nextAvailable,
      };
    }
    
    return {
      canProceed: true,
      reason: 'ok',
      tokensRemaining: budget.dailyTokensRemaining,
    };
  }

  /**
   * Get next reset time (midnight in local timezone)
   */
  private getNextResetTime(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Load budgets from storage
   */
  private async loadBudgets(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Convert array back to Map
        if (Array.isArray(data)) {
          this.budgets = new Map(data);
        } else if (data && typeof data === 'object') {
          // Handle old format (object)
          this.budgets = new Map(Object.entries(data));
        }
      }
    } catch (error) {
      console.error('Error loading token budgets:', error);
      this.budgets.clear();
    }
  }

  /**
   * Save budgets to storage
   */
  private async saveBudgets(): Promise<void> {
    try {
      // Convert Map to array for storage
      const data = Array.from(this.budgets.entries());
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving token budgets:', error);
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    const now = Date.now();
    let hasChanges = false;
    
    for (const [userId, budget] of this.budgets) {
      // Reset if last reset was not today
      if (this.needsDailyReset(budget)) {
        await this.resetDailyBudget(budget);
        hasChanges = true;
      }
      
      // Clean old request timestamps
      const tenMinutesAgo = now - 10 * 60 * 1000;
      const oldLength = budget.recentRequests.length;
      budget.recentRequests = budget.recentRequests.filter(ts => ts > tenMinutesAgo);
      
      if (oldLength !== budget.recentRequests.length) {
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      await this.saveBudgets();
    }
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

export default TokenBudgetManager;
export type { UserBudget, BudgetCheckResult };
