# 📊 Feature Status Matrix

> **İlgili Dokümanlar**: 
> - [Kritik Geliştirme Planı 2025](./CRITICAL_IMPROVEMENTS_PLAN_2025.md) - Tespit edilen kritik hatalar ve çözüm planı
> - [Development Roadmap 2025](./DEVELOPMENT_ROADMAP_2025.md) - Genel geliştirme yol haritası

## 🎯 Ana Özellikler

| Özellik | Durum | Versiyon | Not |
|---|---|---|---|
| **Unified Voice Analysis** | ✅ Aktif | v2.0 | Merkezi ses analizi sistemi - Gemini API entegrasyonu |
| **CBT Düşünce Kaydı** | ✅ Aktif | v2.0 | 4-adımlı form, BottomSheet, Master Prompt uyumlu |
| **OCD Tracking** | ✅ Aktif | v2.0 | Orijinal tasarım korundu, ses check-in kaldırıldı |
| ~~**Therapy Sessions**~~ | ❌ REMOVED | - | **ERP module tamamen kaldırıldı** |
| **Breathwork** | ✅ Aktif | v2.0 | Akıllı tetikleme sistemi, contextual öneriler, protokol seçimi |
| **Today Screen** | ✅ Aktif | v2.0 | Merkezi ses girişi, otomatik yönlendirme |

## 🤖 AI Özellikleri

| Özellik | Durum | Versiyon | Not |
|---|---|---|---|
| **UnifiedAIPipeline** | ✅ Aktif | v1.0 | **PRODUCTION ACTIVE** - Single-entry AI, LLM gating (-%70 API), Token budget (20K/day), Similarity dedup, Multi-layer cache (24h/1h TTL), Progressive UI (<500ms/3s), Voice + Pattern + Insights + CBT birleşik, %100 rollout |
| **CoreAnalysisService** | ✅ Aktif | v1.0 | **ACTIVE** - UnifiedAIPipeline ile birlikte çalışıyor |
| **Insights v2** | ✅ Aktif | v2.0 | Data Aggregation ile öncelik/zamanlama |
| **Pattern Recognition v2** | ✅ Aktif | v2.0 | AI-assisted analiz |
| **Smart Notifications** | ✅ Aktif | v2.0 | Kriz içeriği kaldırıldı |
| **CBT Engine** | ✅ Aktif | v2.0 | Bilişsel çarpıtma analizi, reframe önerileri |
| **Gemini API Integration** | ✅ Aktif | v1.0 | Ses analizi ve tip tespiti |
| **Onboarding (AI)** | ✅ Aktif | v1.0 | Varsayılan açık |
| **Batch Jobs** | ✅ Aktif | v1.0 | Daily @03:05 Istanbul: Trend analysis, mood smoothing, risk updates, cache cleanup |
| **Progressive UI** | ✅ Aktif | v1.0 | 300ms immediate (cache/heuristic), 3s deep insights (LLM), "Güncellendi" badge |


## 📱 UI/UX Özellikleri

| Özellik | Durum | Versiyon | Not |
|---|---|---|---|
| **BottomSheet Components** | ✅ Aktif | v2.0 | Tutarlı tasarım sistemi |
| **Master Prompt Compliance** | ✅ Aktif | v2.0 | Sakinlik, güç, zahmetsizlik ilkeleri |
| **FAB Navigation** | ✅ Aktif | v2.0 | Tüm ana sayfalarda tutarlı |
| **Bottom Tab Navigation** | ✅ Aktif | v2.0 | CBT tab kaldırıldı |
| **Mood Tracking (UI)** | ✅ Aktif | v1.0 | Kayıt + Geçmiş (14 gün) |
| **User-Centric CBT Dashboard** | ✅ Aktif | v2.1 | **YENİ!** 3-tab modal, dinamik achievements, sakin tasarım |
| **User-Centric Mood Dashboard** | ✅ Aktif | v2.1 | **YENİ!** 4-tab modal (Journey/Spectrum/Patterns/Prediction), dinamik veri |

