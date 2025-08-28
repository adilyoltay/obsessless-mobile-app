/**
 * 🔄 Intelligent Mood Merge Service
 * 
 * Advanced cross-device mood data synchronization including:
 * - Smart conflict detection and resolution
 * - Data quality-based merge strategies  
 * - Version control for mood entries
 * - Sync state management and recovery
 * - Intelligent duplicate detection
 * - Preservation of user intent and context
 * 
 * Created: Jan 2025 - Part of Mood Screen AI Enhancement Project
 */

import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { MoodEntry } from '@/services/moodTrackingService';
import { moodDeletionCache } from '@/services/moodDeletionCache';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface MoodConflict {
  entryId: string;
  localVersion: MoodEntry;
  remoteVersion: MoodEntry;
  conflictType: 'timestamp' | 'content' | 'sync_status' | 'data_quality';
  severity: 'low' | 'medium' | 'high';
  resolution: MergeResolution;
  mergedVersion: MoodEntry;
  confidence: number;
}

export interface MergeResolution {
  strategy: 'local_wins' | 'remote_wins' | 'intelligent_merge' | 'user_choice_required';
  reason: string;
  dataPreserved: string[];
  dataLost: string[];
}

export interface MergeResult {
  mergedEntries: MoodEntry[];
  conflicts: MoodConflict[];
  stats: {
    totalEntries: number;
    conflictsResolved: number;
    duplicatesRemoved: number;
    dataQualityImproved: boolean;
    syncSuccess: boolean;
  };
  summary: {
    localEntriesPreserved: number;
    remoteEntriesPreserved: number;
    intelligentMerges: number;
    userInterventionRequired: number;
  };
}

export interface DataQualityScore {
  completeness: number; // 0-100: How complete is the data (all fields filled)
  recency: number; // 0-100: How recent is the timestamp
  consistency: number; // 0-100: How consistent with user patterns
  reliability: number; // 0-100: Source reliability (synced vs local)
  overall: number; // 0-100: Overall quality score
}

export interface SyncState {
  lastSyncTime: Date;
  pendingEntries: number;
  conflictCount: number;
  syncHealth: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

export class IntelligentMoodMergeService {
  private static instance: IntelligentMoodMergeService;
  
  static getInstance(): IntelligentMoodMergeService {
    if (!IntelligentMoodMergeService.instance) {
      IntelligentMoodMergeService.instance = new IntelligentMoodMergeService();
    }
    return IntelligentMoodMergeService.instance;
  }

  /**
   * 🔄 Main intelligent merge function
   */
  async intelligentMoodMerge(
    userId: string,
    localEntries: MoodEntry[],
    remoteEntries: MoodEntry[]
  ): Promise<MergeResult> {
    console.log('🔄 Starting intelligent mood merge...');

    const startTime = Date.now();
    
    // Track merge operation start
    await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
      userId,
      dataType: 'intelligent_mood_merge',
      localEntries: localEntries.length,
      remoteEntries: remoteEntries.length,
      timestamp: startTime
    });

