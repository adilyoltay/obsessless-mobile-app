/**
 * 🔍 Advanced Mood Deletion Debug Tools v2
 * Deep investigation tools for persistent deletion issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodTrackingService } from '@/services/moodTrackingService';
import supabaseService from '@/services/supabase';
import { IntelligentMoodMergeService } from '@/features/ai/services/intelligentMoodMergeService';

export interface MoodDeletionReport {
  entryId: string;
  foundInLocal: boolean;
  foundInRemote: boolean;
  foundInCache: boolean;
  locations: string[];
  versions: Array<{
    storageKey: string;
    version: 'v1' | 'v2';
    data: any;
  }>;
}

/**
 * 🔍 Deep scan for a specific mood entry across all storage locations
 */
export async function deepScanMoodEntry(entryId: string, userId: string): Promise<MoodDeletionReport> {
  console.log(`🔍 Deep scanning mood entry: ${entryId}`);
  
  const report: MoodDeletionReport = {
    entryId,
    foundInLocal: false,
    foundInRemote: false,
    foundInCache: false,
    locations: [],
    versions: []
  };
  
  try {
    // 1. Check all local storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => key.startsWith('mood_entries_'));
    
    console.log(`📦 Scanning ${moodKeys.length} local storage keys...`);
    
    for (const key of moodKeys) {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) continue;
        
        const data = JSON.parse(stored);
        
        // Check if it's encrypted (v2) or plain (v1)
        if (data.storageVersion === 2) {
          // V2 encrypted - try to decrypt
          try {
            const { secureDataService } = await import('@/services/encryption/secureDataService');
            const decrypted = await secureDataService.decryptData(data.metadata);
            
            if (Array.isArray(decrypted)) {
              const found = decrypted.find(entry => entry.id === entryId);
              if (found) {
                report.foundInLocal = true;
                report.locations.push(`LOCAL:${key}:v2`);
                report.versions.push({
                  storageKey: key,
                  version: 'v2',
                  data: found
                });
              }
            }
          } catch (decryptError) {
            console.warn(`❌ Failed to decrypt ${key}:`, decryptError);
          }
        } else if (Array.isArray(data)) {
          // V1 plain array
          const found = data.find(entry => entry.id === entryId);
          if (found) {
            report.foundInLocal = true;
            report.locations.push(`LOCAL:${key}:v1`);
            report.versions.push({
              storageKey: key,
              version: 'v1',
              data: found
            });
          }
        }
      } catch (error) {
        console.warn(`❌ Error processing key ${key}:`, error);
      }
    }
    
    // 2. Check remote (Supabase)
    try {
      console.log('🌐 Checking remote (Supabase)...');
      const remoteEntries = await supabaseService.getMoodEntries(userId, 30);
      const foundInRemote = remoteEntries.find(entry => entry.id === entryId);
      
      if (foundInRemote) {
        report.foundInRemote = true;
        report.locations.push('REMOTE:Supabase');
        console.log('🌐 Found in remote:', foundInRemote);
      }
    } catch (remoteError) {
      console.warn('❌ Failed to check remote:', remoteError);
    }
    
    // 3. Check IntelligentMoodMerge cache
    try {
      console.log('🧠 Checking Intelligent Merge cache...');
      const mergeService = IntelligentMoodMergeService.getInstance();
      
      // Try to access cache (this is a bit hacky but needed for debugging)
      const cacheKey = `mood_merge_cache_${userId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      if (cachedData) {
        const cache = JSON.parse(cachedData);
        if (cache.mergedEntries) {
          const foundInCache = cache.mergedEntries.find((entry: any) => entry.id === entryId);
          if (foundInCache) {
            report.foundInCache = true;
            report.locations.push('CACHE:IntelligentMerge');
            console.log('🧠 Found in merge cache:', foundInCache);
          }
        }
      }
    } catch (cacheError) {
      console.warn('❌ Failed to check cache:', cacheError);
    }
    
    // 4. Summary
    console.log(`📊 Deep scan results for ${entryId}:`);
    console.log(`   Found in local: ${report.foundInLocal}`);
    console.log(`   Found in remote: ${report.foundInRemote}`);
    console.log(`   Found in cache: ${report.foundInCache}`);
    console.log(`   Locations: ${report.locations.join(', ')}`);
    console.log(`   Versions found: ${report.versions.length}`);
    
    report.versions.forEach((version, i) => {
      console.log(`   Version ${i + 1}: ${version.storageKey} (${version.version})`);
    });
    
    return report;
    
  } catch (error) {
    console.error('❌ Deep scan failed:', error);
    return report;
  }
}

/**
 * 🧹 Aggressive mood entry cleanup - removes from ALL locations
 */
export async function aggressiveDeleteMoodEntry(entryId: string, userId: string): Promise<void> {
  console.log(`🔥 AGGRESSIVE DELETE: ${entryId}`);
  
  try {
    // 1. First, do the deep scan to see where it exists
    const report = await deepScanMoodEntry(entryId, userId);
    
    if (report.locations.length === 0) {
      console.log('✅ Entry not found anywhere - already clean');
      return;
    }
    
    console.log(`🎯 Entry found in ${report.locations.length} locations, removing...`);
    
    // 2. Remove from all local storage versions
    for (const version of report.versions) {
      try {
        const stored = await AsyncStorage.getItem(version.storageKey);
        if (!stored) continue;
        
        const data = JSON.parse(stored);
        
        if (version.version === 'v2') {
          // Encrypted version - decrypt, filter, re-encrypt
          const { secureDataService } = await import('@/services/encryption/secureDataService');
          const decrypted = await secureDataService.decryptData(data.metadata);
          
          if (Array.isArray(decrypted)) {
            const filtered = decrypted.filter(entry => entry.id !== entryId);
            
            if (filtered.length === 0) {
              await AsyncStorage.removeItem(version.storageKey);
              console.log(`🗑️ Removed empty encrypted key: ${version.storageKey}`);
            } else {
              const encrypted = await secureDataService.encryptData(filtered);
              await AsyncStorage.setItem(version.storageKey, JSON.stringify({
                storageVersion: 2,
                metadata: encrypted
              }));
              console.log(`🧹 Updated encrypted key: ${version.storageKey} (${decrypted.length} → ${filtered.length})`);
            }
          }
        } else {
          // Plain version - direct filter
          const filtered = data.filter((entry: any) => entry.id !== entryId);
          
          if (filtered.length === 0) {
            await AsyncStorage.removeItem(version.storageKey);
            console.log(`🗑️ Removed empty plain key: ${version.storageKey}`);
          } else {
            await AsyncStorage.setItem(version.storageKey, JSON.stringify(filtered));
            console.log(`🧹 Updated plain key: ${version.storageKey} (${data.length} → ${filtered.length})`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to clean ${version.storageKey}:`, error);
      }
    }
    
    // 3. Force remove from remote
    if (report.foundInRemote) {
      try {
        console.log('🌐 Force removing from remote...');
        await supabaseService.deleteMoodEntry(entryId);
        console.log('✅ Removed from remote');
      } catch (remoteError) {
        console.warn('❌ Failed to remove from remote:', remoteError);
      }
    }
    
    // 4. Clear IntelligentMerge cache
    try {
      console.log('🧠 Clearing Intelligent Merge cache...');
      const cacheKey = `mood_merge_cache_${userId}`;
      await AsyncStorage.removeItem(cacheKey);
      console.log('✅ Cleared merge cache');
      
      // Also clear any other mood-related caches
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.includes('mood_merge') || 
        key.includes('mood_cache') || 
        key.includes('unified:')
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`🧹 Cleared ${cacheKeys.length} cache keys`);
      }
    } catch (cacheError) {
      console.warn('❌ Failed to clear caches:', cacheError);
    }
    
    // 5. Verification scan
    console.log('🔍 Verification scan...');
    const verifyReport = await deepScanMoodEntry(entryId, userId);
    
    if (verifyReport.locations.length === 0) {
      console.log('✅ AGGRESSIVE DELETE SUCCESSFUL - Entry completely removed');
    } else {
      console.warn(`⚠️ Entry still found in: ${verifyReport.locations.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Aggressive delete failed:', error);
  }
}

/**
 * 🧪 Test deletion resilience - create, delete, verify
 */
export async function testDeletionResilience(userId: string): Promise<void> {
  console.log('🧪 Testing deletion resilience...');
  
  try {
    const moodService = new MoodTrackingService();
    
    // 1. Create a test entry
    const testEntry = {
      user_id: userId,
      mood_score: 75,
      energy_level: 8,
      anxiety_level: 3,
      notes: 'Test entry for deletion resilience',
      triggers: ['test'],
      activities: ['testing']
    };
    
    console.log('📝 Creating test entry...');
    const created = await moodService.saveMoodEntry(testEntry);
    console.log(`✅ Test entry created: ${created.id}`);
    
    // 2. Wait a bit for any async processes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Do deep scan to see where it landed
    const beforeReport = await deepScanMoodEntry(created.id, userId);
    console.log(`📊 Test entry found in ${beforeReport.locations.length} locations before deletion`);
    
    // 4. Delete it aggressively
    await aggressiveDeleteMoodEntry(created.id, userId);
    
    // 5. Wait and verify
    await new Promise(resolve => setTimeout(resolve, 1000));
    const afterReport = await deepScanMoodEntry(created.id, userId);
    
    if (afterReport.locations.length === 0) {
      console.log('✅ DELETION RESILIENCE TEST PASSED');
    } else {
      console.error(`❌ DELETION RESILIENCE TEST FAILED - Still in: ${afterReport.locations.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Deletion resilience test failed:', error);
  }
}

/**
 * 💥 Nuclear option - clear ALL mood data for user (USE WITH EXTREME CAUTION)
 */
export async function nuclearMoodCleanup(userId: string, confirm: boolean = false): Promise<void> {
  if (!confirm) {
    console.warn('⚠️ NUCLEAR CLEANUP - This will DELETE ALL mood data for the user!');
    console.warn('⚠️ Call with nuclearMoodCleanup(userId, true) to confirm');
    return;
  }
  
  console.log(`💥 NUCLEAR MOOD CLEANUP for user: ${userId}`);
  console.warn('⚠️ This will permanently delete ALL mood data!');
  
  try {
    // 1. Remove all local mood data
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => 
      key.startsWith('mood_entries_') || 
      key.includes(userId)
    );
    
    if (moodKeys.length > 0) {
      await AsyncStorage.multiRemove(moodKeys);
      console.log(`🗑️ Removed ${moodKeys.length} local storage keys`);
    }
    
    // 2. Clear all caches
    const cacheKeys = allKeys.filter(key => 
      key.includes('mood') || 
      key.includes('unified:') ||
      key.includes('cache')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🧹 Cleared ${cacheKeys.length} cache keys`);
    }
    
    // 3. Clear remote data (if possible)
    try {
      console.log('🌐 Clearing remote mood data...');
      const remoteEntries = await supabaseService.getMoodEntries(userId, 365); // Get all entries
      
      for (const entry of remoteEntries) {
        try {
          await supabaseService.deleteMoodEntry(entry.id);
        } catch (error) {
          console.warn(`❌ Failed to delete remote entry ${entry.id}:`, error);
        }
      }
      
      console.log(`🗑️ Removed ${remoteEntries.length} remote entries`);
    } catch (remoteError) {
      console.warn('❌ Failed to clear remote data:', remoteError);
    }
    
    console.log('💥 NUCLEAR CLEANUP COMPLETED');
    console.warn('⚠️ ALL mood data has been permanently deleted!');
    
  } catch (error) {
    console.error('❌ Nuclear cleanup failed:', error);
  }
}

// Export debug interface
export const debugMoodDeletionV2 = {
  deepScan: deepScanMoodEntry,
  aggressiveDelete: aggressiveDeleteMoodEntry,
  testResilience: testDeletionResilience,
  nuclearCleanup: nuclearMoodCleanup
};

// Auto-register for development
if (__DEV__ && typeof global !== 'undefined') {
  (global as any).debugMoodDeletionV2 = debugMoodDeletionV2;
  console.log('🔍 Advanced mood deletion debug tools loaded: debugMoodDeletionV2');
}
