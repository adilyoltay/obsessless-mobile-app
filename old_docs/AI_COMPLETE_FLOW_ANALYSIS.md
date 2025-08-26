# 🧠 ObsessLess AI ve Analiz Sistemlerinin Tam Akış Analizi

> **Son Güncelleme**: Ocak 2025 - UnifiedAIPipeline v1.0 Migration

## 📋 Yönetici Özeti

ObsessLess uygulaması, **UnifiedAIPipeline v1.0** ile konsolide edilmiş AI mimarisi sunuyor. Önceki **15+ AI modülü** ve **30+ analiz algoritması** yerine, tek giriş noktası ve akıllı yönlendirme ile performans ve kullanıcı deneyimi optimize edildi.

### ✅ Yapılan İyileştirmeler (UnifiedAIPipeline v1.0):
- **Tek Giriş Noktası**: Tüm AI analizleri `unifiedPipeline.process()` üzerinden
- **LLM Gating**: Gereksiz API çağrılarını %70 azaltan akıllı filtreleme
- **Token Budget Manager**: Kullanıcı bazlı günlük limit (20K token) ve rate limiting
- **Similarity Dedup**: Tekrarlayan istekleri önleyen deduplication
- **Progressive UI**: Immediate → Deep analiz ile hızlı yanıt (300ms → 3s)
- **Deterministik Cache**: TTL yönetimi (24h insights, 1h voice) - ERP cache removed
- **Hybrid Batch Jobs**: Günlük @03:05 trend/mood/risk analizleri

### 📊 Performans İyileştirmeleri:
- **İlk Yanıt Süresi**: 2-4 saniye → 300ms (Progressive UI)
- **API Çağrıları**: %70 azalma (LLM Gating + Cache)
- **Token Tüketimi**: %60 azalma (Dedup + Budget)
- **Cache Hit Rate**: %45 (deterministik invalidation)

## 🏗️ Mevcut AI Mimarisi

### 1. Merkezi Yönetim Katmanı

```
AIManager (aiManager.ts)
├── Phased Initialization (4 aşamalı başlatma)
│   ├── Phase 0: UnifiedAIPipeline + Daily Jobs (GÜNCEL)
│   ├── Phase 1: External AI, CBT Engine, Therapeutic Prompts
│   ├── Phase 2: Insights v2, Pattern Recognition v2
│   └── Phase 3: Smart Notifications, JITAI
├── Feature Flag Management
│   ├── AI_UNIFIED_PIPELINE (UnifiedAIPipeline aktif/pasif)
│   ├── AI_LLM_GATING (LLM filtreleme)
│   ├── AI_PROGRESSIVE (Progressive UI)
│   ├── AI_ONBOARDING_REFINE (Skeleton→Refine)
│   └── ~~AI_THERAPY_STAIRCASE~~ - **REMOVED** - ERP module deleted
├── Health Monitoring
└── Telemetry Collection (Enhanced)
    ├── Cache Events (hit/miss)
    ├── Gating Decisions
    ├── Token Budget
    └── Similarity Dedup
```

### 2. Ana AI Modülleri ve İlişkileri (CoreAnalysisService v1)

```mermaid
graph TB
    User[Kullanıcı Girişi] --> CAS[🎯 CoreAnalysisService]
    
    CAS --> CACHE{Cache Check}
    CACHE -->|Hit| IMMEDIATE[Immediate Result]
    CACHE -->|Miss| DEDUP{Similarity Check}
    
    DEDUP -->|Duplicate| CACHED[Return Cached]
    DEDUP -->|Unique| HEUR[Heuristic Analysis]
    
    HEUR --> GATE{LLM Gating}
    GATE -->|Block<br/>High Confidence| QUICK[Quick Result]
    GATE -->|Allow<br/>Low Confidence| BUDGET{Token Budget}
    
    BUDGET -->|Exceeded| FALLBACK[Heuristic Fallback]
    BUDGET -->|Available| LLM[Gemini API]
    
    LLM --> DEEP[Deep Analysis]
    
    QUICK --> ROUTER[Type Router]
    DEEP --> ROUTER
    IMMEDIATE --> ROUTER
    
    ROUTER --> MOOD[Mood]
    ROUTER --> CBT[CBT]
    ROUTER --> OCD[OCD]
    ROUTER --> BREATH[Breathwork]
    
    MOOD --> STORE[Result Cache<br/>TTL: 24h/1h]
    CBT --> STORE
    OCD --> STORE
    BREATH --> STORE
```

