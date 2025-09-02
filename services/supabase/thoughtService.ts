import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizePII } from '@/utils/privacy';
import type { ThoughtRecordItem } from '@/types/supabase';
import { isUUID } from '@/utils/validators';

export class ThoughtService {
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

  async saveThoughtRecord(record: ThoughtRecordItem): Promise<void> {
    const sanitized = {
      ...record,
      automatic_thought: sanitizePII(record.automatic_thought || ''),
      evidence_for: sanitizePII(record.evidence_for || ''),
      evidence_against: sanitizePII(record.evidence_against || ''),
      new_view: sanitizePII(record.new_view || ''),
    } as ThoughtRecordItem;
    const content_hash = this.computeContentHash(sanitized.automatic_thought || '');
    const payload = {
      user_id: sanitized.user_id,
      automatic_thought: sanitized.automatic_thought,
      evidence_for: sanitized.evidence_for,
      evidence_against: sanitized.evidence_against,
      distortions: sanitized.distortions,
      new_view: sanitized.new_view,
      lang: sanitized.lang,
      content_hash,
      created_at: sanitized.created_at || new Date().toISOString(),
    };
    const { error } = await this.client
      .from('thought_records')
      .upsert(payload, { onConflict: 'user_id,content_hash', ignoreDuplicates: true });
    if (error && !error.message?.includes('duplicate')) throw error;
  }

  async deleteThoughtRecord(id: string): Promise<void> {
    if (!isUUID(id)) return;
    const { error } = await this.client.from('thought_records').delete().eq('id', id);
    if (error) throw error;
  }

  async getCBTRecords(userId: string, dateRange?: { start: Date; end: Date }): Promise<any[]> {
    let query = this.client
      .from('thought_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
    }
    const { data, error } = await query.limit(100);
    if (error) throw error;
    return data || [];
  }
}

