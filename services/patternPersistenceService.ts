import AsyncStorage from '@react-native-async-storage/async-storage';
import { isUUID } from '@/utils/validators';

/**
 * 🧠 PATTERN PERSISTENCE SERVICE
 * 
 * Mood pattern analizi sonuçlarını kalıcı olarak AsyncStorage'da saklar
 * - TTL tabanlı cache sistemi
 * - Data hash invalidation  
 * - User-specific storage
 * - Analytics ve heuristic pattern'ları destekler
 */

export interface PersistedPattern {
  type: string;
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestion: string;
  source: 'heuristic' | 'ai' | 'unified_pipeline' | 'clinical_analytics';
  data?: any;
  // Persistence metadata
  persistedAt: string;
  userId: string;
  dataHash: string; // To detect data changes
  version: number;
}

export interface PatternCacheEntry {
  patterns: PersistedPattern[];
  createdAt: number;
  expiresAt: number;
  userId: string;
  dataHash: string;
  version: number;
  meta: {
    entriesCount: number;
    source: 'full_analysis' | 'heuristic_fallback';
    analysisEngine: string;
  };
}

class PatternPersistenceService {
  private static instance: PatternPersistenceService;
  private readonly CACHE_VERSION = 1;
  private readonly DEFAULT_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms
  private readonly STORAGE_PREFIX = 'mood_patterns_cache_';
  private readonly HASH_SALT = 'pattern_cache_v1';
  
  private constructor() {}
  
  static getInstance(): PatternPersistenceService {
    if (!PatternPersistenceService.instance) {
      PatternPersistenceService.instance = new PatternPersistenceService();
    }
    return PatternPersistenceService.instance;
  }

  /**
   * 🔑 Generate cache key for user
   */
  private getCacheKey(userId: string): string {
    return `${this.STORAGE_PREFIX}${userId}`;
  }

  /**
   * 🧮 Generate data hash from mood entries for invalidation
   */
  private generateDataHash(moodEntries: any[]): string {
    if (!moodEntries || moodEntries.length === 0) return 'empty';
    
    // Create hash based on entry count, recent scores, and last update
    const recentEntries = moodEntries.slice(0, 5); // Last 5 entries for hash
    const hashData = {
      count: moodEntries.length,
      recentScores: recentEntries.map(e => ({
        mood: e.mood_score,
        energy: e.energy_level,
        anxiety: e.anxiety_level,
        date: new Date(e.created_at).toDateString()
      })),
      lastUpdate: moodEntries[0]?.created_at || new Date().toISOString(),
      salt: this.HASH_SALT
    };
    
    return btoa(JSON.stringify(hashData)).slice(0, 16); // Short hash
  }

  /**
   * 💾 Save pattern analysis results to cache
   */
  async savePatterns(
    userId: string, 
    patterns: any[], 
    moodEntries: any[],
    analysisSource: 'full_analysis' | 'heuristic_fallback' = 'full_analysis',
    customTTL?: number
  ): Promise<void> {
    if (!isUUID(userId) || !Array.isArray(patterns)) {
      console.warn('⚠️ PatternPersistenceService: Invalid userId or patterns format');
      return;
    }

    try {
      const now = Date.now();
      const ttl = customTTL || this.DEFAULT_TTL;
      const dataHash = this.generateDataHash(moodEntries);
      
      // Convert patterns to persisted format
      const persistedPatterns: PersistedPattern[] = patterns.map(pattern => ({
        type: pattern.type || 'unknown',
        title: pattern.title || 'Pattern',
        description: pattern.description || '',
        confidence: pattern.confidence || 0.5,
        severity: pattern.severity || 'medium',
        actionable: pattern.actionable || false,
        suggestion: pattern.suggestion || '',
        source: pattern.source || 'unified_pipeline',
        data: pattern.data || {},
        // Add persistence metadata
        persistedAt: new Date().toISOString(),
        userId,
        dataHash,
        version: this.CACHE_VERSION
      }));

      const cacheEntry: PatternCacheEntry = {
        patterns: persistedPatterns,
        createdAt: now,
        expiresAt: now + ttl,
        userId,
        dataHash,
        version: this.CACHE_VERSION,
        meta: {
          entriesCount: moodEntries.length,
          source: analysisSource,
          analysisEngine: 'unified_pipeline_v2'
        }
      };

      const cacheKey = this.getCacheKey(userId);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      
      console.log(`✅ Patterns saved to cache: ${patterns.length} patterns, TTL: ${Math.round(ttl/1000/60)}min`);
      
      // ✨ OPTIMIZATION: Clean up expired cache entries for other users
      this.cleanupExpiredCaches().catch(err => 
        console.warn('⚠️ Cache cleanup failed:', err)
      );
      
    } catch (error) {
      console.error('❌ Failed to save patterns to cache:', error);
    }
  }

