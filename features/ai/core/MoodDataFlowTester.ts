/**
 * Mood Data Flow Tester
 * 
 * Tests that mood data flows correctly from user input to AI systems.
 * Validates cache keys, data format, and AI module accessibility.
 * 
 * @since 2025-01 - Phase 4 Critical Data Integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import moodTracker from '@/services/moodTrackingService';
import supabaseService from '@/services/supabase';

export interface MoodDataFlowReport {
  testId: string;
  timestamp: number;
  results: {
    moodSaveTest: boolean;
    asyncStorageTest: boolean;
    supabaseTest: boolean;
    aiCacheKeyTest: boolean;
    dataFormatTest: boolean;
  };
  details: {
    savedMoodId?: string;
    cacheKeys: string[];
    errors: string[];
  };
  recommendations: string[];
}

export class MoodDataFlowTester {
  
  /**
   * Run complete mood data flow test
   */
  async runCompleteTest(userId: string): Promise<MoodDataFlowReport> {
    const testId = `mood_flow_test_${Date.now()}`;
    const report: MoodDataFlowReport = {
      testId,
      timestamp: Date.now(),
      results: {
        moodSaveTest: false,
        asyncStorageTest: false,
        supabaseTest: false,
        aiCacheKeyTest: false,
        dataFormatTest: false
      },
      details: {
        cacheKeys: [],
        errors: []
      },
      recommendations: []
    };

    try {
      // Test 1: Save a test mood entry
      console.log('🧪 Testing mood save...');
      const testMoodEntry = await this.testMoodSave(userId);
      if (testMoodEntry) {
        report.results.moodSaveTest = true;
        report.details.savedMoodId = testMoodEntry.id;
      }

      // Test 2: Verify AsyncStorage cache keys
      console.log('🧪 Testing AsyncStorage cache keys...');
      const cacheKeys = await this.testAsyncStorageCacheKeys(userId);
      report.details.cacheKeys = cacheKeys;
      report.results.asyncStorageTest = cacheKeys.length > 0;

      // Test 3: Verify Supabase persistence
      console.log('🧪 Testing Supabase persistence...');
      const supabaseData = await this.testSupabasePersistence(userId);
      report.results.supabaseTest = supabaseData.length > 0;

      // Test 4: Test AI cache key format compatibility
      console.log('🧪 Testing AI cache key compatibility...');
      const aiCompatible = await this.testAICacheKeyCompatibility(userId);
      report.results.aiCacheKeyTest = aiCompatible;

      // Test 5: Test data format compatibility
      console.log('🧪 Testing data format compatibility...');
      const formatCompatible = await this.testDataFormatCompatibility(userId);
      report.results.dataFormatTest = formatCompatible;

      // Generate recommendations
      report.recommendations = this.generateRecommendations(report.results);

    } catch (error) {
      report.details.errors.push(`Test execution failed: ${error}`);
      console.error('🚨 Mood data flow test failed:', error);
    }

    return report;
  }

  /**
   * Test mood entry saving
   */
  private async testMoodSave(userId: string): Promise<any> {
    try {
      const testEntry = {
        user_id: userId,
        mood_score: 75, // Happy test mood
        energy_level: 8,
        anxiety_level: 3,
        notes: 'Test mood entry from data flow test',
        triggers: ['test'],
        activities: ['testing']
      };

      const savedEntry = await moodTracker.saveMoodEntry(testEntry);
      console.log('✅ Mood save test passed:', savedEntry.id);
      return savedEntry;

    } catch (error) {
      console.error('❌ Mood save test failed:', error);
      return null;
    }
  }

  /**
   * Test AsyncStorage cache keys
   */
  private async testAsyncStorageCacheKeys(userId: string): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => 
        key.startsWith('mood_entries_') && key.includes(userId)
      );
      
      console.log(`✅ Found ${moodKeys.length} mood cache keys:`, moodKeys);
      return moodKeys;

    } catch (error) {
      console.error('❌ AsyncStorage test failed:', error);
      return [];
    }
  }

  /**
   * Test Supabase persistence
   */
  private async testSupabasePersistence(userId: string): Promise<any[]> {
    try {
      const moodEntries = await supabaseService.getMoodEntries(userId, 1);
      console.log(`✅ Found ${moodEntries.length} mood entries in Supabase`);
      return moodEntries;

    } catch (error) {
      console.error('❌ Supabase test failed:', error);
      return [];
    }
  }

  /**
   * Test AI cache key compatibility
   */
  private async testAICacheKeyCompatibility(userId: string): Promise<boolean> {
    try {
      // Test the exact key format AI modules expect
      const today = new Date().toISOString().split('T')[0];
      const expectedKey = `mood_entries_${userId}_${today}`;
      
      const data = await AsyncStorage.getItem(expectedKey);
      if (data) {
        const parsed = JSON.parse(data);
        console.log(`✅ AI cache key compatibility test passed: ${expectedKey}`);
        console.log(`   Found ${parsed.length} entries in expected format`);
        return true;
      } else {
        console.log(`⚠️ No data found for AI expected key: ${expectedKey}`);
        return false;
      }

    } catch (error) {
      console.error('❌ AI cache key compatibility test failed:', error);
      return false;
    }
  }

  /**
   * Test data format compatibility
   */
  private async testDataFormatCompatibility(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `mood_entries_${userId}_${today}`;
      
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const entries = JSON.parse(data);
        if (Array.isArray(entries) && entries.length > 0) {
          const rawEntry = entries[0];
          
          // Handle both v1 (plain) and v2 (encrypted) storage formats
          let entry: any;
          
          if (rawEntry.storageVersion === 2 && rawEntry.metadata) {
            // V2 Encrypted format: data is in metadata
            entry = rawEntry.metadata;
            console.log('🔍 Testing v2 encrypted storage format');
          } else if (rawEntry.storageVersion === 1 || !rawEntry.storageVersion) {
            // V1 Plain format: data is at root level
            entry = rawEntry;
            console.log('🔍 Testing v1 plain storage format');
          } else {
            console.log('❌ Unknown storage format version:', rawEntry.storageVersion);
            return false;
          }
          
          // Check required fields AI modules expect
          const requiredFields = ['user_id', 'mood_score', 'energy_level', 'anxiety_level', 'timestamp'];
          const hasRequiredFields = requiredFields.every(field => entry[field] !== undefined);
          
          if (hasRequiredFields) {
            console.log('✅ Data format compatibility test passed');
            console.log('📊 Entry format:', {
              storageVersion: rawEntry.storageVersion || 1,
              fields: Object.keys(entry),
              hasAllRequired: requiredFields.map(field => ({ [field]: entry[field] !== undefined }))
            });
            return true;
          } else {
            const missingFields = requiredFields.filter(f => entry[f] === undefined);
            console.log('❌ Missing required fields:', missingFields);
            console.log('📊 Available fields:', Object.keys(entry));
            console.log('📊 Sample data:', entry);
            return false;
          }
        }
      }
      
      console.log('⚠️ No mood data found for format testing');
      return false;

    } catch (error) {
      console.error('❌ Data format compatibility test failed:', error);
      return false;
    }
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(results: MoodDataFlowReport['results']): string[] {
    const recommendations: string[] = [];

    if (!results.moodSaveTest) {
      recommendations.push('Fix mood save functionality in moodTrackingService');
    }

    if (!results.asyncStorageTest) {
      recommendations.push('Ensure mood entries are cached in AsyncStorage with correct keys');
    }

    if (!results.supabaseTest) {
      recommendations.push('Fix Supabase mood entry persistence');
    }

    if (!results.aiCacheKeyTest) {
      recommendations.push('Fix AI cache key format compatibility - ensure mood_entries_{userId}_{date} keys are populated');
    }

    if (!results.dataFormatTest) {
      recommendations.push('Fix mood data format to include all fields required by AI modules');
    }

    if (Object.values(results).every(Boolean)) {
      recommendations.push('All tests passed! Mood data flow is working correctly.');
    }

    return recommendations;
  }

  /**
   * Get current mood data summary for user
   */
  async getMoodDataSummary(userId: string): Promise<{
    totalEntries: number;
    cacheKeys: string[];
    recentEntries: any[];
    lastEntry?: any;
  }> {
    try {
      // Get all mood cache keys
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => 
        key.startsWith('mood_entries_') && key.includes(userId)
      );

      // Get recent entries
      const recentEntries = await supabaseService.getMoodEntries(userId, 7);
      
      return {
        totalEntries: recentEntries.length,
        cacheKeys: moodKeys,
        recentEntries: recentEntries.slice(0, 3), // Last 3 entries
        lastEntry: recentEntries[0]
      };

    } catch (error) {
      console.error('Failed to get mood data summary:', error);
      return {
        totalEntries: 0,
        cacheKeys: [],
        recentEntries: []
      };
    }
  }
}

// Export singleton instance
export const moodDataFlowTester = new MoodDataFlowTester();
