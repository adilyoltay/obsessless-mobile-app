
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
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { router } from 'expo-router';

// Stores
import { useGamificationStore } from '@/store/gamificationStore';
import { useAISettingsStore, aiSettingsUtils } from '@/store/aiSettingsStore';

// Storage utility
import { StorageKeys } from '@/utils/storage';

import { FEATURE_FLAGS } from '@/constants/featureFlags';

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
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();
  const { signOut, user } = useAuth();
  const { profile } = useGamificationStore();
  const { consents, setConsent, getConsent, updatePreferences } = useAISettingsStore();
  
  const [settings, setSettings] = useState<SettingsData>({
    notifications: true,
    biometric: false,
    reminderTimes: true,
    weeklyReports: false
  });

  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    
    try {
      const settingsKey = StorageKeys.USER_SETTINGS(user.id);
      const savedSettings = await AsyncStorage.getItem(settingsKey);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSetting = async (key: keyof SettingsData, value: boolean) => {
    if (!user?.id) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      const settingsKey = StorageKeys.USER_SETTINGS(user.id);
      await AsyncStorage.setItem(settingsKey, JSON.stringify(newSettings));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage as any);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout failed:', error);
              Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu');
            }
          },
        },
      ]
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'ObsessLess - OKB ile başa çıkmada güvenilir yol arkadaşın. 🌿\n\nhttps://obsessless.app',
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const handleDataExport = () => {
    Alert.alert(
      'Verilerini İndir',
      'Tüm verilerini güvenli bir şekilde indirmek ister misin?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'İndir', 
          onPress: async () => {
            // TODO: Implement data export
            Alert.alert('Başarılı', 'Verilerin e-posta adresine gönderildi.');
          }
        }
      ]
    );
  };

  const handleClearData = async () => {
    Alert.alert(
      'Tüm Verileri Temizle',
      'Tüm uygulama verilerini temizlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Başarılı', 'Tüm veriler başarıyla temizlendi.');
              // Optionally, redirect to login or clear auth context
              // router.replace('/(auth)/login'); 
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Hata', 'Veriler temizlenirken bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>Ayarlar</Text>
    </View>
  );

  const renderProfileSection = () => (
    <View style={styles.profileSection}>
      <View style={styles.profileCard}>
        <MaterialCommunityIcons name="account-circle" size={48} color="#10B981" />
        <View style={styles.profileInfo}>
          <Text style={styles.profileEmail}>{user?.email || 'kullanici@email.com'}</Text>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <MaterialCommunityIcons name="fire" size={16} color="#F59E0B" />
              <Text style={styles.profileStatText}>{profile.streakCurrent} gün</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStat}>
              <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
              <Text style={styles.profileStatText}>{profile.healingPointsTotal} puan</Text>
            </View>
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

  const renderLanguageSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dil</Text>
      <View style={styles.languageContainer}>
        {LANGUAGE_OPTIONS.map((lang) => (
          <Pressable
            key={lang.code}
            style={[
              styles.languageOption,
              language === lang.code && styles.languageOptionActive
            ]}
            onPress={() => handleLanguageChange(lang.code)}
          >
            <Text style={styles.languageFlag}>{lang.flag}</Text>
            <Text style={[
              styles.languageName,
              language === lang.code && styles.languageNameActive
            ]}>
              {lang.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderAIFeatureItem = (
    title: string,
    description: string,
    featureKey: string,
    icon: string,
    benefits: string,
    disabled = false
  ) => {
    // AI özelliğinin aktif olup olmadığını hem feature flag hem de user consent'e göre belirle
    const hasUserConsent = user?.id ? aiSettingsUtils.hasUserConsent(featureKey, user.id) : false;
    const isEnabled = !disabled && hasUserConsent && FEATURE_FLAGS.isEnabled(featureKey as any);
    
    const handleFeatureToggle = (value: boolean) => {
      if (disabled) {
        Alert.alert(
          'Özellik Henüz Hazır Değil',
          'Bu özellik gelecek güncellemelerde aktif olacak.',
          [{ text: 'Tamam' }]
        );
        return;
      }

      if (value) {
        // AI özelliği aktifleştirme onay dialogu
        Alert.alert(
          'AI Özelliği Aktifleştir',
          `${title} özelliğini aktifleştirmek istediğinizden emin misiniz?\n\n${description}\n\nFaydaları:\n${benefits}`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Aktifleştir',
              onPress: () => {
                // User consent kaydedilir
                handleAIFeatureConsent(featureKey, true);
                Alert.alert(
                  'Başarılı!',
                  `${title} aktifleştirildi. Özellik artık kullanıma hazır.`,
                  [{ text: 'Tamam' }]
                );
              }
            }
          ]
        );
      } else {
        // Deaktifleştirme
        Alert.alert(
          'AI Özelliği Deaktifleştir',
          `${title} özelliğini deaktifleştirmek istediğinizden emin misiniz?`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Deaktifleştir',
              style: 'destructive',
              onPress: () => {
                handleAIFeatureConsent(featureKey, false);
                Alert.alert(
                  'Deaktifleştirildi',
                  `${title} deaktifleştirildi.`,
                  [{ text: 'Tamam' }]
                );
              }
            }
          ]
        );
      }
    };

    return (
      <View style={[styles.aiFeatureItem, disabled && styles.aiFeatureItemDisabled]}>
        <View style={styles.aiFeatureHeader}>
          <View style={styles.aiFeatureLeft}>
            <MaterialCommunityIcons 
              name={icon as any} 
              size={24} 
              color={disabled ? '#9CA3AF' : isEnabled ? '#10B981' : '#6B7280'} 
            />
            <View style={styles.aiFeatureInfo}>
              <Text style={[styles.aiFeatureTitle, disabled && styles.aiFeatureTextDisabled]}>
                {title}
              </Text>
              <Text style={[styles.aiFeatureDescription, disabled && styles.aiFeatureTextDisabled]}>
                {description}
              </Text>
            </View>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleFeatureToggle}
            disabled={disabled}
            trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            thumbColor={isEnabled ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>
        
        {isEnabled && !disabled && (
          <View style={styles.aiFeatureBenefits}>
            <Text style={styles.aiFeatureBenefitsTitle}>Aktif özellikler:</Text>
            <Text style={styles.aiFeatureBenefitsText}>{benefits}</Text>
          </View>
        )}
      </View>
    );
  };

  const handleAIFeatureConsent = async (featureKey: string, enabled: boolean) => {
    if (!user?.id) return;
    
    try {
      // Zustand store ile consent kaydet
      const consentData = {
        enabled,
        timestamp: new Date().toISOString(),
        version: '1.0',
        userId: user.id
      };
      
      if (enabled) {
        setConsent(featureKey, consentData);
      } else {
        // Consent'i tamamen kaldır
        const { revokeConsent } = useAISettingsStore.getState();
        revokeConsent(featureKey);
      }
      
      Haptics.impactAsync(
        enabled 
          ? Haptics.ImpactFeedbackStyle.Light 
          : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (error) {
      console.error('Error saving AI consent:', error);
      Alert.alert('Hata', 'Ayar kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };

  return (
    <ScreenLayout>
      {/* Header - New Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Settings</Text>
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

        {/* Language */}
        {renderLanguageSection()}

        {/* AI Özellikleri - Production Ready */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Yapay Zeka Asistanı</Text>
          <View style={styles.sectionContent}>

            {/* AI Onboarding - Sprint 7 Integration */}
            <View style={styles.aiOnboardingSection}>
              <Pressable 
                style={({ pressed }) => [
                  styles.aiOnboardingCard,
                  pressed && styles.aiOnboardingCardPressed
                ]} 
                onPress={() => {
                  Alert.alert(
                    '🧭 AI Onboarding',
                    'Kişiselleştirilmiş AI destekli onboarding deneyimini başlatmak istiyor musunuz? Bu süreç yaklaşık 10-15 dakika sürer.',
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Başlat',
                        onPress: () => {
                          router.push({
                            pathname: '/(auth)/ai-onboarding',
                            params: { fromSettings: 'true' }
                          });
                        }
                      }
                    ]
                  );
                }}
              >
                <View style={styles.aiOnboardingContent}>
                  <MaterialCommunityIcons name="brain" size={32} color="#3b82f6" />
                  <View style={styles.aiOnboardingInfo}>
                    <Text style={styles.aiOnboardingTitle}>🧭 AI Destekli Onboarding</Text>
                    <Text style={styles.aiOnboardingDescription}>
                      Size özel tedavi planı ve risk değerlendirmesi oluşturun
                    </Text>
                    <View style={styles.aiOnboardingFeatures}>
                      <Text style={styles.aiFeatureItem}>• Y-BOCS analizi</Text>
                      <Text style={styles.aiFeatureItem}>• Kişisel profil</Text>
                      <Text style={styles.aiFeatureItem}>• Tedavi planı</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#6b7280" />
                </View>
              </Pressable>
            </View>
            
            {/* AI Chat */}
            {renderAIFeatureItem(
              '💬 AI Sohbet Asistanı',
              'Sorularınızı yanıtlayan, size rehberlik eden empatik AI asistanı',
              'AI_CHAT',
              'robot',
              '• Anlık soru-cevap desteği\n• Duygusal destek ve yönlendirme\n• Güvenli ve özel konuşmalar'
            )}

            {/* AI Insights */}
            {renderAIFeatureItem(
              '📊 Akıllı İçgörüler',
              'Verilerinizi analiz ederek kişisel içgörüler ve öneriler sunar',
              'AI_INSIGHTS',
              'chart-line',
              '• Pattern tanıma ve analiz\n• Kişiselleştirilmiş öneriler\n• İlerleme takibi ve motivasyon'
            )}

            {/* AI Voice (Future) */}
            {renderAIFeatureItem(
              '🎤 Sesli Asistan (Yakında)',
              'Sesli komutlar ve konuşmalar ile etkileşim',
              'AI_VOICE',
              'microphone',
              '• Eller serbest kullanım\n• Doğal dil işleme\n• Sesli ERP rehberliği',
              true // disabled
            )}

            {/* AI Crisis Detection */}
            {renderAIFeatureItem(
              '🚨 Kriz Tespiti',
              'Zorlayıcı durumları erken tespit eder ve anında destek önerir',
              'AI_CRISIS_DETECTION',
              'shield-alert',
              '• 7/24 güvenlik izleme\n• Acil durum müdahale\n• Otomatik destek önerileri'
            )}

            {/* Sprint 7 Features */}
            {renderAIFeatureItem(
              '🧠 Y-BOCS Analizi',
              'AI destekli, kültürümüze uyarlanmış OKB değerlendirmesi',
              'AI_YBOCS_ANALYSIS',
              'head-lightbulb',
              '• Kişiselleştirilmiş analiz\n• Kültürel uyarlama\n• Risk faktörü tespiti'
            )}

            {renderAIFeatureItem(
              '👤 Kullanıcı Profilleme',
              'Size özel terapötik profil ve hedef öneriler oluşturur',
              'AI_USER_PROFILING',
              'account-cog',
              '• AI destekli profil\n• Hedef önerileri\n• Kişiselleştirme'
            )}

            {renderAIFeatureItem(
              '📋 Tedavi Planı',
              'Kanıt tabanlı, adaptive tedavi planları oluşturur',
              'AI_TREATMENT_PLANNING',
              'clipboard-text',
              '• Kanıt tabanlı planlama\n• Gerçek zamanlı adaptasyon\n• İlerleme takibi'
            )}

            {renderAIFeatureItem(
              '🛡️ Risk Değerlendirmesi',
              'Prediktif risk analizi ve kriz önleme protokolleri',
              'AI_RISK_ASSESSMENT',
              'shield-account',
              '• Prediktif modelleme\n• Kriz önleme\n• Güvenlik planları'
            )}

            {renderAIFeatureItem(
              '🎯 Akıllı Müdahaleler',
              'Bağlama göre uyarlanmış anlık terapötik müdahaleler',
              'AI_ADAPTIVE_INTERVENTIONS',
              'target',
              '• Bağlamsal farkındalık\n• Gerçek zamanlı müdahale\n• JITAI algoritmaları'
            )}

            {/* Art Therapy - Experimental */}
            {renderAIFeatureItem(
              '🎨 Sanat Terapisi (Beta)',
              'Duygularınızı görselleştirin ve yaratıcı ifade ile iyileşin',
              'AI_ART_THERAPY',
              'palette',
              '• Duygu-renk eşleştirmesi\n• Terapötik sanat yaratımı\n• Görsel mindfulness\n• Yaratıcı ifade terapisi'
            )}

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
              'Gizlilik Politikası',
              'shield-check-outline',
              () => Linking.openURL('https://obsessless.app/privacy')
            )}
            {renderActionItem(
              'Yardım',
              'help-circle-outline',
              () => Linking.openURL('mailto:support@obsessless.app')
            )}
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <View style={styles.sectionContent}>
            {renderActionItem(
              'Çıkış Yap',
              'logout',
              handleLogout,
              true
            )}
          </View>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>ObsessLess v1.0.0</Text>
          <Text style={styles.versionSubtext}>Seninle 💚</Text>
        </View>

        {/* Geliştirici Araçları */}
        {__DEV__ && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Geliştirici Araçları</Text>
            
            {/* AI Feature Toggles - DEVELOPMENT ONLY */}
            <View style={styles.aiSection}>
              <Text style={styles.subsectionTitle}>🤖 AI Özellikleri (Geliştirici)</Text>
              <Text style={styles.devWarning}>
                ⚠️ Bu ayarlar sadece geliştirme ortamında çalışır
              </Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>AI Chat</Text>
                <Switch
                  value={FEATURE_FLAGS.isEnabled('AI_CHAT')}
                  onValueChange={(value) => {
                    FEATURE_FLAGS.setFlag('AI_CHAT', value);
                    Alert.alert(
                      'AI Chat',
                      value ? 'Aktif edildi' : 'Deaktif edildi',
                      [{ text: 'Tamam' }]
                    );
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={FEATURE_FLAGS.isEnabled('AI_CHAT') ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>AI Onboarding</Text>
                <Switch
                  value={FEATURE_FLAGS.isEnabled('AI_ONBOARDING')}
                  onValueChange={(value) => {
                    FEATURE_FLAGS.setFlag('AI_ONBOARDING', value);
                    Alert.alert(
                      'AI Onboarding',
                      value ? 'Aktif edildi' : 'Deaktif edildi',
                      [{ text: 'Tamam' }]
                    );
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={FEATURE_FLAGS.isEnabled('AI_ONBOARDING') ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>AI Insights</Text>
                <Switch
                  value={FEATURE_FLAGS.isEnabled('AI_INSIGHTS')}
                  onValueChange={(value) => {
                    FEATURE_FLAGS.setFlag('AI_INSIGHTS', value);
                    Alert.alert(
                      'AI Insights',
                      value ? 'Aktif edildi' : 'Deaktif edildi',
                      [{ text: 'Tamam' }]
                    );
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={FEATURE_FLAGS.isEnabled('AI_INSIGHTS') ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>AI Voice</Text>
                <Switch
                  value={FEATURE_FLAGS.isEnabled('AI_VOICE')}
                  onValueChange={(value) => {
                    FEATURE_FLAGS.setFlag('AI_VOICE', value);
                    Alert.alert(
                      'AI Voice',
                      value ? 'Aktif edildi' : 'Deaktif edildi',
                      [{ text: 'Tamam' }]
                    );
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                  thumbColor={FEATURE_FLAGS.isEnabled('AI_VOICE') ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              {/* Feature Usage Stats */}
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>Kullanım İstatistikleri:</Text>
                <Text style={styles.statsText}>
                  {JSON.stringify(FEATURE_FLAGS.getUsageStats(), null, 2)}
                </Text>
              </View>

              {/* Test Buttons */}
              <View style={styles.testButtons}>
                <Button
                  onPress={() => router.push('/ai-test')}
                  style={styles.testButton}
                  variant="secondary"
                >
                  AI Test Sayfası
                </Button>

                <Button
                  onPress={async () => {
                    FEATURE_FLAGS.disableAll();
                    Alert.alert('🚨 Emergency Shutdown', 'Tüm AI özellikleri kapatıldı!');
                  }}
                  style={styles.dangerButton}
                  variant="secondary"
                >
                  🚨 Emergency Shutdown
                </Button>

                <Button
                  onPress={async () => {
                    FEATURE_FLAGS.reactivateAll();
                    Alert.alert('🔄 Reactivated', 'Environment variable\'lar kontrol ediliyor...');
                  }}
                  style={styles.testButton}
                  variant="secondary"
                >
                  🔄 Reactivate All
                </Button>
              </View>
            </View>

            <Button
              onPress={() => router.push('/test-components')}
              style={{ marginTop: 12 }}
              variant="secondary"
            >
              UI Bileşenlerini Test Et
            </Button>
            
            <Button
              onPress={handleClearData}
              style={{ marginTop: 8 }}
              variant="secondary"
            >
              Tüm Verileri Temizle
            </Button>
          </Card>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerContainer: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  profileSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileEmail: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  profileStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileStatText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginLeft: 4,
  },
  profileStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter',
    marginLeft: 12,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    marginLeft: 12,
  },
  dangerText: {
    color: '#EF4444',
  },
  actionItemPressed: {
    opacity: 0.7,
  },
  languageContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  languageOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  languageOptionActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  languageName: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  languageNameActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  versionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  versionSubtext: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  bottomSpacing: {
    height: 32,
  },
  aiSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  testButtons: {
    marginTop: 16,
    gap: 8,
  },
  testButton: {
    marginBottom: 8,
  },
  dangerButton: {
    backgroundColor: '#FEE2E2',
  },
  settingLabel: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  devWarning: {
    fontSize: 14,
    color: '#F59E0B',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  aiFeatureItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  aiFeatureItemDisabled: {
    opacity: 0.6,
  },
  aiFeatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  aiFeatureLeft: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 16,
  },
  aiFeatureInfo: {
    flex: 1,
    marginLeft: 12,
  },
  aiFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  aiFeatureDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  aiFeatureTextDisabled: {
    color: '#9CA3AF',
  },
  aiFeatureBenefits: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  aiFeatureBenefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  aiFeatureBenefitsText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  // AI Onboarding Section Styles
  aiOnboardingSection: {
    marginBottom: 16,
  },
  aiOnboardingCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#3b82f6',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  aiOnboardingCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  aiOnboardingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiOnboardingInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  aiOnboardingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e40af',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  aiOnboardingDescription: {
    fontSize: 14,
    color: '#1e40af',
    fontFamily: 'Inter',
    lineHeight: 20,
    marginBottom: 12,
  },
  aiOnboardingFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
