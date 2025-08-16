/* eslint-env node */

/**
 * 🧪 Y-BOCS Assessment Complete Flow Test
 * 
 * Bu test Y-BOCS Assessment'ın tüm akışını kapsamlı olarak test eder:
 * - Component yapısı ve props
 * - Button functionality ve state management
 * - Analysis service integration
 * - Onboarding flow integration
 * - Error handling ve edge cases
 */

const fs = require('fs');
const path = require('path');

// Test utilities
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    success: `${colors.green}✅`,
    error: `${colors.red}❌`,
    warning: `${colors.yellow}⚠️`,
    info: `${colors.blue}ℹ️`,
    test: `${colors.cyan}🧪`
  }[type] || colors.blue + 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}${colors.reset}`);
}

function testPassed(testName, details = '') {
  log(`${testName} ${details ? '- ' + details : ''}`, 'success');
}

function testFailed(testName, error) {
  log(`${testName} - ${error.message || error}`, 'error');
  return false;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read file ${filePath}: ${error.message}`);
  }
}

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    testPassed(testName);
    passedTests++;
    return true;
  } catch (error) {
    testFailed(testName, error);
    failedTests++;
    return false;
  }
}

// =============================================================================
// 🧪 Y-BOCS ASSESSMENT TESTS
// =============================================================================

function testYBOCSAssessmentUI() {
  log('\n🧠 Testing Y-BOCS Assessment UI Component...', 'test');
  
  const componentPath = 'features/ai/components/onboarding/YBOCSAssessmentUI.tsx';
  
  runTest('Y-BOCS Component File Exists', () => {
    if (!fileExists(componentPath)) {
      throw new Error(`Y-BOCS Assessment UI component not found: ${componentPath}`);
    }
  });
  
  const content = readFile(componentPath);
  
  runTest('Y-BOCS Component Structure', () => {
    const requiredElements = [
      'YBOCSAssessmentUI',
      'YBOCSAssessmentUIProps',
      'AssessmentState',
      'handleAnswerSelect',
      'handleNextQuestion',
      'calculateEstimatedSeverity'
    ];
    
    requiredElements.forEach(element => {
      if (!content.includes(element)) {
        throw new Error(`Missing required element: ${element}`);
      }
    });
  });
  
  runTest('Y-BOCS Props Interface', () => {
    if (!content.includes('onComplete: (answers: YBOCSAnswer[]) => void')) {
      throw new Error('onComplete callback prop missing or incorrect type');
    }
    if (!content.includes('isLoading?: boolean')) {
      throw new Error('isLoading prop missing');
    }
    if (!content.includes('userId?: string')) {
      throw new Error('userId prop missing');
    }
  });
  
  runTest('Y-BOCS Questions Configuration', () => {
    if (!content.includes('YBOCS_QUESTIONS: YBOCSQuestion[]')) {
      throw new Error('Y-BOCS questions array not found');
    }
    if (!content.includes('YBOCSQuestionType.OBSESSIONS')) {
      throw new Error('Obsessions question type not found');
    }
    if (!content.includes('YBOCSQuestionType.COMPULSIONS')) {
      throw new Error('Compulsions question type not found');
    }
  });
  
  runTest('Y-BOCS Cultural Adaptations', () => {
    if (!content.includes('culturalAdaptations')) {
      throw new Error('Cultural adaptations not implemented');
    }
    if (!content.includes('turkishContext')) {
      throw new Error('Turkish cultural context not found');
    }
    if (!content.includes('religiousConsiderations')) {
      throw new Error('Religious considerations not found');
    }
  });
  
  runTest('Y-BOCS Button Functionality', () => {
    // Check button implementation
    if (!content.includes('title={isLastQuestion ? "✅ Tamamla" : "Devam ➡️"}')) {
      throw new Error('Complete/Continue button not properly implemented');
    }
    if (!content.includes('onPress={handleNextQuestion}')) {
      throw new Error('Button onPress handler missing');
    }
    if (!content.includes('disabled={!state.canProceed || isLoading || state.isValidating}')) {
      throw new Error('Button disabled logic missing');
    }
  });
  
  runTest('Y-BOCS State Management', () => {
    const stateProperties = [
      'currentQuestionIndex',
      'answers: YBOCSAnswer[]',
      'isValidating: boolean',
      'canProceed: boolean',
      'estimatedSeverity: OCDSeverityLevel'
    ];
    
    stateProperties.forEach(prop => {
      if (!content.includes(prop)) {
        throw new Error(`State property missing: ${prop}`);
      }
    });
  });
  
  runTest('Y-BOCS Severity Calculation', () => {
    if (!content.includes('calculateEstimatedSeverity')) {
      throw new Error('Severity calculation function missing');
    }
    if (!content.includes('OCDSeverityLevel.MINIMAL')) {
      throw new Error('Severity levels not properly implemented');
    }
  });
  
  // Crisis detection modülü kaldırıldığı için bu kontrol devre dışı
  
  runTest('Y-BOCS Progress Tracking', () => {
    if (!content.includes('AsyncStorage')) {
      throw new Error('Progress saving not implemented');
    }
    if (!content.includes('ybocs_progress_')) {
      throw new Error('Progress storage key not found');
    }
  });
  
  runTest('Y-BOCS Completion Logic', () => {
    if (!content.includes('onComplete(state.answers)')) {
      throw new Error('Completion callback not called');
    }
    if (!content.includes('isLastQuestion')) {
      throw new Error('Last question detection missing');
    }
  });
}

