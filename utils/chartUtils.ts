import { getVAColorFromScores, getGradientFromBase, lighten } from '@/utils/colorUtils';

export const normalizeValence = (moodScore: number): number => {
  // Map 0..100 -> -1..1 (center at 50)
  const s = Math.max(0, Math.min(100, Number(moodScore || 50)));
  return (s - 50) / 50;
};

export const getEnergyGradient = (energy: number): [string, string] => {
  // Use a neutral mood score 55 with provided energy to derive base
  const base = getVAColorFromScores(55, energy);
  return getGradientFromBase(base, 0.1);
};

export const getVAColor = (moodScore: number, energyLevel?: number): string => {
  return getVAColorFromScores(moodScore, energyLevel);
};

export const getConfidenceOpacity = (confidence?: number): number => {
  if (typeof confidence !== 'number') return 0.7;
  const c = Math.max(0, Math.min(1, confidence));
  return 0.3 + 0.7 * c;
};

export const calculateAverage = <T extends object>(items: T[], key: keyof T): number => {
  if (!items || items.length === 0) return 0;
  const valid = items.map((i) => Number(i[key] as any)).filter((n) => Number.isFinite(n));
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((s, n) => s + n, 0) / valid.length) * 10) / 10;
};

export const hourFromTimestamp = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours();
};

export const formatDateYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

