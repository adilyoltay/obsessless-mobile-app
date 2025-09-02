import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompulsionRecord } from '@/types/supabase';
import { sanitizePII } from '@/utils/privacy';

export class CompulsionService {
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

  async saveCompulsion(compulsion: Omit<CompulsionRecord, 'id' | 'timestamp'>): Promise<CompulsionRecord> {
    const sanitized = {
      ...compulsion,
      notes: sanitizePII(compulsion.notes || ''),
      trigger: sanitizePII(compulsion.trigger || ''),
    } as any;

    const { mapToDatabaseCategory } = require('@/utils/categoryMapping');
    const compulsionType = sanitized.subcategory || mapToDatabaseCategory(sanitized.category);
    let description = sanitized.notes || '';
    if (sanitized.trigger && sanitized.trigger.trim()) {
      description = `Trigger: ${sanitized.trigger}\n${description}`;
    }
    const intensity = Math.min(100, Math.max(0, (sanitized.resistance_level || 5) * 10));

    const payload = {
      user_id: sanitized.user_id,
      compulsion_type: compulsionType,
      description,
      intensity,
      created_at: new Date().toISOString(),
    };
    const baseText = `${payload.user_id}|${(payload.compulsion_type || '').toLowerCase()}|${(payload.description || '').trim().toLowerCase()}|${new Date().toISOString().slice(0,10)}`;
    const content_hash = this.computeContentHash(baseText);

    const { data, error } = await this.client
      .from('compulsion_records')
      .upsert({ ...payload, content_hash }, { onConflict: 'user_id,content_hash', ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      category: sanitized.category,
      subcategory: data.compulsion_type,
      resistance_level: sanitized.resistance_level || 5,
      trigger: sanitized.trigger || '',
      notes: sanitized.notes || '',
      timestamp: data.created_at,
    } as CompulsionRecord;
  }

  async getCompulsions(userId: string, startDate?: string, endDate?: string): Promise<CompulsionRecord[]> {
    let query = this.client
      .from('compulsion_records')
      .select('id, user_id, compulsion_type, description, intensity, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    const { data, error } = await query;
    if (error) throw error;

    const { mapToCanonicalCategory } = require('@/utils/categoryMapping');
    return (data || []).map((record: any) => {
      let trigger = '';
      let notes = record.description || '';
      const m = notes.match(/^Trigger: (.*)\n(.*)$/s);
      if (m) { trigger = m[1] || ''; notes = m[2] || ''; }
      const resistance_level = Math.round((record.intensity || 50) / 10);
      return {
        id: record.id,
        user_id: record.user_id,
        category: mapToCanonicalCategory(record.compulsion_type),
        subcategory: record.compulsion_type,
        resistance_level,
        trigger,
        notes,
        timestamp: record.created_at,
      } as CompulsionRecord;
    });
  }
}

