
import { ERPExercise, ERPSession, CreateERPRequest, AnxietyReading } from '@/types/erp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from './supabase';

// Default exercises
const DEFAULT_EXERCISES: ERPExercise[] = [
  {
    id: 'default-1',
    title: 'Kapıyı Kontrol Etmeme',
    description: 'Kapıyı sadece bir kez kontrol edip arkasına bakmama egzersizi',
    category: 'checking',
    difficulty: 2,
    targetDuration: 15,
    instructions: [
      'Kapıyı normal şekilde kilitle',
      'Bir kez kontrol et',
      'Geri dönme ve tekrar kontrol etme'
    ],
    createdAt: new Date(),
    completedSessions: 0,
    averageAnxiety: 0
  },
  {
    id: 'default-2',
    title: 'Ellerimi Yıkamama',
    description: 'Kirli hissetsem bile ellerimi fazla yıkamama egzersizi',
    category: 'contamination',
    difficulty: 4,
    targetDuration: 30,
    instructions: [
      'Normal günlük aktiviteleri yap',
      'Kirli hissettiklerinde ellerini yıkama',
      '30 dakika boyunca dayan'
    ],
    createdAt: new Date(),
    completedSessions: 0,
    averageAnxiety: 0
  }
];

class ERPService {
  private getCurrentUserId(): string | null {
    // Get current user ID from Supabase service
    try {
      return supabaseService.getCurrentUser()?.id || null;
    } catch {
      return null;
    }
  }

  private async getStorageKey(key: string, userId?: string): Promise<string> {
    const currentUserId = userId || this.getCurrentUserId();
    return currentUserId ? `${key}_${currentUserId}` : key;
  }

  async getExercises(): Promise<ERPExercise[]> {
    try {
      console.log('🔍 Fetching ERP exercises...');
      
      // Try to get from AsyncStorage first (offline-first)
      const storageKey = await this.getStorageKey('erp_exercises');
      const stored = await AsyncStorage.getItem(storageKey);
      
      if (stored) {
        console.log('✅ ERP exercises loaded from AsyncStorage');
        return JSON.parse(stored);
      }

      // If no stored data, return default exercises and save them
      console.log('📝 Using default ERP exercises');
      await AsyncStorage.setItem(storageKey, JSON.stringify(DEFAULT_EXERCISES));
      return DEFAULT_EXERCISES;
    } catch (error) {
      console.error('❌ Error loading ERP exercises:', error);
      return DEFAULT_EXERCISES;
    }
  }

  async createExercise(data: CreateERPRequest): Promise<ERPExercise> {
    try {
      console.log('🔄 Creating new ERP exercise...');
      
      const newExercise: ERPExercise = {
        ...data,
        id: Date.now().toString(),
        createdAt: new Date(),
        completedSessions: 0,
        averageAnxiety: 0
      };

      // Save to AsyncStorage (offline-first)
      const storageKey = await this.getStorageKey('erp_exercises');
      const existing = await this.getExercises();
      const updated = [...existing, newExercise];
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

      console.log('✅ ERP exercise created and saved to AsyncStorage');
      return newExercise;
    } catch (error) {
      console.error('❌ Error creating ERP exercise:', error);
      throw error;
    }
  }

  async startSession(exerciseId: string, initialAnxiety: number): Promise<ERPSession> {
    try {
      console.log('🔄 Starting ERP session...');
      
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const session: ERPSession = {
        id: Date.now().toString(),
        exerciseId,
        startTime: new Date(),
        duration: 0,
        initialAnxiety,
        peakAnxiety: initialAnxiety,
        finalAnxiety: 0,
        completed: false,
        anxietyReadings: [{
          timestamp: Date.now(),
          level: initialAnxiety
        }]
      };

      // Save to AsyncStorage (offline-first)
      const storageKey = await this.getStorageKey('erp_sessions');
      const existingSessions = await this.getSessionHistory(exerciseId);
      const updatedSessions = [...existingSessions, session];
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSessions));

