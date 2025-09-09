/**
 * TFLite Model Test Ekranı
 * 
 * Bu ekran, TFLite modelini test etmek için kullanılır.
 * Debug amaçlıdır ve production'da kullanılmamalıdır.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { tfliteModelTestService, ModelTestResult, MoodPredictionResult } from '../services/tfliteModelTestService';
import ProductionScalerService from '@/services/ai/productionScalerService';
import modelRunner, { type BigMoodOutput } from '@/services/ai/modelRunner';
import healthSignals from '@/services/ai/healthSignals';
import Constants from 'expo-constants';

export default function TFLiteTestScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [scalerMeta, setScalerMeta] = useState<{ scalerLoaded: boolean; hasScaler: boolean; meanLength: number | null; stdLength: number | null } | null>(null);
  // No local model path in cloud mode
  const [prodLoading, setProdLoading] = useState(false);
  const [prodResult, setProdResult] = useState<(BigMoodOutput & { category: string; when: string }) | null>(null);

  const runTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await tfliteModelTestService.runFullTest();
      setTestResult(result);
      
      if (result.testPassed) {
        Alert.alert('✅ Test Başarılı', 'TFLite modeli başarıyla test edildi!');
      } else {
        Alert.alert('❌ Test Başarısız', result.error || 'Bilinmeyen hata');
      }
    } catch (error) {
      Alert.alert('❌ Hata', error instanceof Error ? error.message : 'Bilinmeyen hata');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanup = () => {
    tfliteModelTestService.cleanup();
    setTestResult(null);
    Alert.alert('🧹 Temizlendi', 'Model temizlendi');
  };

  const getEnv = (k: string, fb: string = ''): string => {
    try {
      const v = (process.env as any)?.[k] || (process.env as any)?.[`EXPO_PUBLIC_${k}`];
      if (typeof v === 'string' && v.length) return v;
    } catch {}
    try {
      const extra = (Constants as any)?.expoConfig?.extra || (Constants as any)?.default?.expoConfig?.extra || {};
      const v = extra?.[k] || extra?.[`EXPO_PUBLIC_${k}`];
      if (typeof v === 'string' && v.length) return v;
    } catch {}
    return fb;
  };

  const refreshMeta = async () => {
    setMetaLoading(true);
    try {
      const scaler = ProductionScalerService.getInstance();
      setScalerMeta(scaler.getMeta());
      // no-op for local model path in cloud mode
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  const toCategoryFromMEA = (out: BigMoodOutput): string => {
    if (!out) return 'unknown';
    const m = Number(out.mood_score_pred);
    const a = Number(out.anxiety_level_pred);
    if (m >= 70) return 'mutlu';
    if (m <= 30) return 'depresif';
    if (a >= 8) return 'endişeli';
    if (a >= 6) return 'stresli';
    return 'normal';
  };

  const runProductionOnce = async () => {
    setProdLoading(true);
    try {
      const ok = await healthSignals.ensurePermissions();
      if (!ok) {
        Alert.alert('İzin gerekli', 'HealthKit okuma yetkisi yok.');
        setProdLoading(false);
        return;
      }
      // today (local date string)
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const ymd = `${y}-${m}-${d}`;
      const feats = await healthSignals.getDailyFeatures(ymd);
      const out = await modelRunner.runBigMoodDetector(feats as any);
      const category = toCategoryFromMEA(out);
      setProdResult({ ...out, category, when: new Date().toLocaleString() });
    } catch (e) {
      Alert.alert('Tahmin hatası', String(e));
    } finally {
      setProdLoading(false);
    }
  };

  const renderTestResult = (result: MoodPredictionResult, index: number) => (
    <View key={index} style={styles.testResultCard}>
      <Text style={styles.testResultTitle}>Test {index + 1}</Text>
      <Text style={styles.testResultText}>
        <Text style={styles.label}>Kategori:</Text> {result.moodCategory}
      </Text>
      <Text style={styles.testResultText}>
        <Text style={styles.label}>Güven:</Text> {(result.confidence * 100).toFixed(1)}%
      </Text>
      <Text style={styles.testResultText}>
        <Text style={styles.label}>Süre:</Text> {result.processingTime}ms
      </Text>
      {result.requestId ? (
        <Text style={styles.testResultText}>
          <Text style={styles.label}>Request ID:</Text> {result.requestId}
        </Text>
      ) : null}
      <Text style={styles.testResultText}>
        <Text style={styles.label}>Ham Çıktı:</Text> [{result.rawOutput.map(n => n.toFixed(3)).join(', ')}]
      </Text>
      {result.inputQuality ? (
        <Text style={styles.testResultText}>
          <Text style={styles.label}>Input Quality:</Text> {(() => {
            try {
              const q = result.inputQuality || {};
              const flags = q.flags ? Object.keys(q.flags).filter(k => q.flags[k]).join('|') : '—';
              const dn = typeof q.day_night_contrast === 'number' ? q.day_night_contrast.toFixed(3) : '—';
              const ca = typeof q.circadian_amplitude === 'number' ? q.circadian_amplitude.toFixed(3) : '—';
              return `flags=${flags} dn=${dn} ca=${ca}`;
            } catch {
              return '—';
            }
          })()}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌐 Cloud Inference Test</Text>
        <Text style={styles.subtitle}>PAT-Conv-L (Remote) Test Ekranı</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '⏳ Test Çalışıyor...' : '🧪 Model Test Et'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={cleanup}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🧹 Temizle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={refreshMeta}
          disabled={metaLoading}
        >
          <Text style={styles.buttonText}>{metaLoading ? '⏳ Meta...' : '🧩 Scaler/Model Meta'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runProductionOnce}
          disabled={prodLoading}
        >
          <Text style={styles.buttonText}>{prodLoading ? '⏳ Üretim Inference...' : '🚀 Production Inference'}</Text>
        </TouchableOpacity>
      </View>

      {testResult && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📊 Test Sonuçları</Text>
          
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              <Text style={styles.label}>Model Yüklendi:</Text> {testResult.modelLoaded ? '✅' : '❌'}
            </Text>
            <Text style={styles.statusText}>
              <Text style={styles.label}>Test Başarılı:</Text> {testResult.testPassed ? '✅' : '❌'}
            </Text>
            {testResult.error && (
              <Text style={styles.errorText}>
                <Text style={styles.label}>Hata:</Text> {testResult.error}
              </Text>
            )}
          </View>

          {testResult.modelInfo && (
            <View style={styles.modelInfoCard}>
              <Text style={styles.modelInfoTitle}>📋 Model Bilgileri</Text>
              <Text style={styles.modelInfoText}>
                <Text style={styles.label}>Input Shape:</Text> [{testResult.modelInfo.inputShape.join(', ')}]
              </Text>
              <Text style={styles.modelInfoText}>
                <Text style={styles.label}>Output Shape:</Text> [{testResult.modelInfo.outputShape.join(', ')}]
              </Text>
              <Text style={styles.modelInfoText}>
                <Text style={styles.label}>Model Boyutu:</Text> {testResult.modelInfo.modelSize} bytes
              </Text>
            </View>
          )}

          {testResult.testResults && (
            <View style={styles.testResultsContainer}>
              <Text style={styles.testResultsTitle}>🎯 Test Sonuçları</Text>
              {testResult.testResults.map(renderTestResult)}
            </View>
          )}
        </View>
      )}

      {/* Production Scaler / Model Meta */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>🧩 Scaler / Cloud Metadata</Text>
        <Text style={styles.infoText}>
          • BIG_MOOD_BRIDGE: {getEnv('BIG_MOOD_BRIDGE', 'not-set')}{'\n'}
          • BIG_MOOD_MODEL: {getEnv('BIG_MOOD_MODEL', 'not-set')}{'\n'}
          • Scaler Loaded: {scalerMeta?.scalerLoaded ? '✅' : '❌'} (has: {scalerMeta?.hasScaler ? 'yes' : 'no'}){'\n'}
          • mean/std length: {scalerMeta?.meanLength ?? 0} / {scalerMeta?.stdLength ?? 0}{'\n'}
          • API URL: {getEnv('AI_INFERENCE_URL', getEnv('EXPO_PUBLIC_AI_INFERENCE_URL', 'not-set'))}
        </Text>
      </View>

      {/* Last Production Inference */}
      {prodResult && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>🛰️ Son Production Inference</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}><Text style={styles.label}>Zaman:</Text> {prodResult.when}</Text>
            <Text style={styles.statusText}><Text style={styles.label}>Kategori:</Text> {prodResult.category}</Text>
            <Text style={styles.statusText}><Text style={styles.label}>Mood:</Text> {prodResult.mood_score_pred}</Text>
            <Text style={styles.statusText}><Text style={styles.label}>Energy:</Text> {prodResult.energy_level_pred}</Text>
            <Text style={styles.statusText}><Text style={styles.label}>Anxiety:</Text> {prodResult.anxiety_level_pred}</Text>
            {typeof prodResult.confidence === 'number' && (
              <Text style={styles.statusText}><Text style={styles.label}>Confidence:</Text> {(prodResult.confidence * 100).toFixed(1)}%</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>ℹ️ Bilgi</Text>
        <Text style={styles.infoText}>
          • Bu ekran sadece debug amaçlıdır{'\n'}
          • Model: PAT-Conv-L (Cloud){'\n'}
          • Girdi: 7 günlük dakika aktivite (10080), opsiyonel z-score (NHANES){'\n'}
          • Çıktı: 5 sınıf (logits/prob) veya MEA doğrudan{'\n'}
          • Gerçek akış için modelRunner.ts kullanılır
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    padding: 20,
    gap: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginTop: 8,
  },
  modelInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modelInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  modelInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  testResultsContainer: {
    gap: 12,
  },
  testResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  testResultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  testResultText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  label: {
    fontWeight: '600',
    color: '#1F2937',
  },
  infoContainer: {
    padding: 20,
    backgroundColor: '#F3F4F6',
    margin: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
