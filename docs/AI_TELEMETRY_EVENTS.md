AI Telemetry Events (Production)

Sistem
- SYSTEM_INITIALIZED: AI Manager/Context başlatıldığında
- SYSTEM_STARTED / SYSTEM_STATUS / SYSTEM_STOPPED
- EXTERNAL_AI_INITIALIZED: Dış AI servisi aktifleştiğinde (provider, model, latency)

Insights
- INSIGHTS_REQUESTED / INSIGHTS_DELIVERED / INSIGHT_WORKFLOW_COMPLETED

LLM ve Performans
- AI_PROVIDER_HEALTH_CHECK: Sağlayıcı sağlık durumu
- AI_RESPONSE_GENERATED: LLM cevabı üretildi (provider, model, latency, tokenTotal, cached)
- SLOW_RESPONSE: Yavaş cevap uyarısı
- API_ERROR: Dış servis veya sync hatası (component, method, error)

Retry Queue (Sync)
- enqueue: Kuyruğa ekleme (FEATURE_ENABLED ile)
- retry_scheduled: Geri deneme planlandı (attempts, delayMs)
- load_queue / save_queue hataları: API_ERROR

ERP Önerileri
- ERPRecommendationService initialize: SYSTEM_STARTED
- LLM refine başarılı: AI_RESPONSE_GENERATED (feature=erp_recommendations)

Not: PII hiçbir event'e eklenmez. userId alanları anonimdir.

