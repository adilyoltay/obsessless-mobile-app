/**
 * 🚨 AI Error Feedback Service - User-Friendly AI Error Communication
 * 
 * Provides centralized, user-friendly error feedback for AI analysis failures.
 * Converts technical AI errors into actionable user notifications with retry mechanisms.
 * 
 * CRITICAL: Every AI failure should be communicated to users in a helpful way
 * instead of silent degradation or technical errors.
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { safeTrackAIInteraction } from '@/features/ai/telemetry/telemetryHelpers';
import { AIEventType } from '@/features/ai/telemetry/aiTelemetry';

/**
 * 📋 AI Error Types for User Feedback
 */
export enum AIErrorType {
  TOKEN_BUDGET_EXCEEDED = 'token_budget_exceeded',
  LOW_CONFIDENCE_ABSTAIN = 'low_confidence_abstain', 
  NETWORK_FAILURE = 'network_failure',
  PROGRESSIVE_ENHANCEMENT_FAILED = 'progressive_enhancement_failed',
  LLM_GATING_BLOCKED = 'llm_gating_blocked',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  ANALYSIS_TIMEOUT = 'analysis_timeout',
  DATA_INSUFFICIENT = 'data_insufficient',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 📊 Error Context for Detailed Feedback
 */
interface AIErrorContext {
  userId?: string;
  feature: string; // 'mood_analysis', 'voice_analysis', 'insights_generation'
  heuristicFallback?: boolean;
  retryable?: boolean;
  retryAfter?: number; // seconds
  metadata?: Record<string, any>;
}

/**
 * 🎯 User Action Options
 */
interface UserAction {
  label: string;
  action: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  primary?: boolean;
}

/**
 * 💬 Error Message Templates
 */
interface ErrorMessageTemplate {
  title: string;
  message: string;
  suggestion?: string;
  actions?: UserAction[];
  severity: 'info' | 'warning' | 'error';
  showToUser: boolean;
  persistent?: boolean; // Show until user dismisses
}

class AIErrorFeedbackService {
  private static instance: AIErrorFeedbackService;
  private readonly STORAGE_KEY = 'ai_error_feedback';
  private readonly SUPPRESSION_DURATION = 30 * 60 * 1000; // 30 minutes

  public static getInstance(): AIErrorFeedbackService {
    if (!AIErrorFeedbackService.instance) {
      AIErrorFeedbackService.instance = new AIErrorFeedbackService();
    }
    return AIErrorFeedbackService.instance;
  }

  /**
   * 🚨 Handle AI Error with User Feedback
   * 
   * Main entry point for AI error handling. Determines appropriate user feedback
   * based on error type and context.
   */
  public async handleAIError(
    errorType: AIErrorType,
    context: AIErrorContext,
    originalError?: Error
  ): Promise<void> {
    try {
      // 🔍 Check if error should be shown to user
      const shouldShow = await this.shouldShowError(errorType, context);
      if (!shouldShow) {
        console.log(`🔇 Suppressing duplicate AI error: ${errorType}`);
        return;
      }

      // 📝 Get error message template
      const template = this.getErrorMessageTemplate(errorType, context);
      
      if (!template.showToUser) {
        console.log(`🤐 AI error not user-facing: ${errorType}`);
        await this.recordErrorOccurrence(errorType, context);
        return;
      }

      // 📊 Track error for telemetry
      await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'ai_error_shown_to_user',
        errorType,
        feature: context.feature,
        severity: template.severity,
        retryable: context.retryable || false
      }, context.userId);

      // 🎯 Show appropriate user feedback
      await this.showUserFeedback(template, errorType, context);

