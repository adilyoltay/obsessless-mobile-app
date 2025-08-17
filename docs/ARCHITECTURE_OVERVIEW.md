# 📐 Architecture Overview (Q4 2025)

Bu belge, mevcut kod tabanının gerçek durumunu, katmanları ve veri akışını özetler. Amaç; ekibin güncel mimariyi tek yerden görebilmesini sağlamak ve gelecek geliştirmelere zemin oluşturmaktır.

## Katmanlar ve Sorumluluklar
- Uygulama (Expo + React Native)
  - Dosya tabanlı yönlendirme (Expo Router)
  - Erişilebilir ve minimal UI bileşenleri (custom components)
- State Yönetimi
  - Global: Zustand (onboarding, ERP, gamification)
  - Asenkron/Cache: TanStack Query (Supabase veri senkronu)
- Veri Katmanı
  - Supabase (Auth, PostgreSQL, RLS, Triggers)
  - Offline-first: AsyncStorage (önce yerel yazım, online iken senkron)
 - AI Katmanı (features/ai)
   - aiManager (özellik başlatma/flag/sağlık kontrol; 3 aşamalı başlatma: 1) kritik bağımsız servisler, 2) bağımlı servisler, 3) koordinatörler)
   - Telemetry (gizlilik-öncelikli izleme; standartlaştırılmış `AIEventType`)
   - Insights v2 (CBT ve AI-Deep; Data Aggregation ile öncelik/zamanlama ayarı; Progress Analytics bağımsız servis olarak yok, sınırlı kapsamda trend + pattern özetleri; kriz önleme içgörüleri kaldırıldı)
   - JITAI (temel zaman/bağlam tetikleyicileri)
   - Pattern Recognition v2 (yalnızca AI-assisted)
   - Safety: contentFilter (kriz tespiti ve kriz uyarıları kaldırıldı)

## Aktif/Pasif Modüller (Özet)
- Aktif: Onboarding (AI destekli), Insights v2, JITAI (temel), Voice Mood Check‑in, ERP önerileri, Telemetry, Content Filtering
- Pasif/Devre Dışı: AI Chat (UI/servis yok), Crisis Detection (kaldırıldı), Art Therapy (flag kapalı)
  
Güncel yönlendirme:
- Onboarding giriş rotası: `/(auth)/onboarding` (eski `/(auth)/ai-onboarding` kaldırıldı)
- NavigationGuard ve `app/index.tsx` onboarding kontrolleri bu rotaya yönlendirir.
  
Notlar:
 - Progress Analytics bağımsız servis olarak bulunmuyor; sınırlı kapsamda (7/30/90 trend + temel pattern) Insights v2 içinde üretilir.
 - Smart Notifications kategorilerinde legacy `CRISIS_INTERVENTION` kaldırıldı; güncel kategoriler sadeleştirildi.
 - Onboarding feature flag (`AI_ONBOARDING_V2`) kaldırıldı; onboarding varsayılan olarak etkin. Legacy storage anahtarları normalize edildi.
 
### Son Stabilizasyon Notları (2025‑08)
 - Insights v2
  - generateInsights/orchestrator başlangıcında bağlam doğrulaması: `recentMessages`, `behavioralData`, `timeframe` eksikse `INSIGHTS_MISSING_REQUIRED_FIELDS` telemetrisi ve `VALIDATION_ERROR` ile anlamlı hata.
  - Kalıcı önbellek: AsyncStorage ile kullanıcıya özel anahtarlar (örn. `insights_cache_{userId}`, `insights_last_gen_{userId}`) ve index listesi.
  - Harici AI hata telemetrisi: `trackAIError` çağrıları ve nazik fallback içerik döndürme.
  - Aynı kullanıcıdan eşzamanlı talepler: orchestrator’da kuyruklama (chained promise) ile deterministik işleyiş.
  - Cooldown/Rate limit telemetrisi: `INSIGHTS_RATE_LIMITED`; cache akışları: `INSIGHTS_CACHE_HIT` / `INSIGHTS_CACHE_MISS`; sıfır içgörü: `NO_INSIGHTS_GENERATED`.
  - Data Aggregation: peakAnxietyTimes/commonTriggers/erpCompletionRate ile öncelik ve zamanlama ayarı; sıfır içgörüde aggregation‑tabanlı davranışsal fallback içgörü.
