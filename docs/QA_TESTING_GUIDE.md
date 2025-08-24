# 🧪 ObsessLess - Quality Ribbon & AI Features Test Guide

## 📋 Test Rehberi Özet

Bu doküman **Quality Ribbon sistemi** ve tüm AI özelliklerini sayfa bazında nasıl test edeceğinizi açıklar. Her sayfa için step-by-step adımlar, beklenen sonuçlar ve troubleshooting ipuçları bulacaksınız.

---

## 🏠 Today (Bugün) Sayfası

### 🎯 Test Edilecek Özellikler:
- Multi-module AI analysis
- Adaptive Interventions (JITAI)
- Quality Ribbon metadata
- Deep insights with ALL module data
- Unified Pipeline integration

### 📱 Test Adımları:

**1. Başlangıç Durumu**
```
✅ Bottom navigation → "Bugün"
✅ Hero section'ı görün (healing points, streak counter)
✅ "AI analizleri yükleniyor..." mesajını bekleyin
```

**2. Temel Veri Ekleme**
```
✅ Mood entry ekleyin (2-3 tane)
✅ Compulsion kaydı yapın (1-2 tane) 
✅ CBT thought record oluşturun (opsiyonel)
```

**3. AI Pipeline Tetikleme**
```
✅ Sayfayı refresh edin (swipe down)
✅ "Phase 1: Quick insights" → "Phase 2: Deep analysis" sürecini izleyin
✅ Console loglarını kontrol edin:
   - "🚀 UNIFIED PIPELINE: Processing with ALL module data"
   - "✅ Phase 2: Deep insights loaded with ALL MODULE DATA"
```

**4. Quality Ribbon Test**
```
✅ Adaptive Suggestion kartı belirsin
✅ Sağ üst köşede Quality Ribbon kontrol edin:
   - [Fast][Med] veya [Fresh][High] 
   - [n=X] sample size
   - [Xm] yaş bilgisi
```

**5. Expected Analytics**
```
Console'da arayın:
📊 Minimal CBT analytics: sampleSize=X, volatility=X, weeklyDelta=X
📊 Minimal Tracking analytics: sampleSize=X, volatility=X, weeklyDelta=X
📊 Default quality metadata set for Today suggestion
```

**6. Interaction Test**
```
✅ "Şimdi Dene" → Doğru sayfaya yönlendirildiğinizi kontrol edin
✅ "Daha Sonra" → Kartın kaybolduğunu kontrol edin
✅ 2 saat sonra tekrar çıkmasını test edin (opsiyonel)
```

**🔍 Troubleshooting:**
- Adaptive suggestion çıkmıyorsa: Daha fazla veri ekleyin (5+ entries)
- Quality ribbon gözükmüyorsa: `adaptiveMeta` state'ini debug edin
- "Low" quality: 7+ veri noktası ekleyin

---

## 💭 Mood Sayfası

### 🎯 Test Edilecek Özellikler:
- Unified Voice Analysis
- Mood-specific AI insights
- Cross-module adaptive suggestions
- Clinical-grade mood analytics
- Quality Ribbon with pipeline data

### 📱 Test Adımları:

**1. Mood Entry Ekleme**
```
✅ Mood sayfasına gidin
✅ "+" butonuna basın
✅ Mood değerlerini girin (1-10 scale)
✅ Notes ekleme (opsiyonel)
✅ Kaydet
```

**2. Bulk Data İçin**
```
✅ 5-10 mood entry ekleyin (farklı günlerde)
✅ Çeşitli mood seviyeleri kullanın (1-10 arası)
✅ Bazılarına notes ekleyin
```

**3. AI Pipeline Tetikleme**
```
✅ Manual refresh yapın (pull to refresh)
✅ Console loglarını izleyin:
   - "🚀 Mood AI Pipeline triggered with unified system"
   - "📊 Quality metadata for mood suggestion: {...}"
   - "📊 Enhanced mood analytics attached to result"
```

