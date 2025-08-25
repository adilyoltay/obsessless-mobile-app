/**
 * 🔄 Unified Conflict Resolution Service
 * 
 * Consolidated conflict resolution system that includes:
 * - General data conflict resolution from conflictResolution.ts
 * - Compulsion-specific conflict handling from conflictResolver.ts
 * - Enhanced telemetry and logging
 * - Configurable resolution strategies
 * - Cross-module conflict detection and resolution
 * 
 * Created: Jan 2025 - Consolidation of conflict resolution services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES AND INTERFACES (Unified from both services)
// =============================================================================

export type ConflictType = 'CREATE_DUPLICATE' | 'UPDATE_CONFLICT' | 'DELETE_CONFLICT' | 'NONE';
export type EntityType = 'compulsion' | 'achievement' | 'mood_entry' | 'ai_profile' | 'treatment_plan' | 'voice_checkin' | 'thought_record';

export interface UnifiedDataConflict {
  id: string;
  entityType: EntityType;
  localData: any;
  remoteData: any;
  conflictType: ConflictType;
  timestamp: Date;
  userId?: string;
  resolution?: 'local' | 'remote' | 'merged';
  resolvedAt?: Date;
  metadata?: {
    source: string;
    confidence: number;
    autoResolved: boolean;
  };
}

export interface ConflictResolutionResult {
  resolved: boolean;
  resultData: any;
  strategy: 'last_write_wins' | 'merge' | 'user_choice' | 'heuristic';
  conflicts: UnifiedDataConflict[];
  metadata: {
    timestamp: string;
    confidence: number;
    reasoning: string[];
  };
}

export interface ConflictLogItem {
  entity: EntityType;
  count: number;
  at: string;
  conflicts: Array<{ id: string; local: any; remote: any; type: ConflictType }>;
  userId?: string;
}

export interface ResolutionStrategy {
  name: string;
  description: string;
  canAutoResolve: boolean;
  priority: number;
  apply: (local: any, remote: any, context: any) => any;
}

// =============================================================================
// CONFLICT DETECTION ENGINE
// =============================================================================

export class ConflictDetectionEngine {
  /**
   * Detect conflict type between local and remote data
   */
  static detectConflictType(localData: any, remoteData: any, entityType: EntityType): ConflictType {
    if (!remoteData && !localData) return 'NONE';
    if (!remoteData && localData) return 'NONE'; // Local-only data, no conflict
    if (!localData && remoteData) return 'NONE'; // Remote-only data, no conflict
    
    // Check for duplicate creation
    if (!localData?.id && remoteData?.id && this.areDataIdentical(localData, remoteData, entityType)) {
      return 'CREATE_DUPLICATE';
    }
    
    // Check for update conflicts
    const localTimestamp = this.extractTimestamp(localData);
    const remoteTimestamp = this.extractTimestamp(remoteData);
    
    if (localTimestamp && remoteTimestamp && localTimestamp !== remoteTimestamp) {
      return 'UPDATE_CONFLICT';
    }
    
    // Check for delete conflicts (exists locally but marked deleted remotely)
    if (localData && remoteData?.deleted) {
      return 'DELETE_CONFLICT';
    }
    
    return 'NONE';
  }
  
  /**
   * Check if two data objects are essentially identical
   */
  static areDataIdentical(a: any, b: any, entityType: EntityType): boolean {
    try {
      // Entity-specific comparison logic
      switch (entityType) {
        case 'compulsion':
          return this.compareCompulsions(a, b);
        case 'mood_entry':
          return this.compareMoodEntries(a, b);
        case 'voice_checkin':
          return this.compareVoiceCheckins(a, b);
        default:
          return this.compareGeneric(a, b);
      }
    } catch (error) {
      console.error('Error comparing data for identity:', error);
      return false;
    }
  }
  
  private static compareCompulsions(a: any, b: any): boolean {
    if (!a || !b) return false;
    return (
      (a.type === b.subcategory || a.type === b.category) &&
      Math.abs((a.severity || a.resistance_level || 0) - (b.resistance_level || b.severity || 0)) <= 1 &&
      a.trigger === b.trigger
    );
  }
  
  private static compareMoodEntries(a: any, b: any): boolean {
    if (!a || !b) return false;
    return (
      Math.abs((a.mood_score || a.mood || 0) - (b.mood_score || b.mood || 0)) <= 5 &&
      (a.notes || '').toLowerCase().includes((b.notes || '').toLowerCase().slice(0, 10))
    );
  }
  
  private static compareVoiceCheckins(a: any, b: any): boolean {
    if (!a || !b) return false;
    return (
      a.duration && b.duration && Math.abs(a.duration - b.duration) <= 5000 && // 5 second tolerance
      a.transcript && b.transcript && 
      a.transcript.toLowerCase().slice(0, 20) === b.transcript.toLowerCase().slice(0, 20)
    );
  }
  
  private static compareGeneric(a: any, b: any): boolean {
    try {
      const normalize = (x: any) => {
        const clone = { ...x };
        delete clone.timestamp;
        delete clone.updated_at;
        delete clone.created_at;
        delete clone.id;
        return JSON.stringify(clone);
      };
      return normalize(a) === normalize(b);
    } catch {
      return false;
    }
  }
  
  private static extractTimestamp(data: any): number | null {
    if (!data) return null;
    
    const timestampFields = ['updated_at', 'timestamp', 'modified_at', 'created_at'];
    
    for (const field of timestampFields) {
      if (data[field]) {
        const timestamp = new Date(data[field]).getTime();
        if (!isNaN(timestamp)) return timestamp;
      }
    }
    
    return null;
  }
}

