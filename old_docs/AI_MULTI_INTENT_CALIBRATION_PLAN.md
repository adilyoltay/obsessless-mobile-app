# 🎯 **Multi-Intent Voice Analysis - Kalibrasyon ve İyileştirme Planı**

> **Durum:** Post v4.2.4 - JSON Parse ve Record Sorting çözüldü
> **Hedef:** Production-ready kalibrasyon ve performans optimizasyonu

## 📊 **MEVCUT DURUM (v4.2.4)**
- ✅ **Heuristic:** 4 modül tespit ediyor
- ✅ **LLM Response:** Mükemmel (OCD 0.98 confidence)  
- ✅ **JSON Parse:** Triple extraction method
- ✅ **Record Sorting:** Yeni kayıtlar en üstte
- ✅ **Multi-Module UI:** Alert ile modül seçimi

---

## 🔧 **8 KRİTİK KALİBRASYON ALANI**

### **1. 📏 Kalibrasyon**

#### **Eşik Ayarları (1-2 haftalık veri ile P/R/F1)**
```typescript
// Mevcut eşikler
MODULE_THRESHOLDS: {
  MOOD: 0.25,
  OCD: 0.20,      // Düşürüldü 0.35'den
  CBT: 0.30,      // Düşürüldü 0.40'dan  
  BREATHWORK: 0.45
}

// Hedef eşikler (gerçek veri sonrası)
CALIBRATED_THRESHOLDS: {
  ACCEPT: ≥0.80,     // Doğrudan kabul
  CONFIRM: 0.65-0.80, // Onay gerekli  
  ABSTAIN: <0.65      // Geri çekil
}
```

#### **Skor Birleşimi**
```typescript
// Mevcut: LLM_WEIGHT: 0.6, HEURISTIC_WEIGHT: 0.4
// OCD için özelleştirilmiş: 0.7/0.3 denenebilir
// Sınıf dengesizliğinde disambiguation zorunlu
```

### **2. 🧠 Heuristik Kapsam Genişletme**

#### **OCD Pattern Genişletme**
```typescript
// Eklenecek pattern'lar:
contamination: ["mikrop", "bulaş", "iğrenç", "kirli", "pislik"]
symmetry: ["simetri", "hizala", "eşit", "yamuk", "düzgün"]  
counting: ["üç kere", "5 kere", "saymadan duramıyorum"]
mental: ["kafamda tekrarlıyorum", "zihinsel", "düşüncede"]
```

#### **CBT Pattern Genişletme**
```typescript
// Eklenecek distortion'lar:
generalization: ["genelleme", "hep böyle", "hep öyle"]
mental_filter: ["seçici soyutlama", "sadece kötüsünü"]
labeling: ["etiketleme", "aptalım", "başarısızım"]
personalization: ["kişiselleştirme", "benim yüzümden"]
should_statements: ["mecburum", "şart", "kesin", "asla", "daima"]
```

#### **MOOD Pattern Zenginleştirme**
```typescript
// Bedensel semptomlar ve yoğunluk
energy: ["yorgun", "bitkin", "enerjim yok", "uyku"]
intensity: ["çok", "aşırı", "hiç", "fazla"]
duration: ["15 dk", "2 saat", "bütün gün"]
numeric: ["8/10", "5 üzerinden 2", "10 puan"]
```

#### **Türkçe Morfoloji Normalizasyonu**
```typescript
// Ek/sonek varyasyonları
suffixes: ["-dim", "-dım", "-sin", "-sın", "-lık", "-lik", "-de", "-da", "-den", "-dan"]
```

### **3. 🎯 Çoklu-Intent ve Kayıt Mantığı**

#### **Birleştirme Kuralları**
```typescript
// Aynı modüle ait birden çok clause
mergeRules: {
  severity: "MAX",      // En yüksek severity  
  duration: "AVERAGE",  // Ortalama süre
  frequency: "SUM"      // Toplam sıklık
}
```

#### **Öncelik Sistemi**
```typescript
// Risk bazlı öncelik
priority: {
  HIGH_RISK: "OCD severity ≥7 → önce OCD kaydı",
  SECONDARY: "İkincil modülleri prefill/taslak",
  LIMIT: "Tek check-in → max 2 doğrudan + 1 taslak"
}
```

#### **Auto-Save Matrisi (Güncellenmiş)**
```typescript
AUTO_SAVE_REQUIREMENTS: {
  MOOD: {
    required: ["mood_score"],
    optional: ["anxiety", "energy", "sleep", "trigger"],
    fallback: "prefill_missing"
  },
  CBT: {
    required: ["automatic_thought"], 
    optional: ["evidence", "distortions"],
    fallback: "draft_form"
  },
  OCD: {
    required: ["category", "severity"],
    compulsion_present: "direct_save",
    compulsion_missing: "QuickEntry_prefill"
  },
  BREATHWORK: {
    trigger: "anxiety ≥7",
    protocols: ["4-7-8", "box", "paced"],
    action: "auto_start"
  }
}
```

### **4. 🤖 LLM Sağlamlığı**

