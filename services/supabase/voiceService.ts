import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizePII } from '@/utils/privacy';
import type { VoiceCheckinRecord, VoiceSessionDB } from '@/types/supabase';
import { isUUID } from '@/utils/validators';

export class VoiceService {
  constructor(private client: SupabaseClient) {}

  private computeContentHash(text: string): string {
    const normalized = (text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  async saveVoiceCheckin(record: VoiceCheckinRecord): Promise<void> {
    const sanitized = {
      ...record,
      text: sanitizePII(record.text || ''),
      trigger: sanitizePII(record.trigger || ''),
    };
    const content_hash = this.computeContentHash(sanitized.text);
    const payload = {
      user_id: sanitized.user_id,
      text: sanitized.text,
      mood: sanitized.mood,
      trigger: sanitized.trigger,
      confidence: sanitized.confidence,
      lang: sanitized.lang,
      content_hash,
      created_at: sanitized.created_at || new Date().toISOString(),
    };
    const { error } = await this.client
      .from('voice_checkins')
      .upsert(payload, { onConflict: 'user_id,content_hash', ignoreDuplicates: true });
    if (error && !error.message?.includes('duplicate')) throw error;
  }

  async deleteVoiceCheckin(id: string): Promise<void> {
    if (!isUUID(id)) return; // client generated id, noop
    const { error } = await this.client.from('voice_checkins').delete().eq('id', id);
    if (error) throw error;
  }

  async saveVoiceSessionSummary(session: VoiceSessionDB): Promise<void> {
    const payload = {
      user_id: session.user_id,
      started_at: session.started_at,
      ended_at: session.ended_at,
      duration_ms: session.duration_ms,
      transcription_count: session.transcription_count,
      error_count: session.error_count,
      created_at: session.created_at || new Date().toISOString(),
    };
    await this.client.from('voice_sessions').upsert(payload, { onConflict: 'user_id,started_at' });
  }
}

