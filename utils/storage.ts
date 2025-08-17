import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage utility for managing user-specific data
 * Ensures data isolation between different users
 */

export const StorageKeys = {
  // Profile & Auth
  PROFILE_COMPLETED: 'profileCompleted',
  OCD_PROFILE: (userId: string) => `ocd_profile_${userId}`,
  
  // Compulsions
  COMPULSIONS: (userId: string) => `compulsions_${userId}`,
  
  // ERP Sessions
  ERP_SESSIONS: (userId: string, date?: string) => 
    date ? `erp_sessions_${userId}_${date}` : `erp_sessions_${userId}`,
  
  // Breathwork Sessions
  BREATH_SESSIONS: (userId: string, date?: string) =>
    date ? `breath_sessions_${userId}_${date}` : `breath_sessions_${userId}`,
  
  // Gamification
  GAMIFICATION: (userId: string) => `gamification_${userId}`,
  
  // Settings
  USER_SETTINGS: (userId: string) => `settings_${userId}`,
  SETTINGS: 'app_settings',
  
  // Last used items (for smart suggestions)
  LAST_COMPULSION: (userId: string) => `last_compulsion_${userId}`,
  LAST_ERP_EXERCISE: (userId: string) => `last_erp_${userId}`,

  // Voice & Check-in
  CHECKINS: (userId: string) => `checkins_${userId}`,
  VOICE_CONSENT_STT: (userId: string) => `consent_stt_${userId}`,
  VOICE_CONSENT_TTS: (userId: string) => `consent_tts_${userId}`,

  // CBT Thought Record
  THOUGHT_RECORDS: (userId: string) => `thought_records_${userId}`,
  THOUGHT_RECORD_DRAFT: (userId: string) => `thought_record_draft_${userId}`,
} as const;

/**
 * Get user-specific storage key
 */
export const getUserStorageKey = (baseKey: string, userId?: string): string => {
  if (!userId || typeof userId !== 'string') {
    // Fallback: ensure string key to avoid AsyncStorage undefined warnings
    return `${baseKey}_anon`;
  }
  return `${baseKey}_${userId}`;
};

/**
 * Save user-specific data
 */
export const saveUserData = async <T>(
  key: string, 
  data: T, 
  userId?: string
): Promise<void> => {
  try {
    const storageKey = userId ? getUserStorageKey(key, userId) : key;
    await AsyncStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error(`❌ Error saving data for key ${key}:`, error);
    throw error;
  }
};

/**
 * Load user-specific data
 */
export const loadUserData = async <T>(
  key: string, 
  userId?: string
): Promise<T | null> => {
  try {
    const storageKey = userId ? getUserStorageKey(key, userId) : key;
    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`❌ Error loading data for key ${key}:`, error);
    return null;
  }
};

/**
 * Clear all user-specific data (for logout)
 */
export const clearUserData = async (userId: string): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const userKeys = keys.filter(key => key.includes(`_${userId}`));
    
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
      console.log(`✅ Cleared ${userKeys.length} keys for user ${userId}`);
    }
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    throw error;
  }
};

/**
 * Migrate old data to user-specific keys
 */
export const migrateToUserSpecificStorage = async (userId: string): Promise<void> => {
  try {
    // Migrate compulsions
    const oldCompulsions = await AsyncStorage.getItem('compulsionEntries');
    if (oldCompulsions) {
      await AsyncStorage.setItem(StorageKeys.COMPULSIONS(userId), oldCompulsions);
      await AsyncStorage.removeItem('compulsionEntries');
      console.log('✅ Migrated compulsions data');
    }
    
    // Migrate settings
    const oldSettings = await AsyncStorage.getItem('user_settings');
    if (oldSettings) {
      await AsyncStorage.setItem(StorageKeys.USER_SETTINGS(userId), oldSettings);
      await AsyncStorage.removeItem('user_settings');
      console.log('✅ Migrated settings data');
    }
    
    // Migrate gamification
    const oldGamification = await AsyncStorage.getItem('gamification_profile');
    if (oldGamification) {
      await AsyncStorage.setItem(StorageKeys.GAMIFICATION(userId), oldGamification);
      await AsyncStorage.removeItem('gamification_profile');
      console.log('✅ Migrated gamification data');
    }
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
}; 