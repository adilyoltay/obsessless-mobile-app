import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';

export interface MoodEntry {
  id: string;
  user_id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes?: string;
  triggers?: string[];
  activities?: string[];
  timestamp: string;
  synced: boolean;
}

class MoodTrackingService {
  private static instance: MoodTrackingService;
  private readonly STORAGE_KEY = 'mood_entries';

  static getInstance(): MoodTrackingService {
    if (!MoodTrackingService.instance) {
      MoodTrackingService.instance = new MoodTrackingService();
    }
    return MoodTrackingService.instance;
  }

  async saveMoodEntry(entry: Omit<MoodEntry, 'id' | 'timestamp' | 'synced'>): Promise<MoodEntry> {
    const moodEntry: MoodEntry = {
      ...entry,
      id: `mood_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    await this.saveToLocalStorage(moodEntry);

    // best-effort sync to server (if schema/table exists in current project)
    try {
      await supabaseService.client
        .from('mood_tracking')
        .upsert({
          id: moodEntry.id,
          user_id: moodEntry.user_id,
          mood_score: moodEntry.mood_score,
          energy_level: moodEntry.energy_level,
          anxiety_level: moodEntry.anxiety_level,
          notes: moodEntry.notes,
          triggers: moodEntry.triggers,
          activities: moodEntry.activities,
          created_at: moodEntry.timestamp,
        });
      await this.markAsSynced(moodEntry.id);
    } catch {}

    return moodEntry;
  }

  private async saveToLocalStorage(entry: MoodEntry): Promise<void> {
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${entry.timestamp.split('T')[0]}`;
    const existing = await AsyncStorage.getItem(key);
    const entries = existing ? JSON.parse(existing) : [];
    entries.push(entry);
    await AsyncStorage.setItem(key, JSON.stringify(entries));
  }

  private async markAsSynced(id: string): Promise<void> {
    // no-op placeholder (can scan daily key and mark)
  }
}

export const moodTracker = MoodTrackingService.getInstance();
export default moodTracker;


