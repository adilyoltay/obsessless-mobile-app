import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { 
  UserGamificationProfile, 
  AchievementDefinition, 
  StreakInfo,
  MicroRewardTrigger,
  MicroReward
} from '@/types/gamification';
import { StorageKeys } from '@/utils/storage';
import supabaseService from '@/services/supabase';

// Achievement definitions based on documentation
const ACHIEVEMENTS: AchievementDefinition[] = [
  // ERP Kahramanı 🛡️
  {
    id: 'first_erp',
    title: 'İlk Adım',
    description: 'İlk ERP egzersizini tamamla. En zor olan ilk adımı attın. Bu cesaretin bir sembolüdür.',
    category: 'ERP',
    icon: 'trophy',
    rarity: 'Common',
    criteria: { type: 'milestone', target: 1 },
    healingPoints: 20,
  },
  {
    id: 'habituation_observer',
    title: 'Habitüasyon Gözlemcisi',
    description: 'Bir ERP seansında anksiyeteyi %50\'den fazla düşür. Kaygının doğal olarak azaldığını gözlemledin. Bu, OKB tedavisinin temelidir.',
    category: 'ERP',
    icon: 'shield-check',
    rarity: 'Rare',
    criteria: { type: 'percentage', target: 50 },
    healingPoints: 50,
  },
  {
    id: 'erp_warrior',
    title: 'ERP Savaşçısı',
    description: '10 ERP egzersizi tamamla. Zorluklarla yüzleşme konusunda ustalaşıyorsun.',
    category: 'ERP',
    icon: 'sword-cross',
    rarity: 'Epic',
    criteria: { type: 'count', target: 10 },
    healingPoints: 100,
  },
  
  // Direnç Ustası 💪
  {
    id: 'resistance_wall',
    title: 'Direnç Duvarı',
    description: 'Bir günde 5 kompulsiyona karşı diren. Kompulsiyonlara "hayır" deme gücünü gösterdin. Kontrol sende.',
    category: 'Resistance',
    icon: 'hand-front-right',
    rarity: 'Rare',
    criteria: { type: 'count', target: 5 },
    healingPoints: 40,
  },
  {
    id: 'high_resistance_master',
    title: 'Yüksek Direnç Ustası',
    description: '20 kez 8/10 üzeri direnç göster. İrade gücün güçleniyor.',
    category: 'Resistance',
    icon: 'arm-flex',
    rarity: 'Epic',
    criteria: { type: 'count', target: 20 },
    healingPoints: 80,
  },
  
  // Farkındalık Bilgesi 🧠
  {
    id: 'mindful_tracker',
    title: 'Farkındalık Takipçisi',
    description: '7 gün üst üste kompulsiyon kaydı tut. Kendini gözlemleme becerisini geliştiriyorsun.',
    category: 'Mindfulness',
    icon: 'brain',
    rarity: 'Common',
    criteria: { type: 'streak', target: 7 },
    healingPoints: 30,
  },
  {
    id: 'pattern_recognizer',
    title: 'Örüntü Tanıyıcı',
    description: '50 kompulsiyon kaydı oluştur. Tetikleyicilerini ve örüntülerini tanımaya başladın.',
    category: 'Mindfulness',
    icon: 'eye-check',
    rarity: 'Rare',
    criteria: { type: 'count', target: 50 },
    healingPoints: 60,
  },
];

// Micro-reward definitions
const MICRO_REWARDS: Record<MicroRewardTrigger, MicroReward> = {
  compulsion_recorded: {
    points: 10,
    message: '+10 ✨',
    trigger: 'compulsion_recorded'
  },
  erp_completed: {
    points: 20,
    message: '+20 ✨',
    trigger: 'erp_completed'
  },
  high_resistance: {
    points: 15,
    message: '+15 ✨ Güçlü direnç!',
    trigger: 'high_resistance'
  },
  anxiety_reduced: {
    points: 25,
    message: '+25 ✨ Anksiyete azaldı!',
    trigger: 'anxiety_reduced'
  },
  daily_goal_met: {
    points: 50,
    message: '+50 ✨ Günlük hedef!',
    trigger: 'daily_goal_met'
  },
  erp_quick_start: {
    points: 5,
    message: '+5 ✨ Hızlı başlangıç!',
    trigger: 'erp_quick_start'
  },
  planning_ahead: {
    points: 8,
    message: '+8 ✨ Planlama yapıyor!',
    trigger: 'planning_ahead'
  },
  compulsion_quick_entry: {
    points: 12,
    message: '+12 ✨ Hızlı kayıt!',
    trigger: 'compulsion_quick_entry'
  },
  pattern_recognition: {
    points: 18,
    message: '+18 ✨ Örüntü farkındalığı!',
    trigger: 'pattern_recognition'
  },
  consistent_tracking: {
    points: 30,
    message: '+30 ✨ Düzenli takip!',
    trigger: 'consistent_tracking'
  },
  resistance_improvement: {
    points: 22,
    message: '+22 ✨ Direnç gelişimi!',
    trigger: 'resistance_improvement'
  },
  erp_wizard_start: {
    points: 5,
    message: '+5 ✨ Sihirbaz başlatıldı!',
    trigger: 'erp_wizard_start'
  },
  urge_resistance: {
    points: 15,
    message: '+15 ✨ Dürtüye direndi!',
    trigger: 'urge_resistance'
  },
};

