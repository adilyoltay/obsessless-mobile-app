# 🧪 Testing Strategy Overview (Q4 2025)

Bu belge, geçerli test stratejisini ve hangi kontrol listelerinin kullanılacağını özetler.

## Kapsam
- Voice Mood Check‑in
- CBT Thought Record
- Breathwork
- ERP Önerileri / ERP Oturum Akışı
- Insights v2 / Progress Analytics
- Telemetry (privacy-first)

## Hariç
- AI Chat (yok)
- Crisis Detection (kaldırıldı)

## Referans Kontrol Listeleri
- AI_TEST_CHECKLIST.md (güncel)
- AI_PRODUCTION_TEST_REPORT.md (güncel)

## Temel İlkeler
- Flag tabanlı test (sadece aktif özellikler)
- Offline-first senaryolar
- Supabase senkron doğrulamaları
- Telemetry event doğrulaması (enum’a karşı)

## Telemetry Doğrulama (QA için kısa liste)
- Sistem: SYSTEM_INITIALIZED, SYSTEM_STARTED, SYSTEM_STATUS, SYSTEM_STOPPED
- Sağlayıcı/Performans: AI_PROVIDER_HEALTH_CHECK, AI_PROVIDER_FAILED, AI_RESPONSE_GENERATED, AI_CONTENT_FILTERED, SLOW_RESPONSE, API_ERROR
- Voice: CHECKIN_STARTED, STT_FAILED, ROUTE_SUGGESTED, CHECKIN_COMPLETED
- ERP/JITAI: ERP_SESSION_STARTED, ERP_SESSION_FINISHED, JITAI_TRIGGER_FIRED
- Compulsion: COMPULSION_PROMPTED, COMPULSION_LOGGED, COMPULSION_DISMISSED
- Breathwork: BREATH_STARTED, BREATH_COMPLETED
- Not: Nihai kaynak `features/ai/telemetry/aiTelemetry.ts` içindeki `AIEventType` enum’dur; QA doğrulamasında enum’a uyum aranır.
