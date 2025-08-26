# 🎗️ Quality Ribbon Automated Test Pipeline

**Tam Otomatik Doğrulama Sistemi**

Bu dokuman, Today ve Mood sayfalarındaki Quality Ribbon sisteminin otomatik doğrulamasını sağlayan kapsamlı test pipeline'ını açıklar.

## 📋 Genel Bakış

Quality Ribbon Test Pipeline, aşağıdaki bileşenleri otomatik olarak doğrular:
- **Source Mapping**: Fresh/Cache/LLM/Fast rozetlerinin doğru görüntülenmesi
- **Quality Level**: High/Med/Low kalite seviyelerinin doğru hesaplanması  
- **Sample Size**: n=X rozetlerinin doğru gösterimi
- **Freshness**: now/m/h/d yaş rozetlerinin doğru formatlanması
- **TTL Transitions**: Fresh→Cache geçişlerinin doğru çalışması
- **N-Threshold**: Mood verisi eşiklerine göre kalite seviyesi belirlenmesi
- **Hiding Conditions**: Metadata eksikliğinde Ribbon'ın gizlenmesi

## 🚀 Hızlı Başlangıç

```bash
# Tüm Quality Ribbon testlerini çalıştır ve rapor oluştur
npm run test:qr:all

# Sadece unit testler
npm run test:qr:unit

# Sadece integration testler  
npm run test:qr:int

# Sadece smoke E2E testler
npm run test:qr:e2e
```

## 🏗️ Pipeline Mimarisi

### 1. Test Mode Altyapısı
- **TEST_MODE=1**: Deterministik test modu aktif
- **TEST_TTL_MS=5000**: 5 saniye TTL (hızlı test için)
- **TEST_PIPELINE_STUB=1**: Pipeline stubbing aktif
- **TEST_SEED_USER_ID**: Test kullanıcı kimliği

### 2. Test Seed Katmanı (`__tests__/fixtures/seedData.ts`)
```typescript
// Deterministik veri senaryoları
const MOOD_SCENARIOS = {
  high: { sampleSize: 16, qualityLevel: 'high' },    // ≥14 gün
  medium: { sampleSize: 10, qualityLevel: 'medium' }, // 7-13 gün
  low: { sampleSize: 4, qualityLevel: 'low' }        // <7 gün
}
```

### 3. Test Türleri

#### Unit Tests (`__tests__/unit/QualityRibbon.test.tsx`)
- ✅ Source badge mapping (unified→Fresh, cache→Cache, vb.)
- ✅ Quality badge mapping (high→High, medium→Med, low→Low)
- ✅ Sample size formatting (n=15)
- ✅ Age formatting (5m, 2h, 1d)
- ✅ Conditional rendering
- ✅ Error handling
- ✅ Accessibility

#### Integration Tests
**Today Page** (`__tests__/integration/TodayPageQualityRibbon.integration.test.tsx`)
- ✅ Fresh pipeline results
- ✅ Cache invalidation
- ✅ TTL transitions (Fresh→Cache)
- ✅ Quality Ribbon hiding
- ✅ Test mode integration

**Mood Page** (`__tests__/integration/MoodPageAIPipeline.integration.test.tsx`)
- ✅ N-threshold testing (high/medium/low scenarios)
- ✅ Sample size boundary conditions (7-day threshold)
- ✅ Fresh/Cache transitions
- ✅ Quality Ribbon hiding
- ✅ Test mode integration

#### Smoke E2E Tests (`__tests__/smoke/QualityRibbonSmoke.test.js`)
- ✅ Today Fresh→Cache transition
- ✅ Mood n-threshold scenarios
- ✅ Error handling
- ✅ Badge mapping verification
- ✅ Cache behavior simulation

## 📊 Raporlama Sistemi

### Otomatik Rapor Oluşturma
Test çalıştırıldıktan sonra `scripts/collect-quality-ribbon-results.js` otomatik olarak:

#### JSON Raporu (`test-reports/quality-ribbon-report.json`)
```json
{
  "timestamp": "2025-01-25T10:30:00.000Z",
  "summary": { "total": 45, "passed": 43, "failed": 2, "passRate": 96 },
  "categories": {
    "today": { "fresh": {...}, "cache": {...}, "hidden": {...} },
    "mood": { "high": {...}, "medium": {...}, "low": {...} }
  },
  "analysis": { "recommendations": [...] }
}
```

#### Markdown Raporu (`test-reports/quality-ribbon-report.md`)
Detaylı tablo formatında sonuçlar, başarısızlık analizi ve öneriler.

#### Konsol Özeti
```
🎗️  QUALITY RIBBON TEST SUMMARY
====================================
📊 Overall: 43/45 tests passed (96%)
🏠 Today: F/C/H = 5/5 3/3 2/2
😊 Mood: H/M/L/C/H = 8/8 6/6 4/4 3/3 2/2
🔥 Smoke: T/M/V = 12/12 10/10 8/8
🎯 Status: ✅ EXCELLENT
```

