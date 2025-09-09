import type { DailyHealthFeatures } from '@/services/ai/healthSignals';

/**
 * ProductionScalerService
 * - NHANES scaler stats (mean/std) ile 10,080 uzunluklu aktivite penceresini z-score normalize eder
 * - PAT-Conv-L model çıktısını (5 sınıf) MEA skorlarına (mood/energy/anxiety) map eder
 */
class ProductionScalerService {
  private static instance: ProductionScalerService;
  private scalerLoaded = false;
  private mean: number[] | null = null;
  private std: number[] | null = null;

  static getInstance(): ProductionScalerService {
    if (!ProductionScalerService.instance) {
      ProductionScalerService.instance = new ProductionScalerService();
    }
    return ProductionScalerService.instance;
  }

  /**
   * Scaler/metrik durumu (debug icin): yuklu mu, uzunluklar vb.
   */
  getMeta(): { scalerLoaded: boolean; hasScaler: boolean; meanLength: number | null; stdLength: number | null } {
    this.loadScalerSafe();
    const meanLength = Array.isArray(this.mean) ? this.mean.length : null;
    const stdLength = Array.isArray(this.std) ? this.std.length : null;
    return {
      scalerLoaded: !!this.scalerLoaded,
      hasScaler: !!(meanLength && stdLength && meanLength === stdLength),
      meanLength,
      stdLength,
    };
  }

  /**
   * NHANES scaler dosyasını (mean/std) assets içinden yükler.
   */
   private loadScalerSafe(): void {
     if (this.scalerLoaded) return;
     try {
       // Path relative to services/ai
       const stats = require('../../assets/models/big_mood_detector/nhanes_scaler_stats.ts').default;
       const mean = Array.isArray(stats?.mean) ? stats.mean : null;
       const std = Array.isArray(stats?.std) ? stats.std : null;
       if (mean && std && mean.length === std.length) {
         this.mean = mean.map((x: any) => Number(x));
         this.std = std.map((x: any) => Number(x));
         console.log('📊 NHANES Scaler Stats yüklendi:', mean.length, 'değer');
       }
       this.scalerLoaded = true;
     } catch (error) {
       console.warn('⚠️ Scaler stats yüklenemedi:', error);
       // Missing scaler file — continue without
       this.scalerLoaded = true;
       this.mean = null;
       this.std = null;
     }
   }

  /**
   * Apple Health özelliklerinden 7 günlük (10080) aktivite vektörü üretir ve
   * NHANES scaler ile z-score uygular. Eğer scaler yok ya da uzunluk eşleşmezse ham vektörü döner.
   */
  async normalizeHealthData(features: DailyHealthFeatures | any): Promise<number[]> {
    this.loadScalerSafe();
    const { get7DayMinuteActivityWindow } = require('@/services/ai/healthSignals');
    const vec: number[] = await get7DayMinuteActivityWindow(new Date());
    if (!Array.isArray(vec) || vec.length !== 7 * 24 * 60) return new Array(7 * 24 * 60).fill(0);
    if (!this.mean || !this.std || this.mean.length !== vec.length || this.std.length !== vec.length) {
      return vec; // fallback: already [0,1]
    }
    const out = new Array<number>(vec.length);
    for (let i = 0; i < vec.length; i++) {
      const mu = this.mean[i];
      const sd = this.std[i] || 1;
      out[i] = (Number(vec[i]) - Number(mu)) / Number(sd);
    }
    return out;
  }

  /**
   * Model çıktısı (5 sınıf) → MEA map + confidence
   * Sınıf sırası: [normal, depressive, stressed, anxious, happy]
   */
  mapModelOutputToMEA(raw: number[]): { mood: number; energy: number; anxiety: number; confidence: number } {
    const logits = (raw || []).map((x) => Number(x)).slice(0, 5);
    if (logits.length < 5) return { mood: 50, energy: 6, anxiety: 5, confidence: 0 };
    const probs = this.toProbabilities(logits);
    let maxP = -Infinity, maxIdx = 0;
    for (let i = 0; i < probs.length; i++) { if (probs[i] > maxP) { maxP = probs[i]; maxIdx = i; } }
    const mapped = this.classToMEA(maxIdx);
    return { ...mapped, confidence: Math.max(0, Math.min(1, maxP)) };
  }

  private toProbabilities(arr: number[]): number[] {
    const sum = arr.reduce((s, v) => s + v, 0);
    const looksLikeProb = sum > 0.98 && sum < 1.02 && arr.every((v) => v >= 0 && v <= 1);
    if (looksLikeProb) return arr;
    const m = Math.max(...arr);
    const exps = arr.map((x) => Math.exp(x - m));
    const z = exps.reduce((s, v) => s + v, 0) || 1;
    return exps.map((v) => v / z);
  }

  /**
   * Güncellenmiş MEA mapping (kullanıcı gereksinimine göre):
   * 0: Normal → mood 60, energy 7, anxiety 3
   * 1: Depresif → mood 20, energy 3, anxiety 8
   * 2: Stresli → mood 30, energy 5, anxiety 9
   * 3: Endişeli → mood 25, energy 4, anxiety 10
   * 4: Mutlu → mood 85, energy 9, anxiety 2
   */
  private classToMEA(idx: number): { mood: number; energy: number; anxiety: number } {
    switch (idx) {
      case 0: return { mood: 60, energy: 7, anxiety: 3 };
      case 1: return { mood: 20, energy: 3, anxiety: 8 };
      case 2: return { mood: 30, energy: 5, anxiety: 9 };
      case 3: return { mood: 25, energy: 4, anxiety: 10 };
      case 4: return { mood: 85, energy: 9, anxiety: 2 };
      default: return { mood: 50, energy: 6, anxiety: 5 };
    }
  }
}

export default ProductionScalerService;