      console.log('✅ ERP session started and saved to AsyncStorage');
      return session;
    } catch (error) {
      console.error('❌ Error starting ERP session:', error);
      throw error;
    }
  }

  async updateSession(sessionId: string, anxietyLevel: number): Promise<void> {
    try {
      console.log('🔄 Updating ERP session...');
      
      const storageKey = await this.getStorageKey('erp_sessions');
      const stored = await AsyncStorage.getItem(storageKey);
      const sessions: ERPSession[] = stored ? JSON.parse(stored) : [];
      
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex >= 0) {
        sessions[sessionIndex].anxietyReadings.push({
          timestamp: Date.now(),
          level: anxietyLevel
        });
        sessions[sessionIndex].peakAnxiety = Math.max(sessions[sessionIndex].peakAnxiety, anxietyLevel);
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
        console.log('✅ ERP session updated in AsyncStorage');
      }
    } catch (error) {
      console.error('❌ Error updating ERP session:', error);
      throw error;
    }
  }

  async completeSession(sessionId: string, finalAnxiety: number, notes?: string): Promise<ERPSession> {
    try {
      console.log('🔄 Completing ERP session...');
      
      const userId = this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const storageKey = await this.getStorageKey('erp_sessions');
      const stored = await AsyncStorage.getItem(storageKey);
      const sessions: ERPSession[] = stored ? JSON.parse(stored) : [];
      
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex >= 0) {
        const session = sessions[sessionIndex];
        session.endTime = new Date();
        session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
        session.finalAnxiety = finalAnxiety;
        session.notes = notes;
        session.completed = true;

        // Save to AsyncStorage
        await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));

        // Try to save to Supabase (with duplicate prevention)
        try {
          // Check if session already exists in Supabase to prevent duplicates
          const existingSession = await supabaseService.getERPSession(session.id);
          if (!existingSession) {
            // Fetch real exercise metadata for accurate analytics
            const allExercises = await this.getExercises();
            const exerciseMeta = allExercises.find(e => e.id === session.exerciseId);

            await supabaseService.saveERPSession({
              id: session.id, // Include session ID for duplicate prevention
              user_id: userId,
              exercise_id: session.exerciseId,
              exercise_name: exerciseMeta?.title || `Exercise ${session.exerciseId}`,
              category: exerciseMeta?.category || 'general',
              duration_seconds: session.duration,
              anxiety_initial: session.initialAnxiety,
              anxiety_final: session.finalAnxiety,
              anxiety_readings: session.anxietyReadings,
              completed: session.completed
            });
            console.log('✅ ERP session saved to Supabase');
          } else {
            console.log('⚠️ Session already exists in Supabase, skipping duplicate save');
          }
        } catch (supabaseError) {
          console.warn('⚠️ Supabase save failed, session saved offline:', supabaseError);
          // Continue with offline mode - data is already in AsyncStorage
        }

        // Update exercise stats
        await this.updateExerciseStats(session.exerciseId);

        console.log('✅ ERP session completed and saved');
        return session;
      }
      
      throw new Error('Session not found');
    } catch (error) {
      console.error('❌ Error completing ERP session:', error);
      throw error;
    }
  }

  private async updateExerciseStats(exerciseId: string): Promise<void> {
    try {
      const exercises = await this.getExercises();
      const exerciseIndex = exercises.findIndex(e => e.id === exerciseId);
      
      if (exerciseIndex >= 0) {
        const exercise = exercises[exerciseIndex];
        const sessions = await this.getSessionHistory(exerciseId);
        const completedSessions = sessions.filter(s => s.completed);
        
        exercise.completedSessions = completedSessions.length;
        exercise.lastSession = new Date();
        
        if (completedSessions.length > 0) {
          const totalAnxiety = completedSessions.reduce((sum, s) => sum + s.finalAnxiety, 0);
          exercise.averageAnxiety = totalAnxiety / completedSessions.length;
        }

        const storageKey = await this.getStorageKey('erp_exercises');
        await AsyncStorage.setItem(storageKey, JSON.stringify(exercises));
      }
    } catch (error) {
      console.error('❌ Error updating exercise stats:', error);
    }
  }

  async getSessionHistory(exerciseId: string): Promise<ERPSession[]> {
    try {
      const storageKey = await this.getStorageKey('erp_sessions');
      const stored = await AsyncStorage.getItem(storageKey);
      const sessions: ERPSession[] = stored ? JSON.parse(stored) : [];
      
      return sessions.filter(s => s.exerciseId === exerciseId && s.completed);
    } catch (error) {
      console.error('❌ Error loading session history:', error);
      return [];
    }
  }
}

export const erpService = new ERPService();
