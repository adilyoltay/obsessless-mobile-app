/**
 * 🧪 System-Mode Tests — Voice (Real UnifiedAIPipeline)
 *
 * Minimal fallback path validation for voice analysis to clear System Voice gating.
 * Tag: [QRsys:voice:fallback]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as pipeline from '@/features/ai/pipeline';

// Keep actual enums available
const actualTelemetry = jest.requireActual('@/features/ai/telemetry/aiTelemetry');

// Mock Supabase to avoid network
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

// Force the voice module to throw so pipeline uses heuristic fallback
jest.mock('@/features/ai/services/checkinService', () => ({
  __esModule: true,
  unifiedVoiceAnalysis: jest.fn(async () => { throw new Error('forced voice analysis failure'); })
}));

describe('System Voice - Unified Pipeline', () => {
  beforeAll(() => {
    process.env.TEST_MODE = '1';
    process.env.TEST_TTL_MS = '5000';
    process.env.TEST_PIPELINE_STUB = '0';
    process.env.TEST_SEED_USER_ID = process.env.TEST_SEED_USER_ID || 'test-user-1';
    process.env.EXPO_PUBLIC_ENABLE_AI = 'true';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await (AsyncStorage as any).clear();
  });

  it('[QRsys:voice:fallback] uses heuristic fallback when voice analysis fails', async () => {
    const userId = process.env.TEST_SEED_USER_ID || 'test-user-1';
    const text = 'Bugün biraz yorgun ve stresliyim, nefes egzersizi iyi gelebilir.';

    const result = await pipeline.process({
      userId,
      type: 'voice',
      content: text,
      context: { source: 'today' }
    });

    expect(result.metadata.source).toBe('fresh');
    expect(result.voice).toBeDefined();
    // Heuristic generator sets a generic suggestion
    expect(result.voice?.suggestion).toContain('Heuristic');
  });
});

