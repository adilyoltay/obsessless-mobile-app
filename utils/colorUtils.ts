// Color utilities shared across screens

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const mixHex = (a: string, b: string, t: number) => {
  t = clamp01(t);
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ra = (A >> 16) & 255, ga = (A >> 8) & 255, ba = A & 255;
  const rb = (B >> 16) & 255, gb = (B >> 8) & 255, bb = B & 255;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(m(ra, rb))}${hx(m(ga, gb))}${hx(m(ba, bb))}`;
};

export const lighten = (hex: string, amt: number) => mixHex(hex, '#ffffff', clamp01(amt));
export const darken = (hex: string, amt: number) => mixHex(hex, '#000000', clamp01(amt));

// Mood spectrum mapping (0-100)
export const getAdvancedMoodColor = (score: number): string => {
  if (score >= 90) return '#C2185B'; // Heyecanlı
  if (score >= 80) return '#7E57C2'; // Enerjik
  if (score >= 70) return '#4CAF50'; // Mutlu
  if (score >= 60) return '#26A69A'; // Sakin
  if (score >= 50) return '#66BB6A'; // Normal
  if (score >= 40) return '#FFA726'; // Endişeli
  if (score >= 30) return '#FF7043'; // Sinirli
  if (score >= 20) return '#5C6BC0'; // Üzgün
  return '#F06292'; // Kızgın
};

// Generate a subtle gradient pair from base mood color
export const getMoodGradient = (score: number, intensity: number = 0.1): [string, string] => {
  const base = getAdvancedMoodColor(score || 55);
  // Softer contrast: shift from medium → low depth by default
  const ii = Math.min(0.12, Math.max(0.03, intensity));
  const lightAmt = Math.max(0.05, ii - 0.02); // e.g., 0.08 when intensity=0.1
  const darkAmt = Math.max(0.04, ii - 0.04); // e.g., 0.06 when intensity=0.1
  const start = lighten(base, lightAmt);
  const end = darken(base, darkAmt);
  return [start, end];
};

// ---- VA Pad aligned color mapping ----
// Mirrors the VA Pad's interactive palette so the rest of the app can match it.

// VA anchor colors (duplicated here for shared usage)
const C_NEG_LOW = '#64748b';  // sad-calm
const C_POS_LOW = '#22d3ee';  // calm-positive
const C_NEG_HIGH = '#ef4444'; // anxiety/anger
const C_POS_HIGH = '#22c55e'; // excited-positive
const C_NEUTRAL = '#60a5fa';  // center

export type VA = { x: number; y: number };

// Service-compatible coordinate mapping helpers
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const toCoordServiceLike = (v: number) => clamp((v - 5.5) / 4.5, -1, 1); // 1..10 -> -1..1

// Compute VA Pad base color from coordinates (-1..1)
export const getVAColor = (x: number, y: number): string => {
  const u = (x + 1) / 2;
  const v = (y + 1) / 2;
  const bottom = mixHex(C_NEG_LOW, C_POS_LOW, u);
  const top = mixHex(C_NEG_HIGH, C_POS_HIGH, u);
  let base = mixHex(bottom, top, v);
  const d = Math.sqrt(x * x + y * y) / Math.SQRT2;
  const clampedD = Math.max(0, Math.min(1, d));
  const wCenter = Math.pow(1 - clampedD, 1.4) * 0.45;
  base = mixHex(base, C_NEUTRAL, wCenter);
  return lighten(base, v * 0.15);
};

// Get VA Pad color from mood score (0..100) and optional energy (1..10)
export const getVAColorFromScores = (moodScore: number, energyLevel?: number): string => {
  const m10 = clamp(Math.round((moodScore || 55) / 10), 1, 10);
  const e10 = typeof energyLevel === 'number' && energyLevel > 0 ? energyLevel : 6; // ~neutral-high by default
  const x = toCoordServiceLike(m10);
  const y = toCoordServiceLike(e10);
  return getVAColor(x, y);
};

// Build a gradient from a base color (same tuning as getMoodGradient)
export const getGradientFromBase = (base: string, intensity: number = 0.1): [string, string] => {
  const ii = Math.min(0.12, Math.max(0.03, intensity));
  const lightAmt = Math.max(0.05, ii - 0.02);
  const darkAmt = Math.max(0.04, ii - 0.04);
  return [lighten(base, lightAmt), darken(base, darkAmt)];
};

// Convenient gradient generator using score + optional energy
export const getVAGradientFromScores = (moodScore: number, energyLevel?: number, intensity: number = 0.1): [string, string] => {
  const base = getVAColorFromScores(moodScore, energyLevel);
  return getGradientFromBase(base, intensity);
};
