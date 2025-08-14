import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device'; // Removed - was causing app to hang
import { Alert, Platform } from 'react-native';
import { messagingService } from '@/services/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationContextType {
  isEnabled: boolean;
  fcmToken: string | null;
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<void>;
  scheduleERPReminder: () => Promise<void>;
  scheduleDailyReminder: (hour?: number, minute?: number) => Promise<void>;
  sendProgressMilestone: (milestone: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [dailyReminders, setDailyReminders] = useState<any[]>([]);

  useEffect(() => {
    // Web ortamında notification API'leri çalışmaz
    if (Platform.OS !== 'web') {
      initializeNotifications();
    }
    setupNotifications();
    loadNotificationSettings();
  }, []);

  const initializeNotifications = async () => {
    try {
      // Check if notifications were previously enabled (user-scoped)
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
      const prefKey = `notificationsEnabled_${safeUserId}`;
      const savedPreference = await AsyncStorage.getItem(prefKey);
      if (savedPreference === 'true') {
        await enableNotifications();
      }

      // Initialize messaging service
      await messagingService.initializeMessaging();

      // Add notification listeners
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        handleNotificationResponse(response);
      });

      return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
      };
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;

    // Handle navigation based on notification data
    if (data?.screen) {
      // This would be handled by navigation service
      console.log('Navigate to:', data.screen);
    }
  };

  const enableNotifications = async (): Promise<boolean> => {
    try {
      const hasPermission = await messagingService.requestPermissions();

      if (hasPermission) {
        const token = await messagingService.getFCMToken();
        setFcmToken(token);
        setIsEnabled(true);
        const currentUserId = await AsyncStorage.getItem('currentUserId');
        const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
        const prefKey = `notificationsEnabled_${safeUserId}`;
        await AsyncStorage.setItem(prefKey, 'true');

        // Schedule default daily reminder
        await scheduleDailyReminder();

        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      return false;
    }
  };

  const disableNotifications = async (): Promise<void> => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setIsEnabled(false);
      setFcmToken(null);
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
      const prefKey = `notificationsEnabled_${safeUserId}`;
      await AsyncStorage.setItem(prefKey, 'false');
    } catch (error) {
      console.error('Failed to disable notifications:', error);
    }
  };

  const scheduleERPReminder = async (): Promise<void> => {
    if (!isEnabled) return;
    await messagingService.sendERPReminder();
  };

  const scheduleDailyReminder = async (hour: number = 20, minute: number = 0): Promise<void> => {
    if (!isEnabled) return;
    await messagingService.scheduleDailyReminder(hour, minute);
  };

  const sendProgressMilestone = async (milestone: string): Promise<void> => {
    if (!isEnabled) return;
    await messagingService.sendProgressMilestone(milestone);
  };

  const setupNotifications = async () => {
    if (Platform.OS === 'web') return;

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationEnabled(status === 'granted');

      if (status === 'granted') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });

        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Hatırlatıcılar',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });
      }
    } catch (error) {
      console.error('Notification setup error:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
      const settingsKey = `notificationSettings_${safeUserId}`;
      const settings = await AsyncStorage.getItem(settingsKey);
      if (settings) {
        const parsed = JSON.parse(settings);
        setDailyReminders(parsed.dailyReminders || []);
      }
    } catch (error) {
      console.error('Load notification settings error:', error);
    }
  };

  const scheduleCompulsionReminder = async (time: string, enabled: boolean = true) => {
    if (!notificationEnabled || Platform.OS === 'web') return;

    try {
      const [hours, minutes] = time.split(':').map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Kompulsiyon Takibi 📝',
          body: 'Bugünkü kompulsiyonlarınızı kaydetmeyi unutmayın',
          sound: 'default',
          data: { type: 'compulsion_reminder' },
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

      const newReminder = {
        id: `compulsion_${hours}_${minutes}`,
        type: 'compulsion',
        time,
        enabled,
        title: 'Kompulsiyon Takibi'
      };

      const updatedReminders = [...dailyReminders.filter(r => r.id !== newReminder.id), newReminder];
      setDailyReminders(updatedReminders);

      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
      const settingsKey = `notificationSettings_${safeUserId}`;
      await AsyncStorage.setItem(settingsKey, JSON.stringify({
        dailyReminders: updatedReminders
      }));

    } catch (error) {
      console.error('Schedule compulsion reminder error:', error);
    }
  };

  const scheduleERPReminderInternal = async (exerciseName: string, time: string) => {
    if (!notificationEnabled || Platform.OS === 'web') return;

    try {
      const [hours, minutes] = time.split(':').map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'ERP Egzersizi 🧘‍♀️',
          body: `${exerciseName} egzersizini yapma zamanı`,
          sound: 'default',
          data: { type: 'erp_reminder', exerciseName },
        },
        trigger: {
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

    } catch (error) {
      console.error('Schedule ERP reminder error:', error);
    }
  };

  const sendMotivationalNotification = async () => {
    if (!notificationEnabled || Platform.OS === 'web') return;

    const motivationalMessages = [
      'Harika gidiyorsun! Kendine güven 💪',
      'Her küçük adım büyük bir başarı 🌟',
      'Bugün kendine karşı nazik ol ❤️',
      'İlerleme kaydediyorsun, devam et! 🚀',
      'Sen güçlüsün, bu da geçecek 🌈'
    ];

    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Günün Motivasyonu',
          body: randomMessage,
          sound: 'default',
          data: { type: 'motivation' },
        },
        trigger: {
          seconds: 2,
        },
      });
    } catch (error) {
      console.error('Send motivational notification error:', error);
    }
  };

  const cancelAllReminders = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setDailyReminders([]);
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const safeUserId = (typeof currentUserId === 'string' && currentUserId.length > 0) ? currentUserId : 'anon';
      const settingsKey = `notificationSettings_${safeUserId}`;
      await AsyncStorage.removeItem(settingsKey);
    } catch (error) {
      console.error('Cancel all reminders error:', error);
    }
  };

  const value: NotificationContextType = {
    isEnabled,
    fcmToken,
    enableNotifications,
    disableNotifications,
    scheduleERPReminder,
    scheduleDailyReminder,
    sendProgressMilestone,
  };

  const internalValue = {
    notificationEnabled,
    dailyReminders,
    scheduleCompulsionReminder,
    scheduleERPReminder: scheduleERPReminderInternal,
    sendMotivationalNotification,
    cancelAllReminders,
    setupNotifications
  };

  return (
    <NotificationContext.Provider value={internalValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};