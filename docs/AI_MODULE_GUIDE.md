# 🤖 AI Module Guide (Active Modules)

Bu belge, aktif AI modüllerinin teknik özetini sunar.

## Insights v2
- Kaynaklar: CBT Analysis, AI Deep, Progress Insights
- Zamanlama: 60 sn cooldown, cache
- Telemetry: INSIGHTS_REQUESTED, INSIGHTS_DELIVERED, INSIGHTS_DATA_INSUFFICIENT

## Progress Analytics
- Metrikler: kompulsiyon sıklığı, direnç oranı, trendler
- Tahminler: haftalık risk, milestone
- Telemetry: PROGRESS_ANALYTICS_INITIALIZED/COMPLETED

## JITAI (Temel)
- Tetikleyiciler: zaman/bağlam, krizsiz
- Teslim: in-app öneri, bildirim
- Telemetry: JITAI_INITIALIZED, JITAI_TRIGGER_FIRED

## Pattern Recognition v2 (AI-assisted)
- Yalın yöntem; yalnızca AI destekli keşif
- Telemetry: PATTERN_RECOGNITION_INITIALIZED/COMPLETED

## Voice Mood Check‑in
- STT, PII maskeleme, rota önerisi
- Telemetry: CHECKIN_STARTED/COMPLETED, STT_FAILED

## ERP Önerileri
- Kaynak: treatment plan + geçmiş performans
- Türler: in_vivo/imaginal/interoceptive/response_prevention
- Telemetry: INTERVENTION_RECOMMENDED

## Content Filtering
- Çıktı güvenliği, terapötik bağlam doğrulama
- Telemetry: AI_CONTENT_FILTERED

Not: AI Chat ve Crisis Detection devre dışıdır; Art Therapy flag kapalıdır.