**4. Quality Ribbon Test**
```
✅ AdaptiveSuggestionCard'ın çıkmasını bekleyin
✅ Quality Ribbon kontrol edin:
   Expected: [Fresh][High][n=10+][Xm]
   
Badge anlamları:
- Fresh: Taze AI analizi
- High: Yüksek güvenilirlik (7+ data point)
- n=X: Sample size
- Xm: X dakika önce analiz edildi
```

**5. Analytics Verification**
```
Console'da arayın:
📊 Mood analytics: confidence=0.85, sampleSize=10, volatility=0.8
📊 Quality metadata for mood suggestion: {
  source: 'unified',
  qualityLevel: 'high',
  sampleSize: 15,
  freshnessMs: 120000
}
```

**6. Dashboard Test**
```
✅ Mood charts'ın güncellendiğini kontrol edin
✅ Patterns'in göründüğünü kontrol edin
✅ Weekly/monthly view'ları test edin
```

**🔍 Troubleshooting:**
- Adaptive suggestion yok: En az 3 mood entry gerekli
- "Low" quality: 7+ entry ekleyin, çeşitliliği artırın
- Pipeline error: Console'da "UNIFIED_PIPELINE_ERROR" arayın

---

## 🧠 CBT (Düşünce Kaydı) Sayfası

### 🎯 Test Edilecek Özellikler:
- CBT thought record creation
- Mood before/after tracking
- CBT-specific analytics
- Quality Ribbon for CBT suggestions

### 📱 Test Adımları:

**1. Thought Record Oluşturma**
```
✅ CBT sayfasına gidin
✅ "Yeni Düşünce Kaydı" butonuna basın
✅ Formu doldurun:
   - Situation (durum)
   - Automatic thoughts (otomatik düşünceler)
   - Emotions & intensity (duygular ve yoğunluk)
   - Mood Before (1-10)
   - Balanced thoughts (dengeli düşünceler)  
   - Mood After (1-10)
✅ Kaydet
```

**2. Multiple Records**
```
✅ 3-5 CBT record oluşturun
✅ Farklı mood_before/after değerleri kullanın
✅ Çeşitli durumlar ve düşünceler ekleyin
```

**3. CBT Analytics Test**
```
✅ Today sayfasına gidin (CBT analytics pipeline'da çalışır)
✅ Console loglarını kontrol edin:
   "📊 Minimal CBT analytics: sampleSize=5, volatility=0.8, weeklyDelta=1.2"
```

**4. Quality Ribbon (if suggestions appear)**
```
CBT-specific adaptive suggestions için:
Expected: [Fresh][Med][n=5][Xm]

Analytics içeriği:
- sampleSize: CBT records sayısı
- volatility: Mood improvement'ın standart sapması
- weeklyDelta: Son 7 vs önceki 7 günün trend'i
```

**5. CBT Dashboard**
```
✅ Thought records listesini kontrol edin
✅ Progress indicators'ı görün
✅ Mood improvement trends'i kontrol edin
```

**🔍 Troubleshooting:**
- Analytics çıkmıyor: mood_before/after değerlerini kontrol edin
- Low sample size: Daha fazla CBT record ekleyin
- Pipeline error: UnifiedAIPipeline CBT analytics bölümünü debug edin

---

## 📊 Tracking (OCD) Sayfası

### 🎯 Test Edilecek Özellikler:
- Compulsion tracking
- OCD pattern recognition
- Tracking-specific analytics
- Resistance level tracking

### 📱 Test Adımları:

**1. Compulsion Kaydı**
```
✅ Tracking sayfasına gidin
✅ "Yeni Kayıt" butonuna basın
✅ Compulsion details girin:
   - Type (washing, checking, etc.)
   - Intensity (1-10)
   - Duration 
   - Resistance Level (1-5)
   - Location & trigger (opsiyonel)
✅ Kaydet
```

