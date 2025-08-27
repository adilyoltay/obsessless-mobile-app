/**
 * 🚨 ONBOARDING SYNC ERROR SERVICE
 * 
 * Provides comprehensive error handling, user notifications, and retry mechanisms
 * for onboarding sync failures, ensuring data integrity and user awareness.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

export interface OnboardingSyncError {
  id: string;
  userId: string;
  errorType: 'queue_failed' | 'supabase_failed' | 'network_failed' | 'unknown';
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  errorMessage: string;
  contextData?: {
    profileSize?: number;
    networkStatus?: string;
    lastSuccessfulSync?: string;
  };
  resolved: boolean;
  userNotified: boolean;
  nextRetryAt?: string;
}

export interface OnboardingSyncRetryOptions {
  immediate?: boolean;
  delay?: number;
  showNotification?: boolean;
  showAlert?: boolean;
  persistError?: boolean;
}

/**
 * 🔄 ONBOARDING SYNC ERROR SERVICE
 * Handles persistent error tracking and user-friendly retry mechanisms
 */
export class OnboardingSyncErrorService {
  private static instance: OnboardingSyncErrorService;
  
  private readonly STORAGE_KEY = 'onboarding_sync_errors';
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BASE_RETRY_DELAY = 30000; // 30 seconds
  
  static getInstance(): OnboardingSyncErrorService {
    if (!OnboardingSyncErrorService.instance) {
      OnboardingSyncErrorService.instance = new OnboardingSyncErrorService();
    }
    return OnboardingSyncErrorService.instance;
  }

