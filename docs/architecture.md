# Architecture Overview

Katmanlar:
- UI (React Native/Expo): Ekranlar, bileşenler ve navigation.
- Store/State: Zustand/Context bazlı durum yönetimi ve onboarding store.
- Services: Supabase, OfflineSync, Telemetry/Analytics.
- UnifiedAIPipeline: Analiz, bağlam enjeksiyonu, sonuç üretimi.

Veri Akışı (Özet):
- Login → Onboarding → Local snapshot (AsyncStorage) + Supabase UPSERT (user_profiles)
- Offline durum: queue (entity='user_profile'), online olunca senkron
- UnifiedAIPipeline: `userProfileContext` (motivations, sleep_hours, reminders_enabled) ile hafif ağırlıklandırma

Önemli Dosyalar:
- `services/supabase.ts`: upsertUserProfile, getUserProfile, AI profile/treatment plan upsert
- `services/offlineSync.ts`: Queue, backoff, dead-letter entegrasyonu
- `features/ai/core/UnifiedAIPipeline.ts`: Pipeline çekirdeği
- `features/ai/context/userProfileAdapter.ts`: Profil bağlamını yükler (local→remote fallback)
