import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from './storage';
import supabaseService from '@/services/supabase';

/**
 * ERP Debug Helper
 * Comprehensive debugging utilities for ERP data flow
 */

export const ERPDebugHelper = {
  /**
   * Verify complete ERP data flow
   */
  async verifyDataFlow(userId: string) {
    console.log('🔍 ========== ERP DATA FLOW VERIFICATION ==========');
    console.log(`📋 User ID: ${userId}`);
    console.log(`📅 Date: ${new Date().toDateString()}`);
    
    try {
      // 1. Check AsyncStorage
      console.log('\n1️⃣ CHECKING ASYNCSTORAGE...');
      const dateKey = new Date().toDateString();
      const storageKey = StorageKeys.ERP_SESSIONS(userId, dateKey);
      const localData = await AsyncStorage.getItem(storageKey);
      const localSessions = localData ? JSON.parse(localData) : [];
      
      console.log(`✅ Local sessions found: ${localSessions.length}`);
      localSessions.forEach((session: any, index: number) => {
        console.log(`  📍 Session ${index + 1}:`, {
          id: session.id,
          exercise: session.exerciseName,
          category: session.category,
          duration: `${session.durationSeconds}s`,
          anxiety: `${session.anxietyInitial} → ${session.anxietyFinal}`,
        });
      });
      
      // 2. Check Supabase
      console.log('\n2️⃣ CHECKING SUPABASE DATABASE...');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      const dbSessions = await supabaseService.getERPSessions(
        userId,
        startOfDay.toISOString(),
        endOfDay.toISOString()
      );
      
      console.log(`✅ Database sessions found: ${dbSessions.length}`);
      dbSessions.forEach((session: any, index: number) => {
        console.log(`  🌐 Session ${index + 1}:`, {
          id: session.id,
          exercise: session.exercise_name,
          category: session.category,
          duration: `${session.duration_seconds}s`,
          anxiety: `${session.anxiety_initial} → ${session.anxiety_final}`,
        });
      });
      
      // 3. Compare data
      console.log('\n3️⃣ DATA CONSISTENCY CHECK...');
      const localIds = new Set(localSessions.map((s: any) => s.id));
      const dbIds = new Set(dbSessions.map((s: any) => s.id));
      
      const onlyInLocal = [...localIds].filter(id => !dbIds.has(id));
      const onlyInDb = [...dbIds].filter(id => !localIds.has(id));
      
      if (onlyInLocal.length > 0) {
        console.log(`⚠️ Sessions only in local storage: ${onlyInLocal.join(', ')}`);
      }
      if (onlyInDb.length > 0) {
        console.log(`⚠️ Sessions only in database: ${onlyInDb.join(', ')}`);
      }
      if (onlyInLocal.length === 0 && onlyInDb.length === 0) {
        console.log('✅ Data is fully synchronized!');
      }
      
      // 4. Check last exercise preference
      console.log('\n4️⃣ CHECKING USER PREFERENCES...');
      const lastExerciseKey = StorageKeys.LAST_ERP_EXERCISE(userId);
      const lastExercise = await AsyncStorage.getItem(lastExerciseKey);
      console.log(`📌 Last exercise: ${lastExercise || 'None'}`);
      
      const lastDuration = await AsyncStorage.getItem(`lastERPDuration_${userId}`);
      console.log(`⏱️ Last duration: ${lastDuration || 'None'} minutes`);
      
      const lastCategory = await AsyncStorage.getItem(`lastERPCategory_${userId}`);
      console.log(`📁 Last category: ${lastCategory || 'None'}`);
      
      console.log('\n✅ ========== VERIFICATION COMPLETE ==========\n');
      
      return {
        localCount: localSessions.length,
        dbCount: dbSessions.length,
        isSynced: onlyInLocal.length === 0 && onlyInDb.length === 0,
        missingInDb: onlyInLocal,
        missingInLocal: onlyInDb,
      };
    } catch (error) {
      console.error('❌ Error during verification:', error);
      throw error;
    }
  },

  /**
   * Test complete ERP flow
   */
  async testCompleteFlow(userId: string) {
    console.log('🧪 ========== TESTING ERP FLOW ==========');
    
    try {
      // 1. Simulate exercise selection
      console.log('\n1️⃣ SIMULATING EXERCISE SELECTION...');
      const testConfig = {
        exerciseId: 'hand_washing',
        exerciseName: 'El Yıkama Direnci',
        exerciseType: 'in_vivo',
        duration: 5, // minutes
        targetAnxiety: 7,
        personalGoal: 'Test goal',
        category: 'contamination',
        categoryName: 'Bulaşma/Temizlik',
      };
      console.log('📋 Test config:', testConfig);
      
      // 2. Save preferences
      console.log('\n2️⃣ SAVING PREFERENCES...');
      await AsyncStorage.setItem(StorageKeys.LAST_ERP_EXERCISE(userId), testConfig.exerciseId);
      await AsyncStorage.setItem(`lastERPDuration_${userId}`, testConfig.duration.toString());
      await AsyncStorage.setItem(`lastERPCategory_${userId}`, testConfig.category);
      console.log('✅ Preferences saved');
      
      // 3. Simulate session completion
      console.log('\n3️⃣ SIMULATING SESSION COMPLETION...');
      const sessionLog = {
        id: `test_${Date.now()}`,
        exerciseId: testConfig.exerciseId,
        exerciseName: testConfig.exerciseName,
        category: testConfig.category,
        categoryName: testConfig.categoryName,
        exerciseType: testConfig.exerciseType,
        durationSeconds: testConfig.duration * 60,
        anxietyDataPoints: [
          { timestamp: 0, level: 7 },
          { timestamp: 150, level: 6 },
          { timestamp: 300, level: 4 },
        ],
        anxietyInitial: 7,
        anxietyPeak: 7,
        anxietyFinal: 4,
        completedAt: new Date(),
      };
      
      // Save to AsyncStorage
      const dateKey = new Date().toDateString();
      const storageKey = StorageKeys.ERP_SESSIONS(userId, dateKey);
      const existingSessions = await AsyncStorage.getItem(storageKey);
      const sessions = existingSessions ? JSON.parse(existingSessions) : [];
      sessions.push(sessionLog);
      await AsyncStorage.setItem(storageKey, JSON.stringify(sessions));
      console.log('✅ Session saved to AsyncStorage');
      
      // Save to Supabase
      try {
        const dbSession = {
          user_id: userId,
          exercise_id: sessionLog.exerciseId,
          exercise_name: sessionLog.exerciseName,
          category: sessionLog.category,
          duration_seconds: sessionLog.durationSeconds,
          anxiety_initial: sessionLog.anxietyInitial,
          anxiety_final: sessionLog.anxietyFinal,
          anxiety_readings: sessionLog.anxietyDataPoints,
          completed: true,
        };
        await supabaseService.saveERPSession(dbSession);
        console.log('✅ Session saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed:', dbError);
      }
      
      // 4. Verify data
      console.log('\n4️⃣ VERIFYING SAVED DATA...');
      const verificationResult = await this.verifyDataFlow(userId);
      
      console.log('\n✅ ========== TEST COMPLETE ==========\n');
      return verificationResult;
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    }
  },

  /**
   * Clear all ERP data for user
   */
  async clearAllData(userId: string) {
    console.log('🗑️ Clearing all ERP data for user...');
    
    try {
      // Clear today's sessions
      const dateKey = new Date().toDateString();
      const storageKey = StorageKeys.ERP_SESSIONS(userId, dateKey);
      await AsyncStorage.removeItem(storageKey);
      
      // Clear preferences
      await AsyncStorage.removeItem(StorageKeys.LAST_ERP_EXERCISE(userId));
      await AsyncStorage.removeItem(`lastERPDuration_${userId}`);
      await AsyncStorage.removeItem(`lastERPCategory_${userId}`);
      await AsyncStorage.removeItem(`lastERPTargetAnxiety_${userId}`);
      
      console.log('✅ All ERP data cleared');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  },
};

// Export for console access
if (__DEV__) {
  (global as any).ERPDebug = ERPDebugHelper;
} 