import React, { useState, useEffect } from 'react';
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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom UI Components
import { Switch } from '@/components/ui/Switch';
import ScreenLayout from '@/components/layout/ScreenLayout';

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

// Stores

// AI imports removed - AI disabled


// Storage utility
import { StorageKeys } from '@/utils/storage';



import { Modal } from 'react-native';
import { unifiedComplianceService } from '@/services/unifiedComplianceService';

import OnboardingSyncStatusCard from '@/components/settings/OnboardingSyncStatusCard';
import SyncErrorSummaryCard from '@/components/ui/SyncErrorSummaryCard';
import DeadLetterQueueRecovery from '@/components/ui/DeadLetterQueueRecovery';
// performanceMetricsService import removed - performance summary section removed
// Settings data structure
interface SettingsData {
  notifications: boolean;
  biometric: boolean;
  reminderTimes: boolean;
  // weeklyReports removed - not implemented in UI
}



// Constants removed - unused

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
  // const aiStore = useAISettingsStore(); // REMOVED (AI disabled)

  

  const [consents, setConsents] = useState<Record<string, boolean>>({
    data_processing: true,
    analytics: true,
    ai_processing: true,
    marketing: false,
  });
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [migrationVersion, setMigrationVersion] = useState<number>(0);
  // Daily metrics removed - performance summary section removed
  const [deletionStatus, setDeletionStatus] = useState<{ status: 'none' | 'pending' | 'grace_period' | 'scheduled'; requestedAt?: string; scheduledAt?: string; remainingDays?: number; canCancel?: boolean }>({ status: 'none' });
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  
  const [settings, setSettings] = useState<SettingsData>({
    notifications: true,
    biometric: false,
    reminderTimes: false
  });

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
        setSettings(JSON.parse(savedSettings));
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

  const handleDataExport = async () => {
    Alert.alert(
      'Verilerinizi İndirin',
      'Tüm verileriniz güvenli bir şekilde dışa aktarılacak.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'İndir',
          onPress: async () => {
            try {
              if (!user?.id) return;
              const json = await unifiedComplianceService.createDataExport(user.id);
              await Share.share({
                title: 'ObsessLess Veri İndirimi',
                message: json,
              });
            } catch (e) {
              Alert.alert('Hata', 'Veri dışa aktarma başarısız.');
            }
          }
        }
      ]
    );
  };

  const handleDataExportToFile = async () => {
    Alert.alert(
      'Verilerinizi Dosyaya Kaydedin',
      'Tüm verileriniz JSON dosyası olarak cihazınıza kaydedilecek.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Kaydet', 
          onPress: async () => {
            try {
              if (!user?.id) return;
              const json = await unifiedComplianceService.createDataExport(user.id);
              const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
              const fileName = `obsessless_export_${dateStr}.json`;
              const fileUri = FileSystem.documentDirectory + fileName;
              await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
              try {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'ObsessLess Veri Dışa Aktarım' });
                } else {
                  Alert.alert('Kaydedildi', `Dosya kaydedildi: ${fileUri}`);
                }
              } catch {
                Alert.alert('Kaydedildi', `Dosya kaydedildi: ${fileUri}`);
              }
            } catch (e) {
              Alert.alert('Hata', 'Dosyaya kaydetme başarısız.');
            }
          }
        }
      ]
    );
  };

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

  const openAuditLogs = async () => {
    try {
      if (!user?.id) return;
      const logs = await unifiedComplianceService.getAuditLogs(user.id, 14);
      setAuditLogs(logs);
      setAuditVisible(true);
    } catch {
      setAuditLogs([]);
      setAuditVisible(true);
    }
  };

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
    <View style={styles.settingItem}>
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
  const applyNotificationSetting = async (enabled: boolean, useSpecificTime: boolean, explicitTime?: string) => {
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
      const now = new Date();
      const scheduleAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
      await NotificationScheduler.scheduleDailyMoodReminder(scheduleAt);
    } catch (e) {
      console.warn('Notification scheduling failed:', e);
    }
  };

  return (
    <ScreenLayout>
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
              (value) => updateSetting('biometric', value)
            )}
          </View>
        </View>

        {/* AI Limits - HIDDEN (AI disabled) */}
        {false && renderAILimitsSection()}

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
              'Analitik İzni',
              'chart-line',
              consents.analytics,
              (value) => toggleConsent('analytics', value)
            )}
            {renderSettingItem(
              'AI İşleme İzni',
              'robot',
              consents.ai_processing,
              (value) => toggleConsent('ai_processing', value)
            )}
            {renderSettingItem(
              'Pazarlama İzni',
              'bullhorn',
              consents.marketing,
              (value) => toggleConsent('marketing', value)
            )}
          </View>
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
        </View>

        {/* Dil seçimi kaldırıldı */}

        {/* (Removed) ERP Modülü Ayarları */}


        {/* Voice Check-in & Basic Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sesli Check-in</Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="microphone" size={24} color="#10B981" />
                <Text style={styles.settingTitle}>Sesli Analiz</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                <Text style={{ color: '#10B981', marginLeft: 4, fontWeight: '600' }}>Aktif</Text>
              </View>
            </View>
            <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 8, paddingHorizontal: 16 }}>
              Sesli check-in ile mood durum analizi ve Türkçe dil işleme özellikleri etkin.
            </Text>
          </View>
        </View>

        {/* Onboarding Sync Status */}
        <OnboardingSyncStatusCard />

        {/* Sync Error Summary */}
        <SyncErrorSummaryCard 
          style={{ marginHorizontal: 16, marginBottom: 16 }}
          onManualSync={async () => {
            try {
              const { offlineSyncService } = await import('@/services/offlineSync');
              await offlineSyncService.processSyncQueue();
            } catch (error) {
              console.error('❌ Manual sync from settings failed:', error);
              throw error;
            }
          }}
        />

        {/* Dead Letter Queue Recovery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Veri Kurtarma</Text>
          <View style={styles.sectionContent}>
            <DeadLetterQueueRecovery 
              onRecoveryComplete={() => {
                console.log('✅ DLQ recovery completed from settings');
              }}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek</Text>
          <View style={styles.sectionContent}>
            {renderActionItem(
              'Uygulamayı Paylaş',
              'share-variant',
              handleShareApp
            )}
            {renderActionItem(
              'Verilerini İndir',
              'download',
              handleDataExport
            )}
            {renderActionItem(
              'Verilerini Dosyaya Kaydet',
              'content-save',
              handleDataExportToFile
            )}
            {renderActionItem(
              'Audit Loglarını Görüntüle',
              'file-search',
              openAuditLogs
            )}
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

      {/* Audit Logs Modal */}
      <Modal visible={auditVisible} transparent animationType="slide" onRequestClose={() => setAuditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Audit Logları (Son 14 gün)</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {auditLogs.length === 0 ? (
                <Text style={styles.modalEmpty}>Kayıt bulunamadı.</Text>
              ) : (
                auditLogs.slice(0, 50).map((log: any) => (
                  <View key={log.id} style={styles.logItem}>
                    <Text style={styles.logTitle}>{log.action} • {log.entity}</Text>
                    <Text style={styles.logMeta}>{new Date(log.timestamp).toLocaleString('tr-TR')}</Text>
                    {log.metadata ? (
                      <Text style={styles.logMetaSmall}>{JSON.stringify(log.metadata)}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ paddingTop: 12 }}>
              <Button title="Kapat" onPress={() => setAuditVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
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
  logMetaSmall: {
    fontSize: 11,
    color: '#9CA3AF',
  },
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
