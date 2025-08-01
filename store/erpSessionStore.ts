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
  startSession: (exerciseId: string, exerciseName: string, targetDuration: number, category?: string, categoryName?: string, exerciseType?: string) => void;
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

  startSession: (exerciseId, exerciseName, targetDuration, category, categoryName, exerciseType) => {
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
    const initialAnxiety = get().currentAnxiety;
    
    set({
      isActive: true,
      exerciseId,
      exerciseName,
      category,
      categoryName,
      exerciseType,
      targetDuration,
      elapsedTime: 0,
      anxietyDataPoints: [{
        timestamp: 0,
        level: initialAnxiety,
      }],
      sessionTimer: timer,
      anxietyReminder: reminder,
    });
    
    console.log(`🎯 ERP Session started: ${exerciseName}`);
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
    
    if (sessionTimer) clearInterval(sessionTimer);
    if (anxietyReminder) clearInterval(anxietyReminder);
    
    // Calculate anxiety metrics
    const anxietyLevels = anxietyDataPoints.map(dp => dp.level);
    const initialAnxiety = anxietyLevels[0] || 5;
    const peakAnxiety = Math.max(...anxietyLevels);
    const finalAnxiety = anxietyLevels[anxietyLevels.length - 1] || 5;
    
    const sessionLog = {
      id: Date.now().toString(),
      exerciseId,
      exerciseName,
      category,
      categoryName,
      exerciseType,
      durationSeconds: elapsedTime,
      anxietyDataPoints,
      anxietyInitial: initialAnxiety,
      anxietyPeak: peakAnxiety,
      anxietyFinal: finalAnxiety,
      completedAt: new Date(),
    };
    
    console.log('✅ ERP Session completed:', sessionLog);
    
    // Save session to AsyncStorage if userId is provided
    if (userId) {
      try {
        const dateKey = new Date().toDateString();
        const storageKey = StorageKeys.ERP_SESSIONS(userId, dateKey);
        
        const existingSessions = await AsyncStorage.getItem(storageKey);
        const sessions = existingSessions ? JSON.parse(existingSessions) : [];
        sessions.push(sessionLog);
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
        console.log('✅ Session saved to storage');

        // Save to Supabase database
        try {
          await supabaseService.saveERPSession({
            user_id: userId,
            exercise_id: exerciseId || 'unknown',
            exercise_name: exerciseName || 'Unknown Exercise',
            category: category || 'general',
            duration_seconds: elapsedTime,
            anxiety_initial: initialAnxiety,
            anxiety_final: finalAnxiety,
            anxiety_readings: anxietyDataPoints,
            completed: true,
          });
          console.log('✅ ERP session saved to database');
        } catch (dbError) {
          console.error('❌ Database save failed (offline mode):', dbError);
          // Continue with offline mode - data is already in AsyncStorage
        }
      } catch (error) {
        console.error('❌ Error saving session:', error);
      }
    }
    
    // Reset state
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
    
    // Check if session completed
    if (newElapsedTime >= targetDuration) {
      get().completeSession();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
})); 