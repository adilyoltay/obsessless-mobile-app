# Testing & QA

Statik:
- `yarn typecheck`, `yarn lint --max-warnings=0`

Birim/Entegrasyon:
- Service mapping (upsertUserProfile), adapters, sync handlers

Manual Smoke:
- Onboarding Online: UPSERT, yeniden açılışta profil bağlamı
- Onboarding Offline→Online: queue ve senkron doğrulaması
- Reminders: izin yönetimi ve planlama
- UnifiedAIPipeline: bağlam etkisi (metadata flag)

Telemetry:
- `ONBOARDING_COMPLETED` ve sistem durum event’leri