- JITAI
  - `predictOptimalTiming` ve `normalizeContext` undefined‑güvenli; eksik bağlamlarda soft‑fail.
  - `generateTimingPrediction` başında guard: `currentContext.userState` eksikse normalize edilip güvenli varsayılanlarla ilerlenir.
  - `treatmentPlanningEngine` öneri zamanı: `optimalTiming.recommendedTime` kullanımı; `optimizeTreatmentTiming` gerekli `currentContext.userState`’i sağlar.
- Voice
  - `VoiceInterface` ses katmanını `voiceRecognitionService` üzerinden kullanır; doğrudan `expo-av` import edilmez. Feature flag koşulu render aşamasında uygulanır.
- Storage
  - `StorageKeys.SETTINGS` eklendi; AsyncStorage wrapper anahtar doğrulaması yapar. Geçersiz anahtarlarda development modunda hata fırlatır (erken yakalama), production’da stack trace loglar. OfflineSync servisindeki tüm anahtarlar `safeStorageKey` ile güvenli hâle getirildi (`syncQueue_*`, `failedSyncItems_*`, `local*_*`).
  - Mood Tracking: günlük anahtar `mood_entries_{userId}_{YYYY-MM-DD}`; history ekranı son 14 günü okur
  - OfflineSync: özet metrikler `last_sync_summary`; batch `syncWithConflictResolution(batchSize)`
 - Progress Analytics (sınırlı)
  - Bağımsız servis yok; coordinator doğrudan çağırmaz. Trend + temel pattern özetleri Insights v2 tarafından üretilir.
- Test Altyapısı
  - Jest setup: AsyncStorage, `expo/virtual/env`, router, haptics, vector‑icons ve `expo-location` için mocklar eklendi. Stabilizasyon sürecinde coverage eşiği devre dışı.

## Bağımlılıklar ve Konfigürasyon
- Expo SDK 51, React Native 0.74.x, TypeScript strict
- Supabase: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
- AI Sağlayıcı: EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GEMINI_MODEL (Gemini-only)
- Feature Flags: `FEATURE_FLAGS.isEnabled(name)` üzerinden kontrol; `AI_ONBOARDING_V2` kaldırıldı

## Veri Akışı (Örnekler)
- Onboarding: UI → Zustand → AsyncStorage → Supabase (upsert) → AI Analiz → Telemetry
- Kompulsiyon Kaydı: UI → AsyncStorage (offline) → Supabase (kanonik kategori + subcategory orijinal etiket) → Telemetry
- ERP Oturumu: UI → Zustand (timer/anxiety) → AsyncStorage (günlük anahtar) → Supabase (tamamlanınca) → Gamification → Telemetry
- Mood Kaydı: UI → AsyncStorage (günlük anahtar) → (best‑effort) Supabase `mood_tracking` → AI Data Aggregation → Insights v2

## Kategori ve Tür Standartları
- OCD Kategorileri (kanonik): contamination, checking, symmetry, mental, hoarding, other
- ERP Egzersiz Türleri (kanonik): in_vivo, imaginal, interoceptive, response_prevention

## Gizlilik ve Güvenlik
- PII loglanmaz; telemetry metaveriyi sanitize eder
- RLS aktif, kullanıcıya özel veri erişimi
- Data Compliance: export (yerel mood + Supabase compulsion/ERP), soft delete işareti ve hard delete planlama anahtarları
- Offline buffer şifreli saklama (platform yetenekleri dahilinde)

## Bilinen Kısıtlar
- Gerçek AI cevapları için geçerli API anahtarı gerekir
- AI Chat ve Crisis Detection kaldırıldı; ileride ihtiyaç olursa yeniden ele alınır

---
Son güncelleme: 2025-08 (Refactor: phased init, flag temizliği, telemetry standardizasyonu, Data Aggregation entegrasyonu, OfflineSync batch/özet, Mood History)