## 🚀 UnifiedAIPipeline v1.0 Özellikleri

### 🎯 Tek Giriş Noktası
```typescript
interface AnalysisInput {
  kind: 'VOICE' | 'TEXT' | 'SENSOR';
  content: string;
  userId: string;
  locale: 'tr-TR' | 'en-US';
  ts: number;
}

interface AnalysisResult {
  quickClass: 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK' | 'OTHER';
  confidence: number;
  needsLLM: boolean;
  route: 'OPEN_SCREEN' | 'AUTO_SAVE' | 'SUGGEST_BREATHWORK';
  payload: any;
  source: 'heuristic' | 'llm' | 'cache';
}
```

### 🔒 LLM Gating Logic
- **MOOD/BREATHWORK**: Confidence ≥ 0.65 → Heuristic yeterli
- **Uzun metin** (>280 char) + düşük confidence (<0.8) → LLM gerekli
- **Çok düşük confidence** (<0.6) → Her zaman LLM
- **Recent duplicate** (<1 saat) → Cache kullan
- **CBT/OCD/ERP**: Medium confidence (<0.8) → LLM gerekli

### 💰 Token Budget Management
- **Günlük limit**: 20,000 token/kullanıcı (soft limit)
- **Rate limit**: 3 istek/10 dakika
- **Aşım durumu**: Heuristic fallback
- **Reset**: Her gece 00:00 (Istanbul TZ)

### 🔁 Similarity Deduplication
- **Cache boyutu**: 100 hash
- **TTL**: 60 dakika
- **Similarity threshold**: 0.9 (Jaccard)
- **Normalization**: Lowercase, whitespace collapse, Turkish chars

### 💾 Multi-Layer Cache
- **Insights**: 24 saat TTL
- **Voice Analysis**: 1 saat TTL
- **Today Digest**: 12 saat TTL
- **ERP Plans**: ~~REMOVED~~ - ERP module deleted
- **Cache key format**: `ai:{userId}:{dayKey}:{type}:{hash}`

### 🔄 Cache Invalidation Triggers
- `CBT_THOUGHT_CREATED/UPDATED` → Insights + Today Digest
- `YBOCS_UPDATED` → Tüm kullanıcı cache'i
- `ONBOARDING_FINALIZED` → Full reset
- `DAY_ROLLOVER` → Önceki gün cache'i
- ~~`ERP_SESSION_COMPLETED`~~ → **REMOVED** - ERP module deleted

## 📊 Modül Bazlı AI Kullanımı (Güncellenmiş)

### 🎯 ONBOARDING MODÜLÜ

**AI Kullanımı:**
1. **Y-BOCS Analizi** (ybocsAnalysisService)
   - 20 soruya verilen yanıtları skorlar
   - OKB şiddetini belirler (0-40 puan)
   - Semptom tiplerini kategorize eder

2. **Treatment Planning** (treatmentPlanningEngine)
   - Y-BOCS sonuçlarına göre tedavi planı oluşturur
   - 3 fazlı plan: Başlangıç → İlerleme → Sürdürme
   - Kültürel adaptasyon (Türkiye bağlamı)
   - ERP egzersiz önerileri hazırlar

3. **Risk Assessment** (riskAssessmentService)
   - İntihar riski değerlendirmesi
   - Acil müdahale gerekliliği kontrolü
   - Aile desteği seviyesi analizi

**Veri Akışı:**
```
Kullanıcı Yanıtları → Y-BOCS Skorlama → Risk Değerlendirme → Treatment Plan
                                      ↓
                            AsyncStorage + Supabase Kayıt
                                      ↓
                            Today Screen'de Plan Gösterimi
```

