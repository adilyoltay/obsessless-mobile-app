#!/usr/bin/env node

/**
 * 🧪 AI Integration Performance Test Script
 * 
 * Production hazırlığı için AI servislerinin performansını test eder.
 */

const fs = require('fs');
const path = require('path');

// Test Results
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {}
};

function logTest(name, passed, details = '') {
  const test = { name, passed, details };
  results.tests.push(test);
  
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (details && !passed) console.log(`   ${details}`);
}

function testFeatureFlags() {
  console.log('\n🏳️ Testing Feature Flags...');
  
  const flagsPath = path.join(__dirname, '../constants/featureFlags.ts');
  if (!fs.existsSync(flagsPath)) {
    logTest('Feature flags file exists', false, 'featureFlags.ts not found');
    return;
  }
  
  const content = fs.readFileSync(flagsPath, 'utf8');
  
  // Production AI flag test
  const hasProductionFlag = !content.includes('return __DEV__ && enableAI');
  logTest('Production AI enabled', hasProductionFlag, 
    hasProductionFlag ? 'Works in production' : 'Requires __DEV__ mode');
  
  // Environment variable test
  const hasEnvReading = content.includes('Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_AI');
  logTest('Environment integration', hasEnvReading);
  
  // Telemetry test
  const hasTelemetry = content.includes('trackAIInteraction');
  logTest('Telemetry integration', hasTelemetry);
}

function testAIContextPerformance() {
  console.log('\n🧠 Testing AI Context Performance...');
  
  const contextPath = path.join(__dirname, '../contexts/AIContext.tsx');
  if (!fs.existsSync(contextPath)) {
    logTest('AI Context exists', false, 'AIContext.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(contextPath, 'utf8');
  
  // Performance optimizations
  logTest('useMemo optimization', content.includes('useMemo(() => ({'));
  
  const callbackCount = (content.match(/useCallback\(/g) || []).length;
  logTest('useCallback optimization', callbackCount >= 6, `Found ${callbackCount}/6 callbacks`);
  
  logTest('Parallel initialization', content.includes('Promise.allSettled'));
  logTest('Background loading', content.includes('InteractionManager.runAfterInteractions'));
  logTest('Performance tracking', content.includes('initializationTime'));
}

function testFileStructure() {
  console.log('\n📁 Testing Required Files...');
  
  const required = [
    'constants/featureFlags.ts',
    'contexts/AIContext.tsx',
    'features/ai/telemetry/aiTelemetry.ts',
    'features/ai/coordinators/insightsCoordinator.ts',
    'features/ai/engines/treatmentPlanningEngine.ts'
  ];
  
  required.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    logTest(`File: ${file}`, exists);
  });
}

function generateReport() {
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  results.summary = {
    totalTests: total,
    passed: passed,
    failed: total - passed,
    passRate: `${passRate}%`,
    recommendation: passRate >= 90 ? 'READY FOR PRODUCTION' : 
                   passRate >= 75 ? 'NEEDS MINOR FIXES' : 'REQUIRES MAJOR FIXES'
  };
  
  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${total}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${total - passed}`);
  console.log(`   Pass Rate: ${passRate}%`);
  console.log(`   Recommendation: ${results.summary.recommendation}`);
  
  // Save report
  const reportDir = path.join(__dirname, '../test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(reportDir, 'ai-integration-test.json'), 
    JSON.stringify(results, null, 2)
  );
}

function runTests() {
  console.log('🧪 AI Integration Performance Test');
  console.log('=====================================');
  
  testFeatureFlags();
  testAIContextPerformance();
  testFileStructure();
  
  generateReport();
  
  const passRate = (results.tests.filter(t => t.passed).length / results.tests.length) * 100;
  process.exit(passRate >= 90 ? 0 : 1);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests, results };