/**
 * 🧪 Quality Ribbon Test Fixtures
 * 
 * Mock data and utilities for testing Quality Ribbon system
 * across all components and pages.
 */

import type { 
  InsightRegistryItem, 
  ProvenanceSource, 
  QualityLevel 
} from '@/features/ai/insights/insightRegistry';
import type { UnifiedPipelineResult } from '@/features/ai/pipeline';
import type { AdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';

// Mock Pipeline Results
export const mockUnifiedPipelineResult: UnifiedPipelineResult = {
  insights: {
    therapeutic: [
      {
        text: "5 dakikalık nefes egzersizi yaparak anksiyeteni azaltabilirsin",
        confidence: 0.85,
        priority: "high",
        category: "breathwork",
        dataPoints: 12
      }
    ],
    progress: [
      {
        metric: "mood_improvement",
        value: 1.2,
        change: 0.3,
        changeDirection: "up",
        interpretation: "Mood seviyende genel iyileşme var"
      }
    ]
  },
  patterns: [
    {
      title: "Akşam Saatleri Mood Düşüklüğü",
      description: "18:00-21:00 arasında mood seviyende düşüş gözlemleniyor",
      confidence: 0.78,
      type: "temporal",
      severity: "medium",
      dashboardMetrics: {
        sampleSize: 15,
        dataQuality: 0.85,
        coverage: 0.90
      }
    }
  ],
  analytics: {
    mood: {
      confidence: 0.85,
      sampleSize: 15,
      volatility: 0.8,
      weeklyDelta: 1.2,
      dataQuality: 0.88,
      baselines: { mood: 6.5 }
    },
    cbt: {
      confidence: 0.75,
      sampleSize: 8,
      volatility: 1.1,
      weeklyDelta: 0.9,
      dataQuality: 0.82,
      baselines: { moodImprovement: 1.3 }
    },
    tracking: {
      confidence: 0.70,
      sampleSize: 22,
      volatility: 2.1,
      weeklyDelta: -1.5,
      dataQuality: 0.79,
      baselines: { compulsions: 3.2 }
    }
  },
  metadata: {
    source: 'fresh',
    processedAt: Date.now() - 300000, // 5 minutes ago
    processingTime: 2400,
    pipelineVersion: '1.0',
    cacheTTL: 1800000 // 30 minutes
  }
};

// Mock Registry Items
export const mockRegistryItems: InsightRegistryItem[] = [
  {
    id: 'mood_insight_1',
    kind: 'insight',
    category: 'mood',
    module: 'mood',
    provenance: {
      source: 'unified',
      version: '1.0',
      generatedAt: Date.now() - 300000,
      ttlMs: 1800000
    },
    quality: {
      confidence: 0.85,
      sampleSize: 15,
      dataQuality: 0.88,
      freshnessMs: 300000,
      stability: 0.9
    },
    privacy: {
      piiSanitized: true,
      auditHash: 'abc123'
    },
    payload: {
      title: 'Mood İyileşme Önerisi',
      summary: 'Nefes egzersizi ile mood iyileştirme',
      metrics: { priority: 'high' },
      actions: [
        { label: 'Nefes Egzersizi', screen: '/(tabs)/breathwork' }
      ]
    }
  }
];

// Mock Adaptive Suggestions
export const mockAdaptiveSuggestions = {
  highQuality: {
    show: true,
    title: "Kısa Bir Mola",
    content: "Kendini zorlayıcı hissediyorsun. 5 dakikalık nefes egzersizi rahatlatabilitr.",
    category: "breathwork",
    confidence: 0.88,
    cta: {
      screen: "/(tabs)/breathwork",
      params: { technique: "4-7-8" }
    },
    source: "pipeline_analysis"
  } as AdaptiveSuggestion,
  
  mediumQuality: {
    show: true,
    title: "Düşünce Kaydı Önerisi", 
    content: "Son zamanlarda yoğun düşünceler yaşadığını fark ettim. CBT kaydı yapabilir misin?",
    category: "cbt",
    confidence: 0.65,
    cta: {
      screen: "/(tabs)/cbt",
      params: {}
    },
    source: "context_analysis"
  } as AdaptiveSuggestion,
  
  lowQuality: {
    show: true,
    title: "Genel Öneri",
    content: "Bugün kendine nasıl hissettiğini kaydetmeyi deneyelim.",
    category: "mood", 
    confidence: 0.45,
    cta: {
      screen: "/(tabs)/mood",
      params: {}
    },
    source: "heuristic"
  } as AdaptiveSuggestion
};

// Mock Quality Meta Objects
export const mockQualityMeta = {
  highQuality: {
    source: 'unified' as ProvenanceSource,
    qualityLevel: 'high' as QualityLevel,
    sampleSize: 15,
    freshnessMs: 300000 // 5 minutes
  },
  
  mediumQuality: {
    source: 'cache' as ProvenanceSource,
    qualityLevel: 'medium' as QualityLevel, 
    sampleSize: 8,
    freshnessMs: 7200000 // 2 hours
  },
  
  lowQuality: {
    source: 'heuristic' as ProvenanceSource,
    qualityLevel: 'low' as QualityLevel,
    sampleSize: 3,
    freshnessMs: 0 // now
  }
};

// Test Data Generators
export const generateMoodEntries = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `mood_${i}`,
    mood: Math.floor(Math.random() * 10) + 1,
    energy: Math.floor(Math.random() * 10) + 1,
    anxiety: Math.floor(Math.random() * 10) + 1,
    timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    notes: i % 3 === 0 ? `Test mood entry ${i}` : undefined
  }));
};