**İyileştirmeler (CoreAnalysisService v1):**
- **Skeleton→Refine**: Hızlı draft plan (30s) + background refinement
- **Progressive Treatment Plan**: İlk basit plan, zamanla zenginleşir
- **Batch Risk Assessment**: Günlük @03:05 detaylı risk analizi

---

### 🏠 TODAY (ANA SAYFA) MODÜLÜ

**AI Kullanımı (Progressive UI ile):**
1. **Immediate Insights** (< 300ms)
   - Cache'ten veya heuristic'ten hızlı yükleme
   - Temel insight kartları gösterimi
   - "Yükleniyor" badge'i

2. **Deep Insights** (3 saniye gecikme)
   - Background'da LLM analizi
   - Enhanced insights
   - "Güncellendi" badge'i ile refresh
   - Source gösterimi (cache/heuristic/llm)

2. **Breathwork Önerileri**
   - Zaman bazlı (sabah 7-9, akşam 21-23)
   - Kompulsiyon sonrası (30 dk içinde)
   - Yüksek anksiyete (≥7) durumunda
   - Protokol seçimi: Box, 4-7-8, Paced

3. **Unified Voice Analysis** 
   - Merkezi ses girişi noktası
   - Gemini API ile tip tespiti
   - 5 kategoriye yönlendirme

**Veri Akışı:**
```
Sayfa Yükleme → loadAIInsights() → Insights Coordinator
                                 ↓
                    Pattern Recognition + Insights Engine
                                 ↓
                         Insight Kartları Gösterimi
```

**İyileştirmeler (CoreAnalysisService v1):**
- **Progressive UI**: 300ms'de immediate insights, 3s'de deep insights
- **LLM Gating**: Sadece gerektiğinde LLM, %70 daha alakalı sonuçlar
- **Smart Triggering**: Token budget ve dedup ile optimize öneriler

---

### 🧠 CBT MODÜLÜ

**AI Kullanımı:**
1. **Bilişsel Çarpıtma Tespiti** (cbtEngine)
   - 10 çarpıtma tipini tespit eder
   - Regex pattern matching kullanır
   - Confidence score hesaplar

2. **Reframe Önerileri**
   - External AI Service ile reframe üretir
   - Kültürel bağlama uygun öneriler
   - Therapeutic prompts entegrasyonu

3. **CBT Form Akışı** (4 adım)
   - Düşünce kaydı
   - Çarpıtma seçimi
   - Kanıt toplama
   - Yeniden çerçeveleme

**Veri Akışı:**
```
Voice/Text Girişi → Çarpıtma Tespiti → AI Reframe Önerisi
                           ↓
              thought_records Tablosu (Supabase)
                           ↓
                    Progress Tracking
```

**İyileştirmeler (CoreAnalysisService v1):**
- **LLM-Enhanced Detection**: Confidence score ile güçlü tespit
- **Context-aware Reframe**: Kişiselleştirilmiş öneriler
- **Inline Suggestions**: Form akışında otomatik öneriler

---

### 📝 OCD/TRACKING MODÜLÜ

**AI Kullanımı:**
1. **Pattern Recognition v2**
   - Kompulsiyon paternleri analizi
   - Tetikleyici tespiti
   - Zaman bazlı trendler

2. **AI Insights**
   - Son 50 kompulsiyon analizi
   - Trend grafikleri
   - Kategori dağılımı

**Veri Akışı:**
```
Kompulsiyon Kaydı → AsyncStorage → Pattern Analysis
                                ↓
                        Trend Insights
                                ↓
                        Grafik Gösterimi
```

**İyileştirmeler (CoreAnalysisService v1):**
- **Hybrid Pattern Detection**: Heuristic + LLM kombinasyonu
- **Temporal Patterns**: Zaman bazlı trend analizi @03:05
- **Deep Insights**: Progressive UI ile zengin analizler

---

### 💪 ERP MODÜLÜ

**AI Kullanımı:**
1. **ERP Recommendations** (erpRecommendationService)
   - Treatment plan'a göre egzersiz önerisi
   - Zorluk seviyesi hesaplama
   - Kültürel adaptasyon

2. **Adaptive ERP** (adaptiveErp)
   - Gerçek zamanlı anksiyete takibi
   - Zorluk ayarlama
   - AI rehberlik mesajları

