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
  - aiManager (özellik başlatma/flag/sağlık kontrol)
  - Telemetry (gizlilik-öncelikli izleme)
  - Insights v2 (CBT, AI-Deep, Progress kaynaklı basit akış)
  - Progress Analytics (istatistik ve eğilimler)
  - JITAI (temel zaman/bağlam tetikleyicileri)
  - Pattern Recognition v2 (yalnızca AI-assisted basitleştirilmiş)
  - Safety: contentFilter (kriz tespiti devre dışı)

## Aktif/Pasif Modüller (Özet)
- Aktif: Onboarding (AI destekli), Insights v2, Progress Analytics, JITAI (temel), Voice Mood Check‑in, ERP önerileri, Telemetry, Content Filtering
- Pasif/Devre Dışı: AI Chat (UI/servis yok), Crisis Detection (kaldırıldı), Art Therapy (flag kapalı)

## Bağımlılıklar ve Konfigürasyon
- Expo SDK 53, React Native 0.79.x, TypeScript strict
- Supabase: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
- AI Sağlayıcı: EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GEMINI_MODEL
- Feature Flags: FEATURE_FLAGS.isEnabled(name) üzerinden kontrol

## Veri Akışı (Örnekler)
- Onboarding: UI → Zustand → AsyncStorage → Supabase (upsert) → AI Analiz → Telemetry
- Kompulsiyon Kaydı: UI → AsyncStorage (offline) → Supabase (kanonik kategori + subcategory orijinal etiket) → Telemetry
- ERP Oturumu: UI → Zustand (timer/anxiety) → AsyncStorage (günlük anahtar) → Supabase (tamamlanınca) → Gamification → Telemetry

## Kategori ve Tür Standartları
- OCD Kategorileri (kanonik): contamination, checking, symmetry, mental, hoarding, other
- ERP Egzersiz Türleri (kanonik): in_vivo, imaginal, interoceptive, response_prevention

## Gizlilik ve Güvenlik
- PII loglanmaz; telemetry metaveriyi sanitize eder
- RLS aktif, kullanıcıya özel veri erişimi
- Offline buffer şifreli saklama (platform yetenekleri dahilinde)

## Bilinen Kısıtlar
- Gerçek AI cevapları için geçerli API anahtarı gerekir
- AI Chat ve Crisis Detection tasarımsal olarak kaldırıldı; ileride ihtiyaç olursa yeniden ele alınır

---
Son güncelleme: 2025-08
