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
import { 
  unifiedGamificationService, 
  UnifiedPointsCalculation, 
  UnifiedMission 
} from '@/features/ai/services/unifiedGamificationService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Achievement definitions based on documentation
const ACHIEVEMENTS: AchievementDefinition[] = [
  // Terapi Kahramanı 🛡️
  {
    id: 'first_session',
    title: 'İlk Adım',
    description: 'İlk terapi egzersizini tamamla. En zor olan ilk adımı attın. Bu cesaretin bir sembolüdür.',
    category: 'Resistance',
    icon: 'trophy',
    rarity: 'Common',
    criteria: { type: 'milestone', target: 1 },
    healingPoints: 20,
  },
  {
    id: 'anxiety_reducer',
    title: 'Kaygı Azaltıcısı',
    description: 'Kompulsiyonla başa çıkarken kaygını %50\'den fazla azalt. Kaygının doğal olarak azaldığını gözlemledin. Bu, OKB yönetiminin temelidir.',
    category: 'Resistance',
    icon: 'shield-check',
    rarity: 'Rare',
    criteria: { type: 'percentage', target: 50 },
    healingPoints: 50,
  },
  {
    id: 'therapy_warrior',
    title: 'Terapi Savaşçısı',
    description: '10 terapi egzersizi tamamla. Zorluklarla yüzleşme konusunda ustalaşıyorsun.',
    category: 'Resistance',
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
  // erp_completed: { // Removed ERP micro reward
  //   points: 20,
  //   message: '+20 ✨',
  //   trigger: 'erp_completed'
  // },
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

  urge_resistance: {
    points: 15,
    message: '+15 ✨ Dürtüye direndi!',
    trigger: 'urge_resistance'
  },
  voice_mood_checkin: {
    points: 1,
    message: '+1 ✨ Mood Check‑in',
    trigger: 'voice_mood_checkin'
  },
  cbt_completed: {
    points: 15,
    message: '+15 ✨ CBT kaydı!',
    trigger: 'cbt_completed'
  },
};

interface GamificationState {
  profile: UserGamificationProfile;
  achievements: AchievementDefinition[];
  lastMicroReward?: MicroReward;
  lastPointsCalculation?: UnifiedPointsCalculation;
  currentMissions: UnifiedMission[];
  isLoading: boolean;
  currentUserId?: string;
  
  // Actions
  setUserId: (userId: string) => void;
  initializeGamification: (userId?: string) => Promise<void>;
  updateStreak: () => Promise<void>;
  checkAchievements: (type: 'compulsion', data?: any) => Promise<AchievementDefinition[]>;
  awardMicroReward: (trigger: MicroRewardTrigger) => Promise<void>;
  
  // Unified Gamification
  awardUnifiedPoints: (action: string, context?: any, moduleData?: any) => Promise<UnifiedPointsCalculation>;
  generateUnifiedMissions: () => Promise<UnifiedMission[]>;
  updateMissionProgress: (missionId: string, increment?: number) => Promise<boolean>;
  getMissionsForToday: () => UnifiedMission[];
  
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
  lastPointsCalculation: undefined,
  currentMissions: [],
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

  checkAchievements: async (type: 'compulsion', data?: any) => {
    const { profile, achievements } = get();
    const newlyUnlocked: AchievementDefinition[] = [];
    
    for (const achievement of achievements) {
      if (profile.unlockedAchievements.includes(achievement.id)) {
        continue; // Already unlocked
      }
      
      let shouldUnlock = false;
      
      switch (achievement.id) {
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

  // =============================================================================
  // DYNAMIC GAMIFICATION METHODS (Week 2)
  // =============================================================================

  awardUnifiedPoints: async (action: string, context: any = {}, moduleData?: any) => {
    const { currentUserId } = get();
    if (!currentUserId) {
      console.warn('No userId to award unified points.');
      return { basePoints: 0, contextMultipliers: {}, totalPoints: 0, reasoning: ['No user ID'] } as UnifiedPointsCalculation;
    }

    if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_GAMIFICATION')) {
      // Fall back to static micro reward system
      const staticReward = MICRO_REWARDS[action as MicroRewardTrigger];
      if (staticReward) {
        await get().awardMicroReward(action as MicroRewardTrigger);
        return {
          basePoints: staticReward.points,
          contextMultipliers: {
            difficultyBonus: 1, streakMultiplier: 1, progressBonus: 1,
            timingBonus: 1, consistencyBonus: 1, achievementMultiplier: 1,
            honestyBonus: 1, improvementBonus: 1, detailBonus: 1
          },
          totalPoints: staticReward.points,
          reasoning: [`Static reward: ${staticReward.points} points`],
          breakdown: [{ reason: `Static ${action}`, points: staticReward.points }]
        };
      }
      return { 
        basePoints: 0, 
        contextMultipliers: {
          difficultyBonus: 1, streakMultiplier: 1, progressBonus: 1,
          timingBonus: 1, consistencyBonus: 1, achievementMultiplier: 1,
          honestyBonus: 1, improvementBonus: 1, detailBonus: 1
        }, 
        totalPoints: 0, 
        reasoning: ['Feature disabled'],
        breakdown: []
      } as UnifiedPointsCalculation;
    }

    try {
      const pointsCalculation = await unifiedGamificationService.awardUnifiedPoints(
        currentUserId,
        action,
        context,
        moduleData
      );

      // Update local state with calculation
      set({ lastPointsCalculation: pointsCalculation });

      // Update profile with new points (service already updated storage)
      const { profile } = get();
      set({
        profile: {
          ...profile,
          healingPointsToday: profile.healingPointsToday + pointsCalculation.totalPoints,
          healingPointsTotal: profile.healingPointsTotal + pointsCalculation.totalPoints
        }
      });

      // Haptic feedback based on points earned
      if (pointsCalculation.totalPoints >= 50) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      return pointsCalculation;
    } catch (error) {
      console.error('Unified points award failed:', error);
      return { 
        basePoints: 0, 
        contextMultipliers: {
          difficultyBonus: 1, streakMultiplier: 1, progressBonus: 1,
          timingBonus: 1, consistencyBonus: 1, achievementMultiplier: 1,
          honestyBonus: 1, improvementBonus: 1, detailBonus: 1
        }, 
        totalPoints: 0, 
        reasoning: ['Error occurred'],
        breakdown: []
      } as UnifiedPointsCalculation;
    }
  },

  generateUnifiedMissions: async () => {
    const { currentUserId } = get();
    if (!currentUserId) {
      console.warn('No userId to generate unified missions.');
      return [];
    }

    if (!FEATURE_FLAGS.isEnabled('AI_DYNAMIC_MISSIONS')) {
      return [];
    }

    try {
      const missions = await unifiedGamificationService.generateUnifiedMissions(currentUserId);
      
      // Update local state with missions
      set({ currentMissions: missions });

      return missions;
    } catch (error) {
      console.error('Unified mission generation failed:', error);
      return [];
    }
  },

  updateMissionProgress: async (missionId: string, increment: number = 1) => {
    const { currentUserId, currentMissions } = get();
    if (!currentUserId) {
      console.warn('No userId to update mission progress.');
      return false;
    }

    try {
      const success = await unifiedGamificationService.updateUnifiedMissionProgress(
        currentUserId,
        missionId,
        increment
      );

      if (success) {
        // Update local missions state
        const updatedMissions = currentMissions.map(mission => {
          if (mission.id === missionId) {
            const newProgress = mission.currentProgress + increment;
            
            // Check if mission is completed
            if (newProgress >= mission.targetValue) {
              // Mission completed - remove from current missions
              return null;
            } else {
              return { ...mission, currentProgress: newProgress };
            }
          }
          return mission;
        }).filter(Boolean) as UnifiedMission[];

        set({ currentMissions: updatedMissions });

        // Check if mission was completed (for haptic feedback)
        const mission = currentMissions.find(m => m.id === missionId);
        if (mission && mission.currentProgress + increment >= mission.targetValue) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      return success;
    } catch (error) {
      console.error('Mission progress update failed:', error);
      return false;
    }
  },

  getMissionsForToday: () => {
    const { currentMissions } = get();
    const today = new Date().toISOString().split('T')[0];
    
    return currentMissions.filter(mission => {
      const missionDate = new Date(mission.metadata.generatedAt).toISOString().split('T')[0];
      return missionDate === today && mission.expiresAt > Date.now();
    });
  },

})); 