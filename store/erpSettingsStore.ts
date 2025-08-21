import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

interface ERPSettingsState {
  // ERP modülü enable/disable durumu
  isEnabled: boolean;
  
  // ERP ayarları
  defaultSessionDuration: number; // dakika cinsinden
  defaultAnxietyLevels: boolean; // anksiyete seviyesi takibi
  safetyChecks: boolean; // güvenlik kontrolleri
  notifications: boolean; // ERP hatırlatıcıları
  
  // Actions
  toggleModule: () => void;
  setModuleEnabled: (enabled: boolean) => void;
  updateSessionDuration: (duration: number) => void;
  toggleAnxietyLevels: () => void;
  toggleSafetyChecks: () => void;
  toggleNotifications: () => void;
  resetToDefaults: () => void;
}

const DEFAULT_ERP_SETTINGS = {
  isEnabled: false, // Default olarak kapalı
  defaultSessionDuration: 15, // 15 dakika
  defaultAnxietyLevels: true,
  safetyChecks: true,
  notifications: true,
};

export const useERPSettingsStore = create<ERPSettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_ERP_SETTINGS,
      
      // ERP modülünü toggle et
      toggleModule: () => {
        const newState = !get().isEnabled;
        set({ isEnabled: newState });
        
        // Feature flags'i güncelle
        try {
          FEATURE_FLAGS.setFlag('ERP_MODULE_ENABLED', newState);
        } catch (error) {
          console.warn('Feature flags güncellenemedi:', error);
        }
      },
      
      // ERP modülünü enable/disable et
      setModuleEnabled: (enabled: boolean) => {
        set({ isEnabled: enabled });
        
        // Feature flags'i güncelle
        try {
          FEATURE_FLAGS.setFlag('ERP_MODULE_ENABLED', enabled);
        } catch (error) {
          console.warn('Feature flags güncellenemedi:', error);
        }
      },
      
      // Varsayılan oturum süresini güncelle
      updateSessionDuration: (duration: number) => {
        set({ defaultSessionDuration: Math.max(1, Math.min(120, duration)) });
      },
      
      // Anksiyete seviyesi takibini toggle et
      toggleAnxietyLevels: () => {
        set((state) => ({ defaultAnxietyLevels: !state.defaultAnxietyLevels }));
      },
      
      // Güvenlik kontrollerini toggle et
      toggleSafetyChecks: () => {
        set((state) => ({ safetyChecks: !state.safetyChecks }));
      },
      
      // Bildirimleri toggle et
      toggleNotifications: () => {
        set((state) => ({ notifications: !state.notifications }));
      },
      
      // Varsayılan ayarlara sıfırla
      resetToDefaults: () => {
        set(DEFAULT_ERP_SETTINGS);
        
        // Feature flags'i güncelle
        try {
          FEATURE_FLAGS.setFlag('ERP_MODULE_ENABLED', DEFAULT_ERP_SETTINGS.isEnabled);
        } catch (error) {
          console.warn('Feature flags güncellenemedi:', error);
        }
      },
      
      // Store initialize olduktan sonra feature flags'i senkronize et
      init: () => {
        const state = get();
        try {
          FEATURE_FLAGS.setFlag('ERP_MODULE_ENABLED', state.isEnabled);
        } catch (error) {
          console.warn('Feature flags init hatası:', error);
        }
      },
    }),
    {
      name: 'erp-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        defaultSessionDuration: state.defaultSessionDuration,
        defaultAnxietyLevels: state.defaultAnxietyLevels,
        safetyChecks: state.safetyChecks,
        notifications: state.notifications,
      }),
    }
  )
);
