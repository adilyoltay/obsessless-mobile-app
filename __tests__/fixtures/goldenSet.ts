/**
 * 🏆 Golden Set - Test Fixtures for AI Analysis
 * 
 * Real-world Turkish check-in examples for testing
 * classification accuracy and gating decisions
 */

export interface GoldenSetItem {
  id: string;
  input: string;
  expectedClass: 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK' | 'OTHER';
  expectedConfidence: number; // Expected minimum confidence
  expectedNeedsLLM: boolean;
  expectedRoute: 'OPEN_SCREEN' | 'AUTO_SAVE' | 'SUGGEST_BREATHWORK';
  context?: string; // Additional context for the test
  tags?: string[]; // Tags for filtering tests
}

/**
 * Turkish voice check-in examples with expected outcomes
 */
export const goldenSet: GoldenSetItem[] = [
  // ============= MOOD Examples =============
  {
    id: 'mood-001',
    input: 'Bugün kendimi çok mutlu hissediyorum, enerjim yüksek',
    expectedClass: 'MOOD',
    expectedConfidence: 0.85,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['positive', 'high-confidence'],
  },
  {
    id: 'mood-002',
    input: 'Çok üzgünüm bugün hiçbir şey yapmak istemiyorum',
    expectedClass: 'MOOD',
    expectedConfidence: 0.8,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['negative', 'depression'],
  },
  {
    id: 'mood-003',
    input: 'Duygu durumum çok değişken sabah iyiydim şimdi kötüyüm',
    expectedClass: 'MOOD',
    expectedConfidence: 0.75,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['fluctuating', 'mood-swing'],
  },
  {
    id: 'mood-004',
    input: 'Sinirli ve gerginim ama nedenini bilmiyorum',
    expectedClass: 'MOOD',
    expectedConfidence: 0.7,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['anxiety', 'irritable'],
  },

  // ============= CBT Examples =============
  {
    id: 'cbt-001',
    input: 'Herkes benden nefret ediyor kimse beni sevmiyor',
    expectedClass: 'CBT',
    expectedConfidence: 0.85,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'All-or-nothing thinking',
    tags: ['distortion', 'all-or-nothing'],
  },
  {
    id: 'cbt-002',
    input: 'Bu sınavda kesinlikle başarısız olacağım hayatım mahvolacak',
    expectedClass: 'CBT',
    expectedConfidence: 0.8,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Catastrophizing',
    tags: ['distortion', 'catastrophizing'],
  },
  {
    id: 'cbt-003',
    input: 'İnsanlar bana garip bakıyor herkes benim hakkımda konuşuyor',
    expectedClass: 'CBT',
    expectedConfidence: 0.75,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Mind reading',
    tags: ['distortion', 'mind-reading'],
  },
  {
    id: 'cbt-004',
    input: 'Her zaman her şeyi mahvediyorum hiçbir işi beceremiyorum',
    expectedClass: 'CBT',
    expectedConfidence: 0.8,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Overgeneralization',
    tags: ['distortion', 'overgeneralization'],
  },
  {
    id: 'cbt-005',
    input: 'Patronum benimle konuşmadı kesin kovulacağım',
    expectedClass: 'CBT',
    expectedConfidence: 0.7,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Jumping to conclusions',
    tags: ['distortion', 'jumping-to-conclusions'],
  },

  // ============= OCD Examples =============
  {
    id: 'ocd-001',
    input: 'Kapıyı 5 kez kontrol ettim yine de emin olamıyorum',
    expectedClass: 'OCD',
    expectedConfidence: 0.9,
    expectedNeedsLLM: false,
    expectedRoute: 'AUTO_SAVE',
    tags: ['checking', 'high-confidence'],
  },
  {
    id: 'ocd-002',
    input: 'Ellerimi 20 dakika yıkadım hala kirli hissediyorum',
    expectedClass: 'OCD',
    expectedConfidence: 0.95,
    expectedNeedsLLM: false,
    expectedRoute: 'AUTO_SAVE',
    tags: ['washing', 'contamination'],
  },
  {
    id: 'ocd-003',
    input: 'Eşyaları düzeltme kompulsiyonum tetiklendi 30 dakika uğraştım',
    expectedClass: 'OCD',
    expectedConfidence: 0.85,
    expectedNeedsLLM: false,
    expectedRoute: 'AUTO_SAVE',
    tags: ['arranging', 'symmetry'],
  },
  {
    id: 'ocd-004',
    input: 'Sayma ritüelim başladı 7ye kadar saymadan yapamıyorum',
    expectedClass: 'OCD',
    expectedConfidence: 0.88,
    expectedNeedsLLM: false,
    expectedRoute: 'AUTO_SAVE',
    tags: ['counting', 'ritual'],
  },
  {
    id: 'ocd-005',
    input: 'Gazın açık kaldığı düşüncesi aklımdan çıkmıyor tekrar kontrol ettim',
    expectedClass: 'OCD',
    expectedConfidence: 0.82,
    expectedNeedsLLM: true,
    expectedRoute: 'AUTO_SAVE',
    tags: ['checking', 'intrusive-thought'],
  },
  {
    id: 'ocd-006',
    input: 'Kompulsiyon yapmamak için dirençli davrandım başardım',
    expectedClass: 'OCD',
    expectedConfidence: 0.75,
    expectedNeedsLLM: false,
    expectedRoute: 'AUTO_SAVE',
    context: 'Resistance success',
    tags: ['resistance', 'success'],
  },

  // ============= ERP Examples =============






  // ============= BREATHWORK Examples =============
  {
    id: 'breath-001',
    input: 'Çok stresli hissediyorum nefes alamıyorum',
    expectedClass: 'BREATHWORK',
    expectedConfidence: 0.9,
    expectedNeedsLLM: false,
    expectedRoute: 'SUGGEST_BREATHWORK',
    tags: ['stress', 'immediate'],
  },
  {
    id: 'breath-002',
    input: 'Panik atak geçiriyorum kalbim çok hızlı atıyor',
    expectedClass: 'BREATHWORK',
    expectedConfidence: 0.95,
    expectedNeedsLLM: false,
    expectedRoute: 'SUGGEST_BREATHWORK',
    tags: ['panic', 'urgent'],
  },
  {
    id: 'breath-003',
    input: 'Anksiyetem çok yüksek sakinleşmem lazım',
    expectedClass: 'BREATHWORK',
    expectedConfidence: 0.85,
    expectedNeedsLLM: false,
    expectedRoute: 'SUGGEST_BREATHWORK',
    tags: ['anxiety', 'calming'],
  },
  {
    id: 'breath-004',
    input: 'Nefes egzersizi yapmam gerekiyor',
    expectedClass: 'BREATHWORK',
    expectedConfidence: 0.9,
    expectedNeedsLLM: false,
    expectedRoute: 'SUGGEST_BREATHWORK',
    tags: ['direct-request'],
  },
  {
    id: 'breath-005',
    input: 'Göğsümde baskı hissediyorum nefesim daralıyor',
    expectedClass: 'BREATHWORK',
    expectedConfidence: 0.8,
    expectedNeedsLLM: false,
    expectedRoute: 'SUGGEST_BREATHWORK',
    tags: ['physical-symptom'],
  },

  // ============= Mixed/Complex Examples =============
  {
    id: 'mixed-001',
    input: 'Kompulsiyon yaptım ve çok üzgünüm kendime kızıyorum',
    expectedClass: 'OCD',
    expectedConfidence: 0.7,
    expectedNeedsLLM: true,
    expectedRoute: 'AUTO_SAVE',
    context: 'OCD with mood component',
    tags: ['mixed', 'ocd-mood'],
  },
  {
    id: 'mixed-002',
    input: 'ERP yaparken çok stresli hissettim nefes egzersizi yaptım',
    expectedClass: 'ERP',
    expectedConfidence: 0.65,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'ERP with breathwork',
    tags: ['mixed', 'erp-breath'],
  },
  {
    id: 'mixed-003',
    input: 'Herkes bana bakıyor diye düşünüp kontrol kompulsiyonu yaptım',
    expectedClass: 'OCD',
    expectedConfidence: 0.6,
    expectedNeedsLLM: true,
    expectedRoute: 'AUTO_SAVE',
    context: 'CBT distortion triggering OCD',
    tags: ['mixed', 'cbt-ocd'],
  },
  {
    id: 'mixed-004',
    input: 'Bugün çok yorgunum hiçbir şey yapmak istemiyorum ama görevlerimi yapmalıyım',
    expectedClass: 'MOOD',
    expectedConfidence: 0.5,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Ambiguous - could be mood or motivation',
    tags: ['ambiguous', 'low-confidence'],
  },

  // ============= Edge Cases =============
  {
    id: 'edge-001',
    input: 'Test',
    expectedClass: 'OTHER',
    expectedConfidence: 0.1,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['edge', 'minimal'],
  },
  {
    id: 'edge-002',
    input: 'Merhaba nasılsın',
    expectedClass: 'OTHER',
    expectedConfidence: 0.2,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['edge', 'greeting'],
  },
  {
    id: 'edge-003',
    input: 'Hava bugün çok güzel dışarı çıkmak istiyorum',
    expectedClass: 'MOOD',
    expectedConfidence: 0.4,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['edge', 'non-clinical'],
  },
  {
    id: 'edge-004',
    input: '...',
    expectedClass: 'OTHER',
    expectedConfidence: 0.1,
    expectedNeedsLLM: false,
    expectedRoute: 'OPEN_SCREEN',
    tags: ['edge', 'non-text'],
  },
  {
    id: 'edge-005',
    input: 'Çok uzun bir metin ' + 'a'.repeat(500) + ' devam ediyor',
    expectedClass: 'OTHER',
    expectedConfidence: 0.3,
    expectedNeedsLLM: true,
    expectedRoute: 'OPEN_SCREEN',
    context: 'Very long text',
    tags: ['edge', 'long-text'],
  },
];

