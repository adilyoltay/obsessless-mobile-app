import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGamificationStore } from '@/store/gamificationStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Gamification streak calculations', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-09-07T10:00:00.000Z'));
    // reset store
    const init = useGamificationStore.getState();
    useGamificationStore.setState({ ...init, profile: {
      streakCurrent: 0,
      streakBest: 0,
      unlockedAchievements: [],
      healingPointsToday: 0,
      healingPointsTotal: 0,
      streakLevel: 'seedling',
      lastActivityDate: '2025-09-06',
      lastFirstActivityAwardDate: undefined,
      streakMilestonesAwarded: [],
      modulesActiveDate: undefined,
      modulesActiveToday: [],
      multiModuleDayAwarded: 0,
      weekKey: undefined,
      activeDaysThisWeek: 0,
      weeklyConsistencyAwarded: false,
    }, currentUserId: 'test-user' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('updateStreak increments across UTC day boundary', async () => {
    const { updateStreak, getStreakInfo } = useGamificationStore.getState();
    await updateStreak();
    const info = getStreakInfo();
    expect(info.current).toBe(1);
  });

  test('breathwork_completed also can be combined with updateStreak', async () => {
    const { awardMicroReward, updateStreak, getStreakInfo } = useGamificationStore.getState();
    await awardMicroReward('breathwork_completed', { durationMs: 600000, difficulty: 'medium' });
    await updateStreak();
    const info = getStreakInfo();
    expect(info.current).toBeGreaterThanOrEqual(1);
  });
});
