/**
 * 🚨 AI Error Feedback Service
 * 
 * Provides user-friendly error feedback and fallback mechanisms 
 * for AI pipeline failures while maintaining privacy-first principles.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeTrackAIInteraction } from '@/features/ai/telemetry/telemetryHelpers';
import { AIEventType } from '@/features/ai/telemetry/aiTelemetry';

export enum AIErrorType {
  PROGRESSIVE_ENHANCEMENT_FAILED = 'progressive_enhancement_failed',
  LLM_SERVICE_UNAVAILABLE = 'llm_service_unavailable',
  VOICE_ANALYSIS_FAILED = 'voice_analysis_failed',
  INSIGHTS_GENERATION_FAILED = 'insights_generation_failed',
  PATTERN_RECOGNITION_FAILED = 'pattern_recognition_failed',
  CACHE_ERROR = 'cache_error',
  NETWORK_ERROR = 'network_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

export interface AIErrorContext {
  userId?: string;
  feature: string;
  heuristicFallback?: boolean;
  retryable?: boolean;
  userVisible?: boolean;
  metadata?: Record<string, any>;
}

export interface UserFeedback {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  actionRequired: boolean;
  fallbackAvailable: boolean;
  dismissible: boolean;
  retryAction?: () => Promise<void>;
  fallbackAction?: () => Promise<void>;
}

class AIErrorFeedbackService {
  private static instance: AIErrorFeedbackService;
  private readonly STORAGE_KEY = 'ai_error_feedback_queue';

  static getInstance(): AIErrorFeedbackService {
    if (!AIErrorFeedbackService.instance) {
      AIErrorFeedbackService.instance = new AIErrorFeedbackService();
    }
    return AIErrorFeedbackService.instance;
  }

  /**
   * Handle AI error with appropriate user feedback
   */
  async handleAIError(
    errorType: AIErrorType, 
    context: AIErrorContext
  ): Promise<void> {
    try {
      // Generate user-friendly feedback
      const feedback = this.generateFeedback(errorType, context);
      
      // Store feedback for UI to display
      if (feedback.severity !== 'info' || feedback.actionRequired) {
        await this.storeFeedback(feedback);
      }
      
      // Track error for monitoring
      await safeTrackAIInteraction(AIEventType.API_ERROR, {
        errorType,
        feature: context.feature,
        userId: context.userId,
        heuristicFallback: context.heuristicFallback,
        userVisible: feedback.severity !== 'info',
        ...context.metadata
      }, context.userId);
      
      console.log(`🔔 AI Error Feedback: ${feedback.title} - ${feedback.message}`);
      
    } catch (error) {
      console.error('❌ Failed to handle AI error feedback:', error);
    }
  }

  /**
   * Generate user-friendly feedback message
   */
  private generateFeedback(
    errorType: AIErrorType, 
    context: AIErrorContext
  ): UserFeedback {
    const baseId = `ai_error_${Date.now()}`;
    
    switch (errorType) {
      case AIErrorType.PROGRESSIVE_ENHANCEMENT_FAILED:
        return {
          id: baseId,
          title: '📊 Analiz Modu',
          message: 'Hızlı analiz kullanılamıyor, detaylı analiz yapılıyor...',
          severity: 'info',
          actionRequired: false,
          fallbackAvailable: true,
          dismissible: true
        };
        
      case AIErrorType.LLM_SERVICE_UNAVAILABLE:
        return {
          id: baseId,
          title: '🤖 AI Hizmeti',
          message: 'AI analizi geçici olarak kullanılamıyor. Temel özellikler çalışmaya devam ediyor.',
          severity: 'warning',
          actionRequired: false,
          fallbackAvailable: true,
          dismissible: true,
          retryAction: async () => {
            // Implement retry logic
            console.log('🔄 Retrying AI service...');
          }
        };
        
      case AIErrorType.VOICE_ANALYSIS_FAILED:
        return {
          id: baseId,
          title: '🎤 Ses Analizi',
          message: 'Ses analizi tamamlanamadı. Kaydınız korundu, tekrar deneyin.',
          severity: 'warning',
          actionRequired: true,
          fallbackAvailable: true,
          dismissible: false,
          retryAction: async () => {
            console.log('🔄 Retrying voice analysis...');
          },
          fallbackAction: async () => {
            console.log('📝 Switching to manual entry...');
          }
        };
        
      case AIErrorType.INSIGHTS_GENERATION_FAILED:
        return {
          id: baseId,
          title: '💡 İçgörü Üretimi',
          message: 'Öngörüler şu an oluşturulamıyor. Verileriniz güvende, daha sonra tekrar deneyin.',
          severity: 'info',
          actionRequired: false,
          fallbackAvailable: false,
          dismissible: true
        };
        
      case AIErrorType.RATE_LIMIT_EXCEEDED:
        return {
          id: baseId,
          title: '⏳ Kullanım Limiti',
          message: 'AI özellikleri geçici olarak sınırlandı. Birkaç dakika sonra tekrar deneyin.',
          severity: 'warning',
          actionRequired: false,
          fallbackAvailable: true,
          dismissible: true
        };
        
      case AIErrorType.NETWORK_ERROR:
        return {
          id: baseId,
          title: '📡 Bağlantı Sorunu',
          message: 'İnternet bağlantınızı kontrol edin. Veriler offline saklandı.',
          severity: 'error',
          actionRequired: true,
          fallbackAvailable: true,
          dismissible: false,
          retryAction: async () => {
            console.log('🔄 Retrying with network...');
          }
        };
        
      default:
        return {
          id: baseId,
          title: '⚠️ Geçici Sorun',
          message: 'Beklenmeyen bir sorun oluştu. Temel özellikler çalışmaya devam ediyor.',
          severity: 'warning',
          actionRequired: false,
          fallbackAvailable: true,
          dismissible: true
        };
    }
  }

  /**
   * Store feedback for UI consumption
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      const existing = await this.getFeedbackQueue();
      const updated = [...existing, feedback];
      
      // Keep only last 5 feedback items to prevent queue bloat
      const trimmed = updated.slice(-5);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
      
    } catch (error) {
      console.error('❌ Failed to store AI feedback:', error);
    }
  }

  /**
   * Get pending feedback for UI
   */
  async getFeedbackQueue(): Promise<UserFeedback[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get feedback queue:', error);
      return [];
    }
  }

  /**
   * Clear feedback by ID
   */
  async clearFeedback(feedbackId: string): Promise<void> {
    try {
      const queue = await this.getFeedbackQueue();
      const filtered = queue.filter(item => item.id !== feedbackId);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('❌ Failed to clear feedback:', error);
    }
  }

  /**
   * Clear all feedback
   */
  async clearAllFeedback(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('❌ Failed to clear all feedback:', error);
    }
  }

  /**
   * Show immediate notification (if possible)
   */
  async showImmediateNotification(feedback: UserFeedback): Promise<void> {
    try {
      // Use Expo Notifications API for immediate notification
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: feedback.title,
          body: feedback.message,
          data: { 
            type: 'ai_error',
            feedbackId: feedback.id,
            severity: feedback.severity
          }
        },
        trigger: null // Immediate notification
      });
    } catch (error) {
      console.warn('⚠️ Failed to show immediate notification:', error);
    }
  }
}

export const aiErrorFeedbackService = AIErrorFeedbackService.getInstance();