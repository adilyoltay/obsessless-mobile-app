# Offline Sync

Amaç: Offline-first deneyim; işlemleri queue’ya al, online olunca senkronize et.

Queue Item:
- { id, type: 'CREATE'|'UPDATE'|'DELETE', entity, data, timestamp, retryCount, deviceId?, lastModified? }

Desteklenen entity:
- 'user_profile', 'mood_entry', 'ai_profile', 'treatment_plan', 'voice_checkin', 'achievement'

Akış:
- addToSyncQueue: Geçersiz entity drop; userId guard; AsyncStorage kalıcılık
- processSyncQueue: Exponential backoff + jitter; max retry → dead-letter
- syncItem: entity-case bazlı handler
- Telemetry: Başarılı/başarısız senkronlar ve conflict metrikleri

İyi Uygulamalar:
- Idempotent UPSERT (content hash veya unique composite)
- PII sanitize (server-bound)
