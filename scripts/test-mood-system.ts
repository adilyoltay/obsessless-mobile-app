#!/usr/bin/env npx ts-node

/**
 * 🧪 Mood System Integration Test
 * Tests all critical mood system operations after the fixes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { moodTracker } from '../services/moodTrackingService';

// Mock user for testing
const TEST_USER_ID = 'test-user-' + Date.now();

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class MoodSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Mood System Integration Tests...\n');

    try {
      await this.testSaveMoodEntry();
      await this.testLoadMoodEntries();  
      await this.testDeleteMoodEntry();
      await this.testLocalStorageCleanup();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  private async testSaveMoodEntry(): Promise<void> {
    try {
      console.log('📝 Testing mood entry save...');
      
      const mockEntry = {
        user_id: TEST_USER_ID,
        mood_score: 75,
        energy_level: 8,
        anxiety_level: 3,
        notes: 'Test mood entry with triggers',
        triggers: ['work stress', 'traffic'],
        activities: ['meditation', 'walk']
      };

      const savedEntry = await moodTracker.saveMoodEntry(mockEntry);
      
      if (savedEntry && savedEntry.id) {
        this.results.push({
          testName: 'Save Mood Entry',
          passed: true,
          details: { entryId: savedEntry.id }
        });
        console.log('✅ Mood entry saved successfully');
      } else {
        this.results.push({
          testName: 'Save Mood Entry',
          passed: false,
          error: 'No entry ID returned'
        });
      }
    } catch (error) {
      this.results.push({
        testName: 'Save Mood Entry',
        passed: false,
        error: error.message
      });
      console.log('❌ Mood entry save failed:', error.message);
    }
  }

  private async testLoadMoodEntries(): Promise<void> {
    try {
      console.log('📋 Testing mood entries load...');
      
      // Wait a bit to ensure save completed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const entries = await moodTracker.getMoodEntries(TEST_USER_ID, 1);
      
      if (entries && entries.length > 0) {
        const hasCorrectFormat = entries.every(entry => 
          entry.id && 
          entry.user_id === TEST_USER_ID &&
          typeof entry.mood_score === 'number' &&
          Array.isArray(entry.triggers) &&
          Array.isArray(entry.activities)
        );
        
        this.results.push({
          testName: 'Load Mood Entries',
          passed: hasCorrectFormat,
          details: { 
            entriesCount: entries.length,
            sampleEntry: entries[0]
          }
        });
        
        if (hasCorrectFormat) {
          console.log(`✅ Loaded ${entries.length} mood entries with correct format`);
        } else {
          console.log('❌ Mood entries have incorrect format');
        }
      } else {
        this.results.push({
          testName: 'Load Mood Entries',
          passed: false,
          error: 'No entries returned'
        });
        console.log('❌ No mood entries loaded');
      }
    } catch (error) {
      this.results.push({
        testName: 'Load Mood Entries',
        passed: false,
        error: error.message
      });
      console.log('❌ Mood entries load failed:', error.message);
    }
  }

  private async testDeleteMoodEntry(): Promise<void> {
    try {
      console.log('🗑️ Testing mood entry deletion...');
      
      // Get existing entries
      const entries = await moodTracker.getMoodEntries(TEST_USER_ID, 1);
      
      if (entries && entries.length > 0) {
        const entryToDelete = entries[0];
        await moodTracker.deleteMoodEntry(entryToDelete.id);
        
        // Verify deletion
        const entriesAfterDelete = await moodTracker.getMoodEntries(TEST_USER_ID, 1);
        const entryStillExists = entriesAfterDelete.some(e => e.id === entryToDelete.id);
        
        this.results.push({
          testName: 'Delete Mood Entry',
          passed: !entryStillExists,
          details: {
            deletedEntryId: entryToDelete.id,
            entriesBeforeDelete: entries.length,
            entriesAfterDelete: entriesAfterDelete.length
          }
        });
        
        if (!entryStillExists) {
          console.log('✅ Mood entry deleted successfully');
        } else {
          console.log('❌ Mood entry still exists after deletion');
        }
      } else {
        this.results.push({
          testName: 'Delete Mood Entry',
          passed: false,
          error: 'No entries available to delete'
        });
      }
    } catch (error) {
      this.results.push({
        testName: 'Delete Mood Entry',
        passed: false,
        error: error.message
      });
      console.log('❌ Mood entry deletion failed:', error.message);
    }
  }

  private async testLocalStorageCleanup(): Promise<void> {
    try {
      console.log('🧹 Testing local storage cleanup...');
      
      // Get all mood-related keys
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => key.includes('mood_entries') && key.includes(TEST_USER_ID));
      
      console.log(`📦 Found ${moodKeys.length} mood storage keys for test user`);
      
      // Clean up test data
      await Promise.all(moodKeys.map(key => AsyncStorage.removeItem(key)));
      
      const keysAfterCleanup = await AsyncStorage.getAllKeys();
      const remainingMoodKeys = keysAfterCleanup.filter(key => key.includes('mood_entries') && key.includes(TEST_USER_ID));
      
      this.results.push({
        testName: 'Local Storage Cleanup',
        passed: remainingMoodKeys.length === 0,
        details: {
          keysBeforeCleanup: moodKeys.length,
          keysAfterCleanup: remainingMoodKeys.length
        }
      });
      
      if (remainingMoodKeys.length === 0) {
        console.log('✅ Local storage cleaned up successfully');
      } else {
        console.log(`❌ ${remainingMoodKeys.length} mood keys still remain in storage`);
      }
    } catch (error) {
      this.results.push({
        testName: 'Local Storage Cleanup',
        passed: false,
        error: error.message
      });
      console.log('❌ Local storage cleanup failed:', error.message);
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('=======================');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
    });
    
    console.log(`\n📈 Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (failedTests > 0) {
      console.log(`❌ ${failedTests} tests failed - please check the issues above`);
      process.exit(1);
    } else {
      console.log('✅ All tests passed! Mood system is working correctly.');
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new MoodSystemTester();
  tester.runAllTests().catch(console.error);
}

export { MoodSystemTester };
