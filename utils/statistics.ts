export type IQR = { p25: number; p50: number; p75: number };

export const quantiles = (arr: number[]): IQR => {
  const vals = (arr || []).map(Number).filter((n) => Number.isFinite(n));
  if (vals.length === 0) return { p25: NaN, p50: NaN, p75: NaN };
  const a = Float64Array.from(vals).sort();
  const q = (p: number) => {
    const idx = (a.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return a[lo];
    const t = idx - lo;
    return a[lo] * (1 - t) + a[hi] * t;
  };
  return { p25: q(0.25), p50: q(0.5), p75: q(0.75) };
};

export const recencyAlpha = (ts: number, minTs: number, maxTs: number) => {
  if (maxTs === minTs) return 1;
  const t = (ts - minTs) / (maxTs - minTs);
  return 0.5 + 0.5 * Math.max(0, Math.min(1, t));
};

export const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

export const jitterXY = (seedKey: string, xMaxPx = 12, yMaxPx = 2.2) => {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rnd = lcg(h >>> 0);
  return { jx: (rnd() - 0.5) * 2 * xMaxPx, jy: (rnd() - 0.5) * 2 * yMaxPx };
};

export const energyToColor = (e: number, alpha: number = 1, isDark: boolean = false) => {
  // e raw: often 1..10; normalize to 0..100
  const raw = typeof e === 'number' && e <= 10 ? e * 10 : e;
  const val = Number.isFinite(raw) ? (raw as number) : 60; // fallback mid
  const clamped = Math.max(0, Math.min(100, val));
  const hue = 200 - (180 * clamped) / 100; // 200° (low) → 20° (high)
  const lightness = isDark ? 58 : 46; // a11y contrast tuning
  const h = Number.isFinite(hue) ? Math.round(hue) : 200;
  return `hsla(${h}, 65%, ${lightness}%, ${alpha})`;
};

// Derive anxiety series when all values are default 5's (fallback) and we have meaningful mood/energy
// Returns:
// - if rawAnx empty → [5]
// - if all fives and moods/energies provided → array filled with derived value (same length as rawAnx or 1 when empty)
// - else → rawAnx
export const deriveAnxietySeries = (moods: number[], energies: number[], rawAnx: number[]): number[] => {
  const anx = (rawAnx || []).filter(v => Number.isFinite(v));
  if (anx.length === 0) return [5];
  const allFives = anx.every(v => v === 5);
  if (allFives && (moods?.length || 0) > 0 && (energies?.length || 0) > 0) {
    const avgMood = moods.reduce((s, v) => s + v, 0) / moods.length;
    const avgEnergy = energies.reduce((s, v) => s + v, 0) / energies.length;
    const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10)));
    const e10 = Math.max(1, Math.min(10, Math.round(avgEnergy)));
    let derived = 5;
    if (m10 <= 3) derived = 7;
    else if (m10 >= 8 && e10 <= 4) derived = 6;
    else if (m10 <= 5 && e10 >= 7) derived = 8;
    else if (m10 >= 7 && e10 >= 7) derived = 4;
    else derived = Math.max(2, Math.min(8, 6 - (m10 - 5)));
    return new Array(anx.length).fill(derived);
  }
  return anx;
};
