/**
 * 🧪 System-Mode Tests — Tracking (Real UnifiedAIPipeline)
 *
 * Verifies fresh/cache/hidden flows for compulsion tracking data.
 * Tags: [QRsys:tracking:fresh|cache|hidden]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
let unifiedPipeline: any;

const actualTelemetry = jest.requireActual('@/features/ai/telemetry/aiTelemetry');
import type { AIEventType as AIEventTypeType } from '@/features/ai/telemetry/aiTelemetry';
const AIEventType: typeof actualTelemetry.AIEventType = actualTelemetry.AIEventType;

import { TRACKING_SCENARIOS, generateTrackingData, TEST_ENV } from '../fixtures/seedData';

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

describe('System Tracking - Unified Pipeline', () => {
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

  it('[QRsys:tracking:fresh] processes fresh for compulsion dataset', async () => {
    const raw = generateTrackingData(TRACKING_SCENARIOS.high);
    const compulsions = raw.map(c => ({
      ...c,
      timestamp: c.created_at, // Pipeline expects timestamp
    }));

    const res = await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    expect(res.metadata.source).toBe('fresh');

    // Cache verified via telemetry/cache-hit in subsequent test
  });

  it('[QRsys:tracking:cache] returns cached result on repeat', async () => {
    const raw = generateTrackingData(TRACKING_SCENARIOS.medium);
    const compulsions = raw.map(c => ({ ...c, timestamp: c.created_at }));

    await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    const second = await unifiedPipeline.process({ userId, type: 'data', content: { compulsions }, context: { source: 'tracking' } });
    expect(second.metadata.source).toBe('cache');
  });

  it('[QRsys:tracking:hidden] has no qualityMetadata (UI hides ribbon when absent)', async () => {
    const res = await unifiedPipeline.process({ userId, type: 'data', content: {}, context: { source: 'tracking' } });
    expect('qualityMetadata' in (res as any)).toBe(false);
  });
});

