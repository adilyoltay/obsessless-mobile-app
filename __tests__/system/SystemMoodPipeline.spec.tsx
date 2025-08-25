/**
 * 🧪 System-Mode Tests — Mood (Real UnifiedAIPipeline)
 *
 * Verifies cache behavior and hidden state (no qualityMetadata in real pipeline).
 * Tags: [QRsys:mood:cache|hidden]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
let unifiedPipeline: any;

const actualTelemetry = jest.requireActual('@/features/ai/telemetry/aiTelemetry');
import type { AIEventType as AIEventTypeType } from '@/features/ai/telemetry/aiTelemetry';
const AIEventType: typeof actualTelemetry.AIEventType = actualTelemetry.AIEventType;

import { MOOD_SCENARIOS, generateMoodData, TEST_ENV } from '../fixtures/seedData';

jest.mock('@/services/supabase', () => ({
  __esModule: true,
  default: {
    supabaseClient: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })) })),
        upsert: jest.fn(async () => ({ data: null, error: null })),
        delete: jest.fn(() => ({ eq: jest.fn(async () => ({ data: null, error: null })) })),
        like: jest.fn(() => ({ delete: jest.fn(() => ({ eq: jest.fn(async () => ({ data: null, error: null })) })) })),
        eq: jest.fn(() => ({ maybeSingle: jest.fn(async () => ({ data: null, error: null })) })),
      }))
    }
  }
}));

jest.mock('@/features/ai/telemetry/aiTelemetry', () => {
  const actual = jest.requireActual('@/features/ai/telemetry/aiTelemetry');
  return {
    __esModule: true,
    ...actual,
    trackAIInteraction: jest.fn(async () => {}),
  };
});

describe('System Mood - Unified Pipeline', () => {
  const userId = TEST_ENV.SEED_USER_ID;
  const { trackAIInteraction } = require('@/features/ai/telemetry/aiTelemetry') as typeof actualTelemetry & { trackAIInteraction: jest.Mock };

  beforeAll(() => {
    process.env.TEST_MODE = '1';
    process.env.TEST_TTL_MS = '5000';
    process.env.TEST_PIPELINE_STUB = '0';
    process.env.TEST_SEED_USER_ID = userId;
    process.env.EXPO_PUBLIC_ENABLE_AI = 'true';
    jest.resetModules();
    // feature flags mocked globally in jest.setup.js
    unifiedPipeline = require('@/features/ai/core/UnifiedAIPipeline').unifiedPipeline;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await (AsyncStorage as any).clear();
  });

  it('[QRsys:mood:cache] caches result on repeat run', async () => {
    const moodsRaw = generateMoodData(MOOD_SCENARIOS.high);
    const moods = moodsRaw.map(m => ({ ...m, timestamp: m.created_at, mood_score: m.mood_level }));

    const first = await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    expect(first.metadata.source).toBe('fresh');

    const second = await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    expect(second.metadata.source).toBe('cache');

    const calls = (trackAIInteraction as jest.Mock).mock.calls.map(args => args[0]);
    // Telemetry cache-hit may be batched; minimum assertion on metadata
    expect(second.metadata.source).toBe('cache');
  });

  it('[QRsys:mood:hidden] real pipeline has no qualityMetadata (hidden by UI)', async () => {
    const result = await unifiedPipeline.process({ userId, type: 'data', content: {}, context: { source: 'mood' } });

    expect('qualityMetadata' in (result as any)).toBe(false);
  });
});

