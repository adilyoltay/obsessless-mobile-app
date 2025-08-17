# 🛣️ Development Roadmap 2025

Bu yol haritası, 2025 için yakın ve orta vadeli hedefleri konsolide eder (Q4 2025 + 2026 Q1 ön-öngörü).

## Q4 2025 (Canlıdaki Odaklar)
- Stabilizasyon: Offline-first senkron ve hata toparlama
- Telemetry: Enum uyumluluğu, özel Insights event ayrışması (missing_required_fields / rate_limited / cache_hit | miss / no_insights_generated), örnek dashboard export
- ERP: Quick Start UX iyileştirmeleri, imaginal/interoceptive ek akış gardiyanları
- Insights v2: Veri yetersizliği fallback’leri, cooldown görünürlüğü ve heuristik fallback telemetrisi
- Gamification: İnce ayar (puan/rozet balansları)

## Q1 2026 (Ön-Plan)
- Voice Check‑in: Daha zengin yönlendirmeler, kısa özetler
- Progress: Haftalık/aylık raporlar (sınırlı kapsam — yerelde üretim, export opsiyonel)
- JITAI: Zaman/pattern tabanlı tetikleyicilerin genişletilmesi
- ERP: Oturum sonrası mini yansıma (self‑reflection) opsiyonel

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
