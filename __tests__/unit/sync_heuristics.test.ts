import { determineConcurrency } from '@/utils/syncHeuristics';

describe('sync heuristics - determineConcurrency', () => {
  test('defaults to 2', () => {
    expect(determineConcurrency(80, 800, 5)).toBe(2);
  });
  test('upscales to 3 on good metrics and some queue', () => {
    expect(determineConcurrency(92, 350, 20)).toBe(3);
  });
  test('upscales to 4 on excellent metrics and large queue', () => {
    expect(determineConcurrency(97, 250, 150)).toBe(4);
  });
  test('downscales to 1 on poor metrics', () => {
    expect(determineConcurrency(55, 1300, 50)).toBe(1);
  });
  test('caps within 1..4', () => {
    expect(determineConcurrency(999, -10, 10000)).toBe(4);
    expect(determineConcurrency(-10, 99999, 0)).toBe(1);
  });
});

