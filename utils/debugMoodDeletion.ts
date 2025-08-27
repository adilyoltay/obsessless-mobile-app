/**
 * 🛠️ Debug Utilities for Mood Deletion Issues
 * Helper functions to test and debug mood entry deletion
 */

import { moodTracker } from '@/services/moodTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DeletionTestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Test deletion of a specific mood entry by ID
 * ENHANCED: Tests both local and remote behavior
 */
export async function debugMoodDeletion(userId: string, entryId: string): Promise<DeletionTestResult> {
  try {
    console.log(`🔍 DEBUG: Testing deletion of mood entry ${entryId}`);
    
    // 1. Check if entry exists in local storage before deletion
    const localExistsBefore = await moodTracker.checkEntryExistsInLocalStorage(entryId);
    console.log(`🔍 Local storage before deletion: ${localExistsBefore}`);
    
    if (!localExistsBefore) {
      return {
        success: false,
        message: 'Entry not found in local storage before deletion',
        timestamp: Date.now()
      };
    }
    
    // 2. Perform deletion
    console.log('🗑️ Performing standard deletion...');
    await moodTracker.deleteMoodEntry(entryId);
    
    // 3. Wait for deletion to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 4. Check local storage after deletion
    const localExistsAfter = await moodTracker.checkEntryExistsInLocalStorage(entryId);
    console.log(`🔍 Local storage after deletion: ${localExistsAfter}`);
    
    if (localExistsAfter) {
      console.log('⚠️ Entry still in local storage, attempting force deletion...');
      await moodTracker.forceDeleteMoodEntry(entryId);
      
      // Check again after force deletion
      const localExistsAfterForce = await moodTracker.checkEntryExistsInLocalStorage(entryId);
      
      return {
        success: !localExistsAfterForce,
        message: localExistsAfterForce 
          ? 'Entry still exists even after force deletion'
          : 'Entry deleted successfully with force deletion',
        details: {
          standardDeletionWorked: false,
          forceDeletionWorked: !localExistsAfterForce
        },
        timestamp: Date.now()
      };
    }
    
    // 5. Test intelligent merge behavior
    console.log('🔄 Testing intelligent merge behavior...');
    const entriesAfterMerge = await moodTracker.getMoodEntries(userId, 30);
    const existsAfterMerge = entriesAfterMerge.some(entry => entry.id === entryId);
    
    return {
      success: true,
      message: 'Deletion test completed successfully',
      details: { 
        localDeletionWorked: true,
        reappearsAfterMerge: existsAfterMerge,
        explanation: existsAfterMerge 
          ? 'Entry reappeared from remote data via intelligent merge (expected behavior)'
          : 'Entry fully deleted from both local and remote'
      },
      timestamp: Date.now()
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Deletion test failed: ${error}`,
      details: { error: String(error) },
      timestamp: Date.now()
    };
  }
}

/**
 * Test force deletion specifically
 */
export async function debugForceDeletion(userId: string, entryId: string): Promise<DeletionTestResult> {
  try {
    console.log(`🔥 DEBUG: Testing FORCE deletion of mood entry ${entryId}`);
    
    const localExistsBefore = await moodTracker.checkEntryExistsInLocalStorage(entryId);
    if (!localExistsBefore) {
      return {
        success: false,
        message: 'Entry not found in local storage',
        timestamp: Date.now()
      };
    }
    
    await moodTracker.forceDeleteMoodEntry(entryId);
    
    const localExistsAfter = await moodTracker.checkEntryExistsInLocalStorage(entryId);
    
    return {
      success: !localExistsAfter,
      message: localExistsAfter ? 'Force deletion failed' : 'Force deletion successful',
      timestamp: Date.now()
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Force deletion failed: ${error}`,
      details: { error: String(error) },
      timestamp: Date.now()
    };
  }
}

/**
 * List all mood entries with their storage locations
 */
export async function debugMoodStorageLocations(userId: string): Promise<any> {
  try {
    console.log('🔍 DEBUG: Scanning all mood storage locations...');
    
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.includes('mood_entries'));
    
    const storageMap: Record<string, any> = {};
    
    for (const key of moodKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const entries = JSON.parse(data);
          storageMap[key] = {
            count: Array.isArray(entries) ? entries.length : 0,
            entries: Array.isArray(entries) ? entries.map((e: any) => ({
              id: e.id || e.metadata?.id,
              timestamp: e.timestamp || e.metadata?.timestamp,
              storageVersion: e.storageVersion || 1
            })) : []
          };
        }
      } catch (parseError) {
        storageMap[key] = { error: String(parseError) };
      }
    }
    
    console.log('📊 Storage locations found:', Object.keys(storageMap).length);
    return storageMap;
    
  } catch (error) {
    console.error('❌ Failed to scan storage locations:', error);
    return { error: String(error) };
  }
}

/**
 * Force clean all mood storage (USE CAREFULLY!)
 */
export async function debugCleanAllMoodStorage(): Promise<any> {
  try {
    console.warn('⚠️ DEBUG: CLEANING ALL MOOD STORAGE - USE WITH CAUTION!');
    
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.includes('mood_entries'));
    
    console.log(`🗑️ Found ${moodKeys.length} mood storage keys to clean`);
    
    for (const key of moodKeys) {
      await AsyncStorage.removeItem(key);
      console.log(`🗑️ Cleaned: ${key}`);
    }
    
    return {
      success: true,
      message: `Cleaned ${moodKeys.length} storage keys`,
      cleanedKeys: moodKeys
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Clean failed: ${error}`,
      error: String(error)
    };
  }
}

/**
 * Metro console utilities (for manual testing)
 */
export const debugUtils = {
  testDeletion: debugMoodDeletion,
  testForceDeletion: debugForceDeletion,
  scanStorage: debugMoodStorageLocations,
  cleanStorage: debugCleanAllMoodStorage,
};

// Global exposure for Metro console (dev only)
if (__DEV__) {
  (global as any).debugMoodDeletion = debugUtils;
  console.log('🛠️ Mood deletion debug utils available: global.debugMoodDeletion');
  console.log('   Usage:');
  console.log('   - global.debugMoodDeletion.testDeletion(userId, entryId)');
  console.log('   - global.debugMoodDeletion.scanStorage(userId)');
  console.log('   - global.debugMoodDeletion.cleanStorage() // CAREFUL!');
}
