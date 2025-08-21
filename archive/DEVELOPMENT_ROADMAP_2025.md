# 🛣️ Development Roadmap 2025

Bu yol haritası, 2025 için yakın ve orta vadeli hedefleri konsolide eder (Ocak 2025 güncellemesi).

## ✅ Ocak 2025 - Tamamlanan Özellikler
- **Unified Voice Analysis**: Merkezi ses analizi sistemi (Gemini API entegrasyonu)
- **CBT Yeniden Tasarımı**: 4-adımlı form, BottomSheet, Master Prompt uyumlu
- **Navigation Optimizasyonu**: FAB butonları, CBT tab kaldırma, tutarlı UX
- **BottomSheet Standardizasyonu**: Tüm modüller için tutarlı tasarım sistemi
- **Offline-First CBT**: AsyncStorage + Supabase senkronizasyonu
- **CoreAnalysisService v1**: Single-entry AI architecture, LLM gating (%40-50 cost reduction)
- **Multi-layer Caching**: TTL-based caching (1h/12h/24h), cache invalidation
- **Progressive UI**: <500ms immediate insights, <3s deep analysis
- **Batch Jobs**: Daily trend analysis, mood smoothing, risk updates
- **Idempotent Operations**: content_hash based deduplication
- **Comprehensive Test Suite**: 60+ golden set cases, unit/integration tests

## 🚧 Şubat 2025 (Devam Eden)
- **Supabase Migration**: `thought_records` tablosu deployment
- **Performance Optimizasyonu**: Voice analysis cache, lazy loading
- **Test Coverage**: Unit testler, integration testler
- **Documentation**: API dokümantasyonu, kullanıcı rehberleri
- **Telemetry Enhancement**: Unified voice analysis metrikleri

## 🎯 Mart 2025 (Planlanan)
- **Advanced CBT Features**: AI destekli reframe önerileri iyileştirme
- **ERP Enhancements**: Daha akıllı egzersiz önerileri
- **Progress Analytics**: CBT progress tracking ve insights
- **Voice Analysis v2**: Daha gelişmiş NLP ve context understanding
- **Mobile Optimizations**: Performance ve battery usage optimizasyonları

## 🔮 Q2 2025 (Ön-Plan)
- **Multi-language Support**: İngilizce desteği
- **Advanced Analytics**: Haftalık/aylık progress raporları
- **Smart Notifications v2**: Context-aware bildirimler
- **Accessibility**: Screen reader ve accessibility iyileştirmeleri
- **Export Features**: Veri export ve backup özellikleri

## İlkeler
- Privacy‑first; PII yok; on‑device öncelik
- Feature flags ile artımlı yayın
- Master Prompt: Sakinlik, Güç, Zahmetsizlik

## Bağımlılıklar
- Supabase (Auth/DB/RLS)
- AsyncStorage (offline cache)
- Zustand + TanStack Query
- Gemini (sadece gerekli akışlarda)

## Ölçüm (Örnek)
- Oturum tamamlama oranı, anksiyete düşüş ortalaması
- Telemetry olay kapsamı ve latency medyanı
- Crash‑free session oranı

---
Not: AI Chat ve Crisis Detection kapsam dışıdır.
