/**
 * 🧹 Debug utilities for identifying and cleaning up invalid mood entries
 * Use these functions in Metro console to diagnose and fix data integrity issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodTrackingService } from '@/services/moodTrackingService';
import { isUUID } from '@/utils/validators';

export interface InvalidEntryReport {
  entryId: string;
  storageKey: string;
  issues: string[];
  data: any;
}

/**
 * 🔍 Scan all mood entries in local storage for data integrity issues
 */
export async function scanForInvalidEntries(userId?: string): Promise<InvalidEntryReport[]> {
  console.log('🔍 Scanning for invalid mood entries...');
  
  const invalidEntries: InvalidEntryReport[] = [];
  
  try {
    // Get all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.startsWith('mood_entries_'));
    
    console.log(`📊 Found ${moodKeys.length} mood storage keys`);
    
    for (const key of moodKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;
        
        const entries = JSON.parse(stored);
        if (!Array.isArray(entries)) continue;
        
        for (const entry of entries) {
          const issues: string[] = [];
          
          // Check required fields
          if (!entry.user_id) {
            issues.push('Missing user_id');
          } else if (!isUUID(entry.user_id)) {
            issues.push('Invalid user_id format');
          }
          
          if (entry.mood_score === undefined || entry.mood_score === null) {
            issues.push('Missing mood_score');
          } else if (typeof entry.mood_score !== 'number') {
            issues.push('Invalid mood_score type');
          } else if (entry.mood_score < 0 || entry.mood_score > 100) {
            issues.push('mood_score out of range (0-100)');
          }
          
          // Check optional but important fields
          if (entry.energy_level !== undefined && (typeof entry.energy_level !== 'number' || entry.energy_level < 0 || entry.energy_level > 10)) {
            issues.push('Invalid energy_level');
          }
          
          if (entry.anxiety_level !== undefined && (typeof entry.anxiety_level !== 'number' || entry.anxiety_level < 0 || entry.anxiety_level > 10)) {
            issues.push('Invalid anxiety_level');
          }
          
          if (!entry.timestamp) {
            issues.push('Missing timestamp');
          }
          
          if (!entry.id) {
            issues.push('Missing entry ID');
          }
          
          // Filter by user if specified
          if (userId && entry.user_id !== userId) {
            continue;
          }
          
          if (issues.length > 0) {
            invalidEntries.push({
              entryId: entry.id || 'NO_ID',
              storageKey: key,
              issues,
              data: entry
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing key ${key}:`, error);
      }
    }
    
    console.log(`🚨 Found ${invalidEntries.length} invalid entries`);
    
    // Group by issue type
    const issueStats = invalidEntries.reduce((stats, entry) => {
      entry.issues.forEach(issue => {
        stats[issue] = (stats[issue] || 0) + 1;
      });
      return stats;
    }, {} as Record<string, number>);
    
    console.log('📊 Issue breakdown:', issueStats);
    
    return invalidEntries;
    
  } catch (error) {
    console.error('❌ Failed to scan for invalid entries:', error);
    return [];
  }
}

/**
 * 🧹 Clean up all invalid entries for a specific user
 */
export async function cleanupInvalidEntriesForUser(userId: string, dryRun: boolean = true): Promise<number> {
  if (!userId || !isUUID(userId)) {
    console.error('❌ Valid user ID required for cleanup');
    return 0;
  }
  
  console.log(`🧹 ${dryRun ? 'DRY RUN' : 'CLEANING'} invalid entries for user: ${userId}`);
  
  const invalidEntries = await scanForInvalidEntries(userId);
  
  if (invalidEntries.length === 0) {
    console.log('✅ No invalid entries found');
    return 0;
  }
  
  if (dryRun) {
    console.log(`🔍 DRY RUN: Would remove ${invalidEntries.length} invalid entries`);
    invalidEntries.forEach(entry => {
      console.log(`  - ${entry.entryId}: ${entry.issues.join(', ')}`);
    });
    return invalidEntries.length;
  }
  
  // Group entries by storage key for efficient cleanup
  const entriesByKey = invalidEntries.reduce((groups, entry) => {
    if (!groups[entry.storageKey]) {
      groups[entry.storageKey] = [];
    }
    groups[entry.storageKey].push(entry);
    return groups;
  }, {} as Record<string, InvalidEntryReport[]>);
  
  let cleanedCount = 0;
  
  for (const [storageKey, keyEntries] of Object.entries(entriesByKey)) {
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) continue;
      
      const allEntries = JSON.parse(stored);
      const invalidIds = keyEntries.map(e => e.entryId);
      
      const validEntries = allEntries.filter((entry: any) => !invalidIds.includes(entry.id));
      
      if (validEntries.length === 0) {
        await AsyncStorage.removeItem(storageKey);
        console.log(`🗑️ Removed empty storage key: ${storageKey}`);
      } else {
        await AsyncStorage.setItem(storageKey, JSON.stringify(validEntries));
        console.log(`🧹 Cleaned ${storageKey}: ${allEntries.length} → ${validEntries.length}`);
      }
      
      cleanedCount += keyEntries.length;
      
    } catch (error) {
      console.error(`❌ Failed to clean storage key ${storageKey}:`, error);
    }
  }
  
  console.log(`✅ Cleanup complete: Removed ${cleanedCount} invalid entries`);
  return cleanedCount;
}

/**
 * 🔄 Force trigger auto-recovery to test the new validation logic
 */
export async function testAutoRecovery(userId: string): Promise<void> {
  if (!userId || !isUUID(userId)) {
    console.error('❌ Valid user ID required for auto-recovery test');
    return;
  }
  
  console.log('🔄 Testing auto-recovery with new validation...');
  
  try {
    const moodService = new MoodTrackingService();
    const result = await (moodService as any).autoRecoverUnsyncedEntries(userId);
    
    console.log('📊 Auto-recovery result:', result);
    
  } catch (error) {
    console.error('❌ Auto-recovery test failed:', error);
  }
}

/**
 * 📋 Get summary of mood data integrity status
 */
export async function getMoodDataIntegrityReport(userId?: string): Promise<void> {
  console.log('📋 Generating mood data integrity report...');
  
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.startsWith('mood_entries_'));
    
    let totalEntries = 0;
    let totalUsers = new Set<string>();
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;
    
    for (const key of moodKeys) {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) continue;
      
      try {
        const entries = JSON.parse(stored);
        totalEntries += entries.length;
        
        entries.forEach((entry: any) => {
          if (entry.user_id) {
            totalUsers.add(entry.user_id);
          }
          if (entry.timestamp) {
            const entryDate = new Date(entry.timestamp);
            if (!oldestEntry || entryDate < oldestEntry) {
              oldestEntry = entryDate;
            }
            if (!newestEntry || entryDate > newestEntry) {
              newestEntry = entryDate;
            }
          }
        });
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse ${key}`);
      }
    }
    
    const invalidEntries = await scanForInvalidEntries(userId);
    
    console.log('📊 MOOD DATA INTEGRITY REPORT:');
    console.log(`  Storage Keys: ${moodKeys.length}`);
    console.log(`  Total Entries: ${totalEntries}`);
    console.log(`  Unique Users: ${totalUsers.size}`);
    console.log(`  Invalid Entries: ${invalidEntries.length} (${((invalidEntries.length / totalEntries) * 100).toFixed(1)}%)`);
    console.log(`  Date Range: ${oldestEntry?.toLocaleDateString()} - ${newestEntry?.toLocaleDateString()}`);
    
    if (userId) {
      const userInvalidEntries = invalidEntries.filter(e => e.data.user_id === userId);
      console.log(`  User ${userId} Invalid: ${userInvalidEntries.length}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate integrity report:', error);
  }
}

// Export all functions for Metro console access
export const debugInvalidEntries = {
  scan: scanForInvalidEntries,
  cleanup: cleanupInvalidEntriesForUser,
  testRecovery: testAutoRecovery,
  report: getMoodDataIntegrityReport
};

// Auto-register in global scope for development
if (__DEV__ && typeof global !== 'undefined') {
  (global as any).debugInvalidEntries = debugInvalidEntries;
  console.log('🧹 Debug utilities loaded: global.debugInvalidEntries');
}
