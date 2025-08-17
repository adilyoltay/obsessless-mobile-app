import AsyncStorage from '@react-native-async-storage/async-storage';

export type ConflictType = 'CREATE_DUPLICATE' | 'UPDATE_CONFLICT' | 'DELETE_CONFLICT' | 'NONE';

export interface DataConflict {
  id: string;
  localData: any;
  remoteData: any;
  conflictType: ConflictType;
  timestamp: Date;
}

class ConflictResolutionService {
  private static instance: ConflictResolutionService;

  static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  detectConflictType(localData: any, remoteData: any): ConflictType {
    if (!remoteData) return 'NONE';

    // Heuristic: if local has no id but remote exists with same content, it's duplicate create
    if (!localData?.id && this.areDataIdentical(localData, remoteData)) {
      return 'CREATE_DUPLICATE';
    }

    // If both exist and timestamps differ → update conflict
    const lt = new Date(localData?.updated_at || localData?.timestamp || 0).getTime();
    const rt = new Date(remoteData?.updated_at || remoteData?.timestamp || 0).getTime();
    if (lt !== rt && lt > 0 && rt > 0) {
      return 'UPDATE_CONFLICT';
    }

    return 'NONE';
  }

  areDataIdentical(a: any, b: any): boolean {
    try {
      const normalize = (x: any) => JSON.stringify({ ...x, timestamp: undefined, updated_at: undefined });
      return normalize(a) === normalize(b);
    } catch {
      return false;
    }
  }

  applyLastWriteWins(localData: any, remoteData: any): any {
    const lt = new Date(localData?.updated_at || localData?.timestamp || 0).getTime();
    const rt = new Date(remoteData?.updated_at || remoteData?.timestamp || 0).getTime();
    return lt >= rt ? localData : remoteData;
  }

  async resolveConflict(entityType: string, localData: any, remoteData: any): Promise<any> {
    const type = this.detectConflictType(localData, remoteData);
    switch (type) {
      case 'CREATE_DUPLICATE':
        return remoteData;
      case 'UPDATE_CONFLICT':
        return this.mergeData(localData, remoteData);
      case 'DELETE_CONFLICT':
        return remoteData; // prefer server source of truth
      case 'NONE':
      default:
        return this.applyLastWriteWins(localData, remoteData);
    }
  }

  mergeData(local: any, remote: any): any {
    const merged: any = {
      ...remote,
      ...local,
      // Prefer highest severity/anxiety when present (domain-aware merge)
      anxiety_final: Math.max(Number(remote?.anxiety_final || 0), Number(local?.anxiety_final || 0)) || local?.anxiety_final || remote?.anxiety_final,
      anxiety_initial: Math.max(Number(remote?.anxiety_initial || 0), Number(local?.anxiety_initial || 0)) || local?.anxiety_initial || remote?.anxiety_initial,
      resistance_level: Math.max(Number(remote?.resistance_level || 0), Number(local?.resistance_level || 0)) || local?.resistance_level || remote?.resistance_level,
      conflict_resolved: true,
      merged_at: new Date().toISOString(),
      conflict_history: [
        { type: 'remote', data: remote, at: new Date().toISOString() },
        { type: 'local', data: local, at: new Date().toISOString() }
      ]
    };
    return merged;
  }

  async logConflict(conflict: DataConflict): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('conflict_logs');
      const logs = existing ? JSON.parse(existing) : [];
      logs.push({ ...conflict, resolved_at: new Date().toISOString() });
      await AsyncStorage.setItem('conflict_logs', JSON.stringify(logs.slice(-100)));
    } catch {}
  }
}

export const conflictResolver = ConflictResolutionService.getInstance();
export default conflictResolver;


