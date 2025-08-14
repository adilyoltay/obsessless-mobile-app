import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
      setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { store.delete(key); }),
      clear: jest.fn(async () => { store.clear(); }),
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
    }
  };
});

describe('sync conflicts log', () => {
  it('can write and read sync_conflicts', async () => {
    await AsyncStorage.setItem('sync_conflicts', JSON.stringify([{ entity: 'compulsion', count: 1, at: new Date().toISOString(), conflicts: [] }]));
    const raw = await AsyncStorage.getItem('sync_conflicts');
    expect(raw).toBeTruthy();
  });
});


