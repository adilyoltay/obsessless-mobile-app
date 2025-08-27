/**
 * 🔧 Debug AI Errors Utilities
 * 
 * Debugging utilities for testing and monitoring the AI error feedback system.
 * Use in Metro console: `debugAIErrors.testErrorTypes()`
 */

import { aiErrorFeedbackService, AIErrorType } from '@/features/ai/feedback/aiErrorFeedbackService';

/**
 * 🧪 Test all AI error types
 */
export const testErrorTypes = async () => {
  console.log('🧪 Testing AI error feedback system...');
  
  const testUserId = 'test-user-ai-errors';
  
  const errorTests = [
    {
      type: AIErrorType.TOKEN_BUDGET_EXCEEDED,
      context: {
        userId: testUserId,
        feature: 'voice_analysis',
        heuristicFallback: true,
        retryable: true,
        retryAfter: 24 * 60 * 60,
        metadata: { testCase: 'token_budget' }
      }
    },
    {
      type: AIErrorType.LOW_CONFIDENCE_ABSTAIN,
      context: {
        userId: testUserId,
        feature: 'mood_analysis',
        heuristicFallback: false,
        retryable: true,
        metadata: { confidence: 0.3, testCase: 'low_confidence' }
      }
    },
    {
      type: AIErrorType.NETWORK_FAILURE,
      context: {
        userId: testUserId,
        feature: 'unified_pipeline',
        heuristicFallback: true,
        retryable: true,
        metadata: { testCase: 'network_failure' }
      }
    },
    {
      type: AIErrorType.PROGRESSIVE_ENHANCEMENT_FAILED,
      context: {
        userId: testUserId,
        feature: 'unified_pipeline',
        heuristicFallback: true,
        retryable: false,
        metadata: { testCase: 'progressive_enhancement' }
      }
    },
    {
      type: AIErrorType.SERVICE_UNAVAILABLE,
      context: {
        userId: testUserId,
        feature: 'external_ai',
        heuristicFallback: false,
        retryable: true,
        metadata: { testCase: 'service_unavailable' }
      }
    }
  ];

  for (let i = 0; i < errorTests.length; i++) {
    const test = errorTests[i];
    console.log(`\n${i + 1}️⃣ Testing ${test.type}...`);
    
    try {
      await aiErrorFeedbackService.handleAIError(test.type, test.context);
      console.log(`✅ Error type ${test.type} handled successfully`);
    } catch (error) {
      console.error(`❌ Failed to handle error type ${test.type}:`, error);
    }
    
    // Wait between tests to avoid UI flooding
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 AI error testing completed!');
};

/**
 * 🚀 Test rapid error scenarios (stress test)
 */
export const stressTestErrors = async (count: number = 5) => {
  console.log(`🚀 Stress testing AI errors with ${count} rapid errors...`);
  
  const testUserId = 'stress-test-user';
  
  const promises = Array.from({ length: count }, async (_, index) => {
    const errorType = [
      AIErrorType.TOKEN_BUDGET_EXCEEDED,
      AIErrorType.LOW_CONFIDENCE_ABSTAIN,
      AIErrorType.NETWORK_FAILURE,
      AIErrorType.UNKNOWN_ERROR
    ][index % 4];
    
    try {
      await aiErrorFeedbackService.handleAIError(errorType, {
        userId: testUserId,
        feature: 'stress_test',
        retryable: true,
        metadata: { 
          testIndex: index,
          stressTest: true
        }
      });
      
      console.log(`${index + 1}. ${errorType}: ✅ Handled`);
      return { success: true, errorType, index };
    } catch (error) {
      console.log(`${index + 1}. ${errorType}: ❌ Failed`);
      return { success: false, errorType, index, error };
    }
  });
  
  const results = await Promise.allSettled(promises);
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
  
  console.log(`\n📊 Stress test results:`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success rate: ${((successful / count) * 100).toFixed(1)}%`);
  
  return { successful, failed, total: count };
};

/**
 * 📊 Get error feedback statistics
 */
export const getErrorStats = async () => {
  console.log('📊 Fetching AI error feedback statistics...');
  
  try {
    const stats = await aiErrorFeedbackService.getErrorStats();
    
    console.log('\n📈 AI Error Statistics:');
    
    const errorTypes = Object.keys(stats);
    if (errorTypes.length === 0) {
      console.log('No errors recorded yet.');
      return stats;
    }
    
    errorTypes.forEach(errorType => {
      const stat = stats[errorType];
      const lastOccurrence = new Date(stat.lastOccurrence).toLocaleString();
      console.log(`\n🔸 ${errorType}:`);
      console.log(`  Count: ${stat.count}`);
      console.log(`  Last occurrence: ${lastOccurrence}`);
    });
    
    const totalErrors = errorTypes.reduce((sum, type) => sum + stats[type].count, 0);
    console.log(`\n📊 Total errors: ${totalErrors}`);
    
    // Most frequent error
    if (errorTypes.length > 0) {
      const mostFrequent = errorTypes.reduce((a, b) => 
        stats[a].count > stats[b].count ? a : b
      );
      console.log(`🔥 Most frequent: ${mostFrequent} (${stats[mostFrequent].count} times)`);
    }
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get error stats:', error);
  }
};

/**
 * 🧹 Clear error history
 */
export const clearErrorHistory = async () => {
  console.log('🧹 Clearing AI error feedback history...');
  
  try {
    await aiErrorFeedbackService.clearErrorHistory();
    console.log('✅ Error history cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear error history:', error);
  }
};

/**
 * 🎯 Simulate specific error scenario
 */
export const simulateErrorScenario = async (scenario: 'token_exhausted' | 'network_down' | 'ai_overloaded' | 'low_quality_input') => {
  console.log(`🎯 Simulating error scenario: ${scenario}`);
  
  const testUserId = 'scenario-test-user';
  
  switch (scenario) {
    case 'token_exhausted':
      console.log('💰 Simulating token budget exhaustion...');
      await aiErrorFeedbackService.handleAIError(AIErrorType.TOKEN_BUDGET_EXCEEDED, {
        userId: testUserId,
        feature: 'voice_analysis',
        heuristicFallback: true,
        retryable: true,
        retryAfter: 24 * 60 * 60,
        metadata: {
          dailyUsage: 1000,
          limit: 1000,
          scenario: 'token_exhausted'
        }
      });
      break;
      
    case 'network_down':
      console.log('📶 Simulating network failure...');
      await aiErrorFeedbackService.handleAIError(AIErrorType.NETWORK_FAILURE, {
        userId: testUserId,
        feature: 'mood_analysis',
        heuristicFallback: true,
        retryable: true,
        metadata: {
          connectionType: 'offline',
          scenario: 'network_down'
        }
      });
      break;
      
    case 'ai_overloaded':
      console.log('🔧 Simulating AI service overload...');
      await aiErrorFeedbackService.handleAIError(AIErrorType.SERVICE_UNAVAILABLE, {
        userId: testUserId,
        feature: 'unified_pipeline',
        heuristicFallback: false,
        retryable: true,
        metadata: {
          serviceLoad: 'high',
          scenario: 'ai_overloaded'
        }
      });
      break;
      
    case 'low_quality_input':
      console.log('🤔 Simulating low quality user input...');
      await aiErrorFeedbackService.handleAIError(AIErrorType.LOW_CONFIDENCE_ABSTAIN, {
        userId: testUserId,
        feature: 'voice_analysis',
        heuristicFallback: false,
        retryable: true,
        metadata: {
          inputLength: 5,
          confidence: 0.2,
          scenario: 'low_quality_input'
        }
      });
      break;
      
    default:
      console.log('❓ Unknown scenario, using generic error');
      await aiErrorFeedbackService.handleAIError(AIErrorType.UNKNOWN_ERROR, {
        userId: testUserId,
        feature: 'unknown',
        retryable: true,
        metadata: { scenario }
      });
  }
  
  console.log(`✅ Scenario ${scenario} simulation completed`);
};

/**
 * 🔄 Test retry mechanism
 */
export const testRetryMechanism = async () => {
  console.log('🔄 Testing retry mechanism...');
  
  let retryCount = 0;
  
  const mockOperation = () => {
    retryCount++;
    console.log(`Attempt ${retryCount}...`);
    
    if (retryCount < 3) {
      throw new Error(`Mock failure ${retryCount}`);
    }
    
    console.log('✅ Mock operation successful!');
  };
  
  try {
    // This would be used with useAIErrorHandler hook in real components
    console.log('Note: This test requires component integration with useAIErrorHandler hook');
    console.log('See useAIErrorHandler.ts for retry mechanism implementation');
    
    // Simulate the retry logic
    for (let i = 0; i < 3; i++) {
      try {
        mockOperation();
        break;
      } catch (error) {
        console.log(`❌ Attempt ${i + 1} failed:`, error.message);
        if (i < 2) {
          console.log('🔄 Retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error('❌ Retry mechanism test failed:', error);
  }
};

/**
 * 📱 Test component integration
 */
export const testComponentIntegration = () => {
  console.log('📱 Component Integration Test');
  console.log('=============================');
  
  console.log(`
To test AI error feedback in components:

1. Import useAIErrorHandler hook:
   import { useAIErrorHandler } from '@/hooks/useAIErrorHandler';

2. Use in component:
   const { error, handleError, retry, clearError, canRetry } = useAIErrorHandler({
     feature: 'mood_analysis',
     userId: user?.id
   });

3. Handle AI operations:
   try {
     await someAIOperation();
   } catch (error) {
     await handleError(error);
   }

4. Show error state:
   {error.hasError && (
     <AIErrorState
       errorType={error.errorType}
       onRetry={() => retry(someAIOperation)}
       onDismiss={clearError}
       showRetry={canRetry}
     />
   )}

5. Test with these error scenarios:
   - Throw new Error('network timeout')
   - Throw new Error('token budget exceeded') 
   - Throw new Error('service unavailable')
`);
};

// Export all functions for Metro console usage
export const debugAIErrors = {
  testErrorTypes,
  stressTestErrors,
  getErrorStats,
  clearErrorHistory,
  simulateErrorScenario,
  testRetryMechanism,
  testComponentIntegration
};

// For Metro console: window.debugAIErrors = debugAIErrors
if (typeof global !== 'undefined') {
  (global as any).debugAIErrors = debugAIErrors;
}
