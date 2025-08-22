import AsyncStorage from '@react-native-async-storage/async-storage';
import secureDataService from '@/services/encryption/secureDataService';

/**
 * Plain text → encrypted storage migration helper
 */
export class SecureStorageMigration {
  private static VERSION_KEY = 'secure_storage_migration_version';
  private static CURRENT_VERSION = 2;

  static async migrate(userId: string): Promise<void> {
    const current = await this.getVersion();
    if (current >= this.CURRENT_VERSION) return;

    // 1) Basit anahtarlar
    const simpleKeys = [
      `ai_user_profile_${userId}`,
      `ai_treatment_plan_${userId}`,
      `user_profile_${userId}`,
      `ai_user_metadata_${userId}`,
      `ai_preferences_${userId}`,
    ];
    for (const key of simpleKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const value = JSON.parse(raw);
          const encrypted = await secureDataService.encryptData(value);
          await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(encrypted));
          await AsyncStorage.removeItem(key);
        } catch {}
      }
    }

    // 2) Mood entries (son 90 gün)
    await this.migrateMoodEntries(userId, 90);

    // 3) Compulsions ve therapy sessions (toplu anahtarlar)
    await this.migrateArrayKey(`compulsions_${userId}`);
    // await this.migrateArrayKey(`erp_sessions_${userId}`); // Removed ERP

    await AsyncStorage.setItem(this.VERSION_KEY, String(this.CURRENT_VERSION));
  }

  private static async getVersion(): Promise<number> {
    const v = await AsyncStorage.getItem(this.VERSION_KEY);
    return v ? parseInt(v, 10) : 0;
  }

  private static async migrateMoodEntries(userId: string, days: number): Promise<void> {
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const key = `mood_entries_${userId}_${date}`;
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const entries = JSON.parse(raw);
        const enc = await secureDataService.encryptData(entries);
        await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(enc));
        await AsyncStorage.removeItem(key);
      } catch {}
    }
  }

  private static async migrateArrayKey(key: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const arr = JSON.parse(raw);
      const enc = await secureDataService.encryptData(arr);
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(enc));
      await AsyncStorage.removeItem(key);
    } catch {}
  }
}

export default SecureStorageMigration;