// =============================================================================
// RESOLUTION STRATEGIES
// =============================================================================

export class ResolutionStrategies {
  private static strategies: Record<string, ResolutionStrategy> = {
    last_write_wins: {
      name: 'Last Write Wins',
      description: 'Choose the data with the most recent timestamp',
      canAutoResolve: true,
      priority: 1,
      apply: (local: any, remote: any) => {
        const localTime = new Date(local?.updated_at || local?.timestamp || 0).getTime();
        const remoteTime = new Date(remote?.updated_at || remote?.timestamp || 0).getTime();
        return localTime >= remoteTime ? local : remote;
      }
    },
    
    merge_intelligent: {
      name: 'Intelligent Merge',
      description: 'Merge data with domain-aware logic',
      canAutoResolve: true,
      priority: 2,
      apply: (local: any, remote: any, context: any) => {
        const entityType = context?.entityType;
        
        switch (entityType) {
          case 'compulsion':
            return ResolutionStrategies.mergeCompulsions(local, remote);
          case 'mood_entry':
            return ResolutionStrategies.mergeMoodEntries(local, remote);
          default:
            return ResolutionStrategies.mergeGeneric(local, remote);
        }
      }
    },
    
    prefer_higher_severity: {
      name: 'Prefer Higher Severity',
      description: 'For compulsions, prefer data with higher severity/resistance',
      canAutoResolve: true,
      priority: 3,
      apply: (local: any, remote: any) => {
        const localSeverity = local?.resistance_level || local?.severity || local?.anxiety_initial || 0;
        const remoteSeverity = remote?.resistance_level || remote?.severity || remote?.anxiety_initial || 0;
        
        if (localSeverity === remoteSeverity) {
          // Fall back to last write wins
          const localTime = new Date(local?.updated_at || local?.timestamp || 0).getTime();
          const remoteTime = new Date(remote?.updated_at || remote?.timestamp || 0).getTime();
          return localTime >= remoteTime ? local : remote;
        }
        
        return localSeverity >= remoteSeverity ? local : remote;
      }
    }
  };
  
  static getStrategy(name: string): ResolutionStrategy | null {
    return this.strategies[name] || null;
  }
  
  static getAllStrategies(): ResolutionStrategy[] {
    return Object.values(this.strategies).sort((a, b) => a.priority - b.priority);
  }
  
  private static mergeCompulsions(local: any, remote: any): any {
    return {
      ...remote,
      ...local,
      // Prefer higher severity/anxiety
      resistance_level: Math.max(
        Number(remote?.resistance_level || 0), 
        Number(local?.resistance_level || 0)
      ) || local?.resistance_level || remote?.resistance_level,
      
      anxiety_initial: Math.max(
        Number(remote?.anxiety_initial || 0), 
        Number(local?.anxiety_initial || 0)
      ) || local?.anxiety_initial || remote?.anxiety_initial,
      
      anxiety_final: Math.max(
        Number(remote?.anxiety_final || 0), 
        Number(local?.anxiety_final || 0)
      ) || local?.anxiety_final || remote?.anxiety_final,
      
      // Combine notes if different
      notes: local?.notes !== remote?.notes && local?.notes && remote?.notes 
        ? `${remote.notes} | ${local.notes}` 
        : local?.notes || remote?.notes,
      
      // Metadata about the merge
      conflict_resolved: true,
      merged_at: new Date().toISOString(),
      conflict_history: [
        { type: 'remote', data: remote, at: new Date().toISOString() },
        { type: 'local', data: local, at: new Date().toISOString() }
      ]
    };
  }
  
