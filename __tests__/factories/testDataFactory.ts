/**
 * 🏭 Test Data Factory
 * Test senaryoları için tutarlı ve gerçekçi mock veri üretimi
 */

import { faker } from '@faker-js/faker';

// Türkçe faker locale ayarı
faker.locale = 'tr';

/**
 * Mood Entry Factory
 */
export const createMoodEntry = (overrides?: Partial<any>) => ({
  id: faker.datatype.uuid(),
  userId: faker.datatype.uuid(),
  value: faker.datatype.number({ min: 1, max: 10 }),
  energy: faker.datatype.number({ min: 1, max: 10 }),
  anxiety: faker.datatype.number({ min: 1, max: 10 }),
  notes: faker.datatype.boolean() ? faker.lorem.sentence() : null,
  timestamp: faker.date.recent(30).toISOString(),
  createdAt: faker.date.recent(30).toISOString(),
  ...overrides
});

/**
 * Bulk mood entries üretimi
 */
export const createMoodEntries = (count: number, userId?: string) => {
  const fixedUserId = userId || faker.datatype.uuid();
  return Array.from({ length: count }, (_, i) => 
    createMoodEntry({
      userId: fixedUserId,
      timestamp: faker.date.recent(30 - i).toISOString()
    })
  );
};

/**
 * CBT Thought Record Factory
 */
export const createCBTRecord = (overrides?: Partial<any>) => ({
  id: faker.datatype.uuid(),
  userId: faker.datatype.uuid(),
  situation: faker.lorem.paragraph(),
  automaticThoughts: faker.lorem.sentences(2),
  emotions: [
    {
      name: faker.helpers.arrayElement(['kaygı', 'üzüntü', 'öfke', 'korku']),
      intensity: faker.datatype.number({ min: 1, max: 10 })
    }
  ],
  moodBefore: faker.datatype.number({ min: 1, max: 10 }),
  moodAfter: faker.datatype.number({ min: 4, max: 10 }), // Genelde iyileşme olur
  balancedThoughts: faker.lorem.sentences(2),
  evidence: faker.lorem.sentence(),
  counterEvidence: faker.lorem.sentence(),
  timestamp: faker.date.recent(30).toISOString(),
  createdAt: faker.date.recent(30).toISOString(),
  ...overrides
});

/**
 * Compulsion/OCD Tracking Factory
 */
export const createCompulsion = (overrides?: Partial<any>) => ({
  id: faker.datatype.uuid(),
  userId: faker.datatype.uuid(),
  type: faker.helpers.arrayElement(['checking', 'washing', 'ordering', 'counting', 'repeating']),
  intensity: faker.datatype.number({ min: 1, max: 10 }),
  duration: faker.datatype.number({ min: 1, max: 120 }), // dakika
  resistanceLevel: faker.datatype.number({ min: 1, max: 5 }),
  trigger: faker.lorem.word(),
  location: faker.helpers.arrayElement(['ev', 'iş', 'dışarı', 'araba']),
  notes: faker.datatype.boolean() ? faker.lorem.sentence() : null,
  timestamp: faker.date.recent(30).toISOString(),
  createdAt: faker.date.recent(30).toISOString(),
  ...overrides
});

/**
 * Breathwork Session Factory
 */
export const createBreathworkSession = (overrides?: Partial<any>) => ({
  id: faker.datatype.uuid(),
  userId: faker.datatype.uuid(),
  technique: faker.helpers.arrayElement(['4-7-8', 'box', 'diaphragmatic', 'alternate']),
  duration: faker.datatype.number({ min: 3, max: 15 }), // dakika
  anxietyBefore: faker.datatype.number({ min: 4, max: 10 }),
  anxietyAfter: faker.datatype.number({ min: 1, max: 6 }),
  completed: true,
  timestamp: faker.date.recent(30).toISOString(),
  createdAt: faker.date.recent(30).toISOString(),
  ...overrides
});

/**
 * AI Pipeline Input Factory
 */
