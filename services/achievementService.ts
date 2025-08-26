import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  category: 'assessment' | 'streak' | 'progress' | 'time';
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
    type: 'assessment';
    count: number;
  }[];
}

// Achievement definitions (compulsion/ERP removed; keep assessment/streak/time)
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'currentProgress' | 'unlockedAt' | 'isUnlocked'>[] = [
  // Assessment Achievements
  {
    id: 'first_assessment',
    title: 'Kendini Tanı',
    titleEn: 'Know Yourself',
    description: 'İlk değerlendirmeyi tamamladınız',
    descriptionEn: 'Completed your first assessment',
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
    title: 'Düzenli Değerlendirme',
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
      return true;
    }

    await this.saveAchievements();
    return false;
  }

  async incrementProgress(achievementId: string, amount: number = 1): Promise<boolean> {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement || achievement.isUnlocked) return false;

    return this.updateProgress(achievementId, achievement.currentProgress + amount);
  }

  async trackActivity(type: 'assessment', data?: any, userId?: string): Promise<Achievement[]> {
    const today = new Date().toISOString().split('T')[0];
    const unlockedAchievements: Achievement[] = [];

    if ((this as any).updateStreak) {
      await (this as any).updateStreak(userId);
    } else {
      await this.checkStreakAchievements(unlockedAchievements);
    }

    await this.trackAssessmentAchievements(data, unlockedAchievements);

    await this.checkStreakAchievements(unlockedAchievements);

    if ((this as any).checkTimeBasedAchievements) {
      await (this as any).checkTimeBasedAchievements(userId);
    }

    await this.saveAchievements();
    return unlockedAchievements;
  }

  private async trackAssessmentAchievements(data: any, unlockedAchievements: Achievement[]): Promise<void> {
    if (await this.incrementProgress('first_assessment')) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'first_assessment')!);
    }

    const weeklyAssessments = await this.getConsecutiveWeeklyAssessments();
    if (await this.updateProgress('monthly_assessments', weeklyAssessments)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'monthly_assessments')!);
    }
  }

  private async checkStreakAchievements(unlockedAchievements: Achievement[]): Promise<void> {
    if (await this.updateProgress('week_streak', this.streakData.current >= 7 ? 1 : 0)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'week_streak')!);
    }

    if (await this.updateProgress('month_streak', this.streakData.current >= 30 ? 1 : 0)) {
      unlockedAchievements.push(this.achievements.find(a => a.id === 'month_streak')!);
    }
  }

  private async getConsecutiveWeeklyAssessments(): Promise<number> {
    try {
      const assessments = await AsyncStorage.getItem('ybocs_history');
      if (!assessments) return 0;
      const parsedAssessments = JSON.parse(assessments);
      return parsedAssessments.length;
    } catch {
      return 0;
    }
  }

  private async getEarlyBirdActivities(): Promise<number> {
    try {
      const logs = await AsyncStorage.getItem('activity_logs');
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
      const logs = await AsyncStorage.getItem('activity_logs');
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