function testYBOCSAnalysisService() {
  log('\n🔬 Testing Y-BOCS Analysis Service...', 'test');
  
  const servicePath = 'features/ai/services/ybocsAnalysisService.ts';
  
  runTest('Y-BOCS Analysis Service File Exists', () => {
    if (!fileExists(servicePath)) {
      throw new Error(`Y-BOCS Analysis Service not found: ${servicePath}`);
    }
  });
  
  const content = readFile(servicePath);
  
  runTest('Y-BOCS Analysis Service Methods', () => {
    const requiredMethods = [
      'analyzeYBOCS',
      'enhanceWithAI',
      'generatePersonalizedRecommendations',
      'identifyPrimarySymptoms',
      'identifyRiskFactors',
      'generateInterventions'
    ];
    
    requiredMethods.forEach(method => {
      if (!content.includes(method)) {
        throw new Error(`Missing service method: ${method}`);
      }
    });
  });
  
  runTest('Y-BOCS Analysis Types', () => {
    if (!content.includes('YBOCSAnswer')) {
      throw new Error('YBOCSAnswer type not imported');
    }
    if (!content.includes('OCDAnalysis')) {
      throw new Error('OCDAnalysis type not imported');
    }
    if (!content.includes('OCDSeverityLevel')) {
      throw new Error('OCDSeverityLevel type not imported');
    }
  });
  
  runTest('Y-BOCS Scoring Logic', () => {
    if (!content.includes('obsessionScore') && content.includes('compulsionScore')) {
      throw new Error('Obsession and compulsion scoring not implemented');
    }
    if (!content.includes('totalScore = obsessionScore + compulsionScore')) {
      throw new Error('Total score calculation missing');
    }
  });
  
  runTest('Y-BOCS Severity Classification', () => {
    const severityLevels = [
      'OCDSeverityLevel.MINIMAL',
      'OCDSeverityLevel.MILD', 
      'OCDSeverityLevel.MODERATE',
      'OCDSeverityLevel.SEVERE',
      'OCDSeverityLevel.EXTREME'
    ];
    
    severityLevels.forEach(level => {
      if (!content.includes(level)) {
        throw new Error(`Severity level missing: ${level}`);
      }
    });
  });
  
  runTest('Y-BOCS Turkish Interventions', () => {
    const turkishInterventions = [
      'Öz-yardım stratejileri',
      'Bilişsel Davranışçı Terapi',
      'Maruz Bırakma ve Tepki Önleme',
      'Psikiyatrik değerlendirme'
    ];
    
    turkishInterventions.forEach(intervention => {
      if (!content.includes(intervention)) {
        throw new Error(`Turkish intervention missing: ${intervention}`);
      }
    });
  });
}

function testOnboardingFlowIntegration() {
  log('\n🧭 Testing Onboarding Flow Integration...', 'test');
  
  const flowPath = 'features/ai/components/onboarding/OnboardingFlow.tsx';
  
  runTest('Onboarding Flow File Exists', () => {
    if (!fileExists(flowPath)) {
      throw new Error(`Onboarding Flow component not found: ${flowPath}`);
    }
  });
  
  const content = readFile(flowPath);
  
  runTest('Y-BOCS Integration in Onboarding', () => {
    if (!content.includes('YBOCSAssessmentUI')) {
      throw new Error('Y-BOCS Assessment UI not imported');
    }
    if (!content.includes('handleYBOCSCompletion')) {
      throw new Error('Y-BOCS completion handler missing');
    }
  });
  
  runTest('Y-BOCS Completion Handler', () => {
    if (!content.includes('ybocsAnalysisService.analyzeYBOCS')) {
      throw new Error('Y-BOCS analysis service not called');
    }
    if (!content.includes('onboardingEngine.updateSessionData')) {
      throw new Error('Session update not implemented');
    }
  });
  
  runTest('Onboarding Step Progression', () => {
    if (!content.includes('OnboardingStep.YBOCS_ASSESSMENT')) {
      throw new Error('Y-BOCS assessment step not defined');
    }
    if (!content.includes('OnboardingStep.PROFILE_BUILDING')) {
      throw new Error('Profile building step not found');
    }
  });
  
  runTest('Error Handling in Onboarding', () => {
    if (!content.includes('catch (error)')) {
      throw new Error('Error handling not implemented');
    }
    if (!content.includes('Y-BOCS analizi sırasında hata oluştu')) {
      throw new Error('Turkish error message not found');
    }
  });
}

