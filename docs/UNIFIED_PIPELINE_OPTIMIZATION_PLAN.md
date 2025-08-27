# UnifiedAIPipeline Monolitik Optimizasyon Planı

**Versiyon:** 1.0  
**Tarih:** Ocak 2025  
**Durum:** ONAYLANMIŞ

## 🎯 Strateji Özeti

UnifiedAIPipeline dosyası **monolitik yapısını koruyarak** içerideki kod tekrarları ve karmaşıklık giderilecektir. Bu yaklaşım:
- ✅ Breaking change riski minimum
- ✅ 4 hafta içinde tamamlanabilir
- ✅ Kolay rollback imkanı
- ✅ Progressive refactoring

## 📊 Mevcut Durum Analizi

### Problem Tespitleri
| Sorun | Detay | Etki |
|-------|-------|------|
| Dosya büyüklüğü | 4753 satır | Bakım zorluğu |
| Confidence metodları | 12+ farklı metod | Tutarsız skorlar |
| Pattern matching | Her modülde ayrı | Kod duplikasyonu |
| Cache yönetimi | Her modülde farklı TTL | Cache invalidation sorunları |
| Telemetry | Her yerde tekrarlanan kod | Maintenance overhead |

### Hedef Metrikler
| Metrik | Mevcut | Hedef | Kazanç |
|--------|--------|-------|--------|
| Satır sayısı | 4753 | <3000 | %37 azalma |
| Confidence metodları | 12+ | 1 | %92 azalma |
| Kod duplikasyonu | %35 | <%10 | %71 azalma |
| Response time | ~300ms | <150ms | %50 iyileşme |
| Test coverage | ~%25 | >%70 | %180 artış |

## 🏗️ Teknik Mimari

### 1. Helper Sınıflar Yapısı

```typescript
// features/ai/core/helpers/index.ts
export { UnifiedConfidenceCalculator } from './UnifiedConfidenceCalculator';
export { BasePatternMatcher } from './BasePatternMatcher';
export { PipelineCacheManager } from './PipelineCacheManager';
export { TelemetryWrapper } from './TelemetryWrapper';
export { ProgressiveEnhancer } from './ProgressiveEnhancer';
```

### 2. UnifiedConfidenceCalculator

```typescript
// features/ai/core/helpers/UnifiedConfidenceCalculator.ts
export interface ConfidenceParams {
  type: 'voice' | 'pattern' | 'cbt' | 'insights' | 'global';
  evidenceCount?: number;
  patternMatches?: number;
  textLength?: number;
  dataPoints?: number;
  sampleSize?: number;
  quality?: number;
}

export class UnifiedConfidenceCalculator {
  private readonly MIN_CONFIDENCE = 0.0;
  private readonly MAX_CONFIDENCE = 0.95;
  
  private readonly TYPE_WEIGHTS = {
    voice: { base: 0.6, evidence: 0.3, length: 0.1 },
    pattern: { base: 0.5, evidence: 0.4, quality: 0.1 },
    cbt: { base: 0.4, evidence: 0.5, length: 0.1 },
    insights: { base: 0.5, dataPoints: 0.3, quality: 0.2 },
    global: { base: 0.3, sampleSize: 0.4, quality: 0.3 }
  };
  
  calculate(params: ConfidenceParams): number {
    const weights = this.TYPE_WEIGHTS[params.type];
    let score = 0;
    
    // Base confidence
    score += weights.base * this.getBaseScore(params);
    
    // Evidence-based adjustment
    if (params.evidenceCount !== undefined && weights.evidence) {
      score += weights.evidence * this.getEvidenceScore(params.evidenceCount);
    }
    
    // Length adjustment for text-based
    if (params.textLength !== undefined && weights.length) {
      score += weights.length * this.getLengthScore(params.textLength);
    }
    
    // Quality adjustment
    if (params.quality !== undefined && weights.quality) {
      score += weights.quality * params.quality;
    }
    
    // Apply uncertainty
    const uncertainty = this.calculateUncertainty(params);
    score = score * (1 - uncertainty);
    
    return Math.max(this.MIN_CONFIDENCE, Math.min(this.MAX_CONFIDENCE, score));
  }
  
  private getBaseScore(params: ConfidenceParams): number {
    // Merkezi base score hesaplama
    return 0.5;
  }
  
  private getEvidenceScore(count: number): number {
    // Evidence-based scoring
    return Math.min(1, count / 10);
  }
  
  private getLengthScore(length: number): number {
    // Text length scoring
    if (length < 10) return 0.3;
    if (length < 50) return 0.6;
    if (length < 200) return 0.8;
    return 1.0;
  }
  
  private calculateUncertainty(params: ConfidenceParams): number {
    // Dynamic uncertainty calculation
    let uncertainty = 0.1; // Base uncertainty
    
    if (params.evidenceCount && params.evidenceCount < 3) {
      uncertainty += 0.2;
    }
    
    if (params.textLength && params.textLength < 20) {
      uncertainty += 0.15;
    }
    
    return Math.min(0.5, uncertainty);
  }
}
```