  /**
   * 🚨 TRACK SYNC ERROR: Record and notify user about onboarding sync failure
   */
  async trackSyncError(
    userId: string, 
    errorType: OnboardingSyncError['errorType'], 
    errorMessage: string,
    options: OnboardingSyncRetryOptions = {}
  ): Promise<string> {
    const errorId = `onb_sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const syncError: OnboardingSyncError = {
      id: errorId,
      userId,
      errorType,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.MAX_RETRY_ATTEMPTS,
      errorMessage,
      contextData: await this.gatherContextData(),
      resolved: false,
      userNotified: false,
      nextRetryAt: new Date(Date.now() + this.BASE_RETRY_DELAY).toISOString()
    };

    // 💾 PERSIST ERROR: Store for later retry and user notification
    if (options.persistError !== false) {
      await this.storeError(syncError);
    }

    // 🔔 IMMEDIATE USER NOTIFICATION: Alert user about sync issue
    if (options.showAlert) {
      this.showImmediateAlert(syncError);
    }

    if (options.showNotification) {
      await this.showPersistentNotification(syncError);
    }

    // 🔄 SCHEDULE RETRY: If immediate retry requested
    if (options.immediate) {
      setTimeout(() => {
        this.attemptRetry(errorId);
      }, options.delay || 5000);
    }

    console.log(`🚨 Onboarding sync error tracked: ${errorId}`, {
      type: errorType,
      message: errorMessage,
      retryScheduled: options.immediate
    });

    return errorId;
  }

  /**
   * 🔔 SHOW IMMEDIATE ALERT: User-friendly error alert with actions
   */
  private showImmediateAlert(error: OnboardingSyncError): void {
    const { title, message, actions } = this.getErrorAlertContent(error);

    Alert.alert(
      title,
      message,
      [
        { 
          text: 'Şimdi Tekrar Dene', 
          onPress: () => this.attemptRetry(error.id, true),
          style: 'default' 
        },
        { 
          text: 'Sonra Dene', 
          onPress: () => this.scheduleRetry(error.id),
          style: 'cancel' 
        },
        { 
          text: 'Detaylar', 
          onPress: () => this.showErrorDetails(error),
          style: 'destructive' 
        }
      ],
      { cancelable: false }
    );
  }

  /**
   * 📱 SHOW PERSISTENT NOTIFICATION: Background notification for user awareness
   */
  private async showPersistentNotification(error: OnboardingSyncError): Promise<void> {
    try {
      const { title, body } = this.getNotificationContent(error);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'onboarding_sync_error',
          data: { errorId: error.id, userId: error.userId }
        },
        trigger: null // Immediate notification
      });

      // Mark as notified
      await this.markUserNotified(error.id);
      
    } catch (notificationError) {
      console.warn('Failed to show onboarding sync notification:', notificationError);
    }
  }

  /**
   * 🔄 ATTEMPT RETRY: Try syncing again with updated retry count
   */
  async attemptRetry(errorId: string, immediate: boolean = false): Promise<boolean> {
    try {
      const errors = await this.getStoredErrors();
      const error = errors.find(e => e.id === errorId);
      
      if (!error || error.resolved || error.retryCount >= error.maxRetries) {
        console.log(`⚠️ Cannot retry error ${errorId}: ${!error ? 'not found' : error.resolved ? 'already resolved' : 'max retries exceeded'}`);
        return false;
      }

      console.log(`🔄 Attempting retry ${error.retryCount + 1}/${error.maxRetries} for error ${errorId}`);
      
      // Update retry count
      error.retryCount++;
      error.nextRetryAt = new Date(Date.now() + (this.BASE_RETRY_DELAY * Math.pow(2, error.retryCount))).toISOString();
      
      // Try to resolve the error based on type
      const success = await this.resolveError(error);
      
      if (success) {
        // 🎉 SUCCESS: Mark as resolved and notify user
        error.resolved = true;
        await this.showSuccessNotification(error);
        console.log(`✅ Onboarding sync error resolved: ${errorId}`);
      } else {
        // ❌ FAILED: Schedule next retry if attempts remain
        if (error.retryCount < error.maxRetries) {
          if (!immediate) {
            setTimeout(() => this.attemptRetry(errorId), this.BASE_RETRY_DELAY * Math.pow(2, error.retryCount));
          }
        } else {
          // Max retries reached - notify user of permanent failure
          await this.showMaxRetriesNotification(error);
        }
      }
      
      // Update stored error
      await this.updateStoredError(error);
      return success;
      
    } catch (retryError) {
      console.error(`❌ Retry attempt failed for ${errorId}:`, retryError);
      return false;
    }
  }

  /**
   * 🛠️ RESOLVE ERROR: Actually perform the sync retry based on error type
   */
  private async resolveError(error: OnboardingSyncError): Promise<boolean> {
    try {
      switch (error.errorType) {
        case 'queue_failed':
          // Retry adding to offline queue
          return await this.retryOfflineQueue(error);
        
        case 'supabase_failed':
          // Retry direct Supabase sync
          return await this.retrySupabaseSync(error);
          
        case 'network_failed':
          // Check network and retry appropriate sync
          return await this.retryNetworkDependentSync(error);
          
        default:
          // Generic retry - try both queue and sync
          const queueSuccess = await this.retryOfflineQueue(error);
          const supabaseSuccess = await this.retrySupabaseSync(error);
          return queueSuccess || supabaseSuccess;
      }
    } catch (error) {
      console.error('Error resolution failed:', error);
      return false;
    }
  }

  /**
   * 🔄 RETRY OFFLINE QUEUE: Attempt to add profile to sync queue again
   */
  private async retryOfflineQueue(error: OnboardingSyncError): Promise<boolean> {
    try {
      // Get stored profile data
      const profileKey = `profile_v2_payload`;
      const profileData = await AsyncStorage.getItem(profileKey);
      
      if (!profileData) {
        console.warn('No profile data found for queue retry');
        return false;
      }

      const { offlineSyncService } = await import('@/services/offlineSync');
      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity: 'user_profile',
        data: { payload: JSON.parse(profileData), userId: error.userId },
        priority: 'critical' as any,
      });

      console.log('✅ Profile successfully re-queued for offline sync');
      return true;
      
    } catch (queueError) {
      console.error('Offline queue retry failed:', queueError);
      return false;
    }
  }

  /**
   * 🌐 RETRY SUPABASE SYNC: Attempt direct Supabase profile sync
   */
  private async retrySupabaseSync(error: OnboardingSyncError): Promise<boolean> {
    try {
      const { useMoodOnboardingStore } = await import('@/store/moodOnboardingStore');
      const store = useMoodOnboardingStore.getState();
      
      await store.syncToSupabase(error.userId);
      console.log('✅ Supabase profile sync retry successful');
      return true;
      
    } catch (syncError) {
      console.error('Supabase sync retry failed:', syncError);
      return false;
    }
  }

  /**
   * 📡 RETRY NETWORK DEPENDENT SYNC: Check network and attempt appropriate sync
   */
  private async retryNetworkDependentSync(error: OnboardingSyncError): Promise<boolean> {
    try {
      const NetInfo = await import('@react-native-community/netinfo');
      const netState = await NetInfo.default.fetch();
      
      if (netState.isConnected && netState.isInternetReachable !== false) {
        // Network is available - try Supabase sync
        return await this.retrySupabaseSync(error);
      } else {
        // Network still unavailable - ensure offline queue
        return await this.retryOfflineQueue(error);
      }
    } catch (networkError) {
      console.error('Network-dependent sync retry failed:', networkError);
      return false;
    }
  }

  /**
   * 🎉 SUCCESS NOTIFICATION: Inform user that sync succeeded
   */
  private async showSuccessNotification(error: OnboardingSyncError): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Onboarding Tamamlandı!',
          body: 'Profilin başarıyla kaydedildi. Tüm özellikler şimdi kullanılabilir.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          categoryIdentifier: 'onboarding_sync_success'
        },
        trigger: null
      });
    } catch (error) {
      console.warn('Failed to show success notification:', error);
    }
  }

  /**
   * ⚠️ MAX RETRIES NOTIFICATION: Inform user of permanent sync failure
   */
  private async showMaxRetriesNotification(error: OnboardingSyncError): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Senkronizasyon Sorunu',
          body: 'Profil senkronizasyonu başarısız oldu. Ayarlar > Senkronizasyon\'dan manuel olarak tekrar deneyebilirsin.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'onboarding_sync_permanent_failure',
          data: { errorId: error.id }
        },
        trigger: null
      });
    } catch (error) {
      console.warn('Failed to show max retries notification:', error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async gatherContextData(): Promise<OnboardingSyncError['contextData']> {
    try {
      const NetInfo = await import('@react-native-community/netinfo');
      const netState = await NetInfo.default.fetch();
      
      return {
        networkStatus: `connected: ${netState.isConnected}, reachable: ${netState.isInternetReachable}`,
        lastSuccessfulSync: await AsyncStorage.getItem('last_profile_sync') || 'never'
      };
    } catch (error) {
      return {
        networkStatus: 'unknown',
        lastSuccessfulSync: 'unknown'
      };
    }
  }

  private getErrorAlertContent(error: OnboardingSyncError): { title: string, message: string, actions: string[] } {
    switch (error.errorType) {
      case 'queue_failed':
        return {
          title: '📱 Veri Saklama Sorunu',
          message: 'Profilin geçici olarak kaydedilemedi. Bu durumda veriler kaybolabilir.',
          actions: ['Şimdi Tekrar Dene', 'Sonra Dene', 'Detaylar']
        };
      case 'supabase_failed':
        return {
          title: '🌐 Senkronizasyon Sorunu', 
          message: 'Profil verilerinin sunucuya gönderilmesi başarısız oldu. Ağ bağlantınızı kontrol edin.',
          actions: ['Şimdi Tekrar Dene', 'Sonra Dene', 'Detaylar']
        };
      case 'network_failed':
        return {
          title: '📡 Bağlantı Sorunu',
          message: 'İnternet bağlantısı bulunamadı. Profil çevrimiçi olduğunuzda senkronize edilecek.',
          actions: ['Bağlantıyı Kontrol Et', 'Sonra Dene', 'Detaylar']
        };
      default:
        return {
          title: '⚠️ Kaydetme Hatası',
          message: 'Profil kaydetme sırasında beklenmedik bir hata oluştu.',
          actions: ['Tekrar Dene', 'Sonra Dene', 'Detaylar']
        };
    }
  }

  private getNotificationContent(error: OnboardingSyncError): { title: string, body: string } {
    const retry = error.retryCount > 0 ? ` (Deneme ${error.retryCount})` : '';
    
    switch (error.errorType) {
      case 'queue_failed':
        return {
          title: '📱 Profil Kayıt Sorunu' + retry,
          body: 'Onboarding verilerinin kaydedilmesi başarısız oldu. Tekrar denemek için dokunun.'
        };
      case 'supabase_failed':
        return {
          title: '🌐 Senkronizasyon Sorunu' + retry,
          body: 'Profil verilerinin senkronizasyonu başarısız oldu. Ağ bağlantınızı kontrol edin.'
        };
      case 'network_failed':
        return {
          title: '📡 Bağlantı Sorunu' + retry,
          body: 'İnternet bağlantısı gerekli. Bağlantı sağlandığında otomatik denenir.'
        };
      default:
        return {
          title: '⚠️ Onboarding Kayıt Hatası' + retry,
          body: 'Profil bilgileri kaydedilirken sorun yaşandı. Tekrar denemek için dokunun.'
        };
    }
  }

  private async storeError(error: OnboardingSyncError): Promise<void> {
    try {
      const errors = await this.getStoredErrors();
      errors.push(error);
      
      // Keep only last 10 errors per user
      const filteredErrors = errors
        .filter(e => e.userId === error.userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredErrors));
    } catch (error) {
      console.error('Failed to store sync error:', error);
    }
  }

  private async getStoredErrors(): Promise<OnboardingSyncError[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored errors:', error);
      return [];
    }
  }

  private async updateStoredError(updatedError: OnboardingSyncError): Promise<void> {
    try {
      const errors = await this.getStoredErrors();
      const index = errors.findIndex(e => e.id === updatedError.id);
      
      if (index >= 0) {
        errors[index] = updatedError;
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(errors));
      }
    } catch (error) {
      console.error('Failed to update stored error:', error);
    }
  }

  private async markUserNotified(errorId: string): Promise<void> {
    try {
      const errors = await this.getStoredErrors();
      const error = errors.find(e => e.id === errorId);
      
      if (error) {
        error.userNotified = true;
        await this.updateStoredError(error);
      }
    } catch (error) {
      console.error('Failed to mark user as notified:', error);
    }
  }

  private async scheduleRetry(errorId: string): Promise<void> {
    setTimeout(() => {
      this.attemptRetry(errorId);
    }, this.BASE_RETRY_DELAY);
  }

  private showErrorDetails(error: OnboardingSyncError): void {
    Alert.alert(
      '🔍 Hata Detayları',
      `Hata ID: ${error.id}\nTip: ${error.errorType}\nZaman: ${new Date(error.timestamp).toLocaleString('tr-TR')}\nDeneme: ${error.retryCount}/${error.maxRetries}\nMesaj: ${error.errorMessage}\n\nAğ: ${error.contextData?.networkStatus || 'bilinmiyor'}`,
      [{ text: 'Tamam' }]
    );
  }

  /**
   * 📋 PUBLIC: Get unresolved errors for user
   */
  async getUnresolvedErrors(userId: string): Promise<OnboardingSyncError[]> {
    const errors = await this.getStoredErrors();
    return errors.filter(e => e.userId === userId && !e.resolved);
  }

  /**
   * 🧹 PUBLIC: Cleanup resolved errors
   */
  async cleanupResolvedErrors(): Promise<void> {
    try {
      const errors = await this.getStoredErrors();
      const unresolvedErrors = errors.filter(e => !e.resolved);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(unresolvedErrors));
    } catch (error) {
      console.error('Failed to cleanup resolved errors:', error);
    }
  }
}

export const onboardingSyncErrorService = OnboardingSyncErrorService.getInstance();
