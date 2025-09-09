export type AIPredGranularity = 'day' | 'hour';

export interface AIPrediction {
  user_id: string;
  bucket_granularity: AIPredGranularity;
  bucket_start_ts_utc: string; // ISO
  bucket_ymd_local: string;    // YYYY-MM-DD
  mood_score_pred: number;     // 0–100
  energy_level_pred: number;   // 1–10
  anxiety_level_pred: number;  // 1–10
  depression_risk?: number;    // 0–1
  bipolar_risk?: number;       // 0–1
  confidence?: number;         // 0–1
  model_name: string;
  model_version: string;
  features_hash?: string;
  content_hash?: string;
  created_at?: string;
}

