import type { SupabaseClient } from '@supabase/supabase-js';
import { TableClient } from '@/services/supabase/tableClient';
import { sanitizePII } from '@/utils/privacy';
import { computeMoodContentHash } from '@/services/idempotency/moodContentHash';

/**
 * MoodService: mood_entries CRUD (scaffold)
 */
export class MoodService {
  constructor(private client: SupabaseClient) {}

  async getMoodEntries(userId: string, sinceIso: string, limit: number = 200): Promise<any[]> {
    const moods = new TableClient<any>(this.client, 'mood_entries');
    const { data, error } = await moods
      .select('id, user_id, content_hash, created_at, mood_score, energy_level, anxiety_level, notes, triggers, activities')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async saveMoodEntry(entry: any): Promise<any> {
    if (!entry?.user_id) throw new Error('invalid user_id');
    // Sanitize PII
    const sanitizedEntry = {
      ...entry,
      notes: sanitizePII(entry.notes || ''),
      trigger: sanitizePII(entry.trigger || ''),
      triggers: entry.triggers?.map((t: string) => sanitizePII(t)) || (entry.trigger ? [sanitizePII(entry.trigger)] : []),
      activities: entry.activities?.map((a: string) => sanitizePII(a)) || [],
    };
    // Validate ranges
    const validateRange = (value: any, min: number, max: number, def: number): number => {
      const n = parseInt(value, 10);
      if (isNaN(n)) return def;
      return Math.max(min, Math.min(max, n));
    };
    const createdAtIso: string = sanitizedEntry.created_at || sanitizedEntry.timestamp || new Date().toISOString();
    const validatedMood = validateRange(sanitizedEntry.mood_score, 0, 100, 50);
    const validatedEnergy = validateRange(sanitizedEntry.energy_level, 1, 10, 5);
    const validatedAnxiety = validateRange(sanitizedEntry.anxiety_level, 1, 10, 5);
    const content_hash = computeMoodContentHash({
      user_id: sanitizedEntry.user_id,
      mood_score: validatedMood,
      energy_level: validatedEnergy,
      anxiety_level: validatedAnxiety,
      notes: sanitizedEntry.notes,
      timestamp: createdAtIso,
    }, { dayMode: 'UTC' });
    const payload = {
      user_id: sanitizedEntry.user_id,
      mood_score: validatedMood,
      energy_level: validatedEnergy,
      anxiety_level: validatedAnxiety,
      notes: sanitizedEntry.notes,
      triggers: sanitizedEntry.triggers,
      activities: sanitizedEntry.activities,
      content_hash,
      created_at: createdAtIso,
    };

    const { data, error } = await this.client
      .from('mood_entries')
      .upsert(payload, { onConflict: 'user_id,content_hash', ignoreDuplicates: true })
      .select('id, user_id, content_hash, created_at')
      .maybeSingle();

    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate') || error.code === 'PGRST116' || /multiple \(or no\) rows returned/i.test(error.message || '')) {
        return null;
      }
      throw error;
    }
    if (!data) {
      try {
        const { data: existing } = await this.client
          .from('mood_entries')
          .select('id, user_id, content_hash, created_at')
          .eq('user_id', sanitizedEntry.user_id)
          .eq('content_hash', content_hash)
          .maybeSingle();
        if (existing) return existing;
      } catch {}
    }
    return data;
  }

  async updateMoodEntry(entryId: string, updates: Partial<{ mood_score: number; energy_level: number; anxiety_level: number; notes: string; triggers: string[]; activities: string[]; }>): Promise<any> {
    const payload: any = { ...updates };
    if (typeof payload.notes === 'string') payload.notes = sanitizePII(payload.notes);
    if (Array.isArray(payload.triggers)) payload.triggers = payload.triggers.map((t: string) => sanitizePII(t));
    if (Array.isArray(payload.activities)) payload.activities = payload.activities.map((a: string) => sanitizePII(a));
    const { data, error } = await this.client
      .from('mood_entries')
      .update(payload)
      .eq('id', entryId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
