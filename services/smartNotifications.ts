/**
 * Smart Notifications Service (AI-Free)
 * 
 * Deterministic daily reminders ve nudge rules.
 * Rule-based triggers, no AI analysis, privacy-first.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { MoodEntry } from '@/services/moodTrackingService';

interface NotificationRule {
  id: string;
  type: 'daily_reminder' | 'streak_recovery' | 'missed_day' | 'wellness_check';
  title: string;
  body: string;
  trigger: {
    hour: number;
    minute: number;
    repeats: boolean;
  };
  conditions?: {
    streakMin?: number;
    streakMax?: number;
    daysSinceLastEntry?: number;
    weekday?: number[]; // 0=Sunday, 6=Saturday
  };
  enabled: boolean;
}

interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: { hour: number; minute: number };
  streakRecoveryEnabled: boolean;
  wellnessCheckEnabled: boolean;
  weekendModeEnabled: boolean; // Different schedule for weekends
}

class SmartNotificationsService {
  private static instance: SmartNotificationsService;
  private settingsKey = 'notification_settings_v1';
  private scheduledKey = 'scheduled_notifications_v1';
  
  public static getInstance(): SmartNotificationsService {
    if (!SmartNotificationsService.instance) {
      SmartNotificationsService.instance = new SmartNotificationsService();
    }
    return SmartNotificationsService.instance;
  }

  /**
   * Initialize notification system
   */
  public async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        return false;
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false, // Soft, non-intrusive
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      console.log('✅ Smart notifications initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * Get default notification settings
   */
  private getDefaultSettings(): NotificationSettings {
    return {
      dailyReminderEnabled: true,
      dailyReminderTime: { hour: 20, minute: 0 }, // 8 PM default
      streakRecoveryEnabled: true,
      wellnessCheckEnabled: true,
      weekendModeEnabled: false
    };
  }

  /**
   * Get current notification settings
   */
  public async getSettings(): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem(this.settingsKey);
      if (stored) {
        return { ...this.getDefaultSettings(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to get notification settings:', error);
    }
    return this.getDefaultSettings();
  }

  /**
   * Update notification settings
   */
  public async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      
      await AsyncStorage.setItem(this.settingsKey, JSON.stringify(updated));
      
      // Re-schedule notifications with new settings
      await this.rescheduleNotifications();
      
      console.log('✅ Notification settings updated');
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  }

  /**
   * Generate deterministic notification rules
   */
  private generateNotificationRules(settings: NotificationSettings): NotificationRule[] {
    const rules: NotificationRule[] = [];

    // 1. Daily reminder (basic)
    if (settings.dailyReminderEnabled) {
      rules.push({
        id: 'daily-reminder',
        type: 'daily_reminder',
        title: 'Günlük Mood Check-in 🌟',
        body: 'Bugün nasıl hissettiğini kaydetme zamanı! Küçük adımlar büyük değişimler yaratır.',
        trigger: {
          hour: settings.dailyReminderTime.hour,
          minute: settings.dailyReminderTime.minute,
          repeats: true
        },
        enabled: true
      });
    }

    // 2. Streak recovery (missed 2+ days)
    if (settings.streakRecoveryEnabled) {
      rules.push({
        id: 'streak-recovery',
        type: 'streak_recovery',
        title: 'Mood Takibi Özlendi 💙',
        body: 'Birkaç gündür kayıt yapmadın. Kendine nazik davranarak tekrar başlayabilirsin.',
        trigger: {
          hour: settings.dailyReminderTime.hour + 1, // 1 hour after daily
          minute: 0,
          repeats: false
        },
        conditions: {
          daysSinceLastEntry: 2
        },
        enabled: true
      });
    }

    // 3. Wellness check (weekly)
    if (settings.wellnessCheckEnabled) {
      rules.push({
        id: 'wellness-check',
        type: 'wellness_check',
        title: 'Haftalık İyilik Kontrolü 🌱', 
        body: 'Bu hafta mood takibinde nasıl gittin? Küçük başarıların da değerli!',
        trigger: {
          hour: 10, // Sunday morning
          minute: 0,
          repeats: true
        },
        conditions: {
          weekday: [0] // Sunday only
        },
        enabled: true
      });
    }

    // 4. Gentle nudge (missed yesterday)
    rules.push({
      id: 'gentle-nudge',
      type: 'missed_day',
      title: 'Yumuşak Hatırlatma 🕊️',
      body: 'Dün kayıt yapmamıştın. Bugün için kısa bir check-in yapmaya ne dersin?',
      trigger: {
        hour: settings.dailyReminderTime.hour,
        minute: settings.dailyReminderTime.minute + 30,
        repeats: false
      },
      conditions: {
        daysSinceLastEntry: 1
      },
      enabled: settings.dailyReminderEnabled
    });

    return rules;
  }

  /**
   * Check if notification conditions are met
   */
  private async checkNotificationConditions(
    rule: NotificationRule, 
    userId: string
  ): Promise<boolean> {
    try {
      if (!rule.conditions) return true;

      // Get recent mood entries for condition checking
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => key.startsWith(`mood_entries_${userId}_`));
      
      let lastEntryDate: Date | null = null;
      
      // Find most recent entry
      for (const key of moodKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entries = JSON.parse(data);
            const plainEntries = Array.isArray(entries) ? 
              entries.map((e: any) => e.metadata || e) : [];
            
            for (const entry of plainEntries) {
              const entryDate = new Date(entry.timestamp);
              if (!lastEntryDate || entryDate > lastEntryDate) {
                lastEntryDate = entryDate;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to check entries in key ${key}:`, error);
        }
      }

      // Check days since last entry condition
      if (rule.conditions.daysSinceLastEntry && lastEntryDate) {
        const daysSince = Math.floor((Date.now() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince < rule.conditions.daysSinceLastEntry) {
          return false; // Condition not met
        }
      }

      // Check weekday condition
      if (rule.conditions.weekday) {
        const currentWeekday = new Date().getDay();
        if (!rule.conditions.weekday.includes(currentWeekday)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to check notification conditions:', error);
      return false;
    }
  }

  /**
   * Schedule all notifications
   */
  public async rescheduleNotifications(userId?: string): Promise<void> {
    try {
      // Cancel existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      if (!userId) {
        console.log('ℹ️ No user ID provided, notifications cleared');
        return;
      }

      const settings = await this.getSettings();
      const rules = this.generateNotificationRules(settings);
      
      let scheduledCount = 0;

      for (const rule of rules) {
        if (!rule.enabled) continue;

        // Check conditions before scheduling
        const conditionsMet = await this.checkNotificationConditions(rule, userId);
        if (!conditionsMet) continue;

        try {
          // Schedule notification
          const trigger = rule.trigger.repeats 
            ? { 
                hour: rule.trigger.hour,
                minute: rule.trigger.minute,
                repeats: true
              }
            : {
                hour: rule.trigger.hour,
                minute: rule.trigger.minute,
                repeats: false
              };

          await Notifications.scheduleNotificationAsync({
            content: {
              title: rule.title,
              body: rule.body,
              sound: false, // Gentle, non-intrusive
              priority: Notifications.AndroidNotificationPriority.DEFAULT,
            },
            trigger: trigger as any
          });

          scheduledCount++;
          console.log(`✅ Scheduled notification: ${rule.id}`);
        } catch (error) {
          console.warn(`Failed to schedule notification ${rule.id}:`, error);
        }
      }

      // Store scheduled info
      await AsyncStorage.setItem(this.scheduledKey, JSON.stringify({
        userId,
        scheduledAt: new Date().toISOString(),
        count: scheduledCount,
        rules: rules.filter(r => r.enabled).map(r => r.id)
      }));

      console.log(`✅ ${scheduledCount} notifications scheduled for user ${userId.slice(0, 8)}...`);
    } catch (error) {
      console.error('Failed to reschedule notifications:', error);
    }
  }

  /**
   * Get notification status for debug
   */
  public async getNotificationStatus(): Promise<{
    permissionGranted: boolean;
    scheduledCount: number;
    lastScheduled?: string;
    nextNotifications: any[];
  }> {
    try {
      const permission = await Notifications.getPermissionsAsync();
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      const scheduledInfo = await AsyncStorage.getItem(this.scheduledKey);
      const lastScheduled = scheduledInfo ? JSON.parse(scheduledInfo).scheduledAt : undefined;

      return {
        permissionGranted: permission.granted,
        scheduledCount: scheduled.length,
        lastScheduled,
        nextNotifications: scheduled.slice(0, 3) // Show next 3
      };
    } catch (error) {
      console.error('Failed to get notification status:', error);
      return {
        permissionGranted: false,
        scheduledCount: 0,
        nextNotifications: []
      };
    }
  }

  /**
   * Handle notification received (for analytics)
   */
  public async handleNotificationReceived(notificationId: string): Promise<void> {
    try {
      // Simple tracking without AI telemetry
      const received = await AsyncStorage.getItem('notifications_received') || '[]';
      const list = JSON.parse(received);
      
      list.push({
        id: notificationId,
        receivedAt: new Date().toISOString()
      });

      // Keep last 10 notifications
      const recent = list.slice(-10);
      await AsyncStorage.setItem('notifications_received', JSON.stringify(recent));
      
      console.log('📱 Notification received:', notificationId);
    } catch (error) {
      console.warn('Failed to track notification:', error);
    }
  }

  /**
   * Clear all notifications and settings
   */
  public async clearAll(): Promise<void> {
    try {
      await Promise.all([
        Notifications.cancelAllScheduledNotificationsAsync(),
        AsyncStorage.removeItem(this.settingsKey),
        AsyncStorage.removeItem(this.scheduledKey),
        AsyncStorage.removeItem('notifications_received')
      ]);
      
      console.log('🗑️ All notifications cleared');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
}

export const smartNotifications = SmartNotificationsService.getInstance();
export default smartNotifications;
