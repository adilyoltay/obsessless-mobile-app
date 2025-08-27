/**
 * PipelineCacheManager
 * 
 * UnifiedAIPipeline için merkezi cache yönetim sistemi.
 * TTL, invalidation ve cache strategy yönetimi.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackAIInteraction, AIEventType } from '../../telemetry/aiTelemetry';
import supabaseService from '@/services/supabase';

export interface CacheConfig {
  ttl: number; // seconds
  maxSize?: number;
  keyPrefix: string;
  strategy?: 'lru' | 'fifo' | 'ttl-only';
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits?: number;
  lastAccessed?: number;
  size?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  totalSize: number;
  itemCount: number;
}

export class PipelineCacheManager {
  private readonly configs: Map<string, CacheConfig> = new Map([
    ['voice', { ttl: 3600, keyPrefix: 'ai:voice:', strategy: 'lru' }],
    ['patterns', { ttl: 43200, keyPrefix: 'ai:patterns:', strategy: 'ttl-only' }],
    ['insights', { ttl: 86400, keyPrefix: 'ai:insights:', strategy: 'ttl-only' }],
    ['cbt', { ttl: 86400, keyPrefix: 'ai:cbt:', strategy: 'lru' }],
    ['analytics', { ttl: 21600, keyPrefix: 'ai:analytics:', strategy: 'ttl-only' }],
    ['breathwork', { ttl: 7200, keyPrefix: 'ai:breath:', strategy: 'lru' }],
  ]);
  
  // Cache storage
  private readonly caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  
  // Cache statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    hitRate: 0,
    totalSize: 0,
    itemCount: 0
  };
  
  // LRU tracking
  private lruOrder: Map<string, number> = new Map();
  
  // Environment-based TTL overrides
  private readonly TTL_ENV_PREFIX = 'PIPELINE_TTL_';
  private readonly TEST_TTL_OVERRIDE = process.env.TEST_TTL_MS ? 
    parseInt(process.env.TEST_TTL_MS) / 1000 : null;
  
  constructor() {
    this.loadEnvironmentOverrides();
    this.initializeStats();
  }
  
  /**
   * Load TTL overrides from environment
   */
  private loadEnvironmentOverrides(): void {
    // Check for environment-specific TTL overrides
    for (const [type, config] of this.configs) {
      const envKey = `${this.TTL_ENV_PREFIX}${type.toUpperCase()}_MS`;
      const envValue = process.env[envKey];
      
      if (envValue) {
        const ttlMs = parseInt(envValue);
        if (!isNaN(ttlMs)) {
          config.ttl = ttlMs / 1000; // Convert ms to seconds
          console.log(`📋 Cache TTL override for ${type}: ${config.ttl}s`);
        }
      }
    }
    
    // Test environment override
    if (this.TEST_TTL_OVERRIDE) {
      for (const config of this.configs.values()) {
        config.ttl = this.TEST_TTL_OVERRIDE;
      }
      console.log(`🧪 Test mode: All cache TTLs set to ${this.TEST_TTL_OVERRIDE}s`);
    }
  }
  
  /**
   * Initialize statistics from storage
   */
  private async initializeStats(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('ai:cache:stats');
      if (stored) {
        this.stats = JSON.parse(stored);
      }
    } catch (error) {
      console.log('Cache stats initialization failed:', error);
    }
  }
  
  /**
   * Get cached data with type safety
   */
  async get<T>(type: string, key: string): Promise<T | null> {
    const config = this.configs.get(type);
    if (!config) {
      console.warn(`Unknown cache type: ${type}`);
      return null;
    }
    
    const cacheKey = `${config.keyPrefix}${key}`;
    
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) {
        this.recordMiss();
        return null;
      }
      
      const entry: CacheEntry<T> = JSON.parse(cached);
      const age = Date.now() - entry.timestamp;
      
      // Check TTL
      if (age > entry.ttl * 1000) {
        await this.delete(type, key);
        this.recordMiss();
        this.recordEviction();
        
        // Track cache miss
        await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_MISS, {
          type,
          key,
          reason: 'expired',
          age: Math.floor(age / 1000)
        });
        
        return null;
      }
      
      // Update LRU tracking
      if (config.strategy === 'lru') {
        this.updateLRU(cacheKey);
        entry.lastAccessed = Date.now();
        entry.hits = (entry.hits || 0) + 1;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      }
      
      this.recordHit();
      
      // Track cache hit
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_HIT, {
        type,
        key,
        age: Math.floor(age / 1000),
        hits: entry.hits
      });
      
      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMiss();
      return null;
    }
  }
  
  /**
   * Set cache data
   */
  async set<T>(type: string, key: string, data: T, customTTL?: number): Promise<void> {
    const config = this.configs.get(type);
    if (!config) {
      console.warn(`Unknown cache type: ${type}`);
      return;
    }
    
    const cacheKey = `${config.keyPrefix}${key}`;
    const ttl = customTTL || config.ttl;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now(),
      size: this.estimateSize(data)
    };
    
    try {
      // Check cache size limits
      if (config.maxSize) {
        await this.enforceMaxSize(type, config.maxSize);
      }
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // Update LRU tracking
      if (config.strategy === 'lru') {
        this.updateLRU(cacheKey);
      }
      
      this.stats.itemCount++;
      this.stats.totalSize += entry.size || 0;
      await this.saveStats();
      
    } catch (error) {
      console.error('Cache set error:', error);
      
      // If storage is full, try to evict old entries
      if (error instanceof Error && error.message.includes('storage')) {
        await this.evictOldEntries(type, 5);
        
        // Retry once
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
        } catch (retryError) {
          console.error('Cache set retry failed:', retryError);
        }
      }
    }
  }
  
  /**
   * Delete cache entry
   */
  async delete(type: string, key: string): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    const cacheKey = `${config.keyPrefix}${key}`;
    
    try {
      const existing = await AsyncStorage.getItem(cacheKey);
      if (existing) {
        const entry: CacheEntry = JSON.parse(existing);
        this.stats.itemCount = Math.max(0, this.stats.itemCount - 1);
        this.stats.totalSize = Math.max(0, this.stats.totalSize - (entry.size || 0));
      }
      
      await AsyncStorage.removeItem(cacheKey);
      this.lruOrder.delete(cacheKey);
      
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  /**
   * Invalidate all cache entries for a type
   */
  async invalidate(type: string, userId?: string): Promise<number> {
    const config = this.configs.get(type);
    if (!config) return 0;
    
    let invalidatedCount = 0;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const prefix = userId ? 
        `${config.keyPrefix}${userId}:` : 
        config.keyPrefix;
      
      const typeKeys = allKeys.filter(k => k.startsWith(prefix));
      
      if (typeKeys.length > 0) {
        // Get sizes before deletion
        for (const key of typeKeys) {
          try {
            const item = await AsyncStorage.getItem(key);
            if (item) {
              const entry: CacheEntry = JSON.parse(item);
              this.stats.totalSize = Math.max(0, this.stats.totalSize - (entry.size || 0));
            }
          } catch {}
        }
        
        await AsyncStorage.multiRemove(typeKeys);
        
        // Clean up LRU tracking
        for (const key of typeKeys) {
          this.lruOrder.delete(key);
        }
        
        invalidatedCount = typeKeys.length;
        this.stats.itemCount = Math.max(0, this.stats.itemCount - invalidatedCount);
        
        console.log(`🗑️ Invalidated ${invalidatedCount} cache entries for ${type}`);
      }
      
      await this.saveStats();
      
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
    
    return invalidatedCount;
  }
  
  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(k => k.startsWith('ai:'));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      
      this.lruOrder.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0,
        totalSize: 0,
        itemCount: 0
      };
      
      await this.saveStats();
      
      console.log(`🧹 Cleared all AI cache (${cacheKeys.length} entries)`);
      
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }
  
  /**
   * Generate cache key
   */
  generateKey(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(params).sort();
    const values = sortedKeys.map(k => `${k}:${params[k]}`).join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < values.length; i++) {
      const char = values.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Estimate data size in bytes
   */
  private estimateSize(data: any): number {
    try {
      const json = JSON.stringify(data);
      return json.length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 0;
    }
  }
  
  /**
   * Update LRU order
   */
  private updateLRU(key: string): void {
    this.lruOrder.set(key, Date.now());
    
    // Keep only recent 100 entries in memory
    if (this.lruOrder.size > 100) {
      const sorted = Array.from(this.lruOrder.entries())
        .sort((a, b) => a[1] - b[1]);
      
      // Remove oldest 20
      for (let i = 0; i < 20; i++) {
        this.lruOrder.delete(sorted[i][0]);
      }
    }
  }
  
  /**
   * Enforce maximum cache size for a type
   */
  private async enforceMaxSize(type: string, maxSize: number): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const typeKeys = allKeys.filter(k => k.startsWith(config.keyPrefix));
      
      if (typeKeys.length >= maxSize) {
        // Remove oldest entries based on strategy
        if (config.strategy === 'lru') {
          await this.evictLRU(typeKeys, Math.floor(maxSize * 0.2)); // Remove 20%
        } else {
          await this.evictOldest(typeKeys, Math.floor(maxSize * 0.2));
        }
      }
    } catch (error) {
      console.error('Enforce max size error:', error);
    }
  }
  
  /**
   * Evict old entries
   */
  private async evictOldEntries(type: string, count: number): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const typeKeys = allKeys.filter(k => k.startsWith(config.keyPrefix));
      
      if (config.strategy === 'lru') {
        await this.evictLRU(typeKeys, count);
      } else {
        await this.evictOldest(typeKeys, count);
      }
      
    } catch (error) {
      console.error('Evict old entries error:', error);
    }
  }
  
  /**
   * Evict using LRU strategy
   */
  private async evictLRU(keys: string[], count: number): Promise<void> {
    const entries: Array<[string, number]> = [];
    
    for (const key of keys) {
      const lastAccessed = this.lruOrder.get(key) || 0;
      entries.push([key, lastAccessed]);
    }
    
    // Sort by last accessed (oldest first)
    entries.sort((a, b) => a[1] - b[1]);
    
    // Remove oldest
    const toRemove = entries.slice(0, count).map(e => e[0]);
    
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
      
      for (const key of toRemove) {
        this.lruOrder.delete(key);
        this.recordEviction();
      }
    }
  }
  
  /**
   * Evict oldest entries by timestamp
   */
  private async evictOldest(keys: string[], count: number): Promise<void> {
    const entries: Array<[string, number]> = [];
    
    for (const key of keys) {
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          const entry: CacheEntry = JSON.parse(item);
          entries.push([key, entry.timestamp]);
        }
      } catch {}
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1] - b[1]);
    
    // Remove oldest
    const toRemove = entries.slice(0, count).map(e => e[0]);
    
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
      this.stats.evictions += toRemove.length;
    }
  }
  
  /**
   * Record cache hit
   */
  private recordHit(): void {
    this.stats.hits++;
  }
  
  /**
   * Record cache miss
   */
  private recordMiss(): void {
    this.stats.misses++;
  }
  
  /**
   * Record eviction
   */
  private recordEviction(): void {
    this.stats.evictions++;
    this.stats.itemCount = Math.max(0, this.stats.itemCount - 1);
  }
  
  /**
   * Save statistics to storage
   */
  private async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem('ai:cache:stats', JSON.stringify(this.stats));
    } catch {}
  }
  
  /**
   * Generate unified cache key (migrated from UnifiedAIPipeline)
   */
  generateUnifiedCacheKey(input: any): string {
    const data = {
      userId: input.userId,
      type: input.type,
      content: typeof input.content === 'string' 
        ? input.content.substring(0, 100) 
        : JSON.stringify(input.content || {}).substring(0, 100),
      source: input.context?.source || 'unknown'
    };
    
    // Create deterministic hash
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `unified:${input.userId}:${Math.abs(hash).toString(16)}`;
  }
  
  /**
   * Unified get with multi-layer cache (Memory -> Supabase -> AsyncStorage)
   * Includes negative cache bypass logic migrated from UnifiedAIPipeline
   */
  async getUnified<T>(key: string, type: string = 'unified'): Promise<T | null> {
    try {
      // Layer 1: Memory cache (fastest) - with negative bypass
      const memoryResult = await this.getFromMemoryCacheWithBypass<T>(key, type);
      if (memoryResult !== undefined) {
        if (memoryResult === null) {
          // Negative cache bypass, continue to next layer
        } else {
          await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_HIT, {
            layer: 'memory',
            key,
            type
          });
          return memoryResult;
        }
      }
      
      // Layer 2: Supabase cache (persistent, cross-device) - with negative bypass
      const supabaseResult = await this.getFromSupabaseCacheWithBypass<T>(key);
      if (supabaseResult !== undefined) {
        if (supabaseResult === null) {
          // Negative cache bypass, continue to next layer
        } else {
          // Restore to memory cache
          await this.set(type, key, supabaseResult);
          
          await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_HIT, {
            layer: 'supabase',
            key,
            type
          });
          return supabaseResult;
        }
      }
      
      // Layer 3: AsyncStorage (offline backup) - with negative bypass
      const storageResult = await this.getFromAsyncStorageWithBypass<T>(key);
      if (storageResult !== undefined) {
        if (storageResult === null) {
          // Negative cache bypass, continue to fresh generation
        } else {
          await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_HIT, {
            layer: 'asyncstorage',
            key,
            type
          });
          return storageResult;
        }
      }
      
      // Cache miss
      await trackAIInteraction(AIEventType.UNIFIED_PIPELINE_CACHE_MISS, {
        key,
        type,
        reason: 'not_found'
      });
      
      return null;
      
    } catch (error) {
      console.error('Unified cache get error:', error);
      return null;
    }
  }
  
  /**
   * Memory cache with negative bypass logic
   * Returns undefined if no cache, null if bypassed, T if valid
   */
  private async getFromMemoryCacheWithBypass<T>(key: string, type: string): Promise<T | null | undefined> {
    const cached = await this.get<any>(type, key);
    if (!cached) {
      return undefined; // No cache
    }
    
    // Check if should bypass negative cache
    const remainingTTL = this.getRemainingTTL(cached);
    if (this.shouldBypassNegativeCache(cached, remainingTTL)) {
      console.log(`🚫 Bypassing negative memory cache: insightsCount=${this.countTotalInsights(cached)}, remainingTTL=${Math.round(remainingTTL/60000)}min`);
      await this.delete(type, key);
      return null; // Bypassed
    }
    
    return cached as T;
  }
  
  /**
   * Supabase cache with negative bypass logic
   */
  private async getFromSupabaseCacheWithBypass<T>(key: string): Promise<T | null | undefined> {
    try {
      const supabaseResult = await this.getFromSupabaseCache<T>(key);
      if (!supabaseResult) {
        return undefined; // No cache
      }
      
      const insightsCount = this.countTotalInsights(supabaseResult);
      if (insightsCount === 0) {
        console.log(`🚫 Bypassing negative Supabase cache: insightsCount=${insightsCount}`);
        return null; // Bypassed
      }
      
      console.log('📦 Cache restored from Supabase:', key.substring(0, 30) + '...');
      return supabaseResult;
      
    } catch (error) {
      console.warn('⚠️ Supabase cache read failed:', error);
      return undefined;
    }
  }
  
  /**
   * AsyncStorage cache with negative bypass logic
   */
  private async getFromAsyncStorageWithBypass<T>(key: string): Promise<T | null | undefined> {
    try {
      const storageResult = await this.getFromAsyncStorage<T>(key);
      if (!storageResult) {
        return undefined; // No cache
      }
      
      const insightsCount = this.countTotalInsights(storageResult);
      if (insightsCount === 0) {
        console.log(`🚫 Bypassing negative AsyncStorage cache: insightsCount=${insightsCount}`);
        await AsyncStorage.removeItem(key); // Clean up negative cache
        return null; // Bypassed
      }
      
      console.log('📱 Cache restored from AsyncStorage:', key.substring(0, 30) + '...');
      return storageResult;
      
    } catch (error) {
      console.warn('⚠️ AsyncStorage cache read failed:', error);
      return undefined;
    }
  }
  
  /**
   * Get remaining TTL for cache entry
   */
  private getRemainingTTL(cachedEntry: any): number {
    // This depends on how the cache entry is structured
    // For now, return a reasonable default
    return 30 * 60 * 1000; // 30 minutes
  }
  
  /**
   * Unified set with multi-layer persistence
   */
  async setUnified<T>(key: string, data: T, type: string = 'unified', customTTL?: number): Promise<void> {
    try {
      // Set in memory cache
      await this.set(type, key, data, customTTL);
      
      // Persist to Supabase
      await this.setToSupabaseCache(key, data);
      
      // Persist to AsyncStorage for offline
      await this.persistToAsyncStorage(key, data, customTTL);
      
      const ttlMs = customTTL || this.getConfig(type).ttl * 1000;
      const ttlDisplay = this.formatTTL(ttlMs);
      console.log(`📦 Unified cache set with ${ttlDisplay} TTL: ${key.substring(0, 30)}...`);
      
    } catch (error) {
      console.error('Unified cache set error:', error);
    }
  }
  
  /**
   * Set with insights-aware caching policy (migrated from UnifiedAIPipeline)
   */
  async setWithInsightsPolicy<T>(key: string, data: T, input: any, type: string = 'unified'): Promise<void> {
    const insightsCount = this.countTotalInsights(data);
    const moduleTTL = this.getModuleTTL(input);
    
    // If no insights, use short TTL to prevent negative caching
    if (insightsCount === 0) {
      const shortTTL = 5 * 60 * 1000; // 5 minutes
      console.log(`📦 Empty insights detected (${insightsCount}), using short TTL: ${this.formatTTL(shortTTL)}`);
      
      await this.setUnified(key, data, type, shortTTL);
      
      // Track empty insights caching
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: input.userId,
        insightsCount: 0,
        cacheTTL: shortTTL,
        cacheStrategy: 'short_negative_cache'
      });
      
      return;
    }
    
    // Normal caching with module-specific TTL
    console.log(`📦 Insights found (${insightsCount}), using full TTL: ${this.formatTTL(moduleTTL)}`);
    await this.setUnified(key, data, type, moduleTTL);
  }
  
  /**
   * Get config for cache type
   */
  private getConfig(type: string): CacheConfig {
    return this.configs.get(type) || {
      ttl: 6 * 60 * 60, // 6h default
      keyPrefix: 'ai:unknown:',
      strategy: 'ttl-only'
    };
  }
  
  /**
   * Format TTL for logging
   */
  private formatTTL(ttlMs: number): string {
    if (ttlMs < 60 * 1000) {
      return `${ttlMs}ms`;
    } else if (ttlMs < 60 * 60 * 1000) {
      return `${Math.round(ttlMs / (60 * 1000))}min`;
    } else {
      return `${Math.round(ttlMs / (60 * 60 * 1000))}h`;
    }
  }
  
  /**
   * Memory cache operations
   */
  private async getFromMemoryCache<T>(key: string, type: string): Promise<T | null> {
    return await this.get<T>(type, key);
  }
  
  /**
   * Supabase cache layer (migrated from UnifiedAIPipeline)
   */
  private async getFromSupabaseCache<T>(key: string): Promise<T | null> {
    try {
      const { data, error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .select('content, expires_at')
        .eq('cache_key', key)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // Check expiry
      if (new Date(data.expires_at).getTime() < Date.now()) {
        return null;
      }
      
      return data.content as T;
      
    } catch (error) {
      console.error('Supabase cache get error:', error);
      return null;
    }
  }
  
  /**
   * Set to Supabase cache
   */
  private async setToSupabaseCache<T>(key: string, data: T): Promise<void> {
    try {
      // Extract userId from key for RLS
      const userId = key.split(':')[1];
      if (!userId) return;
      
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h default
      
      const { error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .upsert({
          cache_key: key,
          user_id: userId,
          content: data,
          expires_at: expiresAt.toISOString()
        });
      
      if (!error) {
        console.log('📦 Supabase cache updated:', key.substring(0, 30) + '...');
      }
    } catch (error) {
      console.warn('Supabase cache write failed:', error);
    }
  }
  
  /**
   * AsyncStorage operations
   */
  private async getFromAsyncStorage<T>(key: string): Promise<T | null> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      if (parsed.expires > Date.now()) {
        return parsed.data as T;
      }
      
      // Expired, clean up
      await AsyncStorage.removeItem(key);
      return null;
      
    } catch (error) {
      console.error('AsyncStorage get error:', error);
      return null;
    }
  }
  
  /**
   * Persist to AsyncStorage
   */
  private async persistToAsyncStorage<T>(key: string, data: T, customTTL?: number): Promise<void> {
    try {
      const ttl = customTTL || 24 * 60 * 60 * 1000; // 24h default
      const entry = {
        data,
        expires: Date.now() + ttl
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(entry));
      
    } catch (error) {
      console.error('AsyncStorage persist error:', error);
    }
  }
  
  /**
   * Advanced invalidation with user context
   */
  async invalidateUserCache(userId: string, type?: 'patterns' | 'insights' | 'progress' | 'voice' | 'all'): Promise<number> {
    let invalidatedCount = 0;
    
    try {
      // Invalidate memory cache
      const allKeys = await AsyncStorage.getAllKeys();
      const userKeys = allKeys.filter(k => k.includes(`unified:${userId}:`));
      
      for (const key of userKeys) {
        if (!type || type === 'all' || key.includes(type)) {
          await AsyncStorage.removeItem(key);
          
          // Also invalidate from memory
          const cacheType = this.extractTypeFromKey(key);
          if (cacheType) {
            await this.delete(cacheType, key);
          }
          
          invalidatedCount++;
        }
      }
      
      // Invalidate Supabase cache
      await this.invalidateSupabaseCache(userId, type);
      
      await trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
        userId,
        invalidationType: type || 'all',
        keysDeleted: invalidatedCount,
        timestamp: Date.now()
      });
      
      console.log(`🗑️ User cache invalidated: ${type || 'all'} (${invalidatedCount} keys)`);
      
    } catch (error) {
      console.error('User cache invalidation error:', error);
    }
    
    return invalidatedCount;
  }
  
  /**
   * Invalidate Supabase cache for user
   */
  private async invalidateSupabaseCache(userId: string, type?: string): Promise<void> {
    try {
      const likePattern = `unified:${userId}:%`;
      
      const { error } = await supabaseService.supabaseClient
        .from('ai_cache')
        .delete()
        .eq('user_id', userId)
        .like('cache_key', likePattern);
      
      if (!error) {
        console.log(`🗑️ Supabase cache invalidated for user: ${userId}`);
      }
      
    } catch (error) {
      console.error('Supabase cache invalidation error:', error);
    }
  }
  
  /**
   * Count insights helper (migrated from UnifiedAIPipeline)
   */
  countTotalInsights(result: any): number {
    try {
      if (!result) return 0;
      
      let count = 0;
      
      // Count analytics insights
      if (result.analytics && result.analytics.insights) {
        count += Array.isArray(result.analytics.insights) ? result.analytics.insights.length : 0;
      }
      
      // Count pattern insights
      if (result.patterns && result.patterns.insights) {
        count += Array.isArray(result.patterns.insights) ? result.patterns.insights.length : 0;
      }
      
      // Count CBT insights
      if (result.cbt && result.cbt.insights) {
        count += Array.isArray(result.cbt.insights) ? result.cbt.insights.length : 0;
      }
      
      return count;
      
    } catch (error) {
      console.error('Count insights error:', error);
      return 0;
    }
  }
  
  /**
   * Get module-specific TTL (migrated from UnifiedAIPipeline)
   */
  getModuleTTL(input: any): number {
    const MODULE_TTLS = {
      insights: 24 * 60 * 60 * 1000, // 24h
      patterns: 12 * 60 * 60 * 1000, // 12h
      voice: 1 * 60 * 60 * 1000, // 1h
      cbt: 24 * 60 * 60 * 1000, // 24h
      default: 6 * 60 * 60 * 1000 // 6h
    };
    
    if (input.context?.source === 'mood' && input.context.metadata?.analysisType === 'comprehensive_analytics') {
      return MODULE_TTLS.insights;
    }
    
    if (input.type === 'voice') {
      return MODULE_TTLS.voice;
    }
    
    if (input.context?.source === 'cbt') {
      return MODULE_TTLS.cbt;
    }
    
    return MODULE_TTLS.default;
  }
  
  /**
   * Negative cache bypass logic (migrated from UnifiedAIPipeline)
   */
  shouldBypassNegativeCache(result: any, remainingTTL: number): boolean {
    const insightsCount = this.countTotalInsights(result);
    const fiveMinutes = 5 * 60 * 1000;
    
    return insightsCount === 0 && remainingTTL < fiveMinutes;
  }
  
  /**
   * Extract cache type from key
   */
  private extractTypeFromKey(key: string): string | null {
    // Extract type from unified cache key format: unified:userId:hash
    const parts = key.split(':');
    if (parts.length >= 3) {
      return 'unified';
    }
    return null;
  }
  
  /**
   * Invalidate stale cache entries (migrated from UnifiedAIPipeline)
   */
  async invalidateStaleCache(): Promise<{ invalidated: number; reason: string }> {
    let invalidatedCount = 0;
    const reason = 'manual_refresh_cleanup';
    
    try {
      // 1. Clean memory cache - remove 0-insight entries
      const memoryKeys = await AsyncStorage.getAllKeys();
      const unifiedKeys = memoryKeys.filter(key => key.startsWith('unified:'));
      
      for (const key of unifiedKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.result && this.countTotalInsights(parsed.result) === 0) {
              await AsyncStorage.removeItem(key);
              invalidatedCount++;
              console.log(`🧹 Removed stale cache: ${key.substring(0, 30)}...`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to clean cache key ${key}:`, error);
        }
      }
      
      // 2. Track cleanup completion
      await trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
        reason,
        invalidatedCount,
        timestamp: Date.now()
      });
      
      console.log(`✅ Cache cleanup completed: ${invalidatedCount} stale entries removed`);
      
      return { invalidated: invalidatedCount, reason };
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
      return { invalidated: invalidatedCount, reason: 'cleanup_failed' };
    }
  }
  
  /**
   * Clear all cache
   */
  async clear(): Promise<number> {
    let clearedCount = 0;
    
    // Clear memory cache
    for (const [type, cache] of this.caches.entries()) {
      clearedCount += cache.size;
      cache.clear();
    }
    
    // Clear AsyncStorage cache
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => 
        key.startsWith('ai:') || key.startsWith('unified:')
      );
      
      await AsyncStorage.multiRemove(cacheKeys);
      clearedCount += cacheKeys.length;
      
    } catch (error) {
      console.warn('AsyncStorage cache clear failed:', error);
    }
    
    console.log(`🗑️ Cleared ${clearedCount} cache entries`);
    return clearedCount;
  }
  
  /**
   * Periodic cache cleanup
   */
  async cleanup(): Promise<void> {
    let cleanedCount = 0;
    
    // Clean expired entries from memory cache
    for (const [type, cache] of this.caches.entries()) {
      const config = this.getConfig(type);
      const now = Date.now();
      
      for (const [key, entry] of cache.entries()) {
        if (now > entry.timestamp + (config.ttl * 1000)) {
          cache.delete(key);
          cleanedCount++;
        }
      }
    }
    
    // Clean expired AsyncStorage entries
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const unifiedKeys = allKeys.filter(key => key.startsWith('unified:'));
      
      for (const key of unifiedKeys) {
        try {
          const stored = await AsyncStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.expires && parsed.expires < Date.now()) {
              await AsyncStorage.removeItem(key);
              cleanedCount++;
            }
          }
        } catch (error) {
          // Remove corrupted entries
          await AsyncStorage.removeItem(key);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.warn('AsyncStorage cleanup failed:', error);
    }
    
    console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
  }
  
  /**
   * Warmup cache with precomputed values
   */
  async warmup(type: string, entries: Array<{ key: string; data: any }>): Promise<void> {
    console.log(`🔥 Warming up ${type} cache with ${entries.length} entries`);
    
    for (const entry of entries) {
      await this.set(type, entry.key, entry.data);
    }
  }
}

// Singleton instance
let instance: PipelineCacheManager | null = null;

export function getCacheManager(): PipelineCacheManager {
  if (!instance) {
    instance = new PipelineCacheManager();
  }
  return instance;
}