interface GamificationState {
  profile: UserGamificationProfile;
  achievements: AchievementDefinition[];
  lastMicroReward?: MicroReward;
  isLoading: boolean;
  currentUserId?: string;
  
  // Actions
  setUserId: (userId: string) => void;
  initializeGamification: (userId?: string) => Promise<void>;
  updateStreak: () => Promise<void>;
  checkAchievements: (type: 'compulsion' | 'erp', data?: any) => Promise<AchievementDefinition[]>;
  awardMicroReward: (trigger: MicroRewardTrigger) => Promise<void>;
  getStreakInfo: () => StreakInfo;
  saveProfile: () => Promise<void>;
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  profile: {
    streakCurrent: 0,
    streakBest: 0,
    unlockedAchievements: [],
    healingPointsToday: 0,
    healingPointsTotal: 0,
    streakLevel: 'seedling',
    lastActivityDate: new Date().toISOString().split('T')[0],
  },
  achievements: ACHIEVEMENTS,
  lastMicroReward: undefined,
  isLoading: true,
  currentUserId: undefined,

  setUserId: (userId: string) => {
    set({ currentUserId: userId });
  },

  initializeGamification: async (userId?: string) => {
    try {
      const uid = userId || get().currentUserId;
      if (!uid) {
        console.warn('No userId provided for gamification initialization');
        set({ isLoading: false });
        return;
      }

      const storageKey = StorageKeys.GAMIFICATION(uid);
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const profile = JSON.parse(stored);
        
        // Check if streak should be reset
        const today = new Date().toISOString().split('T')[0];
        const lastDate = new Date(profile.lastActivityDate);
        const daysDiff = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 1) {
          // Streak broken
          profile.streakCurrent = 0;
        }
        
        // Reset daily points if new day
        if (profile.lastActivityDate !== today) {
          profile.healingPointsToday = 0;
        }
        
        set({ profile, isLoading: false, currentUserId: uid });
      } else {
        set({ isLoading: false, currentUserId: uid });
      }
    } catch (error) {
      console.error('Failed to load gamification profile:', error);
      set({ isLoading: false });
    }
  },

  updateStreak: async () => {
    const { profile } = get();
    const today = new Date().toISOString().split('T')[0];
    
    if (profile.lastActivityDate === today) {
      // Already updated today
      return;
    }
    
    const lastDate = new Date(profile.lastActivityDate);
    const daysDiff = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStreak = profile.streakCurrent;
    
    if (daysDiff === 1) {
      // Continue streak
      newStreak = profile.streakCurrent + 1;
    } else if (daysDiff > 1) {
      // Streak broken
      newStreak = 1;
    }
    
    // Update streak level
    let streakLevel: 'seedling' | 'warrior' | 'master' = 'seedling';
    if (newStreak >= 21) {
      streakLevel = 'master';
    } else if (newStreak >= 7) {
      streakLevel = 'warrior';
    }
    
    const updatedProfile = {
      ...profile,
      streakCurrent: newStreak,
      streakBest: Math.max(newStreak, profile.streakBest),
      streakLevel,
      lastActivityDate: today,
      healingPointsToday: 0, // Reset daily points
    };
    
    set({ profile: updatedProfile });
    await get().saveProfile();
  },

  checkAchievements: async (type: 'compulsion' | 'erp', data?: any) => {
    const { profile, achievements } = get();
    const newlyUnlocked: AchievementDefinition[] = [];
    
    for (const achievement of achievements) {
      if (profile.unlockedAchievements.includes(achievement.id)) {
        continue; // Already unlocked
      }
      
      let shouldUnlock = false;
      
      switch (achievement.id) {
        case 'first_erp':
          if (type === 'erp') shouldUnlock = true;
          break;
          
        case 'habituation_observer':
          if (type === 'erp' && data?.anxietyReduction >= 50) {
            shouldUnlock = true;
          }
          break;
          
        case 'resistance_wall':
          if (type === 'compulsion' && data?.dailyHighResistance >= 5) {
            shouldUnlock = true;
          }
          break;
          
        case 'mindful_tracker':
          if (profile.streakCurrent >= 7) {
            shouldUnlock = true;
          }
          break;
          
        // Add more achievement checks here
      }
      
      if (shouldUnlock) {
        achievement.unlockedAt = new Date();
        newlyUnlocked.push(achievement);
        profile.unlockedAchievements.push(achievement.id);
        profile.healingPointsTotal += achievement.healingPoints;
        
        // Haptic feedback for achievement
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    
    if (newlyUnlocked.length > 0) {
      set({ profile });
      await get().saveProfile();
    }
    
    return newlyUnlocked;
  },

  awardMicroReward: async (trigger: MicroRewardTrigger) => {
    const { profile } = get();
    const reward = MICRO_REWARDS[trigger];
    
    // Safety check for undefined reward
    if (!reward) {
      console.warn(`⚠️ Micro reward not found for trigger: ${trigger}`);
      return;
    }
    
    // Weekend 2x bonus
    const isWeekend = [0, 6].includes(new Date().getDay());
    const points = isWeekend ? reward.points * 2 : reward.points;
    
    const updatedProfile = {
      ...profile,
      healingPointsToday: profile.healingPointsToday + points,
      healingPointsTotal: profile.healingPointsTotal + points,
    };
    
    set({ 
      profile: updatedProfile,
      lastMicroReward: {
        ...reward,
        points,
        message: isWeekend ? `${reward.message} x2` : reward.message,
      }
    });
    
    await get().saveProfile();
    
    // Light haptic for micro-reward
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  getStreakInfo: () => {
    const { profile } = get();
    
    const levelInfo = {
      seedling: {
        name: 'Fidan 🌱',
        description: 'İlk adımların çok değerli.',
        nextLevel: 7,
        icon: 'sprout',
      },
      warrior: {
        name: 'Savaşçı ⚔️',
        description: 'Kararlılığınla beynine yeni yollar öğretiyorsun.',
        nextLevel: 21,
        icon: 'sword-cross',
      },
      master: {
        name: 'Usta 🧘',
        description: 'Bu artık bir alışkanlık. Zorluklarla başa çıkma becerinde ustalaşıyorsun.',
        nextLevel: undefined,
        icon: 'meditation',
      },
    };
    
    const currentLevel = levelInfo[profile.streakLevel];
    
    return {
      current: profile.streakCurrent,
      best: profile.streakBest,
      level: profile.streakLevel,
      levelName: currentLevel.name,
      levelDescription: currentLevel.description,
      nextLevelAt: currentLevel.nextLevel,
      icon: currentLevel.icon,
    };
  },

  saveProfile: async () => {
    const { profile, currentUserId } = get();
    if (!currentUserId) {
      console.warn('No userId to save gamification profile.');
      return;
    }
    try {
      // Save to AsyncStorage (offline first)
      const storageKey = StorageKeys.GAMIFICATION(currentUserId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(profile));

      // Save to Supabase database
      try {
        await supabaseService.updateGamificationProfile(currentUserId, {
          healing_points_total: profile.healingPointsTotal || 0,
          healing_points_today: profile.healingPointsToday || 0,
          streak_count: profile.streakCurrent || 0,
          streak_last_update: new Date(profile.lastActivityDate || new Date()).toISOString().split('T')[0],
          level: profile.streakLevel === 'seedling' ? 1 : profile.streakLevel === 'warrior' ? 2 : 3,
          achievements: profile.unlockedAchievements || [],
          micro_rewards: [],
        });
        console.log('✅ Gamification profile saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed (offline mode):', dbError);
        // Continue with offline mode - data is already in AsyncStorage
      }
    } catch (error) {
      console.error('Failed to save gamification profile:', error);
    }
  },
})); 