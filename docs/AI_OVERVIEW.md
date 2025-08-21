# 🤖 AI Overview (Ocak 2025 - Güncellenmiş)

Bu belge, aktif AI modüllerini, Unified Voice Analysis sistemini, Gemini entegrasyonunu ve telemetri yaklaşımını tek çatı altında toplar.

> **⚠️ Kritik Not**: Mevcut sistemde 15+ AI modülü ve 30+ analiz algoritması bulunuyor. Bu karmaşıklık performans sorunlarına yol açıyor. Detaylı analiz için bkz: [AI_COMPLETE_FLOW_ANALYSIS.md](./AI_COMPLETE_FLOW_ANALYSIS.md)

## 🎯 Ana AI Modülleri ve Kullanım Durumları

### Unified Voice Analysis (YENİ)
- **Merkezi Ses Analizi**: Tüm ses girişleri tek noktadan işlenir
- **Gemini API Entegrasyonu**: Otomatik tip tespiti (MOOD/CBT/OCD/ERP/BREATHWORK)
- **Heuristik Fallback**: Gemini başarısız olursa regex tabanlı analiz
- **Otomatik Yönlendirme**: Analiz sonucuna göre ilgili sayfaya yönlendirme
- **Telemetry**: `UNIFIED_VOICE_ANALYSIS_STARTED/COMPLETED/FAILED`
- **Performans**: Ortalama 2-3 saniye yanıt süresi (optimize edilmeli)
- **Başarı Oranı**: Gemini %75, Heuristic %60

### CBT Engine v2.0 (GÜNCELLENDİ)
- **4-Adımlı Form**: Düşünce → Çarpıtmalar → Kanıtlar → Yeniden Çerçeveleme
- **AI Destekli Analiz**: Bilişsel çarpıtma tespiti ve reframe önerileri
- **BottomSheet UI**: Master Prompt ilkelerine uygun tasarım
- **Offline-First**: AsyncStorage + Supabase senkronizasyonu
- **Telemetry**: `CBT_FORM_STARTED/STEP_COMPLETED/SUBMITTED`

### Insights v2
- CBT + AI; Data Aggregation çıktıları ile öncelik/zamanlama ayarı
- 60 sn cooldown; kriz kategorileri kaldırıldı
- **Telemetry**: `INSIGHTS_REQUESTED/DELIVERED/CACHE_HIT/RATE_LIMITED`

### Pattern Recognition v2
- AI-assisted basitleştirilmiş akış
- Compulsion ve ERP pattern analizi
- **Telemetry**: `PATTERN_ANALYSIS_COMPLETED`

### ERP Önerileri
- AI tabanlı egzersiz önerileri (in_vivo/imaginal/interoceptive/response_prevention)
- Kullanıcı profiline göre kişiselleştirme
- **Telemetry**: `INTERVENTION_RECOMMENDED`

### Content Filtering
- AI yanıt güvenliği ve PII maskeleme
- **Telemetry**: `AI_CONTENT_FILTERED`

## 🏗️ Mimari Kısa Özet

### Katmanlar:
1. **AIManager**: Merkezi yönetim ve orchestration
   - 3 fazlı başlatma sistemi
   - Feature flag yönetimi
   - Health monitoring

2. **Core Services**:
   - External AI Service (Gemini entegrasyonu)
   - Pattern Recognition v2 (AI-assisted only)
   - Insights Engine v2 (3 kaynak)
   - CBT Engine (bilişsel çarpıtma tespiti)

3. **Storage Layer**:
   - AsyncStorage (offline-first)
   - Supabase (sync ve backup)
   - 60 saniye cache süresi
  - Storage wrapper: Geçersiz anahtar development modunda hata fırlatır; production’da uyarı + stack trace loglar
  - Mood: günlük anahtar `mood_entries_{userId}_{YYYY-MM-DD}`, history ekranı son 14 günü okur; best‑effort Supabase `mood_tracking` upsert
  - Aggregation: `features/ai/pipeline/enhancedDataAggregation.ts` hata durumlarını telemetriye işler (`AI_AGGREGATION_ERROR`); Supabase servis çağrıları instance bağlamıyla yapılır

## Gemini Entegrasyonu
- Env: EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GEMINI_MODEL
- Sağlayıcı: Gemini-only
- Performans ölçümü: AI_RESPONSE_GENERATED, AI_PROVIDER_HEALTH_CHECK/FAILED

## Telemetry Olayları (Seçki)
- Sistem: SYSTEM_INITIALIZED/STARTED/STATUS/STOPPED
- Insights: INSIGHTS_REQUESTED/DELIVERED, INSIGHTS_MISSING_REQUIRED_FIELDS, INSIGHTS_RATE_LIMITED, INSIGHTS_CACHE_HIT, INSIGHTS_CACHE_MISS, NO_INSIGHTS_GENERATED
  - Hata: AI_PROVIDER_API_ERROR (trackAIError ile yakalanır)
