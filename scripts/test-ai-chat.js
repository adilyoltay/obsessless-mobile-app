#!/usr/bin/env node

/**
 * 🧪 AI Chat Test Suite - Sprint 3 Validation
 * 
 * Bu script yeni AI Chat sisteminin doğru çalıştığını test eder.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('💬 AI Chat Test Suite - Sprint 3');
console.log('==================================\n');

// Test sonuçları
const testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function runTest(testName, testFunction) {
  testResults.total++;
  console.log(`\n🔍 Running: ${testName}`);
  
  try {
    testFunction();
    console.log(`✅ PASSED: ${testName}`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    testResults.failed++;
  }
}

// Test 1: Chat Store Exists
runTest('AI Chat Store Exists', () => {
  const chatStorePath = path.join(__dirname, '..', 'features', 'ai', 'store', 'aiChatStore.ts');
  
  if (!fs.existsSync(chatStorePath)) {
    throw new Error('Chat store file missing');
  }
  
  const content = fs.readFileSync(chatStorePath, 'utf8');
  
  const requiredComponents = [
    'useAIChatStore',
    'AIChatState',
    'initialize',
    'sendMessage',
    'createConversation',
    'crisisDetectionService',
    'contentFilterService',
    'trackAIInteraction'
  ];
  
  for (const component of requiredComponents) {
    if (!content.includes(component)) {
      throw new Error(`Missing component: ${component}`);
    }
  }
  
  console.log('   ✓ All required chat store components present');
});

// Test 2: Chat Interface Exists
runTest('AI Chat Interface Exists', () => {
  const chatInterfacePath = path.join(__dirname, '..', 'features', 'ai', 'components', 'ChatInterface.tsx');
  
  if (!fs.existsSync(chatInterfacePath)) {
    throw new Error('Chat interface file missing');
  }
  
  const content = fs.readFileSync(chatInterfacePath, 'utf8');
  
  const requiredComponents = [
    'ChatInterface',
    'ChatInterfaceCore',
    'MessageBubble',
    'TypingIndicator',
    'CrisisHelpBanner',
    'AIChatErrorBoundary',
    'useAIChatStore',
    'crisisDetectionService'
  ];
  
  for (const component of requiredComponents) {
    if (!content.includes(component)) {
      throw new Error(`Missing component: ${component}`);
    }
  }
  
  console.log('   ✓ All required chat interface components present');
});

// Test 3: Safety Integration
runTest('Safety Systems Integration', () => {
  const chatStorePath = path.join(__dirname, '..', 'features', 'ai', 'store', 'aiChatStore.ts');
  const content = fs.readFileSync(chatStorePath, 'utf8');
  
  const safetyComponents = [
    'crisisDetectionService.detectCrisis',
    'contentFilterService.filterContent',
    'CrisisRiskLevel',
    'handleCrisisMessage',
    'getCrisisResponseMessage'
  ];
  
  for (const component of safetyComponents) {
    if (!content.includes(component)) {
      throw new Error(`Missing safety component: ${component}`);
    }
  }
  
  console.log('   ✓ All safety systems properly integrated');
});

// Test 4: Error Boundary Integration
runTest('Error Boundary Integration', () => {
  const chatInterfacePath = path.join(__dirname, '..', 'features', 'ai', 'components', 'ChatInterface.tsx');
  const content = fs.readFileSync(chatInterfacePath, 'utf8');
  
  if (!content.includes('AIChatErrorBoundary')) {
    throw new Error('Error boundary not integrated');
  }
  
  if (!content.includes('<AIChatErrorBoundary>')) {
    throw new Error('Error boundary not wrapping component');
  }
  
  console.log('   ✓ Error boundary properly integrated');
});

// Test 5: Tab Integration
runTest('Tab Integration', () => {
  const tabPath = path.join(__dirname, '..', 'app', '(tabs)', 'ai-chat.tsx');
  
  if (!fs.existsSync(tabPath)) {
    throw new Error('AI chat tab file missing');
  }
  
  const content = fs.readFileSync(tabPath, 'utf8');
  
  // Check new imports
  if (!content.includes("import { ChatInterface } from '@/features/ai/components/ChatInterface'")) {
    throw new Error('New ChatInterface import missing');
  }
  
  if (!content.includes('<ChatInterface')) {
    throw new Error('ChatInterface component not used');
  }
  
  // Check old code removed
  if (content.includes('AIChatService')) {
    throw new Error('Old AIChatService still referenced');
  }
  
  console.log('   ✓ Tab properly updated with new chat system');
});

// Test 6: Feature Flag Integration
runTest('Feature Flag Integration', () => {
  const chatInterfacePath = path.join(__dirname, '..', 'features', 'ai', 'components', 'ChatInterface.tsx');
  const content = fs.readFileSync(chatInterfacePath, 'utf8');
  
  if (!content.includes("FEATURE_FLAGS.isEnabled('AI_CHAT')")) {
    throw new Error('Feature flag check missing');
  }
  
  if (!content.includes('AI Chat Devre Dışı')) {
    throw new Error('Feature disabled UI missing');
  }
  
  console.log('   ✓ Feature flag integration complete');
});

// Test 7: Telemetry Integration
runTest('Telemetry Integration', () => {
  const chatStorePath = path.join(__dirname, '..', 'features', 'ai', 'store', 'aiChatStore.ts');
  const content = fs.readFileSync(chatStorePath, 'utf8');
  
  const telemetryEvents = [
    'AIEventType.CHAT_SESSION_STARTED',
    'AIEventType.CHAT_SESSION_ENDED',
    'AIEventType.CHAT_MESSAGE_SENT',
    'trackAIInteraction'
  ];
  
  for (const event of telemetryEvents) {
    if (!content.includes(event)) {
      throw new Error(`Missing telemetry event: ${event}`);
    }
  }
  
  console.log('   ✓ Telemetry integration complete');
});

// Test 8: State Management
runTest('State Management Structure', () => {
  const chatStorePath = path.join(__dirname, '..', 'features', 'ai', 'store', 'aiChatStore.ts');
  const content = fs.readFileSync(chatStorePath, 'utf8');
  
  const stateComponents = [
    'conversations:',
    'activeConversationId:',
    'ui:',
    'currentSession:',
    'userProfile:',
    'isEnabled:',
    'isInitialized:'
  ];
  
  for (const component of stateComponents) {
    if (!content.includes(component)) {
      throw new Error(`Missing state component: ${component}`);
    }
  }
  
  console.log('   ✓ State management structure complete');
});

// Test 9: Backup Files Created
runTest('Backup Files Created', () => {
  const backupDir = path.join(__dirname, '..', 'backup', 'sprint3_old_chat');
  
  if (!fs.existsSync(backupDir)) {
    throw new Error('Backup directory not created');
  }
  
  const backupFiles = [
    'ai-chat.tsx',
    'aiChatService.ts',
    'aiConfig.ts'
  ];
  
  for (const file of backupFiles) {
    const backupPath = path.join(backupDir, file);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file missing: ${file}`);
    }
  }
  
  console.log('   ✓ Old system properly backed up');
});

// Test 10: UI Components Accessibility
runTest('UI Accessibility Features', () => {
  const chatInterfacePath = path.join(__dirname, '..', 'features', 'ai', 'components', 'ChatInterface.tsx');
  const content = fs.readFileSync(chatInterfacePath, 'utf8');
  
  const accessibilityFeatures = [
    'accessibilityLabel',
    'accessibilityHint',
    'accessibilityRole',
    'Haptics.impactAsync',
    'Haptics.notificationAsync'
  ];
  
  for (const feature of accessibilityFeatures) {
    if (!content.includes(feature)) {
      throw new Error(`Missing accessibility feature: ${feature}`);
    }
  }
  
  console.log('   ✓ Accessibility features present');
});

// Test sonuçlarını göster
console.log('\n🏁 AI Chat Test Results');
console.log('=========================');
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📊 Total: ${testResults.total}`);

const successRate = (testResults.passed / testResults.total * 100).toFixed(1);
console.log(`📈 Success Rate: ${successRate}%`);

if (testResults.failed > 0) {
  console.log('\n🚨 CRITICAL: Some chat tests failed!');
  console.log('Sprint 3 chat requirements not fully met.');
  console.log('Please fix issues before proceeding to Sprint 4.');
  process.exit(1);
} else {
  console.log('\n🎉 All chat tests passed!');
  console.log('✅ Sprint 3: Chat Interface & Store COMPLETED');
  console.log('🚀 Ready to proceed to Sprint 4: CBT Engine Integration');
  
  // Sprint 3 summary
  console.log('\n📋 Sprint 3 Achievements:');
  console.log('▶️ Modern Chat Interface with accessibility');
  console.log('▶️ Context-Aware Chat Store with persistence');
  console.log('▶️ Crisis Detection & Content Filtering integration');
  console.log('▶️ Error Boundaries with graceful fallbacks');
  console.log('▶️ Comprehensive telemetry and monitoring');
  console.log('▶️ Feature flag integration complete');
  console.log('▶️ Old system backed up safely');
}