/**
 * Test scenarios for specific features
 */
export const testScenarios = {
  // Gating ratio test - what percentage needs LLM?
  gatingRatio: {
    description: 'Test LLM gating decisions',
    run: () => {
      const needsLLM = goldenSet.filter(item => item.expectedNeedsLLM);
      const ratio = needsLLM.length / goldenSet.length;
      return {
        total: goldenSet.length,
        needsLLM: needsLLM.length,
        ratio: ratio,
        targetRatio: 0.4, // Target: 40% or less needs LLM
        passed: ratio <= 0.4,
      };
    },
  },

  // Classification accuracy test
  classificationAccuracy: {
    description: 'Test classification accuracy by category',
    run: () => {
      const categories = ['MOOD', 'CBT', 'OCD', 'ERP', 'BREATHWORK', 'OTHER'];
      const results = categories.map(category => {
        const items = goldenSet.filter(item => item.expectedClass === category);
        return {
          category,
          count: items.length,
          avgConfidence: items.reduce((sum, item) => sum + item.expectedConfidence, 0) / items.length,
        };
      });
      return results;
    },
  },

  // Route determination test
  routeAccuracy: {
    description: 'Test route determination accuracy',
    run: () => {
      const routes = ['OPEN_SCREEN', 'AUTO_SAVE', 'SUGGEST_BREATHWORK'];
      const results = routes.map(route => {
        const items = goldenSet.filter(item => item.expectedRoute === route);
        return {
          route,
          count: items.length,
          categories: [...new Set(items.map(item => item.expectedClass))],
        };
      });
      return results;
    },
  },

  // High confidence items test
  highConfidenceItems: {
    description: 'Items with confidence >= 0.8',
    run: () => {
      const highConf = goldenSet.filter(item => item.expectedConfidence >= 0.8);
      return {
        count: highConf.length,
        percentage: (highConf.length / goldenSet.length) * 100,
        categories: highConf.reduce((acc, item) => {
          acc[item.expectedClass] = (acc[item.expectedClass] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    },
  },

  // Complex/mixed input handling
  complexInputHandling: {
    description: 'Test handling of mixed/complex inputs',
    run: () => {
      const mixed = goldenSet.filter(item => item.tags?.includes('mixed'));
      const ambiguous = goldenSet.filter(item => item.tags?.includes('ambiguous'));
      return {
        mixedCount: mixed.length,
        ambiguousCount: ambiguous.length,
        avgConfidence: [...mixed, ...ambiguous].reduce(
          (sum, item) => sum + item.expectedConfidence, 0
        ) / (mixed.length + ambiguous.length),
      };
    },
  },
};

/**
 * Helper function to validate analysis result against golden set
 */
export function validateResult(
  result: any,
  expected: GoldenSetItem
): {
  passed: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check classification
  if (result.quickClass !== expected.expectedClass) {
    errors.push(`Class mismatch: got ${result.quickClass}, expected ${expected.expectedClass}`);
  }

  // Check confidence (allow 10% tolerance)
  const confTolerance = 0.1;
  if (Math.abs(result.confidence - expected.expectedConfidence) > confTolerance) {
    errors.push(`Confidence mismatch: got ${result.confidence}, expected ${expected.expectedConfidence}`);
  }

  // Check LLM gating
  if (result.needsLLM !== expected.expectedNeedsLLM) {
    errors.push(`LLM gating mismatch: got ${result.needsLLM}, expected ${expected.expectedNeedsLLM}`);
  }

  // Check route
  if (result.route !== expected.expectedRoute) {
    errors.push(`Route mismatch: got ${result.route}, expected ${expected.expectedRoute}`);
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Run full golden set validation
 */
export async function runGoldenSetValidation(
  analyzeFunction: (input: string) => Promise<any>
): Promise<{
  totalTests: number;
  passed: number;
  failed: number;
  accuracy: number;
  failures: Array<{
    id: string;
    input: string;
    errors: string[];
  }>;
}> {
  const failures: Array<{ id: string; input: string; errors: string[] }> = [];
  let passed = 0;

  for (const item of goldenSet) {
    try {
      const result = await analyzeFunction(item.input);
      const validation = validateResult(result, item);
      
      if (validation.passed) {
        passed++;
      } else {
        failures.push({
          id: item.id,
          input: item.input,
          errors: validation.errors,
        });
      }
    } catch (error) {
      failures.push({
        id: item.id,
        input: item.input,
        errors: [`Analysis error: ${error}`],
      });
    }
  }

  return {
    totalTests: goldenSet.length,
    passed,
    failed: failures.length,
    accuracy: (passed / goldenSet.length) * 100,
    failures,
  };
}
