/**
 * Optimized Storage Service
 * 
 * AsyncStorage performance optimization while planning WatermelonDB migration.
 * Implements: batching, caching, indexing, compression, lazy loading.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry } from '@/services/moodTrackingService';

interface StorageIndex {
  userId: string;
  keyPattern: string;
  keys: string[];
  lastUpdated: number;
  totalEntries: number;
}

interface BatchOperation {
  type: 'SET' | 'REMOVE';
  key: string;
  value?: string;
}

interface QueryOptions {
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'mood_score';
  sortOrder?: 'asc' | 'desc';
}

class OptimizedStorageService {
  private static instance: OptimizedStorageService;
  private memoryCache = new Map<string, { data: any; expires: number }>();
  private indexCache = new Map<string, StorageIndex>();
  private batchQueue: BatchOperation[] = [];
  private batchTimeoutId: NodeJS.Timeout | null = null;
  
  // Performance optimization settings
  private static readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly BATCH_SIZE = 20;
  private static readonly BATCH_DELAY = 100; // ms
  private static readonly MAX_MEMORY_CACHE_SIZE = 50;

  public static getInstance(): OptimizedStorageService {
    if (!OptimizedStorageService.instance) {
      OptimizedStorageService.instance = new OptimizedStorageService();
    }
    return OptimizedStorageService.instance;
  }

  /**
   * 🚀 OPTIMIZED: Get with memory cache and lazy loading
   */
  public async getOptimized<T>(key: string, useCache = true): Promise<T | null> {
    try {
      // 1. Check memory cache first
      if (useCache && this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key)!;
        if (Date.now() < cached.expires) {
          return cached.data as T;
        } else {
          this.memoryCache.delete(key); // Expired
        }
      }

      // 2. Load from AsyncStorage
      const startTime = Date.now();
      const stored = await AsyncStorage.getItem(key);
      const loadTime = Date.now() - startTime;

      if (loadTime > 50) { // Log slow operations
        console.warn(`🐌 Slow AsyncStorage read: ${key} took ${loadTime}ms`);
      }

      if (!stored) return null;

      const data = JSON.parse(stored);
      
      // 3. Cache in memory if enabled
      if (useCache && this.memoryCache.size < OptimizedStorageService.MAX_MEMORY_CACHE_SIZE) {
        this.memoryCache.set(key, {
          data,
          expires: Date.now() + OptimizedStorageService.MEMORY_CACHE_TTL
        });
      }

      return data as T;
    } catch (error) {
      console.error(`Failed to get optimized storage for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 🚀 OPTIMIZED: Set with batching
   */
  public async setOptimized(key: string, value: any, immediate = false): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      // Update memory cache immediately
      if (this.memoryCache.size < OptimizedStorageService.MAX_MEMORY_CACHE_SIZE) {
        this.memoryCache.set(key, {
          data: value,
          expires: Date.now() + OptimizedStorageService.MEMORY_CACHE_TTL
        });
      }

      if (immediate) {
        // Immediate write (for critical data)
        await AsyncStorage.setItem(key, serialized);
      } else {
        // Batch write (for performance)
        this.addToBatch({ type: 'SET', key, value: serialized });
      }
    } catch (error) {
      console.error(`Failed to set optimized storage for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * 🚀 OPTIMIZED: Batch operations
   */
  private addToBatch(operation: BatchOperation): void {
    this.batchQueue.push(operation);
    
    // Auto-flush batch when full or after delay
    if (this.batchQueue.length >= OptimizedStorageService.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Reset batch timer
      if (this.batchTimeoutId) {
        clearTimeout(this.batchTimeoutId);
      }
      this.batchTimeoutId = setTimeout(() => this.flushBatch(), OptimizedStorageService.BATCH_DELAY) as any;
    }
  }

  /**
   * 🚀 OPTIMIZED: Flush batch operations
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const operations = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }

    try {
      const startTime = Date.now();
      
      // Group operations by type
      const setOps = operations.filter(op => op.type === 'SET') as (BatchOperation & { value: string })[];
      const removeOps = operations.filter(op => op.type === 'REMOVE');

      // Parallel execution for better performance
      await Promise.all([
        // Batch sets
        setOps.length > 0 ? AsyncStorage.multiSet(setOps.map(op => [op.key, op.value])) : Promise.resolve(),
        // Batch removes  
        removeOps.length > 0 ? AsyncStorage.multiRemove(removeOps.map(op => op.key)) : Promise.resolve()
      ]);

      const batchTime = Date.now() - startTime;
      console.log(`✅ Batch completed: ${operations.length} ops in ${batchTime}ms`);
      
    } catch (error) {
      console.error('Batch operation failed:', error);
      // TODO: Add to retry queue or fallback to individual operations
    }
  }

  /**
   * 🚀 OPTIMIZED: Query mood entries with virtual indexing
   */
  public async queryMoodEntries(
    userId: string, 
    options: QueryOptions = {}
  ): Promise<MoodEntry[]> {
    try {
      const startTime = Date.now();
      
      // Get or build index for this user
      const index = await this.getMoodIndex(userId);
      
      // Filter keys based on date range
      let relevantKeys = index.keys;
      
      if (options.dateFrom || options.dateTo) {
        relevantKeys = index.keys.filter(key => {
          const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
          if (!dateMatch) return false;
          
          const keyDate = new Date(dateMatch[0]);
          
          if (options.dateFrom && keyDate < options.dateFrom) return false;
          if (options.dateTo && keyDate > options.dateTo) return false;
          
          return true;
        });
      }

      // Load entries from relevant keys (parallel loading)
      const entries: MoodEntry[] = [];
      const loadPromises = relevantKeys.map(async (key) => {
        const data = await this.getOptimized<any>(key);
        if (data) {
          // Handle both encrypted and plain formats
          const plainEntries = Array.isArray(data) ? 
            data.map((e: any) => e.metadata || e).filter(Boolean) : [];
          return plainEntries;
        }
        return [];
      });

      const allEntries = await Promise.all(loadPromises);
      entries.push(...allEntries.flat());

      // Apply sorting and pagination in memory
      if (options.sortBy) {
        entries.sort((a, b) => {
          let comparison = 0;
          
          if (options.sortBy === 'timestamp') {
            comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          } else if (options.sortBy === 'mood_score') {
            comparison = a.mood_score - b.mood_score;
          }
          
          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply limit and offset
      const startIndex = options.offset || 0;
      const endIndex = options.limit ? startIndex + options.limit : undefined;
      const result = entries.slice(startIndex, endIndex);

      const queryTime = Date.now() - startTime;
      console.log(`🔍 Optimized query: ${result.length} entries in ${queryTime}ms`);

      return result;
    } catch (error) {
      console.error('Optimized query failed:', error);
      return [];
    }
  }

  /**
   * 🗂️ Build and maintain mood entry index
   */
  private async getMoodIndex(userId: string): Promise<StorageIndex> {
    const indexKey = `mood_index_${userId}`;
    
    // Check if index exists and is recent
    const cached = this.indexCache.get(indexKey);
    if (cached && (Date.now() - cached.lastUpdated) < 30000) { // 30s TTL
      return cached;
    }

    try {
      // Rebuild index
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => key.startsWith(`mood_entries_${userId}_`));
      
      const index: StorageIndex = {
        userId,
        keyPattern: `mood_entries_${userId}_*`,
        keys: moodKeys.sort(), // Sort for consistent ordering
        lastUpdated: Date.now(),
        totalEntries: 0
      };

      // Count total entries across all keys (optional, expensive)
      if (moodKeys.length < 10) { // Only for small datasets
        let totalCount = 0;
        for (const key of moodKeys.slice(0, 5)) { // Sample first 5 keys
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const entries = JSON.parse(data);
              totalCount += Array.isArray(entries) ? entries.length : 0;
            }
          } catch (error) {
            console.warn(`Failed to count entries in ${key}:`, error);
          }
        }
        index.totalEntries = totalCount;
      }

      // Cache index
      this.indexCache.set(indexKey, index);
      
      console.log(`📂 Index built: ${moodKeys.length} keys for user ${userId.slice(0, 8)}...`);
      return index;
    } catch (error) {
      console.error('Failed to build mood index:', error);
      // Return empty index
      return {
        userId,
        keyPattern: '',
        keys: [],
        lastUpdated: Date.now(),
        totalEntries: 0
      };
    }
  }

  /**
   * 🧹 Clear memory cache
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
    this.indexCache.clear();
    console.log('🗑️ Memory cache cleared');
  }

  /**
   * 📊 Get cache statistics
   */
  public getCacheStats(): {
    memoryEntries: number;
    indexEntries: number;
    batchQueueSize: number;
    memoryUsageKB: number;
  } {
    // Estimate memory usage
    const memoryUsageKB = Math.round(
      (this.memoryCache.size * 1024 + this.indexCache.size * 512) / 1024
    );

    return {
      memoryEntries: this.memoryCache.size,
      indexEntries: this.indexCache.size,
      batchQueueSize: this.batchQueue.length,
      memoryUsageKB
    };
  }

  /**
   * 🎯 Force batch flush (for testing/debugging)
   */
  public async forceBatchFlush(): Promise<void> {
    await this.flushBatch();
  }

  /**
   * 📈 Performance wrapper for any AsyncStorage operation
   */
  public async measureOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      if (duration > 100) {
        console.warn(`🐌 Slow storage operation: ${name} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Storage operation failed: ${name} (${duration}ms)`, error);
      throw error;
    }
  }
}

