# 🗂️ Feature Status Matrix (Q4 2025)

| Özellik | Durum | Not |
|---|---|---|
| AI Onboarding | Aktif | Y-BOCS analizi, profil, tedavi planı, telemetry |
| Insights v2 | Aktif | CBT/AI/Progress kaynaklı basit içgörüler, 60s cooldown |
| Progress Analytics | Aktif | İstatistikler ve eğilimler, AI destekli değerlendirme |
| JITAI (temel) | Aktif | Zaman/bağlam tetikleyicileri, krizsiz |
| Voice Mood Check‑in | Aktif | STT, rota önerisi, PII maskeleme |
| ERP Önerileri | Aktif | AI öneri + heuristik fallback |
| Telemetry | Aktif | Gizlilik‑öncelikli, enum doğrulamalı |
| Content Filtering | Aktif | AI yanıt filtresi |
| Art Therapy | Pasif | Flag kapalı |
| AI Chat | Pasif | UI/servis yok |
| Crisis Detection | Kaldırıldı | runtime’da devre dışı |

Not: Flag kontrolü `FEATURE_FLAGS.isEnabled(name)` üzerinden yapılır; dokümanlar bu tabloya göre güncellenir.