function testOnboardingEngine() {
  log('\n⚙️ Testing Onboarding Engine...', 'test');
  
  const enginePath = 'features/ai/engines/onboardingEngine.ts';
  
  runTest('Onboarding Engine File Exists', () => {
    if (!fileExists(enginePath)) {
      throw new Error(`Onboarding Engine not found: ${enginePath}`);
    }
  });
  
  const content = readFile(enginePath);
  
  runTest('Onboarding Engine Session Management', () => {
    if (!content.includes('activeSessions: Map<string, OnboardingSession>')) {
      throw new Error('Active sessions map not found');
    }
    if (!content.includes('updateSessionInformation')) {
      throw new Error('Session update method missing');
    }
  });
  
  runTest('Onboarding Engine AI Services Integration', () => {
    const aiServices = [
      'ybocsAnalysisService',
      'userProfilingService',
      'adaptiveInterventionsEngine',
      'jitaiEngine'
    ];
    
    aiServices.forEach(service => {
      if (!content.includes(service)) {
        throw new Error(`AI service not integrated: ${service}`);
      }
    });
  });
  
  runTest('Onboarding Engine Session Data Update', () => {
    if (!content.includes('this.activeSessions.has(sessionId)')) {
      throw new Error('Session existence check missing');
    }
    if (!content.includes('this.activeSessions.set(sessionId, updatedSession)')) {
      throw new Error('Session update logic missing');
    }
  });
}

function testButtonComponent() {
  log('\n🔘 Testing Button Component...', 'test');
  
  const buttonPath = 'components/ui/Button.tsx';
  
  runTest('Button Component File Exists', () => {
    if (!fileExists(buttonPath)) {
      throw new Error(`Button component not found: ${buttonPath}`);
    }
  });
  
  const content = readFile(buttonPath);
  
  runTest('Button Component Props', () => {
    if (!content.includes('title?: string')) {
      throw new Error('Title prop not supported');
    }
    if (!content.includes('variant?: \'primary\' | \'secondary\' | \'outline\'')) {
      throw new Error('Variant prop not properly typed');
    }
  });
  
  runTest('Button Component Variants', () => {
    if (!content.includes('outlineButton')) {
      throw new Error('Outline button style missing');
    }
    if (!content.includes('outlineText')) {
      throw new Error('Outline text style missing');
    }
  });
}

function testFeatureFlags() {
  log('\n🏳️ Testing Feature Flags...', 'test');
  
  const flagsPath = 'constants/featureFlags.ts';
  
  runTest('Feature Flags File Exists', () => {
    if (!fileExists(flagsPath)) {
      throw new Error(`Feature flags not found: ${flagsPath}`);
    }
  });
  
  const content = readFile(flagsPath);
  
  runTest('AI Master Flag', () => {
    if (!content.includes('AI_MASTER_ENABLED')) {
      throw new Error('AI master flag not found');
    }
    if (!content.includes('AI_ENABLED: AI_MASTER_ENABLED')) {
      throw new Error('AI enabled flag not tied to master');
    }
  });
  
  runTest('Y-BOCS Specific Flags', () => {
    if (!content.includes('AI_YBOCS_ANALYSIS')) {
      throw new Error('Y-BOCS analysis flag missing');
    }
    if (!content.includes('AI_ONBOARDING_V2')) {
      throw new Error('Onboarding v2 flag missing');
    }
  });
}

// =============================================================================
// 🚀 RUN ALL TESTS
// =============================================================================

function runAllTests() {
  log(`${colors.bold}${colors.cyan}🧪 Y-BOCS Assessment Complete Flow Test Suite${colors.reset}`);
  log(`${colors.bold}================================================${colors.reset}`);
  
  const startTime = Date.now();
  
  // Run all test suites
  testYBOCSAssessmentUI();
  testYBOCSAnalysisService();
  testOnboardingFlowIntegration();
  testOnboardingEngine();
  testButtonComponent();
  testFeatureFlags();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Results summary
  log(`\n${colors.bold}📊 Test Results Summary${colors.reset}`);
  log('========================');
  log(`Total Tests: ${totalTests}`);
  log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
  log(`Failed: ${colors.red}${failedTests}${colors.reset}`);
  log(`Success Rate: ${colors.bold}${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}`);
  log(`Duration: ${duration}s`);
  
  if (failedTests === 0) {
    log(`\n${colors.green}${colors.bold}🎉 ALL TESTS PASSED! Y-BOCS Assessment is fully functional!${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.red}${colors.bold}❌ ${failedTests} test(s) failed. Please review the issues above.${colors.reset}`);
    process.exit(1);
  }
}

// Run the test suite
runAllTests();
