# 🗂️ Feature Status Matrix (Q4 2025)

| Özellik | Durum | Not |
|---|---|---|
| AI Onboarding | Aktif | Y-BOCS analizi, profil, tedavi planı, telemetry |
| Onboarding Rota | Aktif | Giriş rotası `/(auth)/onboarding`; eski `/(auth)/ai-onboarding` kaldırıldı |
| Insights v2 | Aktif | CBT + AI; Progress Analytics kaldırıldı; kriz kategorileri kaldırıldı; 60s cooldown; spesifik telemetry (rate limit/cache/insufficient/no_insights) |
| Progress Analytics | Kaldırıldı | Bağımsız servis ve koordinatör entegrasyonu kaldırıldı; bazı tipler arşivde kalabilir |
| JITAI (temel) | Aktif | Zaman/bağlam tetikleyicileri, krizsiz |
| Voice Mood Check‑in | Aktif | STT, rota önerisi, PII maskeleme |
| ERP Önerileri | Aktif | AI öneri + heuristik fallback |
| Telemetry | Aktif | Gizlilik‑öncelikli, enum doğrulamalı |
| Content Filtering | Aktif | AI yanıt filtresi |
| Art Therapy | Pasif | Flag kapalı (modül arşiv adayı; UI’da nazik bilgilendirme) |
| AI Chat | Pasif | UI/servis yok |
| Crisis Detection | Kaldırıldı | runtime’da devre dışı |
| Conflict Resolution | Aktif | Kompulsiyonlarda aktif; ERP/achievements için best‑effort |
| Data Standardization | Aktif | Kompulsiyon/ERP save akışlarında standardizasyon |
| Mood Tracking | Kısmen | Servis mevcut; UI + migration gerekli |
| Achievement Enhancements | Kısmen | Unlock kayıtları ERP/compulsion olaylarına bağlı; migration gerekli |
| AI Data Aggregation | Kısmen | İskelet eklendi; akışa bağlama gerekli |
| Enhanced Treatment Planning | Kısmen | İskelet + AI init’e opsiyonel faz olarak eklendi |

Ek Notlar:
- Insights orchestrator aynı kullanıcıdan gelen eşzamanlı talepleri kuyruklar.
- AsyncStorage wrapper geçersiz anahtarlarda development modunda hata fırlatır.

Not: Flag kontrolü `FEATURE_FLAGS.isEnabled(name)` üzerinden yapılır; dokümanlar bu tabloya göre güncellenir.
