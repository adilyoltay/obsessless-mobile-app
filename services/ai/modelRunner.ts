import type { DailyHealthFeatures } from '@/services/ai/healthSignals';
import ProductionScalerService from './productionScalerService';
import Constants from 'expo-constants';
import { get7DayMinuteActivityWindow } from '@/services/ai/healthSignals';
import { cloudInferenceClient } from '@/services/ai/cloudInferenceClient';

export type BigMoodOutput = {
  mood_score_pred: number;      // 0..100
  energy_level_pred: number;    // 1..10
  anxiety_level_pred: number;   // 1..10
  depression_risk?: number;     // 0..1
  bipolar_risk?: number;        // 0..1
  confidence?: number;          // 0..1
};

// NOT: Gercek model entegrasyonu burada kurulacak (TFLite veya TFJS). 
// Bu fonksiyon su an placeholder ve tetikleme akisi icin sabit/heuristic degerler dondurur.
export async function runBigMoodDetector(features: DailyHealthFeatures): Promise<BigMoodOutput> {
  // Bridge secimi: 'cloud' | 'tflite' | 'placeholder' (tflite => cloud fallback)
  const bridgeRaw = getEnv('BIG_MOOD_BRIDGE', 'cloud');
  const bridge = String(bridgeRaw || '').toLowerCase() as 'cloud' | 'tflite' | 'placeholder';
  try {
    if (bridge === 'cloud' || bridge === 'tflite') {
      const isPatConvL = getEnv('BIG_MOOD_MODEL', 'big-mood-detector').toLowerCase().includes('pat');
      const inputTypePref = (getEnv('AI_INPUT_TYPE', getEnv('EXPO_PUBLIC_AI_INPUT_TYPE', 'daily_features_norm01')) || '').toLowerCase();
      if (isPatConvL) {
        // Build minute window and (optionally) z-score normalize
        const scalerService = ProductionScalerService.getInstance();
        const vec = await scalerService.normalizeHealthData(features);
        const resp = await cloudInferenceClient.inferPatConvL(vec);
        try {
          const v = getEnv('EXPO_PUBLIC_AI_VERBOSE_LOGGING', 'false');
          if (String(v).toLowerCase() === 'true' && resp && (resp as any).request_id) {
            console.log('🌐 Cloud PAT inference:', {
              request_id: (resp as any).request_id,
              elapsed_ms: (resp as any).elapsed_ms,
              ts: (resp as any).timestamp,
              input_quality: (resp as any).input_quality?.flags || null,
            });
          }
        } catch {}
        // Accept MEA from API or map from logits/probs
        if (resp && typeof resp === 'object') {
          if (isFiniteNumber(resp.mood) && isFiniteNumber(resp.energy) && isFiniteNumber(resp.anxiety)) {
            return {
              mood_score_pred: clamp(Math.round(resp.mood!), 0, 100),
              energy_level_pred: clamp(Math.round(resp.energy!), 1, 10),
              anxiety_level_pred: clamp(Math.round(resp.anxiety!), 1, 10),
              confidence: typeof resp.confidence === 'number' ? clamp(resp.confidence, 0, 1) : undefined,
            } as BigMoodOutput;
          }
          const logitsOrProbs: number[] | undefined = (Array.isArray(resp.logits) ? resp.logits : (Array.isArray(resp.probs) ? resp.probs : undefined)) as any;
          if (Array.isArray(logitsOrProbs) && logitsOrProbs.length >= 5) {
            const mapped = scalerService.mapModelOutputToMEA(logitsOrProbs as number[]);
            return {
              mood_score_pred: mapped.mood,
              energy_level_pred: mapped.energy,
              anxiety_level_pred: mapped.anxiety,
              confidence: mapped.confidence,
            } as BigMoodOutput;
          }
        }
      } else {
        // Feature-based model (XGBoost): prefer minute_window (server-side 36 features), then xgb_features_v1, else daily features
        const extras: any = (features as any)?.extras || {};
        const xgb36 = Array.isArray(extras?.xgb_features_v1) ? extras.xgb_features_v1 : (Array.isArray(extras?.xgb_features) ? extras.xgb_features : null);
        let resp: any = null;
        if (inputTypePref === 'minute_window_f32_b64' || inputTypePref === 'minute_window') {
          try {
            const win = await get7DayMinuteActivityWindow(new Date()); // [0..1], length 10080
            if (Array.isArray(win) && win.length === 10080) {
              resp = await cloudInferenceClient.inferMinuteWindowForXgb(win);
            }
          } catch (e) {
            console.warn('Minute-window inference failed, falling back:', e);
          }
        }
        if (!resp) {
          if (inputTypePref === 'xgb_features_v1' && Array.isArray(xgb36) && xgb36.length === 36) {
            resp = await cloudInferenceClient.inferXgbFeatures(xgb36 as number[]);
          } else {
            const vec: number[] = buildVector(features);
            resp = await cloudInferenceClient.inferDailyFeatureVector(vec);
          }
        }
        try {
          const v = getEnv('EXPO_PUBLIC_AI_VERBOSE_LOGGING', 'false');
          if (String(v).toLowerCase() === 'true' && resp && (resp as any).request_id) {
            console.log('🌐 Cloud XGB inference:', {
              request_id: (resp as any).request_id,
              elapsed_ms: (resp as any).elapsed_ms,
              ts: (resp as any).timestamp,
              input: inputTypePref,
              input_quality: (resp as any).input_quality?.flags || null,
            });
          }
        } catch {}
        if (resp && typeof resp === 'object') {
          if (isFiniteNumber(resp.mood) && isFiniteNumber(resp.energy) && isFiniteNumber(resp.anxiety)) {
            return {
              mood_score_pred: clamp(Math.round(resp.mood!), 0, 100),
              energy_level_pred: clamp(Math.round(resp.energy!), 1, 10),
              anxiety_level_pred: clamp(Math.round(resp.anxiety!), 1, 10),
              confidence: typeof resp.confidence === 'number' ? clamp(resp.confidence, 0, 1) : undefined,
            } as BigMoodOutput;
          }
          const logitsOrProbs: number[] | undefined = (Array.isArray(resp.logits) ? resp.logits : (Array.isArray(resp.probs) ? resp.probs : undefined)) as any;
          if (Array.isArray(logitsOrProbs) && logitsOrProbs.length >= 5) {
            const mapped = ProductionScalerService.getInstance().mapModelOutputToMEA(logitsOrProbs as number[]);
            return {
              mood_score_pred: mapped.mood,
              energy_level_pred: mapped.energy,
              anxiety_level_pred: mapped.anxiety,
              confidence: mapped.confidence,
            } as BigMoodOutput;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Model bridge failed, using placeholder heuristic:', e);
  }

  // Placeholder heuristic fallback
  const hrRest = Number(features.hr_rest || 60);
  const sdnn = Number(features.hrv_sdnn_median || 40);
  const steps = Number(features.steps || 4000);
  const sleep = Number(features.sleep_duration_min || 360);

  let mood = 50;
  mood += Math.max(-10, Math.min(10, (sdnn - 40) * 0.2));
  mood += Math.max(-8, Math.min(8, (sleep - 420) / 60));
  mood += Math.max(-6, Math.min(6, (steps - 6000) / 1000));
  mood -= Math.max(0, Math.min(6, (hrRest - 70) * 0.5));
  mood = clamp(Math.round(mood), 0, 100);

  let energy = 6;
  energy += Math.max(-3, Math.min(3, (steps - 6000) / 3000));
  energy += Math.max(-2, Math.min(2, (sleep - 420) / 180));
  energy = clamp(Math.round(energy), 1, 10);

  let anxiety = 5;
  anxiety += Math.max(-2, Math.min(2, (40 - sdnn) / 20));
  anxiety += Math.max(-1, Math.min(1, (70 - hrRest) / 20));
  anxiety = clamp(Math.round(anxiety), 1, 10);

  const confidence = 0.6;
  return { mood_score_pred: mood, energy_level_pred: energy, anxiety_level_pred: anxiety, confidence } as BigMoodOutput;
}

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function buildVector(f: DailyHealthFeatures): number[] {
  // Basic normalization consistent with MODEL_IO; clip to [0,1] where applicable
  const norm = (v: number, min: number, max: number) => clamp((v - min) / (max - min), 0, 1);
  const v = [
    typeof f.hr_rest === 'number' ? norm(f.hr_rest, 40, 100) : 0,
    typeof f.hr_mean === 'number' ? norm(f.hr_mean, 40, 120) : 0,
    typeof f.hr_var === 'number' ? clamp(f.hr_var / 400, 0, 1) : 0,
    typeof f.hrv_sdnn_median === 'number' ? norm(f.hrv_sdnn_median, 10, 120) : 0,
    typeof f.hrv_rmssd === 'number' ? norm(f.hrv_rmssd, 10, 120) : 0,
    typeof f.steps === 'number' ? clamp(f.steps / 20000, 0, 1) : 0,
    typeof f.active_energy === 'number' ? clamp(f.active_energy / 1500, 0, 1) : 0,
    typeof f.stand_hours === 'number' ? clamp(f.stand_hours / 18, 0, 1) : 0,
    typeof f.sleep_duration_min === 'number' ? clamp(f.sleep_duration_min / 720, 0, 1) : 0,
    typeof f.sleep_efficiency === 'number' ? clamp(f.sleep_efficiency, 0, 1) : 0,
    typeof f.deep_sleep_ratio === 'number' ? clamp(f.deep_sleep_ratio / 0.6, 0, 1) : 0,
    typeof f.vo2max === 'number' ? norm(f.vo2max, 20, 60) : 0,
  ];
  return v;
}

function float32ToBase64(arr: number[]): string {
  const f32 = new Float32Array(arr);
  const bytes = new Uint8Array(f32.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function getEnv(key: string, fallback: string = ''): string {
  // Prefer process.env, then Expo Constants extra (EXPO_PUBLIC_ prefix), then fallback
  try {
    const val = (process.env as any)?.[key] || (process.env as any)?.[`EXPO_PUBLIC_${key}`];
    if (typeof val === 'string' && val.length) return val;
  } catch {}
  try {
    const extra = (Constants as any)?.expoConfig?.extra || (Constants as any)?.default?.expoConfig?.extra || {};
    const v = extra?.[key] || extra?.[`EXPO_PUBLIC_${key}`];
    if (typeof v === 'string' && v.length) return v;
  } catch {}
  return fallback;
}

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}


export default { runBigMoodDetector };
