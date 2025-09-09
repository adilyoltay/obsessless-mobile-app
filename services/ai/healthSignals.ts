// HealthKit özellik çıkarım iskeleti
// Not: Gerçek HealthKit okuma entegrasyonu @kingstinct/react-native-healthkit ile yapılacaktır.

export type DailyHealthFeatures = {
  dateYmdLocal: string;         // YYYY-MM-DD
  // Kalp / HRV
  hr_rest?: number;             // dinlenik nabız
  hr_mean?: number;             // günlük ortalama nabız
  hr_var?: number;              // günlük varyans
  hrv_sdnn_median?: number;     // SDNN median (ms)
  hrv_rmssd?: number;           // RMSSD (ms)
  // Aktivite
  steps?: number;               // adım
  active_energy?: number;       // kcal
  stand_hours?: number;         // saat
  // Uyku
  sleep_duration_min?: number;  // dakika
  sleep_efficiency?: number;    // 0..1
  deep_sleep_ratio?: number;    // 0..1
  // VO2Max, opsiyonel
  vo2max?: number;
  // Kalite metriği
  quality_score?: number;       // 0..1 (sinyal kalitesi/coverage)
  feature_version: string;      // 'v1' (versiyonlama)
  // İsteğe bağlı genişletmeler
  extras?: Record<string, number | string | boolean | null>;
};

