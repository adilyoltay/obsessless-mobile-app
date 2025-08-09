import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineSyncService } from '../offlineSync';
import { apiService } from '../api';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
  },
}));

jest.mock('../api', () => ({
  apiService: {
    compulsions: { update: jest.fn(), create: jest.fn(), delete: jest.fn() },
    erp: { createExercise: jest.fn(), completeSession: jest.fn() },
    user: { updateProfile: jest.fn() },
  },
}));

const resetStore = () => {
  for (const key in store) delete store[key];
};

const service = OfflineSyncService.getInstance();
(service as any).isOnline = true;

beforeEach(() => {
  resetStore();
  (service as any).syncQueue = [];
  jest.clearAllMocks();
});

describe('OfflineSyncService', () => {
  test('retains item on conflict error', async () => {
    (apiService.compulsions.update as jest.Mock).mockRejectedValue({ response: { status: 409 } });

    (service as any).syncQueue = [{
      id: '1',
      type: 'UPDATE',
      entity: 'compulsion',
      data: { id: '1' },
      timestamp: Date.now(),
      retryCount: 0,
    }];

    await service.processSyncQueue();

    expect((service as any).syncQueue).toHaveLength(1);
    expect((service as any).syncQueue[0].retryCount).toBe(1);
  });

  test('stores item after RLS violation', async () => {
    (apiService.user.updateProfile as jest.Mock).mockRejectedValue({ response: { status: 403 } });

    (service as any).syncQueue = [{
      id: '2',
      type: 'UPDATE',
      entity: 'user_progress',
      data: {},
      timestamp: Date.now(),
      retryCount: 2,
    }];

    await service.processSyncQueue();

    expect((service as any).syncQueue).toHaveLength(0);
    const failed = JSON.parse((await AsyncStorage.getItem('failedSyncItems')) || '[]');
    expect(failed).toHaveLength(1);
  });
});