### 3. BasePatternMatcher

```typescript
// features/ai/core/helpers/BasePatternMatcher.ts
export interface Pattern {
  id: string;
  regex?: RegExp;
  keywords?: string[];
  weight: number;
  category: string;
}

export interface PatternMatch {
  pattern: Pattern;
  confidence: number;
  matches: string[];
}

export class BasePatternMatcher {
  private patterns = new Map<string, Pattern[]>();
  
  constructor() {
    this.initializePatterns();
  }
  
  private initializePatterns(): void {
    // Mood patterns
    this.patterns.set('mood', [
      { id: 'mood_sad', keywords: ['üzgün', 'mutsuz', 'kötü'], weight: 0.8, category: 'negative' },
      { id: 'mood_happy', keywords: ['mutlu', 'iyi', 'harika'], weight: 0.8, category: 'positive' },
      // ... more patterns
    ]);
    
    // CBT patterns
    this.patterns.set('cbt', [
      { id: 'cbt_catastrophic', keywords: ['felaket', 'korkunç', 'berbat'], weight: 0.9, category: 'distortion' },
      { id: 'cbt_mindreading', keywords: ['biliyor', 'düşünüyor', 'hissediyor'], weight: 0.7, category: 'distortion' },
      // ... more patterns
    ]);
    
    // Breathwork patterns
    this.patterns.set('breathwork', [
      { id: 'breath_anxiety', keywords: ['nefes', 'boğuluyorum', 'hava'], weight: 0.9, category: 'trigger' },
      { id: 'breath_panic', keywords: ['panik', 'kalp', 'çarpıntı'], weight: 0.9, category: 'trigger' },
      // ... more patterns
    ]);
  }
  
  match(text: string, type: string): PatternMatch[] {
    const normalizedText = this.normalize(text);
    const typePatterns = this.patterns.get(type) || [];
    const matches: PatternMatch[] = [];
    
    for (const pattern of typePatterns) {
      const match = this.matchPattern(normalizedText, pattern);
      if (match && match.confidence > 0.3) {
        matches.push(match);
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }
  
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private matchPattern(text: string, pattern: Pattern): PatternMatch | null {
    const foundMatches: string[] = [];
    let matchScore = 0;
    
    // Keyword matching
    if (pattern.keywords) {
      for (const keyword of pattern.keywords) {
        if (text.includes(keyword)) {
          foundMatches.push(keyword);
          matchScore += pattern.weight;
        }
      }
    }
    
    // Regex matching
    if (pattern.regex) {
      const regexMatches = text.match(pattern.regex);
      if (regexMatches) {
        foundMatches.push(...regexMatches);
        matchScore += pattern.weight;
      }
    }
    
    if (foundMatches.length === 0) return null;
    
    return {
      pattern,
      confidence: Math.min(0.95, matchScore / pattern.keywords?.length || 1),
      matches: foundMatches
    };
  }
}
```

### 4. PipelineCacheManager

