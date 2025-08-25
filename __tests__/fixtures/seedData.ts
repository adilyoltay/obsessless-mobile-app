/**
 * 🌱 Test Seed Data Layer
 * 
 * Provides deterministic datasets for Quality Ribbon testing.
 * Supports mood high/med/low scenarios with specific sample thresholds.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  ProvenanceSource, 
  QualityLevel 
} from '@/features/ai/insights/insightRegistry';
import type { UnifiedPipelineResult } from '@/features/ai/core/UnifiedAIPipeline';

// ============================================================================
// TEST ENVIRONMENT CONFIGURATION
// ============================================================================

export const TEST_ENV = {
  MODE: process.env.TEST_MODE === '1',
  TTL_MS: parseInt(process.env.TEST_TTL_MS || '5000', 10), // 5 seconds
  PIPELINE_STUB: process.env.TEST_PIPELINE_STUB === '1',
  SEED_USER_ID: process.env.TEST_SEED_USER_ID || 'test-user-1',
};

// ============================================================================
// DETERMINISTIC DATA SCENARIOS
// ============================================================================

/**
 * 🎯 Mood data scenarios with specific sample sizes
 * - high: ≥14 days data (high quality)
 * - medium: 7-13 days data (medium quality)
 * - low: <7 days data (low quality)
 */
export const MOOD_SCENARIOS = {
  high: {
    name: 'mood_high',
    sampleSize: 16, // ≥14 days
    qualityLevel: 'high' as QualityLevel,
    confidence: 0.88,
    dataQuality: 0.92
  },
  medium: {
    name: 'mood_med',
    sampleSize: 10, // 7-13 days
    qualityLevel: 'medium' as QualityLevel,
    confidence: 0.72,
    dataQuality: 0.78
  },
  low: {
    name: 'mood_low',
    sampleSize: 4, // <7 days
    qualityLevel: 'low' as QualityLevel,
    confidence: 0.45,
    dataQuality: 0.58
  }
};

/**
 * 🎯 CBT analysis scenarios
 */
export const CBT_SCENARIOS = {
  high: {
    name: 'cbt_high',
    sampleSize: 12,
    qualityLevel: 'high' as QualityLevel,
    confidence: 0.85,
    dataQuality: 0.89
  },
  medium: {
    name: 'cbt_med',
    sampleSize: 7,
    qualityLevel: 'medium' as QualityLevel,
    confidence: 0.68,
    dataQuality: 0.74
  },
  low: {
    name: 'cbt_low',
    sampleSize: 3,
    qualityLevel: 'low' as QualityLevel,
    confidence: 0.42,
    dataQuality: 0.55
  }
};

/**
 * 🎯 Tracking/Compulsion scenarios
 */
export const TRACKING_SCENARIOS = {
  high: {
    name: 'tracking_high',
    sampleSize: 20,
    qualityLevel: 'high' as QualityLevel,
    confidence: 0.82,
    dataQuality: 0.86
  },
  medium: {
    name: 'tracking_med',
    sampleSize: 11,
    qualityLevel: 'medium' as QualityLevel,
    confidence: 0.65,
    dataQuality: 0.71
  },
  low: {
    name: 'tracking_low',
    sampleSize: 5,
    qualityLevel: 'low' as QualityLevel,
    confidence: 0.38,
    dataQuality: 0.52
  }
};

/**
 * 🔄 OCD scenarios with pattern-based triggers
 * - high: Rich pattern data with triggers (high quality)
 * - medium: Some patterns identified (medium quality)
 * - low: Sparse or no clear patterns (low quality)
 */
export const OCD_SCENARIOS = {
  high: {
    name: 'ocd_high',
    sampleSize: 18,
    qualityLevel: 'high' as QualityLevel,
    confidence: 0.89,
    dataQuality: 0.91,
    patterns: ['contamination', 'checking', 'symmetry'] as const
  },
  medium: {
    name: 'ocd_med',
    sampleSize: 9,
    qualityLevel: 'medium' as QualityLevel,
    confidence: 0.71,
    dataQuality: 0.76,
    patterns: ['contamination', 'checking'] as const
  },
  low: {
    name: 'ocd_low',
    sampleSize: 4,
    qualityLevel: 'low' as QualityLevel,
    confidence: 0.48,
    dataQuality: 0.58,
    patterns: ['contamination'] as const
  }
};

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate mood entries with realistic distribution
 */
