import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureDataService } from '@/services/encryption/secureDataService';
import type { AIPrediction } from '@/types/ai';

const KEY = (userId: string, ymd: string) => `ai_pred_${userId}_${ymd}`;

export const predictionRepository = {
  async upsertDaily(userId: string, ymd: string, preds: AIPrediction[]): Promise<void> {
    const enc = await secureDataService.encryptSensitiveData({ preds });
    await AsyncStorage.setItem(KEY(userId, ymd), JSON.stringify({ enc, v: 1 }));
  },

  async getRange(userId: string, ymds: string[]): Promise<Record<string, AIPrediction[]>> {
    const out: Record<string, AIPrediction[]> = {};
    for (const ymd of ymds) {
      const raw = await AsyncStorage.getItem(KEY(userId, ymd));
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        const dec = await secureDataService.decryptSensitiveData(obj.enc);
        out[ymd] = (dec?.preds || []) as AIPrediction[];
      } catch {
        // ignore corrupt day
      }
    }
    return out;
  }
};

export default predictionRepository;