## 🔧 Teknik Özellikler

| Özellik | Durum | Versiyon | Not |
|---|---|---|---|
| **AI Data Aggregation** | ✅ Aktif | v2.0 | Performance, patterns, triggers |
| **Offline Sync** | ✅ Aktif | v2.0 | Batch/summary, conflict resolution |
| **Data Standardization** | ✅ Aktif | v2.0 | Zod şemaları, PII maskeleme |
| **Data Encryption** | ✅ Aktif | v2.0 | AES-256-GCM |
| **Data Compliance** | ✅ Aktif | v2.0 | GDPR uyumlu export/delete |
| **Telemetry** | ✅ Aktif | v2.0 | AI/Sync metrikleri |
| **Progress Analytics** | ✅ Aktif | v1.0 | 7/30/90 günlük trendler |

## 📋 Son Güncellemeler (Ocak 2025)

### ✅ Tamamlanan
- Unified Voice Analysis sistemi (Gemini API)
- CBT sayfası yeniden tasarımı (Master Prompt uyumlu)
- BottomSheet entegrasyonu (CBT, OCD, ERP)
- Merkezi ses analizi ve otomatik yönlendirme
- Navigation yapısı optimizasyonu
- AutoRecord: OCD/CBT/Mood için PII temizliği, kullanıcı tercihi, idempotency ve offline mapping (ERP removed)
- CrossDeviceSync: Yalnızca !synced && !id yükleme; tüm metin alanlarında sanitizePII
- ~~ERP: Voice prefill QuickStart~~ - **REMOVED** - ERP module tamamen kaldırıldı
- Breathwork v2.0: Akıllı tetikleme sistemi
  - Check-in'den otomatik yönlendirme (protokol + autoStart)
  - ERP sırasında anksiyete eşiği tetiklemesi (≥7)
  - Today ekranında contextual öneriler (sabah/akşam/post-kompulsiyon)
  - Daily Missions'da nefes görevi (+30 puan)
  - JITAI/Adaptive Interventions entegrasyonu
  - Protokol seçimi: 4-7-8 (yüksek anksiyete), Box (normal), Paced (toparlanma)
  - Bottom tab'dan kaldırıldı (sadece akıllı tetiklemelerle erişim)

### ✅ Son Tamamlanan (Ocak 2025)
- **UnifiedAIPipeline v1.0 ACTIVATION** (%100 rollout)
- **CoreAnalysisService v1.0 ACTIVATION** 
- **ERP Module Complete Removal**
- Legacy service conflict protection
- Full telemetry and performance monitoring

### ✅ **Yeni Tamamlanan (Ocak 2025 - Son Hafta)**
- **User-Centric CBT Dashboard v2.1** (%100 tamamlandı)
  - 3-tab modal dashboard (Journey/Growth/Next Steps)
  - Dinamik achievements generation (hard-coded data kaldırıldı)
  - Master Prompt uyumlu sakin tasarım (anxiety-friendly colors)
  - Gerçek CBT progress data integration
  - Chart icon → dashboard açılımı
  
- **User-Centric Mood Dashboard v2.1** (%100 tamamlandı) 
  - 4-tab modal dashboard (Journey/Spectrum/Patterns/Prediction)
  - Dinamik mood data generation (hard-coded achievements kaldırıldı)
  - LinearGradient emotion spectrum visualization
  - Ana sayfa simplification (spectrum/pattern/prediction features dashboard'a taşındı)
  - Gerçek streak calculation ve personalized messaging

- **Dynamic Data Implementation** (%100 tamamlandı)
  - CBT: Personalized encouragement, real mood improvement achievements  
  - Mood: Real consecutive day streak, dynamic emotion distribution
  - Tamamen hard-coded mock veriler kaldırıldı (%95+ dinamikleştirme)

### 🚧 Devam Eden
- Performance optimizasyonları
- Test coverage artırımı
