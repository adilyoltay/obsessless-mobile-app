#!/usr/bin/env node

/**
 * Debug Mood State Analysis
 * 
 * Metro logs'taki issues için data state analysis.
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function runAnalysis() {
  console.log('🔍 MOOD DATA STATE ANALYSIS');
  console.log('==========================\n');

  // Metro logs analysis patterns
  console.log('📊 DETECTED ISSUES FROM METRO LOGS:');
  console.log('1. ❌ "Duplicate mood entry prevented" but merge still adds 2 entries');
  console.log('2. ❌ "Entry found and deleted: false" for UUID IDs');  
  console.log('3. ❌ "UI state updated: 2 -> 1" but totalEntries: 2');
  console.log('4. ❌ "Invalid UUID format" warnings for local IDs\n');

  console.log('🧬 ROOT CAUSE HYPOTHESES:');
  console.log('1. ID Mapping Mismatch: Local (mood_xxx) vs Remote (UUID) IDs');
  console.log('2. Merge Logic Bug: Not detecting duplicate content_hash properly');
  console.log('3. Stale Cache: UI showing cached data vs actual database state'); 
  console.log('4. Idempotency Return: Returning duplicate entry confuses UI\n');

  console.log('🔧 PLANNED FIXES:');
  console.log('1. Enhanced ID mapping in merge logic');
  console.log('2. Content_hash normalization');
  console.log('3. UI state refresh after operations');
  console.log('4. Idempotency clear return signals\n');

  // Check if we can run Metro commands
  console.log('📱 METRO STATUS:');
  try {
    const { stdout } = await execAsync('curl -s http://localhost:8088 | head -5');
    if (stdout.includes('<title>')) {
      console.log('✅ Metro server running on port 8088');
    } else {
      console.log('❌ Metro server not responding');
    }
  } catch (error) {
    console.log('⚠️ Metro status check failed:', error.message);
  }

  console.log('\n🎯 NEXT ACTIONS:');
  console.log('1. Implement enhanced merge logic with proper ID mapping');
  console.log('2. Fix idempotency return to not confuse UI');
  console.log('3. Add content_hash validation in merge');
  console.log('4. Test with clean user data');
  
  console.log('\n📋 TO VERIFY:');
  console.log('- Create mood entry 2 times rapidly → Should show only 1');
  console.log('- Delete mood entry → Should disappear from UI immediately');
  console.log('- Edit mood entry → Should show updated values instantly');
  console.log('- Offline/online → Should maintain consistency');
}

// Export for programmatic use
module.exports = {
  runAnalysis,
  
  testScenarios: [
    {
      name: 'Duplicate Prevention Test',
      steps: [
        'Create mood entry with same values twice rapidly',
        'Expected: Only 1 entry should appear',
        'Current: 2 entries appear (idempotency failing)'
      ]
    },
    {
      name: 'Delete Consistency Test', 
      steps: [
        'Delete mood entry (UUID format)',
        'Expected: Entry disappears from UI',
        'Current: Entry not found warnings, UI inconsistency'
      ]
    },
    {
      name: 'ID Format Test',
      steps: [
        'Check local vs remote ID mapping',
        'Expected: Seamless ID translation',
        'Current: UUID vs mood_xxx format mismatch'
      ]
    }
  ]
};

if (require.main === module) {
  runAnalysis().catch(console.error);
}
