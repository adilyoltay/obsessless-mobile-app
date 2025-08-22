import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  category: 'compulsion' | 'assessment' | 'streak' | 'progress' | 'time';
  type: 'count' | 'streak' | 'milestone' | 'special';
  target: number;
  currentProgress: number;
  unlockedAt?: Date;
  isUnlocked: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
}

export interface UserAchievements {
  achievements: Achievement[];
  totalPoints: number;
  unlockedCount: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  levelProgress: number;
}

export interface StreakData {
  current: number;
  longest: number;
  lastActivity: Date;
  activities: {
    date: string;
    type: 'compulsion' | 'assessment';
    count: number;
  }[];
}

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'currentProgress' | 'unlockedAt' | 'isUnlocked'>[] = [
  // Compulsion Tracking Achievements
  {
    id: 'first_log',
    title: 'İlk Adım',
    titleEn: 'First Step',
    description: 'İlk kompulsiyon kaydınızı oluşturdunuz',
    descriptionEn: 'Created your first compulsion log',
    icon: '🎯',
    color: '#10B981',
    category: 'compulsion',
    type: 'milestone',
    target: 1,
    rarity: 'common',
    points: 10,
  },
  {
    id: 'persistent_tracker',
    title: 'Kararlı Takipçi',
    titleEn: 'Persistent Tracker',
    description: '7 gün üst üste kompulsiyon kaydı tuttunuz',
    descriptionEn: 'Tracked compulsions for 7 consecutive days',
    icon: '📈',
    color: '#3B82F6',
    category: 'streak',
    type: 'streak',
    target: 7,
    rarity: 'rare',
    points: 50,
  },
  {
    id: 'hundred_logs',
    title: 'Yüz Kayıt',
    titleEn: 'Hundred Logs',
    description: '100 kompulsiyon kaydı oluşturdunuz',
    descriptionEn: 'Created 100 compulsion logs',
    icon: '💯',
    color: '#8B5CF6',
    category: 'compulsion',
    type: 'count',
    target: 100,
    rarity: 'epic',
    points: 100,
  },

  // ERP Exercise Achievements
  {
    id: 'first_erp',
    title: 'Cesur Başlangıç',
    titleEn: 'Brave Beginning',
    description: 'İlk ERP egzersizinizi tamamladınız',
    descriptionEn: 'Completed your first ERP exercise',
    icon: '🦸',
    color: '#EF4444',
    category: 'erp',
    type: 'milestone',
    target: 1,
    rarity: 'common',
    points: 20,
  },
  {
    id: 'erp_warrior',
    title: 'ERP Savaşçısı',
    titleEn: 'ERP Warrior',
    description: '10 ERP egzersizi tamamladınız',
    descriptionEn: 'Completed 10 ERP exercises',
    icon: '⚔️',
    color: '#F59E0B',
    category: 'erp',
    type: 'count',
    target: 10,
    rarity: 'rare',
    points: 75,
  },
  {
    id: 'long_session',
    title: 'Uzun Nefes',
    titleEn: 'Long Breath',
    description: '60 dakikalık ERP oturumu tamamladınız',
    descriptionEn: 'Completed a 60-minute ERP session',
    icon: '⏰',
    color: '#06B6D4',
    category: 'erp',
    type: 'milestone',
    target: 60,
    rarity: 'epic',
    points: 150,
  },

  // Assessment Achievements
  {
    id: 'first_assessment',
    title: 'Kendini Tanı',
    titleEn: 'Know Yourself',
    description: 'İlk Y-BOCS değerlendirmenizi tamamladınız',
    descriptionEn: 'Completed your first Y-BOCS assessment',
    icon: '📊',
    color: '#84CC16',
    category: 'assessment',
    type: 'milestone',
    target: 1,
    rarity: 'common',
    points: 15,
  },
  {
    id: 'monthly_assessments',
    title: 'Düzenli Değerlendirici',
    titleEn: 'Regular Assessor',
    description: '4 hafta üst üste değerlendirme yaptınız',
    descriptionEn: 'Completed assessments for 4 consecutive weeks',
    icon: '🗓️',
    color: '#EC4899',
    category: 'assessment',
    type: 'streak',
    target: 4,
    rarity: 'rare',
    points: 60,
  },

  // Streak Achievements
  {
    id: 'week_streak',
    title: 'Haftalık Ritim',
    titleEn: 'Weekly Rhythm',
    description: '7 günlük aktivite serisi oluşturdunuz',
    descriptionEn: 'Created a 7-day activity streak',
    icon: '🔥',
    color: '#F97316',
    category: 'streak',
    type: 'streak',
    target: 7,
    rarity: 'common',
    points: 30,
  },
  {
    id: 'month_streak',
    title: 'Aylık Kararlılık',
    titleEn: 'Monthly Consistency',
    description: '30 günlük aktivite serisi oluşturdunuz',
    descriptionEn: 'Created a 30-day activity streak',
    icon: '🌟',
    color: '#7C2D12',
    category: 'streak',
    type: 'streak',
    target: 30,
    rarity: 'legendary',
    points: 200,
  },

  // Progress Achievements
  {
    id: 'resistance_master',
    title: 'Direnç Ustası',
    titleEn: 'Resistance Master',
    description: 'Kompulsiyonlara karşı ortalama 8+ direnç gösterdiniz',
    descriptionEn: 'Showed average 8+ resistance against compulsions',
    icon: '🛡️',
    color: '#059669',
    category: 'progress',
    type: 'milestone',
    target: 8,
    rarity: 'epic',
    points: 120,
  },
  {
    id: 'anxiety_reducer',
    title: 'Kaygı Azaltıcı',
    titleEn: 'Anxiety Reducer',
    description: 'ERP egzersizlerinde %50 kaygı azalması sağladınız',
    descriptionEn: 'Achieved 50% anxiety reduction in ERP exercises',
    icon: '📉',
    color: '#0EA5E9',
    category: 'progress',
    type: 'milestone',
    target: 50,
    rarity: 'rare',
    points: 80,
  },

  // Time-based Achievements
  {
    id: 'early_bird',
    title: 'Erken Kuş',
    titleEn: 'Early Bird',
    description: 'Sabah 08:00\'den önce 10 aktivite kaydettiniz',
    descriptionEn: 'Logged 10 activities before 8:00 AM',
    icon: '🌅',
    color: '#FCD34D',
    category: 'time',
    type: 'count',
    target: 10,
    rarity: 'rare',
    points: 40,
  },
  {
    id: 'night_owl',
    title: 'Gece Kuşu',
    titleEn: 'Night Owl',
    description: 'Gece 22:00\'dan sonra 10 aktivite kaydettiniz',
    descriptionEn: 'Logged 10 activities after 10:00 PM',
    icon: '🦉',
    color: '#6366F1',
    category: 'time',
    type: 'count',
    target: 10,
    rarity: 'rare',
    points: 40,
  },

  // Special Achievements
  {
    id: 'perfectionist',
    title: 'Mükemmeliyetçi',
    titleEn: 'Perfectionist',
    description: 'Bir günde 5 farklı kompulsiyon türü kaydettiniz',
    descriptionEn: 'Logged 5 different compulsion types in one day',
    icon: '✨',
    color: '#A855F7',
    category: 'compulsion',
    type: 'special',
    target: 5,
    rarity: 'epic',
    points: 100,
  },
];

