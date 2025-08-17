### ObsessLess – Ağustos 2025 Sprint Planı (Repo’ya Uyumlu)

Bu plan, mevcut kod tabanına (Expo Router, Supabase, TanStack Query, Zustand, Privacy-First) ve mevcut AI mimarisine (feature flags, telemetry, JITAI) uyarlanmıştır. Dil: Türkçe. Amaç: Demo-ready → Production-ready geçişte her parçanın çalışır hâle gelmesi.

## Sprint 1 – Parite ve Temel Hazırlık

- **1) Sesli Mood Check-in + Öneri Kartı**
  - Bağımlılıklar: Mikrofon izni, STT rızası; TR/EN algı; `AI_VOICE`, `LLM_ROUTER` (alias), telemetri.
  - Uygulama:
    - UI: `features/ai/components/voice/VoiceInterface.tsx` mevcut; durum/animasyon/erişilebilirlik tamam.
    - STT: `features/ai/services/voiceRecognition.ts` içinde `transcribeAudio` gerçek servis ile değiştirilecek (şimdilik mock + düşük güven etiketi).
    - NLU (deterministik): mood 0–100, trigger: {ev, temizlik, kontrol, sosyal, vb.}, bağlam: saat/konum yoksa `null`.
    - Rota: Heuristik → ERP veya Reframe. ERP için `features/ai/services/erpRecommendationService.ts` kullanılacak; Reframe için `LLM_REFRAME` açık ise kısa alternatifler, değilse deterministik şablon.
  - Edge-case’ler: 0–5 sn → "yetersiz veri" + klavye fallback; gürültü/düşük güven → rozet; >90 sn → otomatik durdur + özetleme.
  - Telemetri: `checkin_started/completed`, `stt_failed`, `route_suggested`.
  - DoR/DoD: İzin metinleri ve sözlük hazır; yukarıdaki kabul senaryoları çalışır + i18n (TR/EN).

- **2) CBT Thought Record Şablonları**
  - Bağımlılıklar: Distortion enum (TR/EN); `LLM_REFRAME` (alias → `AI_EXTERNAL_API`).
  - Uygulama: `components/forms/ThoughtRecordForm.tsx` oluştur; çoklu distortion ≤3, taslak kurtarma, 140 karakter limiti.
  - Telemetri: `reframe_started/completed`, `distortion_selected[n]`.
  - DoR/DoD: Taslak kurtarma ve düzenle-kaydet geçmişi; i18n tamam.

- **3) Breathwork Kitaplığı**
  - Bağımlılıklar: Protokoller: Box(4-4-4-4), 4-7-8, Paced(6/6); TTS TR/EN; haptik fallback.
  - Uygulama: `components/breathwork/BreathworkPlayer.tsx` + `expo-speech`/haptik; ERP ekranından modal kısayol.
  - Telemetri: `breath_started/paused/resumed/completed`.
  - DoR/DoD: Üç protokol sorunsuz; erişilebilirlik destekleri; kısayol çalışır.

- **4) Kliniğe Hazır PDF Raporu (MVP)**
  - Bağımlılıklar: `services/dataExportService.ts` genişletme; Y-BOCS trend, ERP log (son 5), tetikleyici istatistikleri.
  - Uygulama: `expo-print` ile HTML→PDF; rıza modalı; ≤1 MB uyarı.
  - Telemetri: `pdf_generated/shared/cancelled/error`.
  - DoR/DoD: Offline üretim; i18n; dosya boyutu sınırı.

## Sprint 2 – JITAI ve Klinik Derinleştirme

- **5) JITAI Tabanlı Sesli ERP Koçu**
  - Bağımlılıklar: Zaman tetikleyici (`services/notificationScheduler.ts`); geofence (hafta 4); guardrail sözlükleri.
  - Uygulama: `features/ai/jitai/jitaiEngine.ts` mevcut → `JITAI_TIME` ve `JITAI_GEOFENCE` flag’leri; guardrail tetiklenince güvenli çıkış + kriz kaynakları.
  - Telemetri: `jitai_trigger_fired`, `erp_session_started/finished`, `guardrail_triggered{type}`.
  - DoR/DoD: Zaman tetikleyicileri 24s stabil; güvenli çıkış çalışır; loglar PDF’e uygun.

- **6) JITAI Kompulsiyon Kaydı**
  - Bağımlılıklar: Hızlı form `components/forms/CompulsionQuickEntry.tsx` mevcut; zaman/konum hatırlatıcıları.
  - Uygulama: Prompt → form aç; sessize alma 24s; 15 dk tek seferlik hatırlatma opsiyonu.
  - Telemetri: `compulsion_prompted/logged/dismissed/snoozed`.
  - DoR/DoD: 30 sn’de kayıt tamam; ERP planında ilişki gösterimi.

- **7) Relapse (Nüks) Penceresi Analizi**
  - Bağımlılıklar: 14 gün / 10+ kayıt; gün×saat ısı haritası ve eşikler.
  - Uygulama: `features/ai/analytics/relapseWindow.ts` (riskScore 0..1, eşik ≥0.6); kart + tetikleyici kur.
  - Telemetri: `relapse_window_detected`, `proactive_prompt_clicked`.
  - DoR/DoD: Kart + tetikleyici akışı tamam.

- **8) Mikro Dersler ve Psychoeducation**
  - Bağımlılıklar: Markdown TR/EN; TTS opsiyonu; davranış görevi şablonu.
  - Uygulama: `components/lessons/MicroLessonPlayer.tsx`; ilerleme + ERP görev bağlantısı.
  - Telemetri: `micro_lesson_started/completed/abandoned`.
  - DoR/DoD: Oynatıcı akışı + i18n + görev bağlama.

## Çapraz Konular

- **LLM Kullanımı**: Flags: `LLM_ROUTER`, `LLM_REFRAME`, `LLM_COACH_ADAPT`, `LLM_PDF_SUMMARY` (alias → AI master). Girdi filtresi: PII maskesi; fail-safe: deterministik şablon.
- **Deney/Ölçüm**: A/B (`LLM_ROUTER` açık/kapalı); KPI ve drop-off noktaları (STT sonrası, öneri kartı sonrası) telemetri ile ölçülecek.
- **Gizlilik & Güvenlik**: STT/konum/arka plan/PDF için ayrı consent kayıtları; kriz tetiklenince içerik telemetrisi yok; PDF varsayılan yerel.
- **Rollout**: Canary %10 `JITAI_TIME`, sonra `JITAI_GEOFENCE`; kill-switch: tüm AI ve LLM flag’leri uzaktan kapatılabilir (master switch mevcut).

## Telemetri Olayları (Yeni)

```
checkin_started, checkin_completed, stt_failed, route_suggested,
jitai_trigger_fired, erp_session_started, erp_session_finished, guardrail_triggered,
compulsion_prompted, compulsion_logged, compulsion_dismissed, compulsion_snoozed,
relapse_window_detected, proactive_prompt_clicked,
pdf_generated, pdf_shared, pdf_cancelled, pdf_error
```

## Test Matrisi (Özet)

- Cihaz: iOS 16–17; Android 13–14; düşük/orta/üst seviye.
- Ağ: offline/2G/4G/wi-fi; arka plan/ön plan.
- Dil: TR/EN; Erişilebilirlik: büyük yazı, VoiceOver/TalkBack.

---

Bu dosya Sprint Board’a doğrudan kopyalanabilir. İsterseniz Gherkin kabul testlerini ve telemetri şeması için tek sayfalık JSON sözlüğünü `docs/telemetry/` altına ekleyebilirim.


