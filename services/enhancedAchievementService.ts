import AsyncStorage from '@react-native-async-storage/async-storage';
import achievementService from '@/services/achievementService';
import supabaseService from '@/services/supabase';

export interface AchievementUnlock {
  achievement_id: string;
  user_id: string;
  unlocked_at: string;
  trigger_event: string;
  context_data?: any;
  synced: boolean;
}

class EnhancedAchievementService {
  private static instance: EnhancedAchievementService;

  static getInstance(): EnhancedAchievementService {
    if (!EnhancedAchievementService.instance) {
      EnhancedAchievementService.instance = new EnhancedAchievementService();
    }
    return EnhancedAchievementService.instance;
  }

  async unlockAchievement(userId: string, achievementId: string, triggerEvent: string, contextData?: any): Promise<void> {
    // adapt to AchievementService API: incrementProgress returns boolean when unlocked
    const unlocked = await achievementService.incrementProgress(achievementId, 1);
    if (!unlocked) return;

    const record: AchievementUnlock = {
      achievement_id: achievementId,
      user_id: userId,
      unlocked_at: new Date().toISOString(),
      trigger_event: triggerEvent,
      context_data: contextData,
      synced: false,
    };

    await this.saveUnlockRecord(record);
    try {
      await supabaseService.supabaseClient.from('achievement_unlocks').upsert(record);
      await this.markAsSynced(userId, record.achievement_id);
    } catch {}
  }

  private async saveUnlockRecord(record: AchievementUnlock): Promise<void> {
    const key = `ach_unlocks_${record.user_id}`;
    const existing = await AsyncStorage.getItem(key);
    const arr: AchievementUnlock[] = existing ? JSON.parse(existing) : [];
    arr.push(record);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  }

  private async markAsSynced(userId: string, achievementId: string): Promise<void> {
    const key = `ach_unlocks_${userId}`;
    const existing = await AsyncStorage.getItem(key);
    const arr: AchievementUnlock[] = existing ? JSON.parse(existing) : [];
    await AsyncStorage.setItem(
      key,
      JSON.stringify(arr.map((r) => (r.achievement_id === achievementId ? { ...r, synced: true } : r)))
    );
  }
}

export const enhancedAchievements = EnhancedAchievementService.getInstance();
export default enhancedAchievements;