class AchievementService {
  private static instance: AchievementService;
  private achievements: Achievement[] = [];
  private streakData: StreakData = {
    current: 0,
    longest: 0,
    lastActivity: new Date(),
    activities: [],
  };

  static getInstance(): AchievementService {
    if (!AchievementService.instance) {
      AchievementService.instance = new AchievementService();
    }
    return AchievementService.instance;
  }

  async initializeAchievements(): Promise<void> {
    try {
      const savedAchievements = await AsyncStorage.getItem('user_achievements');
      const savedStreak = await AsyncStorage.getItem('streak_data');

      if (savedAchievements) {
        this.achievements = JSON.parse(savedAchievements);
      } else {
        // Initialize with default achievements
        this.achievements = ACHIEVEMENT_DEFINITIONS.map(def => ({
          ...def,
          currentProgress: 0,
          isUnlocked: false,
        }));
        await this.saveAchievements();
      }

      if (savedStreak) {
        this.streakData = JSON.parse(savedStreak);
        this.streakData.lastActivity = new Date(this.streakData.lastActivity);
      }
    } catch (error) {
      console.error('Error initializing achievements:', error);
    }
  }

  async saveAchievements(): Promise<void> {
    try {
      await AsyncStorage.setItem('user_achievements', JSON.stringify(this.achievements));
      await AsyncStorage.setItem('streak_data', JSON.stringify(this.streakData));
    } catch (error) {
      console.error('Error saving achievements:', error);
    }
  }

  async updateProgress(achievementId: string, progress: number): Promise<boolean> {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement || achievement.isUnlocked) return false;

    achievement.currentProgress = Math.min(progress, achievement.target);

    if (achievement.currentProgress >= achievement.target) {
      achievement.isUnlocked = true;
      achievement.unlockedAt = new Date();
      await this.saveAchievements();
      return true; // Achievement unlocked
    }

