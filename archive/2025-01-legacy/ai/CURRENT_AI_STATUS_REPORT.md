# 📊 ObsessLess AI System - Güncel Durum Raporu

Son güncelleme: 2025-08-10

## 🎯 EXECUTIVE SUMMARY
- ✅ AI altyapısı production-ready (Gemini-only)
- ✅ Çekirdek servisler çalışır: Onboarding, Profil, Tedavi Planlama, Terapi Önerileri, Risk (krizsiz), Y‑BOCS
- 🔄 Insights/Progress/Pattern: veri yeterliliğine bağlı; telemetri tamamlandı
- ❌ Kriz Tespiti: runtime’dan kaldırıldı (flag varsayılan kapalı, init edilmez)

---

## 🏗️ ARCHITECTURE OVERVIEW (Özet)
- `constants/featureFlags.ts`: AI_MASTER env tabanlı, Gemini zorunlu
- `contexts/AIContext.tsx`: servis init, health ve telemetri
- `features/ai/services/externalAIService.ts`: Gemini-only, PII filtreleme, cache

## 🤖 Core
- TreatmentPlanningEngine: gerçek LLM planları (Gemini), onboarding’de aktif
- CBT Engine: bilişsel çarpıtma tespiti ve teknik önerileri
- Y‑BOCS Analysis: LLM destekli geliştirme
- Terapi Recommendation Service: LLM + cache, fallback’li
- RiskAssessmentService: kriz modülleri olmadan risk değerlendirme + telemetri

## 🔍 Insights & Analytics
- InsightsEngineV2: veri yetersizliğinde `INSIGHTS_DATA_INSUFFICIENT` telemetrisi; Today ekranında açıklama gösterilir
- ProgressAnalytics: `progress_analytics_initialized` ve `progress_analysis_completed` event’leri
- PatternRecognitionV2: `pattern_recognition_initialized` ve `pattern_analysis_completed`

## 📡 Telemetry (Gizlilik)
- Tüm eventler Supabase `ai_telemetry` tablosuna non‑blocking
- `userId` uygulama içinde hashlenir; PII maskeleme güçlendirildi
- Eksik event tipleri tamamlandı; eventType missing uyarıları giderildi

## ❌ Kaldırılan / Kapalı Özellikler
- Crisis Detection: runtime’dan çıkarıldı (doküman ve kod uyumlu)
- Eski çok‑sağlayıcılı AI (OpenAI/Claude): tamamen kaldırıldı

## 🧭 UX Notları
- Dil: cihaz dilini takip eder (TR değilse EN), manuel seçim yok
- Onboarding: devam edilebilir akış; tamamlandıktan sonra AIContext yenilenir

## ✅ Test ve İzlenebilirlik
- `scripts/test-ai-integration.js` ve `AI_TEST_CHECKLIST.md` güncellendi
- Telemetri: provider/model/latency/tokens; insights 0 olduğunda özel event

## 🚀 Sonraki Adımlar (Kısa)
- Insights veri beslemesini artırma (uygulama içi aktivite entegrasyonları)
- PII desenlerinin üretim verisiyle iyileştirilmesi
- Progress/Pattern sonuçlarının UX’te kademeli yüzeye çıkarılması