export function generateMoodData(scenario: typeof MOOD_SCENARIOS[keyof typeof MOOD_SCENARIOS]) {
  return Array.from({ length: scenario.sampleSize }, (_, i) => {
    // Create realistic mood patterns
    const daysSinceStart = i;
    const basePattern = Math.sin(daysSinceStart * 0.2) * 2 + 6; // Oscillates around 6
    const noise = (Math.random() - 0.5) * 2; // -1 to +1
    const mood = Math.max(1, Math.min(10, Math.round(basePattern + noise)));
    
    return {
      id: `mood_${scenario.name}_${i}`,
      user_id: TEST_ENV.SEED_USER_ID,
      mood_level: mood,
      energy_level: Math.max(1, Math.min(10, mood + Math.round((Math.random() - 0.5) * 3))),
      anxiety_level: Math.max(1, Math.min(10, 11 - mood + Math.round((Math.random() - 0.5) * 2))),
      notes: i % 4 === 0 ? `Test mood entry ${i}` : null,
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
}

/**
 * Generate CBT thought records
 */
export function generateCBTData(scenario: typeof CBT_SCENARIOS[keyof typeof CBT_SCENARIOS]) {
  return Array.from({ length: scenario.sampleSize }, (_, i) => {
    const moodBefore = Math.floor(Math.random() * 4) + 3; // 3-6 (negative start)
    const improvement = Math.floor(Math.random() * 3) + 1; // 1-3 points improvement
    const moodAfter = Math.min(10, moodBefore + improvement);
    
    const situations = [
      "İş toplantısında hata yaptım",
      "Arkadaşım mesajıma geç cevap verdi",
      "Evde düzen bozuktu",
      "Sosyal medyada kendimi başkalarıyla karşılaştırdım",
      "İş yerinde eleştiri aldım"
    ];
    
    const negativeThoughts = [
      "Hep hata yapıyorum, beceriksizim",
      "Kimse beni sevmiyor",
      "Her şey çok dağınık, kontrolsüzüm",
      "Başkaları benden çok başarılı",
      "Bu işe yaramıyorum"
    ];
    
    const balancedThoughts = [
      "Herkes hata yapabilir, bu normal",
      "Arkadaşlarım meşgul olabilir",
      "Ev bazen dağınık olur, düzeltebilirim",
      "Herkesin farklı bir hikayesi var",
      "Eleştiri gelişmem için bir fırsat"
    ];
    
    return {
      id: `cbt_${scenario.name}_${i}`,
      user_id: TEST_ENV.SEED_USER_ID,
      situation: situations[i % situations.length],
      automatic_thoughts: negativeThoughts[i % negativeThoughts.length],
      emotions: JSON.stringify(["anxious", "sad", "worried"].slice(0, Math.floor(Math.random() * 3) + 1)),
      mood_before: moodBefore,
      mood_after: moodAfter,
      balanced_thoughts: balancedThoughts[i % balancedThoughts.length],
      created_at: new Date(Date.now() - i * 18 * 60 * 60 * 1000).toISOString(), // Every 18 hours
      updated_at: new Date(Date.now() - i * 18 * 60 * 60 * 1000).toISOString(),
    };
  });
}

/**
 * Generate compulsion tracking data
 */
export function generateTrackingData(scenario: typeof TRACKING_SCENARIOS[keyof typeof TRACKING_SCENARIOS]) {
  const compulsionTypes = [
    'washing', 'checking', 'counting', 'organizing', 'repeating'
  ];
  
  return Array.from({ length: scenario.sampleSize }, (_, i) => {
    return {
      id: `compulsion_${scenario.name}_${i}`,
      user_id: TEST_ENV.SEED_USER_ID,
      type: compulsionTypes[i % compulsionTypes.length],
      intensity: Math.floor(Math.random() * 7) + 4, // 4-10 (moderate to high)
      duration_minutes: Math.floor(Math.random() * 45) + 5, // 5-50 minutes
      resistance_level: Math.floor(Math.random() * 5) + 1, // 1-5
      location: i % 3 === 0 ? 'home' : i % 3 === 1 ? 'work' : 'public',
      notes: i % 5 === 0 ? `Notes for compulsion ${i}` : null,
      created_at: new Date(Date.now() - i * 8 * 60 * 60 * 1000).toISOString(), // Every 8 hours
      updated_at: new Date(Date.now() - i * 8 * 60 * 60 * 1000).toISOString(),
    };
  });
}

/**
 * Generate OCD pattern-based data
 */
export function generateOCDData(scenario: typeof OCD_SCENARIOS[keyof typeof OCD_SCENARIOS]) {
  const patterns = scenario.patterns;
  const patternTriggers = {
    contamination: [
      'Kapı kollarına dokunmak',
      'Banyo kullanımı',
      'Yemek hazırlama',
      'Dış mekanda bulunma',
      'Para/nakit kullanımı'
    ],
    checking: [
      'Kapıları kilitleme',
      'Elektronik cihazları kapatma',
      'Önemli belgeleri kontrol',
      'Güvenlik kontrolü',
      'Randevu/toplantı saatleri'
    ],
    symmetry: [
      'Eşyaları düzenleme',
      'Ayakkabıları sıralama',
      'Kitapları hizalama',
      'Tablodaki nesneleri yerleştirme',
      'Kıyafetleri katlamak'
    ]
  };
  
  return Array.from({ length: scenario.sampleSize }, (_, i) => {
    const currentPattern = patterns[i % patterns.length];
    const triggers = patternTriggers[currentPattern];
    const triggerText = triggers[i % triggers.length];
    
    return {
      id: `ocd_${scenario.name}_${i}`,
      user_id: TEST_ENV.SEED_USER_ID,
      pattern: currentPattern,
      trigger: triggerText,
      compulsion_type: getCompulsionForPattern(currentPattern),
      intensity: Math.floor(Math.random() * 6) + 5, // 5-10 (high intensity for OCD)
      duration_minutes: Math.floor(Math.random() * 60) + 10, // 10-70 minutes
      resistance_attempted: Math.random() > 0.3, // 70% resistance attempts
      resistance_success: Math.random() > 0.6, // 40% successful resistance
      urge_strength: Math.floor(Math.random() * 4) + 7, // 7-10 (strong urges)
      anxiety_before: Math.floor(Math.random() * 3) + 8, // 8-10 (high anxiety)
      anxiety_after: Math.floor(Math.random() * 5) + 3, // 3-7 (varies after compulsion)
      location: i % 3 === 0 ? 'home' : i % 3 === 1 ? 'work' : 'public',
      notes: `${currentPattern} pattern triggered by: ${triggerText}`,
      created_at: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(), // Every 12 hours
      updated_at: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
    };
  });
}

/**
 * Helper function to map OCD patterns to compulsion types
 */
function getCompulsionForPattern(pattern: 'contamination' | 'checking' | 'symmetry'): string {
  const compulsionMap = {
    contamination: 'washing',
    checking: 'checking',
    symmetry: 'organizing'
  };
  return compulsionMap[pattern];
}

// ============================================================================
// DETERMINISTIC PIPELINE RESULTS
// ============================================================================

/**
 * Generate deterministic UnifiedPipelineResult based on scenario
 */
export function createMockPipelineResult(
  source: ProvenanceSource,
  scenario: 'high' | 'medium' | 'low',
  module: 'mood' | 'cbt' | 'tracking' | 'ocd' = 'mood'
): UnifiedPipelineResult {
  const scenarioConfig = module === 'mood' ? MOOD_SCENARIOS[scenario] :
                        module === 'cbt' ? CBT_SCENARIOS[scenario] :
                        module === 'tracking' ? TRACKING_SCENARIOS[scenario] :
                        OCD_SCENARIOS[scenario];
  
  const freshnessMs = source === 'unified' ? 0 : // Fresh
                     source === 'cache' ? TEST_ENV.TTL_MS * 0.3 : // Cached (30% of TTL)
                     source === 'heuristic' ? 0 : // Fast
                     TEST_ENV.TTL_MS * 0.7; // LLM (70% of TTL)
  
  return {
    insights: {
      therapeutic: [
        {
          text: `${scenarioConfig.qualityLevel} quality therapeutic insight for ${module}`,
          confidence: scenarioConfig.confidence,
          priority: scenarioConfig.qualityLevel === 'high' ? 'high' : 
                   scenarioConfig.qualityLevel === 'medium' ? 'medium' : 'low',
          category: module,
          dataPoints: scenarioConfig.sampleSize
        }
      ],
      progress: [
        {
          metric: `${module}_improvement`,
          value: scenarioConfig.confidence * 10,
          change: scenarioConfig.qualityLevel === 'high' ? 0.8 : 
                 scenarioConfig.qualityLevel === 'medium' ? 0.4 : 0.1,
          changeDirection: 'up' as const,
          interpretation: `${scenarioConfig.qualityLevel} confidence improvement in ${module}`
        }
      ]
    },
    patterns: [
      {
        title: `${module} pattern (${scenarioConfig.qualityLevel} quality)`,
        description: `Detected pattern with ${scenarioConfig.sampleSize} data points`,
        confidence: scenarioConfig.confidence,
        type: 'temporal' as const,
        severity: scenarioConfig.qualityLevel as 'high' | 'medium' | 'low',
        dashboardMetrics: {
          sampleSize: scenarioConfig.sampleSize,
          dataQuality: scenarioConfig.dataQuality,
          coverage: scenarioConfig.confidence
        }
      }
    ],
    analytics: {
      [module]: {
        confidence: scenarioConfig.confidence,
        sampleSize: scenarioConfig.sampleSize,
        volatility: scenarioConfig.qualityLevel === 'low' ? 2.1 : 0.8,
        weeklyDelta: scenarioConfig.qualityLevel === 'high' ? 1.2 : 
                    scenarioConfig.qualityLevel === 'medium' ? 0.6 : -0.2,
        dataQuality: scenarioConfig.dataQuality,
        baselines: { [module]: 6.5 }
      }
    } as any,
    metadata: {
      source: source === 'unified' ? 'fresh' : source,
      processedAt: Date.now() - freshnessMs,
      processingTime: source === 'heuristic' ? 150 : 2400,
      pipelineVersion: '1.0',
      cacheTTL: TEST_ENV.TTL_MS
    },
    qualityMetadata: {
      source: source === 'unified' ? 'unified' : source,
      quality: scenarioConfig.qualityLevel,
      sampleSize: scenarioConfig.sampleSize,
      confidence: scenarioConfig.confidence,
      dataQuality: scenarioConfig.dataQuality,
      freshnessMs: freshnessMs
    }
  };
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * 🧹 Clear all test data from storage
 */
export async function clearAllTestData(): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('clearAllTestData called outside test mode');
    return;
  }
  
  try {
    // Clear AsyncStorage test keys
    const allKeys = await AsyncStorage.getAllKeys();
    const testKeys = allKeys.filter(key => 
      key.includes('test-user-1') || 
      key.includes('_test_') ||
      key.startsWith('quality_ribbon_test_')
    );
    
    if (testKeys.length > 0) {
      await AsyncStorage.multiRemove(testKeys);
    }
    
    console.log(`🧹 Cleared ${testKeys.length} test data entries`);
  } catch (error) {
    console.error('Failed to clear test data:', error);
  }
}

/**
 * 🌱 Seed storage with scenario data
 */
export async function seedTestData(
  scenario: 'high' | 'medium' | 'low',
  modules: ('mood' | 'cbt' | 'tracking' | 'ocd')[] = ['mood']
): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('seedTestData called outside test mode');
    return;
  }
  
  console.log(`🌱 Seeding ${scenario} quality data for modules: ${modules.join(', ')}`);
  
  try {
    // Clear existing test data first
    await clearAllTestData();
    
    // Seed data for each requested module
    for (const module of modules) {
      if (module === 'mood') {
        const moodData = generateMoodData(MOOD_SCENARIOS[scenario]);
        await AsyncStorage.setItem(
          `quality_ribbon_test_mood_${scenario}`, 
          JSON.stringify(moodData)
        );
      } else if (module === 'cbt') {
        const cbtData = generateCBTData(CBT_SCENARIOS[scenario]);
        await AsyncStorage.setItem(
          `quality_ribbon_test_cbt_${scenario}`,
          JSON.stringify(cbtData)
        );
      } else if (module === 'tracking') {
        const trackingData = generateTrackingData(TRACKING_SCENARIOS[scenario]);
        await AsyncStorage.setItem(
          `quality_ribbon_test_tracking_${scenario}`,
          JSON.stringify(trackingData)
        );
      } else if (module === 'ocd') {
        const ocdData = generateOCDData(OCD_SCENARIOS[scenario]);
        await AsyncStorage.setItem(
          `quality_ribbon_test_ocd_${scenario}`,
          JSON.stringify(ocdData)
        );
      }
    }
    
    console.log(`✅ Seeded ${scenario} quality test data successfully`);
  } catch (error) {
    console.error(`Failed to seed test data for ${scenario}:`, error);
    throw error;
  }
}

