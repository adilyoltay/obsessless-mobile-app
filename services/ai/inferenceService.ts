import { offlineSyncService } from '@/services/offlineSync';
import type { AIPrediction, AIPredGranularity } from '@/types/ai';
import { computeFeaturesHash } from '@/services/ai/featureHasher';

// Normalize and compute a deterministic content hash (lightweight, not cryptographic)
function computeAIPredContentHash(pred: Pick<AIPrediction, 'user_id'|'bucket_granularity'|'bucket_ymd_local'|'model_name'|'model_version'|'features_hash'>): string {
  const norm = {
    u: pred.user_id,
    g: pred.bucket_granularity || 'day',
    d: pred.bucket_ymd_local,
    m: (pred.model_name || 'big-mood-detector'),
    v: (pred.model_version || 'v1'),
    f: pred.features_hash || ''
  };
  const content = JSON.stringify(norm);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `ai_pred_${Math.abs(hash).toString(36)}`;
}

export async function queueDailyPrediction(input: {
  user_id: string;
  dateYmdLocal: string;          // YYYY-MM-DD
  mood_score_pred: number;       // 0..100
  energy_level_pred: number;     // 1..10
  anxiety_level_pred: number;    // 1..10
  depression_risk?: number;      // 0..1
  bipolar_risk?: number;         // 0..1
  confidence?: number;           // 0..1
  model_name?: string;
  model_version?: string;
  features_hash?: string;
  features?: Record<string, any>;
  bucket_start_ts_utc?: string;  // optional, default: date start at 00:00 UTC
}): Promise<void> {
  const granularity: AIPredGranularity = 'day';
  const model_name = input.model_name || 'big-mood-detector';
  const model_version = input.model_version || 'v1';
  const bucket_start_ts_utc = input.bucket_start_ts_utc || (new Date(`${input.dateYmdLocal}T00:00:00.000Z`).toISOString());
  // Compute features_hash if available from features
  let features_hash = input.features_hash || '';
  if (!features_hash && input.features) {
    try { features_hash = computeFeaturesHash(input.features, { dateYmdLocal: input.dateYmdLocal, feature_version: 'v1' }); } catch {}
  }

  const content_hash = computeAIPredContentHash({
    user_id: input.user_id,
    bucket_granularity: granularity,
    bucket_ymd_local: input.dateYmdLocal,
    model_name,
    model_version,
    features_hash: features_hash || ''
  } as any);

  await offlineSyncService.addToSyncQueue({
    type: 'CREATE',
    entity: 'ai_mood_prediction',
    data: {
      user_id: input.user_id,
      bucket_granularity: granularity,
      bucket_start_ts_utc,
      bucket_ymd_local: input.dateYmdLocal,
      mood_score_pred: Math.round(input.mood_score_pred),
      energy_level_pred: Math.round(input.energy_level_pred),
      anxiety_level_pred: Math.round(input.anxiety_level_pred),
      depression_risk: input.depression_risk ?? null,
      bipolar_risk: input.bipolar_risk ?? null,
      confidence: input.confidence ?? null,
      model_name,
      model_version,
      features_hash: features_hash || null,
      content_hash,
    },
    priority: 'normal'
  });
}

export default { queueDailyPrediction };
