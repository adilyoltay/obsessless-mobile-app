import type { IQR } from '@/types/mood';

export const formatIQRText = (q?: Partial<IQR> | null): string => {
  if (!q) return '— (IQR —–—)';
  const n = (v: any) => (Number.isFinite(v) ? Math.round((v as number) * 10) / 10 : '—');
  const p25 = n((q as any).p25);
  const p50 = n((q as any).p50);
  const p75 = n((q as any).p75);
  return `${p50} (IQR ${p25}–${p75})`;
};
