# Onboarding v2 – Kaydet, Senkronize Et, AI Bağlamı

Veri Modeli:
- profile: { age?, gender?, locale?, timezone? }
- motivations: string[]
- first_mood: { score?, tags? }
- lifestyle: { sleep_hours?, exercise?, social? }
- reminders: { enabled, time?, days?, timezone? }
- feature_flags: { daily_prompt?, weekly_report?, meditation?, ai_suggestions? }
- consent: { accepted, accepted_at? }
- meta: { version: 2, created_at }

Supabase (user_profiles) Alanları (Örnek):
- age, gender, locale, timezone
- motivations (text[])
- first_mood_score, first_mood_tags
- lifestyle_sleep_hours, lifestyle_exercise, lifestyle_social
- reminder_enabled, reminder_time, reminder_days
- feature_flags (jsonb), consent_accepted, consent_at
- onboarding_version=2, onboarding_completed_at

Akış:
1) Local persist: `profile_v2` (snapshot), `ai_onboarding_completed`(global ve user-spesifik)
2) Reminder planlama: izin reddinde sessiz
3) Supabase UPSERT: `upsertUserProfile(userId, payload)` (created_at set edilmez; updated_at set edilir)
4) Offline fallback: `offlineSync.addToSyncQueue({ entity:'user_profile', ... })`
5) Telemetry: `ONBOARDING_COMPLETED` (duration/motivations/hasReminder)

Analiz Entegrasyonu:
- `userProfileAdapter` → (profile_v2 → onb_v1_payload → Supabase) bağlamı yükler
- `UnifiedAIPipeline` bağlam ile hafif ağırlıklandırma uygular (örn. remindersEnabled meta işareti)
