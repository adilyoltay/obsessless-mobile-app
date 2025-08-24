# 🧪 Test Directory Structure

Bu klasör ObsessLess mobil uygulamasının test suite'ini içerir. Test yapısı organize edilmiş ve standartlaştırılmıştır.

## 📁 Dizin Yapısı

### `/ai/` - AI Sistem Testleri
AI bileşenlerinin unit ve integration testleri
- `batch/` - Batch processing testleri  
- `cache/` - Cache yönetimi testleri
- `core/` - Temel AI servisleri testleri

### `/analytics/` - Analytics Testleri
Kullanıcı analytics ve metriklerin testleri
- CBT Analytics
- Tracking Analytics

### `/fixtures/` - Test Fixtures
Test datası ve mock objects
- `goldenSet.ts` - Altın standart test dataları
- `qualityRibbonFixtures.ts` - Quality Ribbon test verileri

### `/integration/` - Integration Testleri
Birden fazla bileşenin birlikte çalışmasını test eder
- `*.integration.test.tsx` formatında
- React Testing Library kullanır
- Real component rendering ile

### `/smoke/` - Smoke Testleri  
Temel işlevsellik testleri
- Critical path testleri
- Hızlı regresyon kontrolü

### `/sync/` - Synchronization Testleri
Veri senkronizasyonu testleri
- Offline sync
- Conflict resolution

### `/ui/` - UI Component Testleri
UI bileşenlerinin unit testleri
- Component rendering
- User interaction

### `/unit/` - Unit Testleri
İzole bileşen testleri
- Hook testleri
- Pure function testleri

## 📋 Test Naming Conventions

### File Naming
- **Unit Tests**: `ComponentName.test.ts/tsx`
- **Integration Tests**: `PageName.integration.test.tsx`
- **Smoke Tests**: `FeatureName.test.js`
- **Helper Files**: `helperName.ts`

### Test Structure
```typescript
describe('Component/Feature Name', () => {
  describe('🎯 Primary Functionality', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
  
  describe('⚠️ Error Handling', () => {
    it('should handle error case', () => {
      // Error test
    });
  });
  
  describe('🔄 Integration Points', () => {
    it('should integrate with other systems', () => {
      // Integration test
    });
  });
});
```

## 🚫 Removed Inconsistencies

### E2E Directory Cleanup
- ❌ `e2e/` klasörü kaldırıldı (Detox config yoktu)
- ✅ E2E-style testler `__tests__/integration/` altına taşındı
- ✅ İsimlendirme tutarlı hale getirildi

### File Standardization
- ❌ Karışık `.e2e.js`, `.test.tsx` isimlendirmeleri
- ✅ Tutarlı `.integration.test.tsx` formatı
- ✅ Detox syntax'ı Jest RTL'ye çevrildi

## 🏃‍♂️ Running Tests

### Tüm Testler
```bash
npm test
```

### Specific Test Categories
```bash
# Unit tests
npm test -- __tests__/unit/

# Integration tests  
npm test -- __tests__/integration/

# AI tests
npm test -- __tests__/ai/

# UI tests
npm test -- __tests__/ui/
```

### Watch Mode
```bash
npm test -- --watch
```

## 📊 Coverage
Test coverage raporları `coverage/` klasöründe oluşturulur.

```bash
npm test -- --coverage
```

## 🔧 Mock Strategy

### Standard Mocks
- `AsyncStorage` - Her testte mock'lanır
- `@react-native-community/*` - Jest setup'ta mock'lanır  
- `expo-*` - Gerektiğinde mock'lanır
- AI Services - Integration testlerinde mock'lanır

### Helper Functions
Testlerde kullanılan yardımcı fonksiyonlar:
- `clearAllData()` - Test verilerini temizler
- `toggleFeatureFlag()` - Feature flag'leri değiştirir  
- `simulateMetadataError()` - Hata durumlarını simüle eder

---

**Last Updated**: 2025-01-24
**Test Structure Version**: 2.0