- JITAI: JITAI_INITIALIZED, JITAI_TRIGGER_FIRED
- Voice: CHECKIN_STARTED, ROUTE_SUGGESTED, CHECKIN_COMPLETED, STT_FAILED
- ERP: ERP_SESSION_STARTED/FINISHED, INTERVENTION_RECOMMENDED
- Güvenlik: AI_CONTENT_FILTERED; Hatalar: API_ERROR, SLOW_RESPONSE

## 🔄 Yeni Kullanıcı Akışları

### Unified Voice Analysis Akışı
```
Ses Girişi (Today Screen) 
    ↓
Unified Voice Analysis Service
    ↓
Gemini API Analizi / Heuristik Fallback
    ↓
Tip Tespiti (MOOD/CBT/OCD/ERP/BREATHWORK)
    ↓
Otomatik Sayfa Yönlendirmesi + Parametreler
    ↓
BREATHWORK ise: Protokol seçimi + AutoStart
```

### Breathwork Akıllı Tetikleme Akışı
```
Tetikleme Noktaları:
├── Check-in Analizi → BREATHWORK kategorisi
├── ERP Oturumu → Anksiyete ≥ 7
├── Today Ekranı → Contextual öneriler
│   ├── Sabah (7-9) → Morning routine
│   ├── Akşam (21-23) → Sleep prep
│   └── Post-kompulsiyon (30dk) → Recovery
└── JITAI/Adaptive → Risk faktörleri

Protokol Seçimi:
├── Yüksek anksiyete (≥7) → 4-7-8
├── Normal durum → Box (4-4-4-4)
└── Toparlanma → Paced (6-6)

Kullanıcı Kontrolü:
├── AutoStart (1.5sn gecikme)
├── Snooze (15dk ertele)
└── Dismiss (kapat)
```

### CBT Düşünce Kaydı Akışı
```
FAB Butonu (CBT Screen) / Voice Trigger
    ↓
CBT BottomSheet (4-Adım)
    ↓
1. Düşünce + Mood → 2. Çarpıtmalar → 3. Kanıtlar → 4. Yeniden Çerçeveleme
    ↓
AsyncStorage + Supabase Kayıt + Gamification
```

### Genel Ses Analizi Akışı
```
Herhangi bir Sayfadan Ses Girişi
    ↓ (Kaldırıldı)
Merkezi Today Screen Ses Girişi
    ↓
Unified Analysis → İlgili Sayfaya Yönlendirme
```

## 📊 Veri Akışı ve Performans Metrikleri

### Performans Darboğazları:
- **İlk Yükleme**: 3-4 saniye (hedef: <1 saniye)
- **AI Yanıt**: 2-3 saniye (hedef: <500ms)
- **Pattern Analysis**: 1-2 saniye (hedef: <300ms)
- **Bellek Kullanımı**: ~150MB (hedef: <80MB)

### Veri Akışı Değişiklikleri

### Yeni Veri Yapıları
- **`thought_records` tablosu**: CBT kayıtları için Supabase
- **Unified Analysis Results**: Tip, güven, öneri, parametreler
- **Voice Analysis Cache**: Performans optimizasyonu

### Kaldırılan Özellikler
- Sayfa bazlı ses check-in'leri (OCD, ERP)
- CBT tab (bottom navigation'dan)
- VoiceMoodCheckin bileşeni (CBT'den)

## 🎯 Feature Flag Durumu
- `AI_UNIFIED_VOICE`: ✅ Aktif
- `AI_CBT_ENGINE`: ✅ Aktif  
- `AI_CHAT`: ❌ Devre dışı
- `AI_ART_THERAPY`: ❌ Devre dışı
- `CRISIS_DETECTION`: ❌ Kaldırıldı

## 📋 Teknik Notlar ve Optimizasyon Fırsatları

### Mevcut Sorunlar:
1. **Aşırı AI Servis Sayısı**: 15+ servis paralel çalışıyor
2. **Generic Insights**: %70 oranında alakasız öneriler
3. **Yüksek API Maliyeti**: Gereksiz Gemini çağrıları
4. **Karmaşık Bağımlılıklar**: Debug ve test zorluğu

### Önerilen İyileştirmeler:
1. Servis konsolidasyonu (15 → 5 servis)
2. Agresif caching (60s → 24 saat)
3. Local-first AI (Gemini yerine heuristic)
4. Lazy loading ve progressive enhancement

### Teknik İlkeler
- **Master Prompt Compliance**: Tüm UI bileşenleri sakinlik, güç, zahmetsizlik ilkelerine uygun
- **BottomSheet Standardizasyonu**: Tutarlı kullanıcı deneyimi
- **Offline-First**: Tüm veriler önce local'de saklanır
- **Privacy-First**: PII maskeleme ve güvenli veri işleme
- **Performance**: Lazy loading ve cache optimizasyonları
