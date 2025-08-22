import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';

// Notification konfigürasyonu
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'reminder' | 'encouragement' | 'milestone' | 'daily_check';
  title: string;
  body: string;
  data?: any;
}

export class MessagingService {
  private static instance: MessagingService;

  public static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  // Alias for backward compatibility
  async initializeMessaging(): Promise<void> {
    return this.initialize();
  }

  async initialize(): Promise<void> {
    try {
      // Sadece native platformlarda çalış
      if (Platform.OS === 'web') {
        console.warn('Notifications not supported on web platform');
        return;
      }

      // Permission iste
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }

      // Push token al (sadece device'da)
      // Expo Go'da projectId gerekmiyor, development build'de gerçek ID kullanılır  
      try {
        const projectId = process.env.EXPO_PROJECT_ID || 'a477080d-4d3f-4edc-9c31-4a1076c0967b';
        
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: projectId
        });
        if (__DEV__) console.log('Push token obtained successfully:', token.data?.substring(0, 8) + '…');

        // Token'ı sakla
        const userId = await AsyncStorage.getItem('currentUserId');
        const key = `pushToken_${safeStorageKey(userId as any)}`;
        if (typeof token.data === 'string' && token.data.length > 0) {
          await AsyncStorage.setItem(key, token.data);
        }
      } catch (error: any) {
        console.log('Push token error (normal in Expo Go):', error.message);
        // Expo Go'da push token alamama normal, devam et
      }

    } catch (error) {
      console.error('Notification initialization failed:', error);
    }
  }

  async scheduleLocalNotification(
    notification: NotificationData,
    trigger: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return null;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: { ...notification.data, type: notification.type },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      return identifier;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  async scheduleDailyReminders(): Promise<void> {
    try {
      // Günlük hatırlatıcıları temizle
      await this.cancelNotificationsByType('reminder');

      // Sabah hatırlatıcısı (09:00)
      await this.scheduleLocalNotification(
        {
          type: 'reminder',
          title: 'Günaydın! 🌅',
          body: 'Bugünkü OCD takibinizi yapmayı unutmayın. Küçük adımlar büyük değişimler yaratır.',
        },
        {
          hour: 9,
          minute: 0,
          repeats: true,
        } as any
      );

      // Akşam hatırlatıcısı (20:00)
      await this.scheduleLocalNotification(
        {
          type: 'reminder',
          title: 'Günlük Değerlendirme Zamanı 📝',
          body: 'Bugünkü kompülsiyonlarınızı kaydetmeyi ve başarılarınızı kutlamayı unutmayın.',
        },
        {
          hour: 20,
          minute: 0,
          repeats: true,
        } as any
      );

      console.log('Daily reminders scheduled successfully');
    } catch (error) {
      console.error('Failed to schedule daily reminders:', error);
    }
  }

  async scheduleEncouragement(): Promise<void> {
    try {
      const encouragements = [
        'Her küçük ilerleme önemlidir! 💪',
        'Bugün harika gidiyorsun! Devam et! ⭐',
        'Zorluklarla mücadele etme gücün seni gururlandırmalı 🌟',
        'Sen bu yolculukta yalnız değilsin 🤝',
      ];

      const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

      // Rastgele bir zamanda teşvik mesajı
      const randomHour = Math.floor(Math.random() * 12) + 10; // 10-22 arası
      const randomMinute = Math.floor(Math.random() * 60);

      await this.scheduleLocalNotification(
        {
          type: 'encouragement',
          title: 'Motivasyon Zamanı! 🎯',
          body: randomEncouragement,
        },
        {
          hour: randomHour,
          minute: randomMinute,
          repeats: false,
        } as any
      );
    } catch (error) {
      console.error('Failed to schedule encouragement:', error);
    }
  }

  async cancelNotificationsByType(type: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === type) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  // Notification dinleyicileri
  addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  // NotificationContext için eksik metodlar
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return null;
      
      const projectId = process.env.EXPO_PROJECT_ID || 'a477080d-4d3f-4edc-9c31-4a1076c0967b';
      
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });
      return token.data;
    } catch (error) {
      console.log('Push token error (normal in Expo Go):', error);
      return null;
    }
  }

  async sendTherapyReminder(): Promise<void> {
    await this.scheduleLocalNotification(
      {
        type: 'reminder',
        title: 'ERP Egzersizi Zamanı! 💪',
        body: 'Planlanan ERP egzersiznizi yapmaya hazır mısınız?',
      },
      { seconds: 60 } as any
    );
  }

  async scheduleDailyReminder(hour: number = 20, minute: number = 0): Promise<void> {
    await this.scheduleLocalNotification(
      {
        type: 'reminder',
        title: 'Günlük Kontrol Zamanı 📝',
        body: 'Bugünkü ilerlemelerinizi kaydetmeyi unutmayın!',
      },
      {
        hour,
        minute,
        repeats: true,
      } as any
    );
  }

  async sendProgressMilestone(milestone: string): Promise<void> {
    await this.scheduleLocalNotification(
      {
        type: 'milestone',
        title: 'Tebrikler! 🎉',
        body: `${milestone} başarısını elde ettiniz!`,
      },
      { seconds: 5 } as any
    );
  }
}

export const messagingService = MessagingService.getInstance();