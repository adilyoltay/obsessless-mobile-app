/**
 * Cloud Model Test Servisi
 * 
 * Bu servis, cloud inference API üzerinden modeli test eder.
 */

import ProductionScalerService from './ai/productionScalerService';
import cloudInferenceClient from '@/services/ai/cloudInferenceClient';
import healthSignals from '@/services/ai/healthSignals';

export interface MoodPredictionResult {
  /** Tahmin edilen ruh hali kategorisi */
  moodCategory: string;
  /** Güven skoru (0-1 arası) */
  confidence: number;
  /** Ham model çıktısı */
  rawOutput: number[];
  /** İşlem süresi (ms) */
  processingTime: number;
  /** Cloud request id (varsa) */
  requestId?: string;
  /** input_quality metrikleri (minute-window için) */
  inputQuality?: any;
}

export interface ModelTestResult {
  /** Model başarıyla yüklendi mi? */
  modelLoaded: boolean;
  /** Test başarılı mı? */
  testPassed: boolean;
  /** Hata mesajı (varsa) */
  error?: string;
  /** Model bilgileri */
  modelInfo?: {
    inputShape: number[];
    outputShape: number[];
    modelSize: number;
  };
  /** Test sonuçları */
  testResults?: MoodPredictionResult[];
}

class TFLiteModelTestService {
  private isReady = false;

  /**
   * Model dosyasını yükler
   */
  async loadModel(): Promise<boolean> {
    try {
      console.log('🌐 Cloud inference health check...');
      const ok = await cloudInferenceClient.health();
      this.isReady = ok;
      console.log(ok ? '✅ Cloud hazır' : '❌ Cloud erişilemedi');
      return ok;
    } catch (error) {
      console.error('❌ Cloud health hatası:', error);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Model bilgilerini alır
   */
  getModelInfo() {
    try {
      return {
        inputShape: [1, 10080],
        outputShape: [1, 5],
        modelSize: 0,
      };
    } catch (error) {
      console.error('Model bilgisi alınamadı:', error);
      return null;
    }
  }

  /**
   * Test verisi ile modeli test eder
   */
  async testModel(): Promise<MoodPredictionResult[]> {
    if (!this.isReady) throw new Error('Cloud inference hazır değil');

    const results: MoodPredictionResult[] = [];
    
    try {
      // Günlük özellik vektörleri (normalize [0..1]) üzerinden XGBoost yolunu test et
      const ymd = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })();
      const daily = await healthSignals.getDailyFeatures(ymd);
      const vec = buildNormVector(daily as any);
      const testInputs = [vec, vec, vec];

      for (let i = 0; i < testInputs.length; i++) {
        const startTime = Date.now();
        
        try {
          // Cloud inference çağrısı (daily features)
          const output = await cloudInferenceClient.inferDailyFeatureVector(testInputs[i]);
          const processingTime = Date.now() - startTime;
          let rawOutput: number[] = [];
          let confidence = 0;
          let moodCategory = 'unknown';
          const requestId = (output as any)?.request_id;
          const inputQuality = (output as any)?.input_quality;
          if (Array.isArray(output?.logits)) {
            rawOutput = output!.logits!.slice(0, 5).map(Number);
            const mea = ProductionScalerService.getInstance().mapModelOutputToMEA(rawOutput);
            confidence = mea.confidence;
            moodCategory = this.categorizeMood(rawOutput);
          } else if (Array.isArray(output?.probs)) {
            rawOutput = output!.probs!.slice(0, 5).map(Number);
            const mea = ProductionScalerService.getInstance().mapModelOutputToMEA(rawOutput);
            confidence = mea.confidence;
            moodCategory = this.categorizeMood(rawOutput);
          } else if (
            typeof output?.mood === 'number' &&
            typeof output?.energy === 'number' &&
            typeof output?.anxiety === 'number'
          ) {
            rawOutput = [];
            confidence = typeof output?.confidence === 'number' ? output!.confidence! : 0;
            // Map to kategori via MEA thresholds
            moodCategory = this.categorizeFromMEA({ mood: output!.mood!, energy: output!.energy!, anxiety: output!.anxiety! });
          }
          
          results.push({
            moodCategory,
            confidence,
            rawOutput: rawOutput.slice(0, 5), // İlk 5 değeri göster
            processingTime,
            requestId,
            inputQuality,
          });
          
          console.log(`✅ Test ${i + 1} tamamlandı: ${moodCategory} (${confidence.toFixed(2)})`);
        } catch (error) {
          console.error(`❌ Test ${i + 1} başarısız:`, error);
          results.push({
            moodCategory: 'unknown',
            confidence: 0,
            rawOutput: [],
            processingTime: Date.now() - startTime,
          });
        }
      }
      
    } catch (error) {
      console.error('Model test hatası:', error);
      throw error;
    }

    return results;
  }