## 🔬 Test Senaryoları Detayları

### Today Page Senaryoları
1. **Fresh Processing**: Anlık pipeline işlemi → Fresh badge
2. **Manual Refresh**: Cache invalidation → Fresh badge
3. **TTL Expiry**: 5 saniye sonra → Cache badge + yaş
4. **Metadata Missing**: Quality Ribbon gizlenir
5. **Pipeline Error**: Graceful fallback

### Mood Page Senaryoları
1. **High Quality** (≥14 gün veri): Fresh + High + n=16
2. **Medium Quality** (7-13 gün veri): Cache + Med + n=10
3. **Low Quality** (<7 gün veri): Fast + Low + n=4
4. **Boundary Test** (tam 7 gün): Med kalite kontrolü
5. **TTL Transition**: Fresh→Cache geçişi

### Smoke E2E Senaryoları
1. **Today Pipeline Flow**: Fresh→Cache simülasyonu
2. **Mood N-Threshold**: Tüm kalite seviyeleri
3. **Error Conditions**: Pipeline hatası, rate limit
4. **Badge Mapping**: Tüm source/quality kombinasyonları

## 🧪 Test Modu Konfigürasyonu

### UnifiedAIPipeline Test Overrides
```typescript
// Test modunda TTL override
private readonly isTestMode = process.env.TEST_MODE === '1';
private readonly testTTL = parseInt(process.env.TEST_TTL_MS || '5000', 10);

// Cache TTL hesaplaması
const cacheTTL = this.isTestMode ? this.testTTL : (ttl || this.MODULE_TTLS.default);
```

### Jest Setup Global Helpers
```javascript
// jest.setup.js içinde global olarak mevcut
global.waitForElement = waitForElement;
global.seedTestData = seedTestData;
global.clearAllTestData = clearAllTestData;
global.mockUnifiedPipelineProcess = mockUnifiedPipelineProcess;
```

## 📈 Kabul Kriterleri

### Başarı Metrikleri
- **Unit Tests**: ≥99% pass rate (deterministik)
- **Integration Tests**: ≥95% pass rate 
- **Smoke E2E**: ≥90% pass rate
- **Total Duration**: <3-5 dakika (tüm testler)

### Performans Kriterleri
- Fresh→Cache geçişi: <20 saniye (test modunda <10 saniye)
- Pipeline processing: <5 saniye
- UI response: <50ms render time

### Stabilite Kriterleri
- Flaky test oranı: <5%
- Network dependency: 0% (tüm dependencies mocked)
- Environment isolation: %100

## 🚨 Sorun Giderme

### Yaygın Sorunlar

#### 1. Tests Timing Out
```bash
# TTL beklemelerinde zaman aşımı
waitFor(() => expect(...), { timeout: 8000 })
```

#### 2. Mock Pipeline Not Called
```javascript
// Pipeline mock'unun doğru kurulduğundan emin ol
MockUnifiedAIPipeline.getInstance.mockReturnValue(mockPipeline);
```

#### 3. Seed Data Issues
```bash
# Test verisini temizle ve yeniden oluştur
await clearAllTestData();
await seedTestData('high', ['mood']);
```

#### 4. Environment Variables
```bash
# Test modunun aktif olduğundan emin ol
TEST_MODE=1 TEST_TTL_MS=5000 npm run test:qr:unit
```

### Debug Modu
```bash
# Verbose output ile çalıştır
npm run test:qr:all -- --verbose
node scripts/collect-quality-ribbon-results.js --verbose
```

## 📋 CI/CD Entegrasyonu

### GitHub Actions Workflow
```yaml
- name: Quality Ribbon Tests
  run: |
    npm run test:qr:all
    # Exit code 0 = success, 1 = failures exist
```

### Pre-commit Hook
```bash
# package.json
"pre-commit": "npm run import-guard && npm run validate:docs && npm run test:qr:unit"
```

## 🔄 Bakım ve Geliştirme

### Yeni Test Ekleme
1. Uygun kategoriyi belirle (unit/integration/smoke)
2. Seed data gerekiyorsa `seedData.ts`'e ekle
3. Test case'i yaz ve testID'leri kullan
4. Reporter'da yeni kategoriler gerekiyorsa güncelle

### Performans İyileştirme
1. Paralel test execution kullan
2. Mock'ları optimize et
3. Seed data boyutlarını kontrol et
4. TTL değerlerini ayarla

### Yeni Kalite Metrikleri
1. `seedData.ts`'te yeni senaryolar tanımla
2. Integration testlerde yeni test case'ler ekle
3. Reporter'da yeni kategoriler oluştur
4. Konsol özetini güncelle

---

**Son Güncelleme**: 25 Ocak 2025  
**Test Pipeline Versiyonu**: 1.0  
**Kapsam**: Today/Mood Quality Ribbon tam otomatik doğrulama
