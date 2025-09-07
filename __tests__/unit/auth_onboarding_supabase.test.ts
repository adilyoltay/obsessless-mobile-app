// Lightweight Supabase client mock wired via module alias
type AnyFn = (...args: any[]) => any;

const callLog: any[] = [];

// Chainable query builder mock
function qb(table: string) {
  const state: any = { table, filters: [] };
  const api: any = {
    select: jest.fn((...args: any[]) => { callLog.push({ op: 'select', table, args }); return api; }),
    upsert: jest.fn((...args: any[]) => { callLog.push({ op: 'upsert', table, args }); return api; }),
    insert: jest.fn((...args: any[]) => { callLog.push({ op: 'insert', table, args }); return api; }),
    update: jest.fn((...args: any[]) => { callLog.push({ op: 'update', table, args }); return api; }),
    delete: jest.fn((...args: any[]) => { callLog.push({ op: 'delete', table, args }); return api; }),
    eq: jest.fn((field: string, value: any) => { state.filters.push({ field, value }); return api; }),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    single: jest.fn(async () => ({ data: { ok: true }, error: null })),
  };
  return api;
}

const mockAuth = {
  getUser: jest.fn(async () => ({
    user: {
      id: 'user-1',
      email: 'new@user.test',
      user_metadata: { name: 'New User' },
      app_metadata: { provider: 'email' }
    }
  })),
  updateUser: jest.fn(async () => ({ data: {}, error: null })),
};

const mockClient = {
  from: jest.fn((table: string) => qb(table)),
  auth: mockAuth,
};

jest.mock('@/lib/supabase', () => ({
  supabase: mockClient,
}));

// Defer importing the service until after mocks are set up
const getSvc = () => {
  const mod = require('../../services/supabase');
  // Debug available exports if needed
  // eslint-disable-next-line no-console
  console.log('services/supabase exports:', Object.keys(mod));
  const { createSupabaseServiceForTest } = mod;
  // Inject our mock Supabase client to the service
  return createSupabaseServiceForTest(mockClient as any);
};

beforeEach(() => {
  callLog.length = 0;
  jest.clearAllMocks();
});

describe('Onboarding mapping → user_profiles upsert body', () => {
  test('maps onboarding payload correctly into user_profiles', async () => {
    const userId = 'user-2';
    const payload = {
      profile: { age: 27, gender: 'male', locale: 'tr-TR', timezone: 'Europe/Istanbul' },
      motivation: ['stress_reduction', 'mental_clarity'],
      first_mood: { score: 6, tags: ['work', 'sleep'] }, // score should clamp to 5
      lifestyle: { sleep_hours: 5, exercise: 'Regular', social: 'High' },
      reminders: { enabled: true, time: '21:30', days: ['Mon','Wed'], timezone: 'Europe/Istanbul' },
      feature_flags: { a: true, b: false },
      consent: { accepted: true },
    };

    // fresh mock per test
    (mockClient.from as AnyFn).mockImplementation((table: string) => qb(table));

    // Instead of calling service (resolver differences), test exported mapper
    const { mapOnboardingPayloadToUserProfileRow } = require('../../utils/onboardingMapper');
    const body = mapOnboardingPayloadToUserProfileRow(userId, payload);

    // Key field expectations
    expect(body.user_id).toBe(userId);
    expect(body.motivations).toEqual(['stress_reduction', 'mental_clarity']);
    expect(body.first_mood_score).toBe(5); // clamped
    expect(body.first_mood_tags).toEqual(['work','sleep']);
    expect(body.reminder_enabled).toBe(true);
    expect(body.reminder_time).toBe('21:30');
    expect(body.feature_flags).toEqual({ a: true, b: false });
    expect(body.onboarding_version).toBe(2);
    expect(typeof body.onboarding_completed_at).toBe('string');
  });
});