  /**
   * 📖 Load pattern analysis results from cache
   */
  async loadPatterns(userId: string, currentMoodEntries: any[]): Promise<PersistedPattern[] | null> {
    if (!isUUID(userId)) {
      console.warn('⚠️ PatternPersistenceService: Invalid userId for load');
      return null;
    }

    try {
      const cacheKey = this.getCacheKey(userId);
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        console.log('📭 No pattern cache found for user');
        return null;
      }

      const cacheEntry: PatternCacheEntry = JSON.parse(cached);
      
      // ⏰ Check expiration
      if (Date.now() > cacheEntry.expiresAt) {
        console.log('⏰ Pattern cache expired, removing...');
        await this.invalidateCache(userId);
        return null;
      }

      // 🔄 Check version compatibility
      if (cacheEntry.version !== this.CACHE_VERSION) {
        console.log('🔄 Pattern cache version mismatch, invalidating...');
        await this.invalidateCache(userId);
        return null;
      }

      // 🧮 Check data hash (has mood data changed?)
      const currentDataHash = this.generateDataHash(currentMoodEntries);
      if (cacheEntry.dataHash !== currentDataHash) {
        console.log('🧮 Data hash mismatch, mood entries changed - invalidating cache');
        console.log(`Cached hash: ${cacheEntry.dataHash}, Current hash: ${currentDataHash}`);
        await this.invalidateCache(userId);
        return null;
      }

      // ✅ Cache is valid
      const ageMinutes = Math.round((Date.now() - cacheEntry.createdAt) / 1000 / 60);
      console.log(`✅ Loaded ${cacheEntry.patterns.length} patterns from cache (age: ${ageMinutes}min)`);
      
      return cacheEntry.patterns;
      
    } catch (error) {
      console.error('❌ Failed to load patterns from cache:', error);
      return null;
    }
  }

  /**
   * 🗑️ Invalidate pattern cache for user
   */
  async invalidateCache(userId: string): Promise<void> {
    if (!isUUID(userId)) return;
    
    try {
      const cacheKey = this.getCacheKey(userId);
      await AsyncStorage.removeItem(cacheKey);
      console.log('🗑️ Pattern cache invalidated for user');
    } catch (error) {
      console.error('❌ Failed to invalidate pattern cache:', error);
    }
  }

  /**
   * 🧹 Clean up expired cache entries across all users
   */
  async cleanupExpiredCaches(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const patternCacheKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      let cleanedCount = 0;
      
      for (const key of patternCacheKeys) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (!cached) continue;
          
          const cacheEntry: PatternCacheEntry = JSON.parse(cached);
          
          // Remove expired or incompatible versions
          if (Date.now() > cacheEntry.expiresAt || cacheEntry.version !== this.CACHE_VERSION) {
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        } catch (err) {
          // Invalid cache entry, remove it
          await AsyncStorage.removeItem(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired pattern cache entries`);
      }
      
    } catch (error) {
      console.warn('⚠️ Pattern cache cleanup failed:', error);
    }
  }

  /**
   * 📊 Get cache statistics
   */
  async getCacheStats(userId?: string): Promise<{
    totalCaches: number;
    userCacheExists: boolean;
    userCacheAge?: number;
    userCacheSize?: number;
    totalCacheSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const patternCacheKeys = allKeys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      let totalSize = 0;
      let userCacheExists = false;
      let userCacheAge: number | undefined;
      let userCacheSize: number | undefined;
      
      for (const key of patternCacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          
          // Check if this is the user's cache
          if (userId && key === this.getCacheKey(userId)) {
            userCacheExists = true;
            userCacheSize = cached.length;
            
            try {
              const cacheEntry: PatternCacheEntry = JSON.parse(cached);
              userCacheAge = Date.now() - cacheEntry.createdAt;
            } catch {}
          }
        }
      }
      
      return {
        totalCaches: patternCacheKeys.length,
        userCacheExists,
        userCacheAge,
        userCacheSize,
        totalCacheSize: totalSize
      };
      
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error);
      return {
        totalCaches: 0,
        userCacheExists: false,
        totalCacheSize: 0
      };
    }
  }

  /**
   * 🔄 Update specific pattern in cache (without full reload)
   */
  async updatePatternInCache(userId: string, patternIndex: number, updates: Partial<PersistedPattern>): Promise<void> {
    try {
      const currentPatterns = await this.loadPatterns(userId, []);
      if (!currentPatterns || patternIndex >= currentPatterns.length) return;
      
      currentPatterns[patternIndex] = { ...currentPatterns[patternIndex], ...updates };
      
      // Note: This method doesn't verify data hash since we're doing partial updates
      const cacheKey = this.getCacheKey(userId);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cacheEntry: PatternCacheEntry = JSON.parse(cached);
        cacheEntry.patterns = currentPatterns;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
        console.log(`🔄 Updated pattern ${patternIndex} in cache`);
      }
      
    } catch (error) {
      console.error('❌ Failed to update pattern in cache:', error);
    }
  }
}

export default PatternPersistenceService.getInstance();