  private static mergeMoodEntries(local: any, remote: any): any {
    return {
      ...remote,
      ...local,
      // Prefer more detailed entry
      notes: (local?.notes?.length || 0) > (remote?.notes?.length || 0) 
        ? local.notes 
        : remote.notes,
      
      // Merge triggers and activities
      triggers: [...(remote?.triggers || []), ...(local?.triggers || [])],
      activities: [...(remote?.activities || []), ...(local?.activities || [])],
      
      // Conflict metadata
      conflict_resolved: true,
      merged_at: new Date().toISOString()
    };
  }
  
  private static mergeGeneric(local: any, remote: any): any {
    return {
      ...remote,
      ...local,
      conflict_resolved: true,
      merged_at: new Date().toISOString(),
      conflict_history: [
        { type: 'remote', data: remote, at: new Date().toISOString() },
        { type: 'local', data: local, at: new Date().toISOString() }
      ]
    };
  }
}

// =============================================================================
// MAIN UNIFIED CONFLICT RESOLVER SERVICE
// =============================================================================

class UnifiedConflictResolverService {
  private static instance: UnifiedConflictResolverService;

  static getInstance(): UnifiedConflictResolverService {
    if (!UnifiedConflictResolverService.instance) {
      UnifiedConflictResolverService.instance = new UnifiedConflictResolverService();
    }
    return UnifiedConflictResolverService.instance;
  }

  /**
   * Resolve conflicts for any entity type with multiple strategies
   */
  async resolveConflict(
    entityType: EntityType,
    localData: any,
    remoteData: any,
    userId?: string,
    preferredStrategy?: string
  ): Promise<ConflictResolutionResult> {
    const startTime = Date.now();
    
    try {
      // Detect conflict type
      const conflictType = ConflictDetectionEngine.detectConflictType(localData, remoteData, entityType);
      
      if (conflictType === 'NONE') {
        return {
          resolved: true,
          resultData: localData || remoteData,
          strategy: 'last_write_wins',
          conflicts: [],
          metadata: {
            timestamp: new Date().toISOString(),
            confidence: 1.0,
            reasoning: ['No conflict detected']
          }
        };
      }
      
      // Create conflict object
      const conflict: UnifiedDataConflict = {
        id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        entityType,
        localData,
        remoteData,
        conflictType,
        timestamp: new Date(),
        userId,
        metadata: {
          source: 'unified_conflict_resolver',
          confidence: 0.8,
          autoResolved: true
        }
      };
      
      // Select resolution strategy
      const strategy = this.selectBestStrategy(conflictType, entityType, preferredStrategy);
      
      // Apply resolution strategy
      const resultData = strategy.apply(localData, remoteData, { 
        entityType, 
        conflictType, 
        userId 
      });
      
      // Mark conflict as resolved
      conflict.resolution = this.determineResolutionType(resultData, localData, remoteData);
      conflict.resolvedAt = new Date();
      
      // Log the conflict
      await this.logConflict(conflict);
      
      // Track conflict resolution
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'conflict_resolved',
        entityType,
        conflictType,
        strategy: strategy.name,
        userId: userId || 'unknown',
        processingTime: Date.now() - startTime
      });
      
