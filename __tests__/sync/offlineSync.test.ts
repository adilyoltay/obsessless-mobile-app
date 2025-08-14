import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }
}));

describe('sync conflicts log', () => {
  it('can write and read sync_conflicts', async () => {
    await AsyncStorage.setItem('sync_conflicts', JSON.stringify([{ entity: 'compulsion', count: 1, at: new Date().toISOString(), conflicts: [] }]));
    const raw = await AsyncStorage.getItem('sync_conflicts');
    expect(raw).toBeTruthy();
  });
});


