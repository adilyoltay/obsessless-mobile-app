/* eslint-env node */
/* global __dirname */

/**
 * 🧪 Simple Feature Flags Test
 * FAZ 0: Güvenlik ve Stabilite Hazırlığı - Basit Test
 */

console.log('🧪 Simple Feature Flags Test - FAZ 0');
console.log('====================================\n');

let passed = 0;
let total = 0;

function test(name, condition) {
  total++;
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
  }
}

// Test 1: Feature Flags dosyası var mı?
const fs = require('fs');
const path = require('path');

const featureFlagsPath = path.join(__dirname, '..', 'constants', 'featureFlags.ts');
test('Feature Flags file exists', fs.existsSync(featureFlagsPath));

if (fs.existsSync(featureFlagsPath)) {
  const content = fs.readFileSync(featureFlagsPath, 'utf8');
  
  // Test 2: AI özellikleri default OFF mı?
  test('AI_CHAT default OFF', content.includes('AI_CHAT: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_CHAT === \'true\''));
  test('AI_ONBOARDING default OFF', content.includes('AI_ONBOARDING: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_ONBOARDING === \'true\''));
  test('AI_INSIGHTS default OFF', content.includes('AI_INSIGHTS: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_INSIGHTS === \'true\''));
  test('AI_VOICE default OFF', content.includes('AI_VOICE: __DEV__ && process.env.EXPO_PUBLIC_ENABLE_AI_VOICE === \'true\''));
  
  // Test 3: Kritik fonksiyonlar var mı?
  test('isEnabled function exists', content.includes('isEnabled:'));
  test('disableAll function exists', content.includes('disableAll:'));
  test('setFlag function exists', content.includes('setFlag:'));
  test('getUsageStats function exists', content.includes('getUsageStats:'));
  test('reactivateAll function exists', content.includes('reactivateAll:'));
  
  // Test 4: Güvenlik kontrolleri var mı?
  test('Safety checks exist', content.includes('SAFETY_CHECKS: true'));
  test('Emergency kill switch exists', content.includes('__OBSESSLESS_KILL_SWITCH'));
}

// Test 5: Import Guard script var mı?
const importGuardPath = path.join(__dirname, 'import-guard.js');
test('Import Guard script exists', fs.existsSync(importGuardPath));

// Test 6: Safe Point script var mı?
const safePointPath = path.join(__dirname, 'create-safe-point.sh');
test('Safe Point script exists', fs.existsSync(safePointPath));

// Test 7: Setup dokümanı var mı?
const setupDocPath = path.join(__dirname, '..', 'docs', 'FEATURE_FLAGS_SETUP.md');
test('Feature Flags setup documentation exists', fs.existsSync(setupDocPath));

console.log('\n🏁 Test Results');
console.log('================');
console.log(`✅ Passed: ${passed}/${total}`);
console.log(`📈 Success Rate: ${(passed/total*100).toFixed(1)}%`);

if (passed === total) {
  console.log('\n🎉 All tests passed!');
  console.log('✅ FAZ 0: Feature Flag System READY');
  console.log('🚀 You can now safely proceed with AI development');
} else {
  console.log('\n⚠️ Some tests failed');
  console.log('Please review the implementation');
}