3. **Session Analytics**
   - Başarı metrikleri
   - İlerleme takibi
   - Habituation tespiti

**Veri Akışı:**
```
Treatment Plan → ERP Önerileri → Kullanıcı Seçimi
                              ↓
                    Adaptive Session Başlatma
                              ↓
                    Anksiyete Takibi → AI Rehberlik
                              ↓
                    Session Kayıt ve Analiz
```

**İyileştirmeler (CoreAnalysisService v1):**
- **ERP Staircase**: Deterministik zorluk ayarlaması (+1/-1)
- **Progressive Difficulty**: Floor (1) ve ceiling (10) limitleri
- **Personalized Guidance**: Kişiselleştirilmiş AI mesajları

---

### 🌬️ BREATHWORK MODÜLÜ

**AI Kullanımı:**
1. **Akıllı Tetikleme**
   - Contextual öneriler (zaman, mood, kompulsiyon)
   - Protokol seçimi (anksiyete seviyesine göre)
   - Auto-start mekanizması

2. **Voice Yönlendirme**
   - Unified analysis'ten BREATHWORK tespiti
   - Parametreli yönlendirme
   - Toast mesajları

**Veri Akışı:**
```
Tetikleyici → Protokol Seçimi → Auto-start
          ↓
    Nefes Seansı → breath_sessions Kayıt
          ↓
    Progress Tracking
```

**İyileştirmeler (CoreAnalysisService v1):**
- **Smart Triggering**: Token budget ve dedup ile optimize
- **Adaptive Protocol**: Anksiyete seviyesine göre protokol
- **Session Tracking**: breath_sessions tablosu ile takip

---

## 🔄 Veri Akış Haritası (CoreAnalysisService v1)

### Yeni Optimized Pipeline:

```
1. INPUT LAYER
   ├── Voice/Text/Sensor → CoreAnalysisService
   └── Normalization + Dedup Check

2. CACHING LAYER
   ├── Result Cache (TTL: 24h/12h/1h)
   ├── Similarity Dedup (60 min window)
   └── Invalidation Triggers

3. ANALYSIS LAYER
   ├── Heuristic Classification (immediate)
   ├── LLM Gating Decision
   ├── Token Budget Check
   └── External AI (if needed)

4. ROUTING LAYER
   ├── MOOD → mood_entries + content_hash
   ├── CBT → thought_records + idempotent
   ├── OCD → compulsion_records
   ├── ~~ERP~~ → **REMOVED** - ERP module deleted
   └── BREATHWORK → breath_sessions

5. BATCH PROCESSING (@03:05 daily)
   ├── Trend Calculation
   ├── Mood Smoothing
   ├── Risk Updates
   ├── Today Digest Precompute
   └── Cache Cleanup
```

### Telemetry Olayları (Enhanced):

```
CORE_ANALYSIS: CACHE_HIT, CACHE_MISS, LLM_GATING_DECISION
BUDGET: TOKEN_BUDGET_EXCEEDED, USAGE_RECORDED
DEDUP: SIMILARITY_DEDUP_HIT
PROGRESSIVE: IMMEDIATE_SHOWN, DEEP_UPDATE
BATCH: JOB_STARTED, JOB_COMPLETED, JOB_FAILED
~~ERP: STAIRCASE_ADJUSTMENT~~ - **REMOVED** - ERP module deleted
```

## ✅ Çözülen Sorunlar (CoreAnalysisService v1)

### 1. **Basitleştirilmiş Mimari** ✅
- ~~15+ AI servisi~~ → Tek CoreAnalysisService
- ~~Karmaşık bağımlılıklar~~ → Modüler orchestrator
- ~~Debug zorluğu~~ → Zengin telemetry

### 2. **Performans İyileştirmeleri** ✅
- ~~İlk yükleme: 3-4 saniye~~ → 300ms (Progressive UI)
- ~~AI yanıt: 2-3 saniye~~ → Immediate + Deep (300ms + 3s)
- ~~Çok fazla API çağrısı~~ → %70 azalma (LLM Gating)

