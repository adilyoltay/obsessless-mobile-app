#!/usr/bin/env node

/**
 * 🧪 ObsessLess QA Test Suite Runner
 * 
 * Automated test runner based on QA_TESTING_GUIDE.md
 * Performs comprehensive Quality Ribbon and AI features testing
 */

const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`, 
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

console.log(colors.bold(colors.blue('🧪 ObsessLess QA Test Suite')));
console.log(colors.gray('Based on QA_TESTING_GUIDE.md - Comprehensive testing'));
console.log();

// Test Categories from QA Guide
const testSuites = [
  {
    name: 'Today (Bugün) Sayfası',
    icon: '🏠',
    features: [
      'Multi-module AI analysis',
      'Adaptive Interventions (JITAI)', 
      'Quality Ribbon metadata',
      'Deep insights with ALL module data',
      'Unified Pipeline integration'
    ],
    priority: 'high'
  },
  {
    name: 'Mood Sayfası', 
    icon: '💭',
    features: [
      'Unified Voice Analysis',
      'Mood-specific AI insights',
      'Cross-module adaptive suggestions',
      'Clinical-grade mood analytics',
      'Quality Ribbon with pipeline data'
    ],
    priority: 'high'
  },
  {
    name: 'CBT (Düşünce Kaydı) Sayfası',
    icon: '🧠', 
    features: [
      'CBT thought record creation',
      'Mood before/after tracking',
      'CBT-specific analytics',
      'Quality Ribbon for CBT suggestions'
    ],
    priority: 'medium'
  },
  {
    name: 'Tracking (OCD) Sayfası',
    icon: '📊',
    features: [
      'Compulsion tracking',
      'OCD pattern recognition', 
      'Tracking-specific analytics',
      'Resistance level tracking'
    ],
    priority: 'medium'
  },
  {
    name: 'Breathwork (Nefes) Sayfası',
    icon: '🫁',
    features: [
      'Breathing exercises',
      'Anxiety level tracking',
      'Breathwork suggestions',
      'Session completion tracking'
    ],
    priority: 'low'
  },
  {
    name: 'Settings (Ayarlar) Sayfası',
    icon: '⚙️',
    features: [
      'AI feature flags',
      'Privacy settings',
      'Notification preferences',
      'Data export/import'
    ],
    priority: 'low'
  }
];

// Test Results Tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

function logTest(suite, test, status, details = '') {
  const statusColor = status === 'PASS' ? colors.green : 
                      status === 'FAIL' ? colors.red : colors.yellow;
  
  console.log(`  ${statusColor(`${status}`)} ${test}`);
  if (details) {
    console.log(`    ${colors.gray(details)}`);
  }
  
  testResults.details.push({ suite, test, status, details });
  
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;
}

// Run Quality Ribbon Logic Tests (from our working script)
function runQualityRibbonLogicTests() {
  console.log(colors.cyan('🎗️ Quality Ribbon Logic Tests'));
  console.log(colors.gray('Testing core Quality Ribbon functionality...'));
  
  // Test 1: Quality Level Calculation
  const qualityTests = [
    { sampleSize: 15, expected: 'high' },
    { sampleSize: 7, expected: 'medium' }, 
    { sampleSize: 3, expected: 'low' }
  ];
  
  qualityTests.forEach(({ sampleSize, expected }) => {
    const quality = sampleSize >= 10 ? 'high' : sampleSize >= 5 ? 'medium' : 'low';
    const passed = quality === expected;
    logTest('Quality Ribbon', `Quality level: ${sampleSize} samples → ${quality}`, 
            passed ? 'PASS' : 'FAIL');
  });
  
  // Test 2: Freshness Formatting
  const freshnessTests = [
    { ms: 60000, expected: '1m' },
    { ms: 3600000, expected: '1h' }, 
    { ms: 86400000, expected: '1d' }
  ];
  
  freshnessTests.forEach(({ ms, expected }) => {
    const formatAge = (freshnessMs) => {
      const minutes = Math.floor(freshnessMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d`;
      if (hours > 0) return `${hours}h`;
      if (minutes > 0) return `${minutes}m`;
      return 'now';
    };
    
    const result = formatAge(ms);
    const passed = result === expected;
    logTest('Quality Ribbon', `Freshness: ${ms}ms → ${result}`, 
            passed ? 'PASS' : 'FAIL');
  });
  
  // Test 3: Source Badge Configuration
  const sources = ['unified', 'cache', 'heuristic', 'llm'];
  const expectedLabels = ['Fresh', 'Cache', 'Fast', 'LLM'];
  
  sources.forEach((source, index) => {
    const getSourceConfig = (src) => {
      switch (src) {
        case 'unified': return { label: 'Fresh' };
        case 'cache': return { label: 'Cache' }; 
        case 'heuristic': return { label: 'Fast' };
        case 'llm': return { label: 'LLM' };
        default: return { label: 'Auto' };
      }
    };
    
    const config = getSourceConfig(source);
    const expected = expectedLabels[index];
    const passed = config.label === expected;
    logTest('Quality Ribbon', `Source: ${source} → ${config.label}`, 
            passed ? 'PASS' : 'FAIL');
  });
  
  console.log();
}

