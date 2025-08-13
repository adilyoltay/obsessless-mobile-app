AI Telemetry Events (Production)

Bu belge, uygulamadaki AI telemetrilerinin standartlaştırılmış olay isimlerini ve kullanım kurallarını özetler. Tüm event isimleri `features/ai/telemetry/aiTelemetry.ts` içindeki `AIEventType` enum’unda tanımlıdır ve çalışma zamanında doğrulanır. Enum dışındaki event’ler otomatik olarak düşürülür.

Sistem
- SYSTEM_INITIALIZED, SYSTEM_STARTED, SYSTEM_STATUS, SYSTEM_STOPPED, EMERGENCY_SHUTDOWN
- EXTERNAL_AI_INITIALIZED, EXTERNAL_AI_SHUTDOWN

LLM/Provider ve Performans
- AI_PROVIDER_HEALTH_CHECK, AI_PROVIDER_FAILED
- AI_RESPONSE_GENERATED (provider, model, latency, tokens, cached, fallbackUsed)
- AI_PROMPT_LOGGED (PII’siz, sanitized kısa örnek)
- AI_CONTENT_FILTERED (neden: content_filtered vs.)
- SLOW_RESPONSE, API_ERROR

Voice Mood Check‑in
- CHECKIN_STARTED, STT_FAILED (reason, status), ROUTE_SUGGESTED (route, intensity), CHECKIN_COMPLETED

CBT Thought Record
- REFRAME_STARTED, REFRAME_COMPLETED, DISTORTION_SELECTED

Breathwork
- BREATH_STARTED, BREATH_PAUSED, BREATH_RESUMED, BREATH_COMPLETED

ERP/JITAI
- ERP_SESSION_STARTED, ERP_SESSION_FINISHED
- JITAI_TRIGGER_FIRED, GUARDRAIL_TRIGGERED

Compulsion Quick Entry
- COMPULSION_PROMPTED, COMPULSION_LOGGED, COMPULSION_DISMISSED, COMPULSION_SNOOZED

PDF
- PDF_GENERATED, PDF_SHARED, PDF_CANCELLED, PDF_ERROR

Smart Notifications
- SMART_NOTIFICATIONS_INITIALIZED, NOTIFICATION_PREFERENCES_UPDATED, NOTIFICATION_FEEDBACK, SMART_NOTIFICATIONS_SHUTDOWN

Politikalar ve Kurallar
- PII: Event metadata içine PII konmaz; trackAIInteraction metaveriyi sanitize eder. Metin alanları uzunluk bilgisiyle yazılır.
- Doğrulama: Geçersiz event türleri çalışma zamanında düşürülür (log uyarısı). Enum’a eklenmeyen yeni olay isimleri kullanılmamalıdır.
- Kalıcılık: Özet event bilgileri arka planda Supabase ai_telemetry tablosuna yazılır (RLS aktif). Zaman kolonları DB varsayılanlarıyla yönetilir.

Hızlı Kontrol Listesi
- Doğru AIEventType kullandınız mı?
- PII içeren bir alanı metadata’ya koymadınız mı?
- Feature flag AI_TELEMETRY açık mı?