  /**
   * Ham model çıktısını ruh hali kategorisine dönüştürür
   * Production scaler service kullanır
   */
  private categorizeMood(rawOutput: number[]): string {
    if (!rawOutput || rawOutput.length < 5) return 'unknown';
    try {
      const logits = rawOutput.slice(0, 5).map((x) => Number(x));
      const m = Math.max(...logits);
      const exps = logits.map((x) => Math.exp(x - m));
      const z = exps.reduce((s, v) => s + v, 0) || 1;
      const probs = exps.map((v) => v / z);
      let argmax = 0, maxp = -Infinity;
      for (let i = 0; i < probs.length; i++) { if (probs[i] > maxp) { maxp = probs[i]; argmax = i; } }
      const labels = ['normal','depresif','stresli','endişeli','mutlu'];
      return labels[argmax] || 'unknown';
    } catch (error) {
      console.error('Model çıktısı kategorize edilirken hata:', error);
      return 'unknown';
    }
  }

  private categorizeFromMEA(mea: { mood: number; energy: number; anxiety: number }): string {
    try {
      if (mea.mood >= 70) return 'mutlu';
      if (mea.mood <= 30) return 'depresif';
      if (mea.anxiety >= 8) return 'endişeli';
      if (mea.anxiety >= 6) return 'stresli';
      return 'normal';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Tam test sürecini çalıştırır
   */
  async runFullTest(): Promise<ModelTestResult> {
    console.log('🧪 Cloud Inference Test Başlatılıyor...');
    
    const result: ModelTestResult = {
      modelLoaded: false,
      testPassed: false,
    };

    try {
      // 1. Health check
      const loaded = await this.loadModel();
      result.modelLoaded = loaded;
      
      if (!loaded) {
        result.error = 'Model yüklenemedi';
        return result;
      }

      // 2. Model bilgilerini al
      result.modelInfo = this.getModelInfo() || undefined;
      
      // 3. Modeli test et
      result.testResults = await this.testModel();
      
      // 4. Test başarılı mı kontrol et
      result.testPassed = result.testResults.every(r => r.confidence > 0);
      
      console.log('✅ Cloud Inference Test Tamamlandı');
      console.log(`📊 Model Bilgileri:`, result.modelInfo);
      console.log(`🎯 Test Sonuçları:`, result.testResults);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Bilinmeyen hata';
      console.error('❌ Test hatası:', error);
    }

    return result;
  }

  /**
   * Modeli temizler
   */
  cleanup() {
    this.isReady = false;
    console.log('🧹 Cloud test state resetlendi');
  }
}

// Singleton instance
export const tfliteModelTestService = new TFLiteModelTestService();

export default TFLiteModelTestService;
// Helpers
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function buildNormVector(f: any): number[] {
  const norm = (v: number, min: number, max: number) => clamp((v - min) / (max - min), 0, 1);
  const v = [
    typeof f.hr_rest === 'number' ? norm(f.hr_rest, 40, 100) : 0,
    typeof f.hr_mean === 'number' ? norm(f.hr_mean, 40, 120) : 0,
    typeof f.hr_var === 'number' ? clamp(f.hr_var / 400, 0, 1) : 0,
    typeof f.hrv_sdnn_median === 'number' ? norm(f.hrv_sdnn_median, 10, 120) : 0,
    typeof f.hrv_rmssd === 'number' ? norm(f.hrv_rmssd, 10, 120) : 0,
    typeof f.steps === 'number' ? clamp(f.steps / 20000, 0, 1) : 0,
    typeof f.active_energy === 'number' ? clamp(f.active_energy / 1500, 0, 1) : 0,
    typeof f.stand_hours === 'number' ? clamp(f.stand_hours / 18, 0, 1) : 0,
    typeof f.sleep_duration_min === 'number' ? clamp(f.sleep_duration_min / 720, 0, 1) : 0,
    typeof f.sleep_efficiency === 'number' ? clamp(f.sleep_efficiency, 0, 1) : 0,
    typeof f.deep_sleep_ratio === 'number' ? clamp(f.deep_sleep_ratio / 0.6, 0, 1) : 0,
    typeof f.vo2max === 'number' ? norm(f.vo2max, 20, 60) : 0,
  ];
  return v;
}