**2. Pattern Data Oluşturma**
```
✅ Farklı günlerde 10+ compulsion kaydı yapın
✅ Çeşitli types kullanın
✅ Farklı resistance levels deneyin
✅ Zamanları varyasyon yapın (sabah, öğle, akşam)
```

**3. Tracking Analytics Test**
```
✅ Today sayfasına gidin (analytics burada tetiklenir)
✅ Console loglarını izleyin:
   "📊 Minimal Tracking analytics: sampleSize=12, volatility=2.1, weeklyDelta=-1.2"
```

**4. Analytics Interpretation**
```
Tracking analytics içeriği:
- sampleSize: Total compulsions count
- volatility: Günlük compulsion count'un varyasyonu  
- weeklyDelta: Son 3 vs önceki 3 günün trend'i (negatif = azalma)
- baselines.compulsions: Günlük ortalama
```

**5. Patterns & Insights**
```
✅ Weekly patterns kontrol edin
✅ Peak times analysis görün
✅ Resistance trends'i kontrol edin
✅ Trigger analysis'i inceleyin
```

**🔍 Troubleshooting:**
- Analytics yok: En az 5 compulsion kaydı gerekli
- Volatility hesaplanmıyor: Farklı günlere spread edin
- Weekly delta yok: En az 6 günlük data gerekli

---

## 🫁 Breathwork (Nefes) Sayfası

### 🎯 Test Edilecek Özellikler:
- Breathing exercises
- Anxiety level tracking
- Breathwork suggestions
- Session completion tracking

### 📱 Test Adımları:

**1. Breathing Session**
```
✅ Breathwork sayfasına gidin
✅ Bir breathing technique seçin (4-7-8, box breathing, etc.)
✅ Anxiety level BEFORE girin (1-10)
✅ Session'ı tamamlayın
✅ Anxiety level AFTER girin (1-10)
✅ Session'ı kaydet
```

**2. Multiple Sessions**
```
✅ Farklı günlerde 5+ breathwork session yapın
✅ Farklı techniques deneyin
✅ Before/after anxiety levels'ı varyasyon yapın
```

**3. Breathwork Analytics**
```
Today sayfasında console loglarını kontrol edin:
- Breathwork session count
- Anxiety reduction average
- Best times for breathwork
```

**4. Integration Test**
```
✅ Breathwork suggestion card'ının Today'de çıkmasını test edin
✅ Mood sayfasında breathwork önerileri kontrol edin
✅ Adaptive suggestions prioritization test edin
```

---

## ⚙️ Settings (Ayarlar) Sayfası

### 🎯 Test Edilecek Özellikler:
- AI feature flags
- Privacy settings
- Notification preferences
- Data export/import

### 📱 Test Adımları:

**1. AI Settings**
```
✅ AI özelliklerini on/off yapın
✅ Unified Pipeline'ı disable/enable edin
✅ Debug mode'u aktif edin
✅ Verbose logging'i açın
```

**2. Privacy Controls**
```
✅ Data encryption settings'i kontrol edin
✅ PII sanitization'ı test edin
✅ Telemetry opt-out'u deneyin
```

**3. Feature Flags Test**
```
✅ FEATURE_FLAGS.isEnabled('AI_UNIFIED_PIPELINE') kontrol edin
✅ Farklı flags'i toggle edin
✅ App restart sonrası etkilerini görün
```

---

## 🔧 Cross-Page Integration Tests

### 🎯 Integration Scenarios:

**1. Full Pipeline Test**
```
Day 1: 
✅ 3 mood entries + 2 CBT records + 5 compulsions + 2 breathwork
✅ Today sayfasında "ALL module data" analysis'i bekleyin
✅ Quality Ribbon [Fresh][High][n=12+] olmasını kontrol edin

Day 2:
✅ Cached results'ı test edin → [Cache][Med] bekleyin  
✅ Manual refresh → [Fresh][High] bekleyin
```

