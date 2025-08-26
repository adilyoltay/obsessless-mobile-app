# Security & Privacy

PII & Sanitization:
- Server-bound yazılarda kritik serbest metin alanları sanitize edilir.

Storage:
- Local snapshotlar: `profile_v2`, `onb_v1_payload`
- Anahtarların yönetimi ve olası migrasyonlar (NavigationGuard destekli)

Şifreleme:
- `services/encryption/secureDataService` (AES-GCM)

RLS/Policy:
- `RLS_VALIDATION.md` (old_docs) referans