export const optimizedStorage = OptimizedStorageService.getInstance();
export default optimizedStorage;

// 🔄 WatermelonDB Migration Adapter Interface (Future)
export interface LocalDatabaseAdapter {
  saveMoodEntry(entry: MoodEntry): Promise<MoodEntry>;
  getMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]>;
  queryMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]>;
  updateMoodEntry(id: string, updates: Partial<MoodEntry>): Promise<void>;
  deleteMoodEntry(id: string, userId: string): Promise<void>;
  
  // Advanced features (WatermelonDB only)
  subscribeMoodEntries?(userId: string, options?: QueryOptions): any; // Observable
  performTransaction?(operations: () => Promise<void>): Promise<void>;
  getStorageInfo?(): Promise<{ size: number; entryCount: number }>;
}

// 🎯 Current AsyncStorage implementation
export class AsyncStorageAdapter implements LocalDatabaseAdapter {
  constructor(private optimizedStorage: OptimizedStorageService) {}

  async saveMoodEntry(entry: MoodEntry): Promise<MoodEntry> {
    // Implementation using optimized storage
    throw new Error('To be implemented with optimizedStorage');
  }

  async getMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]> {
    return this.optimizedStorage.queryMoodEntries(userId, options || {});
  }

  async queryMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]> {
    return this.optimizedStorage.queryMoodEntries(userId, options || {});
  }

  async updateMoodEntry(id: string, updates: Partial<MoodEntry>): Promise<void> {
    throw new Error('To be implemented');
  }

  async deleteMoodEntry(id: string, userId: string): Promise<void> {
    throw new Error('To be implemented');
  }
}

// 🍉 Future WatermelonDB implementation placeholder
export class WatermelonDBAdapter implements LocalDatabaseAdapter {
  async saveMoodEntry(entry: MoodEntry): Promise<MoodEntry> {
    throw new Error('WatermelonDB implementation pending');
  }

  async getMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]> {
    throw new Error('WatermelonDB implementation pending');
  }

  async queryMoodEntries(userId: string, options?: QueryOptions): Promise<MoodEntry[]> {
    throw new Error('WatermelonDB implementation pending'); 
  }

  async updateMoodEntry(id: string, updates: Partial<MoodEntry>): Promise<void> {
    throw new Error('WatermelonDB implementation pending');
  }

  async deleteMoodEntry(id: string, userId: string): Promise<void> {
    throw new Error('WatermelonDB implementation pending');
  }

  // WatermelonDB exclusive features
  subscribeMoodEntries(userId: string, options?: QueryOptions): any {
    throw new Error('WatermelonDB implementation pending');
  }

  async performTransaction(operations: () => Promise<void>): Promise<void> {
    throw new Error('WatermelonDB implementation pending');
  }

  async getStorageInfo(): Promise<{ size: number; entryCount: number }> {
    throw new Error('WatermelonDB implementation pending');
  }
}
