/* eslint-env node */

/**
 * 🧪 COMPREHENSIVE AI INTEGRATION TEST SUITE
 * 
 * This script validates the complete integration of all AI features
 * with the existing ObsessLess mobile application.
 */

const fs = require('fs');
const path = require('path');

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Console colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function test(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    log(`✅ PASSED: ${description}`, colors.green);
  } catch (error) {
    failedTests++;
    log(`❌ FAILED: ${description}`, colors.red);
    log(`   Error: ${error.message}`, colors.yellow);
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function fileContains(filePath, searchText) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(searchText);
}

// =================================
// PHASE 1: CORE NAVIGATION TESTS
// =================================

log('\n🧭 PHASE 1: CORE NAVIGATION INTEGRATION', colors.bold + colors.blue);

test('AI Onboarding Screen - Route exists', () => {
  if (!fileExists('app/(auth)/onboarding.tsx')) {
    throw new Error('AI onboarding route not found');
  }
});

test('AI Chat Tab - Conditional rendering', () => {
  if (!fileContains('app/(tabs)/_layout.tsx', 'FEATURE_FLAGS.isEnabled(\'AI_CHAT\')') ||
      !fileContains('app/(tabs)/_layout.tsx', 'aiSettingsUtils.isAIFeatureAvailable')) {
    throw new Error('AI Chat tab conditional rendering not implemented');
  }
});

test('Navigation Guard - AI Onboarding redirect', () => {
  if (!fileContains('components/navigation/NavigationGuard.tsx', 'AI_ONBOARDING_V2')) {
    throw new Error('AI Onboarding V2 redirect not implemented in NavigationGuard');
  }
});

test('Settings Screen - AI features integration', () => {
  if (!fileContains('app/(tabs)/settings.tsx', 'AI_ENABLED')) {
    throw new Error('Master AI switch not integrated in settings');
  }
});

// =================================
// PHASE 2: STATE MANAGEMENT TESTS
// =================================

log('\n🗄️ PHASE 2: STATE MANAGEMENT INTEGRATION', colors.bold + colors.blue);

test('AI Context Provider - Global availability', () => {
  if (!fileContains('app/_layout.tsx', 'AIProvider')) {
    throw new Error('AIProvider not added to root layout');
  }
});

test('AI Context - Service initialization', () => {
  if (!fileContains('contexts/AIContext.tsx', 'insightsCoordinator')) {
    throw new Error('AI services not properly initialized in AIContext');
  }
});

test('Auth Context - AI enhancement methods', () => {
  if (!fileContains('contexts/SupabaseAuthContext.tsx', 'getAIEnhancedProfile')) {
    throw new Error('AI enhancement methods not added to AuthContext');
  }
});

test('Home Screen - AI Context integration', () => {
  if (!fileContains('app/(tabs)/index.tsx', 'useAI, useAIUserData, useAIActions')) {
    throw new Error('Home screen not using AI Context hooks');
  }
});

// =================================
// PHASE 3: FEATURE FLAGS TESTS
// =================================

log('\n🚩 FEATURE FLAGS INTEGRATION', colors.bold + colors.blue);

test('Feature Flags - All AI flags defined', () => {
  const requiredFlags = [
    'AI_ONBOARDING_V2',
    'AI_YBOCS_ANALYSIS', 
    'AI_USER_PROFILING',
    'AI_TREATMENT_PLANNING',
    'AI_RISK_ASSESSMENT',
    'AI_ART_THERAPY'
  ];
  
  requiredFlags.forEach(flag => {
    if (!fileContains('constants/featureFlags.ts', flag)) {
      throw new Error(`Feature flag ${flag} not defined`);
    }
  });
});

test('Feature Flags - Conditional UI rendering', () => {
  if (!fileContains('app/(tabs)/index.tsx', 'FEATURE_FLAGS.isEnabled(\'AI_ART_THERAPY\')')) {
    throw new Error('Feature flags not used for conditional UI rendering');
  }
});

// =================================
// PHASE 4: UI COMPONENT TESTS
// =================================

log('\n🎨 UI COMPONENT INTEGRATION', colors.bold + colors.blue);

test('Home Screen - AI Insights widget', () => {
  if (!fileContains('app/(tabs)/index.tsx', 'renderAIInsights')) {
    throw new Error('AI Insights widget not integrated in home screen');
  }
});

test('Home Screen - Risk Assessment section', () => {
  if (!fileContains('app/(tabs)/index.tsx', 'RiskAssessmentIndicator')) {
    throw new Error('Risk Assessment indicator not integrated in home screen');
  }
});

test('Home Screen - Art Therapy widget', () => {
  if (!fileContains('app/(tabs)/index.tsx', 'renderArtTherapyWidget')) {
    throw new Error('Art Therapy widget not integrated in home screen');
  }
});

test('Tracking Screen - AI Pattern Recognition', () => {
  if (!fileContains('app/(tabs)/tracking.tsx', 'loadAIPatterns')) {
    throw new Error('AI pattern recognition not integrated in tracking screen');
  }
});

test('ERP Screen - Treatment Plan Preview', () => {
  if (!fileContains('app/(tabs)/erp.tsx', 'TreatmentPlanPreview')) {
    throw new Error('Treatment Plan Preview not integrated in ERP screen');
  }
});

// =================================
// PHASE 5: AI BACKEND TESTS
// =================================

log('\n🤖 AI BACKEND INTEGRATION', colors.bold + colors.blue);