### 3. **Yüksek Değer/Düşük Gürültü** ✅
- ~~Generic insights~~ → Context-aware LLM analizi
- ~~Alakasız öneriler~~ → Similarity dedup + gating
- ~~False positive~~ → Confidence thresholds

### 4. **Optimize Kaynak Kullanımı** ✅
- ~~Yüksek bellek~~ → Lazy loading + cache eviction
- ~~Batarya tüketimi~~ → Batch processing @03:05
- ~~Network trafiği~~ → Cache + dedup

## 💡 Optimizasyon Önerileri

### ✅ KISA VADELİ (1-2 Hafta)

1. **AI Servis Konsolidasyonu**
   ```
   Mevcut: 15+ servis
   Hedef: 5 çekirdek servis
   
   Birleştirilecek:
   - Pattern Recognition + Insights Engine → Single Analysis Service
   - CBT + Therapeutic Prompts → Unified Therapy Engine
   - All notification services → Single Notification Manager
   ```

2. **Lazy Loading & Caching**
   - AI servisleri lazy initialize
   - Agresif cache (24 saat)
   - Offline-first yaklaşım

3. **Basitleştirilmiş Voice Analysis**
   - Gemini yerine local heuristic
   - 3 kategori: MOOD, TASK, HELP
   - Daha hızlı yönlendirme

### ✅ ORTA VADELİ (1 Ay)

1. **Modüler AI Architecture**
   ```
   Core AI Service
   ├── Analysis Module (tek endpoint)
   ├── Recommendation Module
   └── Notification Module
   ```

2. **Smart Batching**
   - Günlük tek analiz
   - Background processing
   - Progressive enhancement

3. **Context-Aware AI**
   - Sadece gerektiğinde AI
   - Rule-based fallbacks
   - User preference learning

### ✅ UZUN VADELİ (3 Ay)

1. **Edge AI Migration**
   - On-device ML modelleri
   - Offline AI capabilities
   - Privacy-first approach

2. **Adaptive Complexity**
   - Kullanıcı seviyesine göre AI
   - Başlangıç: Basit
   - İleri: Gelişmiş analizler

3. **AI Orchestrator**
   - Tek merkezi koordinatör
   - Intelligent routing
   - Resource management

## 📈 Beklenen İyileştirmeler

### Performans:
- **%60** daha hızlı ilk yükleme
- **%40** daha az API çağrısı
- **%50** daha az bellek kullanımı

### Kullanıcı Deneyimi:
- Daha alakalı öneriler
- Daha hızlı yanıtlar
- Daha az cognitive load

### Geliştirici Deneyimi:
- Daha kolay debug
- Daha basit test
- Daha hızlı iterasyon

## 🎯 Öncelikli Aksiyon Planı

1. **Hafta 1**: Pattern Recognition ve Insights Engine birleştirme
2. **Hafta 2**: Voice Analysis basitleştirme
3. **Hafta 3**: Notification konsolidasyonu
4. **Hafta 4**: Cache ve lazy loading implementasyonu

## 📊 Metrikler ve KPI'lar

- **Time to First Insight**: < 1 saniye (şu an: 3-4 saniye)
- **AI Response Time**: < 500ms (şu an: 2-3 saniye)
- **Relevant Insight Rate**: > %70 (şu an: ~%30)
- **User Engagement**: +%40 artış hedefi

---

*Bu doküman, UnifiedAIPipeline v1.0 ACTIVATION sonrası güncellenmiştir (Ocak 2025). CoreAnalysisService ve UnifiedAIPipeline ACTIVE durumda çalışıyor ve tek giriş noktası mimarisi %100 rollout ile başarıyla uygulanmıştır. ERP modülü tamamen kaldırılmıştır.*

## 🔗 İlgili Dokümanlar
- [AI Overview](./AI_OVERVIEW.md) - Genel AI mimarisi
- [AI Optimization Proposal](./AI_OPTIMIZATION_PROPOSAL.md) - Detaylı optimizasyon planı
- [AI Analysis Mindmap](./AI_ANALYSIS_MINDMAP.md) - Görsel analiz haritası
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) - Sistem mimarisi
- [Feature Status Matrix](./FEATURE_STATUS_MATRIX.md) - Özellik durumları