export const createPipelineInput = (type: 'voice' | 'data' | 'mixed', overrides?: Partial<any>) => {
  const baseInput = {
    userId: faker.datatype.uuid(),
    context: {
      source: faker.helpers.arrayElement(['today', 'mood', 'tracking', 'cbt']),
      timestamp: Date.now()
    }
  };
  
  switch (type) {
    case 'voice':
      return {
        ...baseInput,
        type: 'voice' as const,
        content: faker.lorem.paragraph(),
        ...overrides
      };
      
    case 'data':
      return {
        ...baseInput,
        type: 'data' as const,
        content: {
          moodEntries: createMoodEntries(5),
          cbtRecords: Array.from({ length: 3 }, () => createCBTRecord()),
          compulsions: Array.from({ length: 7 }, () => createCompulsion())
        },
        ...overrides
      };
      
    case 'mixed':
      return {
        ...baseInput,
        type: 'mixed' as const,
        content: {
          voice: faker.lorem.paragraph(),
          data: {
            moodEntries: createMoodEntries(3),
            compulsions: Array.from({ length: 2 }, () => createCompulsion())
          }
        },
        ...overrides
      };
  }
};

/**
 * Quality Metadata Factory
 */
export const createQualityMetadata = (level: 'high' | 'medium' | 'low', overrides?: Partial<any>) => {
  const configs = {
    high: {
      source: 'unified',
      qualityLevel: 'high',
      sampleSize: faker.datatype.number({ min: 10, max: 50 }),
      freshnessMs: faker.datatype.number({ min: 100, max: 5000 }),
      confidence: faker.datatype.float({ min: 0.8, max: 1.0, precision: 0.01 })
    },
    medium: {
      source: faker.helpers.arrayElement(['cache', 'unified']),
      qualityLevel: 'medium',
      sampleSize: faker.datatype.number({ min: 3, max: 9 }),
      freshnessMs: faker.datatype.number({ min: 60000, max: 600000 }),
      confidence: faker.datatype.float({ min: 0.5, max: 0.79, precision: 0.01 })
    },
    low: {
      source: 'heuristic',
      qualityLevel: 'low',
      sampleSize: faker.datatype.number({ min: 0, max: 2 }),
      freshnessMs: 0,
      confidence: faker.datatype.float({ min: 0.1, max: 0.49, precision: 0.01 })
    }
  };
  
  return {
    ...configs[level],
    timestamp: Date.now(),
    ...overrides
  };
};

/**
 * Adaptive Suggestion Factory
 */
export const createAdaptiveSuggestion = (overrides?: Partial<any>) => ({
  id: faker.datatype.uuid(),
  type: faker.helpers.arrayElement(['breathing', 'mood', 'cbt', 'tracking', 'exercise']),
  title: faker.lorem.sentence(4),
  description: faker.lorem.paragraph(),
  priority: faker.datatype.number({ min: 1, max: 10 }),
  action: {
    label: faker.helpers.arrayElement(['Şimdi Dene', 'Başla', 'Devam Et']),
    route: faker.helpers.arrayElement(['/breathwork', '/mood', '/cbt', '/tracking'])
  },
  metadata: createQualityMetadata(faker.helpers.arrayElement(['high', 'medium', 'low'])),
  ...overrides
});

/**
 * Test Scenario Builder
 * Belirli test senaryoları için önceden yapılandırılmış veri setleri
 */
export class TestScenarioBuilder {
  /**
   * Yeni kullanıcı senaryosu (az veri)
   */
  static newUser(userId?: string) {
    const id = userId || faker.datatype.uuid();
    return {
      userId: id,
      moodEntries: createMoodEntries(2, id),
      cbtRecords: [],
      compulsions: [createCompulsion({ userId: id })],
      breathworkSessions: []
    };
  }
  