**2. Quality Evolution Test**
```
Start: [Fast][Low][n=2] → Add data → [Fresh][Med][n=5] → More data → [Fresh][High][n=10+]
```

**3. Suggestion Prioritization**
```
✅ Today'de AdaptiveSuggestion varken BreathworkSuggestion gözükmemeli
✅ Adaptive dismiss edilince Breathwork çıkabilir
✅ Cooldown periods'u test edin
```

---

## 🐛 Debugging & Console Logs

### 🔍 Önemli Log Patterns:

**Pipeline Logs:**
```javascript
🚀 UNIFIED PIPELINE: Processing with mixed content
📊 Enhanced mood analytics attached to result  
📊 Minimal CBT analytics: sampleSize=5, volatility=0.8
📊 Quality metadata for mood suggestion: {...}
✅ Phase 2: Deep insights loaded with ALL MODULE DATA
```

**Quality Ribbon Logs:**
```javascript
📊 Quality metadata for mood suggestion: {
  source: 'unified',
  qualityLevel: 'high', 
  sampleSize: 15,
  freshnessMs: 120000
}
```

**Error Patterns:**
```javascript
⚠️ AI_UNIFIED_PIPELINE disabled - falling back to phase-1 insights
⚠️ Adaptive suggestion generation failed (non-blocking)
⚠️ Quality metadata generation failed
❌ UNIFIED_PIPELINE_ERROR: {...}
```

---

## 🎯 Success Criteria Checklist

### ✅ Must-Have Results:

**Quality Ribbon:**
- [ ] Mood sayfasında [Fresh][High] görünüyor  
- [ ] Today sayfasında [Fast][Med] görünüyor
- [ ] Badge'ler doğru renklerde
- [ ] Sample size doğru (n=X)
- [ ] Freshness bilgisi gösteriliyor (Xm)

**Analytics:**
- [ ] CBT analytics: volatility, weeklyDelta hesaplanıyor
- [ ] Tracking analytics: daily patterns, trends çıkarılıyor  
- [ ] Mood analytics: confidence, sampleSize doğru
- [ ] Pipeline integration çalışıyor

**User Experience:**
- [ ] Kartlar responsive ve accessible
- [ ] Suggestions doğru sayfalara yönlendiriyor
- [ ] Dismiss/Accept işlemleri çalışıyor
- [ ] Performance acceptable (< 3s pipeline)

**Privacy & Security:**
- [ ] PII sanitized telemetry'de
- [ ] Encryption working for sensitive data
- [ ] Audit trails oluşturuluyor
- [ ] Feature flags respect edilir

---

## 🚨 Known Issues & Limitations

### ⚠️ Expected Behaviors:

**Quality Ribbon:**
- İlk 2-3 veri noktasında "Low" quality normal
- Cache hit'lerde "Med" quality expected  
- Heuristic fallback'lerde "Fast" source normal

**Pipeline:**
- 7+ veri noktası altında "Med/Low" quality
- Cold start'ta ilk analysis biraz yavaş
- Feature flag disabled'da heuristic fallback

**Suggestions:**  
- Quiet hours'da suggestion yok (23:00-07:00)
- 2 saatlik cooldown period var
- Single suggestion policy (tekli gösterim)

---

## 📞 Support & Debug

Bu test rehberinde sorun yaşarsanız:

1. **Console logs'ı kontrol edin** - Yukarıdaki patterns'ı arayın
2. **State'leri debug edin** - `adaptiveMeta`, `insightsSource` vb.  
3. **Feature flags'i kontrol edin** - Settings sayfasından
4. **Data sufficiency'yi kontrol edin** - En az 3-5 entry gerekli
5. **Network connectivity** - Supabase connection kontrol edin

**Debug Mode Aktivasyon:**
```javascript
// Settings → Developer Options → Debug Mode: ON
// Console'da daha detaylı loglar görürsünüz
```

---

Happy Testing! 🎉
