export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * Normalize numeric input to 0–100 range.
 * - Accepts null/undefined → null
 * - 1–10 scale auto-scales to 0–100
 * - Clamps out-of-range values
 */
export const to0100 = (v: number | null | undefined): number | null => {
  if (v == null || !Number.isFinite(v as any)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n > 1000) return null; // guard against double-scaling
  if (n > 0 && n <= 10) return clamp(n * 10, 0, 100);
  return clamp(n, 0, 100);
};

/**
 * Weighted mind score in 0–100.
 * - mood: 50%
 * - energy: 30%
 * - anxiety: 20% (inverse → 100 - anxiety)
 * Nuance: If anxiety is exactly fallback-neutral (50 after scaling), exclude from weighting.
 */
export const weightedScore = (mood?: number | null, energy?: number | null, anxiety?: number | null): number | null => {
  const parts: Array<[number, number]> = [];
  const m = to0100(mood);
  const e = to0100(energy);
  const a = to0100(anxiety);
  if (typeof m === 'number') parts.push([m, 0.5]);
  if (typeof e === 'number') parts.push([e, 0.3]);
  // Exclude anxiety when center-neutral (fallback=5 → 50)
  if (typeof a === 'number' && a !== 50) parts.push([100 - a, 0.2]);
  if (!parts.length) return null;
  const wsum = parts.reduce((s, [, w]) => s + w, 0);
  const score = parts.reduce((s, [v, w]) => s + v * w, 0) / (wsum || 1);
  return clamp(score, 0, 100);
};