    try {
      // 0. DELETION AWARENESS - Filter out recently deleted entries
      console.log('🗑️ Checking for recently deleted entries...');
      const recentlyDeletedIds = await moodDeletionCache.getRecentlyDeletedIds(userId);
      
      const filteredLocal = localEntries.filter(entry => !recentlyDeletedIds.includes(entry.id));
      const filteredRemote = remoteEntries.filter(entry => {
        const isDeleted = recentlyDeletedIds.includes(entry.id);
        if (isDeleted) {
          console.log(`🗑️ Filtering out recently deleted entry from remote: ${entry.id}`);
        }
        return !isDeleted;
      });
      
      if (recentlyDeletedIds.length > 0) {
        console.log(`🗑️ Filtered out ${recentlyDeletedIds.length} recently deleted entries`);
        console.log(`   Local: ${localEntries.length} → ${filteredLocal.length}`);
        console.log(`   Remote: ${remoteEntries.length} → ${filteredRemote.length}`);
      }

      // 1. DEDUPLICATION - Remove obvious duplicates first
      const { dedupedLocal, dedupedRemote, duplicatesRemoved } = this.removeDuplicates(filteredLocal, filteredRemote);

      // 2. CONFLICT DETECTION - Find entries that need resolution
      const conflicts = this.detectConflicts(dedupedLocal, dedupedRemote);

      // 3. INTELLIGENT RESOLUTION - Resolve conflicts automatically
      const resolvedConflicts = await this.resolveConflictsIntelligently(userId, conflicts);

      // 4. MERGE STRATEGY - Combine all data intelligently
      const mergedEntries = this.mergeEntries(dedupedLocal, dedupedRemote, resolvedConflicts);

      // 5. QUALITY ASSURANCE - Validate and improve data quality
      const qualityImprovedEntries = this.improveDataQuality(mergedEntries);

      // 6. CALCULATE STATS
      const stats = {
        totalEntries: qualityImprovedEntries.length,
        conflictsResolved: resolvedConflicts.length,
        duplicatesRemoved,
        dataQualityImproved: qualityImprovedEntries.length > mergedEntries.length,
        syncSuccess: true
      };

      const summary = {
        localEntriesPreserved: resolvedConflicts.filter(c => c.resolution.strategy === 'local_wins').length,
        remoteEntriesPreserved: resolvedConflicts.filter(c => c.resolution.strategy === 'remote_wins').length,
        intelligentMerges: resolvedConflicts.filter(c => c.resolution.strategy === 'intelligent_merge').length,
        userInterventionRequired: resolvedConflicts.filter(c => c.resolution.strategy === 'user_choice_required').length
      };

      const result: MergeResult = {
        mergedEntries: qualityImprovedEntries,
        conflicts: resolvedConflicts,
        stats,
        summary
      };

      // Track successful merge
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'intelligent_mood_merge',
        insightsCount: 1,
        processingTime: Date.now() - startTime,
        conflictsResolved: stats.conflictsResolved,
        duplicatesRemoved: stats.duplicatesRemoved,
        totalEntries: stats.totalEntries
      });

      console.log(`✅ Intelligent merge completed: ${stats.totalEntries} entries, ${stats.conflictsResolved} conflicts resolved`);
      return result;

    } catch (error) {
      console.error('❌ Intelligent mood merge failed:', error);
      
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        userId,
        component: 'intelligentMoodMerge',
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      // Return safe fallback - just combine without intelligence
      return {
        mergedEntries: [...localEntries, ...remoteEntries],
        conflicts: [],
        stats: {
          totalEntries: localEntries.length + remoteEntries.length,
          conflictsResolved: 0,
          duplicatesRemoved: 0,
          dataQualityImproved: false,
          syncSuccess: false
        },
        summary: {
          localEntriesPreserved: localEntries.length,
          remoteEntriesPreserved: remoteEntries.length,
          intelligentMerges: 0,
          userInterventionRequired: 0
        }
      };
    }
  }

  /**
   * 📊 Calculate data quality score for mood entry
   */
  calculateDataQualityScore(entry: MoodEntry): DataQualityScore {
    // 1. COMPLETENESS SCORE
    let completeness = 0;
    if (entry.mood_score !== undefined) completeness += 25;
    if (entry.energy_level !== undefined) completeness += 25;
    if (entry.anxiety_level !== undefined) completeness += 25;
    if (entry.notes && entry.notes.length > 0) completeness += 15;
    if (entry.triggers && entry.triggers.length > 0) completeness += 10;

    // 2. RECENCY SCORE  
    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();
    const ageInHours = (now - entryTime) / (1000 * 60 * 60);
    const recency = Math.max(0, Math.min(100, 100 - (ageInHours / 24) * 10)); // Decreases over days

    // 3. CONSISTENCY SCORE (based on realistic values)
    let consistency = 100;
    if (entry.mood_score < 0 || entry.mood_score > 100) consistency -= 30;
    if (entry.energy_level < 0 || entry.energy_level > 10) consistency -= 30;
    if (entry.anxiety_level < 0 || entry.anxiety_level > 10) consistency -= 30;

    // 4. RELIABILITY SCORE (synced data is more reliable)
    const reliability = entry.synced ? 100 : 70;

    // 5. OVERALL SCORE (weighted average)
    const overall = Math.round(
      (completeness * 0.35) + 
      (recency * 0.25) + 
      (consistency * 0.25) + 
      (reliability * 0.15)
    );

    return {
      completeness,
      recency,
      consistency,
      reliability,
      overall
    };
  }

  /**
   * 📈 Analyze sync health and provide recommendations
   */
  analyzeSyncHealth(
    localEntries: MoodEntry[],
    remoteEntries: MoodEntry[],
    lastSyncTime?: Date
  ): SyncState {
    const now = new Date();
    const effectiveLastSync = lastSyncTime || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Count pending entries (local entries not synced)
    const pendingEntries = localEntries.filter(e => !e.synced).length;

    // Detect potential conflicts
    const conflicts = this.detectConflicts(localEntries, remoteEntries);
    const conflictCount = conflicts.length;

    // Determine sync health
    let syncHealth: SyncState['syncHealth'] = 'excellent';
    const recommendations: string[] = [];

    if (pendingEntries > 10) {
      syncHealth = 'poor';
      recommendations.push('Çok fazla senkronize edilmemiş kayıt var');
    } else if (pendingEntries > 5) {
      syncHealth = 'fair';
      recommendations.push('Bazı kayıtlar senkronize edilmemiş');
    }

    if (conflictCount > 5) {
      syncHealth = 'poor';
      recommendations.push('Çok fazla veri çakışması tespit edildi');
    } else if (conflictCount > 2) {
      syncHealth = 'fair';
      recommendations.push('Bazı veri çakışmaları mevcut');
    }

    // Time-based health check
    const hoursSinceSync = (now.getTime() - effectiveLastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync > 48) {
      syncHealth = 'poor';
      recommendations.push('Uzun süredir senkronizasyon yapılmamış');
    } else if (hoursSinceSync > 24) {
      if (syncHealth === 'excellent') syncHealth = 'good';
      recommendations.push('Senkronizasyon güncellemesi öneriliyor');
    }

    // Positive recommendations
    if (syncHealth === 'excellent') {
      recommendations.push('Tüm veriler senkronize ve güncel');
    }

    return {
      lastSyncTime: effectiveLastSync,
      pendingEntries,
      conflictCount,
      syncHealth,
      recommendations
    };
  }

  // =============================================================================
  // CORE MERGE LOGIC
  // =============================================================================

  private removeDuplicates(
    localEntries: MoodEntry[], 
    remoteEntries: MoodEntry[]
  ): {
    dedupedLocal: MoodEntry[];
    dedupedRemote: MoodEntry[];
    duplicatesRemoved: number;
  } {
    const allEntries = [...localEntries, ...remoteEntries];
    const seenIds = new Set<string>();
    const dedupedEntries: MoodEntry[] = [];
    let duplicatesRemoved = 0;

    // Sort by timestamp to prefer more recent entries
    const sortedEntries = allEntries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    for (const entry of sortedEntries) {
      if (seenIds.has(entry.id)) {
        duplicatesRemoved++;
        continue;
      }

      // Check for near-duplicate entries (same timestamp, similar data)
      const isDuplicate = dedupedEntries.some(existing => {
        const timeDiff = Math.abs(
          new Date(existing.timestamp).getTime() - new Date(entry.timestamp).getTime()
        );
        const moodDiff = Math.abs(existing.mood_score - entry.mood_score);
        
        return timeDiff < 60 * 1000 && moodDiff < 5; // Within 1 minute and 5 points
      });

      if (isDuplicate) {
        duplicatesRemoved++;
        continue;
      }

      seenIds.add(entry.id);
      dedupedEntries.push(entry);
    }

    // Separate back into local and remote
    const dedupedLocal = dedupedEntries.filter(e => 
      localEntries.some(le => le.id === e.id)
    );
    const dedupedRemote = dedupedEntries.filter(e => 
      remoteEntries.some(re => re.id === e.id) && 
      !localEntries.some(le => le.id === e.id)
    );

    return { dedupedLocal, dedupedRemote, duplicatesRemoved };
  }

  private detectConflicts(localEntries: MoodEntry[], remoteEntries: MoodEntry[]): MoodConflict[] {
    const conflicts: MoodConflict[] = [];
    
    localEntries.forEach(localEntry => {
      const remoteEntry = remoteEntries.find(re => re.id === localEntry.id);
      
      if (remoteEntry) {
        // Check for conflicts
        const hasConflict = this.hasConflict(localEntry, remoteEntry);
        
        if (hasConflict) {
          const conflictType = this.determineConflictType(localEntry, remoteEntry);
          const severity = this.calculateConflictSeverity(localEntry, remoteEntry);
          
          const conflict: MoodConflict = {
            entryId: localEntry.id,
            localVersion: localEntry,
            remoteVersion: remoteEntry,
            conflictType,
            severity,
            resolution: { strategy: 'intelligent_merge', reason: '', dataPreserved: [], dataLost: [] },
            mergedVersion: localEntry, // Placeholder, will be filled by resolution
            confidence: 0.5
          };

          conflicts.push(conflict);
        }
      }
    });

    return conflicts;
  }

  private async resolveConflictsIntelligently(userId: string, conflicts: MoodConflict[]): Promise<MoodConflict[]> {
    const resolvedConflicts: MoodConflict[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      conflict.resolution = resolution.resolution;
      conflict.mergedVersion = resolution.mergedVersion;
      conflict.confidence = resolution.confidence;
      
      resolvedConflicts.push(conflict);
    }

    return resolvedConflicts;
  }

  private async resolveConflict(conflict: MoodConflict): Promise<{
    resolution: MergeResolution;
    mergedVersion: MoodEntry;
    confidence: number;
  }> {
    const { localVersion, remoteVersion, conflictType, severity } = conflict;
    
    // Calculate data quality scores
    const localQuality = this.calculateDataQualityScore(localVersion);
    const remoteQuality = this.calculateDataQualityScore(remoteVersion);

    // Strategy 1: Quality-based resolution
    if (Math.abs(localQuality.overall - remoteQuality.overall) > 20) {
      const winnerIsLocal = localQuality.overall > remoteQuality.overall;
      return {
        resolution: {
          strategy: winnerIsLocal ? 'local_wins' : 'remote_wins',
          reason: `Data quality favors ${winnerIsLocal ? 'local' : 'remote'} version (${Math.round(Math.max(localQuality.overall, remoteQuality.overall))}%)`,
          dataPreserved: ['all'],
          dataLost: ['none']
        },
        mergedVersion: winnerIsLocal ? localVersion : remoteVersion,
        confidence: 0.85
      };
    }

    // Strategy 2: Timestamp-based resolution  
    if (conflictType === 'timestamp') {
      const localTime = new Date(localVersion.timestamp).getTime();
      const remoteTime = new Date(remoteVersion.timestamp).getTime();
      
      if (Math.abs(localTime - remoteTime) > 60 * 1000) { // More than 1 minute apart
        const winnerIsLocal = localTime > remoteTime;
        return {
          resolution: {
            strategy: winnerIsLocal ? 'local_wins' : 'remote_wins',
            reason: `More recent timestamp wins`,
            dataPreserved: ['all'],
            dataLost: ['older_timestamp']
          },
          mergedVersion: winnerIsLocal ? localVersion : remoteVersion,
          confidence: 0.9
        };
      }
    }

    // Strategy 3: Intelligent merge - Combine best of both
    if (severity === 'low' || severity === 'medium') {
      const mergedVersion = this.createIntelligentMerge(localVersion, remoteVersion, localQuality, remoteQuality);
      
      return {
        resolution: {
          strategy: 'intelligent_merge',
          reason: 'Combined best attributes from both versions',
          dataPreserved: ['mood_score', 'energy_level', 'anxiety_level', 'notes', 'triggers'],
          dataLost: ['none']
        },
        mergedVersion,
        confidence: 0.75
      };
    }

    // Strategy 4: User intervention required for high severity conflicts
    if (severity === 'high') {
      return {
        resolution: {
          strategy: 'user_choice_required',
          reason: 'Significant differences require user decision',
          dataPreserved: ['pending'],
          dataLost: ['pending']
        },
        mergedVersion: localVersion, // Default to local while awaiting user input
        confidence: 0.3
      };
    }

    // Fallback: Prefer synced version
    const winnerIsRemote = remoteVersion.synced && !localVersion.synced;
    return {
      resolution: {
        strategy: winnerIsRemote ? 'remote_wins' : 'local_wins',
        reason: 'Fallback: Prefer synced version',
        dataPreserved: ['all'],
        dataLost: ['none']
      },
      mergedVersion: winnerIsRemote ? remoteVersion : localVersion,
      confidence: 0.6
    };
  }

  private createIntelligentMerge(
    localVersion: MoodEntry, 
    remoteVersion: MoodEntry,
    localQuality: DataQualityScore,
    remoteQuality: DataQualityScore
  ): MoodEntry {
    // Start with the higher quality version as base
    const baseVersion = localQuality.overall >= remoteQuality.overall ? localVersion : remoteVersion;
    const otherVersion = baseVersion === localVersion ? remoteVersion : localVersion;

    // Intelligently merge fields
    const mergedVersion: MoodEntry = { ...baseVersion };

    // Mood score: Average if close, prefer higher quality if different
    const moodDiff = Math.abs(localVersion.mood_score - remoteVersion.mood_score);
    if (moodDiff < 10) {
      mergedVersion.mood_score = Math.round((localVersion.mood_score + remoteVersion.mood_score) / 2);
    }
    // else keep base version

    // Energy/Anxiety: Similar logic
    const energyDiff = Math.abs(localVersion.energy_level - remoteVersion.energy_level);
    if (energyDiff < 2) {
      mergedVersion.energy_level = Math.round((localVersion.energy_level + remoteVersion.energy_level) / 2);
    }

    const anxietyDiff = Math.abs(localVersion.anxiety_level - remoteVersion.anxiety_level);
    if (anxietyDiff < 2) {
      mergedVersion.anxiety_level = Math.round((localVersion.anxiety_level + remoteVersion.anxiety_level) / 2);
    }

    // Notes: Combine if both have content
    if (localVersion.notes && remoteVersion.notes && localVersion.notes !== remoteVersion.notes) {
      mergedVersion.notes = `${baseVersion.notes}\n[Merged: ${otherVersion.notes}]`;
    } else if (!mergedVersion.notes && otherVersion.notes) {
      mergedVersion.notes = otherVersion.notes;
    }

    // Triggers: Combine unique triggers
    const allTriggers = [...(localVersion.triggers || []), ...(remoteVersion.triggers || [])];
    mergedVersion.triggers = [...new Set(allTriggers)];

    // Activities: Combine unique activities
    const allActivities = [...(localVersion.activities || []), ...(remoteVersion.activities || [])];
    mergedVersion.activities = [...new Set(allActivities)];

    // Use most recent timestamp
    const localTime = new Date(localVersion.timestamp).getTime();
    const remoteTime = new Date(remoteVersion.timestamp).getTime();
    mergedVersion.timestamp = localTime > remoteTime ? localVersion.timestamp : remoteVersion.timestamp;

    // Prefer synced status
    mergedVersion.synced = localVersion.synced || remoteVersion.synced;

    return mergedVersion;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private hasConflict(local: MoodEntry, remote: MoodEntry): boolean {
    // Check for meaningful differences
    const moodDiff = Math.abs(local.mood_score - remote.mood_score);
    const energyDiff = Math.abs(local.energy_level - remote.energy_level);
    const anxietyDiff = Math.abs(local.anxiety_level - remote.anxiety_level);
    const timeDiff = Math.abs(new Date(local.timestamp).getTime() - new Date(remote.timestamp).getTime());
    const syncDiff = local.synced !== remote.synced;

    return moodDiff > 5 || energyDiff > 1 || anxietyDiff > 1 || timeDiff > 60000 || syncDiff;
  }

  private determineConflictType(local: MoodEntry, remote: MoodEntry): MoodConflict['conflictType'] {
    const moodDiff = Math.abs(local.mood_score - remote.mood_score);
    const timeDiff = Math.abs(new Date(local.timestamp).getTime() - new Date(remote.timestamp).getTime());
    
    if (timeDiff > 60000) return 'timestamp';
    if (moodDiff > 20) return 'content';
    if (local.synced !== remote.synced) return 'sync_status';
    
    return 'data_quality';
  }

  private calculateConflictSeverity(local: MoodEntry, remote: MoodEntry): MoodConflict['severity'] {
    const moodDiff = Math.abs(local.mood_score - remote.mood_score);
    const energyDiff = Math.abs(local.energy_level - remote.energy_level);
    const anxietyDiff = Math.abs(local.anxiety_level - remote.anxiety_level);
    
    const totalDiff = moodDiff + energyDiff * 5 + anxietyDiff * 5; // Weight energy/anxiety more
    
    if (totalDiff > 30) return 'high';
    if (totalDiff > 15) return 'medium';
    return 'low';
  }

  private mergeEntries(
    localEntries: MoodEntry[], 
    remoteEntries: MoodEntry[], 
    resolvedConflicts: MoodConflict[]
  ): MoodEntry[] {
    const mergedMap = new Map<string, MoodEntry>();

    // Add all local entries first
    localEntries.forEach(entry => {
      mergedMap.set(entry.id, entry);
    });

    // Add remote entries (non-conflicting)
    remoteEntries.forEach(entry => {
      if (!mergedMap.has(entry.id)) {
        mergedMap.set(entry.id, entry);
      }
    });

    // Apply conflict resolutions
    resolvedConflicts.forEach(conflict => {
      mergedMap.set(conflict.entryId, conflict.mergedVersion);
    });

    return Array.from(mergedMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private improveDataQuality(entries: MoodEntry[]): MoodEntry[] {
    return entries.map(entry => {
      // Normalize values to valid ranges
      const improvedEntry = { ...entry };
      
      improvedEntry.mood_score = Math.max(0, Math.min(100, entry.mood_score));
      improvedEntry.energy_level = Math.max(0, Math.min(10, entry.energy_level));
      improvedEntry.anxiety_level = Math.max(0, Math.min(10, entry.anxiety_level));
      
      // Trim and clean text fields
      if (improvedEntry.notes) {
        improvedEntry.notes = improvedEntry.notes.trim();
        if (improvedEntry.notes.length === 0) improvedEntry.notes = undefined;
      }

      return improvedEntry;
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const intelligentMoodMergeService = IntelligentMoodMergeService.getInstance();
export default intelligentMoodMergeService;
