# ObsessLess – Project Docs (v2)

Bu belgeler, uygulamanın güncel mimarisini, veri akışını, Onboarding v2 senkronizasyonunu ve Unified AI Pipeline entegrasyonunu anlatır.

- Platform: React Native (Expo)
- Backend: Supabase (Auth + Postgres)
- Senkron: Offline-first (AsyncStorage + OfflineSync queue)
- Analiz: Unified AI Pipeline (mood/breath odaklı), hafif profil bağlamı

İçerik:
- architecture.md: Uygulama mimarisi
- onboarding-v2.md: Onboarding kaydetme + offline sync + AI bağlamı
- data-model.md: Supabase tablo ve alanları
- sync.md: OfflineSync sistemi
- ai-pipeline.md: Unified AI Pipeline tasarımı
- development.md: Kurulum, env, komutlar
- testing.md: Test/QA stratejisi
- release.md: Branch/migration/PR akışı
- security-privacy.md: PII, şifreleme, RLS
- troubleshooting.md: Sık karşılaşılan sorunlar

Hızlı Başlangıç
- `yarn install && yarn typecheck && yarn lint`
- iOS: `cd ios && pod install && cd .. && yarn ios`
- Android: `yarn android`
