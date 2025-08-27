/**
 * 🧪 Queue Overflow Test Runner
 * 
 * Runs automated queue overflow tests and displays results
 */

const testQueueOverflow = async () => {
  try {
    console.log('\n🧪 === QUEUE OVERFLOW TEST RUNNER ===');
    console.log('⏳ Initializing test environment...\n');

    // Check if we can access the services
    const offlineSync = await import('../services/offlineSync.js');
    const offlineSyncService = offlineSync.offlineSyncService;

    // TEST 1: Initial Queue Stats
    console.log('📊 TEST 1: Initial Queue Stats');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const initialStats = offlineSyncService.getQueueStats();
    console.log(`Queue Size: ${initialStats.size}/${initialStats.maxSize} (${initialStats.utilizationPercent}%)`);
    console.log(`Overflow Count: ${initialStats.overflowCount}`);
    console.log(`Near Capacity: ${initialStats.isNearCapacity ? '⚠️ YES' : '✅ No'}`);
    console.log(`Priority Breakdown:`, initialStats.priorityCounts);
    console.log('');

    // TEST 2: Light Load Test (50 items)
    console.log('🔬 TEST 2: Light Load Test (50 items)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const lightTestStart = Date.now();
    let addedItems = 0;
    let failedItems = 0;

    for (let i = 0; i < 50; i++) {
      try {
        const priority = i < 5 ? 'critical' : i < 15 ? 'high' : 'normal';
        
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: 'test-overflow-user',
            mood_score: Math.floor(Math.random() * 100),
            energy_level: Math.floor(Math.random() * 10),
            anxiety_level: Math.floor(Math.random() * 10),
            notes: `Light test item #${i}`,
            test_marker: `LIGHT_TEST_${Date.now()}`
          },
          priority: priority
        });
        addedItems++;
      } catch (error) {
        console.warn(`❌ Item ${i} failed:`, error.message);
        failedItems++;
      }
    }

    const lightTestDuration = Date.now() - lightTestStart;
    const lightStats = offlineSyncService.getQueueStats();
    
    console.log(`✅ Light test completed in ${lightTestDuration}ms`);
    console.log(`Added: ${addedItems}/50 items`);
    console.log(`Failed: ${failedItems} items`);
    console.log(`Queue Size: ${initialStats.size} → ${lightStats.size}`);
    console.log(`Overflows: ${lightStats.overflowCount - initialStats.overflowCount}`);
    console.log('');

    // TEST 3: Heavy Load Test (200+ items to trigger overflow)
    console.log('💥 TEST 3: Heavy Load Test (Trigger Overflow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const heavyTestStart = Date.now();
    let heavyAddedItems = 0;
    let heavyFailedItems = 0;
    const heavyTestSize = Math.max(200, lightStats.maxSize - lightStats.size + 50); // Ensure overflow
    
    console.log(`Target items: ${heavyTestSize} (should trigger overflow)`);

    for (let i = 0; i < heavyTestSize; i++) {
      try {
        const priority = i < 20 ? 'critical' : i < 60 ? 'high' : 'normal';
        
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: 'test-overflow-user',
            mood_score: Math.floor(Math.random() * 100),
            energy_level: Math.floor(Math.random() * 10),
            anxiety_level: Math.floor(Math.random() * 10),
            notes: `Heavy test item #${i}`,
            test_marker: `HEAVY_TEST_${Date.now()}`
          },
          priority: priority
        });
        heavyAddedItems++;
      } catch (error) {
        console.warn(`❌ Heavy item ${i} failed:`, error.message);
        heavyFailedItems++;
        
        // If too many failures, break early
        if (heavyFailedItems > 20) {
          console.warn('⚠️ Too many failures, stopping heavy test early');
          break;
        }
      }
      
      // Progress indicator for long tests
      if (i > 0 && i % 50 === 0) {
        console.log(`Progress: ${i}/${heavyTestSize} items processed...`);
      }
    }

    const heavyTestDuration = Date.now() - heavyTestStart;
    const finalStats = offlineSyncService.getQueueStats();
    
    console.log(`✅ Heavy test completed in ${heavyTestDuration}ms`);
    console.log(`Added: ${heavyAddedItems}/${heavyTestSize} items`);
    console.log(`Failed: ${heavyFailedItems} items`);
    console.log(`Queue Size: ${lightStats.size} → ${finalStats.size}`);
    console.log(`Overflows: ${finalStats.overflowCount - lightStats.overflowCount}`);
    console.log('');

    // SUMMARY RESULTS
    console.log('📋 TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalItemsAttempted = 50 + heavyTestSize;
    const totalItemsAdded = addedItems + heavyAddedItems;
    const totalItemsFailed = failedItems + heavyFailedItems;
    const totalOverflows = finalStats.overflowCount - initialStats.overflowCount;
    
    console.log(`🔢 Total Items Attempted: ${totalItemsAttempted}`);
    console.log(`✅ Total Items Added: ${totalItemsAdded}`);
    console.log(`❌ Total Items Failed: ${totalItemsFailed}`);
    console.log(`📊 Final Queue: ${finalStats.size}/${finalStats.maxSize} (${finalStats.utilizationPercent}%)`);
    console.log(`💥 Overflows Triggered: ${totalOverflows}`);
    console.log(`🚨 Near Capacity: ${finalStats.isNearCapacity ? '⚠️ YES' : '✅ No'}`);
    console.log(`📈 Final Priority Breakdown:`, finalStats.priorityCounts);
    
    // VERDICT
    console.log('\n🏆 TEST VERDICT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const maxSizeRespected = finalStats.size <= finalStats.maxSize;
    const overflowTriggered = totalOverflows > 0;
    const noMemoryLeak = finalStats.size < totalItemsAdded; // Some items should be in DLQ
    
    console.log(`✅ MAX_QUEUE_SIZE respected: ${maxSizeRespected ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✅ Overflow triggered: ${overflowTriggered ? '✅ PASS' : '⚠️ NO OVERFLOW'}`);
    console.log(`✅ Memory management: ${noMemoryLeak ? '✅ PASS' : '❌ POTENTIAL LEAK'}`);
    
    const overallResult = maxSizeRespected && (totalItemsAdded < totalItemsAttempted || overflowTriggered);
    console.log(`\n🎯 OVERALL RESULT: ${overallResult ? '✅ SUCCESS' : '❌ NEEDS INVESTIGATION'}`);
    
    return {
      success: overallResult,
      stats: {
        initial: initialStats,
        final: finalStats,
        itemsAttempted: totalItemsAttempted,
        itemsAdded: totalItemsAdded,
        itemsFailed: totalItemsFailed,
        overflowsTriggered: totalOverflows
      }
    };

  } catch (error) {
    console.error('🚨 TEST RUNNER FAILED:', error);
    return { success: false, error: error.message };
  }
};

// Export for use
module.exports = { testQueueOverflow };

// Run if called directly
if (require.main === module) {
  testQueueOverflow()
    .then(result => {
      console.log('\n🔚 Test completed. Result:', result.success ? 'SUCCESS' : 'FAILED');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
