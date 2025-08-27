#!/usr/bin/env node
/**
 * 🧪 Mood Idempotency Test Script
 * 
 * Comprehensive test suite for mood entry duplicate prevention.
 * Tests local idempotency, sync queue deduplication, and cross-device scenarios.
 */

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m', 
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

async function runTests() {
  console.log(colorize('\n🧪 MOOD IDEMPOTENCY TEST SUITE', 'cyan'));
  console.log(colorize('=====================================', 'cyan'));
  
  console.log('\n📋 Test Plan:');
  console.log('  1. Local Duplicate Prevention');
  console.log('  2. Sync Queue Deduplication');
  console.log('  3. Cross-Device Race Conditions');
  console.log('  4. Network Interruption Scenarios');
  console.log('  5. Performance & Memory Testing');
  console.log('  6. Content Hash Consistency');
  
  console.log(colorize('\n⚠️  MANUAL TESTING REQUIRED', 'yellow'));
  console.log('This script provides test commands to run in Metro console.');
  console.log('Copy-paste these commands one by one:\n');
  
  // Test 1: Basic Idempotency
  console.log(colorize('1️⃣ BASIC IDEMPOTENCY TEST', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue'));
  console.log(`
import { debugIdempotency } from '@/utils/debugIdempotency';
debugIdempotency.testMoodDuplicates();`);
  
  // Test 2: Stress Test
  console.log(colorize('\n2️⃣ STRESS TEST (Rapid Duplicates)', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue')); 
  console.log(`
debugIdempotency.stressTestIdempotency(10);`);
  
  // Test 3: Stats Check
  console.log(colorize('\n3️⃣ STATISTICS CHECK', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue'));
  console.log(`
debugIdempotency.getIdempotencyStats();`);
  
  // Test 4: Cleanup Test
  console.log(colorize('\n4️⃣ CLEANUP TEST', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue'));
  console.log(`
debugIdempotency.cleanupIdempotency();`);
  
  // Test 5: Real Mood Entry Test
  console.log(colorize('\n5️⃣ REAL MOOD ENTRY TEST', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue'));
  console.log(`
import { moodTrackingService } from '@/services/moodTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get current user ID
AsyncStorage.getItem('currentUserId').then(async (userId) => {
  if (!userId) {
    console.log('❌ No user ID found. Please login first.');
    return;
  }
  
  console.log('🧪 Testing real mood entry duplicate prevention...');
  
  const testMood = {
    user_id: userId,
    mood_score: 88,
    energy_level: 9,
    anxiety_level: 1,
    notes: 'Testing idempotency system!',
    triggers: ['test'],
    activities: ['debugging']
  };
  
  // Try to save the same mood 3 times rapidly
  console.log('Attempting to save the same mood 3 times...');
  
  const promises = [
    moodTrackingService.saveMoodEntry(testMood),
    moodTrackingService.saveMoodEntry(testMood),
    moodTrackingService.saveMoodEntry(testMood)
  ];
  
  try {
    const results = await Promise.all(promises);
    console.log('Results:');
    results.forEach((result, index) => {
      console.log(\`Entry \${index + 1}: ID = \${result.id}, Synced = \${result.synced}\`);
    });
    
    // Check if all entries have the same ID (proving deduplication)
    const uniqueIds = new Set(results.map(r => r.id));
    if (uniqueIds.size === 1) {
      console.log('✅ SUCCESS: All entries have the same ID - duplicate prevention worked!');
    } else {
      console.log(\`❌ FAILURE: Got \${uniqueIds.size} different IDs - duplicates were created!\`);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
});`);
  
  // Test 6: Queue Duplicate Prevention
  console.log(colorize('\n6️⃣ SYNC QUEUE DUPLICATE PREVENTION', 'green'));
  console.log(colorize('// Copy this to Metro console:', 'blue'));
  console.log(`
import { offlineSyncService } from '@/services/offlineSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Test sync queue duplicate prevention
AsyncStorage.getItem('currentUserId').then(async (userId) => {
  if (!userId) {
    console.log('❌ No user ID found. Please login first.');
    return;
  }
  
  console.log('🧪 Testing sync queue duplicate prevention...');
  
  const testSyncItem = {
    type: 'CREATE',
    entity: 'mood_entry',
    data: {
      user_id: userId,
      mood_score: 77,
      energy_level: 8,
      anxiety_level: 2,
      notes: 'Queue duplicate test',
      triggers: ['queue', 'test'],
      activities: ['testing'],
      local_entry_id: 'test_local_entry_' + Date.now()
    },
    priority: 'high'
  };
  
  console.log('Adding same item to sync queue 3 times...');
  
  // Get queue size before
  const statsBefore = offlineSyncService.getQueueStats();
  console.log(\`Queue size before: \${statsBefore.size}\`);
  
  // Try to add the same item 3 times
  await offlineSyncService.addToSyncQueue(testSyncItem);
  await offlineSyncService.addToSyncQueue(testSyncItem);
  await offlineSyncService.addToSyncQueue(testSyncItem);
  
  // Get queue size after
  const statsAfter = offlineSyncService.getQueueStats();
  console.log(\`Queue size after: \${statsAfter.size}\`);
  
  const itemsAdded = statsAfter.size - statsBefore.size;
  if (itemsAdded === 1) {
    console.log('✅ SUCCESS: Only 1 item added to queue - duplicate prevention worked!');
  } else {
    console.log(\`❌ FAILURE: \${itemsAdded} items added to queue - duplicates were created!\`);
  }
});`);
  
  // Expected Results
  console.log(colorize('\n📊 EXPECTED RESULTS', 'magenta'));
  console.log('✅ Test 1: Should show 1 allowed, rest blocked');
  console.log('✅ Test 2: Should show 1 allowed, 9 blocked');
  console.log('✅ Test 3: Should show stats with processed entries');
  console.log('✅ Test 4: Should show cleanup count');
  console.log('✅ Test 5: Should show all entries have same ID');
  console.log('✅ Test 6: Should show only 1 item added to queue');
  
  // Troubleshooting
  console.log(colorize('\n🔧 TROUBLESHOOTING', 'yellow'));
  console.log('If tests fail:');
  console.log('1. Check console for idempotency logs (🛡️ prefix)');
  console.log('2. Verify user is logged in');
  console.log('3. Check AsyncStorage for idempotency entries');
  console.log('4. Monitor sync queue size changes');
  console.log('5. Look for content hash generation errors');
  
  console.log(colorize('\n🚀 READY TO TEST!', 'green'));
  console.log('Open Metro console and run the commands above one by one.');
  console.log('');
}

if (require.main === module) {
  runTests();
}
