# 🎗️ Quality Ribbon - Manuel Test Guide

## 🎯 Test Amacı
Quality Ribbon sisteminin doğru çalıştığını manuel olarak doğrulama rehberi.

---

## 📋 Test Checklist

### **✅ 1. Temel Görünüm Testleri**

#### **Today Sayfası - Adaptive Suggestion**
```bash
1. Uygulamayı açın
2. Today sayfasında AdaptiveSuggestionCard bulun
3. Quality Ribbon badge'lerini kontrol edin:
   - Source badge (Fresh/Cache/Heuristic/LLM)
   - Quality badge (High/Med/Low) 
   - Sample size (n=X)
   - Freshness (Xm/Xh/Xd)
```

#### **Mood Sayfası - Analytics Suggestion** 
```bash
1. Mood sayfasını açın
2. Pull-to-refresh yapın
3. Analytics processing loglarını console'da kontrol edin:
   - "🎯 Processing enhanced mood analytics"
   - "📊 Quality metadata for mood suggestion"
4. Quality Ribbon'ın görüntülendiğini doğrulayın
```

### **✅ 2. Source Type Badge Testleri**

| Source Type | Expected Badge | Test Scenario |
|-------------|----------------|---------------|
| `unified` | Fresh (🟢) | Yeni pipeline analizi |
| `cache` | Cache (🔘) | Cached sonuç |
| `heuristic` | Fast (🟡) | Rule-based analiz |
| `llm` | LLM (🟣) | AI language model |

**Test Adımları:**
```bash
1. Farklı kaynaklardan suggestion'lar tetikleyin
2. Her source type için doğru badge göründüğünü onaylayın
3. Renk kodlarının doğru olduğunu kontrol edin
```

### **✅ 3. Quality Level Badge Testleri**

| Quality Level | Expected Badge | Sample Size Threshold |
|---------------|----------------|----------------------|
| `high` | High (🟢) | n ≥ 10 |
| `medium` | Med (🟡) | 5 ≤ n < 10 |
| `low` | Low (🔴) | n < 5 |

**Test Senaryoları:**
```bash
# High Quality Test
1. 10+ mood entry'si olan durumu test edin
2. "High" badge'inin görüntülendiğini doğrulayın

# Medium Quality Test  
1. 5-9 mood entry'si olan durumu test edin
2. "Med" badge'inin görüntülendiğini doğrulayın

# Low Quality Test
1. <5 mood entry'si olan durumu test edin  
2. "Low" badge'inin görüntülendiğini doğrulayın
```

### **✅ 4. Freshness Display Testleri**

| Freshness | Expected Display | Test Method |
|-----------|------------------|-------------|
| < 1 hour | "Xm" (minutes) | Recent activity |
| 1-24 hours | "Xh" (hours) | Moderate age |
| > 24 hours | "Xd" (days) | Older data |

**Console Test:**
```javascript
// Chrome DevTools Console
const testFreshness = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);  
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;  
  if (minutes > 0) return `${minutes}m`;
  return 'now';
};

// Test cases
console.log(testFreshness(120000));   // "2m"
console.log(testFreshness(7200000));  // "2h" 
console.log(testFreshness(172800000)); // "2d"
```

### **✅ 5. Conditional Rendering Testleri**

#### **Ribbon Gizlenme Testleri**
```bash
1. Quality metadata olmadığında ribbon gösterilmemeli
2. Suggestion olmadığında ribbon gösterilmemeli  
3. Error durumunda ribbon graceful olarak gizlenmeli
```

#### **Partial Data Testleri**
```bash
1. Sadece source varsa → Sadece source badge
2. Sadece quality varsa → Sadece quality badge
3. Sample size eksikse → "n=X" badge gizli
```

### **✅ 6. Interaction Testleri**

#### **Adaptive Suggestion Actions**
```bash
1. "Şimdi Dene" butonu testleri:
   - Tıklanabilir olduğunu doğrulayın
   - Navigation'ın çalıştığını kontrol edin
   - Telemetry tracking'in loglandığını onaylayın

2. "Daha Sonra" butonu testleri:
   - Suggestion'ın snooze edildiğini doğrulayın
   - Cooldown süresinin başladığını kontrol edin
```

---

## 🔍 Debug Console Commands

### **Quality Metadata Inspector**
```javascript
// Chrome DevTools'da çalıştırın
window.qualityRibbonDebug = {
  logMetadata: (meta) => {
    console.log('🎗️ Quality Ribbon Debug:', {
      source: meta?.source || 'undefined',
      quality: meta?.qualityLevel || 'undefined', 
      sampleSize: meta?.sampleSize || 'undefined',
      freshness: meta?.freshnessMs ? `${Math.floor(meta.freshnessMs/60000)}m` : 'undefined'
    });
  }
};
```

### **Suggestion State Inspector**
```javascript
// Adaptive suggestion state'i kontrol edin
console.log('🎯 Current Suggestions:', {
  todayPage: window.todaySuggestions || 'Not found',
  moodPage: window.moodSuggestions || 'Not found'
});
```

---

## 📊 Test Results Template

```markdown
## Quality Ribbon Test Results - [Date]

### ✅ Passed Tests
- [ ] Basic rendering (Today/Mood pages)
- [ ] Source type badges (Fresh/Cache/Heuristic/LLM)
- [ ] Quality level badges (High/Med/Low) 
- [ ] Sample size display (n=X)
- [ ] Freshness formatting (Xm/Xh/Xd)
- [ ] Conditional rendering (show/hide)
- [ ] User interactions (buttons)

### ❌ Failed Tests
- List any issues found
- Include console error logs
- Note inconsistent behavior

### 🔧 Fixes Applied
- Document any bug fixes made during testing

### 📝 Notes
- Performance observations
- UX feedback  
- Improvement suggestions
```

---

## 🚀 Quick Test Script

**5-Minute Verification:**
```bash
1. Open app → Today page (check AdaptiveSuggestionCard)
2. Navigate → Mood page → Pull refresh (check analytics ribbon)
3. Console → Look for Quality metadata logs
4. Test → "Şimdi Dene" button interaction
5. Verify → Ribbon badges visible and correct
```

**Comprehensive Test (15 minutes):**
- Follow all checklist items above
- Test edge cases (no data, error states)
- Verify across different data conditions
- Document findings in results template

---

## 📞 Test Support

**Console Logs to Watch:**
```
🎯 Processing enhanced mood analytics
📊 Quality metadata for mood suggestion  
🎗️ AdaptiveSuggestionCard rendered with quality ribbon
⚡ Progressive UI: showing immediate + background analysis
```

**Common Issues:**
- **Ribbon not showing**: Check console for metadata generation errors
- **Wrong badges**: Verify source/quality mapping logic  
- **Missing freshness**: Check timestamp calculation
- **Button not working**: Verify telemetry and navigation logs

Bu manuel test rehberi ile Quality Ribbon sistemini güvenle doğrulayabilirsiniz! 🧪✨
