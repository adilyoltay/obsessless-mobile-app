# ObsessLess Mobil Uygulaması – Dokümantasyon

OKB ile mücadelede kullanıcının dijital sığınağı: empatik, güvenli ve etkili bir uygulama.

## Teknik Özet

**Platform**: React Native (Expo SDK 51, RN 0.74+, TypeScript strict)
**Backend**: Supabase (Auth + PostgreSQL + RLS + Edge Functions), Privacy-First
**State Yönetimi**: Zustand (global), TanStack Query (async cache)
**Offline-First**: AsyncStorage + `services/offlineSync.ts` (queue, backoff, DLQ)
**AI Altyapı**: `unifiedPipeline.process()` tek giriş noktası (progressive UI + telemetry)
**Onboarding v2**: Local snapshot → UPSERT → Offline fallback → AI bağlamı

## İçindekiler

- [**Architecture Overview**](./architecture.md) – Katmanlar, veri akışı ve önemli bileşenler
- [**Onboarding v2**](./onboarding-v2.md) – Veri modeli, akış adımları ve döngü önleme
- [**Data Model**](./data-model.md) – Supabase tabloları, CHECK/enum constraints
- [**Offline Sync**](./sync.md) – Queue yapısı, retry mekanizmaları ve DLQ
- [**AI Pipeline**](./ai-pipeline.md) – Unified AI işlem hattı ve bağlam enjeksiyonu
- [**Development**](./development.md) – Kurulum, komutlar ve klasör yapısı
- [**Testing**](./testing.md) – Test stratejileri ve smoke senaryoları
- [**Release**](./release.md) – Branch isimlendirme, PR checklist ve rollback
- [**Security & Privacy**](./security-privacy.md) – PII sanitizasyon, şifreleme, RLS
- [**Troubleshooting**](./troubleshooting.md) – Yaygın sorunlar ve çözümler
- [**Code Analysis Report**](./CODE_ANALYSIS_REPORT_2025.md) 🆕 – Kapsamlı kod analizi ve iyileştirme önerileri (Ocak 2025)
- [**UnifiedAI Pipeline Optimization**](./UNIFIED_PIPELINE_OPTIMIZATION_PLAN.md) 🚀 – Monolitik optimizasyon planı ve implementation status

## Hızlı Başlangıç

```bash
# Kurulum ve tip kontrolü
yarn install
yarn typecheck

# iOS geliştirme
cd ios && pod install && cd ..
yarn ios

# Android geliştirme
yarn android

# TFLite Model Test
yarn test:tflite
```

## Önemli Notlar

- **Privacy-First**: Hassas veriler asla düz metin olarak saklanmaz
- **Offline-First**: Kritik işlemler önce local'e yazılır, sonra senkronize edilir
- **Unified AI**: Tüm AI analizleri `unifiedPipeline.process()` üzerinden yapılır

## 🚀 Son Güncellemeler (Phase 4)

### 🎨 Enhanced Color-Journey (Ocak 2025)
- **Today Sayfası Enhancement**: Mood journey'ye spektrum renkleri entegrasyonu
- **9-Renk Emotion Mapping**: Kızgın → Heyecanlı arası tam spektrum (anxiety-friendly renkler)
- **Mini Spektrum Bar**: LinearGradient ile görsel mood palette
- **Emotion Distribution Dots**: En dominant 3 emotion real-time analizi
- **Perfect Color Consistency**: Dashboard ile %100 renk uyumu

### 🎯 UI/UX Optimizasyonları
- **Mood Dashboard Simplification**: Spektrum sekmesi kaldırıldı, sadece İçgörüler odağı
- **Today Stats Alignment**: Haftalık özet kartları mükemmel yan yana hizalama
- **Mood Tracker Cleanup**: Özet istatistikleri kaldırıldı, entry listesine odak
- **Master Prompt Uyumu**: Sakinlik + minimalizm ilkeleri

### ✅ Debug & Test Araçları
- **MoodDataFlowTester**: Mood verilerinin AI sistemlere akışını test eden comprehensive tool
- **Development Debug UI**: Mood ekranında development-only debug button
- **Real-time validation**: AsyncStorage, Supabase, AI uyumluluğu testleri

### 📊 Performans İyileştirmeleri
- **Code Cleanup**: 300+ satır gereksiz kod kaldırıldı (spektrum, stats)
- **Bundle Optimization**: Daha küçük component tree, faster rendering
- **TypeScript errors**: AI core'da 0 hata
- **Progressive enhancement**: Quick + deep AI analysis

## 🤖 TFLite Model Test

### Kurulum ve Test
```bash
# TFLite bağımlılıklarını kontrol et
yarn test:tflite

# Uygulamayı çalıştır
yarn ios

# Debug ekranını aç: app/debug-tflite-test.tsx
```

### Model Dosyası
- **Konum**: `assets/models/big_mood_detector/big_mood_detector.tflite`
- **Format**: TensorFlow Lite (.tflite)
- **Model**: PAT-Conv-L v0.5929 (Depression Classification)
- **AUC**: 0.5929 (NHANES 2013-2014 dataset)
- **Input**: 10080 boyutunda Apple Health aktivite verisi
- **Paket**: `react-native-fast-tflite`

### Test Servisi
- **Dosya**: `services/tfliteModelTestService.ts`
- **Özellikler**: Model yükleme, test verisi ile çalıştırma, sonuç analizi
- **Debug Ekranı**: `app/debug-tflite-test.tsx`
