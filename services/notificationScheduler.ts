
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

export interface NotificationSchedule {
  id: string;
  type: 'daily_tracking' | 'motivation' | 'milestone' | 'daily_mood';
  title: string;
  body: string;
  scheduledTime: Date;
  isActive: boolean;
  frequency?: 'daily' | 'weekly' | 'custom';
}

export class NotificationScheduler {
  private static STORAGE_KEY = 'scheduledNotifications';

  // ERP reminders removed

  static async scheduleDailyTrackingReminder(time: Date): Promise<string> {
    // Skip notification scheduling in Expo Go (SDK 53+)
    if (isExpoGo) {
      console.log('⚠️ Push notifications are not supported in Expo Go with SDK 53+');
      return 'expo-go-mock-id';
    }
    
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Günlük Takip',
        body: 'Bugünkü ilerlemeni kaydetmeyi unutma!',
        data: { type: 'daily_tracking' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });

    await this.saveNotificationSchedule({
      id: identifier,
      type: 'daily_tracking',
      title: '📊 Günlük Takip',
      body: 'Bugünkü ilerlemeni kaydetmeyi unutma!',
      scheduledTime: time,
      isActive: true,
      frequency: 'daily'
    });

    return identifier;
  }

  static async scheduleDailyMoodReminder(time: Date): Promise<string> {
    // Skip notification scheduling in Expo Go (SDK 53+)
    if (isExpoGo) {
      console.log('⚠️ Push notifications are not supported in Expo Go with SDK 53+');
      return 'expo-go-mock-id';
    }
    
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌤️ Günlük Mood',
        body: 'Bugünkü ruh halini kaydetmeyi unutma.',
        data: { type: 'daily_mood' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: time.getHours(),
        minute: time.getMinutes(),
        repeats: true,
      } as Notifications.CalendarTriggerInput,
    });

    await this.saveNotificationSchedule({
      id: identifier,
      type: 'daily_mood',
      title: '🌤️ Günlük Mood',
      body: 'Bugünkü ruh halini kaydetmeyi unutma.',
      scheduledTime: time,
      isActive: true,
      frequency: 'daily'
    });

    return identifier;
  }

  static async scheduleMotivationalMessage(): Promise<string> {
    const messages = [
      'Sen güçlüsün! Her geçen gün daha da iyileşiyorsun. 💪',
      'Bugün kendine karşı nazik ol. İlerleme kaydediyorsun! 🌟',
      'Küçük adımlar büyük değişikliklere yol açar. 🚶‍♀️',
      'Zorluklar geçici, güçlülük kalıcıdır. 🌈'
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌟 Motivasyon',
        body: randomMessage,
        data: { type: 'motivation' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.floor(Math.random() * 86400), // Random time within 24 hours
        repeats: false,
      } as Notifications.TimeIntervalTriggerInput,
    });

    return identifier;
  }

  static async scheduleMilestoneNotification(milestone: string): Promise<string> {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Tebrikler!',
        body: `${milestone} başarısını unlocked ettiniz!`,
        data: { type: 'milestone', milestone },
      },
      trigger: null, // Immediate
    });

    return identifier;
  }

  static async getScheduledNotifications(): Promise<NotificationSchedule[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  static async saveNotificationSchedule(schedule: NotificationSchedule): Promise<void> {
    try {
      const existing = await this.getScheduledNotifications();
      const updated = [...existing, schedule];
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving notification schedule:', error);
    }
  }

  static async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
    
    try {
      const existing = await this.getScheduledNotifications();
      const updated = existing.filter(n => n.id !== id);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating notification schedules:', error);
    }
  }

  static async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }
}
