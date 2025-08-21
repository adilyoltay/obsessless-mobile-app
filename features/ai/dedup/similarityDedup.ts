/**
 * 🔁 Similarity Deduplication - Prevent duplicate AI processing
 * 
 * This module detects and prevents processing of duplicate or highly similar
 * requests within a time window using content hashing and similarity checking.
 * 
 * Features:
 * - SHA-1 content hashing
 * - LRU cache with 60-minute TTL
 * - Text normalization
 * - Similarity threshold checking
 * 
 * @module SimilarityDedup
 * @since v1.0.0
 */

import { createHash } from 'crypto';

// =============================================================================
// 🔧 CONFIGURATION
// =============================================================================

const CONFIG = {
  cacheSize: 100, // Maximum number of cached hashes
  ttlMinutes: 60, // Time window for deduplication
  similarityThreshold: 0.9, // Threshold for considering texts similar
};

// =============================================================================
// 🎯 TYPE DEFINITIONS
// =============================================================================

/**
 * Cached entry
 */
interface CacheEntry {
  hash: string;
  normalizedText: string;
  timestamp: number;
  count: number; // Number of times this was seen
}

/**
 * Deduplication result
 */
interface DedupResult {
  isDuplicate: boolean;
  hash: string;
  lastSeenAt?: number;
  similarityScore?: number;
  count?: number;
}

// =============================================================================
// 🔁 SIMILARITY DEDUP IMPLEMENTATION
// =============================================================================

/**
 * Similarity deduplication class
 */
export class SimilarityDedup {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU implementation

  constructor() {
    // Constructor
  }

  /**
   * Check if content is duplicate
   */
  async checkDuplicate(content: string): Promise<boolean> {
    const result = await this.analyze(content);
    return result.isDuplicate;
  }

  /**
   * Analyze content for duplication
   */
  async analyze(content: string): Promise<DedupResult> {
    // Normalize content
    const normalized = this.normalizeText(content);
    
    // Generate hash
    const hash = this.generateHash(normalized);
    
    // Clean expired entries
    this.cleanExpiredEntries();
    
    // Check exact match
    if (this.cache.has(hash)) {
      const entry = this.cache.get(hash)!;
      
      // Update access order (LRU)
      this.updateAccessOrder(hash);
      
      // Update count
      entry.count++;
      
      return {
        isDuplicate: true,
        hash,
        lastSeenAt: entry.timestamp,
        similarityScore: 1.0,
        count: entry.count,
      };
    }
    
    // Check for similar content
    const similar = this.findSimilar(normalized);
    if (similar) {
      // Update similar entry count
      similar.count++;
      
      return {
        isDuplicate: true,
        hash,
        lastSeenAt: similar.timestamp,
        similarityScore: this.calculateSimilarity(normalized, similar.normalizedText),
        count: similar.count,
      };
    }
    
    // Not a duplicate - add to cache
    this.addToCache(hash, normalized);
    
    return {
      isDuplicate: false,
      hash,
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    cacheSize: number;
    totalRequests: number;
    duplicateRate: number;
    oldestEntry?: number;
  } {
    let totalRequests = 0;
    let oldestTimestamp: number | undefined;
    
    for (const entry of this.cache.values()) {
      totalRequests += entry.count;
      if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }
    
    const duplicates = Array.from(this.cache.values())
      .filter(e => e.count > 1)
      .reduce((sum, e) => sum + e.count - 1, 0);
    
    return {
      cacheSize: this.cache.size,
      totalRequests,
      duplicateRate: totalRequests > 0 ? duplicates / totalRequests : 0,
      oldestEntry: oldestTimestamp,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    console.log('🗑️ Similarity cache cleared');
  }

  // =============================================================================
  // 🔧 PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/[^\w\sığüşöç]/gi, '') // Remove punctuation (keep Turkish chars)
      .replace(/\d+/g, 'NUM'); // Replace numbers with placeholder
  }

  /**
   * Generate SHA-1 hash
   */
  private generateHash(text: string): string {
    // For React Native, use a simple hash function
    // In production, consider using react-native-crypto or similar
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Add entry to cache with LRU eviction
   */
  private addToCache(hash: string, normalizedText: string): void {
    // Check cache size limit
    if (this.cache.size >= CONFIG.cacheSize) {
      // Evict least recently used
      const lruHash = this.accessOrder.shift();
      if (lruHash) {
        this.cache.delete(lruHash);
      }
    }
    
    // Add new entry
    this.cache.set(hash, {
      hash,
      normalizedText,
      timestamp: Date.now(),
      count: 1,
    });
    
    // Update access order
    this.accessOrder.push(hash);
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(hash: string): void {
    const index = this.accessOrder.indexOf(hash);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(hash);
  }

  /**
   * Clean expired entries
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const expiryTime = CONFIG.ttlMinutes * 60 * 1000;
    
    const expired: string[] = [];
    
    for (const [hash, entry] of this.cache) {
      if (now - entry.timestamp > expiryTime) {
        expired.push(hash);
      }
    }
    
    // Remove expired entries
    for (const hash of expired) {
      this.cache.delete(hash);
      const index = this.accessOrder.indexOf(hash);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    
    if (expired.length > 0 && __DEV__) {
      console.log(`🗑️ Cleaned ${expired.length} expired dedup entries`);
    }
  }

  /**
   * Find similar content in cache
   */
  private findSimilar(normalizedText: string): CacheEntry | null {
    for (const entry of this.cache.values()) {
      const similarity = this.calculateSimilarity(normalizedText, entry.normalizedText);
      if (similarity >= CONFIG.similarityThreshold) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Calculate similarity between two texts (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Split into words
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    if (union.size === 0) {
      return 0;
    }
    
    return intersection.size / union.size;
  }

  /**
   * Alternative: Levenshtein distance-based similarity
   */
  private calculateLevenshteinSimilarity(text1: string, text2: string): number {
    const maxLen = Math.max(text1.length, text2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(text1, text2);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get recent duplicates (for debugging)
   */
  getRecentDuplicates(limit: number = 10): Array<{
    text: string;
    hash: string;
    count: number;
    lastSeen: Date;
  }> {
    return Array.from(this.cache.values())
      .filter(e => e.count > 1)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(e => ({
        text: e.normalizedText,
        hash: e.hash,
        count: e.count,
        lastSeen: new Date(e.timestamp),
      }));
  }
}

// =============================================================================
// 🚀 EXPORTS
// =============================================================================

export default SimilarityDedup;
export type { DedupResult, CacheEntry };