function toDateRangeLocal(ymd: string): { start: Date; end: Date } {
  const start = new Date(ymd + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export const healthSignals = {
  async ensurePermissions(): Promise<boolean> {
    try {
      // Dynamic import to avoid bundling issues if module not installed in non-iOS envs
      const HK: any = require('@kingstinct/react-native-healthkit');
      const Q = HK.HKQuantityTypeIdentifier || {};
      const C = HK.HKCategoryTypeIdentifier || {};
      const readTypes = [
        Q.restingHeartRate || 'restingHeartRate',
        Q.heartRate || 'heartRate',
        Q.heartRateVariabilitySDNN || 'heartRateVariabilitySDNN',
        Q.stepCount || 'stepCount',
        Q.activeEnergyBurned || 'activeEnergyBurned',
        Q.vo2Max || 'vo2Max',
        C.sleepAnalysis || 'sleepAnalysis',
      ];
      const writeTypes: any[] = [];
      // Some versions accept an options object, some accept positional arrays
      if (typeof HK.requestAuthorization === 'function') {
        try {
          const ok = await HK.requestAuthorization({ read: readTypes, write: writeTypes });
          return !!ok;
        } catch (e) {
          try {
            const ok2 = await HK.requestAuthorization(readTypes, writeTypes);
            return !!ok2;
          } catch {
            // Fall through
          }
        }
      }
      // If module exists but authorization flow fails, allow soft‑fallback
      return true;
    } catch (e) {
      console.warn('HealthKit ensurePermissions failed (soft fallback to true):', e);
      // Allow the pipeline to continue with zeros/skeletons
      return true;
    }
  },

  async getDailyFeatures(dateYmdLocal: string): Promise<DailyHealthFeatures> {
    const base: DailyHealthFeatures = {
      dateYmdLocal,
      feature_version: 'v1',
      quality_score: undefined,
      extras: {}
    };
    try {
      const HK: any = require('@kingstinct/react-native-healthkit');
      const Q = HK.HKQuantityTypeIdentifier || {};
      const C = HK.HKCategoryTypeIdentifier || {};
      const { start, end } = toDateRangeLocal(dateYmdLocal);

      async function readQuantity(identifier: any, unit?: string): Promise<Array<{ value: number; startDate: string; endDate: string }>> {
        try {
          if (HK.queryQuantitySamples) {
            const res = await HK.queryQuantitySamples({ type: identifier, unit: unit || 'count', startDate: start.toISOString(), endDate: end.toISOString() });
            return Array.isArray(res) ? res : [];
          }
          if (HK.getQuantitySamples) {
            const res = await HK.getQuantitySamples({ type: identifier, unit: unit || 'count', startDate: start, endDate: end });
            return Array.isArray(res) ? res : [];
          }
        } catch (e) {
          console.warn('readQuantity failed for', identifier, e);
        }
        return [];
      }

      async function readCategory(identifier: any): Promise<Array<{ value?: number; startDate: string; endDate: string }>> {
        try {
          if (HK.queryCategorySamples) {
            const res = await HK.queryCategorySamples({ type: identifier, startDate: start.toISOString(), endDate: end.toISOString() });
            return Array.isArray(res) ? res : [];
          }
          if (HK.getCategorySamples) {
            const res = await HK.getCategorySamples({ type: identifier, startDate: start, endDate: end });
            return Array.isArray(res) ? res : [];
          }
        } catch (e) {
          console.warn('readCategory failed for', identifier, e);
        }
        return [];
      }

      const hrSamples = await readQuantity(Q.heartRate || 'heartRate', 'count/min');
      const rhrSamples = await readQuantity(Q.restingHeartRate || 'restingHeartRate', 'count/min');
      const hrvSamples = await readQuantity(Q.heartRateVariabilitySDNN || 'heartRateVariabilitySDNN', 'ms');
      const stepSamples = await readQuantity(Q.stepCount || 'stepCount', 'count');
      const energySamples = await readQuantity(Q.activeEnergyBurned || 'activeEnergyBurned', 'kcal');
      const vo2Samples = await readQuantity(Q.vo2Max || 'vo2Max', 'ml/(kg*min)');
      const sleepSamples = await readCategory(C.sleepAnalysis || 'sleepAnalysis');
      // Stand hours (Apple Watch)
      let standSamples: any[] = [];
      try {
        standSamples = await readCategory(C.appleStandHour || 'appleStandHour');
      } catch {}

      const arr = (xs: number[]) => xs.filter(n => Number.isFinite(n));
      const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
      const variance = (xs: number[], m?: number) => {
        if (!xs.length) return 0;
        const mu = (typeof m === 'number') ? m : mean(xs);
        return xs.reduce((s, v) => s + Math.pow(v - mu, 2), 0) / xs.length;
      };
      const median = (xs: number[]) => {
        if (!xs.length) return 0;
        const a = [...xs].sort((a,b)=>a-b);
        const mid = Math.floor(a.length/2);
        return a.length % 2 ? a[mid] : (a[mid-1] + a[mid]) / 2;
      };

      const hrVals = arr(hrSamples.map((s: any) => Number(s.value)));
      const rhrVals = arr(rhrSamples.map((s: any) => Number(s.value)));
      const hrvVals = arr(hrvSamples.map((s: any) => Number(s.value)));
      const steps = arr(stepSamples.map((s: any) => Number(s.value))).reduce((s, v) => s + v, 0);
      const active_energy = arr(energySamples.map((s: any) => Number(s.value))).reduce((s, v) => s + v, 0);
      const vo2Arr = arr(vo2Samples.map((s: any) => Number(s.value)));

      // Sleep metrics (minutes) — refined mapping (awake/asleep/core/deep/rem)
      let sleep_duration_min = 0; // asleep total
      let inBed_min = 0;          // inBed total
      let asleep_min = 0;         // asleep (unspecified + core + deep + rem)
      let deep_min = 0;           // deep
      let core_min = 0;           // core/light
      let rem_min = 0;            // rem
      try {
        for (const it of sleepSamples) {
          const sd = new Date(it.startDate).getTime();
          const ed = new Date(it.endDate).getTime();
          const durMin = Math.max(0, (ed - sd) / 60000);
          // kingstinct plugin sometimes provides numeric or string category
          const raw: any = (it.value != null ? it.value : (it.categoryValue ?? it.category ?? it.type));
          const vs = (typeof raw === 'string' ? String(raw).toLowerCase() : '');
          const vn = (typeof raw === 'number' ? Number(raw) : NaN);
          // Apple HKCategoryValueSleepAnalysis (iOS16+):
          // 0: inBed, 1: asleepUnspecified, 2: awake, 3: asleepCore, 4: asleepDeep, 5: asleepREM
          const isInBed   = (vs.includes('inbed')) || (vn === 0);
          const isAwake   = (vs.includes('awake')) || (vn === 2);
          const isCore    = (vs.includes('core'))  || (vn === 3);
          const isDeep    = (vs.includes('deep'))  || (vn === 4);
          const isRem     = (vs.includes('rem'))   || (vn === 5);
          const isAsleepU = (vs.includes('asleep') && !(isCore||isDeep||isRem)) || (vn === 1);

          if (isInBed) inBed_min += durMin;
          if (!isAwake) {
            if (isDeep) { deep_min += durMin; asleep_min += durMin; }
            else if (isCore) { core_min += durMin; asleep_min += durMin; }
            else if (isRem) { rem_min += durMin; asleep_min += durMin; }
            else if (isAsleepU) { asleep_min += durMin; }
          }
        }
        // Fallback: if we couldn't split, approximate with total duration
        if (asleep_min === 0 && inBed_min === 0) {
          const total = sleepSamples.reduce((s: number, it: any) => {
            const sd = new Date(it.startDate).getTime();
            const ed = new Date(it.endDate).getTime();
            const durMin = Math.max(0, (ed - sd) / 60000);
            return s + durMin;
          }, 0);
          asleep_min = total;
          inBed_min = total;
        }
        sleep_duration_min = asleep_min || 0;
      } catch {}

      const hr_mean = hrVals.length ? mean(hrVals) : 0;
      const hr_var = hrVals.length ? variance(hrVals, hr_mean) : 0;
      const hr_rest = rhrVals.length ? median(rhrVals) : (hrVals.length ? Math.min(...hrVals) : undefined);
      const hrv_sdnn_median = hrvVals.length ? median(hrvVals) : undefined;

      const features: DailyHealthFeatures = {
        dateYmdLocal,
        hr_rest,
        hr_mean,
        hr_var,
        hrv_sdnn_median,
        // hrv_rmssd: Apple Health SDNN saglar; RMSSD yoksa bos kalsin
        hrv_rmssd: undefined,
        steps,
        active_energy,
        stand_hours: Array.isArray(standSamples) ? Math.max(0, standSamples.length) : undefined,
        sleep_duration_min,
        sleep_efficiency: (inBed_min > 0 ? Math.max(0, Math.min(1, asleep_min / inBed_min)) : undefined),
        deep_sleep_ratio: (asleep_min > 0 ? Math.max(0, Math.min(1, deep_min / asleep_min)) : undefined),
        vo2max: vo2Arr.length ? mean(vo2Arr) : undefined,
        feature_version: 'v1',
        quality_score: undefined,
        extras: { core_min, rem_min }
      };

      // quality_score (basit): mevcut alan sayisi / beklenen
      const keys = ['hr_rest','hr_mean','hrv_sdnn_median','steps','active_energy','sleep_duration_min','sleep_efficiency'];
      const present = keys.reduce((n,k)=> n + (typeof (features as any)[k] === 'number' ? 1 : 0), 0);
      features.quality_score = present / keys.length;
      return features;
    } catch (e) {
      console.warn('HealthKit getDailyFeatures failed, returning base skeleton:', e);
      return base;
    }
  }
};

/**
 * 7 Günlük (dakika çözünürlüğünde) aktivite vektörü (10080 uzunluk)
 * Kaynaklar: stepCount + activeEnergyBurned (varsa). Dakika başına dağıtım yapılır.
 */
export async function get7DayMinuteActivityWindow(endDate: Date = new Date()): Promise<number[]> {
  try {
    const HK: any = require('@kingstinct/react-native-healthkit');
    const Q = HK.HKQuantityTypeIdentifier || {};
    const end = new Date(endDate);
    const start = new Date(end.getTime() - (7 * 24 * 60 * 60 * 1000));
    const bins = new Float32Array(7 * 24 * 60); // 10080

    async function readQuantity(identifier: any, unit?: string): Promise<Array<{ value: number; startDate: string; endDate: string }>> {
      try {
        if (HK.queryQuantitySamples) {
          const res = await HK.queryQuantitySamples({ type: identifier, unit: unit || 'count', startDate: start.toISOString(), endDate: end.toISOString() });
          return Array.isArray(res) ? res : [];
        }
        if (HK.getQuantitySamples) {
          const res = await HK.getQuantitySamples({ type: identifier, unit: unit || 'count', startDate: start, endDate: end });
          return Array.isArray(res) ? res : [];
        }
      } catch (e) { console.warn('get7DayMinuteActivityWindow.readQuantity failed', identifier, e); }
      return [];
    }

    const stepSamples = await readQuantity(Q.stepCount || 'stepCount', 'count');
    const energySamples = await readQuantity(Q.activeEnergyBurned || 'activeEnergyBurned', 'kcal');

    const rangeStartMs = start.getTime();
    const toIdx = (tms: number) => Math.max(0, Math.min(bins.length - 1, Math.floor((tms - rangeStartMs) / 60000)));

    // Distribute step counts uniformly across covered minutes
    for (const s of stepSamples) {
      const sv = Number(s.value || 0);
      const ss = new Date(s.startDate).getTime();
      const se = new Date(s.endDate).getTime();
      if (!isFinite(sv) || !isFinite(ss) || !isFinite(se) || se <= ss) continue;
      const i0 = toIdx(ss);
      const i1 = toIdx(se - 1);
      const m = Math.max(1, i1 - i0 + 1);
      const perMin = sv / m;
      for (let i = i0; i <= i1; i++) bins[i] += perMin; // steps per minute
    }

    // Add energy signal (kcal) as an additional activity component
    for (const s of energySamples) {
      const ev = Number(s.value || 0);
      const ss = new Date(s.startDate).getTime();
      const se = new Date(s.endDate).getTime();
      if (!isFinite(ev) || !isFinite(ss) || !isFinite(se) || se <= ss) continue;
      const i0 = toIdx(ss);
      const i1 = toIdx(se - 1);
      const m = Math.max(1, i1 - i0 + 1);
      const perMin = ev / m; // kcal/min
      for (let i = i0; i <= i1; i++) bins[i] += perMin * 0.2; // scale energy contribution
    }

    // Normalize bins (simple) → clip to [0,1] using heuristic caps
    const out = Array.from(bins).map((v) => {
      const stepsEquiv = v; // already combined
      // cap: 150 steps/min ~ sprint, map to 1.0
      const x = Math.max(0, Math.min(1, stepsEquiv / 150));
      return x;
    });
    return out;
  } catch (e) {
    console.warn('get7DayMinuteActivityWindow failed, returning zeros:', e);
    return new Array(7 * 24 * 60).fill(0);
  }
}

export default healthSignals;
