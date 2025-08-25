/**
 * Live Supabase Tests — Telemetry (QRlive)
 * Tags: [QRlive:telemetry:started] [QRlive:telemetry:completed]
 */
jest.mock('@/services/supabase', () => {
  const { createSupabaseTestClient } = require('./utils/supabaseTestClient');
  const client = createSupabaseTestClient();
  return {
    __esModule: true,
    default: { supabaseClient: client },
    supabaseClient: client,
  };
});

const { unifiedPipeline } = require('@/features/ai/core/UnifiedAIPipeline');
const { createSupabaseTestClient } = require('./utils/supabaseTestClient');

const userId = process.env.TEST_SEED_USER_ID || '00000000-0000-0000-0000-000000000001';
const supabase = createSupabaseTestClient();

async function cleanup() {
  await supabase.from('ai_telemetry').delete().eq('user_id', userId);
}

describe('Live Telemetry Supabase', () => {
  jest.setTimeout(20000);
  beforeAll(async () => {
    process.env.TEST_MODE = '1';
    process.env.TEST_TTL_MS = '5000';
    process.env.TEST_PIPELINE_STUB = '0';
    process.env.EXPO_PUBLIC_ENABLE_AI = 'true';
    process.env.TEST_SEED_USER_ID = userId;
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('[QRlive:telemetry:started] and [QRlive:telemetry:completed] are recorded', async () => {
    const moods = Array.from({ length: 6 }, (_, i) => ({ timestamp: Date.now() - i * 900e3, mood_score: 6 }));
    await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    // Poll until telemetry rows appear
    let data: any[] | null = null;
    let error: any = null;
    for (let i = 0; i < 10; i++) {
      const res = await supabase
        .from('ai_telemetry')
        .select('event_type')
        .eq('user_id', userId);
      data = (res as any).data as any[] | null;
      error = (res as any).error;
      if (!error && (data || []).length > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(error).toBeNull();
    const events = (data || []).map(r => String((r as any).event_type));
    expect(events.some(e => e.includes('unified_pipeline_started'))).toBe(true);
    expect(events.some(e => e.includes('unified_pipeline_completed'))).toBe(true);
  });
});


