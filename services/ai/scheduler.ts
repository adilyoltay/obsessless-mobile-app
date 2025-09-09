import { queueDailyPrediction } from '@/services/ai/inferenceService';
import healthSignals from '@/services/ai/healthSignals';
import modelRunner from '@/services/ai/modelRunner';

let timer: any = null;

export async function runDailyOnce(userId: string, dateYmdLocal: string): Promise<boolean> {
  try {
    const ok = await healthSignals.ensurePermissions();
    if (!ok) return false;
    const feats = await healthSignals.getDailyFeatures(dateYmdLocal);
    const out = await modelRunner.runBigMoodDetector(feats as any);
    await queueDailyPrediction({
      user_id: userId,
      dateYmdLocal,
      mood_score_pred: out.mood_score_pred,
      energy_level_pred: out.energy_level_pred,
      anxiety_level_pred: out.anxiety_level_pred,
      depression_risk: out.depression_risk,
      bipolar_risk: out.bipolar_risk,
      confidence: out.confidence,
      model_name: 'big-mood-detector',
      model_version: 'v1',
      features: feats as any,
    });
    return true;
  } catch (e) {
    return false;
  }
}

export function startDailyScheduler(userId: string, getLocalYmd: () => string): void {
  stopDailyScheduler();
  // Basit: her 6 saatte bir calistir (iOS Background Refresh baglami disinda)
  timer = setInterval(() => {
    try {
      const ymd = getLocalYmd();
      runDailyOnce(userId, ymd);
    } catch {}
  }, 6 * 60 * 60 * 1000);
}

export function stopDailyScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export default { startDailyScheduler, stopDailyScheduler, runDailyOnce };
