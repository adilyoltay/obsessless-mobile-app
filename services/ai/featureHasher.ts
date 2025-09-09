// Basit, deterministik (non-crypto) 32-bit hash
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function normalizeFeatureVector(vec: Array<number | null | undefined>): number[] {
  return vec.map((v) => {
    const n = Number(v);
    if (!isFinite(n)) return 0;
    if (n < 0) return 0;
    return n;
  });
}

export function buildFeatureVector(features: Record<string, any>): number[] {
  const get = (k: string) => (typeof features[k] === 'number' ? features[k] : undefined);
  const v = [
    get('hr_rest'),
    get('hr_mean'),
    get('hr_var'),
    get('hrv_sdnn_median'),
    get('hrv_rmssd'),
    get('steps'),
    get('active_energy'),
    get('stand_hours'),
    get('sleep_duration_min'),
    get('sleep_efficiency'),
    get('deep_sleep_ratio'),
    get('vo2max'),
  ];
  return normalizeFeatureVector(v);
}

export function computeFeaturesHash(features: Record<string, any>, meta?: { feature_version?: string; dateYmdLocal?: string }): string {
  const ordered = buildFeatureVector(features);
  const payload = {
    v: meta?.feature_version || 'v1',
    d: meta?.dateYmdLocal || '',
    x: ordered
  };
  return `fh_${simpleHash(JSON.stringify(payload))}`;
}

export default { buildFeatureVector, normalizeFeatureVector, computeFeaturesHash };

