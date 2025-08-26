import { SyncConflict, SyncEntityType } from './conflictResolutionStrategy';

export class ConflictDetector {
  async detectConflicts<T extends { id: string; updated_at?: string | Date; version?: number; checksum?: string; type?: SyncEntityType }>(
    localData: T[],
    serverData: T[]
  ): Promise<SyncConflict<T, T>[]> {
    const conflicts: SyncConflict<T, T>[] = [];
    for (const local of localData) {
      const server = serverData.find(s => s.id === local.id);
      if (!server) continue;
      if (this.hasConflict(local, server)) {
        conflicts.push({
          id: local.id,
          entityType: (local.type as SyncEntityType) || 'mood_entry',
          localData: local,
          serverData: server,
          localTimestamp: new Date(String(local.updated_at || new Date())),
          serverTimestamp: new Date(String(server.updated_at || new Date()))
        });
      }
    }
    return conflicts;
  }

  private hasConflict(a: { version?: number; checksum?: string }, b: { version?: number; checksum?: string }): boolean {
    if (a.version != null && b.version != null && a.version !== b.version) return true;
    if (a.checksum && b.checksum && a.checksum !== b.checksum) return true;
    return false;
  }
}


