import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

type CompulsionLocal = {
  id: string;
  type: string;
  resistanceLevel: number;
  trigger?: string;
  notes?: string;
  timestamp: string | Date;
  userId: string;
};

type ERPSessionLocal = any;

async function mergeCompulsionsLocal(userId: string, remote: any[]): Promise<void> {
  try {
    const key = `compulsions_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    const local: CompulsionLocal[] = stored ? JSON.parse(stored) : [];
    const remoteConverted: CompulsionLocal[] = (remote || []).map(r => ({
      id: r.id,
      type: r.subcategory || r.category,
      resistanceLevel: r.resistance_level,
      trigger: r.trigger,
      notes: r.notes,
      timestamp: r.timestamp,
      userId: r.user_id,
    }));

    const map = new Map<string, CompulsionLocal>();
    for (const c of [...local, ...remoteConverted]) {
      const prev = map.get(c.id);
      if (!prev) {
        map.set(c.id, c);
      } else {
        const pt = new Date((prev.timestamp as any)).getTime();
        const ct = new Date((c.timestamp as any)).getTime();
        map.set(c.id, ct >= pt ? c : prev);
      }
    }
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp as any).getTime() - new Date(a.timestamp as any).getTime());
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

async function writeERPSessionsLocal(userId: string, remote: any[]): Promise<void> {
  try {
    // Keep a consolidated key for quick access
    const key = `erp_sessions_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    const local: ERPSessionLocal[] = stored ? JSON.parse(stored) : [];
    const map = new Map<string, ERPSessionLocal>();
    for (const s of [...local, ...(remote || [])]) {
      const id = s.id || `${s.user_id}_${s.timestamp}`;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, s);
      } else {
        const pt = new Date(prev.timestamp).getTime();
        const ct = new Date(s.timestamp).getTime();
        map.set(id, ct >= pt ? s : prev);
      }
    }
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

async function writeMoodEntriesLocal(userId: string, rows: any[]): Promise<void> {
  try {
    // Store by day key: mood_entries_${userId}_${YYYY-MM-DD}
    const grouped: Record<string, any[]> = {};
    for (const r of rows || []) {
      const date = (r.created_at || r.timestamp || new Date()).toString();
      const day = new Date(date).toISOString().split('T')[0];
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push({
        id: r.id,
        user_id: r.user_id,
        mood_score: r.mood_score,
        energy_level: r.energy_level,
        anxiety_level: r.anxiety_level,
        notes: r.notes,
        triggers: r.triggers,
        activities: r.activities,
        timestamp: r.created_at || r.timestamp
      });
    }
    const days = Object.keys(grouped);
    for (const day of days) {
      const key = `mood_entries_${userId}_${day}`;
      const existing = await AsyncStorage.getItem(key);
      const local: any[] = existing ? JSON.parse(existing) : [];
      const map = new Map<string, any>();
      for (const e of [...local, ...grouped[day]]) {
        map.set(e.id, e);
      }
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
    }
  } catch {}
}

export async function runInitialCrossDeviceSync(userId: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [comp, erp, mood] = await Promise.all([
      supabaseService.getCompulsions(userId, since),
      supabaseService.getERPSessions(userId, since),
      (async () => {
        try {
          const { data, error } = await supabaseService.supabaseClient
            .from('mood_tracking')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', since)
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data || [];
        } catch {
          return [] as any[];
        }
      })()
    ]);

    await mergeCompulsionsLocal(userId, comp || []);
    await writeERPSessionsLocal(userId, erp || []);
    await writeMoodEntriesLocal(userId, mood || []);
  } catch {}
}

export default {
  runInitialCrossDeviceSync,
};


