import AsyncStorage from '@react-native-async-storage/async-storage';
import { achievementService } from '@/services/achievementService';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from './offlineSync';
import { dataStandardizer } from '@/utils/dataStandardization';

export interface AchievementUnlock {
  achievement_id: string;
  user_id: string;
  unlocked_at: string;
  trigger_event: string;
  context_data?: any;
  synced: boolean;
}

interface AchievementProgress {
  achievement_id: string;
  current_value: number;
  target_value: number;
  percentage: number;
  last_updated: string;
}

type AchievementCondition = (userId: string, event: string, data: any) => Promise<boolean>;

class EnhancedAchievementService {
  private static instance: EnhancedAchievementService;
  private unlockQueue: AchievementUnlock[] = [];
  private progressCache: Map<string, AchievementProgress> = new Map();

  static getInstance(): EnhancedAchievementService {
    if (!EnhancedAchievementService.instance) {
      EnhancedAchievementService.instance = new EnhancedAchievementService();
    }
    return EnhancedAchievementService.instance;
  }

  /**
   * Achievement unlock with full tracking
   */
  async unlockAchievement(
    userId: string, 
    achievementId: string, 
    triggerEvent: string, 
    contextData?: any
  ): Promise<boolean> {
    try {
      // 1. Achievement'ı unlock et
      const unlocked = await achievementService.unlockAchievement(achievementId);
      
      if (!unlocked) {
        return false; // Zaten açık
      }

      // 2. Unlock kaydını oluştur
      const unlockRecord: AchievementUnlock = {
        achievement_id: achievementId,
        user_id: userId,
        unlocked_at: dataStandardizer.standardizeDate(new Date()),
        trigger_event: triggerEvent,
        context_data: contextData,
        synced: false,
      };

      // 3. Local storage'a kaydet
      await this.saveUnlockRecord(unlockRecord);

      // 4. Sync kuyruğuna ekle
      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity: 'achievement',
        data: unlockRecord
      });

      // 5. Analytics event
      await this.trackAchievementUnlock(unlockRecord);

      // 6. Notification göster
      await this.showUnlockNotification(achievementId);