export const generateCBTRecords = (count: number) => {
  return Array.from({ length: count }, (_, i) => {
    const moodBefore = Math.floor(Math.random() * 7) + 1; // 1-7
    const moodAfter = Math.min(10, moodBefore + Math.floor(Math.random() * 4)); // Usually improvement
    
    return {
      id: `cbt_${i}`,
      situation: `Test situation ${i}`,
      automaticThoughts: `Negative thought ${i}`,
      emotions: ["anxious", "worried"],
      mood_before: moodBefore,
      mood_after: moodAfter,
      balancedThoughts: `Balanced thought ${i}`,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    };
  });
};

export const generateCompulsions = (count: number) => {
  const types = ['washing', 'checking', 'counting', 'organizing'];
  return Array.from({ length: count }, (_, i) => ({
    id: `compulsion_${i}`,
    type: types[i % types.length],
    intensity: Math.floor(Math.random() * 10) + 1,
    duration: Math.floor(Math.random() * 30) + 5,
    resistanceLevel: Math.floor(Math.random() * 5) + 1,
    timestamp: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString(), // Every 6 hours
    location: i % 2 === 0 ? 'home' : 'work'
  }));
};

// Mock Analytics Results
export const mockAnalyticsResults = {
  mood: {
    confidence: 0.85,
    sampleSize: 15,
    volatility: 0.8,
    weeklyDelta: 1.2,
    dataQuality: 0.88
  },
  cbt: {
    confidence: 0.75,
    sampleSize: 8,
    volatility: 1.1, 
    weeklyDelta: 0.9,
    dataQuality: 0.82
  },
  tracking: {
    confidence: 0.70,
    sampleSize: 22,
    volatility: 2.1,
    weeklyDelta: -1.5,
    dataQuality: 0.79
  }
};

// Test Utilities
export const waitForPipelineCompletion = (timeout = 5000) => {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // In real tests, this would check for specific log messages
      // or state changes indicating pipeline completion
      resolve(true);
      clearInterval(checkInterval);
    }, 100);
    
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve(false);
    }, timeout);
  });
};

export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Quality Ribbon Test Helpers
export const expectQualityRibbonToShow = (
  component: any,
  expectedSource: ProvenanceSource,
  expectedQuality: QualityLevel,
  expectedSampleSize?: number
) => {
  // Helper function to be used in tests
  const ribbonElements = component.getAllByTestID('quality-ribbon');
  expect(ribbonElements).toHaveLength(1);
  
  // Check badges based on expected values
  const sourceText = expectedSource === 'unified' ? 'Fresh' : 
                    expectedSource === 'cache' ? 'Cache' :
                    expectedSource === 'heuristic' ? 'Fast' : 'LLM';
  
  const qualityText = expectedQuality === 'high' ? 'High' :
                     expectedQuality === 'medium' ? 'Med' : 'Low';
  
  expect(component.getByText(sourceText)).toBeTruthy();
  expect(component.getByText(qualityText)).toBeTruthy();
  
  if (expectedSampleSize) {
    expect(component.getByText(`n=${expectedSampleSize}`)).toBeTruthy();
  }
};

// Mock Date for consistent testing
export const mockDateNow = (fixedTimestamp?: number) => {
  const timestamp = fixedTimestamp || 1640995200000; // 2022-01-01 00:00:00 UTC
  jest.spyOn(Date, 'now').mockReturnValue(timestamp);
  return timestamp;
};
