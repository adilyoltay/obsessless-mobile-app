import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedConflictResolver } from '@/services/unifiedConflictResolver';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }
}));

describe('unifiedConflictResolver', () => {
  it('list returns [] when empty', async () => {
    // @ts-ignore
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const res = await unifiedConflictResolver.list();
    expect(Array.isArray(res)).toBe(true);
  });
});


