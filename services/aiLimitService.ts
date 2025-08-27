/**
 * 📊 AI Limit Service - Token kullanımı ve limit yönetimi
 * Settings ekranı için AI limit bilgilerini sağlar
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

export interface AILimitInfo {
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  remainingTokens: number;
  usagePercentage: number;
  resetTime: string; // ISO datetime string for next reset
  canUseAI: boolean;
  limitReachedAt?: string; // When limit was reached
}

export interface AILimitSettings {
  customDailyLimit?: number; // User-defined limit (optional)
  enableUnlimitedMode?: boolean; // Debug/dev setting
  notifyAt90Percent?: boolean; // Notify when 90% used
}

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG = {
  dailyTokenLimit: __DEV__ ? 50 : 1000, // Lower limit in dev for easy testing (matches checkinService.ts)
  configDailyLimit: parseInt(
    Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT || '20000'
  ),
};

// =============================================================================
// 📊 AI LIMIT SERVICE CLASS
// =============================================================================

class AILimitService {
  private static instance: AILimitService;
  
  private constructor() {}
  
  static getInstance(): AILimitService {
    if (!AILimitService.instance) {
      AILimitService.instance = new AILimitService();
    }
    return AILimitService.instance;
  }

  /**
   * Get current AI limit information for a user
   */
  async getAILimitInfo(userId: string): Promise<AILimitInfo> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `token_usage_${userId}_${today}`;
      const settingsKey = `ai_limit_settings_${userId}`;
      
      // Get current usage
      const usageStr = await AsyncStorage.getItem(usageKey);
      const dailyTokensUsed = usageStr ? parseInt(usageStr) : 0;
      
      // Get user settings
      const settingsStr = await AsyncStorage.getItem(settingsKey);
      const settings: AILimitSettings = settingsStr ? JSON.parse(settingsStr) : {};
      
      // Determine effective limit
      let dailyTokenLimit = DEFAULT_CONFIG.dailyTokenLimit;
      if (settings.enableUnlimitedMode && __DEV__) {
        dailyTokenLimit = 999999; // Effectively unlimited in dev
      } else if (settings.customDailyLimit) {
        dailyTokenLimit = settings.customDailyLimit;
      }
      
      const remainingTokens = Math.max(0, dailyTokenLimit - dailyTokensUsed);
      const usagePercentage = Math.min(100, (dailyTokensUsed / dailyTokenLimit) * 100);
      
      // Calculate next reset time (midnight)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const resetTime = tomorrow.toISOString();
      
      const canUseAI = dailyTokensUsed < dailyTokenLimit;
      
      // Check if limit was reached today
      let limitReachedAt: string | undefined;
      if (!canUseAI) {
        const reachedKey = `limit_reached_${userId}_${today}`;
        limitReachedAt = await AsyncStorage.getItem(reachedKey) || undefined;
      }
      
      return {
        dailyTokensUsed,
        dailyTokenLimit,
        remainingTokens,
        usagePercentage,
        resetTime,
        canUseAI,
        limitReachedAt
      };
      
    } catch (error) {
      console.error('Failed to get AI limit info:', error);
      
      // Return safe defaults on error
      return {
        dailyTokensUsed: 0,
        dailyTokenLimit: DEFAULT_CONFIG.dailyTokenLimit,
        remainingTokens: DEFAULT_CONFIG.dailyTokenLimit,
        usagePercentage: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        canUseAI: true
      };
    }
  }

  /**
   * Get user's AI limit settings
   */
  async getAILimitSettings(userId: string): Promise<AILimitSettings> {
    try {
      const settingsKey = `ai_limit_settings_${userId}`;
      const settingsStr = await AsyncStorage.getItem(settingsKey);
      return settingsStr ? JSON.parse(settingsStr) : {};
    } catch (error) {
      console.error('Failed to get AI limit settings:', error);
      return {};
    }
  }

  /**
   * Update user's AI limit settings
   */
  async updateAILimitSettings(userId: string, settings: Partial<AILimitSettings>): Promise<void> {
    try {
      const settingsKey = `ai_limit_settings_${userId}`;
      const currentSettings = await this.getAILimitSettings(userId);
      const updatedSettings = { ...currentSettings, ...settings };
      
      await AsyncStorage.setItem(settingsKey, JSON.stringify(updatedSettings));
      console.log('✅ AI limit settings updated:', updatedSettings);
    } catch (error) {
      console.error('Failed to update AI limit settings:', error);
      throw error;
    }
  }

  /**
   * Reset daily usage (debug function)
   */
  async resetDailyUsage(userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `token_usage_${userId}_${today}`;
      const reachedKey = `limit_reached_${userId}_${today}`;
      
      await AsyncStorage.removeItem(usageKey);
      await AsyncStorage.removeItem(reachedKey);
      
      console.log('✅ Daily AI usage reset for user:', userId);
    } catch (error) {
      console.error('Failed to reset daily usage:', error);
      throw error;
    }
  }

  /**
   * Get usage history for last 7 days
   */
  async getUsageHistory(userId: string): Promise<Array<{ date: string; usage: number }>> {
    try {
      const history: Array<{ date: string; usage: number }> = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const usageKey = `token_usage_${userId}_${dateStr}`;
        const usageStr = await AsyncStorage.getItem(usageKey);
        const usage = usageStr ? parseInt(usageStr) : 0;
        
        history.push({ date: dateStr, usage });
      }
      
      return history;
    } catch (error) {
      console.error('Failed to get usage history:', error);
      return [];
    }
  }

  /**
   * Format usage percentage for display
   */
  formatUsagePercentage(percentage: number): string {
    if (percentage >= 100) return '100%';
    if (percentage >= 10) return `${Math.round(percentage)}%`;
    return `${Math.round(percentage * 10) / 10}%`;
  }

  /**
   * Get status color based on usage
   */
  getUsageStatusColor(percentage: number): string {
    if (percentage >= 100) return '#EF4444'; // Red - exceeded
    if (percentage >= 90) return '#F59E0B';  // Amber - warning
    if (percentage >= 70) return '#3B82F6';  // Blue - moderate
    return '#10B981'; // Green - low usage
  }

  /**
   * Get usage status message
   */
  getUsageStatusMessage(info: AILimitInfo): string {
    if (!info.canUseAI) {
      return `Günlük limit doldu • Yarın ${new Date(info.resetTime).toLocaleDateString('tr-TR')} sıfırlanacak`;
    }
    
    if (info.usagePercentage >= 90) {
      return `%${Math.round(info.usagePercentage)} kullanıldı • ${info.remainingTokens} token kaldı`;
    }
    
    if (info.usagePercentage >= 70) {
      return `%${Math.round(info.usagePercentage)} kullanıldı • İyi gidiyorsun`;
    }
    
    return `%${Math.round(info.usagePercentage)} kullanıldı • Bol bol analiz yap!`;
  }
}

// =============================================================================
// 📤 EXPORTS
// =============================================================================

export const aiLimitService = AILimitService.getInstance();
export default aiLimitService;
