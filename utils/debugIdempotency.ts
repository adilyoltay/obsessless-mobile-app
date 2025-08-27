/**
 * 🔧 Debug Idempotency Utilities
 * 
 * Debugging utilities for testing and monitoring the idempotency system.
 * Use in Metro console: `debugIdempotency.testMoodDuplicates()`
 */

import { idempotencyService } from '@/services/idempotencyService';

/**
 * 🧪 Test mood entry duplicate prevention
 */
export const testMoodDuplicates = async () => {
  console.log('🧪 Testing mood entry idempotency...');
  
  const testUserId = 'test-user-12345';
  const baseMood = {
    user_id: testUserId,
    mood_score: 75,
    energy_level: 8,
    anxiety_level: 3,
    notes: 'Feeling good today!',
    triggers: ['work', 'exercise'],
    activities: ['meditation']
  };
  
  try {
    // Test 1: First entry should be allowed
    console.log('\n1️⃣ Testing first entry...');
    const result1 = await idempotencyService.checkMoodEntryIdempotency(baseMood);
    console.log('Result 1:', {
      isDuplicate: result1.isDuplicate,
      shouldProcess: result1.shouldProcess,
      localEntryId: result1.localEntryId
    });
    
    if (result1.shouldProcess) {
      await idempotencyService.markAsProcessed(result1.localEntryId, result1.contentHash, testUserId);
      console.log('✅ Marked first entry as processed');
    }
    
    // Test 2: Exact duplicate should be blocked
    console.log('\n2️⃣ Testing exact duplicate...');
    const result2 = await idempotencyService.checkMoodEntryIdempotency(baseMood);
    console.log('Result 2:', {
      isDuplicate: result2.isDuplicate,
      shouldProcess: result2.shouldProcess,
      localEntryId: result2.localEntryId
    });
    
    // Test 3: Similar but different entry should be allowed
    console.log('\n3️⃣ Testing similar but different entry...');
    const differentMood = { ...baseMood, mood_score: 74, notes: 'Feeling pretty good today!' };
    const result3 = await idempotencyService.checkMoodEntryIdempotency(differentMood);
    console.log('Result 3:', {
      isDuplicate: result3.isDuplicate,
      shouldProcess: result3.shouldProcess,
      localEntryId: result3.localEntryId
    });
    
    // Test 4: Same content, different day should be allowed
    console.log('\n4️⃣ Testing same content, different day...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureMood = { ...baseMood, timestamp: tomorrow.toISOString() };
    const result4 = await idempotencyService.checkMoodEntryIdempotency(futureMood);
    console.log('Result 4:', {
      isDuplicate: result4.isDuplicate,
      shouldProcess: result4.shouldProcess,
      localEntryId: result4.localEntryId
    });
    
    console.log('\n✅ Idempotency test completed successfully!');
    
  } catch (error) {
    console.error('❌ Idempotency test failed:', error);
  }
};

/**
 * 📊 Get idempotency statistics
 */
export const getIdempotencyStats = async (userId?: string) => {
  console.log('📊 Fetching idempotency stats...');
  
  try {
    const stats = await idempotencyService.getStats(userId);
    console.log('\n📈 Idempotency Statistics:');
    console.log(`Total entries: ${stats.totalEntries}`);
    console.log(`Processed entries: ${stats.processedEntries}`);
    console.log(`Queued entries: ${stats.queuedEntries}`);
    console.log(`Failed entries: ${stats.failedEntries}`);
    console.log(`Oldest entry: ${stats.oldestEntry}`);
    
    if (stats.totalEntries > 0) {
      const processedRate = ((stats.processedEntries / stats.totalEntries) * 100).toFixed(1);
      const queuedRate = ((stats.queuedEntries / stats.totalEntries) * 100).toFixed(1);
      const failedRate = ((stats.failedEntries / stats.totalEntries) * 100).toFixed(1);
      
      console.log(`\n📊 Success rate: ${processedRate}%`);
      console.log(`🔄 Queue rate: ${queuedRate}%`);
      console.log(`❌ Failure rate: ${failedRate}%`);
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get idempotency stats:', error);
  }
};

/**
 * 🧹 Clean up old idempotency entries
 */
export const cleanupIdempotency = async () => {
  console.log('🧹 Cleaning up old idempotency entries...');
  
  try {
    const deletedCount = await idempotencyService.cleanupOldEntries();
    console.log(`✅ Cleaned up ${deletedCount} old idempotency entries`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Failed to cleanup idempotency entries:', error);
  }
};

/**
 * 🚀 Simulate rapid mood entries (stress test)
 */
export const stressTestIdempotency = async (count: number = 5) => {
  console.log(`🚀 Stress testing idempotency with ${count} rapid entries...`);
  
  const testUserId = 'stress-test-user';
  const baseMood = {
    user_id: testUserId,
    mood_score: 80,
    energy_level: 7,
    anxiety_level: 2,
    notes: 'Stress test entry',
    triggers: ['test'],
    activities: ['testing']
  };
  
  try {
    // Send multiple identical requests simultaneously
    const promises = Array.from({ length: count }, async (_, index) => {
      const result = await idempotencyService.checkMoodEntryIdempotency(baseMood);
      console.log(`Entry ${index + 1}: ${result.isDuplicate ? '🛡️ BLOCKED' : '✅ ALLOWED'} (${result.localEntryId})`);
      
      if (result.shouldProcess && index === 0) {
        // Only mark the first one as processed
        await idempotencyService.markAsProcessed(result.localEntryId, result.contentHash, testUserId);
      }
      
      return result;
    });
    
    const results = await Promise.all(promises);
    
    const allowedCount = results.filter(r => r.shouldProcess).length;
    const blockedCount = results.filter(r => r.isDuplicate).length;
    
    console.log(`\n📊 Stress test results:`);
    console.log(`✅ Allowed: ${allowedCount} (should be 1)`);
    console.log(`🛡️ Blocked: ${blockedCount} (should be ${count - 1})`);
    
    const success = allowedCount === 1 && blockedCount === (count - 1);
    console.log(success ? '🎉 Stress test PASSED!' : '❌ Stress test FAILED!');
    
    return { success, allowedCount, blockedCount };
    
  } catch (error) {
    console.error('❌ Stress test failed:', error);
  }
};

// Export all functions for Metro console usage
export const debugIdempotency = {
  testMoodDuplicates,
  getIdempotencyStats,
  cleanupIdempotency,
  stressTestIdempotency
};

// For Metro console: window.debugIdempotency = debugIdempotency
if (typeof global !== 'undefined') {
  (global as any).debugIdempotency = debugIdempotency;
}
