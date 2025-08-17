import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

type Compulsion = {
  id: string;
  type: string;
  severity: number;
  resistanceLevel: number;
  duration: number;
  trigger?: string;
  notes?: string;
  timestamp: Date | string;
  userId: string;
};

export interface ConflictLogItem {
  entity: 'compulsion' | string;
  count: number;
  at: string;
  conflicts: Array<{ id: string; local: any; remote: any }>;
}

export const conflictResolver = {
  async list(): Promise<ConflictLogItem[]> {
    const raw = await AsyncStorage.getItem('sync_conflicts');
    return raw ? JSON.parse(raw) : [];
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem('sync_conflicts');
  },

  async resolveCompulsion(
    userId: string,
    compulsionId: string,
    choose: 'local' | 'remote'
  ): Promise<boolean> {
    const raw = await AsyncStorage.getItem('sync_conflicts');
    const logs: ConflictLogItem[] = raw ? JSON.parse(raw) : [];
    let changed = false;
    for (const entry of logs) {
      if (entry.entity !== 'compulsion') continue;
      const idx = entry.conflicts.findIndex(c => c.id === compulsionId);
      if (idx === -1) continue;
      const conflict = entry.conflicts[idx];

      const localKey = `compulsions_${userId}`;
      const stored = await AsyncStorage.getItem(localKey);
      const list: Compulsion[] = stored ? JSON.parse(stored) : [];
      const currentIdx = list.findIndex(c => c.id === compulsionId);

      const toLocal = (r: any): Compulsion => ({
        id: r.id,
        type: r.subcategory || r.category,
        severity: r.resistance_level || 5,
        resistanceLevel: r.resistance_level,
        duration: 0,
        trigger: r.trigger,
        notes: r.notes,
        timestamp: r.timestamp,
        userId: r.user_id
      });

      const chosen: Compulsion = choose === 'local' ? conflict.local : toLocal(conflict.remote);
      if (currentIdx >= 0) list[currentIdx] = chosen; else list.push(chosen);
      await AsyncStorage.setItem(localKey, JSON.stringify(list));

      // Remove this conflict from log
      entry.conflicts.splice(idx, 1);
      entry.count = Math.max(0, entry.count - 1);
      changed = true;

      // Telemetry
      try {
        await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
          event: 'sync_conflict_resolved',
          entity: 'compulsion',
          compulsionId,
          resolution: choose
        }, userId);
      } catch {}
      break;
    }

    if (changed) {
      const filtered = logs.filter(e => e.count > 0);
      await AsyncStorage.setItem('sync_conflicts', JSON.stringify(filtered));
    }
    return changed;
  }
};

export default conflictResolver;


