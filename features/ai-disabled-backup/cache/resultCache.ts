/**
 * 💾 Result Cache - Multi-layer caching with TTL management
 * 
 * This module implements a multi-layer cache for AI analysis results with
 * configurable TTL per cache type and automatic invalidation.
 * 
 * Cache layers:
 * - Insights: 24 hours

 * - Voice Analysis: 1 hour
 * - Today Digest: 12 hours
 * 
 * @module ResultCache
 * @since v1.0.0
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

const CONFIG = {
  ttl: {
    insightsHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_INSIGHTS_HOURS || '24'
    ),
    // erpPlanHours: parseInt( // Removed Terapi cache
    //   Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_Terapi_PLAN_HOURS || '12'
    // ),
    voiceHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_VOICE_HOURS || '1'
    ),
    todayDigestHours: parseInt(
      Constants.expoConfig?.extra?.EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS || '12'
    ),
  },
};

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Cache entry types
 */
export type CacheType = 'insights' | 'voice' | 'digest' | 'general'; // ✅ REMOVED: 'erp' - ERP module deleted

/**
 * Cached entry structure
 */
interface CacheEntry<T = any> {
  key: string;
  type: CacheType;
  data: T;
  timestamp: number;
  expiresAt: number;
  metadata?: {
    userId?: string;
    dayKey?: string;
    source?: string;
  };
}

/**
 * Cache statistics
 */
interface CacheStats {
  totalEntries: number;
  entriesByType: Record<CacheType, number>;
  hitRate: number;
  missRate: number;
  avgAge: number; // Average age in milliseconds
  oldestEntry?: number;
  newestEntry?: number;
}

// =============================================================================
// 💾 RESULT CACHE IMPLEMENTATION
// =============================================================================

/**
 * Result cache class
 */
