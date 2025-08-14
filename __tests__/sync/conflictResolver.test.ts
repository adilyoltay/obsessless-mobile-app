import AsyncStorage from '@react-native-async-storage/async-storage';
import { conflictResolver } from '@/services/conflictResolver';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }
}));

describe('conflictResolver', () => {
  it('list returns [] when empty', async () => {
    // @ts-ignore
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const res = await conflictResolver.list();
    expect(Array.isArray(res)).toBe(true);
  });
});