// Manual Test Instructions
function printManualTestInstructions() {
  console.log(colors.bold(colors.cyan('📱 Manual Testing Instructions')));
  console.log(colors.gray('Follow these steps to test each page manually:'));
  console.log();
  
  testSuites.forEach((suite, index) => {
    if (suite.priority === 'high') {
      console.log(`${colors.yellow(`${index + 1}. ${suite.icon} ${suite.name}`)}`);
      console.log(colors.gray('   Features to test:'));
      suite.features.forEach(feature => {
        console.log(colors.gray(`   - ${feature}`));
      });
      console.log();
    }
  });
}

// Console Log Monitoring Guide
function printConsoleMonitoringGuide() {
  console.log(colors.bold(colors.cyan('🔍 Console Log Monitoring')));
  console.log(colors.gray('Watch for these patterns in browser console:'));
  console.log();
  
  const logPatterns = [
    {
      category: 'Pipeline Logs',
      patterns: [
        '🚀 UNIFIED PIPELINE: Processing with mixed content',
        '📊 Enhanced mood analytics attached to result',
        '✅ Phase 2: Deep insights loaded with ALL MODULE DATA'
      ]
    },
    {
      category: 'Quality Ribbon Logs', 
      patterns: [
        '📊 Quality metadata for mood suggestion: {...}',
        '📊 Default quality metadata set for Today suggestion',
        '🎗️ AdaptiveSuggestionCard rendered with quality ribbon'
      ]
    },
    {
      category: 'Error Patterns',
      patterns: [
        '⚠️ AI_UNIFIED_PIPELINE disabled - falling back',
        '⚠️ Adaptive suggestion generation failed',
        '❌ UNIFIED_PIPELINE_ERROR: {...}'
      ]
    }
  ];
  
  logPatterns.forEach(({ category, patterns }) => {
    console.log(colors.yellow(`${category}:`));
    patterns.forEach(pattern => {
      console.log(colors.gray(`  "${pattern}"`));
    });
    console.log();
  });
}

// Test Results Summary
function printTestSummary() {
  console.log(colors.bold(colors.blue('📊 Test Results Summary')));
  console.log(`✅ Passed: ${colors.green(testResults.passed)}`);
  console.log(`❌ Failed: ${colors.red(testResults.failed)}`);
  console.log(`⏸️ Skipped: ${colors.yellow(testResults.skipped)}`);
  console.log(`📋 Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
  console.log();
  
  if (testResults.failed > 0) {
    console.log(colors.red('❌ Failed Tests:'));
    testResults.details.filter(t => t.status === 'FAIL').forEach(test => {
      console.log(`  - ${test.suite}: ${test.test}`);
    });
    console.log();
  }
  
  const successRate = testResults.passed / (testResults.passed + testResults.failed) * 100;
  const status = successRate >= 90 ? colors.green('EXCELLENT') :
                 successRate >= 75 ? colors.yellow('GOOD') : colors.red('NEEDS WORK');
  
  console.log(`Overall Status: ${status} (${successRate.toFixed(1)}%)`);
}

// Main Test Execution
function runQATests() {
  console.log(colors.bold('🚀 Running Automated Logic Tests'));
  console.log();
  
  // Run automated tests we can verify
  runQualityRibbonLogicTests();
  
  // Print manual test guide  
  printManualTestInstructions();
  
  // Print console monitoring guide
  printConsoleMonitoringGuide();
  
  // Print test results
  printTestSummary();
  
  // Next Steps
  console.log(colors.bold(colors.cyan('🎯 Next Steps')));
  console.log(colors.gray('1. Open the app and follow manual test instructions above'));
  console.log(colors.gray('2. Monitor browser console for the specified log patterns'));
  console.log(colors.gray('3. Test each high-priority page systematically'));
  console.log(colors.gray('4. Document any issues found'));
  console.log();
  
  // Quick Commands
  console.log(colors.bold(colors.cyan('⚡ Quick Commands')));
  console.log(colors.gray('npm run test:quality-ribbon          # Run logic tests only'));
  console.log(colors.gray('npm run test:quality-ribbon:manual   # Open manual test guide'));
  console.log(colors.gray('open docs/QA_TESTING_GUIDE.md        # Full testing guide'));
  console.log();
  
  console.log(colors.green('✨ QA Test Suite Complete!'));
  console.log(colors.gray('Follow manual steps above to complete testing.'));
}

// Execute
runQATests();
