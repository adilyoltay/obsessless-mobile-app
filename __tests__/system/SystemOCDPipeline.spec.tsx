/**
 * 🧪 System-Mode Tests — OCD (Real UnifiedAIPipeline)
 *
 * Verifies OCD path using compulsion-like data to exercise pattern recognition.
 * Tags: [QRsys:ocd:fresh|cache|hidden]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
let unifiedPipeline: any;

const actualTelemetry = jest.requireActual('@/features/ai/telemetry/aiTelemetry');
import type { AIEventType as AIEventTypeType } from '@/features/ai/telemetry/aiTelemetry';
const AIEventType: typeof actualTelemetry.AIEventType = actualTelemetry.AIEventType;

import { TEST_ENV } from '../fixtures/seedData';

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

describe('System OCD - Unified Pipeline', () => {
  const userId = TEST_ENV.SEED_USER_ID;

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

  it('[QRsys:ocd:fresh] processes fresh with compulsion-like OCD data', async () => {
    const now = Date.now();
    // Minimal compulsion-like dataset for OCD
    const compulsions = Array.from({ length: 8 }, (_, i) => ({
      id: `ocd_${userId}_${i}`,
      user_id: userId,
      type: i % 2 === 0 ? 'washing' : 'checking',
      intensity: 6,
      duration_minutes: 15,
      resistance_level: 3,
      timestamp: new Date(now - i * 6 * 60 * 60 * 1000).toISOString(),
    }));

    const res = await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    expect(res.metadata.source).toBe('fresh');
  });

  it('[QRsys:ocd:cache] returns cached result on repeat', async () => {
    const now = Date.now();
    const compulsions = Array.from({ length: 5 }, (_, i) => ({
      id: `ocd_${userId}_med_${i}`,
      user_id: userId,
      type: 'checking',
      intensity: 5,
      duration_minutes: 10,
      resistance_level: 2,
      timestamp: new Date(now - i * 12 * 60 * 60 * 1000).toISOString(),
    }));

    await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    const second = await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    expect(second.metadata.source).toBe('cache');
  });

  it('[QRsys:ocd:hidden] has no qualityMetadata (UI hides)', async () => {
    const res = await unifiedPipeline.process({ userId, type: 'data', content: {}, context: { source: 'tracking' } });
    expect('qualityMetadata' in (res as any)).toBe(false);
  });
});

