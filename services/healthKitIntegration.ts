import { Platform } from 'react-native';
import type { MoodEntry } from '@/services/moodTrackingService';

// Types are loosely declared to avoid requiring the native module at build time
type HKMoodSample = {
  type: string;
  startDate: string | Date;
  endDate: string | Date;
  metadata?: Record<string, any>;
};

export class HealthKitMoodSync {
  static toHealthKit(moodEntry: MoodEntry): HKMoodSample {
    return {
      type: 'mindfulSession',
      startDate: moodEntry.timestamp,
      endDate: moodEntry.timestamp,
      metadata: {
        valence: (moodEntry.mood_score - 50) / 50,
        energy: moodEntry.energy_level,
        anxiety: moodEntry.anxiety_level,
        notes: moodEntry.notes,
        triggers: JSON.stringify(moodEntry.triggers || []),
        source: 'ObsessLess',
      },
    };
  }

  static fromHealthKit(sample: HKMoodSample): Partial<MoodEntry> {
    const valence = typeof sample?.metadata?.valence === 'number' ? sample.metadata!.valence : 0;
    return {
      mood_score: Math.round(valence * 50 + 50),
      energy_level: sample.metadata?.energy ?? 6,
      anxiety_level: sample.metadata?.anxiety ?? 5,
      notes: sample.metadata?.notes || '',
      triggers: sample.metadata?.triggers ? JSON.parse(sample.metadata.triggers) : [],
      timestamp: new Date(sample.startDate as any).toISOString(),
    } as Partial<MoodEntry>;
  }

  async fetchFromHealthKit(): Promise<HKMoodSample[]> {
    if (Platform.OS !== 'ios') return [];
    // Intentionally left as a stub to avoid native dependency here
    return [];
  }

  async intelligentMerge(a: HKMoodSample[], b: MoodEntry[]): Promise<MoodEntry[]> {
    // Simple merge preferring local when timestamps collide
    const mappedFromHK: MoodEntry[] = a.map((s, idx) => ({
      id: `hk-${idx}-${new Date(s.startDate as any).getTime()}`,
      user_id: '',
      mood_score: Math.round(((s.metadata?.valence ?? 0) as number) * 50 + 50),
      energy_level: s.metadata?.energy ?? 6,
      anxiety_level: s.metadata?.anxiety ?? 5,
      notes: s.metadata?.notes || '',
      triggers: s.metadata?.triggers ? JSON.parse(s.metadata.triggers) : [],
      activities: [],
      timestamp: new Date(s.startDate as any).toISOString(),
      synced: true,
    }));
    const byTs = new Map<string, MoodEntry>();
    [...b, ...mappedFromHK].forEach((e) => byTs.set(e.timestamp, e));
    return Array.from(byTs.values());
  }

  async updateBothSources(_merged: MoodEntry[]): Promise<void> {
    // Stub no-op in this patch
  }

  async syncBidirectional() {
    const hk = await this.fetchFromHealthKit();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const local = (await import('@/services/moodTrackingService')).default;
    const localEntries = await local.getMoodEntries('', 7);
    const merged = await this.intelligentMerge(hk, localEntries);
    await this.updateBothSources(merged);
  }
}