/**
 * 🎯 Get seeded data for a specific module and scenario
 */
export async function getSeededData(
  module: 'mood' | 'cbt' | 'tracking',
  scenario: 'high' | 'medium' | 'low'
): Promise<any[]> {
  try {
    const key = `quality_ribbon_test_${module}_${scenario}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Failed to get seeded data for ${module}-${scenario}:`, error);
    return [];
  }
}

/**
 * ⏰ Wait helper for test timing
 */
export const waitForElement = async (
  query: () => any, 
  timeoutMs: number = 8000
): Promise<any> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = query();
    if (el) return el;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Element not found within ${timeoutMs}ms timeout`);
};

/**
 * 🕐 Wait for specific duration in tests
 */
export const waitForDuration = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 🎭 Mock pipeline response for deterministic testing
 */
export function mockUnifiedPipelineProcess(
  source: ProvenanceSource = 'unified',
  scenario: 'high' | 'medium' | 'low' = 'high',
  module: 'mood' | 'cbt' | 'tracking' | 'ocd' = 'mood'
) {
  const result = createMockPipelineResult(source, scenario, module);
  
  return {
    process: jest.fn().mockResolvedValue(result),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
    getCacheKey: jest.fn().mockReturnValue(`test_${module}_${scenario}_${source}`),
  };
}

// ============================================================================
// SPECIALIZED SEED FUNCTIONS (As requested in requirements)
// ============================================================================

/**
 * 🔄 Seed tracking compulsions with specific parameters
 * @param userId - User identifier  
 * @param days - Number of days to spread data across
 * @param perDay - Number of compulsions per day
 * @param category - Optional OCD category filter
 */
export async function seedTrackingCompulsions(
  userId: string, 
  days: number, 
  perDay: number, 
  category?: 'contamination' | 'checking' | 'symmetry'
): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('seedTrackingCompulsions called outside test mode');
    return;
  }

  const totalCompulsions = days * perDay;
  const compulsionTypes = category ? [getCompulsionForPattern(category)] : 
    ['washing', 'checking', 'organizing', 'repeating', 'counting'];
  
  const compulsions = Array.from({ length: totalCompulsions }, (_, i) => {
    const dayIndex = Math.floor(i / perDay);
    const timeOffset = dayIndex * 24 * 60 * 60 * 1000 + (i % perDay) * (8 * 60 * 60 * 1000); // Spread across day
    
    return {
      id: `tracking_${userId}_${i}`,
      user_id: userId,
      type: compulsionTypes[i % compulsionTypes.length],
      intensity: Math.floor(Math.random() * 6) + 5, // 5-10 for tracking tests
      duration_minutes: Math.floor(Math.random() * 45) + 10, // 10-55 minutes
      resistance_level: Math.floor(Math.random() * 5) + 1,
      location: ['home', 'work', 'public'][i % 3],
      notes: category ? `${category} pattern - compulsion ${i}` : `Compulsion ${i}`,
      created_at: new Date(Date.now() - timeOffset).toISOString(),
      updated_at: new Date(Date.now() - timeOffset).toISOString(),
    };
  });

  await AsyncStorage.setItem(
    `tracking_compulsions_${userId}`,
    JSON.stringify(compulsions)
  );
  
  console.log(`🔄 Seeded ${totalCompulsions} tracking compulsions for ${userId} (${days} days, ${perDay}/day)`);
}

/**
 * 🧠 Seed CBT thought records with specified count and options
 * @param userId - User identifier
 * @param count - Number of records to generate  
 * @param options - Optional configuration including distortions
 */
export async function seedCBTRecords(
  userId: string,
  count: number,
  options?: { distortions?: string[] }
): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('seedCBTRecords called outside test mode');
    return;
  }

  const defaultDistortions = [
    'catastrophizing',
    'all-or-nothing',
    'mind-reading', 
    'personalization',
    'overgeneralization'
  ];
  
  const distortions = options?.distortions || defaultDistortions;
  
  const records = Array.from({ length: count }, (_, i) => {
    const moodBefore = Math.floor(Math.random() * 4) + 3; // 3-6 (negative start)
    const improvement = Math.floor(Math.random() * 3) + 1; // 1-3 points improvement
    const moodAfter = Math.min(10, moodBefore + improvement);
    
    return {
      id: `cbt_${userId}_${i}`,
      user_id: userId,
      situation: `CBT test scenario ${i}: Daily situation requiring thought challenging`,
      automatic_thought: `Negative thought pattern ${i}: This represents ${distortions[i % distortions.length]}`,
      cognitive_distortion: distortions[i % distortions.length],
      evidence_for: `Some supporting evidence for thought ${i}`,
      evidence_against: `Counter-evidence that challenges thought ${i}`,
      balanced_thought: `More balanced perspective for situation ${i}`,
      mood_before: moodBefore,
      mood_after: moodAfter,
      intensity_before: Math.floor(Math.random() * 4) + 7, // 7-10
      intensity_after: Math.floor(Math.random() * 5) + 3, // 3-7
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  await AsyncStorage.setItem(
    `cbt_records_${userId}`,
    JSON.stringify(records)
  );
  
  console.log(`🧠 Seeded ${count} CBT records for ${userId} with distortions: ${distortions.join(', ')}`);
}

/**
 * 🔄 Seed OCD scenario with specific pattern over time
 * @param userId - User identifier
 * @param days - Number of days to spread data across
 * @param pattern - OCD pattern type to focus on
 */
export async function seedOCDScenario(
  userId: string,
  days: number,
  pattern?: 'contamination' | 'checking' | 'symmetry'
): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('seedOCDScenario called outside test mode');
    return;
  }

  const selectedPattern = pattern || 'contamination';
  const entriesPerDay = 2; // Realistic frequency for OCD scenarios
  const totalEntries = days * entriesPerDay;
  
  // Get OCD data using existing generator with focused pattern
  const ocdScenario = {
    name: `ocd_${selectedPattern}`,
    sampleSize: totalEntries,
    qualityLevel: 'high' as QualityLevel,
    confidence: 0.89,
    dataQuality: 0.91,
    patterns: [selectedPattern] as const
  };
  
  const ocdData = generateOCDData(ocdScenario);
  
  // Adjust timestamps to spread across days
  const adjustedData = ocdData.map((entry, i) => ({
    ...entry,
    id: `ocd_${userId}_${i}`,
    user_id: userId,
    created_at: new Date(Date.now() - Math.floor(i / entriesPerDay) * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - Math.floor(i / entriesPerDay) * 24 * 60 * 60 * 1000).toISOString(),
  }));

  await AsyncStorage.setItem(
    `ocd_scenario_${userId}`,
    JSON.stringify(adjustedData)
  );
  
  console.log(`🔄 Seeded OCD ${selectedPattern} scenario for ${userId} (${days} days, ${totalEntries} entries)`);
}

/**
 * 🧹 Clean up seed data for specific user
 * @param userId - User identifier to clean data for
 */
export async function cleanupSeeds(userId: string): Promise<void> {
  if (!TEST_ENV.MODE) {
    console.warn('cleanupSeeds called outside test mode');
    return;
  }

  try {
    const keysToRemove = [
      `tracking_compulsions_${userId}`,
      `cbt_records_${userId}`,
      `ocd_scenario_${userId}`,
      // Also clean general test keys that might have this user's data
      'quality_ribbon_test_mood_high',
      'quality_ribbon_test_mood_medium', 
      'quality_ribbon_test_mood_low',
      'quality_ribbon_test_cbt_high',
      'quality_ribbon_test_cbt_medium',
      'quality_ribbon_test_cbt_low',
      'quality_ribbon_test_tracking_high',
      'quality_ribbon_test_tracking_medium',
      'quality_ribbon_test_tracking_low',
      'quality_ribbon_test_ocd_high',
      'quality_ribbon_test_ocd_medium',
      'quality_ribbon_test_ocd_low'
    ];
    
    for (const key of keysToRemove) {
      await AsyncStorage.removeItem(key);
    }
    
    console.log(`🧹 Cleaned up seed data for user: ${userId}`);
  } catch (error) {
    console.error(`Failed to cleanup seeds for ${userId}:`, error);
  }
}

// ============================================================================
// GLOBAL TEST HELPERS (Added to jest.setup.js)
// ============================================================================

// These are added to jest.setup.js for global access in tests
declare global {
  var waitForElement: typeof waitForElement;
  var seedTestData: typeof seedTestData;
  var clearAllTestData: typeof clearAllTestData;
  var mockUnifiedPipelineProcess: typeof mockUnifiedPipelineProcess;
  var seedTrackingCompulsions: typeof seedTrackingCompulsions;
  var seedCBTRecords: typeof seedCBTRecords;
  var seedOCDScenario: typeof seedOCDScenario;
  var cleanupSeeds: typeof cleanupSeeds;
  var TEST_ENV: typeof TEST_ENV;
}
