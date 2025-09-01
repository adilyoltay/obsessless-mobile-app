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
} from '@/services/staticGamification';
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
  voice_mood_checkin: {
    points: 1,
    message: '+1 ✨ Mood Check‑in',
    trigger: 'voice_mood_checkin'
  },
  mood_manual_checkin: {
    points: 1,
    message: '+1 ✍️ Mood (manuel) kaydı',
    trigger: 'mood_manual_checkin'
  },
  breathwork_completed: {
    points: 2,
    message: '+2 🌬️ Breathwork tamamlandı',
    trigger: 'breathwork_completed'
  },
  first_activity_of_day: {
    points: 3,
    message: '+3 ☀️ Günün ilk aktivitesi',
    trigger: 'first_activity_of_day'
  },
  streak_milestone_7: {
    points: 10,
    message: '+10 🔥 7 Günlük Streak!',
    trigger: 'streak_milestone_7'
  },
  streak_milestone_21: {
    points: 25,
    message: '+25 🔥 21 Günlük Streak!',
    trigger: 'streak_milestone_21'
  },
  multi_module_day_2: {
    points: 3,
    message: '+3 🧩 2 modülde aktif oldun',
    trigger: 'multi_module_day_2'
  },
  multi_module_day_3: {
    points: 5,
    message: '+5 🧩 3 modülde aktif oldun',
    trigger: 'multi_module_day_3'
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
    // Runtime flags default
    lastFirstActivityAwardDate: undefined,
    streakMilestonesAwarded: [],
    modulesActiveDate: undefined,
    modulesActiveToday: [],
    multiModuleDayAwarded: 0,
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
          // Reset daily runtime flags
          profile.modulesActiveDate = today;
          profile.modulesActiveToday = [];
          profile.multiModuleDayAwarded = 0;
          profile.lastFirstActivityAwardDate = undefined;
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
    
    // If today is already recorded but streak hasn't started yet (fresh profile), start at 1
    if (profile.lastActivityDate === today) {
      if (profile.streakCurrent === 0) {
        const updatedProfile = {
          ...profile,
          streakCurrent: 1,
          streakBest: Math.max(1, profile.streakBest),
          streakLevel: 'seedling' as const,
          lastActivityDate: today,
        };
        set({ profile: updatedProfile });
        await get().saveProfile();
      }
      // Already processed for today
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
    
    const updatedProfile: UserGamificationProfile = {
      ...profile,
      streakCurrent: newStreak,
      streakBest: Math.max(newStreak, profile.streakBest),
      streakLevel,
      lastActivityDate: today,
      healingPointsToday: 0, // Reset daily points
    };
    
    set({ profile: updatedProfile });
    await get().saveProfile();

    // 🎯 Streak milestone micro-rewards (once per milestone)
    try {
      const { awardMicroReward } = get();
      if (newStreak === 7) {
        await awardMicroReward('streak_milestone_7');
      } else if (newStreak === 21) {
        await awardMicroReward('streak_milestone_21');
      }
    } catch (e) {
      console.warn('⚠️ Streak milestone reward failed:', e);
    }
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
        // compulsion-based achievements removed
          
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
    const today = new Date().toISOString().split('T')[0];
    const state = get();
    let { profile } = state;

    const reward = MICRO_REWARDS[trigger];
    if (!reward) {
      console.warn(`⚠️ Micro reward not found for trigger: ${trigger}`);
      return;
    }

    // Reset daily module set if date changed
    if (profile.modulesActiveDate !== today) {
      profile = {
        ...profile,
        modulesActiveDate: today,
        modulesActiveToday: [],
        multiModuleDayAwarded: 0,
      };
    }

    // Implicit first-activity-of-day bonus (before main reward)
    if (trigger !== 'first_activity_of_day' && profile.lastFirstActivityAwardDate !== today) {
      await state.awardMicroReward('first_activity_of_day');
      profile = get().profile; // refresh local ref after mutation
    }

    // Track modules for multi-module bonuses
    const trackModule = (mod: string) => {
      const setMods = new Set(profile.modulesActiveToday || []);
      setMods.add(mod);
      profile = { ...profile, modulesActiveToday: Array.from(setMods), modulesActiveDate: today };
      set({ profile });
    };

    if (trigger === 'voice_mood_checkin' || trigger === 'mood_manual_checkin') {
      trackModule('mood');
    } else if (trigger === 'breathwork_completed') {
      trackModule('breathwork');
    }

    // Evaluate multi-module thresholds (only once per level)
    const modsCount = profile.modulesActiveToday?.length || 0;
    if (trigger !== 'multi_module_day_2' && trigger !== 'multi_module_day_3') {
      if (modsCount >= 2 && (profile.multiModuleDayAwarded || 0) < 2) {
        // award 2-modules bonus
        await state.awardMicroReward('multi_module_day_2');
        profile = { ...get().profile, multiModuleDayAwarded: 2 };
        set({ profile });
      }
      if (modsCount >= 3 && (profile.multiModuleDayAwarded || 0) < 3) {
        await state.awardMicroReward('multi_module_day_3');
        profile = { ...get().profile, multiModuleDayAwarded: 3 };
        set({ profile });
      }
    }

    // Gating: first_activity_of_day only once per day
    if (trigger === 'first_activity_of_day') {
      if (profile.lastFirstActivityAwardDate === today) return; // already awarded today
      profile = { ...profile, lastFirstActivityAwardDate: today };
      set({ profile });
    }

    // Gating: streak milestones only once per milestone
    if (trigger === 'streak_milestone_7' || trigger === 'streak_milestone_21') {
      const milestone = trigger === 'streak_milestone_7' ? 7 : 21;
      const awarded = new Set(profile.streakMilestonesAwarded || []);
      if (awarded.has(milestone)) return; // already awarded
      awarded.add(milestone);
      profile = { ...profile, streakMilestonesAwarded: Array.from(awarded) };
      set({ profile });
    }

    // Final award apply
    const isWeekend = [0, 6].includes(new Date().getDay());
    const points = isWeekend ? reward.points * 2 : reward.points;
    const updatedProfile = {
      ...profile,
      healingPointsToday: (profile.healingPointsToday || 0) + points,
      healingPointsTotal: (profile.healingPointsTotal || 0) + points,
    };

    set({ 
      profile: updatedProfile,
      lastMicroReward: {
        ...reward,
        points,
        message: isWeekend ? `${reward.message} x2` : reward.message,
      }
    });

    await state.saveProfile();
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
      return { basePoints: 0, contextMultipliers: {}, totalPoints: 0, reasoning: ['No user ID'] } as any;
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
      } as any;
    }

    try {
      // const pointsCalculation = await unifiedGamificationService.awardUnifiedPoints(
      //   currentUserId,
      //   action,
      //   context,
      //   moduleData
      // );
      
      // Fallback calculation since AI service is disabled
      const pointsCalculation = { basePoints: 0, totalPoints: 0 } as any;

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
      } as any;
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
      // const missions = await unifiedGamificationService.generateUnifiedMissions(currentUserId);
      const missions = [] as any; // AI service disabled
      
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
