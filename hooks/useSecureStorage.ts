import AsyncStorage from '@react-native-async-storage/async-storage';
import secureDataService, { EncryptedData } from '@/services/encryption/secureDataService';

export function useSecureStorage() {
  const setItem = async (key: string, value: any, sensitive: boolean = true): Promise<void> => {
    if (sensitive) {
      const encrypted = await secureDataService.encryptData(value);
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(encrypted));
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  };

  const getItem = async <T = any>(key: string, sensitive: boolean = true): Promise<T | null> => {
    if (sensitive) {
      const raw = await AsyncStorage.getItem(`encrypted_${key}`);
      if (!raw) return null;
      const payload: EncryptedData = JSON.parse(raw);
      const data = await secureDataService.decryptData(payload);
      return data as T;
    }
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  };

  return { setItem, getItem };
}


