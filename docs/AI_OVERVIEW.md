# 🤖 AI Overview (Q4 2025)

Bu belge, aktif AI modüllerini, mimariyi, Gemini entegrasyonunu ve telemetri yaklaşımını tek çatı altında toplar.

## Modül Özeti
- Insights v2: CBT/AI + Progress Tracking Insights; 60 sn cooldown; telemetry: INSIGHTS_REQUESTED/DELIVERED/INSIGHTS_MISSING_REQUIRED_FIELDS/INSIGHTS_RATE_LIMITED/INSIGHTS_CACHE_HIT/INSIGHTS_CACHE_MISS/NO_INSIGHTS_GENERATED (kriz kategorileri kaldırıldı)
- Progress Analytics: runtime’dan kaldırıldı (yalnızca tipler mevcut); varsayılan konfig: `enableProgressTracking=false`
- JITAI (temel): Zaman/bağlam tetikleyicileri (kriz yok); telemetry: JITAI_INITIALIZED, JITAI_TRIGGER_FIRED
- Pattern Recognition v2: AI-assisted basitleştirilmiş akış
- Voice Mood Check‑in: STT, PII maskeleme, rota önerisi; telemetry: CHECKIN_STARTED/ROUTE_SUGGESTED/COMPLETED, STT_FAILED
- ERP Önerileri: in_vivo/imaginal/interoceptive/response_prevention; telemetry: INTERVENTION_RECOMMENDED
- Content Filtering: AI yanıt güvenliği; telemetry: AI_CONTENT_FILTERED

## Mimari Kısa Özet
- aiManager: başlatma/flag/sağlık kontrol
- Telemetry: enum doğrulamalı, privacy-first
- Storage: AsyncStorage (offline-first) + Supabase (sync)
  - Storage wrapper: Geçersiz anahtar development modunda hata fırlatır; production’da uyarı + stack trace loglar

## Gemini Entegrasyonu
- Env: EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GEMINI_MODEL
- Sağlayıcı: Gemini-only (fallback: local/heuristic)
- Performans ölçümü: AI_RESPONSE_GENERATED, AI_PROVIDER_HEALTH_CHECK/FAILED

## Telemetry Olayları (Seçki)
- Sistem: SYSTEM_INITIALIZED/STARTED/STATUS/STOPPED
- Insights: INSIGHTS_REQUESTED/DELIVERED, INSIGHTS_MISSING_REQUIRED_FIELDS, INSIGHTS_RATE_LIMITED, INSIGHTS_CACHE_HIT, INSIGHTS_CACHE_MISS, NO_INSIGHTS_GENERATED
  - Hata: AI_PROVIDER_API_ERROR (trackAIError ile yakalanır)
- JITAI: JITAI_INITIALIZED, JITAI_TRIGGER_FIRED
- Voice: CHECKIN_STARTED, ROUTE_SUGGESTED, CHECKIN_COMPLETED, STT_FAILED
- ERP: ERP_SESSION_STARTED/FINISHED, INTERVENTION_RECOMMENDED
- Güvenlik: AI_CONTENT_FILTERED; Hatalar: API_ERROR, SLOW_RESPONSE

## Kullanıcı Akışları (Özet)
- Voice Check‑in → Rota önerisi → ERP/CBT yönlendirmesi
- ERP oturumu → Telemetry + Gamification → İstatistikler/Insights

## Notlar
- AI Chat ve Crisis Detection devre dışıdır
- Art Therapy flag kapalı
- Smart Notifications: Legacy `PATTERN_ALERT` ve `CRISIS_INTERVENTION` kategorileri koddan kaldırıldı; yerine `INSIGHT_DELIVERY` ve `THERAPEUTIC_REMINDER` kullanılıyor.
 - Insights orchestrator: aynı kullanıcıdan gelen eşzamanlı talepler kuyruklanır (deterministik sonuç ve telemetry tutarlılığı için).
