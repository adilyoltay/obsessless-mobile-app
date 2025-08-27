/**
 * 🔍 Simple Mood Deletion Debug - Direct console execution
 * Manual functions for immediate testing without import issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 🔍 Simple scan for mood entry locations
 */
export async function simpleScanMoodEntry(entryId: string): Promise<void> {
  console.log(`🔍 Simple scanning for mood entry: ${entryId}`);
  
  try {
    // Get all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.startsWith('mood_entries_'));
    
    console.log(`📦 Found ${moodKeys.length} mood storage keys to scan`);
    
    let foundLocations: string[] = [];
    
    for (const key of moodKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;
        
        const data = JSON.parse(stored);
        
        // Check both v1 and v2 formats
        if (data.storageVersion === 2) {
          // V2 encrypted format
          foundLocations.push(`${key} (v2-encrypted)`);
          console.log(`📦 Found storage key: ${key} (v2-encrypted)`);
        } else if (Array.isArray(data)) {
          // V1 plain format
          const found = data.find(entry => entry.id === entryId);
          if (found) {
            foundLocations.push(`${key} (v1-plain)`);
            console.log(`🎯 FOUND ENTRY in ${key} (v1-plain):`, found);
          }
        }
      } catch (error) {
        console.warn(`❌ Error processing key ${key}:`, error);
      }
    }
    
    // Summary
    console.log(`📊 SCAN RESULTS:`);
    console.log(`   Entry ID: ${entryId}`);
    console.log(`   Total mood keys: ${moodKeys.length}`);
    console.log(`   Found in locations: ${foundLocations.length}`);
    foundLocations.forEach(location => {
      console.log(`   - ${location}`);
    });
    
    if (foundLocations.length === 0) {
      console.log(`✅ Entry ${entryId} NOT FOUND in any local storage`);
    }
    
    return;
    
  } catch (error) {
    console.error('❌ Simple scan failed:', error);
  }
}

/**
 * 📋 List all mood entries for debugging
 */
export async function listAllMoodEntries(): Promise<void> {
  console.log('📋 Listing ALL mood entries in local storage...');
  
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.startsWith('mood_entries_'));
    
    let totalEntries = 0;
    
    for (const key of moodKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;
        
        const data = JSON.parse(stored);
        
        if (data.storageVersion === 2) {
          console.log(`📦 ${key}: v2-encrypted format (can't count entries)`);
        } else if (Array.isArray(data)) {
          console.log(`📦 ${key}: ${data.length} entries (v1-plain)`);
          data.forEach((entry, i) => {
            console.log(`   ${i + 1}. ${entry.id} - Mood: ${entry.mood_score}, Created: ${new Date(entry.timestamp).toLocaleString()}`);
          });
          totalEntries += data.length;
        }
      } catch (error) {
        console.warn(`❌ Error reading ${key}:`, error);
      }
    }
    
    console.log(`📊 TOTAL visible entries: ${totalEntries}`);
    
  } catch (error) {
    console.error('❌ List all failed:', error);
  }
}

/**
 * 🧹 Simple cleanup of specific storage key
 */
export async function simpleCleanupKey(storageKey: string): Promise<void> {
  console.log(`🧹 Simple cleanup of storage key: ${storageKey}`);
  
  try {
    const existing = await AsyncStorage.getItem(storageKey);
    if (!existing) {
      console.log(`❌ Key ${storageKey} not found`);
      return;
    }
    
    await AsyncStorage.removeItem(storageKey);
    console.log(`✅ Removed storage key: ${storageKey}`);
    
  } catch (error) {
    console.error(`❌ Failed to cleanup ${storageKey}:`, error);
  }
}
