import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Debug helper for testing user-specific storage
 * Use this in development only!
 */

export const DebugHelper = {
  // View all storage keys
  async viewAllKeys() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('📦 All Storage Keys:', keys);
      return keys;
    } catch (error) {
      console.error('❌ Error viewing keys:', error);
      return [];
    }
  },

  // View all data for a specific user
  async viewUserData(userId: string) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.includes(userId));
      
      console.log(`👤 User ${userId} Keys:`, userKeys);
      
      const userData: Record<string, any> = {};
      
      for (const key of userKeys) {
        const value = await AsyncStorage.getItem(key);
        userData[key] = value ? JSON.parse(value) : null;
      }
      
      console.log(`📊 User ${userId} Data:`, userData);
      return userData;
    } catch (error) {
      console.error('❌ Error viewing user data:', error);
      return {};
    }
  },

  // Check data isolation between users
  async checkDataIsolation(userId1: string, userId2: string) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      const user1Keys = keys.filter(key => key.includes(userId1));
      const user2Keys = keys.filter(key => key.includes(userId2));
      
      console.log(`👤 User 1 (${userId1}) has ${user1Keys.length} keys`);
      console.log(`👤 User 2 (${userId2}) has ${user2Keys.length} keys`);
      
      // Check for any overlap
      const overlap = user1Keys.filter(key => user2Keys.includes(key));
      
      if (overlap.length > 0) {
        console.error('❌ DATA ISOLATION BREACH! Shared keys:', overlap);
        return false;
      } else {
        console.log('✅ Data isolation verified - No shared keys');
        return true;
      }
    } catch (error) {
      console.error('❌ Error checking isolation:', error);
      return false;
    }
  },

  // Clear all data (USE WITH CAUTION!)
  async clearAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      console.log('🗑️ All data cleared');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
    }
  },

  // Simulate test scenarios
  async runTestScenario(scenario: 'new_user' | 'existing_user' | 'multi_user') {
    console.log(`🧪 Running test scenario: ${scenario}`);
    
    switch (scenario) {
      case 'new_user':
        console.log('📝 Test: New user should have no existing data');
        const newUserId = `test_new_${Date.now()}`;
        const newUserData = await this.viewUserData(newUserId);
        console.log('Result:', Object.keys(newUserData).length === 0 ? '✅ PASS' : '❌ FAIL');
        break;
        
      case 'existing_user':
        console.log('📝 Test: Existing user data should persist');
        // This would need actual user ID from auth
        break;
        
      case 'multi_user':
        console.log('📝 Test: Multiple users should have isolated data');
        const user1 = 'test_user_1';
        const user2 = 'test_user_2';
        await this.checkDataIsolation(user1, user2);
        break;
    }
  },

  // Log current user's summary
  async logUserSummary(userId: string) {
    try {
      const userData = await this.viewUserData(userId);
      
      const summary = {
        userId,
        compulsions: userData[`compulsions_${userId}`]?.length || 0,
        gamificationProfile: userData[`gamification_${userId}`] ? '✅' : '❌',
        settings: userData[`settings_${userId}`] ? '✅' : '❌',
        erpSessionsToday: userData[`therapy_sessions_${userId}_${new Date().toDateString()}`]?.length || 0,
      };
      
      console.log('📊 User Summary:', summary);
      return summary;
    } catch (error) {
      console.error('❌ Error getting summary:', error);
      return null;
    }
  }
};

// Export for use in development
if (__DEV__) {
  (global as any).DebugHelper = DebugHelper;
  
  // 🧪 Load debug test functions in development
  import('./debugQueueTest').then(() => {
    console.log('🧪 Queue debug tests loaded - see console for commands');
  }).catch(error => {
    console.warn('⚠️ Failed to load queue debug tests:', error);
  });
  
  import('./debugIdempotency').then((module) => {
    (global as any).debugIdempotency = module.debugIdempotency;
    console.log('🛡️ Idempotency debug tests loaded - use debugIdempotency.*');
  }).catch(error => {
    console.warn('⚠️ Failed to load idempotency debug tests:', error);
  });
  
  import('./debugAIErrors').then((module) => {
    (global as any).debugAIErrors = module.debugAIErrors;
    console.log('🚨 AI Error debug tests loaded - use debugAIErrors.*');
  }).catch(error => {
    console.warn('⚠️ Failed to load AI error debug tests:', error);
  });
  
  import('./debugMoodDeletion').then((module) => {
    (global as any).debugMoodDeletion = module.debugUtils;
    console.log('🗑️ Mood Deletion debug tests loaded - use debugMoodDeletion.*');
  }).catch(error => {
    console.warn('⚠️ Failed to load mood deletion debug tests:', error);
  });
  
  import('./debugInvalidEntries').then((module) => {
    (global as any).debugInvalidEntries = module.debugInvalidEntries;
    console.log('🧹 Invalid Entries debug tests loaded - use debugInvalidEntries.*');
  }).catch(error => {
    console.warn('⚠️ Failed to load invalid entries debug tests:', error);
  });
} 