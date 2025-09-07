import { isUnsyncedLocalItem } from '@/utils/crossDeviceFilter';

describe('cross-device unsynced filter', () => {
  test('pendingSync forces upload', () => {
    expect(isUnsyncedLocalItem({ id: 'x', pendingSync: true })).toBe(true);
  });
  test('synced items are skipped', () => {
    expect(isUnsyncedLocalItem({ synced: true })).toBe(false);
  });
  test('items with id are treated as synced unless pendingSync', () => {
    expect(isUnsyncedLocalItem({ id: 'remote-id' })).toBe(false);
  });
  test('plain new local items (no id, not synced) are uploaded', () => {
    expect(isUnsyncedLocalItem({ notes: 'hi' })).toBe(true);
  });
});

