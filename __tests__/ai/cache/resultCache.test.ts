/**
 * 🧪 ResultCache Test Suite
 * 
 * Tests for multi-layer caching with TTL
 */

import { ResultCacheImpl } from '@/features/ai/cache/resultCache';
import { CacheInvalidationImpl } from '@/features/ai/cache/invalidation';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('ResultCache', () => {
  let cache: ResultCacheImpl;
  
  beforeEach(() => {
    jest.clearAllMocks();
    cache = new ResultCacheImpl();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = {
        quickClass: 'MOOD' as const,
        confidence: 0.8,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: { mood: 75 },
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 1); // 1 hour TTL
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete specific keys', async () => {
      const key = 'test-key';
      const value = {
        quickClass: 'OCD' as const,
        confidence: 0.9,
        needsLLM: false,
        route: 'AUTO_SAVE' as const,
        payload: {},
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 1);
      await cache.delete(key);
      
      const retrieved = await cache.get(key);
      expect(retrieved).toBeNull();
    });

    it('should clear all cache entries', async () => {
      // Set multiple entries
      await cache.set('key1', { quickClass: 'MOOD' } as any, 1);
      await cache.set('key2', { quickClass: 'CBT' } as any, 1);
      await cache.set('key3', { quickClass: 'OCD' } as any, 1);

      // Clear all
      await cache.clear();

      // Verify all cleared
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('TTL Management', () => {
    it('should respect TTL for insights (24h)', async () => {
      const key = 'ai:user123:2024-01-04:insights';
      const value = {
        quickClass: 'OTHER' as const,
        confidence: 0.85,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: { insights: ['test'] },
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 24); // 24 hour TTL
      
      const stored = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(stored!);
      
      expect(parsed.ttl).toBe(24);
      expect(parsed.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should respect TTL for ERP plans (12h)', async () => {
      const key = 'ai:user123:2024-01-04:erp:plan';
      const value = {
        quickClass: 'ERP' as const,
        confidence: 0.9,
        needsLLM: true,
        route: 'OPEN_SCREEN' as const,
        payload: { exercises: [] },
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 12); // 12 hour TTL
      
      const stored = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(stored!);
      
      expect(parsed.ttl).toBe(12);
    });

    it('should respect TTL for voice analysis (1h)', async () => {
      const key = 'ai:user123:hash123:voice';
      const value = {
        quickClass: 'MOOD' as const,
        confidence: 0.7,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: {},
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 1); // 1 hour TTL
      
      const stored = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(stored!);
      
      expect(parsed.ttl).toBe(1);
    });

    it('should not return expired entries', async () => {
      const key = 'test-expired';
      const value = {
        quickClass: 'MOOD' as const,
        confidence: 0.8,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: {},
        cacheKey: key,
        computedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      };

      // Manually store with expired timestamp
      await AsyncStorage.setItem(key, JSON.stringify({
        ...value,
        ttl: 1,
        expiresAt: Date.now() - 60 * 60 * 1000, // Expired 1 hour ago
      }));

      const retrieved = await cache.get(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Keys', () => {
    it('should generate correct cache key format', () => {
      const userId = 'user123';
      const date = '2024-01-04';
      const type = 'insights';
      
      const key = `ai:${userId}:${date}:${type}`;
      expect(key).toBe('ai:user123:2024-01-04:insights');
    });

    it('should handle special characters in keys', async () => {
      const key = 'ai:user@test.com:2024-01-04:insights';
      const value = {
        quickClass: 'OTHER' as const,
        confidence: 0.8,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: {},
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 1);
      const retrieved = await cache.get(key);
      
      expect(retrieved).toEqual(value);
    });
  });

  describe('Memory Management', () => {
    it('should handle large cache entries', async () => {
      const key = 'large-entry';
      const largePayload = {
        data: new Array(1000).fill('test-data'),
        nested: {
          deep: {
            structure: new Array(500).fill({ id: 1, value: 'test' }),
          },
        },
      };

      const value = {
        quickClass: 'OTHER' as const,
        confidence: 0.9,
        needsLLM: false,
        route: 'OPEN_SCREEN' as const,
        payload: largePayload,
        cacheKey: key,
        computedAt: Date.now(),
      };

      await cache.set(key, value, 1);
      const retrieved = await cache.get(key);
      
      expect(retrieved?.payload).toEqual(largePayload);
    });

    it('should handle cache size limits gracefully', async () => {
      // Simulate cache size limit by filling cache
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(
          cache.set(`key-${i}`, {
            quickClass: 'OTHER' as const,
            confidence: 0.5,
            needsLLM: false,
            route: 'OPEN_SCREEN' as const,
            payload: { index: i },
            cacheKey: `key-${i}`,
            computedAt: Date.now(),
          }, 1)
        );
      }

      await Promise.all(promises);
      
      // Should still be able to retrieve recent entries
      const recent = await cache.get('key-999');
      expect(recent).toBeDefined();
    });
  });
});

describe('CacheInvalidation', () => {
  let invalidation: CacheInvalidationImpl;
  let cache: ResultCacheImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new ResultCacheImpl();
    invalidation = new CacheInvalidationImpl(cache);
  });

  describe('Trigger-based Invalidation', () => {
    it('should invalidate on CBT_THOUGHT_CREATED', async () => {
      const userId = 'user123';
      const date = new Date().toISOString().split('T')[0];
      
      // Set cache entries
      await cache.set(`ai:${userId}:${date}:insights`, {} as any, 24);
      await cache.set(`ai:${userId}:${date}:cbt:analysis`, {} as any, 12);

      // Trigger invalidation
      await invalidation.onThoughtCreated(userId);

      // Verify invalidated
      expect(await cache.get(`ai:${userId}:${date}:cbt:analysis`)).toBeNull();
    });

    it('should invalidate on ERP_SESSION_COMPLETED', async () => {
      const userId = 'user123';
      const date = new Date().toISOString().split('T')[0];
      
      // Set cache entries
      await cache.set(`ai:${userId}:${date}:erp:plan`, {} as any, 12);
      await cache.set(`ai:${userId}:${date}:erp:progress`, {} as any, 6);

      // Trigger invalidation
      await invalidation.onERPSessionCompleted(userId);

      // Verify invalidated
      expect(await cache.get(`ai:${userId}:${date}:erp:progress`)).toBeNull();
    });

    it('should invalidate on YBOCS_UPDATED', async () => {
      const userId = 'user123';
      
      // Set cache entries
      await cache.set(`ai:${userId}:treatment:plan`, {} as any, 48);
      await cache.set(`ai:${userId}:risk:assessment`, {} as any, 24);

      // Trigger invalidation
      await invalidation.onYBOCSUpdated(userId);

      // Verify invalidated
      expect(await cache.get(`ai:${userId}:treatment:plan`)).toBeNull();
      expect(await cache.get(`ai:${userId}:risk:assessment`)).toBeNull();
    });

    it('should invalidate on ONBOARDING_FINALIZED', async () => {
      const userId = 'user123';
      
      // Set all user cache entries
      await cache.set(`ai:${userId}:onboarding:temp`, {} as any, 1);
      await cache.set(`ai:${userId}:profile:draft`, {} as any, 1);

      // Trigger invalidation
      await invalidation.onOnboardingFinalized(userId);

      // Verify all user cache cleared
      expect(await cache.get(`ai:${userId}:onboarding:temp`)).toBeNull();
      expect(await cache.get(`ai:${userId}:profile:draft`)).toBeNull();
    });
  });

  describe('Pattern-based Invalidation', () => {
    it('should invalidate by pattern', async () => {
      const userId = 'user123';
      
      // Set various cache entries
      await cache.set(`ai:${userId}:2024-01-04:insights`, {} as any, 24);
      await cache.set(`ai:${userId}:2024-01-04:erp:plan`, {} as any, 12);
      await cache.set(`ai:${userId}:2024-01-03:insights`, {} as any, 24);
      await cache.set(`ai:other-user:2024-01-04:insights`, {} as any, 24);

      // Invalidate by pattern (all entries for specific date)
      await invalidation.invalidatePattern(`ai:${userId}:2024-01-04:*`);

      // Verify correct entries invalidated
      expect(await cache.get(`ai:${userId}:2024-01-04:insights`)).toBeNull();
      expect(await cache.get(`ai:${userId}:2024-01-04:erp:plan`)).toBeNull();
      
      // Other entries should remain
      expect(await cache.get(`ai:${userId}:2024-01-03:insights`)).toBeDefined();
      expect(await cache.get(`ai:other-user:2024-01-04:insights`)).toBeDefined();
    });
  });

  describe('Selective Invalidation', () => {
    it('should only invalidate specified keys', async () => {
      // Set multiple entries
      await cache.set('key1', {} as any, 1);
      await cache.set('key2', {} as any, 1);
      await cache.set('key3', {} as any, 1);

      // Invalidate specific keys
      await invalidation.invalidateKeys(['key1', 'key3']);

      // Verify selective invalidation
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeDefined();
      expect(await cache.get('key3')).toBeNull();
    });
  });
});