export class ResultCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private isInitialized = false;
  private persistenceEnabled = true;
  private storagePrefix = 'ai_cache:';

  constructor() {
    // Constructor
  }

  /**
   * Initialize the cache
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load persisted cache entries
      await this.loadPersistedCache();
      
      // Clean expired entries
      await this.cleanExpiredEntries();
      
      this.isInitialized = true;
      console.log('✅ ResultCache initialized with', this.memoryCache.size, 'entries');
    } catch (error) {
      console.error('❌ ResultCache initialization failed:', error);
      // Continue with empty cache on error
      this.memoryCache.clear();
      this.isInitialized = true;
    }
  }

  /**
   * Get cached value
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Check memory cache first
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      // Try loading from storage
      const persisted = await this.loadFromStorage(key);
      if (persisted) {
        this.memoryCache.set(key, persisted);
        return this.checkAndReturnEntry(persisted);
      }
      
      this.misses++;
      return null;
    }
    
    return this.checkAndReturnEntry(entry);
  }

  /**
   * Set cached value with TTL
   */
  async set<T = any>(
    key: string,
    data: T,
    ttlMs?: number,
    type: CacheType = 'general'
  ): Promise<void> {
    // Determine TTL based on type if not provided
    if (!ttlMs) {
      ttlMs = this.getTTLForType(type);
    }
    
    const entry: CacheEntry<T> = {
      key,
      type,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
      metadata: this.extractMetadata(key),
    };
    
    // Store in memory
    this.memoryCache.set(key, entry);
    
    // Persist to storage
    if (this.persistenceEnabled) {
      await this.saveToStorage(key, entry);
    }
    
    // Clean cache if too large
    if (this.memoryCache.size > 1000) {
      await this.evictOldest();
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    if (this.persistenceEnabled) {
      await AsyncStorage.removeItem(this.storagePrefix + key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;
    
    if (this.persistenceEnabled) {
      // Get all cache keys
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.storagePrefix));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    }
    
    console.log('🗑️ ResultCache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesByType: Record<CacheType, number> = {
      insights: 0,
      voice: 0,
      digest: 0,
      general: 0,
    };
    
    let totalAge = 0;
    let oldest: number | undefined;
    let newest: number | undefined;
    const now = Date.now();
    
    for (const entry of this.memoryCache.values()) {
      entriesByType[entry.type]++;
      
      const age = now - entry.timestamp;
      totalAge += age;
      
      if (!oldest || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
      if (!newest || entry.timestamp > newest) {
        newest = entry.timestamp;
      }
    }
    
    const total = this.hits + this.misses;
    
    return {
      totalEntries: this.memoryCache.size,
      entriesByType,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
      avgAge: this.memoryCache.size > 0 ? totalAge / this.memoryCache.size : 0,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string | RegExp): Promise<number> {
    const keys: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        keys.push(key);
      }
    }
    
    for (const key of keys) {
      await this.delete(key);
    }
    
    console.log(`🗑️ Invalidated ${keys.length} cache entries matching pattern`);
    return keys.length;
  }

  /**
   * Invalidate cache by user
   */
  async invalidateByUser(userId: string): Promise<number> {
    return this.invalidateByPattern(`ai:${userId}:`);
  }

  /**
   * Invalidate cache by day
   */
  async invalidateByDay(userId: string, dayKey: string): Promise<number> {
    return this.invalidateByPattern(`ai:${userId}:${dayKey}:`);
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Check entry validity and return data
   */
  private checkAndReturnEntry<T>(entry: CacheEntry<T>): T | null {
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(entry.key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return entry.data;
  }

  /**
   * Get TTL for cache type
   */
  private getTTLForType(type: CacheType): number {
    const hours = {
      insights: CONFIG.ttl.insightsHours,
      voice: CONFIG.ttl.voiceHours,
      digest: CONFIG.ttl.todayDigestHours,
      general: 1, // Default 1 hour
    };
    
    return (hours[type] || 1) * 60 * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Extract metadata from key
   */
  private extractMetadata(key: string): CacheEntry['metadata'] {
    // Key format: ai:{userId}:{dayKey}:{type}
    const parts = key.split(':');
    
    if (parts.length >= 3) {
      return {
        userId: parts[1],
        dayKey: parts[2],
      };
    }
    
    return {};
  }

  /**
   * Load cache from persistent storage
   */
  private async loadPersistedCache(): Promise<void> {
    if (!this.persistenceEnabled) {
      return;
    }
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.storagePrefix));
      
      if (cacheKeys.length === 0) {
        return;
      }
      
      const entries = await AsyncStorage.multiGet(cacheKeys);
      
      for (const [key, value] of entries) {
        if (value) {
          try {
            const entry = JSON.parse(value) as CacheEntry;
            const cleanKey = key.replace(this.storagePrefix, '');
            this.memoryCache.set(cleanKey, entry);
          } catch (error) {
            // Skip invalid entries
            console.warn('Invalid cache entry:', key);
          }
        }
      }
    } catch (error) {
      console.error('Error loading persisted cache:', error);
    }
  }

  /**
   * Save entry to storage
   */
  private async saveToStorage(key: string, entry: CacheEntry): Promise<void> {
    if (!this.persistenceEnabled) {
      return;
    }
    
    try {
      await AsyncStorage.setItem(
        this.storagePrefix + key,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.error('Error saving cache entry:', error);
      // Disable persistence on repeated errors
      if (error instanceof Error && error.message.includes('quota')) {
        this.persistenceEnabled = false;
        console.warn('⚠️ Storage quota exceeded, disabling cache persistence');
      }
    }
  }

  /**
   * Load entry from storage
   */
  private async loadFromStorage(key: string): Promise<CacheEntry | null> {
    if (!this.persistenceEnabled) {
      return null;
    }
    
    try {
      const value = await AsyncStorage.getItem(this.storagePrefix + key);
      if (value) {
        return JSON.parse(value) as CacheEntry;
      }
    } catch (error) {
      console.error('Error loading cache entry:', error);
    }
    
    return null;
  }

  /**
   * Clean expired entries
   */
  private async cleanExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.expiresAt) {
        expired.push(key);
      }
    }
    
    // Remove expired entries
    for (const key of expired) {
      await this.delete(key);
    }
    
    if (expired.length > 0) {
      console.log(`🗑️ Cleaned ${expired.length} expired cache entries`);
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private async evictOldest(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10%
    const toRemove = Math.floor(entries.length * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      await this.delete(entries[i][0]);
    }
    
    console.log(`🗑️ Evicted ${toRemove} oldest cache entries`);
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

export default ResultCache;
