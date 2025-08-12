import { create } from 'zustand';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/utils/storage';
import supabaseService from '@/services/supabase';

interface AnxietyDataPoint {
  timestamp: number;
  level: number;
}

interface ERPSessionState {
  // Session data
  isActive: boolean;
  exerciseId: string | null;
  exerciseName: string | null;
  category: string | null;
  categoryName: string | null;
  exerciseType: string | null;
  targetDuration: number; // seconds
  elapsedTime: number; // seconds
  currentAnxiety: number; // 1-10
  anxietyDataPoints: AnxietyDataPoint[];
  
  // Timers
  sessionTimer: number | NodeJS.Timeout | null;
  anxietyReminder: number | NodeJS.Timeout | null;
  
  // Actions
  startSession: (config: {
    exerciseId: string;
    exerciseName: string;
    targetDuration: number;
    category?: string;
    categoryName?: string;
    exerciseType?: string;
    initialAnxiety?: number;
  }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: (userId?: string) => Promise<any>;
  abandonSession: () => void;
  updateAnxiety: (level: number) => void;
  tick: () => void;
}

export const useERPSessionStore = create<ERPSessionState>((set, get) => ({
  // Initial state
  isActive: false,
  exerciseId: null,
  exerciseName: null,
  category: null,
  categoryName: null,
  exerciseType: null,
  targetDuration: 0,
  elapsedTime: 0,
  currentAnxiety: 5,
  anxietyDataPoints: [],
  sessionTimer: null,
  anxietyReminder: null,

  startSession: (config: {
    exerciseId: string;
    exerciseName: string;
    targetDuration: number;
    category?: string;
    categoryName?: string;
    exerciseType?: string;
    initialAnxiety?: number;
  }) => {
    const { sessionTimer, anxietyReminder } = get();
    
    // Clear any existing timers
    if (sessionTimer) clearInterval(sessionTimer);
    if (anxietyReminder) clearInterval(anxietyReminder);
    
    // Start session timer
    const timer = setInterval(() => {
      get().tick();
    }, 1000);
    
    // Start anxiety reminder (every 2 minutes as per spec)
    const reminder = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      console.log('⏰ Anxiety check reminder');
    }, 120000); // 2 minutes
    
    // Record initial anxiety
    const initialAnxiety = config.initialAnxiety || get().currentAnxiety;
    
    set({
      isActive: true,
      exerciseId: config.exerciseId,
      exerciseName: config.exerciseName,
      category: config.category || null,
      categoryName: config.categoryName || null,
      exerciseType: config.exerciseType || null,
      targetDuration: config.targetDuration,
      elapsedTime: 0,
      currentAnxiety: initialAnxiety,
      anxietyDataPoints: [{
        timestamp: 0,
        level: initialAnxiety
      }],
      sessionTimer: timer,
      anxietyReminder: reminder,
    });
    
    console.log('🎯 ERP Session started:', config.exerciseName);
  },

  pauseSession: () => {
    const { sessionTimer, anxietyReminder } = get();
    
    if (sessionTimer) clearInterval(sessionTimer);
    if (anxietyReminder) clearInterval(anxietyReminder);
    
    set({
      sessionTimer: null,
      anxietyReminder: null,
    });
    
    console.log('⏸️ ERP Session paused');
  },

  resumeSession: () => {
    const timer = setInterval(() => {
      get().tick();
    }, 1000);
    
    const reminder = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 120000);
    
    set({
      sessionTimer: timer,
      anxietyReminder: reminder,
    });
    
    console.log('▶️ ERP Session resumed');
  },

