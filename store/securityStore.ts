import { create } from 'zustand';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SecurityState = {
  biometricEnabled: boolean;
  locked: boolean;
  setBiometricEnabled: (val: boolean) => Promise<void>;
  lock: () => void;
  unlockWithBiometrics: () => Promise<boolean>;
  hydrate: () => Promise<void>;
};

const STORAGE_KEY = 'security_settings';

export const useSecurityStore = create<SecurityState>((set, get) => ({
  biometricEnabled: false,
  locked: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ biometricEnabled: !!parsed.biometricEnabled });
      }
    } catch {}
  },

  setBiometricEnabled: async (val: boolean) => {
    try {
      // On enable, ensure hardware + enrollment
      if (val) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          // Cannot enable without enrollment
          set({ biometricEnabled: false });
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ biometricEnabled: false }));
          return;
        }
      }
      set({ biometricEnabled: val });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ biometricEnabled: val }));
      if (val) {
        // Immediately lock to test on next foreground
        set({ locked: true });
      }
    } catch {
      set({ biometricEnabled: false });
    }
  },

  lock: () => set({ locked: true }),

  unlockWithBiometrics: async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kilidi aç',
        cancelLabel: 'İptal',
        disableDeviceFallback: false,
      });
      if (result.success) {
        set({ locked: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));

export default useSecurityStore;

