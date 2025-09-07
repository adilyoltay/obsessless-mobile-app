export type Trend = 'up' | 'down' | 'stable';

/**
 * Compute trend from a series of p50 (median) values.
 * - Ignores NaN/undefined values
 * - Uses first and last valid values
 * - Returns 'up' | 'down' when absolute delta >= threshold, otherwise 'stable'
 */
export function getTrendFromP50(series: Array<number | null | undefined>, threshold: number = 10): Trend {
  if (!Array.isArray(series) || series.length === 0) return 'stable';
  const vals = series
    .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN))
    .filter((v) => Number.isFinite(v));
  if (vals.length < 2) return 'stable';
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  const diff = last - first;
  if (Math.abs(diff) >= Math.max(0, threshold)) {
    return diff > 0 ? 'up' : 'down';
  }
  return 'stable';
}