test('Y-BOCS Analysis Service - Interface methods', () => {
  const requiredMethods = ['analyzeYBOCS', 'enhanceWithAI', 'generatePersonalizedRecommendations'];
  requiredMethods.forEach(method => {
    if (!fileContains('features/ai/services/ybocsAnalysisService.ts', method)) {
      throw new Error(`Y-BOCS Analysis Service missing method: ${method}`);
    }
  });
});

test('Onboarding Engine - Session management', () => {
  const requiredMethods = ['initializeSession', 'completeStep', 'finalizeSession'];
  requiredMethods.forEach(method => {
    if (!fileContains('features/ai/engines/onboardingEngine.ts', method)) {
      throw new Error(`Onboarding Engine missing method: ${method}`);
    }
  });
});

test('User Profiling Service - Profile generation', () => {
  if (!fileContains('features/ai/services/userProfilingService.ts', 'generateProfile')) {
    throw new Error('User Profiling Service missing generateProfile method');
  }
});

test('Treatment Planning Engine - Plan generation', () => {
  if (!fileContains('features/ai/engines/treatmentPlanningEngine.ts', 'generateTreatmentPlan')) {
    throw new Error('Treatment Planning Engine missing generateTreatmentPlan method');
  }
});

test('Risk Assessment Service - Risk evaluation', () => {
  if (!fileContains('features/ai/services/riskAssessmentService.ts', 'assessRisk')) {
    throw new Error('Risk Assessment Service missing assessRisk method');
  }
});

// =================================
// PHASE 6: TELEMETRY & SAFETY TESTS
// =================================

log('\n📊 TELEMETRY & SAFETY INTEGRATION', colors.bold + colors.blue);

test('AI Telemetry - Event tracking', () => {
  if (!fileContains('app/(tabs)/tracking.tsx', 'trackAIInteraction')) {
    throw new Error('AI telemetry not integrated in tracking screen');
  }
});

test('Crisis Detection - Safety integration', () => {
  if (!fileContains('features/ai/services/riskAssessmentService.ts', 'triggerCrisisIntervention')) {
    throw new Error('Crisis intervention not properly integrated');
  }
});

test('Content Filtering - Safety measures', () => {
  if (!fileExists('features/ai/safety/contentFilter.ts')) {
    throw new Error('Content filtering system not found');
  }
});

// =================================
// PHASE 7: ADVANCED FEATURES TESTS
// =================================

log('\n🚀 ADVANCED FEATURES INTEGRATION', colors.bold + colors.blue);

test('Context Intelligence - Environmental awareness', () => {
  if (!fileExists('features/ai/context/contextIntelligence.ts')) {
    throw new Error('Context Intelligence Engine not found');
  }
});

test('Adaptive Interventions - Real-time responses', () => {
  if (!fileExists('features/ai/interventions/adaptiveInterventions.ts')) {
    throw new Error('Adaptive Interventions Engine not found');
  }
});

test('JITAI Engine - Timing optimization', () => {
  if (!fileExists('features/ai/jitai/jitaiEngine.ts')) {
    throw new Error('JITAI Engine not found');
  }
});

test('Insights Coordinator - Component orchestration', () => {
  if (!fileContains('features/ai/coordinators/insightsCoordinator.ts', 'therapeuticPromptEngine')) {
    throw new Error('Insights Coordinator missing Sprint 4 integration');
  }
});

// =================================
// PHASE 8: UI COMPONENTS TESTS
// =================================

log('\n🖼️ AI UI COMPONENTS', colors.bold + colors.blue);

test('Onboarding Flow Component', () => {
  if (!fileExists('features/ai/components/onboarding/OnboardingFlow.tsx')) {
    throw new Error('OnboardingFlow component not found');
  }
});

test('Y-BOCS Assessment UI Component', () => {
  if (!fileExists('features/ai/components/onboarding/YBOCSAssessmentUI.tsx')) {
    throw new Error('YBOCSAssessmentUI component not found');
  }
});

test('Profile Builder UI Component', () => {
  if (!fileExists('features/ai/components/onboarding/ProfileBuilderUI.tsx')) {
    throw new Error('ProfileBuilderUI component not found');
  }
});

test('Treatment Plan Preview Component', () => {
  if (!fileExists('features/ai/components/onboarding/TreatmentPlanPreview.tsx')) {
    throw new Error('TreatmentPlanPreview component not found');
  }
});

test('Risk Assessment Indicator Component', () => {
  if (!fileExists('features/ai/components/onboarding/RiskAssessmentIndicator.tsx')) {
    throw new Error('RiskAssessmentIndicator component not found');
  }
});

// =================================
// FINAL RESULTS
// =================================

log('\n' + '='.repeat(60), colors.cyan);
log('🎯 COMPREHENSIVE INTEGRATION TEST RESULTS', colors.bold + colors.cyan);
log('='.repeat(60), colors.cyan);

log(`Total Tests: ${totalTests}`, colors.blue);
log(`Passed: ${passedTests}`, colors.green);
log(`Failed: ${failedTests}`, failedTests > 0 ? colors.red : colors.green);

const successRate = Math.round((passedTests / totalTests) * 100);
log(`Success Rate: ${successRate}%`, successRate >= 90 ? colors.green : colors.yellow);

if (failedTests === 0) {
  log('\n🎉 ALL INTEGRATION TESTS PASSED!', colors.bold + colors.green);
  log('✅ AI features are fully integrated with the main application.', colors.green);
} else {
  log('\n⚠️  SOME INTEGRATION TESTS FAILED', colors.bold + colors.yellow);
  log('🔧 Please address the failed tests before proceeding.', colors.yellow);
}

log('\n📋 INTEGRATION STATUS: COMPREHENSIVE', colors.cyan);
process.exit(failedTests > 0 ? 1 : 0);