/**
 * TelemetryWrapper Test Suite
 * 
 * Tests for the centralized telemetry tracking system used by UnifiedAIPipeline.
 * Covers event tracking, operation timing, and error handling.
 * 
 * @since 2025-01 - Phase 3 Test Coverage
 */

import { TelemetryWrapper } from '@/features/ai/core/helpers/TelemetryWrapper';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Mock dependencies
jest.mock('@/features/ai/telemetry/aiTelemetry');

const mockTrackAIInteraction = trackAIInteraction as jest.MockedFunction<typeof trackAIInteraction>;

describe('TelemetryWrapper', () => {
  let telemetryWrapper: TelemetryWrapper;

  beforeEach(() => {
    jest.clearAllMocks();
    telemetryWrapper = new TelemetryWrapper();
    mockTrackAIInteraction.mockResolvedValue();
  });

  describe('Event Tracking', () => {
    test('should track simple event', async () => {
      const eventType = AIEventType.UNIFIED_PIPELINE_STARTED;
      const data = { userId: 'user123', pipeline: 'unified' };

      await telemetryWrapper.trackEvent(eventType, data);

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        eventType,
        data,
        'user123'
      );
    });

    test('should extract userId from data', async () => {
      const eventType = AIEventType.UNIFIED_PIPELINE_COMPLETED;
      const data = { user_id: 'user456', pipeline: 'unified' };

      await telemetryWrapper.trackEvent(eventType, data);

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        eventType,
        data,
        'user456'
      );
    });

    test('should handle missing userId', async () => {
      const eventType = AIEventType.CACHE_INVALIDATION;
      const data = { reason: 'manual' };

      await telemetryWrapper.trackEvent(eventType, data);

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        eventType,
        data,
        undefined
      );
    });
  });

  describe('Operation Tracking', () => {
    test('should track successful async operation', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const context = {
        userId: 'user123',
        module: 'cache',
        operation: 'set',
        metadata: { key: 'test' }
      };

      const result = await telemetryWrapper.track(
        mockOperation,
        AIEventType.CACHE_OPERATION,
        context
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
      expect(mockTrackAIInteraction).toHaveBeenCalledTimes(2); // Start and complete events
    });

    test('should track failed async operation', async () => {
      const error = new Error('Operation failed');
      const mockOperation = jest.fn().mockRejectedValue(error);
      const context = {
        userId: 'user123',
        module: 'pattern',
        operation: 'match'
      };

      await expect(
        telemetryWrapper.track(mockOperation, AIEventType.PATTERN_MATCH, context)
      ).rejects.toThrow('Operation failed');

      expect(mockTrackAIInteraction).toHaveBeenCalledTimes(2); // Start and error events
    });
  });

  describe('Performance Tracking', () => {
    test('should track operation duration', async () => {
      const slowOperation = () => new Promise(resolve => 
        setTimeout(() => resolve('done'), 100)
      );

      const context = { userId: 'user123', operation: 'slow_task' };

      await telemetryWrapper.track(slowOperation, AIEventType.PERFORMANCE_METRIC, context);

      // Check that completion event includes duration
      const completionCall = mockTrackAIInteraction.mock.calls.find(
        call => call[1].success === true && call[1].duration !== undefined
      );

      expect(completionCall).toBeDefined();
      expect(completionCall[1].duration).toBeGreaterThan(90); // Should be ~100ms
    });

    test('should track cache hits', async () => {
      const cacheKey = 'unified:user123:abc123';
      
      await telemetryWrapper.trackCacheHit(cacheKey, 'memory', {
        userId: 'user123',
        module: 'unified'
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        AIEventType.CACHE_HIT,
        expect.objectContaining({
          cacheKey,
          layer: 'memory',
          userId: 'user123',
          module: 'unified'
        }),
        'user123'
      );
    });

    test('should track cache misses', async () => {
      const cacheKey = 'unified:user456:def456';
      
      await telemetryWrapper.trackCacheMiss(cacheKey, 'not_found', {
        userId: 'user456'
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        AIEventType.CACHE_MISS,
        expect.objectContaining({
          cacheKey,
          reason: 'not_found',
          userId: 'user456'
        }),
        'user456'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle telemetry errors gracefully', async () => {
      mockTrackAIInteraction.mockRejectedValue(new Error('Telemetry service down'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw, just log error
      await expect(
        telemetryWrapper.trackEvent(AIEventType.UNIFIED_PIPELINE_ERROR, { test: 'data' })
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Telemetry error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('should continue operation even if telemetry fails', async () => {
      mockTrackAIInteraction.mockRejectedValue(new Error('Network error'));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await telemetryWrapper.track(
        mockOperation,
        AIEventType.UNIFIED_PIPELINE_STARTED
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });
  });

  describe('Batch Operations', () => {
    test('should track batch start and completion', async () => {
      await telemetryWrapper.trackBatchStart('cache_cleanup', {
        userId: 'user123',
        batchSize: 50
      });

      await telemetryWrapper.trackBatchComplete('cache_cleanup', {
        userId: 'user123',
        processedItems: 45,
        failedItems: 5
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        AIEventType.BATCH_OPERATION_STARTED,
        expect.objectContaining({
          operation: 'cache_cleanup',
          batchSize: 50
        }),
        'user123'
      );

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        AIEventType.BATCH_OPERATION_COMPLETED,
        expect.objectContaining({
          operation: 'cache_cleanup',
          processedItems: 45,
          failedItems: 5
        }),
        'user123'
      );
    });
  });

  describe('Context Management', () => {
    test('should generate unique operation IDs', () => {
      const wrapper = new TelemetryWrapper();
      
      // Access private method via any cast for testing
      const id1 = (wrapper as any).generateOperationId();
      const id2 = (wrapper as any).generateOperationId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });

    test('should track operation stack depth', async () => {
      const nestedOperation = async () => {
        return await telemetryWrapper.track(
          () => Promise.resolve('nested'),
          AIEventType.PATTERN_MATCH,
          { operation: 'inner' }
        );
      };

      await telemetryWrapper.track(
        nestedOperation,
        AIEventType.UNIFIED_PIPELINE_STARTED,
        { operation: 'outer' }
      );

      // Should have tracked 4 events: outer start, inner start, inner complete, outer complete
      expect(mockTrackAIInteraction).toHaveBeenCalledTimes(4);
    });
  });
});
