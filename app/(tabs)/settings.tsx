import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  Alert,
  Share,
  Linking,
  ActivityIndicator
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom UI Components
import { Switch } from '@/components/ui/Switch';
import ScreenLayout from '@/components/layout/ScreenLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { router } from 'expo-router';

// Stores
import { useGamificationStore } from '@/store/gamificationStore';
import { useAISettingsStore, aiSettingsUtils } from '@/store/aiSettingsStore';


// Storage utility
import { StorageKeys } from '@/utils/storage';

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useRouter } from 'expo-router';
import { Modal } from 'react-native';
import gdprService from '@/services/compliance/gdprService';
import SecureStorageMigration from '@/utils/secureStorageMigration';
// performanceMetricsService import removed - performance summary section removed
// Settings data structure
interface SettingsData {
  notifications: boolean;
  biometric: boolean;
  reminderTimes: boolean;
  weeklyReports: boolean;
}



const LANGUAGE_OPTIONS = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' }
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  // Dil seçimi kaldırıldı; uygulama sistem dilini otomatik kullanır
  const { user, signOut, profile } = useAuth();
  const aiStore = useAISettingsStore();

  

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
  const [deletionStatus, setDeletionStatus] = useState<{ status: 'none' | 'pending'; requestedAt?: string; scheduledAt?: string; remainingDays?: number }>({ status: 'none' });
  const [consentHistory, setConsentHistory] = useState<any[]>([]);
  
  const [settings, setSettings] = useState<SettingsData>({
    notifications: true,
    biometric: false,
    reminderTimes: false,
    weeklyReports: true
  });

  // AI Onboarding state removed - no longer needed
  // Treatment Plan removed - moved to OCD Dashboard Assessment tab

  useEffect(() => {
    loadSettings();
    loadConsents();
    loadMigrationAndMetrics();
  }, []);

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

  const loadConsents = async () => {
    try {
      if (!user?.id) return;
      const c = await gdprService.getConsents(user.id);
      setConsents(c);
      const ds = await gdprService.getDeletionStatus(user.id);
      setDeletionStatus(ds);
      const ch = await gdprService.getConsentHistory(user.id, 180);
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

  // Development helpers removed

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
              const json = await gdprService.exportUserData(user.id);
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
              const json = await gdprService.exportUserData(user.id);
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
      await gdprService.recordConsent(user.id, type, value);
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
            await gdprService.deleteAllUserData(user.id);
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
      const logs = await gdprService.getAuditLogs(user.id, 14);
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
            <Text style={styles.profileStatText}>{(profile as any)?.currentStreak || 0} gün</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <MaterialCommunityIcons name="trophy" size={16} color="#10B981" />
            <Text style={styles.profileStatText}>{(profile as any)?.level || 1}. seviye</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
            <Text style={styles.profileStatText}>{(profile as any)?.healingPointsTotal || 0} puan</Text>
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


        {/* AI Özellikleri - Varsayılan Aktif (Toggle Kaldırıldı) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yapay Zeka Asistanı</Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="robot" size={24} color="#10B981" />
                <Text style={styles.settingTitle}>AI Özellikleri</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                <Text style={{ color: '#10B981', marginLeft: 4, fontWeight: '600' }}>Aktif</Text>
              </View>
            </View>
            <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 8, paddingHorizontal: 16 }}>
              Tüm AI özellikleri varsayılan olarak etkinleştirilmiştir: Akıllı İçgörüler, Ses Analizi, CBT Desteği, Tedavi Planı ve İlerleme Takibi.
            </Text>
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



        {/* Developer Tools removed */}

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
          {deletionStatus.status === 'pending' && (
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
          <Text style={styles.versionText}>ObsessLess v1.0.0</Text>
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
});
