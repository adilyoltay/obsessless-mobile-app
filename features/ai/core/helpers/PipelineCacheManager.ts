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
