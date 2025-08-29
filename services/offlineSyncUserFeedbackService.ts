import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { trackAIInteraction, AIEventType } from '@/services/telemetry/noopTelemetry';
import { safeStorageKey } from '@/lib/queryClient';

/**
 * 🔔 OFFLINE SYNC USER FEEDBACK SERVICE
 * 
 * Provides user-friendly notifications and feedback for offline sync failures
 * - User notifications for sync issues  
 * - Recovery suggestions and actions
 * - Persistent error tracking with user visibility
 * - Actionable alerts with retry options
 */

export interface SyncErrorDetails {
  id: string;
  entity: 'mood_entry' | 'achievement' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'user_profile';
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: number;
  errorMessage: string;
  userFriendlyMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  isResolved: boolean;
  userNotified: boolean;
  recoveryActions?: string[];
}

export interface SyncErrorSummary {
  totalErrors: number;
  unresolvedErrors: number;
  criticalErrors: number;
  lastErrorTime: number;
  affectedEntities: string[];
  needsUserAttention: boolean;
}

class OfflineSyncUserFeedbackService {
  private static instance: OfflineSyncUserFeedbackService;
  private readonly STORAGE_PREFIX = 'sync_errors_';
  private readonly MAX_ERROR_HISTORY = 50;
  private readonly USER_NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
  private lastNotificationTime = 0;

  private constructor() {}

  static getInstance(): OfflineSyncUserFeedbackService {
    if (!OfflineSyncUserFeedbackService.instance) {
      OfflineSyncUserFeedbackService.instance = new OfflineSyncUserFeedbackService();
    }
    return OfflineSyncUserFeedbackService.instance;
  }

  /**
   * 🔑 Get storage key for user's sync errors
   */
  private async getUserErrorKey(): Promise<string> {
    const currentUserId = await AsyncStorage.getItem('currentUserId');
    return `${this.STORAGE_PREFIX}${safeStorageKey(currentUserId)}`;
  }

