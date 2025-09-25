import healthSignals, { getRecentHeartSignal } from './healthSignals';
import { setLastInferenceMeta } from './inferenceMetaStore';

export type HeartPyInput = { signal: number[]; sampling_rate: number };
export type HeartPyMEA = { mood: number; energy: number; anxiety: number; confidence?: number };

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

export async function runHeartPy(input: HeartPyInput): Promise<HeartPyMEA> {
  const { signal, sampling_rate } = input || {} as any;
  const s = Array.isArray(signal) ? signal.filter(n => Number.isFinite(n)) : [];
  const fs = Number(sampling_rate || 1);
  if (!s.length || !Number.isFinite(fs) || fs <= 0) {
    return { mood: 50, energy: 6, anxiety: 5, confidence: 0.4 };
  }
  // Simple heuristics placeholder: high HR → higher anxiety, low HRV proxy → lower mood
  const mean = (xs: number[]) => (xs.reduce((a,b)=>a+b,0) / xs.length);
  const m = mean(s);
  // Very rough: energy around normalized HR
  const energy = clamp(Math.round(3 + (m / 20)), 1, 10);
  const anxiety = clamp(Math.round(6 + (m - 70) / 15), 1, 10);
  const mood = clamp(Math.round(60 - (anxiety - 5) * 4), 0, 100);
  return { mood, energy, anxiety, confidence: 0.5 };
}

export async function runOnRecentSignal(seconds: number = 120): Promise<HeartPyMEA | null> {
  try {
    await healthSignals.ensurePermissions().catch(()=>{});
    const rec = await getRecentHeartSignal(seconds);
    if (!rec || !Array.isArray(rec.signal) || !rec.signal.length) return null;
    const t0 = Date.now();
    const out = await runHeartPy({ signal: rec.signal, sampling_rate: rec.sampling_rate });
    setLastInferenceMeta({ source: 'heartpy', model: 'heartpy-device', response_format: 'mea', elapsed_ms: Date.now() - t0, timestamp: new Date().toISOString() });
    return out;
  } catch (e) {
    console.warn('runOnRecentSignal failed:', e);
    return null;
  }
}

export { healthSignals };

