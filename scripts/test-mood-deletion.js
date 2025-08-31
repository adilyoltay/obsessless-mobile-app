#!/usr/bin/env node
/**
 * Quick Mood Deletion Test Script
 * Debug why deletion isn't working properly
 */

const AsyncStorage = require('@react-native-async-storage/async-storage');

async function debugMoodDeletion() {
  console.log('🔍 Debugging mood deletion issue...\n');
  
  try {
    // 1. Check all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    const moodKeys = allKeys.filter(key => 
      key.includes('mood_entries') || 
      key.includes('mood_') ||
      key.startsWith('mood_entries')
    );
    
    console.log('📦 Storage Keys Analysis:');
    console.log(`   Total keys: ${allKeys.length}`);
    console.log(`   Mood-related keys: ${moodKeys.length}`);
    
    if (moodKeys.length > 0) {
      console.log('   Mood keys found:');
      moodKeys.slice(0, 10).forEach(key => console.log(`     - ${key}`));
      if (moodKeys.length > 10) console.log(`     ... and ${moodKeys.length - 10} more`);
    }
    
    // 2. Check deletion cache
    const deletionCacheKeys = allKeys.filter(key => key.includes('deletion') || key.includes('deleted'));
    console.log(`\n🗑️ Deletion Cache Keys: ${deletionCacheKeys.length}`);
    deletionCacheKeys.forEach(key => console.log(`   - ${key}`));
    
    // 3. Check for specific problematic entry
    const problemEntry = 'mood_ulzbmo_20250830T1743';
    console.log(`\n🎯 Searching for problematic entry: ${problemEntry}`);
    
    for (const key of moodKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const entries = JSON.parse(data);
          const foundEntry = Array.isArray(entries) ? 
            entries.find(e => {
              const metadata = e.metadata || e;
              return metadata.id === problemEntry || 
                     metadata.local_id === problemEntry || 
                     metadata.remote_id === problemEntry;
            }) : null;
          
          if (foundEntry) {
            console.log(`   ✅ Found in key: ${key}`);
            console.log(`   📄 Entry data:`, {
              id: foundEntry.metadata?.id || foundEntry.id,
              local_id: foundEntry.metadata?.local_id || foundEntry.local_id,
              remote_id: foundEntry.metadata?.remote_id || foundEntry.remote_id,
              storageVersion: foundEntry.storageVersion
            });
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Error reading ${key}:`, error.message);
      }
    }
    
    console.log('\n🚀 Deletion Debug Complete!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

if (require.main === module) {
  debugMoodDeletion().catch(console.error);
}

module.exports = { debugMoodDeletion };
