import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Alert,
  Share,
  Linking
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom UI Components
import { Switch } from '@/components/ui/Switch';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Colors } from '@/constants/Colors';

import Button from '@/components/ui/Button';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useGamificationStore } from '@/store/gamificationStore';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import { NotificationScheduler } from '@/services/notificationScheduler';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { PanResponder, PanResponderGestureState, GestureResponderEvent } from 'react-native';

// Stores

// AI imports removed - AI disabled


// Storage utility
import { StorageKeys } from '@/utils/storage';



import { Modal } from 'react-native';
import { unifiedComplianceService } from '@/services/unifiedComplianceService';
import { useTheme } from '@/contexts/ThemeContext';

// Removed: advanced onboarding/sync components
// performanceMetricsService import removed - performance summary section removed
// Settings data structure
type ColorMode = 'static' | 'today' | 'weekly';

interface SettingsData {
  notifications: boolean;
  biometric: boolean;
  reminderTimes: boolean;
  // weeklyReports removed - not implemented in UI
  colorMode?: ColorMode;
}



// Constants removed - unused

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  // Dil seçimi kaldırıldı; uygulama sistem dilini otomatik kullanır
  const { user, signOut, profile: authProfile } = useAuth();
  const { profile: gameProfile } = useGamificationStore();
  const onboardingPayload = useMoodOnboardingStore(s => s.payload);
  const setOnboardingReminders = useMoodOnboardingStore(s => s.setReminders);

  // Reminder time modal state
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const initialTime = (() => {
    const t = onboardingPayload?.reminders?.time;
    if (typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)) return t;
    return '09:00';
  })();
  const [remHour, setRemHour] = useState<number>(parseInt(initialTime.split(':')[0] || '9', 10));
  const [remMinute, setRemMinute] = useState<number>(parseInt(initialTime.split(':')[1] || '0', 10));
  const [reminderDaysModalVisible, setReminderDaysModalVisible] = useState(false);
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;
  const displayDay = (d: string) => ({Sun:'Paz',Mon:'Pzt',Tue:'Sal',Wed:'Çar',Thu:'Per',Fri:'Cum',Sat:'Cmt'} as any)[d] || d;
  const selectedDaysInit: string[] = Array.isArray(onboardingPayload?.reminders?.days) ? onboardingPayload!.reminders!.days as any : ['Mon','Tue','Wed','Thu','Fri'];
  const [selectedDays, setSelectedDays] = useState<string[]>(selectedDaysInit);
  // Log level & maintenance
  // Log level state removed along with advanced options
  // const aiStore = useAISettingsStore(); // REMOVED (AI disabled)

  

  const [consents, setConsents] = useState<Record<string, boolean>>({
    data_processing: true,
    analytics: true,
    ai_processing: true,
    marketing: false,
  });
  // Audit log state removed
  const [migrationVersion, setMigrationVersion] = useState<number>(0);
  // Daily metrics removed - performance summary section removed
  const [deletionStatus, setDeletionStatus] = useState<{ status: 'none' | 'pending' | 'grace_period' | 'scheduled'; requestedAt?: string; scheduledAt?: string; remainingDays?: number; canCancel?: boolean }>({ status: 'none' });
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  // Advanced section state removed
  
  const [settings, setSettings] = useState<SettingsData>({
    notifications: true,
    biometric: false,
    reminderTimes: false,
    colorMode: 'today',
  });

  // Swipe right to navigate back to Today
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        return dx > 20 && dx > dy; // horizontal dominant
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > 60 && Math.abs(gesture.vx) > 0.2) {
          router.push('/(tabs)/index' as any);
        }
      },
    })
  ).current;

  // AI Limit States - REMOVED (AI disabled)
  // const [aiLimitInfo, setAiLimitInfo] = useState<AILimitInfo | null>(null);
  // const [aiLimitSettings, setAiLimitSettings] = useState<AILimitSettings>({});
  // const [aiLimitLoading, setAiLimitLoading] = useState(false);

  // AI Onboarding state removed - no longer needed
  // Treatment Plan removed - moved to OCD Dashboard Assessment tab

  useEffect(() => {
    loadSettings();
    loadConsents();
    loadMigrationAndMetrics();
    // loadAILimitInfo() - DISABLED (AI disabled)
  }, [user?.id]);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(StorageKeys.SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          notifications: parsed.notifications ?? true,
          biometric: parsed.biometric ?? false,
          reminderTimes: parsed.reminderTimes ?? false,
          colorMode: (parsed.colorMode as ColorMode) ?? 'today',
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // AI Limit Functions - COMMENTED OUT (AI disabled)
  /*
  const loadAILimitInfo = async () => {
    if (!user?.id) return;
    
    try {
      setAiLimitLoading(true);
      const [limitInfo, limitSettings] = await Promise.all([
        aiLimitService.getAILimitInfo(user.id),
        aiLimitService.getAILimitSettings(user.id)
      ]);
      
      setAiLimitInfo(limitInfo);
      setAiLimitSettings(limitSettings);
    } catch (error) {
      console.error('Error loading AI limit info:', error);
    } finally {
      setAiLimitLoading(false);
    }
  };

  const handleAILimitSettingChange = async (key: keyof AILimitSettings, value: any) => {
    if (!user?.id) return;
    
    try {
      const updatedSettings = { ...aiLimitSettings, [key]: value };
      setAiLimitSettings(updatedSettings);
      
      await aiLimitService.updateAILimitSettings(user.id, { [key]: value });
      
      // Reload AI limit info to reflect changes
      const newLimitInfo = await aiLimitService.getAILimitInfo(user.id);
      setAiLimitInfo(newLimitInfo);
      
      console.log(`✅ AI limit setting updated: ${key} = ${value}`);
    } catch (error) {
      console.error('Failed to update AI limit setting:', error);
      // Revert on error
      setAiLimitSettings(aiLimitSettings);
    }
  };
  */

  // handleResetDailyUsage - COMMENTED OUT (AI disabled)
  /*
  const handleResetDailyUsage = async () => {
    if (!user?.id) return;
    
    Alert.alert(
      'Günlük Kullanımı Sıfırla',
      'Bugünkü AI analiz kullanımını sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              await aiLimitService.resetDailyUsage(user.id);
              await loadAILimitInfo(); // Reload to show reset values
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Failed to reset daily usage:', error);
              Alert.alert('Hata', 'Günlük kullanım sıfırlanamadı. Tekrar deneyin.');
            }
          }
        }
      ]
    );
  };
  */

  const loadConsents = async () => {
    try {
      if (!user?.id) return;
      const c = await unifiedComplianceService.getConsents(user.id);
      setConsents(c);
      const ds = await unifiedComplianceService.getDeletionStatus(user.id);
      setDeletionStatus(ds);
      const ch = await unifiedComplianceService.getConsentHistory(user.id, 180);
      setConsentHistory(ch);
    } catch {}
  };

  // loadAIOnboardingStatus function removed - no longer needed

  const loadMigrationAndMetrics = async () => {
    try {
      const vRaw = await AsyncStorage.getItem('secure_storage_migration_version');
      setMigrationVersion(vRaw ? parseInt(vRaw, 10) : 0);
      // Daily metrics loading removed - performance summary section removed
    } catch {}
  };



  // handleContinueAIOnboarding function removed - AI onboarding section removed

  const updateSetting = async (key: keyof SettingsData, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(newSettings));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Apply side-effects for specific settings
      if (key === 'notifications') {
        await applyNotificationSetting(newSettings.notifications, newSettings.reminderTimes);
      } else if (key === 'reminderTimes') {
        await applyNotificationSetting(newSettings.notifications, newSettings.reminderTimes);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateColorMode = async (mode: ColorMode) => {
    const newSettings = { ...settings, colorMode: mode };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(newSettings));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error saving color mode:', error);
    }
  };

  // Dil değişimi devre dışı

  const handleSignOut = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  // Dev tools removed from Settings

  // Removed data export handlers

  const toggleConsent = async (type: 'data_processing' | 'analytics' | 'ai_processing' | 'marketing', value: boolean) => {
    try {
      if (!user?.id) return;
      await unifiedComplianceService.recordConsent(user.id, type, value);
      setConsents(prev => ({ ...prev, [type]: value }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleDeletionRequest = async () => {
    Alert.alert(
      'Veri Silme Talebi',
      'Hesabınızdaki tüm veriler 30 gün sonra kalıcı olarak silinecek şekilde işaretlenecek. Devam edilsin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Onayla', style: 'destructive', onPress: async () => {
          try {
            if (!user?.id) return;
            await unifiedComplianceService.initiateDataDeletion(user.id);
            Alert.alert('Talep Alındı', 'Silme talebiniz alındı. 30 gün sonra kalıcı silme planlandı.');
          } catch {
            Alert.alert('Hata', 'İşlem tamamlanamadı.');
          }
        }}
      ]
    );
  };

  // Removed audit logs handler

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'ObsessLess - OKB ile başa çıkmanızda size yardımcı olan uygulama. İndirin: https://obsessless.app',
        title: 'ObsessLess Uygulamasını Paylaş'
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://obsessless.app/privacy');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://obsessless.app/terms');
  };

  const renderProfileSection = () => (
    <View style={styles.profileSection}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.email || 'Kullanıcı'}</Text>
            <Text style={styles.profileEmail}>Üye: {new Date(user?.created_at || Date.now()).toLocaleDateString('tr-TR')}</Text>
          </View>
        </View>
        
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <MaterialCommunityIcons name="fire" size={16} color="#EF4444" />
            <Text style={styles.profileStatText}>{gameProfile?.streakCurrent || 0} gün</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <MaterialCommunityIcons name="trophy" size={16} color="#10B981" />
            <Text style={styles.profileStatText}>{getLevelName(gameProfile?.healingPointsTotal || 0)}</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
            <Text style={styles.profileStatText}>{gameProfile?.healingPointsTotal || 0} puan</Text>
          </View>
        </View>
      </View>
    </View>
  );



  const renderSettingItem = (
    title: string,
    icon: string,
    value: boolean,
    onToggle: (value: boolean) => void
  ) => (
    <View style={styles.settingItem} accessibilityRole="switch" accessibilityLabel={title}>
      <View style={styles.settingLeft}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#6B7280" />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
      />
    </View>
  );

  const renderAILimitsSection = () => {
    // AI Limits completely disabled - returning null
    return null;
  };

  const renderActionItem = (
    title: string,
    icon: string,
    onPress: () => void,
    danger = false
  ) => (
    <Pressable 
      style={({ pressed }) => [
        styles.actionItem,
        pressed && styles.actionItemPressed
      ]} 
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.actionLeft}>
        <MaterialCommunityIcons 
          name={icon as any} 
          size={24} 
          color={danger ? '#EF4444' : '#6B7280'} 
        />
        <Text style={[styles.actionTitle, danger && styles.dangerText]}>
          {title}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
    </Pressable>
  );

  // Dil bölümü kaldırıldı

  // Compute level name similar to Today milestones
  const getLevelName = (points: number) => {
    const milestones = [
      { points: 100, name: 'Başlangıç' },
      { points: 500, name: 'Öğrenci' },
      { points: 1000, name: 'Usta' },
      { points: 2500, name: 'Uzman' },
      { points: 5000, name: 'Kahraman' }
    ];
    let current = milestones[0].name;
    for (const m of milestones) {
      if (points >= m.points) current = m.name;
    }
    return current;
  };

  // Apply notification scheduling based on toggles
  const applyNotificationSetting = async (enabled: boolean, useSpecificTime: boolean, explicitTime?: string, explicitDays?: string[]) => {
    try {
      if (!enabled) {
        // Cancel daily mood notifications only
        const scheduled = await NotificationScheduler.getScheduledNotifications();
        const moodIds = scheduled.filter(n => n.type === 'daily_mood').map(n => n.id);
        for (const id of moodIds) {
          await NotificationScheduler.cancelNotification(id);
        }
        return;
      }

      // Determine time: onboarding time or default 09:00
      let hour = 9, minute = 0;
      const timeStr = explicitTime || onboardingPayload?.reminders?.time;
      if (useSpecificTime && typeof timeStr === 'string' && /^\d{2}:\d{2}$/.test(timeStr)) {
        const [h, m] = timeStr.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) { hour = h; minute = m; }
      }
      const days = explicitDays ?? (onboardingPayload?.reminders?.days as any);
      // Cancel existing mood notifications to avoid duplicates
      const existing = await NotificationScheduler.getScheduledNotifications();
      const existingMood = existing.filter(n => n.type === 'daily_mood');
      for (const n of existingMood) { await NotificationScheduler.cancelNotification(n.id); }

      if (Array.isArray(days) && days.length > 0) {
        // Map day names to weekday numbers (Sun=1 .. Sat=7)
        const map: any = {Sun:1,Mon:2,Tue:3,Wed:4,Thu:5,Fri:6,Sat:7};
        const weekdays = days.map(d => map[d]).filter(Boolean);
        await NotificationScheduler.scheduleWeeklyMoodReminders(weekdays, hour, minute);
      } else {
        await NotificationScheduler.scheduleDailyMoodReminderAt(hour, minute);
      }
    } catch (e) {
      console.warn('Notification scheduling failed:', e);
    }
  };

  // Removed log level persistence

  // Removed maintenance helpers (UI caches / notifications)

  return (
    <ScreenLayout edges={['top','left','right']}>
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Ayarlar</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderProfileSection()}

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          <View style={styles.sectionContent}>
            {renderSettingItem(
              'Günlük Hatırlatıcılar',
              'bell-outline',
              settings.notifications,
              (value) => updateSetting('notifications', value)
            )}
            {renderSettingItem(
              'Belirli Saatlerde',
              'clock-outline',
              settings.reminderTimes,
              (value) => updateSetting('reminderTimes', value)
            )}
            {/* Reminder time selector */}
            <Pressable 
              accessibilityRole="button"
              accessibilityLabel="Hatırlatma saatini seç"
              onPress={() => setReminderModalVisible(true)}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <MaterialCommunityIcons name="alarm" size={24} color="#6B7280" />
                <Text style={styles.actionTitle}>Hatırlatma Saati</Text>
              </View>
              <Text style={{ color: '#374151', fontWeight: '600' }}>
                {String(remHour).padStart(2,'0')}:{String(remMinute).padStart(2,'0')}
              </Text>
            </Pressable>
            <Pressable 
              accessibilityRole="button"
              accessibilityLabel="Hatırlatma günlerini seç"
              onPress={() => setReminderDaysModalVisible(true)}
              style={styles.actionItem}
            >
              <View style={styles.actionLeft}>
                <MaterialCommunityIcons name="calendar" size={24} color="#6B7280" />
                <Text style={styles.actionTitle}>Hatırlatma Günleri</Text>
              </View>
              <Text style={{ color: '#374151', fontWeight: '600' }}>
                {selectedDays.map(displayDay).join(' ')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Görünüm */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görünüm</Text>
          <View style={[styles.sectionContent, { gap: 8 }]}>
            <Text style={[styles.actionTitle, { marginBottom: 4 }]}>Renk Modu</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { key: 'static', label: 'Statik' },
                { key: 'today', label: 'Bugün' },
                { key: 'weekly', label: 'Haftalık' },
              ] as { key: ColorMode; label: string }[]).map(opt => {
                const active = (settings.colorMode || 'today') === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => updateColorMode(opt.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Renk modu ${opt.label}`}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? '#10B981' : '#E5E7EB',
                      backgroundColor: active ? '#ECFDF5' : '#FFFFFF'
                    }}
                  >
                    <Text style={{ color: active ? '#065F46' : '#374151', fontWeight: '700' }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: '#6B7280', fontSize: 12 }}>
              Statik: sabit yeşil • Bugün: bugünkü ortalama • Haftalık: son 7 gün ortalaması
            </Text>
          </View>
        </View>


        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik</Text>
          <View style={styles.sectionContent}>
            {renderSettingItem(
              'Biyometrik Kilit',
              'fingerprint',
              settings.biometric,
              async (value) => {
                await updateSetting('biometric', value);
                try {
                  const { setBiometricEnabled } = (await import('@/store/securityStore')).useSecurityStore.getState();
                  await setBiometricEnabled(value);
                } catch (e) {
                  console.warn('Biometric toggle failed to apply:', e);
                }
              }
            )}
          </View>
        </View>

        {/* Theme Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tema</Text>
          <View style={[styles.sectionContent, { padding: 12 }]}> 
            <Text style={[styles.actionTitle, { marginBottom: 8 }]}>Tema Modu</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { key: 'system', label: 'Sistem' },
                { key: 'light', label: 'Açık' },
                { key: 'dark', label: 'Koyu' },
              ] as { key: 'system' | 'light' | 'dark'; label: string }[]).map(opt => {
                const active = themeMode === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setThemeMode(opt.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Tema modu ${opt.label}`}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? '#10B981' : '#E5E7EB',
                      backgroundColor: active ? '#ECFDF5' : '#FFFFFF'
                    }}
                  >
                    <Text style={{ color: active ? '#065F46' : '#374151', fontWeight: '700' }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
              Sistem: Telefon ayarlarına uyar • Açık: Her zaman açık tema • Koyu: Her zaman koyu tema
            </Text>
          </View>
        </View>

        {/* Gizlilik ve İzinler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik ve İzinler</Text>
          <View style={styles.sectionContent}>
            {renderSettingItem(
              'Veri İşleme İzni',
              'shield-lock',
              consents.data_processing,
              (value) => toggleConsent('data_processing', value)
            )}
            {renderSettingItem(
              'Pazarlama İzni',
              'bullhorn',
              consents.marketing,
              (value) => toggleConsent('marketing', value)
            )}
          </View>
          {false && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="lock-check" size={24} color="#10B981" />
                <Text style={styles.settingTitle}>Güvenli Depolama</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                <Text style={{ color: '#10B981', marginLeft: 4, fontWeight: '600' }}>Aktif</Text>
              </View>
            </View>
            <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 8, paddingHorizontal: 16 }}>
              Tüm hassas verileriniz otomatik olarak şifrelenerek güvenli bir şekilde saklanmaktadır.
            </Text>
          </View>
          )}
        </View>

        {/* Dil seçimi kaldırıldı */}

        {/* (Removed) ERP Modülü Ayarları */}


        {/* Voice Check-in & Advanced Sync sections removed */}

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek</Text>
          <View style={styles.sectionContent}>
            {renderActionItem(
              'Uygulamayı Paylaş',
              'share-variant',
              handleShareApp
            )}
            {/* Removed: Verilerini İndir / Verilerini Dosyaya Kaydet / Audit Loglarını Görüntüle */}
            {renderActionItem(
              'Veri Silme Talebi',
              'trash-can-outline',
              handleDeletionRequest,
              true
            )}
            {renderActionItem(
              'Gizlilik Politikası',
              'shield-check',
              handlePrivacyPolicy
            )}
            {renderActionItem(
              'Kullanım Şartları',
              'file-document',
              handleTermsOfService
            )}
          </View>

        </View>



        {/* Geliştirici araçları kaldırıldı */}

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          <View style={styles.sectionContent}>
            {renderActionItem(
              'Çıkış Yap',
              'logout',
              handleSignOut,
              true
            )}
          </View>
          {/* Deletion status */}
          {deletionStatus.status !== 'none' && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
              <Text style={{ color: '#92400E', fontWeight: '600' }}>Silme Talebi Beklemede</Text>
              <Text style={{ color: '#92400E', marginTop: 4 }}>Talep: {new Date(deletionStatus.requestedAt || '').toLocaleString('tr-TR')}</Text>
              <Text style={{ color: '#92400E' }}>Planlanan Silme: {deletionStatus.scheduledAt ? new Date(deletionStatus.scheduledAt).toLocaleString('tr-TR') : '-'}</Text>
              <Text style={{ color: '#92400E' }}>Kalan Gün: {deletionStatus.remainingDays ?? '-'}</Text>
            </View>
          )}
          {/* Consent history */}
          {consentHistory.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 8 }}>Consent Geçmişi</Text>
              {consentHistory.slice(0, 10).map((c: any) => (
                <View key={`${c.consentType}_${c.timestamp}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: '#6B7280' }}>{new Date(c.timestamp).toLocaleString('tr-TR')}</Text>
                  <Text style={{ color: c.granted ? '#10B981' : '#EF4444' }}>{c.consentType}: {c.granted ? 'onay' : 'ret'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>ObsessLess v{Constants?.expoConfig?.version || '1.0.0'}</Text>
          <Text style={styles.versionSubtext}>Made with ❤️ for OCD warriors</Text>
        </View>
      </ScrollView>
      </View>

      {/* Audit Logs Modal removed */}

      {/* Reminder Days Picker Modal */}
      <Modal visible={reminderDaysModalVisible} transparent animationType="fade" onRequestClose={() => setReminderDaysModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hatırlatma Günleri</Text>
            {/* Quick shortcuts */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => setSelectedDays(['Mon','Tue','Wed','Thu','Fri'])}
                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD' }}
                accessibilityRole="button"
                accessibilityLabel="Hafta içi"
              >
                <Text style={{ color: '#1D4ED8', fontWeight: '600' }}>Hafta içi</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDays(['Sat','Sun'])}
                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}
                accessibilityRole="button"
                accessibilityLabel="Hafta sonu"
              >
                <Text style={{ color: '#92400E', fontWeight: '600' }}>Hafta sonu</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedDays(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])}
                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' }}
                accessibilityRole="button"
                accessibilityLabel="Tüm günler"
              >
                <Text style={{ color: '#065F46', fontWeight: '600' }}>Tüm günler</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {dayNames.map(d => {
                const active = selectedDays.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: active ? '#3B82F6' : '#E5E7EB',
                      backgroundColor: active ? '#EFF6FF' : '#FFFFFF'
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Gün ${d}`}
                  >
                    <Text style={{ color: active ? '#1D4ED8' : '#374151', fontWeight: '600' }}>{displayDay(d)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Button title="İptal" onPress={() => setReminderDaysModalVisible(false)} />
              <Button title="Kaydet" onPress={async () => {
                try {
                  const newDays = [...selectedDays];
                  const existing = onboardingPayload?.reminders || {} as any;
                  await setOnboardingReminders({
                    enabled: existing.enabled ?? settings.notifications,
                    time: existing.time || initialTime,
                    days: newDays,
                    timezone: existing.timezone,
                  });
                  await applyNotificationSetting(true, true, existing.time || initialTime, newDays);
                  setReminderDaysModalVisible(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) {
                  console.warn('Failed to save reminder days:', e);
                }
              }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Advanced options removed */}

      {/* Reminder Time Picker Modal */}
      <Modal visible={reminderModalVisible} transparent animationType="fade" onRequestClose={() => setReminderModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hatırlatma Saati</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#6B7280', marginBottom: 6 }}>Saat</Text>
                <Picker selectedValue={remHour} onValueChange={(v) => setRemHour(Number(v))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <Picker.Item key={h} label={String(h).padStart(2,'0')} value={h} />
                  ))}
                </Picker>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#6B7280', marginBottom: 6 }}>Dakika</Text>
                <Picker selectedValue={remMinute} onValueChange={(v) => setRemMinute(Number(v))}>
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                    <Picker.Item key={m} label={String(m).padStart(2,'0')} value={m} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Button title="İptal" onPress={() => setReminderModalVisible(false)} />
              <Button title="Kaydet" onPress={async () => {
                try {
                  const hhmm = `${String(remHour).padStart(2,'0')}:${String(remMinute).padStart(2,'0')}`;
                  // Preserve existing reminder fields, update time
                  const existing = onboardingPayload?.reminders || {} as any;
                  await setOnboardingReminders({
                    enabled: existing.enabled ?? settings.notifications,
                    time: hhmm,
                    days: existing.days,
                    timezone: existing.timezone,
                  });
                  await applyNotificationSetting(true, true, hhmm);
                  setReminderModalVisible(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch (e) {
                  console.warn('Failed to save reminder time:', e);
                }
              }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  profileStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileStatText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  profileStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
  },

  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  dangerText: {
    color: '#EF4444',
  },
  languageContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  languageOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  languageOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  languageFlag: {
    fontSize: 20,
  },
  languageName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  languageNameActive: {
    color: '#3B82F6',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '88%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  modalEmpty: {
    color: '#6B7280',
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logTitle: {
    fontSize: 14,
    color: '#111827',
  },
  logMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  // logMetaSmall removed (audit UI removed)
  // AI Limit Styles
  aiLimitCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  aiLimitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiLimitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  aiLimitInfo: {
    flex: 1,
  },
  aiLimitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  aiLimitStatus: {
    fontSize: 13,
    color: '#6B7280',
  },
  aiLimitProgressContainer: {
    gap: 8,
  },
  aiLimitProgressBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  aiLimitProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  aiLimitProgressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
