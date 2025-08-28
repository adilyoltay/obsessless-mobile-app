/**
 * 🚨 useAIErrorHandler Hook
 * 
 * React hook for handling AI errors with consistent UX patterns.
 * Provides methods to show AI errors, manage retry states, and handle error recovery.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { aiErrorFeedbackService, AIErrorType, type AIErrorContext } from '@/features/ai-fallbacks/aiErrorFeedbackService';

interface AIErrorState {
  hasError: boolean;
  errorType?: AIErrorType;
  errorMessage?: string;
  isRetrying: boolean;
  retryCount: number;
  lastErrorTime?: number;
}

interface UseAIErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  showUserFeedback?: boolean;
  feature?: string;
  userId?: string;
}

interface UseAIErrorHandlerReturn {
  error: AIErrorState;
  handleError: (error: Error | AIErrorType, context?: Partial<AIErrorContext>) => Promise<void>;
  retry: (operation: () => Promise<void> | void) => Promise<void>;
  clearError: () => void;
  canRetry: boolean;
}

export function useAIErrorHandler(options: UseAIErrorHandlerOptions = {}): UseAIErrorHandlerReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showUserFeedback = true,
    feature = 'unknown',
    userId
  } = options;

  const [errorState, setErrorState] = useState<AIErrorState>({
    hasError: false,
    isRetrying: false,
    retryCount: 0,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle AI Error
   * 
   * Processes AI errors, shows user feedback, and updates error state.
   */
  const handleError = useCallback(async (
    error: Error | AIErrorType,
    context: Partial<AIErrorContext> = {}
  ): Promise<void> => {
    try {
      let errorType: AIErrorType;
      let errorMessage: string;

      // Determine error type and message
      if (typeof error === 'string') {
        errorType = error as AIErrorType;
        errorMessage = `AI Error: ${error}`;
      } else if (error instanceof Error) {
        // Classify error based on message content
        errorMessage = error.message;
        
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('NetworkError')) {
          errorType = AIErrorType.NETWORK_FAILURE;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
          errorType = AIErrorType.ANALYSIS_TIMEOUT;
        } else if (errorMessage.includes('budget') || errorMessage.includes('limit') || errorMessage.includes('quota')) {
          errorType = AIErrorType.TOKEN_BUDGET_EXCEEDED;
        } else if (errorMessage.includes('confidence') || errorMessage.includes('abstain')) {
          errorType = AIErrorType.LOW_CONFIDENCE_ABSTAIN;
        } else if (errorMessage.includes('service') || errorMessage.includes('unavailable') || errorMessage.includes('503')) {
          errorType = AIErrorType.SERVICE_UNAVAILABLE;
        } else if (errorMessage.includes('rate') || errorMessage.includes('429')) {
          errorType = AIErrorType.RATE_LIMIT_EXCEEDED;
        } else {
          errorType = AIErrorType.UNKNOWN_ERROR;
        }
      } else {
        errorType = AIErrorType.UNKNOWN_ERROR;
        errorMessage = 'Unknown AI error occurred';
      }

      // Update error state
      setErrorState(prev => ({
        hasError: true,
        errorType,
        errorMessage,
        isRetrying: false,
        retryCount: prev.retryCount,
        lastErrorTime: Date.now(),
      }));

      // Show user feedback if enabled
      if (showUserFeedback) {
        const errorContext: AIErrorContext = {
          userId,
          feature,
          retryable: errorState.retryCount < maxRetries,
          metadata: {
            retryCount: errorState.retryCount,
            errorMessage,
            ...context.metadata
          },
          ...context
        };

        await aiErrorFeedbackService.handleAIError(errorType, errorContext, error instanceof Error ? error : undefined);
      }

    } catch (handlingError) {
      console.error('❌ Failed to handle AI error:', handlingError);
      
      // Fallback error state
      setErrorState({
        hasError: true,
        errorType: AIErrorType.UNKNOWN_ERROR,
        errorMessage: 'Error handling failed',
        isRetrying: false,
        retryCount: errorState.retryCount,
        lastErrorTime: Date.now(),
      });
    }
  }, [errorState.retryCount, feature, userId, maxRetries, showUserFeedback]);

  /**
   * Retry Operation
   * 
   * Attempts to retry a failed operation with exponential backoff.
   */
  const retry = useCallback(async (operation: () => Promise<void> | void): Promise<void> => {
    if (errorState.retryCount >= maxRetries) {
      console.warn('⚠️ Max retries exceeded, cannot retry');
      return;
    }

    if (errorState.isRetrying) {
      console.warn('⚠️ Already retrying, please wait');
      return;
    }

    try {
      // Update retry state
      setErrorState(prev => ({
        ...prev,
        isRetrying: true,
        retryCount: prev.retryCount + 1,
      }));

      // Calculate delay with exponential backoff
      const delay = retryDelay * Math.pow(2, errorState.retryCount);
      
      if (delay > 0) {
        console.log(`🔄 Retrying in ${delay}ms (attempt ${errorState.retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(resolve, delay);
        });
      }

      // Attempt the operation
      await Promise.resolve(operation());

      // Success - clear error state
      setErrorState({
        hasError: false,
        isRetrying: false,
        retryCount: 0,
      });

      console.log('✅ Retry successful');

    } catch (retryError) {
      console.error('❌ Retry failed:', retryError);
      
      // Update error state with retry failure
      setErrorState(prev => ({
        ...prev,
        isRetrying: false,
        errorMessage: retryError instanceof Error ? retryError.message : 'Retry failed',
        lastErrorTime: Date.now(),
      }));

      // If max retries reached, show final error
      if (errorState.retryCount + 1 >= maxRetries) {
        await handleError(retryError instanceof Error ? retryError : AIErrorType.UNKNOWN_ERROR, {
          metadata: {
            finalRetry: true,
            totalRetries: errorState.retryCount + 1
          }
        });
      }

      throw retryError; // Re-throw for caller to handle
    }
  }, [errorState.isRetrying, errorState.retryCount, maxRetries, retryDelay, handleError]);

  /**
   * Clear Error State
   */
  const clearError = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    setErrorState({
      hasError: false,
      isRetrying: false,
      retryCount: 0,
    });
  }, []);

  /**
   * Check if retry is possible
   */
  const canRetry = errorState.hasError && 
                   !errorState.isRetrying && 
                   errorState.retryCount < maxRetries &&
                   errorState.errorType !== AIErrorType.TOKEN_BUDGET_EXCEEDED &&
                   errorState.errorType !== AIErrorType.DATA_INSUFFICIENT;

  return {
    error: errorState,
    handleError,
    retry,
    clearError,
    canRetry
  };
}

/**
 * useAIErrorHandler with specific feature context
 */
export function useAIErrorHandlerForFeature(
  feature: string,
  userId?: string,
  options: Omit<UseAIErrorHandlerOptions, 'feature' | 'userId'> = {}
) {
  return useAIErrorHandler({
    ...options,
    feature,
    userId
  });
}

/**
 * Global AI error event listener hook
 */
export function useAIErrorRetryListener(onRetry: (feature: string, context: any) => void) {
  useEffect(() => {
    const handleRetry = (event: CustomEvent) => {
      onRetry(event.detail.feature, event.detail.context);
    };

    // Listen for retry events from aiErrorFeedbackService
    if (typeof window !== 'undefined') {
      window.addEventListener('ai-error-retry' as any, handleRetry);
      
      return () => {
        window.removeEventListener('ai-error-retry' as any, handleRetry);
      };
    }
  }, [onRetry]);
}
