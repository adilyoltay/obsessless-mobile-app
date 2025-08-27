/**
 * PipelineCacheManager Test Suite
 * 
 * Tests for the centralized cache management system used by UnifiedAIPipeline.
 * Covers memory cache, AsyncStorage, Supabase cache, and cleanup operations.
 * 
 * @since 2025-01 - Phase 3 Test Coverage
 */

import { PipelineCacheManager } from '@/features/ai/core/helpers/PipelineCacheManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/supabase');
jest.mock('@/features/ai/telemetry/aiTelemetry');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('PipelineCacheManager', () => {
  let cacheManager: PipelineCacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new PipelineCacheManager();
    
    // Setup AsyncStorage mocks
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();
    mockAsyncStorage.multiRemove.mockResolvedValue();
  });

  describe('Basic Cache Operations', () => {
    test('should set and get cache entry', async () => {
      const testData = { test: 'data' };
      
      await cacheManager.set('test', 'key1', testData);
      const result = await cacheManager.get('test', 'key1');
      
      expect(result).toEqual(testData);
    });

    test('should return null for non-existent entry', async () => {
      const result = await cacheManager.get('test', 'nonexistent');
      expect(result).toBeNull();
    });

    test('should delete cache entry', async () => {
      const testData = { test: 'data' };
      
      await cacheManager.set('test', 'key1', testData);
      await cacheManager.delete('test', 'key1');
      
      const result = await cacheManager.get('test', 'key1');
      expect(result).toBeNull();
    });
  });

  describe('Unified Cache Operations', () => {
    test('should generate unified cache key', () => {
      const input = {
        userId: 'user123',
        type: 'voice',
        content: 'test content',
        context: { source: 'mood' }
      };
      
      const key = cacheManager.generateUnifiedCacheKey(input);
      
      expect(key).toMatch(/^unified:user123:[a-f0-9]+$/);
    });

    test('should set and get unified cache', async () => {
      const testData = { analysis: 'result' };
      const key = 'unified:user123:abc123';
      
      await cacheManager.setUnified(key, testData);
      const result = await cacheManager.getUnified(key);
      
      expect(result).toEqual(testData);
    });
  });

  describe('Cache Cleanup', () => {
    test('should clear all cache entries', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        'ai:test:key1',
        'unified:user123:key2',
        'other:key3'
      ]);
      
      const clearedCount = await cacheManager.clear();
      
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        'ai:test:key1',
        'unified:user123:key2'
      ]);
      expect(clearedCount).toBeGreaterThan(0);
    });

    test('should cleanup expired entries', async () => {
      const expiredEntry = JSON.stringify({
        data: { test: 'old' },
        expires: Date.now() - 1000 // 1 second ago
      });
      
      const validEntry = JSON.stringify({
        data: { test: 'new' },
        expires: Date.now() + 60000 // 1 minute from now
      });
      
      mockAsyncStorage.getAllKeys.mockResolvedValue(['unified:user1:key1', 'unified:user2:key2']);
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(expiredEntry)
        .mockResolvedValueOnce(validEntry);
      
      await cacheManager.cleanup();
      
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('unified:user1:key1');
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalledWith('unified:user2:key2');
    });
  });

  describe('Insights-aware Caching', () => {
    test('should use short TTL for empty insights', async () => {
      const emptyResult = { insights: { therapeutic: [], progress: [] } };
      const input = { userId: 'user123', type: 'voice' };
      
      const spy = jest.spyOn(cacheManager, 'setUnified');
      
      await cacheManager.setWithInsightsPolicy('key123', emptyResult, input);
      
      expect(spy).toHaveBeenCalledWith(
        'key123',
        emptyResult,
        'unified',
        5 * 60 * 1000 // 5 minutes
      );
    });

    test('should use full TTL for meaningful insights', async () => {
      const meaningfulResult = {
        insights: {
          therapeutic: [{ text: 'test insight', category: 'mood', priority: 'high', actionable: true }],
          progress: []
        }
      };
      const input = { userId: 'user123', type: 'voice' };
      
      const spy = jest.spyOn(cacheManager, 'setUnified');
      
      await cacheManager.setWithInsightsPolicy('key123', meaningfulResult, input);
      
      expect(spy).toHaveBeenCalledWith(
        'key123',
        meaningfulResult,
        'unified',
        expect.any(Number) // Module-specific TTL
      );
    });
  });

  describe('User Cache Invalidation', () => {
    test('should invalidate user-specific cache', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([
        'unified:user123:key1',
        'unified:user456:key2',
        'unified:user123:key3'
      ]);
      
      const invalidatedCount = await cacheManager.invalidateUserCache('user123', 'all');
      
      expect(invalidatedCount).toBe(2); // Should invalidate 2 entries for user123
    });
  });

  describe('Helper Functions', () => {
    test('should count total insights correctly', () => {
      const result = {
        insights: {
          therapeutic: [
            { text: 'insight1', category: 'mood', priority: 'high', actionable: true },
            { text: 'insight2', category: 'cbt', priority: 'medium', actionable: true }
          ],
          progress: [
            { text: 'progress1', category: 'improvement', priority: 'low', actionable: false }
          ]
        }
      };
      
      const count = cacheManager.countTotalInsights(result);
      expect(count).toBe(3);
    });

    test('should return 0 for no insights', () => {
      const result = {};
      const count = cacheManager.countTotalInsights(result);
      expect(count).toBe(0);
    });

    test('should bypass negative cache correctly', () => {
      const emptyResult = { insights: { therapeutic: [], progress: [] } };
      const shortTTL = 3 * 60 * 1000; // 3 minutes
      
      const shouldBypass = cacheManager.shouldBypassNegativeCache(emptyResult, shortTTL);
      expect(shouldBypass).toBe(true);
    });

    test('should not bypass cache with insights', () => {
      const meaningfulResult = {
        insights: {
          therapeutic: [{ text: 'test', category: 'mood', priority: 'high', actionable: true }],
          progress: []
        }
      };
      const shortTTL = 3 * 60 * 1000;
      
      const shouldBypass = cacheManager.shouldBypassNegativeCache(meaningfulResult, shortTTL);
      expect(shouldBypass).toBe(false);
    });
  });
});