    await this.saveAchievements();
    return false;
  }

  async incrementProgress(achievementId: string, amount: number = 1): Promise<boolean> {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement || achievement.isUnlocked) return false;

    return this.updateProgress(achievementId, achievement.currentProgress + amount);
  }

  async trackActivity(type: 'compulsion' | 'erp' | 'assessment', data?: any): Promise<Achievement[]> {
    const today = new Date().toISOString().split('T')[0];
    const unlockedAchievements: Achievement[] = [];

    // Update streak
    await this.updateStreak(type);

    // Track specific achievements based on activity type
    switch (type) {
      case 'compulsion':
        await this.trackCompulsionAchievements(data, unlockedAchievements);
        break;
      case 'erp':
        await this.trackERPAchievements(data, unlockedAchievements);
        break;
      case 'assessment':
        await this.trackAssessmentAchievements(data, unlockedAchievements);
        break;
    }

    // Check streak achievements
    await this.checkStreakAchievements(unlockedAchievements);

    // Check time-based achievements
    await this.checkTimeBasedAchievements(type, unlockedAchievements);

    await this.saveAchievements();
    return unlockedAchievements;
  }

  private async trackCompulsionAchievements(data: any, unlockedAchievements: Achievement[]): Promise<void> {
    // First log
    if (await this.incrementProgress('first_log')) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'first_log')!);
    }

    // Count-based achievements
    const totalLogs = await this.getTotalCompulsionLogs();
    if (await this.updateProgress('hundred_logs', totalLogs)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'hundred_logs')!);
    }

    // Check resistance level
    if (data?.resistance >= 8) {
      const avgResistance = await this.getAverageResistance();
      if (await this.updateProgress('resistance_master', avgResistance >= 8 ? 1 : 0)) {
        unlockedAchievements.push(this.achievements.find(a => a.id === 'resistance_master')!);
      }
    }

    // Check perfectionist (5 different types in one day)
    const todayTypes = await this.getTodayCompulsionTypes();
    if (await this.updateProgress('perfectionist', todayTypes.length >= 5 ? 1 : 0)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'perfectionist')!);
    }
  }

  private async trackERPAchievements(data: any, unlockedAchievements: Achievement[]): Promise<void> {
    // First ERP
    if (await this.incrementProgress('first_erp')) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'first_erp')!);
    }

    // Count-based achievements
    const totalERPs = await this.getTotalERPSessions();
    if (await this.updateProgress('erp_warrior', totalERPs)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'erp_warrior')!);
    }

    // Long session achievement
    if (data?.duration >= 60) {
      if (await this.updateProgress('long_session', 1)) {
        unlockedAchievements.push(this.achievements.find(a => a.id === 'long_session')!);
      }
    }

    // Anxiety reduction achievement
    if (data?.anxietyReduction >= 50) {
      if (await this.updateProgress('anxiety_reducer', 1)) {
        unlockedAchievements.push(this.achievements.find(a => a.id === 'anxiety_reducer')!);
      }
    }
  }

  private async trackAssessmentAchievements(data: any, unlockedAchievements: Achievement[]): Promise<void> {
    // First assessment
    if (await this.incrementProgress('first_assessment')) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'first_assessment')!);
    }

    // Monthly assessments
    const weeklyAssessments = await this.getConsecutiveWeeklyAssessments();
    if (await this.updateProgress('monthly_assessments', weeklyAssessments)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'monthly_assessments')!);
    }
  }

  private async checkStreakAchievements(unlockedAchievements: Achievement[]): Promise<void> {
    // Week streak
    if (await this.updateProgress('week_streak', this.streakData.current >= 7 ? 1 : 0)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'week_streak')!);
    }

    // Month streak
    if (await this.updateProgress('month_streak', this.streakData.current >= 30 ? 1 : 0)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'month_streak')!);
    }

    // Persistent tracker
    const consecutiveDays = await this.getConsecutiveCompulsionDays();
    if (await this.updateProgress('persistent_tracker', consecutiveDays)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'persistent_tracker')!);
    }
  }

  private async checkTimeBasedAchievements(type: string, unlockedAchievements: Achievement[]): Promise<void> {
    const now = new Date();
    const hour = now.getHours();

    // Early bird (before 8 AM)
    if (hour < 8) {
      const earlyBirdCount = await this.getEarlyBirdActivities();
      if (await this.updateProgress('early_bird', earlyBirdCount)) {
        unlockedAchievements.push(this.achievements.find(a => a.id === 'early_bird')!);
      }
    }

    // Night owl (after 10 PM)
    if (hour >= 22) {
      const nightOwlCount = await this.getNightOwlActivities();
      if (await this.updateProgress('night_owl', nightOwlCount)) {
        unlockedAchievements.push(this.achievements.find(a => a.id === 'night_owl')!);
      }
    }
  }

  private async updateStreak(type: 'compulsion' | 'erp' | 'assessment'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastActivityDate = this.streakData.lastActivity.toISOString().split('T')[0];

    // Check if we need to update streak
    if (lastActivityDate === today) {
      // Activity already recorded today
      return;
    }

    if (lastActivityDate === yesterday) {
      // Continue streak
      this.streakData.current += 1;
    } else {
      // Reset streak
      this.streakData.current = 1;
    }

    // Update longest streak
    if (this.streakData.current > this.streakData.longest) {
      this.streakData.longest = this.streakData.current;
    }

    // Update last activity
    this.streakData.lastActivity = new Date();

    // Add to activities
    this.streakData.activities.push({
      date: today,
      type,
      count: 1,
    });

    // Keep only last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    this.streakData.activities = this.streakData.activities.filter(a => a.date >= ninetyDaysAgo);
  }

  // Helper methods for achievement progress calculation
  private async getTotalCompulsionLogs(): Promise<number> {
    try {
      const logs = await AsyncStorage.getItem('compulsion_logs');
      return logs ? JSON.parse(logs).length : 0;
    } catch {
      return 0;
    }
  }

  private async getTotalERPSessions(): Promise<number> {
    try {
      const sessions = await AsyncStorage.getItem('erp_sessions');
      return sessions ? JSON.parse(sessions).length : 0;
    } catch {
      return 0;
    }
  }

  private async getAverageResistance(): Promise<number> {
    try {
      const logs = await AsyncStorage.getItem('compulsion_logs');
      if (!logs) return 0;

      const parsedLogs = JSON.parse(logs);
      const resistanceSum = parsedLogs.reduce((sum: number, log: any) => sum + (log.resistance || 0), 0);
      return parsedLogs.length > 0 ? resistanceSum / parsedLogs.length : 0;
    } catch {
      return 0;
    }
  }

  private async getTodayCompulsionTypes(): Promise<string[]> {
    try {
      const logs = await AsyncStorage.getItem('compulsion_logs');
      if (!logs) return [];

      const today = new Date().toISOString().split('T')[0];
      const parsedLogs = JSON.parse(logs);
      const todayLogs = parsedLogs.filter((log: any) => 
        new Date(log.timestamp).toISOString().split('T')[0] === today
      );

      return [...new Set(todayLogs.map((log: any) => log.type))] as string[];
    } catch {
      return [];
    }
  }



  private async getConsecutiveWeeklyAssessments(): Promise<number> {
    try {
      const assessments = await AsyncStorage.getItem('ybocs_history');
      if (!assessments) return 0;

      const parsedAssessments = JSON.parse(assessments);
      // Implementation for calculating consecutive weekly assessments
      // This would need to check for assessments in consecutive weeks
      return parsedAssessments.length; // Simplified for now
    } catch {
      return 0;
    }
  }

  private async getConsecutiveCompulsionDays(): Promise<number> {
    // Implementation for calculating consecutive days with compulsion logs
    return this.streakData.current;
  }

  private async getEarlyBirdActivities(): Promise<number> {
    try {
      const logs = await AsyncStorage.getItem('compulsion_logs');
      if (!logs) return 0;

      const parsedLogs = JSON.parse(logs);
      return parsedLogs.filter((log: any) => {
        const hour = new Date(log.timestamp).getHours();
        return hour >= 6 && hour <= 10;
      }).length;
    } catch {
      return 0;
    }
  }

  private async getNightOwlActivities(): Promise<number> {
    try {
      const logs = await AsyncStorage.getItem('compulsion_logs');
      if (!logs) return 0;

      const parsedLogs = JSON.parse(logs);
      return parsedLogs.filter((log: any) => {
        const hour = new Date(log.timestamp).getHours();
        return hour >= 22;
      }).length;
    } catch {
      return 0;
    }
  }

  // Public getters
  getUserAchievements(): UserAchievements {
    const unlockedCount = this.achievements.filter(a => a.isUnlocked).length;
    const totalPoints = this.achievements
      .filter(a => a.isUnlocked)
      .reduce((sum, a) => sum + a.points, 0);

    const level = Math.floor(totalPoints / 100) + 1;
    const levelProgress = (totalPoints % 100) / 100;

    return {
      achievements: this.achievements,
      totalPoints,
      unlockedCount,
      currentStreak: this.streakData.current,
      longestStreak: this.streakData.longest,
      level,
      levelProgress,
    };
  }

  getStreakData(): StreakData {
    return this.streakData;
  }

  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => a.isUnlocked);
  }

  getAchievementsByCategory(category: Achievement['category']): Achievement[] {
    return this.achievements.filter(a => a.category === category);
  }

  getRecentAchievements(days: number = 7): Achievement[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.achievements.filter(a => 
      a.isUnlocked && a.unlockedAt && new Date(a.unlockedAt) >= cutoffDate
    );
  }
}

export default AchievementService.getInstance();