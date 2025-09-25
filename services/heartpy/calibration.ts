import AsyncStorage from '@react-native-async-storage/async-storage';

export type MEA = { mood: number; energy: number; anxiety: number };

const keyOf = (userId: string) => `ai_bias_${userId}`;

export const calibrationService = {
  async getBias(userId: string): Promise<MEA> {
    try {
      const raw = await AsyncStorage.getItem(keyOf(userId));
      if (!raw) return { mood: 0, energy: 0, anxiety: 0 };
      const parsed = JSON.parse(raw);
      const core = parsed && typeof parsed === 'object' ? parsed : {};
      const m = Number(core?.mood) || 0;
      const e = Number(core?.energy) || 0;
      const a = Number(core?.anxiety) || 0;
      return { mood: m, energy: e, anxiety: a };
    } catch {
      return { mood: 0, energy: 0, anxiety: 0 };
    }
  },

  async getBiasMeta(userId: string): Promise<{ bias: MEA; lastDelta?: MEA; updatedAt?: string }> {
    try {
      const raw = await AsyncStorage.getItem(keyOf(userId));
      if (!raw) return { bias: { mood: 0, energy: 0, anxiety: 0 } };
      const parsed = JSON.parse(raw) || {};
      const bias = {
        mood: Number(parsed?.mood) || 0,
        energy: Number(parsed?.energy) || 0,
        anxiety: Number(parsed?.anxiety) || 0,
      };
      const lastDelta = parsed?.lastDelta ? {
        mood: Number(parsed.lastDelta.mood) || 0,
        energy: Number(parsed.lastDelta.energy) || 0,
        anxiety: Number(parsed.lastDelta.anxiety) || 0,
      } : undefined;
      const updatedAt = typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : undefined;
      return { bias, lastDelta, updatedAt };
    } catch {
      return { bias: { mood: 0, energy: 0, anxiety: 0 } };
    }
  },

  async applyBias(userId: string, mea: MEA, weight: number = 1.0): Promise<MEA> {
    const bias = await this.getBias(userId);
    const w = Math.max(0, Math.min(1, weight));
    const mood = clamp(Math.round(mea.mood + bias.mood * w), 0, 100);
    const energy = clamp(Math.round(mea.energy + bias.energy * w), 1, 10);
    const anxiety = clamp(Math.round(mea.anxiety + bias.anxiety * w), 1, 10);
    return { mood, energy, anxiety };
  },

  async updateBias(userId: string, delta: MEA, alpha: number = 0.2): Promise<void> {
    try {
      const meta = await this.getBiasMeta(userId);
      const prev = meta.bias;
      const a = Math.max(0, Math.min(1, alpha));
      const next = {
        mood: round2(prev.mood * (1 - a) + delta.mood * a),
        energy: round2(prev.energy * (1 - a) + delta.energy * a),
        anxiety: round2(prev.anxiety * (1 - a) + delta.anxiety * a),
        lastDelta: { mood: round2(delta.mood), energy: round2(delta.energy), anxiety: round2(delta.anxiety) },
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(keyOf(userId), JSON.stringify(next));
    } catch {}
  },
};

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function round2(n: number) { return Math.round(n * 100) / 100; }

export default calibrationService;