      return {
        resolved: true,
        resultData,
        strategy: strategy.name as any,
        conflicts: [conflict],
        metadata: {
          timestamp: new Date().toISOString(),
          confidence: 0.8,
          reasoning: [
            `Conflict type: ${conflictType}`,
            `Strategy: ${strategy.name}`,
            `Auto-resolved: ${strategy.canAutoResolve}`
          ]
        }
      };
      
    } catch (error) {
      console.error('Unified conflict resolution failed:', error);
      
      await trackAIInteraction(AIEventType.API_ERROR, {
        event: 'conflict_resolution_failed',
        entityType,
        error: error instanceof Error ? error.message : String(error),
        userId: userId || 'unknown'
      });
      
      // Return fallback resolution
      return {
        resolved: false,
        resultData: localData || remoteData,
        strategy: 'last_write_wins',
        conflicts: [],
        metadata: {
          timestamp: new Date().toISOString(),
          confidence: 0.3,
          reasoning: ['Fallback due to resolution error', error instanceof Error ? error.message : String(error)]
        }
      };
    }
  }
  
  /**
   * Resolve compulsion-specific conflicts (from old conflictResolver.ts)
   */
  async resolveCompulsionConflict(
    userId: string,
    compulsionId: string,
    choice: 'local' | 'remote'
  ): Promise<boolean> {
    try {
      const conflicts = await this.getConflictLogs();
      let resolved = false;
      
      for (const entry of conflicts) {
        if (entry.entity !== 'compulsion') continue;
        
        const conflictIndex = entry.conflicts.findIndex(c => c.id === compulsionId);
        if (conflictIndex === -1) continue;
        
        const conflict = entry.conflicts[conflictIndex];
        
        // Load local compulsions
        const localKey = `compulsions_${userId}`;
        const stored = await AsyncStorage.getItem(localKey);
        const compulsions = stored ? JSON.parse(stored) : [];
        
        // Convert remote data to local format
        const localFormat = this.convertRemoteToLocal(conflict.remote);
        const chosenData = choice === 'local' ? conflict.local : localFormat;
        
        // Update local storage
        const existingIndex = compulsions.findIndex((c: any) => c.id === compulsionId);
        if (existingIndex >= 0) {
          compulsions[existingIndex] = chosenData;
        } else {
          compulsions.push(chosenData);
        }
        
        await AsyncStorage.setItem(localKey, JSON.stringify(compulsions));
        
        // Remove resolved conflict
        entry.conflicts.splice(conflictIndex, 1);
        entry.count = Math.max(0, entry.count - 1);
        resolved = true;
        
        // Track resolution
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'compulsion_conflict_resolved',
          compulsionId,
          resolution: choice,
          userId
        });
        
        break;
      }
      
      // Update conflict log
      if (resolved) {
        const filteredConflicts = conflicts.filter(e => e.count > 0);
        await AsyncStorage.setItem('unified_sync_conflicts', JSON.stringify(filteredConflicts));
      }
      
      return resolved;
      
    } catch (error) {
      console.error('Compulsion conflict resolution failed:', error);
      return false;
    }
  }
  
  /**
   * List all current conflicts
   */
  async getConflictLogs(): Promise<ConflictLogItem[]> {
    try {
      const stored = await AsyncStorage.getItem('unified_sync_conflicts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  /**
   * Clear all conflict logs
   */
  async clearConflictLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem('unified_sync_conflicts');
      await AsyncStorage.removeItem('unified_conflict_logs'); // Legacy cleanup
    } catch (error) {
      console.error('Failed to clear conflict logs:', error);
    }
  }
  
  // Private helper methods
  private selectBestStrategy(
    conflictType: ConflictType, 
    entityType: EntityType, 
    preferred?: string
  ): ResolutionStrategy {
    const strategies = ResolutionStrategies.getAllStrategies();
    
    // Use preferred strategy if specified and valid
    if (preferred) {
      const preferredStrategy = ResolutionStrategies.getStrategy(preferred);
      if (preferredStrategy) return preferredStrategy;
    }
    
    // Select based on conflict type and entity type
    switch (conflictType) {
      case 'CREATE_DUPLICATE':
        return strategies.find(s => s.name === 'Last Write Wins') || strategies[0];
      
      case 'UPDATE_CONFLICT':
        if (entityType === 'compulsion') {
          return strategies.find(s => s.name === 'Prefer Higher Severity') || strategies[0];
        }
        return strategies.find(s => s.name === 'Intelligent Merge') || strategies[0];
      
      case 'DELETE_CONFLICT':
        return strategies.find(s => s.name === 'Last Write Wins') || strategies[0];
      
      default:
        return strategies[0];
    }
  }
  
  private determineResolutionType(result: any, local: any, remote: any): 'local' | 'remote' | 'merged' {
    if (result === local) return 'local';
    if (result === remote) return 'remote';
    return 'merged';
  }
  
  private async logConflict(conflict: UnifiedDataConflict): Promise<void> {
    try {
      const existingLogs = await AsyncStorage.getItem('unified_conflict_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      
      logs.push({
        ...conflict,
        timestamp: conflict.timestamp.toISOString(),
        resolvedAt: conflict.resolvedAt?.toISOString()
      });
      
      // Keep only last 100 conflicts
      const recentLogs = logs.slice(-100);
      await AsyncStorage.setItem('unified_conflict_logs', JSON.stringify(recentLogs));
      
    } catch (error) {
      console.error('Failed to log conflict:', error);
    }
  }
  
  private convertRemoteToLocal(remoteData: any): any {
    // Convert remote compulsion format to local format
    return {
      id: remoteData.id,
      type: remoteData.subcategory || remoteData.category,
      severity: remoteData.resistance_level || 5,
      resistanceLevel: remoteData.resistance_level,
      duration: 0,
      trigger: remoteData.trigger,
      notes: remoteData.notes,
      timestamp: remoteData.timestamp,
      userId: remoteData.user_id
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const unifiedConflictResolver = UnifiedConflictResolverService.getInstance();
export default unifiedConflictResolver;
export type { UnifiedDataConflict, ConflictResolutionResult, ConflictLogItem, EntityType, ConflictType };
