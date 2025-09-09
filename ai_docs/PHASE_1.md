# Faz 1 — big‑mood‑detector Entegrasyonu ve AI Tahmin Akışı

Durum: Güncel (bu dosya ilerledikçe güncellenecek)

## Hedefler
- [x] Plan dokümanı ai_docs altına taşındı.
- [x] AIPrediction tipleri ve Supabase servisleri (get/upsert).
- [x] Offline Sync: `ai_mood_prediction` entity desteği (idempotency + upsert).
- [x] Loader: Günlük AI tahmin overlay’ini expose et (manuel verileri bozmadan).
- [x] Grafik: AppleHealthStyleChartV2’de AI overlay çizimi (hafta görünümü, dashed).
- [x] Grafik: Ay/6A/Yıl görünümünde aggregate AI overlay çizimi (dashed).
- [x] Tooltip: "AI Tahmin" ve güven (confidence) metni (hafta/aggregate seçimlerinde gösterim).
- [x] Supabase migration dosyası eklendi: `supabase/migrations/2025-09-09_add_ai_mood_predictions.sql`
- [x] HealthKit özellik çıkarımı iskeleti + somut okuma denemeleri (izin, HR/HRV/Adım/Enerji/Uyku; dinamik require ile güvenli).
- [x] Model runner köprü iskeleti (TFJS/TFLite) + fallback heuristic; gerçek model dosyası bağlanınca çalışacak.
- [x] Uyku metrikleri: sleep_efficiency ve deep_sleep_ratio hesaplaması eklendi; stand_hours için kategori okuma denemesi.

## Alınan Kararlar
- AI tahminleri `mood_entries` dışında, ayrı tabloda tutulacak: `ai_mood_predictions`.
- UI’da manuel kayıtlar “asıl” veri; AI tahminler overlay (dashed/yarı saydam) olarak görünecek.
- Idempotency: `(user_id + local_ymd + model_name + model_ver + features_hash)` üzerinden.

## Uygulama Notları
- Loader, seçilen tarih aralığındaki (day/week/month…) gün listesi için:
  - Lokal repo (şifreli) ve Supabase’den (mevcutsa) tahminleri okur.
  - Gün başına en yüksek “confidence” veya en yeni tahmini seçer.
  - `aiOverlay.daily` olarak döner.
  - Aggregate (ay/6A/yıl) için `aiOverlay.aggregated` (granularity=week|month) hesaplanır ve `aggregated.data` ile hizalanır.
- Grafik entegrasyonunda AI overlay, manuel günlük ortalamaları varsa çakışmadan ayrı çizgi olarak gösterilecek.

## Doğrulama
- Geliştirici doğrulaması: Mock tahminleri `offlineSync` kuyruğuna `ai_mood_prediction` ile ekleyin; online iken Supabase’e upsert olmalı.
- Loader çağrısında `data.aiOverlay?.daily` dolu gelmeli; manuel veri yokken overlay gözükmeli (grafik aşamasında).
- Aggregate modlarda `data.aiOverlay?.aggregated` dolu gelmeli ve grafik üzerinde kesik çizgi görülmeli.
- Tooltip, seçilen gün/bucket için `AI Tahmin: {mood}` ve `(varsa) Güven: %{confidence*100}` bilgisini gösterir.

## Örnek (kuyruğa tahmin ekleme)
```ts
import { queueDailyPrediction } from '@/services/ai/inferenceService';

await queueDailyPrediction({
  user_id: currentUserId,
  dateYmdLocal: '2025-09-09',
  mood_score_pred: 62,
  energy_level_pred: 6,
  anxiety_level_pred: 4,
  confidence: 0.78,
  model_name: 'big-mood-detector',
  model_version: 'v1',
  features_hash: 'f:hrv_sdnn:42|steps:5800|sleep:420' // opsiyonel
});
```

## Sağlık Sinyalleri (iskele)
- `services/ai/healthSignals.ts` eklendi. HealthKit izinleri ve günlük özellik çıkarımı burada toplanacak.
- Bir sonraki adımda HealthKit sorguları (HR/HRV, adım, enerji, uyku) ve `features_hash` üretimi bağlanacak.


## Ortam ve Bağımlılıklar (Kurulum)
- Paketler (package.json):
  - @kingstinct/react-native-healthkit
  - @tensorflow/tfjs, @tensorflow/tfjs-react-native
- Metro ayarı:
  - `metro.config.js` içinde `resolver.assetExts` → ['bin','tflite'] eklendi (model dosyaları için).
- iOS izinleri ve plugin’ler (app.config.ts):
  - infoPlist: NSHealthShareUsageDescription, NSHealthUpdateUsageDescription eklendi.
  - plugins: '@kingstinct/react-native-healthkit' ve 'expo-build-properties' ile HealthKit entitlements (com.apple.developer.healthkit: true).
- Model dosyaları:
  - TFJS: `assets/models/big_mood_detector/model.json` ve shard `.bin` dosyaları.
  - TFLite: `assets/models/big_mood_detector/big_mood_detector.tflite`.
- Köprü seçimi:
  - Env: `BIG_MOOD_BRIDGE=tfjs` veya `tflite` (geliştirme için `placeholder` da olabilir).