  /**
   * Aktif kullanıcı senaryosu (orta veri)
   */
  static activeUser(userId?: string) {
    const id = userId || faker.datatype.uuid();
    return {
      userId: id,
      moodEntries: createMoodEntries(10, id),
      cbtRecords: Array.from({ length: 5 }, () => createCBTRecord({ userId: id })),
      compulsions: Array.from({ length: 15 }, () => createCompulsion({ userId: id })),
      breathworkSessions: Array.from({ length: 7 }, () => createBreathworkSession({ userId: id }))
    };
  }
  
  /**
   * Power user senaryosu (çok veri)
   */
  static powerUser(userId?: string) {
    const id = userId || faker.datatype.uuid();
    return {
      userId: id,
      moodEntries: createMoodEntries(30, id),
      cbtRecords: Array.from({ length: 20 }, () => createCBTRecord({ userId: id })),
      compulsions: Array.from({ length: 50 }, () => createCompulsion({ userId: id })),
      breathworkSessions: Array.from({ length: 25 }, () => createBreathworkSession({ userId: id }))
    };
  }
  
  /**
   * İyileşme gösteren kullanıcı
   */
  static improvingUser(userId?: string) {
    const id = userId || faker.datatype.uuid();
    const now = Date.now();
    
    // Mood değerleri zamanla artıyor
    const moodEntries = Array.from({ length: 14 }, (_, i) => 
      createMoodEntry({
        userId: id,
        value: Math.min(10, 3 + Math.floor(i / 2)), // 3'ten başlayıp 10'a çıkıyor
        timestamp: new Date(now - (14 - i) * 86400000).toISOString()
      })
    );
    
    // Kompülsiyon sayısı azalıyor
    const compulsions = Array.from({ length: 20 }, (_, i) => {
      const daysAgo = Math.floor(i / 2);
      return createCompulsion({
        userId: id,
        intensity: Math.max(1, 10 - daysAgo), // Yoğunluk azalıyor
        timestamp: new Date(now - daysAgo * 86400000).toISOString()
      });
    });
    
    return {
      userId: id,
      moodEntries,
      cbtRecords: Array.from({ length: 10 }, () => createCBTRecord({ 
        userId: id,
        moodAfter: faker.datatype.number({ min: 7, max: 10 }) // İyi sonuçlar
      })),
      compulsions,
      breathworkSessions: Array.from({ length: 15 }, () => createBreathworkSession({ userId: id }))
    };
  }
  
  /**
   * Kötüleşen kullanıcı (müdahale gerekli)
   */
  static decliningUser(userId?: string) {
    const id = userId || faker.datatype.uuid();
    const now = Date.now();
    
    // Mood değerleri zamanla düşüyor
    const moodEntries = Array.from({ length: 14 }, (_, i) => 
      createMoodEntry({
        userId: id,
        value: Math.max(1, 8 - Math.floor(i / 2)), // 8'den başlayıp 1'e düşüyor
        anxiety: Math.min(10, 3 + Math.floor(i / 2)), // Kaygı artıyor
        timestamp: new Date(now - (14 - i) * 86400000).toISOString()
      })
    );
    
    // Kompülsiyon sayısı artıyor
    const compulsions = Array.from({ length: 30 }, (_, i) => {
      const daysAgo = Math.floor(i / 3);
      return createCompulsion({
        userId: id,
        intensity: Math.min(10, 5 + daysAgo), // Yoğunluk artıyor
        timestamp: new Date(now - daysAgo * 86400000).toISOString()
      });
    });
    
    return {
      userId: id,
      moodEntries,
      cbtRecords: Array.from({ length: 3 }, () => createCBTRecord({ 
        userId: id,
        moodAfter: faker.datatype.number({ min: 1, max: 4 }) // Kötü sonuçlar
      })),
      compulsions,
      breathworkSessions: [] // Egzersiz yapmıyor
    };
  }
}

/**
 * Test verilerini temizleme helper'ı
 */
export const cleanupTestData = async () => {
  // AsyncStorage veya test database'ini temizle
  // Implementation depends on test environment
  console.log('Test data cleaned up');
};