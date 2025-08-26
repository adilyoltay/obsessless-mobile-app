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
```

## Önemli Notlar

- **Privacy-First**: Hassas veriler asla düz metin olarak saklanmaz
- **Offline-First**: Kritik işlemler önce local'e yazılır, sonra senkronize edilir
- **Unified AI**: Tüm AI analizleri `unifiedPipeline.process()` üzerinden yapılır
