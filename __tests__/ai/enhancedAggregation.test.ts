import AsyncStorage from '@react-native-async-storage/async-storage';
// Use CJS require to avoid ESM dynamic import issues in Jest
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { enhancedAIDataAggregator } = require('@/features/ai/pipeline/enhancedDataAggregation');

// Mock secure storage hook to avoid invoking native crypto in tests
jest.mock('@/hooks/useSecureStorage', () => ({
  useSecureStorage: () => ({
    getItem: async () => null,
    setItem: async () => undefined,
  }),
}));

// Mock supabase service minimal API used by aggregator
jest.mock('@/services/supabase', () => ({
  __esModule: true,
  default: {
    client: {},
  },
  getCompulsions: jest.fn(async (_userId: string) => [
    { id: 'c1', category: 'contamination', timestamp: new Date().toISOString(), resistance_level: 4 },
    { id: 'c2', category: 'checking', timestamp: new Date().toISOString(), resistance_level: 5 },
  ]),
  getTherapySessions: jest.fn(async (_userId: string) => [
    { id: 'e1', timestamp: new Date().toISOString(), completed: true, anxiety_initial: 6, anxiety_final: 3 },
  ]),
}));

describe('Enhanced AI Data Aggregation', () => {
  const userId = 'test-user';

  beforeEach(async () => {
    await AsyncStorage.clear();
    // Seed plain profile fallback
    await AsyncStorage.setItem(`ai_user_profile_${userId}`, JSON.stringify({ demographics: { age: 28 } }));
    // Seed a mood entry for today
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(
      `mood_entries_${userId}_${today}`,
      JSON.stringify([
        {
          id: 'm1',
          user_id: userId,
          mood_score: 6,
          energy_level: 5,
          anxiety_level: 4,
          timestamp: new Date().toISOString(),
          synced: true,
        },
      ])
    );
  });

  it('aggregates comprehensive data with expected shape and fields', async () => {
    const agg = await enhancedAIDataAggregator.aggregateComprehensiveData(userId);

    expect(agg).toBeTruthy();
    expect(agg).toHaveProperty('profile');
    expect(agg).toHaveProperty('symptoms');
    expect(agg).toHaveProperty('performance');
    expect(agg).toHaveProperty('patterns');
    expect(agg).toHaveProperty('insights');
    expect(agg).toHaveProperty('recommendations');

    // Basic sanity checks
    expect(Array.isArray(agg.symptoms.primaryCategories)).toBe(true);
    expect(typeof agg.performance.erpCompletionRate).toBe('number');
  });

  it('includes frequent compulsion categories in symptoms.primaryCategories', async () => {
    const agg = await enhancedAIDataAggregator.aggregateComprehensiveData(userId);
    expect(agg.symptoms.primaryCategories).toEqual(expect.arrayContaining(['contamination', 'checking']));
  });
});