  /**
   * 📝 Record sync error with user-friendly messaging
   */
  async recordSyncError(
    itemId: string,
    entity: SyncErrorDetails['entity'],
    type: SyncErrorDetails['type'],
    technicalError: string,
    retryCount: number = 0,
    maxRetries: number = 8
  ): Promise<void> {
    try {
      const errorKey = await this.getUserErrorKey();
      const existingErrors = await this.getStoredErrors();
      
      // Generate user-friendly message
      const { userFriendlyMessage, severity, recoveryActions } = this.generateUserFriendlyError(
        entity, type, technicalError, retryCount, maxRetries
      );

      const errorDetails: SyncErrorDetails = {
        id: itemId,
        entity,
        type,
        timestamp: Date.now(),
        errorMessage: technicalError,
        userFriendlyMessage,
        severity,
        retryCount,
        maxRetries,
        isResolved: false,
        userNotified: false,
        recoveryActions
      };

      // Update or add error
      const errorIndex = existingErrors.findIndex(e => e.id === itemId);
      if (errorIndex >= 0) {
        existingErrors[errorIndex] = errorDetails;
      } else {
        existingErrors.push(errorDetails);
      }

      // Keep only recent errors
      const recentErrors = existingErrors
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_ERROR_HISTORY);

      await AsyncStorage.setItem(errorKey, JSON.stringify(recentErrors));

      // Decide if user should be notified
      await this.evaluateUserNotification(errorDetails, recentErrors);

      // 📊 TELEMETRY: Track sync error
      await trackAIInteraction(AIEventType.SYNC_ERROR_RECORDED, {
        entity,
        type,
        severity,
        retryCount,
        maxRetries,
        errorCategory: this.categorizeError(technicalError)
      });

    } catch (error) {
      console.error('❌ Failed to record sync error:', error);
    }
  }

  /**
   * 🔔 Evaluate if user should be notified about sync errors
   */
  private async evaluateUserNotification(
    newError: SyncErrorDetails, 
    allErrors: SyncErrorDetails[]
  ): Promise<void> {
    const now = Date.now();
    
    // Cooldown check - don't spam user
    if (now - this.lastNotificationTime < this.USER_NOTIFICATION_COOLDOWN) {
      return;
    }

    const unresolvedErrors = allErrors.filter(e => !e.isResolved);
    const criticalErrors = unresolvedErrors.filter(e => e.severity === 'critical');
    const highPriorityErrors = unresolvedErrors.filter(e => e.severity === 'high');

    // Notification triggers
    let shouldNotify = false;
    let notificationTitle = '';
    let notificationMessage = '';
    let actions: Array<{ text: string, onPress: () => void, style?: 'default' | 'cancel' | 'destructive' }> = [];

    if (criticalErrors.length > 0) {
      // Critical errors - immediate notification
      shouldNotify = true;
      notificationTitle = '🚨 Senkronizasyon Sorunu';
      notificationMessage = `${criticalErrors.length} kritik veri senkronizasyon hatası var. Verileriniz kaybolabilir.`;
      
      actions = [
        { text: 'Detayları Gör', onPress: () => this.showErrorDetails(criticalErrors), style: 'default' },
        { text: 'Şimdi Dene', onPress: () => this.triggerManualSync(), style: 'default' },
        { text: 'Tamam', style: 'cancel' }
      ];

    } else if (highPriorityErrors.length >= 3) {
      // Multiple high priority errors
      shouldNotify = true;
      notificationTitle = '⚠️ Senkronizasyon Uyarısı';
      notificationMessage = `${highPriorityErrors.length} veri senkronize edilemiyor. İnternet bağlantınızı kontrol edin.`;
      
      actions = [
        { text: 'Yeniden Dene', onPress: () => this.triggerManualSync(), style: 'default' },
        { text: 'Daha Sonra', style: 'cancel' }
      ];

    } else if (newError.severity === 'high' && newError.retryCount >= newError.maxRetries - 2) {
      // Individual high priority error near max retries
      shouldNotify = true;
      notificationTitle = '📱 Veri Kaydetme Sorunu';
      notificationMessage = newError.userFriendlyMessage;
      
      actions = [
        { text: 'Yeniden Dene', onPress: () => this.retrySpecificItem(newError.id), style: 'default' },
        { text: 'Tamam', style: 'cancel' }
      ];
    }

    if (shouldNotify) {
      this.lastNotificationTime = now;
      
      // Update notification status for affected errors
      const affectedErrors = criticalErrors.length > 0 ? criticalErrors : 
                            highPriorityErrors.length >= 3 ? highPriorityErrors : [newError];
      
      for (const error of affectedErrors) {
        error.userNotified = true;
      }
      
      // Save updated errors
      const errorKey = await this.getUserErrorKey();
      await AsyncStorage.setItem(errorKey, JSON.stringify(allErrors));

      // Show alert
      Alert.alert(notificationTitle, notificationMessage, actions);

      // 📊 TELEMETRY: Track user notification
      await trackAIInteraction(AIEventType.SYNC_ERROR_USER_NOTIFIED, {
        errorCount: affectedErrors.length,
        criticalCount: criticalErrors.length,
        notificationType: criticalErrors.length > 0 ? 'critical' : 
                          highPriorityErrors.length >= 3 ? 'multiple_high' : 'individual_high'
      });
    }
  }

  /**
   * 📱 Generate user-friendly error messages
   */
  private generateUserFriendlyError(
    entity: SyncErrorDetails['entity'],
    type: SyncErrorDetails['type'],
    technicalError: string,
    retryCount: number,
    maxRetries: number
  ): { userFriendlyMessage: string; severity: SyncErrorDetails['severity']; recoveryActions: string[] } {
    
    const isNearMaxRetries = retryCount >= maxRetries - 2;
    const entityNames = {
      mood_entry: 'mood kaydı',
      achievement: 'başarı',
      ai_profile: 'AI profili',
      treatment_plan: 'tedavi planı',
      voice_checkin: 'ses kaydı',
      user_profile: 'kullanıcı profili'
    };

    const entityName = entityNames[entity] || 'veri';
    const actionNames = {
      CREATE: 'kaydedilemiyor',
      UPDATE: 'güncellenemiyor', 
      DELETE: 'silinemiyor'
    };
    
    const actionName = actionNames[type] || 'işlenemiyor';

    // Determine severity
    let severity: SyncErrorDetails['severity'] = 'medium';
    if (entity === 'mood_entry' || entity === 'ai_profile') {
      severity = isNearMaxRetries ? 'critical' : 'high';
    } else if (isNearMaxRetries) {
      severity = 'high';
    }

    // Generate message
    let message: string;
    let recoveryActions: string[] = [];

    if (technicalError.toLowerCase().includes('network') || technicalError.toLowerCase().includes('connection')) {
      message = `${entityName} ${actionName} - internet bağlantısı sorunu. (Deneme ${retryCount}/${maxRetries})`;
      recoveryActions = ['İnternet bağlantınızı kontrol edin', 'Wi-Fi veya mobil veri kullanmayı deneyin', 'Daha sonra otomatik denenecek'];
      severity = severity === 'critical' ? 'high' : 'medium'; // Network errors are usually temporary

    } else if (technicalError.toLowerCase().includes('auth') || technicalError.toLowerCase().includes('unauthorized')) {
      message = `${entityName} ${actionName} - oturum sorunu. Lütfen tekrar giriş yapın.`;
      recoveryActions = ['Uygulamayı yeniden başlatın', 'Çıkış yapıp tekrar giriş yapın'];
      severity = 'high';

    } else if (technicalError.toLowerCase().includes('quota') || technicalError.toLowerCase().includes('limit')) {
      message = `${entityName} ${actionName} - sınır aşıldı. Daha sonra tekrar denenecek.`;
      recoveryActions = ['Biraz bekleyin', 'Çok fazla veri göndermeyin'];
      severity = 'medium';

    } else if (technicalError.toLowerCase().includes('validation') || technicalError.toLowerCase().includes('format')) {
      message = `${entityName} ${actionName} - veri formatı sorunu.`;
      recoveryActions = ['Verilerinizi kontrol edin', 'Destek ekibiyle iletişime geçin'];
      severity = isNearMaxRetries ? 'high' : 'medium';

    } else {
      message = `${entityName} ${actionName}. (Deneme ${retryCount}/${maxRetries})`;
      recoveryActions = ['İnternet bağlantısını kontrol edin', 'Uygulamayı yeniden başlatın'];
    }

    if (isNearMaxRetries) {
      message += ' Son denemelerde - verileriniz kaybolabilir.';
    }

    return { userFriendlyMessage: message, severity, recoveryActions };
  }

  /**
   * 📊 Get sync error summary for user
   */
  async getSyncErrorSummary(): Promise<SyncErrorSummary> {
    try {
      const errors = await this.getStoredErrors();
      const unresolvedErrors = errors.filter(e => !e.isResolved);
      const criticalErrors = unresolvedErrors.filter(e => e.severity === 'critical');
      
      return {
        totalErrors: errors.length,
        unresolvedErrors: unresolvedErrors.length,
        criticalErrors: criticalErrors.length,
        lastErrorTime: errors.length > 0 ? Math.max(...errors.map(e => e.timestamp)) : 0,
        affectedEntities: [...new Set(unresolvedErrors.map(e => e.entity))],
        needsUserAttention: criticalErrors.length > 0 || unresolvedErrors.length >= 5
      };
    } catch (error) {
      console.error('❌ Failed to get sync error summary:', error);
      return {
        totalErrors: 0,
        unresolvedErrors: 0,
        criticalErrors: 0,
        lastErrorTime: 0,
        affectedEntities: [],
        needsUserAttention: false
      };
    }
  }

  /**
   * ✅ Mark sync error as resolved  
   */
  async markErrorResolved(itemId: string): Promise<void> {
    try {
      const errors = await this.getStoredErrors();
      const errorIndex = errors.findIndex(e => e.id === itemId);
      
      if (errorIndex >= 0) {
        errors[errorIndex].isResolved = true;
        const errorKey = await this.getUserErrorKey();
        await AsyncStorage.setItem(errorKey, JSON.stringify(errors));

        // 📊 TELEMETRY: Track resolution
        await trackAIInteraction(AIEventType.SYNC_ERROR_RESOLVED, {
          itemId,
          entity: errors[errorIndex].entity,
          type: errors[errorIndex].type,
          retryCount: errors[errorIndex].retryCount
        });
      }
    } catch (error) {
      console.error('❌ Failed to mark error as resolved:', error);
    }
  }

  /**
   * 🧹 Clean up old resolved errors
   */
  async cleanupResolvedErrors(olderThanDays: number = 7): Promise<number> {
    try {
      const errors = await this.getStoredErrors();
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      
      const filteredErrors = errors.filter(error => 
        !error.isResolved || error.timestamp > cutoffTime
      );
      
      const cleanedCount = errors.length - filteredErrors.length;
      
      if (cleanedCount > 0) {
        const errorKey = await this.getUserErrorKey();
        await AsyncStorage.setItem(errorKey, JSON.stringify(filteredErrors));
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup resolved errors:', error);
      return 0;
    }
  }

  /**
   * 📖 Get stored errors for current user
   */
  private async getStoredErrors(): Promise<SyncErrorDetails[]> {
    try {
      const errorKey = await this.getUserErrorKey();
      const stored = await AsyncStorage.getItem(errorKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored errors:', error);
      return [];
    }
  }

  /**
   * 🔄 Trigger manual sync retry
   */
  private async triggerManualSync(): Promise<void> {
    try {
      const { offlineSyncService } = await import('@/services/offlineSync');
      await offlineSyncService.processSyncQueue();
      
      // 📊 TELEMETRY: Track manual sync
      await trackAIInteraction(AIEventType.MANUAL_SYNC_TRIGGERED, {
        source: 'user_error_notification',
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
    }
  }

  /**
   * 🎯 Retry specific failed item
   */
  private async retrySpecificItem(itemId: string): Promise<void> {
    try {
      const { offlineSyncService } = await import('@/services/offlineSync');
      // Note: OfflineSyncService doesn't have a retry-specific-item method yet
      // For now, we'll trigger a full sync and hope it picks up the item
      await offlineSyncService.processSyncQueue();
      
      // 📊 TELEMETRY: Track specific retry
      await trackAIInteraction(AIEventType.SYNC_ITEM_RETRY, {
        itemId,
        source: 'user_error_notification',
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Specific item retry failed:', error);
    }
  }

  /**
   * 📋 Show detailed error information
   */
  private showErrorDetails(errors: SyncErrorDetails[]): void {
    const errorList = errors
      .slice(0, 5) // Show max 5 errors
      .map(error => `• ${error.userFriendlyMessage}`)
      .join('\n');
    
    Alert.alert(
      'Senkronizasyon Detayları',
      `Aşağıdaki veriler senkronize edilemiyor:\n\n${errorList}\n\n${errors.length > 5 ? `+${errors.length - 5} daha...` : ''}`,
      [
        { text: 'Hepsini Yeniden Dene', onPress: () => this.triggerManualSync() },
        { text: 'Tamam', style: 'cancel' }
      ]
    );
  }

  /**
   * 🏷️ Categorize error for telemetry
   */
  private categorizeError(technicalError: string): string {
    const error = technicalError.toLowerCase();
    if (error.includes('network') || error.includes('connection')) return 'network';
    if (error.includes('auth') || error.includes('unauthorized')) return 'auth';
    if (error.includes('quota') || error.includes('limit')) return 'quota';
    if (error.includes('validation') || error.includes('format')) return 'validation';
    if (error.includes('timeout')) return 'timeout';
    return 'unknown';
  }
}

export default OfflineSyncUserFeedbackService.getInstance();