```typescript
// features/ai/core/helpers/PipelineCacheManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheConfig {
  ttl: number; // seconds
  maxSize?: number;
  keyPrefix: string;
}

export class PipelineCacheManager {
  private readonly configs: Map<string, CacheConfig> = new Map([
    ['voice', { ttl: 3600, keyPrefix: 'ai:voice:' }],
    ['patterns', { ttl: 43200, keyPrefix: 'ai:patterns:' }],
    ['insights', { ttl: 86400, keyPrefix: 'ai:insights:' }],
    ['cbt', { ttl: 86400, keyPrefix: 'ai:cbt:' }],
  ]);
  
  async get<T>(type: string, key: string): Promise<T | null> {
    const config = this.configs.get(type);
    if (!config) return null;
    
    const cacheKey = `${config.keyPrefix}${key}`;
    
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      
      if (age > config.ttl * 1000) {
        await this.delete(type, key);
        return null;
      }
      
      return parsed.data as T;
    } catch {
      return null;
    }
  }
  
  async set<T>(type: string, key: string, data: T): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    const cacheKey = `${config.keyPrefix}${key}`;
    
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
  }
  
  async delete(type: string, key: string): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    const cacheKey = `${config.keyPrefix}${key}`;
    await AsyncStorage.removeItem(cacheKey);
  }
  
  async invalidate(type: string): Promise<void> {
    const config = this.configs.get(type);
    if (!config) return;
    
    const allKeys = await AsyncStorage.getAllKeys();
    const typeKeys = allKeys.filter(k => k.startsWith(config.keyPrefix));
    
    if (typeKeys.length > 0) {
      await AsyncStorage.multiRemove(typeKeys);
    }
  }
}
```

### 5. Progressive Enhancement

```typescript
// features/ai/core/helpers/ProgressiveEnhancer.ts
export class ProgressiveEnhancer {
  private deepAnalysisQueue: Map<string, NodeJS.Timeout> = new Map();
  
  async getQuickResult(input: any): Promise<any> {
    // Hızlı heuristic analiz
    const quickAnalysis = {
      confidence: 0.6,
      category: this.quickCategorize(input),
      isHeuristic: true,
      timestamp: Date.now()
    };
    
    return quickAnalysis;
  }
  
  scheduleDeepAnalysis(
    id: string,
    input: any,
    callback: (result: any) => void,
    delay: number = 100
  ): void {
    // Eski scheduled analysis'i iptal et
    if (this.deepAnalysisQueue.has(id)) {
      clearTimeout(this.deepAnalysisQueue.get(id)!);
    }
    
    const timer = setTimeout(async () => {
      try {
        const deepResult = await this.performDeepAnalysis(input);
        callback(deepResult);
        this.deepAnalysisQueue.delete(id);
      } catch (error) {
        console.error('Deep analysis failed:', error);
        this.deepAnalysisQueue.delete(id);
      }
    }, delay);
    
    this.deepAnalysisQueue.set(id, timer);
  }
  
  private quickCategorize(input: any): string {
    // Basit kategorileme logic
    const text = typeof input === 'string' ? input : input.content || '';
    
    if (text.includes('nefes') || text.includes('breathe')) {
      return 'BREATHWORK';
    }
    
    if (text.includes('düşünce') || text.includes('thought')) {
      return 'CBT';
    }
    
    return 'MOOD';
  }
  
  private async performDeepAnalysis(input: any): Promise<any> {
    // Daha detaylı analiz
    return {
      confidence: 0.85,
      category: 'MOOD',
      isHeuristic: false,
      deepInsights: [],
      timestamp: Date.now()
    };
  }
}
```

## 📋 Sprint Planı

### Sprint 1: Core Helpers (Hafta 1)
| Gün | Task | Deliverable |
|-----|------|-------------|
| 1-2 | UnifiedConfidenceCalculator | Helper sınıf + testler |
| 3-4 | BasePatternMatcher | Helper sınıf + testler |
| 5 | PipelineCacheManager | Helper sınıf + testler |

### Sprint 2: Integration (Hafta 2)
| Gün | Task | Deliverable |
|-----|------|-------------|
| 6-7 | Method migration | Confidence metodları migrate |
| 8 | Cache integration | Cache logic taşıma |
| 9-10 | Progressive enhancement | Quick + deep analysis |

### Sprint 3: Testing (Hafta 3)
| Gün | Task | Coverage Target |
|-----|------|----------------|
| 11-12 | Unit tests | Helper classes %95+ |
| 13-14 | Integration tests | Pipeline %80+ |
| 15 | E2E tests | Critical paths |

### Sprint 4: Optimization (Hafta 4)
| Gün | Task | Metric |
|-----|------|--------|
| 16-17 | Performance profiling | <150ms target |
| 18-19 | Memory optimization | Memory leaks fix |
| 20 | Final cleanup | <3000 satır hedefi |

## 🧪 Test Stratejisi

### Unit Test Örnekleri