  completeSession: async (userId?: string) => {
    console.log('🔧 completeSession called with userId:', userId);
    
    const { 
      sessionTimer, 
      anxietyReminder, 
      elapsedTime, 
      anxietyDataPoints,
      exerciseId,
      exerciseName,
      category,
      categoryName,
      exerciseType,
    } = get();
    
    // Validate required data
    if (!exerciseId || !exerciseName) {
      console.error('❌ Missing required session data:', { exerciseId, exerciseName });
      return null;
    }
    
    if (!userId) {
      console.error('❌ No userId provided, cannot save session');
      return null;
    }
    
    console.log('📋 Session data:', {
      elapsedTime,
      exerciseId,
      exerciseName,
      category,
      categoryName,
      exerciseType,
      anxietyDataPointsCount: anxietyDataPoints.length
    });
    
    if (sessionTimer) clearInterval(sessionTimer);
    if (anxietyReminder) clearInterval(anxietyReminder);
    
    // Calculate anxiety metrics
    const anxietyLevels = anxietyDataPoints.map(dp => dp.level);
    const initialAnxiety = anxietyLevels[0] || 5;
    const peakAnxiety = Math.max(...anxietyLevels);
    const finalAnxiety = anxietyLevels[anxietyLevels.length - 1] || 5;
    
    const sessionLog = {
      id: Date.now().toString(),
      exerciseId: exerciseId || 'unknown',
      exerciseName: exerciseName || 'Unknown Exercise',
      category: category || 'general',
      categoryName: categoryName || 'Genel',
      exerciseType: exerciseType || 'in_vivo',
      durationSeconds: elapsedTime,
      anxietyDataPoints,
      anxietyInitial: initialAnxiety,
      anxietyPeak: peakAnxiety,
      anxietyFinal: finalAnxiety,
      completedAt: new Date(),
    };
    
    console.log('✅ ERP Session completed:', sessionLog);
    
    // Save session to AsyncStorage
    try {
      const dateKey = new Date().toDateString();
      const storageKey = StorageKeys.ERP_SESSIONS(userId, dateKey);
      
      console.log('💾 Saving to storage key:', storageKey);
      
      const existingSessions = await AsyncStorage.getItem(storageKey);
      const sessions = existingSessions ? JSON.parse(existingSessions) : [];
      sessions.push(sessionLog);
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
      console.log('✅ Session saved to storage. Total sessions today:', sessions.length);

      // Save to Supabase database
      try {
        console.log('🔄 Attempting to save to database...');
        
        // Ensure all required fields are present
        const dbSession = {
          user_id: userId,
          exercise_id: exerciseId || 'unknown',
          exercise_name: exerciseName || 'Unknown Exercise',
          category: category || 'general',
          duration_seconds: elapsedTime,
          anxiety_initial: initialAnxiety,
          anxiety_final: finalAnxiety,
          anxiety_readings: anxietyDataPoints,
          completed: true,
          // Add timestamp explicitly
          timestamp: new Date().toISOString(),
        };
        
        console.log('📤 Database payload:', dbSession);
        
        await supabaseService.saveERPSession(dbSession);
        console.log('✅ ERP session saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed (offline mode):', dbError);
        // Continue with offline mode - data is already in AsyncStorage
      }
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
    
    // Reset session state
    set({
      isActive: false,
      exerciseId: null,
      exerciseName: null,
      category: null,
      categoryName: null,
      exerciseType: null,
      targetDuration: 0,
      elapsedTime: 0,
      currentAnxiety: 5,
      anxietyDataPoints: [],
      sessionTimer: null,
      anxietyReminder: null,
    });
    
    console.log('🔄 Session state reset');
    
    return sessionLog;
  },

  abandonSession: () => {
    const { sessionTimer, anxietyReminder } = get();
    
    if (sessionTimer) clearInterval(sessionTimer);
    if (anxietyReminder) clearInterval(anxietyReminder);
    
    set({
      isActive: false,
      exerciseId: null,
      exerciseName: null,
      category: null,
      categoryName: null,
      exerciseType: null,
      targetDuration: 0,
      elapsedTime: 0,
      currentAnxiety: 5,
      anxietyDataPoints: [],
      sessionTimer: null,
      anxietyReminder: null,
    });
    
    console.log('❌ ERP Session abandoned');
  },

  updateAnxiety: (level) => {
    const { elapsedTime, anxietyDataPoints } = get();
    
    const newDataPoint = {
      timestamp: elapsedTime,
      level,
    };
    
    set({
      currentAnxiety: level,
      anxietyDataPoints: [...anxietyDataPoints, newDataPoint],
    });
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    console.log(`📊 Anxiety updated: ${level}/10 at ${elapsedTime}s`);
  },

  tick: () => {
    const { elapsedTime, targetDuration, isActive } = get();
    
    if (!isActive) return;
    
    const newElapsedTime = elapsedTime + 1;
    
    set({ elapsedTime: newElapsedTime });
    
    // Don't auto-complete here - let the component handle it with userId
    // The component will check elapsed time and call completeSession with userId
  },
})); 