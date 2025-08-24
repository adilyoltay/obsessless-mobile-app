#!/usr/bin/env node

/**
 * 🤖 ObsessLess Test Automation Runner
 * Bu script, test rehberindeki tüm senaryoları otomatik olarak çalıştırır
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test kategorileri ve öncelikleri
const TEST_SUITES = {
  unit: {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    required: true,
    timeout: 30000
  },
  integration: {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    required: true,
    timeout: 60000
  },
  e2e: {
    name: 'E2E Tests',
    command: 'npm run test:e2e',
    required: false, // E2E testler opsiyonel (simulator gerektirir)
    timeout: 300000
  },
  coverage: {
    name: 'Coverage Report',
    command: 'npm run test:coverage',
    required: false,
    timeout: 60000
  }
};

// Test sonuçlarını saklamak için
const results = {
  passed: [],
  failed: [],
  skipped: [],
  startTime: Date.now(),
  endTime: null
};

// Renkli console output için
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(`🎯 ${title}`, 'bright');
  console.log('='.repeat(60));
}

function runTestSuite(suite, config) {
  logSection(`Running ${config.name}`);
  
  try {
    const startTime = Date.now();
    
    // Test komutunu çalıştır
    execSync(config.command, {
      stdio: 'inherit',
      timeout: config.timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log(`✅ ${config.name} passed in ${duration}s`, 'green');
    results.passed.push({
      suite,
      name: config.name,
      duration
    });
    
    return true;
  } catch (error) {
    if (config.required) {
      log(`❌ ${config.name} failed!`, 'red');
      results.failed.push({
        suite,
        name: config.name,
        error: error.message
      });
      return false;
    } else {
      log(`⚠️ ${config.name} failed (non-critical)`, 'yellow');
      results.skipped.push({
        suite,
        name: config.name,
        reason: 'Non-critical test failed'
      });
      return true;
    }
  }
}

function generateReport() {
  results.endTime = Date.now();
  const totalDuration = ((results.endTime - results.startTime) / 1000).toFixed(2);
  
  logSection('Test Automation Report');
  
  // Özet
  console.log('\n📊 Summary:');
  log(`  ✅ Passed: ${results.passed.length}`, 'green');
  log(`  ❌ Failed: ${results.failed.length}`, results.failed.length > 0 ? 'red' : 'green');
  log(`  ⚠️ Skipped: ${results.skipped.length}`, 'yellow');
  log(`  ⏱️ Total Duration: ${totalDuration}s`, 'cyan');
  
  // Detaylı sonuçlar
  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(test => {
      console.log(`  • ${test.name} (${test.duration}s)`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`  • ${test.name}`);
      console.log(`    Error: ${test.error}`);
    });
  }
  
  if (results.skipped.length > 0) {
    console.log('\n⚠️ Skipped Tests:');
    results.skipped.forEach(test => {
      console.log(`  • ${test.name}: ${test.reason}`);
    });
  }
  
  // JSON raporu kaydet
  const reportPath = path.join(__dirname, '..', 'test-reports', 'automation-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

function checkPrerequisites() {
  logSection('Checking Prerequisites');
  
  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = process.version;
        return version.startsWith('v18') || version.startsWith('v20');
      },
      error: 'Node.js 18+ required'
    },
    {
      name: 'Dependencies installed',
      check: () => fs.existsSync(path.join(__dirname, '..', 'node_modules')),
      error: 'Run "yarn install" first'
    },
    {
      name: 'Test directory exists',
      check: () => fs.existsSync(path.join(__dirname, '..', '__tests__')),
      error: 'Test directory not found'
    }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    if (check.check()) {
      log(`  ✅ ${check.name}`, 'green');
    } else {
      log(`  ❌ ${check.name}: ${check.error}`, 'red');
      allPassed = false;
    }
  });
  
  return allPassed;
}

async function main() {
  console.clear();
  log('🤖 ObsessLess Test Automation Runner', 'bright');
  log('Version 1.0.0', 'cyan');
  
  // Ön kontroller
  if (!checkPrerequisites()) {
    log('\n❌ Prerequisites check failed. Please fix the issues above.', 'red');
    process.exit(1);
  }
  
  // Test suite'lerini çalıştır
  logSection('Starting Test Execution');
  
  let hasFailures = false;
  
  for (const [suite, config] of Object.entries(TEST_SUITES)) {
    // CI ortamında E2E testleri atla
    if (suite === 'e2e' && process.env.CI) {
      log(`⏭️ Skipping ${config.name} in CI environment`, 'yellow');
      results.skipped.push({
        suite,
        name: config.name,
        reason: 'E2E tests disabled in CI'
      });
      continue;
    }
    
    const success = runTestSuite(suite, config);
    
    if (!success && config.required) {
      hasFailures = true;
      // Kritik test başarısız olursa devam etme
      if (suite === 'unit' || suite === 'integration') {
        log('\n🛑 Critical test failed. Stopping execution.', 'red');
        break;
      }
    }
  }
  
  // Rapor oluştur
  generateReport();
  
  // Çıkış kodu
  if (hasFailures) {
    log('\n❌ Test automation completed with failures', 'red');
    process.exit(1);
  } else {
    log('\n✅ All tests passed successfully!', 'green');
    process.exit(0);
  }
}

// Script'i çalıştır
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});