```typescript
// __tests__/helpers/UnifiedConfidenceCalculator.test.ts
describe('UnifiedConfidenceCalculator', () => {
  let calculator: UnifiedConfidenceCalculator;
  
  beforeEach(() => {
    calculator = new UnifiedConfidenceCalculator();
  });
  
  describe('confidence calculation', () => {
    it('should return low confidence for minimal evidence', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 1,
        textLength: 5
      });
      
      expect(result).toBeLessThan(0.5);
    });
    
    it('should return high confidence for strong evidence', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 10,
        textLength: 200,
        quality: 0.9
      });
      
      expect(result).toBeGreaterThan(0.8);
    });
    
    it('should never exceed MAX_CONFIDENCE', () => {
      const result = calculator.calculate({
        type: 'voice',
        evidenceCount: 100,
        textLength: 1000,
        quality: 1.0
      });
      
      expect(result).toBeLessThanOrEqual(0.95);
    });
  });
});
```

### Integration Test Örnekleri

```typescript
// __tests__/integration/UnifiedPipelineOptimized.test.ts
describe('UnifiedAIPipeline - Optimized', () => {
  let pipeline: UnifiedAIPipeline;
  
  beforeEach(() => {
    pipeline = UnifiedAIPipeline.getInstance();
  });
  
  it('should use unified confidence calculator', async () => {
    const spy = jest.spyOn(UnifiedConfidenceCalculator.prototype, 'calculate');
    
    await pipeline.process({
      userId: 'test-user',
      content: 'Test content',
      type: 'voice'
    });
    
    expect(spy).toHaveBeenCalled();
  });
  
  it('should provide progressive enhancement', async () => {
    const quickResultPromise = new Promise(resolve => {
      pipeline.on('quick-result', resolve);
    });
    
    const deepResultPromise = new Promise(resolve => {
      pipeline.on('deep-result', resolve);
    });
    
    pipeline.process({
      userId: 'test-user',
      content: 'Bugün kendimi çok kötü hissediyorum',
      type: 'voice'
    });
    
    const quickResult = await quickResultPromise;
    expect(quickResult).toHaveProperty('isHeuristic', true);
    
    const deepResult = await deepResultPromise;
    expect(deepResult).toHaveProperty('isHeuristic', false);
    expect(deepResult.confidence).toBeGreaterThan(quickResult.confidence);
  });
});
```

## ✅ Başarı Kriterleri

| Kriter | Hedef | Ölçüm Yöntemi |
|--------|-------|---------------|
| Kod azaltımı | >%35 | Line count comparison |
| Test coverage | >%70 | Jest coverage report |
| Response time | <150ms | Performance profiling |
| Memory usage | <50MB delta | Heap snapshot |
| Type safety | 0 errors | tsc --noEmit |
| Confidence accuracy | >%85 | A/B test results |

## 🚀 Deployment Stratejisi

### Phase 1: Canary Deployment (5% traffic)
- Helper sınıfları production'a deploy
- 5% kullanıcıda test
- Metrik toplama

### Phase 2: Gradual Rollout (25% → 50% → 100%)
- Performans metrikleri monitor
- User feedback toplama
- Gradual traffic artışı

### Phase 3: Full Migration
- %100 traffic migration
- Legacy kod temizliği
- Documentation update

## 📊 ROI Analizi

| Metrik | Before | After | Improvement |
|--------|--------|-------|-------------|
| Development speed | 1x | 1.8x | +80% |
| Bug frequency | 15/week | 5/week | -67% |
| Performance | 300ms | 150ms | +100% |
| Maintainability | Low | High | ⬆️⬆️⬆️ |
| Test confidence | 25% | 70% | +180% |

## 🔄 Rollback Planı

Eğer sorun yaşanırsa:

1. **Quick Rollback** (5 dakika)
   - Feature flag ile eski kodu aktive et
   - Helper sınıfları deaktive et

2. **Partial Rollback** (30 dakika)
   - Sadece sorunlu helper'ı deaktive et
   - Diğer optimizasyonları koru

3. **Full Rollback** (1 saat)
   - Git revert ile önceki versiyona dön
   - Hotfix deploy

## 📝 Notlar

- CBT modülü kaldırıldığı için CBT-specific optimizasyonlar scope dışı
- CoreAnalysisService deprecate edilecek
- Progressive enhancement öncelikli
- Mobile performans her zaman öncelikli

---

**Onay:** Bu plan onaylandıktan sonra hemen uygulamaya başlanabilir.
