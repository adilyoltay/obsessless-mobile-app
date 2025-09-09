import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIPrediction, AIPredGranularity } from '@/types/ai';

export class AIPredictionService {
  constructor(private client: SupabaseClient) {}

  async getPredictions(
    userId: string,
    sinceYmdInclusive: string,
    granularity: AIPredGranularity = 'day',
    limit: number = 400
  ): Promise<AIPrediction[]> {
    const { data, error } = await this.client
      .from('ai_mood_predictions')
      .select('user_id,bucket_granularity,bucket_start_ts_utc,bucket_ymd_local,mood_score_pred,energy_level_pred,anxiety_level_pred,depression_risk,bipolar_risk,confidence,model_name,model_version,features_hash,content_hash,created_at')
      .eq('user_id', userId)
      .eq('bucket_granularity', granularity)
      .gte('bucket_ymd_local', sinceYmdInclusive)
      .order('bucket_ymd_local', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as AIPrediction[];
  }

  async upsertPrediction(pred: AIPrediction): Promise<{ id?: string; created_at?: string } | null> {
    const payload: any = { ...pred };
    const { data, error } = await this.client
      .from('ai_mood_predictions')
      .upsert(payload, { onConflict: 'user_id,content_hash', ignoreDuplicates: true })
      .select('id,created_at')
      .maybeSingle();
    if (error) {
      const msg = String(error?.message || '').toLowerCase();
      if (error.code === '23505' || /duplicate|multiple \(or no\) rows/.test(msg)) return null;
      throw error;
    }
    if (!data && pred.content_hash) {
      try {
        const { data: existing } = await this.client
          .from('ai_mood_predictions')
          .select('id,created_at')
          .eq('user_id', pred.user_id)
          .eq('content_hash', pred.content_hash)
          .maybeSingle();
        return existing || null;
      } catch {}
    }
    return data;
  }
}