      return true;
    } catch (error) {
      console.error('Achievement unlock hatası:', error);
      return false;
    }
  }

  /**
   * Batch achievement check - Birden fazla achievement'ı kontrol et
   */
  async checkAndUnlockAchievements(
    userId: string,
    eventType: string,
    eventData: any
  ): Promise<string[]> {
    const unlockedIds: string[] = [];
    const conditions = this.getAchievementConditions();
    
    // Paralel kontrol için Promise array
    const checks = Array.from(conditions.entries()).map(async ([achievementId, condition]) => {
      try {
        // Achievement zaten açık mı kontrol et
        const achievements = await achievementService.getAchievements();
        const achievement = achievements.find(a => a.id === achievementId);
        
        if (achievement?.isUnlocked) {
          return null; // Zaten açık
        }

        // Koşul kontrolü
        const shouldUnlock = await condition(userId, eventType, eventData);
        
        if (shouldUnlock) {
          const unlocked = await this.unlockAchievement(userId, achievementId, eventType, eventData);
          return unlocked ? achievementId : null;
        }
      } catch (error) {
        console.error(`Achievement kontrolü başarısız: ${achievementId}`, error);
      }
      return null;
    });

    // Tüm kontrolleri bekle
    const results = await Promise.all(checks);
    
    // Başarılı unlock'ları filtrele
    return results.filter(id => id !== null) as string[];
  }

  /**
   * Achievement koşulları tanımları
   */
  private getAchievementConditions(): Map<string, AchievementCondition> {
    return new Map([
      // İlk ERP egzersizi
      ['first_erp', async (userId, event, data) => {
        return event === 'erp_completed' && data.isFirst === true;
      }],
      
      // 7 günlük seri
      ['week_streak', async (userId, event, data) => {
        return event === 'daily_check' && data.streakDays >= 7;
      }],
      
      // Anksiyete azaltıcı
      ['anxiety_reducer', async (userId, event, data) => {
        return event === 'erp_completed' && 
               data.anxietyReduction >= 3 &&
               data.completed === true;
      }],
      
      // Sabah savaşçısı
      ['morning_warrior', async (userId, event, data) => {
        if (event !== 'erp_completed') return false;
        const hour = new Date(data.timestamp).getHours();
        return hour >= 5 && hour < 9;
      }],
      
      // Gece baykuşu
      ['night_owl', async (userId, event, data) => {
        if (event !== 'erp_completed') return false;
        const hour = new Date(data.timestamp).getHours();
        return hour >= 21 || hour < 3;
      }],
      
      // Kompulsiyon direnci
      ['resistance_master', async (userId, event, data) => {
        return event === 'compulsion_resisted' && 
               data.resistanceLevel >= 8;
      }],
      
      // Mood iyileştirici
      ['mood_improver', async (userId, event, data) => {
        return event === 'mood_improved' && 
               data.improvement >= 3;
      }],
      
      // Nefes ustası
      ['breathing_master', async (userId, event, data) => {
        return event === 'breathing_completed' && 
               data.sessionCount >= 10;
      }],
      
      // Haftalık hedef
      ['weekly_goal', async (userId, event, data) => {
        return event === 'weekly_goal_completed' && 
               data.completionRate >= 80;
      }],
      
      // 30 günlük meydan okuma
      ['thirty_day_challenge', async (userId, event, data) => {
        return event === 'daily_check' && 
               data.streakDays >= 30;
      }]
    ]);
  }

  /**
   * Achievement progress tracking
   */
  async getAchievementProgress(userId: string): Promise<Map<string, AchievementProgress>> {
    const progress = new Map<string, AchievementProgress>();
    const achievements = await achievementService.getAchievements();
    
    for (const achievement of achievements) {
      if (!achievement.isUnlocked) {
        const currentProgress = await this.calculateProgress(userId, achievement.id);
        progress.set(achievement.id, currentProgress);
      }
    }
    
    return progress;
  }

  /**
   * Progress hesaplama
   */
  private async calculateProgress(
    userId: string,
    achievementId: string
  ): Promise<AchievementProgress> {
    let current = 0;
    let target = 1;
    
    // Achievement tipine göre progress hesapla
    switch (achievementId) {
      case 'week_streak': {
        const streakDays = await this.getCurrentStreak(userId);
        current = streakDays;
        target = 7;
        break;
      }
      
      case 'thirty_day_challenge': {
        const streakDays = await this.getCurrentStreak(userId);
        current = streakDays;
        target = 30;
        break;
      }
      
      case 'erp_master': {
        const erpCount = await this.getERPCount(userId);
        current = erpCount;
        target = 50;
        break;
      }
      
      case 'breathing_master': {
        const breathingCount = await this.getBreathingSessionCount(userId);
        current = breathingCount;
        target = 10;
        break;
      }
      
      case 'anxiety_reducer': {
        const reductionCount = await this.getAnxietyReductionCount(userId);
        current = reductionCount;
        target = 5;
        break;
      }
      
      default:
        current = 0;
        target = 1;
    }
    
    const percentage = Math.min(100, Math.round((current / target) * 100));
    
    return {
      achievement_id: achievementId,
      current_value: current,
      target_value: target,
      percentage,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Helper: Mevcut streak'i hesapla
   */
  private async getCurrentStreak(userId: string): Promise<number> {
    try {
      const key = `user_streak_${userId}`;
      const streakData = await AsyncStorage.getItem(key);
      
      if (streakData) {
        const parsed = JSON.parse(streakData);
        return parsed.currentStreak || 0;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: ERP sayısını getir
   */
  private async getERPCount(userId: string): Promise<number> {
    try {
      const sessions = await offlineSyncService.getLocalERPSessions();
      return sessions.filter(s => s.user_id === userId && s.completed).length;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Nefes egzersizi sayısı
   */
  private async getBreathingSessionCount(userId: string): Promise<number> {
    try {
      const key = `breathing_sessions_${userId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (data) {
        const sessions = JSON.parse(data);
        return Array.isArray(sessions) ? sessions.length : 0;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Anksiyete azaltma sayısı
   */
  private async getAnxietyReductionCount(userId: string): Promise<number> {
    try {
      const sessions = await offlineSyncService.getLocalERPSessions();
      const reductions = sessions.filter(s => {
        if (s.user_id !== userId || !s.completed) return false;
        const reduction = (s.anxiety_initial || 0) - (s.anxiety_final || 0);
        return reduction >= 3;
      });
      
      return reductions.length;
    } catch {
      return 0;
    }
  }

  /**
   * Unlock kaydını local'e kaydet
   */
  private async saveUnlockRecord(record: AchievementUnlock): Promise<void> {
    const key = `ach_unlocks_${record.user_id}`;
    const existing = await AsyncStorage.getItem(key);
    const arr: AchievementUnlock[] = existing ? JSON.parse(existing) : [];
    arr.push(record);
    
    // Son 100 kaydı tut
    const recent = arr.slice(-100);
    await AsyncStorage.setItem(key, JSON.stringify(recent));
  }

  /**
   * Analytics tracking
   */
  private async trackAchievementUnlock(record: AchievementUnlock): Promise<void> {
    try {
      const analyticsData = {
        event: 'achievement_unlocked',
        userId: record.user_id,
        properties: {
          achievement_id: record.achievement_id,
          trigger_event: record.trigger_event,
          unlocked_at: record.unlocked_at,
          context: record.context_data
        }
      };
      
      console.log('🏆 Achievement analytics:', analyticsData);
    } catch (error) {
      console.error('Achievement analytics hatası:', error);
    }
  }

  /**
   * Achievement unlock bildirimi
   */
  private async showUnlockNotification(achievementId: string): Promise<void> {
    try {
      const achievements = await achievementService.getAchievements();
      const achievement = achievements.find(a => a.id === achievementId);
      
      if (achievement) {
        // Notification implementation
        console.log(`🎉 Başarı Kazanıldı: ${achievement.title}`);
        console.log(`📝 ${achievement.description}`);
      }
    } catch (error) {
      console.error('Notification gösterme hatası:', error);
    }
  }

  /**
   * Günlük achievement check
   */
  async performDailyAchievementCheck(userId: string): Promise<void> {
    try {
      // Günlük kontrol edilmesi gereken achievement'lar
      const dailyChecks = [
        { event: 'daily_check', data: { streakDays: await this.getCurrentStreak(userId) } },
        { event: 'weekly_goal_check', data: { completionRate: await this.getWeeklyCompletionRate(userId) } }
      ];
      
      for (const check of dailyChecks) {
        await this.checkAndUnlockAchievements(userId, check.event, check.data);
      }
    } catch (error) {
      console.error('Günlük achievement kontrolü hatası:', error);
    }
  }

  /**
   * Haftalık tamamlanma oranı
   */
  private async getWeeklyCompletionRate(userId: string): Promise<number> {
    try {
      // Son 7 günün verilerini kontrol et
      const sessions = await offlineSyncService.getLocalERPSessions();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const weekSessions = sessions.filter(s => {
        return s.user_id === userId && 
               new Date(s.timestamp) >= oneWeekAgo;
      });
      
      // Hedef: Günde en az 1 session
      const targetSessions = 7;
      const actualSessions = weekSessions.length;
      
      return Math.round((actualSessions / targetSessions) * 100);
    } catch {
      return 0;
    }
  }

  /**
   * Achievement progress reset (test için)
   */
  async resetAchievementProgress(userId: string, achievementId: string): Promise<void> {
    const key = `ach_progress_${userId}_${achievementId}`;
    await AsyncStorage.removeItem(key);
    this.progressCache.delete(`${userId}_${achievementId}`);
  }
}

export const enhancedAchievements = EnhancedAchievementService.getInstance();
export default enhancedAchievements;


