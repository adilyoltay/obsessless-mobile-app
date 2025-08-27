/**
 * 🧪 Queue Overflow Debug Test - Metro Console Commands
 * 
 * Copy-paste these functions into Metro console to test queue overflow mechanism
 * Usage: 
 *   - testQueueStats() - Check current queue health
 *   - testQueueOverflow(50) - Add 50 items to test overflow
 *   - testQueueOverflowHeavy() - Add 200+ items to force overflow
 */

// 📊 Check current queue statistics
export const testQueueStats = async () => {
  try {
    const { offlineSyncService } = await import('@/services/offlineSync');
    const stats = offlineSyncService.getQueueStats();
    
    console.log('\n🧪 === QUEUE STATS TEST ===');
    console.log(`📊 Queue Size: ${stats.size}/${stats.maxSize} (${stats.utilizationPercent}%)`);
    console.log(`🚨 Near Capacity: ${stats.isNearCapacity ? 'YES ⚠️' : 'No ✅'}`);
    console.log(`💥 Overflow Count: ${stats.overflowCount}`);
    console.log(`📈 Priority Breakdown:`, stats.priorityCounts);
    console.log(`⏰ Oldest Item Age: ${stats.oldestItemAge ? Math.round(stats.oldestItemAge / 1000) + 's' : 'N/A'}`);
    console.log('================================\n');
    
    return stats;
  } catch (error) {
    console.error('❌ Queue stats test failed:', error);
    throw error;
  }
};

// 🚨 Test queue overflow with configurable item count
export const testQueueOverflow = async (itemCount: number = 50) => {
  try {
    const { offlineSyncService } = await import('@/services/offlineSync');
    
    console.log(`\n🧪 === OVERFLOW TEST (${itemCount} items) ===`);
    
    // Get initial stats
    const initialStats = offlineSyncService.getQueueStats();
    console.log(`📊 Initial Queue: ${initialStats.size}/${initialStats.maxSize}`);
    console.log(`💥 Initial Overflows: ${initialStats.overflowCount}`);
    
    const startTime = Date.now();
    
    // Add synthetic test items
    console.log(`⏳ Adding ${itemCount} synthetic test items...`);
    
    const addPromises = Array.from({ length: itemCount }, async (_, i) => {
      const priority = i < 10 ? 'critical' : i < 25 ? 'high' : 'normal';
      
      try {
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: 'test-overflow-user',
            mood_score: Math.floor(Math.random() * 100),
            energy_level: Math.floor(Math.random() * 10),
            anxiety_level: Math.floor(Math.random() * 10),
            notes: `Overflow test item #${i}`,
            test_marker: `OVERFLOW_TEST_${Date.now()}`
          },
          priority: priority as any
        });
        return { success: true, index: i };
      } catch (error) {
        return { success: false, index: i, error: error instanceof Error ? error.message : String(error) };
      }
    });
    
    const results = await Promise.allSettled(addPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    const duration = Date.now() - startTime;
    
    // Get final stats
    const finalStats = offlineSyncService.getQueueStats();
    
    console.log(`✅ Test completed in ${duration}ms`);
    console.log(`📈 Items Added: ${successful}/${itemCount}`);
    console.log(`❌ Items Failed: ${failed}`);
    console.log(`📊 Final Queue: ${finalStats.size}/${finalStats.maxSize} (${finalStats.utilizationPercent}%)`);
    console.log(`💥 Overflows Triggered: ${finalStats.overflowCount - initialStats.overflowCount}`);
    console.log(`💥 Total Overflows: ${finalStats.overflowCount}`);
    console.log(`🚨 Near Capacity: ${finalStats.isNearCapacity ? 'YES ⚠️' : 'No ✅'}`);
    console.log(`📈 Final Priority Counts:`, finalStats.priorityCounts);
    
    const testResult = {
      itemsAdded: successful,
      itemsFailed: failed,
      overflowsTriggered: finalStats.overflowCount - initialStats.overflowCount,
      queueSizeBefore: initialStats.size,
      queueSizeAfter: finalStats.size,
      duration,
      finalStats
    };
    
    console.log('🧪 Test Result Summary:', testResult);
    console.log('================================\n');
    
    return testResult;
    
  } catch (error) {
    console.error('❌ Queue overflow test failed:', error);
    throw error;
  }
};

// 💥 Heavy test to force queue overflow 
export const testQueueOverflowHeavy = async () => {
  console.log('💥 Running HEAVY overflow test...');
  return testQueueOverflow(200);
};

// 🧹 Quick queue health check
export const quickQueueCheck = async () => {
  const { offlineSyncService } = await import('@/services/offlineSync');
  const stats = offlineSyncService.getQueueStats();
  console.log(`📊 Queue: ${stats.size}/${stats.maxSize} (${stats.utilizationPercent}%) | Overflows: ${stats.overflowCount}`);
  return stats;
};

// 🎯 Test specific overflow boundary (close to limit)
export const testQueueBoundary = async () => {
  const { offlineSyncService } = await import('@/services/offlineSync');
  const currentStats = offlineSyncService.getQueueStats();
  const remainingCapacity = currentStats.maxSize - currentStats.size;
  
  console.log(`🎯 Testing boundary: ${remainingCapacity} items remaining`);
  
  if (remainingCapacity > 50) {
    const itemsToAdd = Math.max(remainingCapacity - 10, 40); // Leave 10 slots, or add 40 minimum
    return testQueueOverflow(itemsToAdd);
  } else {
    console.log('⚠️ Queue already near capacity, running small overflow test');
    return testQueueOverflow(30);
  }
};

// Export for global access in Metro console
if (typeof globalThis !== 'undefined') {
  (globalThis as any).testQueueStats = testQueueStats;
  (globalThis as any).testQueueOverflow = testQueueOverflow;
  (globalThis as any).testQueueOverflowHeavy = testQueueOverflowHeavy;
  (globalThis as any).quickQueueCheck = quickQueueCheck;
  (globalThis as any).testQueueBoundary = testQueueBoundary;
}

console.log(`
🧪 === QUEUE DEBUG COMMANDS LOADED ===
Available in Metro console:
  testQueueStats() - Check queue health  
  testQueueOverflow(50) - Test with 50 items
  testQueueOverflowHeavy() - Heavy test (200 items)
  quickQueueCheck() - Quick status
  testQueueBoundary() - Test near capacity
=====================================
`);