#### **Katı Şema Zorlama**
```typescript
// Bilinmiyorsa null bırak politikası
strictSchema: {
  unknownFields: null,
  fieldsWithConfidence: "required",
  parseError: "retry_with_simple_prompt"  
}
```

#### **Uzun Metin Stratejisi**
```typescript
// 2 aşamalı işlem
longText: {
  step1: "summarize",
  step2: "classify", 
  timeout: "1-1.5s",
  fallback: "heuristic + confirmation_UI"
}
```

#### **Deduplication**
```typescript
// Kullanıcı özel similarity
dedup: {
  similarity_threshold: 0.85,
  cache_duration: "≥1h", 
  skip_llm: "on_duplicate"
}
```

### **5. ⚡ Performans ve Gating**

#### **LLM Gating Logic**
```typescript
gatingRules: {
  allow: "textLength > 280 && heuristicConfidence < 0.8",
  block: "short_text + confidence ≥0.8"
}
```

#### **P95 Hedefler**
```typescript
performance: {
  cache_hit: "≤150ms",
  heuristic_fresh: "≤300ms", 
  llm_call: "≤3000ms",
  total_pipeline: "≤3500ms"
}
```

### **6. 📊 Telemetry ve Metrikler**

#### **Yeni Event'lar**
```typescript
events: [
  "CHECKIN_ROUTING_DECISION",
  "CHECKIN_USER_CORRECTION", 
  "FIELD_COMPLETENESS",
  "MULTI_RECORD_TRANSACTION"
]
```

#### **KPI Göstergeleri**
```typescript
metrics: {
  module_precision_recall_f1: "modül bazında",
  autosave_accuracy: "otomatik kayıt doğruluğu", 
  user_correction_rate: "kullanıcı düzeltme oranı",
  field_accuracy: "alan doğruluğu (örn. OCD severity ±1)",
  token_usage_daily: "token/gün",
  p95_latency: "heuristic/LLM ayrı"
}
```

#### **Confusion Matrix**
```typescript
// Haftalık confusion matrix
confusionMatrix: {
  period: "weekly",
  detect: "Always MOOD bias",
  track: "cross_module_confusion"
}
```

### **7. 🔐 Güvenlik ve Dayanıklılık**

#### **PII Sanitization**
```typescript
piiFlow: {
  step1: "STT",
  step2: "sanitize", 
  step3: "classification",
  rule: "telemetry'de PII yok"
}
```

#### **Offline-Refine Stratejisi**
```typescript
offlineFlow: {
  offline: "heuristic_record",
  online: "LLM_refine + correction_suggestion",
  user_choice: "optional"
}
```

#### **Transaction Safety**
```typescript
transaction: {
  multi_records: "atomic",
  failure: "rollback + DLQ",
  idempotency: "content_hash"
}
```

### **8. 🎨 UX İyileştirmeleri**

#### **Onay Chips**
```typescript
confirmationUI: {
  default: "suggested_option_selected",
  interaction: "single_tap_confirm",
  multi_record: "summary_notification + 5-10s undo"
}
```

#### **Prefill Şeffaflığı**
```typescript
prefillUX: {
  note: "Senden anladıklarımızla doldurduk",
  edit_option: "always_available",
  transparency: "data_source_visible"
}
```

---

## 🧪 **HIZLI TEST PAKETİ (Sanity)**

### **Test Senaryoları:**

1. **🔄 Mixed Intent:**
   ```
   "Moralim bozuk AMA kapıyı 5 kere kontrol ettim"
   → MOOD + OCD; mood_score + OCD(category=checking, frequency=5, severity çıkarımı)
   ```

2. **🧠 CBT Focus:**
   ```
   "Keşke dün söylemeseydim, herkes beni aptal sanıyor"  
   → CBT(thought + distortions: mind_reading/should)
   ```

3. **🦠 Contamination + Mood:**
   ```
   "Mikrop kaparım diye sürekli yıkıyorum, enerjim de yok"
   → OCD(contamination) + MOOD(düşük enerji)
   ```

4. **🫁 Panic + Breathwork:**
   ```
   "Panik geldi, nefes alamıyorum" 
   → BREATHWORK(anxiety≥7, 4-7-8) + (opsiyonel) MOOD
   ```

---

## 📋 **IMPLEMENTATION ROADMAP**

### **Phase 1: Kritik Düzeltmeler (1-2 gün)**
- [ ] Heuristik pattern genişletme (OCD/CBT/MOOD)
- [ ] Auto-save matrisi güncelleme  
- [ ] LLM timeout ve retry iyileştirme

### **Phase 2: Performans (3-5 gün)**  
- [ ] Gating logic implementasyonu
- [ ] Deduplication sistemi
- [ ] P95 metrik tracking

### **Phase 3: Kalibrasyon (1-2 hafta)**
- [ ] Gerçek veri toplama
- [ ] Eşik optimizasyonu (P/R/F1)
- [ ] Confusion matrix analizi

### **Phase 4: UX Polish (2-3 gün)**
- [ ] Onay chips UI
- [ ] Prefill transparency
- [ ] Transaction safety

---

**⏱️ Last Updated:** v4.2.4 - Ağustos 2025
**🎯 Next Milestone:** Production-ready calibration with real-world data