      // 📦 Record error occurrence for suppression
      await this.recordErrorOccurrence(errorType, context);

    } catch (error) {
      console.error('❌ AI Error Feedback Service failed:', error);
      // Fallback: show basic error message
      Alert.alert(
        'AI Özelliği Geçici Kullanılamıyor',
        'Bazı akıllı özellikler şu an çalışmıyor. Temel işlevler normal şekilde devam ediyor.',
        [{ text: 'Tamam', style: 'default' }]
      );
    }
  }

  /**
   * 🎨 Generate User-Friendly Error Message Templates
   */
  private getErrorMessageTemplate(errorType: AIErrorType, context: AIErrorContext): ErrorMessageTemplate {
    const baseActions: UserAction[] = [
      { label: 'Tamam', action: () => {}, style: 'default' }
    ];

    switch (errorType) {
      case AIErrorType.TOKEN_BUDGET_EXCEEDED:
        return {
          title: '📊 Günlük AI Analizi Limiti',
          message: 'Bugünkü kişiselleştirilmiş AI analizlerini kullandın! Temel analiz devam ediyor.',
          suggestion: '💡 Yarın daha detaylı analizler için geri gel. Şimdilik temel özellikler aktif.',
          actions: [
            ...baseActions,
            ...(context.retryAfter ? [{
              label: 'Daha Sonra Hatırlat',
              action: () => this.scheduleRetryReminder(context.retryAfter!),
              style: 'default' as const
            }] : [])
          ],
          severity: 'warning',
          showToUser: true,
          persistent: false
        };

      case AIErrorType.LOW_CONFIDENCE_ABSTAIN:
        return {
          title: '🤔 AI Analizi Belirsiz',
          message: 'Yazınız hakkında kesin bir analiz yapamadım. Bu gayet normal!',
          suggestion: '💭 Daha detaylı yazabilir veya farklı bir yaklaşım deneyebilirsin.',
          actions: [
            { label: 'Anladım', action: () => {}, style: 'default' },
            { label: 'Tekrar Dene', action: () => this.triggerRetry(context), style: 'default', primary: true }
          ],
          severity: 'info',
          showToUser: true,
          persistent: false
        };

      case AIErrorType.NETWORK_FAILURE:
        return {
          title: '📶 Bağlantı Sorunu', 
          message: 'İnternet bağlantın zayıf olabilir. AI analizi şimdilik çevrimdışı modda çalışıyor.',
          suggestion: '🔄 Bağlantı düzeldiğinde otomatik olarak tam özellikler aktif olacak.',
          actions: [
            { label: 'Anladım', action: () => {}, style: 'default' },
            { label: 'Tekrar Dene', action: () => this.triggerRetry(context), style: 'default', primary: true }
          ],
          severity: 'warning',
          showToUser: true,
          persistent: false
        };

      case AIErrorType.PROGRESSIVE_ENHANCEMENT_FAILED:
        return {
          title: '⚡ Hızlı Analiz Kullanılamıyor',
          message: 'AI analiziniz biraz daha uzun sürebilir, ama yine de çalışıyor.',
          suggestion: '⏱️ Sabırlı ol, daha detaylı analiz hazırlanıyor.',
          actions: baseActions,
          severity: 'info',
          showToUser: false, // Usually not critical for user
          persistent: false
        };

      case AIErrorType.LLM_GATING_BLOCKED:
        return {
          title: '🧠 Temel Analiz Aktif',
          message: 'Şu an hızlı analiz modu kullanılıyor. Temel öneriler hazır!',
          suggestion: '💡 Daha karmaşık analiz için biraz daha detay paylaşabilirsin.',
          actions: baseActions,
          severity: 'info',
          showToUser: context.heuristicFallback ? false : true,
          persistent: false
        };

      case AIErrorType.RATE_LIMIT_EXCEEDED:
        return {
          title: '⏰ Çok Hızlı Analiz',
          message: `Biraz ara ver! ${Math.ceil((context.retryAfter || 60) / 60)} dakika sonra tekrar dene.`,
          suggestion: '☕ Bu sürede önceki analizlerini gözden geçirebilirsin.',
          actions: [
            ...baseActions,
            { label: 'Daha Sonra Hatırlat', action: () => this.scheduleRetryReminder(context.retryAfter || 60), style: 'default' }
          ],
          severity: 'warning',
          showToUser: true,
          persistent: false
        };

      case AIErrorType.SERVICE_UNAVAILABLE:
        return {
          title: '🔧 AI Servisi Bakımda',
          message: 'AI özellikleri geçici olarak kullanılamıyor. Temel özellikler çalışmaya devam ediyor.',
          suggestion: '🔄 Biraz sonra tekrar dene veya uygulamayı yeniden başlat.',
          actions: [
            { label: 'Tamam', action: () => {}, style: 'default' },
            { label: 'Yeniden Başlat', action: () => this.restartApp(), style: 'default' }
          ],
          severity: 'error',
          showToUser: true,
          persistent: true
        };

      case AIErrorType.DATA_INSUFFICIENT:
        return {
          title: '📊 Daha Fazla Veri Gerekli',
          message: 'AI analizi için yeterli veri yok. Biraz daha kullandıktan sonra daha iyi öneriler alacaksın!',
          suggestion: '📈 Günlük kullanımınla birlikte analizler gelişecek.',
          actions: baseActions,
          severity: 'info',
          showToUser: true,
          persistent: false
        };

      default:
        return {
          title: '🤖 AI Özelliği Geçici Kullanılamıyor',
          message: 'Beklenmedik bir sorun oluştu. Temel özellikler normal şekilde çalışmaya devam ediyor.',
          suggestion: '🔄 Uygulamayı yeniden başlatmayı dene.',
          actions: [
            { label: 'Tamam', action: () => {}, style: 'default' },
            { label: 'Yeniden Başlat', action: () => this.restartApp(), style: 'default' }
          ],
          severity: 'error',
          showToUser: true,
          persistent: false
        };
    }
  }

  /**
   * 💬 Show User Feedback (Alert or Toast)
   */
  private async showUserFeedback(
    template: ErrorMessageTemplate,
    errorType: AIErrorType,
    context: AIErrorContext
  ): Promise<void> {
    const message = template.suggestion 
      ? `${template.message}\n\n${template.suggestion}`
      : template.message;

    const alertActions = template.actions || [
      { label: 'Tamam', action: () => {}, style: 'default' }
    ];

    // Convert our actions to React Native Alert actions
    const alertButtons = alertActions.map(action => ({
      text: action.label,
      style: action.style || 'default',
      onPress: action.action
    }));

    // Show alert based on severity
    if (template.severity === 'error' || template.persistent) {
      Alert.alert(template.title, message, alertButtons);
    } else if (template.severity === 'warning') {
      Alert.alert(template.title, message, alertButtons);
    } else {
      // For info-level errors, use a more subtle approach
      // Could implement toast notifications here
      Alert.alert(template.title, message, alertButtons);
    }
  }

  /**
   * 🔄 Trigger Retry Mechanism
   */
  private triggerRetry(context: AIErrorContext): void {
    // Emit retry event that components can listen to
    const event = new CustomEvent('ai-error-retry', { 
      detail: { feature: context.feature, context } 
    });
    
    // Use global event dispatcher if available
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
    
    console.log(`🔄 Retry triggered for feature: ${context.feature}`);
  }

  /**
   * ⏰ Schedule Retry Reminder
   */
  private async scheduleRetryReminder(delaySeconds: number): Promise<void> {
    try {
      // Store reminder timestamp
      const reminderTime = Date.now() + (delaySeconds * 1000);
      await AsyncStorage.setItem('ai_retry_reminder', reminderTime.toString());
      
      console.log(`⏰ Retry reminder set for ${delaySeconds} seconds`);
      
      // Schedule notification (would need expo-notifications)
      // For now, just log
      setTimeout(() => {
        console.log('🔔 Retry reminder: AI features may be available now!');
      }, delaySeconds * 1000);
      
    } catch (error) {
      console.warn('⚠️ Failed to schedule retry reminder:', error);
    }
  }

  /**
   * 🔄 Restart App
   */
  private restartApp(): void {
    // Use Expo Updates to restart if available
    try {
      const Updates = require('expo-updates');
      if (Updates.reloadAsync) {
        Updates.reloadAsync();
        return;
      }
    } catch {}

    console.log('🔄 App restart triggered (requires manual restart)');
  }

  /**
   * 🤐 Check if Error Should Be Shown (Suppression Logic)
   */
  private async shouldShowError(errorType: AIErrorType, context: AIErrorContext): Promise<boolean> {
    try {
      const suppressionKey = `${this.STORAGE_KEY}_suppression_${errorType}_${context.feature}`;
      const lastShownStr = await AsyncStorage.getItem(suppressionKey);
      
      if (lastShownStr) {
        const lastShown = parseInt(lastShownStr);
        const timeSinceLastShown = Date.now() - lastShown;
        
        if (timeSinceLastShown < this.SUPPRESSION_DURATION) {
          return false; // Suppress duplicate error
        }
      }
      
      return true;
    } catch {
      return true; // Show on error
    }
  }

  /**
   * 📦 Record Error Occurrence
   */
  private async recordErrorOccurrence(errorType: AIErrorType, context: AIErrorContext): Promise<void> {
    try {
      const suppressionKey = `${this.STORAGE_KEY}_suppression_${errorType}_${context.feature}`;
      await AsyncStorage.setItem(suppressionKey, Date.now().toString());
    } catch (error) {
      console.warn('⚠️ Failed to record error occurrence:', error);
    }
  }

  /**
   * 📊 Get Error Statistics for Debug
   */
  public async getErrorStats(): Promise<Record<string, { count: number; lastOccurrence: number }>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const errorKeys = allKeys.filter(key => key.startsWith(`${this.STORAGE_KEY}_suppression_`));
      
      const stats: Record<string, { count: number; lastOccurrence: number }> = {};
      
      for (const key of errorKeys) {
        const errorType = key.replace(`${this.STORAGE_KEY}_suppression_`, '').split('_')[0];
        const lastOccurrenceStr = await AsyncStorage.getItem(key);
        
        if (lastOccurrenceStr) {
          const lastOccurrence = parseInt(lastOccurrenceStr);
          
          if (!stats[errorType]) {
            stats[errorType] = { count: 0, lastOccurrence: 0 };
          }
          
          stats[errorType].count++;
          stats[errorType].lastOccurrence = Math.max(stats[errorType].lastOccurrence, lastOccurrence);
        }
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Failed to get error stats:', error);
      return {};
    }
  }

  /**
   * 🧹 Clear Error History
   */
  public async clearErrorHistory(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const errorKeys = allKeys.filter(key => key.startsWith(this.STORAGE_KEY));
      
      await AsyncStorage.multiRemove(errorKeys);
      console.log(`🧹 Cleared ${errorKeys.length} error history entries`);
    } catch (error) {
      console.error('❌ Failed to clear error history:', error);
    }
  }
}

// Export singleton instance
export const aiErrorFeedbackService = AIErrorFeedbackService.getInstance();
export { AIErrorType, type AIErrorContext };
