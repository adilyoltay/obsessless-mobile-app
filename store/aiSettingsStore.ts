/**
 * 🤖 AI Settings Store - Production Ready
 * 
 * Kullanıcı AI ayarları ve consent yönetimi için Zustand store
 * FAZ 0: Güvenlik ve Stabilite Hazırlığı uyumlu
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// AI Consent durumları
export interface AIConsentData {
  enabled: boolean;
  timestamp: string;
  version: string;
  userId: string;
}

// AI Settings Store State
export interface AISettingsState {
  // User consents for each AI feature
  consents: Record<string, AIConsentData>;
  
  // User preferences
  preferences: {
    aiInsightsFrequency: 'günlük' | 'haftalık' | 'ihtiyaç_halinde';
    aiVoiceGender: 'kadın' | 'erkek' | 'nötr';
    aiLanguage: 'tr' | 'en';
  };
  
  // Usage statistics
  usage: {
    totalInteractions: number;
    lastUsed: Record<string, string>; // feature -> timestamp
    favoriteFeatures: string[];
  };
  
  // Actions
  setConsent: (featureKey: string, consent: AIConsentData) => void;
  getConsent: (featureKey: string) => AIConsentData | null;
  revokeConsent: (featureKey: string) => void;
  
  updatePreferences: (preferences: Partial<AISettingsState['preferences']>) => void;
  trackUsage: (featureKey: string) => void;
  
  // Safety functions
  revokeAllConsents: () => void;
  exportData: () => Pick<AISettingsState, 'consents' | 'preferences' | 'usage'>;
  clearAllData: () => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set, get) => ({
      // Default state
      consents: {},
      preferences: {
        aiInsightsFrequency: 'haftalık',
        aiVoiceGender: 'kadın',
        aiLanguage: 'tr',
      },
      usage: {
        totalInteractions: 0,
        lastUsed: {},
        favoriteFeatures: [],
      },

      // Actions
      setConsent: (featureKey: string, consent: AIConsentData) => {
        set((state) => ({
          consents: {
            ...state.consents,
            [featureKey]: consent,
          }
        }));
        
        // Development modunda feature flag'i de güncelle
        if (__DEV__ && consent.enabled) {
          FEATURE_FLAGS.setFlag(featureKey as any, true);
        }
        
        console.log(`🤖 AI Consent set: ${featureKey} = ${consent.enabled}`);
      },

      getConsent: (featureKey: string) => {
        const consent = get().consents[featureKey];
        return consent || null;
      },

      revokeConsent: (featureKey: string) => {
        set((state) => {
          const newConsents = { ...state.consents };
          delete newConsents[featureKey];
          return { consents: newConsents };
        });
        
        // Development modunda feature flag'i de kapat
        if (__DEV__) {
          FEATURE_FLAGS.setFlag(featureKey as any, false);
        }
        
        console.log(`🚫 AI Consent revoked: ${featureKey}`);
      },

      updatePreferences: (newPreferences) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...newPreferences,
          }
        }));
        
        console.log('⚙️ AI Preferences updated:', newPreferences);
      },

      trackUsage: (featureKey: string) => {
        set((state) => ({
          usage: {
            ...state.usage,
            totalInteractions: state.usage.totalInteractions + 1,
            lastUsed: {
              ...state.usage.lastUsed,
              [featureKey]: new Date().toISOString(),
            }
          }
        }));
      },

      // Safety functions
      revokeAllConsents: () => {
        console.warn('🚨 Revoking ALL AI consents');
        set({ consents: {} });
        
        // Development modunda tüm feature flag'leri kapat
        if (__DEV__) {
          FEATURE_FLAGS.disableAll();
        }
      },

      exportData: () => {
        const { consents, preferences, usage } = get();
        console.log('📤 Exporting AI settings data');
        return { consents, preferences, usage } as Pick<AISettingsState, 'consents' | 'preferences' | 'usage'>;
      },

      clearAllData: () => {
        console.warn('🗑️ Clearing ALL AI settings data');
        set({
          consents: {},
          preferences: {
            aiInsightsFrequency: 'haftalık',
            aiVoiceGender: 'kadın',
            aiLanguage: 'tr',
          },
          usage: {
            totalInteractions: 0,
            lastUsed: {},
            favoriteFeatures: [],
          }
        });
      },
    }),
    {
      name: 'obsessless-ai-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      
      // Sadece critical data'yı persist et
      partialize: (state) => ({
        consents: state.consents,
        preferences: state.preferences,
        usage: state.usage,
      }),
      
      // Migration strategy for future versions
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // v0 -> v1 migration
          return {
            ...persistedState,
            preferences: {
              aiInsightsFrequency: 'haftalık',
              aiVoiceGender: 'kadın',
              aiLanguage: 'tr',
              ...persistedState.preferences,
            }
          };
        }
        return persistedState as AISettingsState;
      },
    }
  )
);

// Utility functions
export const aiSettingsUtils = {
  /**
   * Kullanıcının AI özelliği için rıza verip vermediğini kontrol eder
   */
  hasUserConsent: (featureKey: string, userId: string): boolean => {
    const store = useAISettingsStore.getState();
    const consent = store.getConsent(featureKey);
    return consent?.enabled === true && consent.userId === userId;
  },

  /**
   * AI özelliğinin kullanılabilir olup olmadığını kontrol eder
   * (Feature flag + User consent)
   */
  isAIFeatureAvailable: (featureKey: string, userId: string): boolean => {
    // Feature flag kontrolü
    const featureEnabled = FEATURE_FLAGS.isEnabled(featureKey as any);
    
    // User consent kontrolü
    const userConsent = aiSettingsUtils.hasUserConsent(featureKey, userId);
    
    return featureEnabled && userConsent;
  },

  /**
   * AI özelliği kullanım istatistiklerini günceller
   */
  recordAIInteraction: (featureKey: string) => {
    const store = useAISettingsStore.getState();
    store.trackUsage(featureKey);
    
    // Feature flag usage stats'a da kaydet
    // (Bu, feature flag sistemindeki usage tracking ile senkronize olur)
  },

  /**
   * Tüm AI ayarlarını export eder
   */
  exportAllAISettings: () => {
    const store = useAISettingsStore.getState();
    const featureStats = FEATURE_FLAGS.getUsageStats();
    
    return {
      userSettings: store.exportData(),
      featureFlags: featureStats,
      exportTimestamp: new Date().toISOString(),
      version: '1.0'
    };
  },
};