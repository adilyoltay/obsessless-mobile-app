/**
 * Live Supabase Tests — Today (QRlive)
 * Tags: [QRlive:today:fresh|cache|invalidate]
 */
// Replace app supabase service with service-role client for live tests
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
  await supabase.from('ai_cache').delete().ilike('cache_key', `unified:${userId}:%`);
  await supabase.from('ai_telemetry').delete().eq('user_id', userId);
}

describe('Live Today Supabase', () => {
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

  it('[QRlive:today:fresh] writes ai_cache on fresh run', async () => {
    const moods = Array.from({ length: 10 }, (_, i) => ({ timestamp: Date.now() - i * 3600e3, mood_score: 7 }));
    await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    // Poll briefly to allow DB upsert
    let data: any[] | null = null;
    let error: any = null;
    for (let i = 0; i < 10; i++) {
      const res = await supabase
        .from('ai_cache')
        .select('cache_key, content, expires_at')
        .ilike('cache_key', `unified:${userId}:%`)
        .limit(1);
      data = (res as any).data as any[] | null;
      error = (res as any).error;
      if (!error && (data || []).length > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(error).toBeNull();
    expect((data || []).length).toBeGreaterThan(0);
  });

  it('[QRlive:today:cache] reads from cache on second run', async () => {
    const moods = Array.from({ length: 8 }, (_, i) => ({ timestamp: Date.now() - i * 1800e3, mood_score: 6.5 }));
    await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    const second = await unifiedPipeline.process({ userId, type: 'data', content: { moods }, context: { source: 'mood' } });
    expect(second.metadata.source).toBe('cache');
  });

  it('[QRlive:today:invalidate] deletes ai_cache rows on invalidation', async () => {
    await unifiedPipeline.triggerInvalidation('mood_added', userId);
    // Poll for deletion
    let rows: any[] | null = null;
    let err: any = null;
    for (let i = 0; i < 10; i++) {
      const res = await supabase
        .from('ai_cache')
        .select('cache_key')
        .ilike('cache_key', `unified:${userId}:%`);
      rows = (res as any).data as any[] | null;
      err = (res as any).error;
      if (!err && (rows || []).length === 0) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(err).toBeNull();
    expect((rows || []).length).toBe(0);
  });
});


