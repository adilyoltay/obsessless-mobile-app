# 🤖 AI Overview (Ocak 2025)

Bu belge, aktif AI modüllerini, Unified Voice Analysis sistemini, Gemini entegrasyonunu ve telemetri yaklaşımını tek çatı altında toplar.

## 🎯 Ana AI Modülleri

### Unified Voice Analysis (YENİ)
- **Merkezi Ses Analizi**: Tüm ses girişleri tek noktadan işlenir
- **Gemini API Entegrasyonu**: Otomatik tip tespiti (MOOD/CBT/OCD/ERP/BREATHWORK)
- **Heuristik Fallback**: Gemini başarısız olursa regex tabanlı analiz
- **Otomatik Yönlendirme**: Analiz sonucuna göre ilgili sayfaya yönlendirme
- **Telemetry**: `UNIFIED_VOICE_ANALYSIS_STARTED/COMPLETED/FAILED`

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

## Mimari Kısa Özet
- aiManager: başlatma/flag/sağlık kontrol
- Telemetry: enum doğrulamalı, privacy-first
- Storage: AsyncStorage (offline-first) + Supabase (sync)
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

## 📊 Veri Akışı Değişiklikleri

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

## 📋 Teknik Notlar
- **Master Prompt Compliance**: Tüm UI bileşenleri sakinlik, güç, zahmetsizlik ilkelerine uygun
- **BottomSheet Standardizasyonu**: Tutarlı kullanıcı deneyimi
- **Offline-First**: Tüm veriler önce local'de saklanır
- **Privacy-First**: PII maskeleme ve güvenli veri işleme
- **Performance**: Lazy loading ve cache optimizasyonları
