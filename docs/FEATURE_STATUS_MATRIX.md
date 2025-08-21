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
| **ERP Sessions** | ✅ Aktif | v2.0 | FAB butonu, AI önerileri, ses check-in kaldırıldı |
| **Breathwork** | ✅ Aktif | v2.0 | Akıllı tetikleme sistemi, contextual öneriler, protokol seçimi |
| **Today Screen** | ✅ Aktif | v2.0 | Merkezi ses girişi, otomatik yönlendirme |

## 🤖 AI Özellikleri

| Özellik | Durum | Versiyon | Not |
|---|---|---|---|
| **CoreAnalysisService** | ✅ Aktif | v1.0 | Single-entry AI, LLM gating (-%70 API), Token budget (20K/day), Similarity dedup, Multi-layer cache (24h/12h/1h TTL), Progressive UI (300ms/3s) |
| **Unified AI Pipeline** | 🔄 Rollout | v1.0 | Voice + Pattern + Insights + CBT birleşik, 24h cache, Gradual rollout %10→%100 |
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
- AutoRecord: OCD/CBT/Mood/ERP için PII temizliği, kullanıcı tercihi, idempotency ve offline mapping
- CrossDeviceSync: Yalnızca !synced && !id yükleme; tüm metin alanlarında sanitizePII
- ERP: Voice prefill QuickStart, timestamp'li ERP auto-record verisi; prefill döngüsü düzeltildi
- Breathwork v2.0: Akıllı tetikleme sistemi
  - Check-in'den otomatik yönlendirme (protokol + autoStart)
  - ERP sırasında anksiyete eşiği tetiklemesi (≥7)
  - Today ekranında contextual öneriler (sabah/akşam/post-kompulsiyon)
  - Daily Missions'da nefes görevi (+30 puan)
  - JITAI/Adaptive Interventions entegrasyonu
  - Protokol seçimi: 4-7-8 (yüksek anksiyete), Box (normal), Paced (toparlanma)
  - Bottom tab'dan kaldırıldı (sadece akıllı tetiklemelerle erişim)

### 🚧 Devam Eden
- Supabase migration (thought_records tablosu)
- Performance optimizasyonları
- Test coverage artırımı
