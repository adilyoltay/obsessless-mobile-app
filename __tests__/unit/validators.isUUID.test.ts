import { isUUID } from '@/utils/validators';

describe('isUUID', () => {
  it('accepts valid UUIDs (generic versions)', () => {
    expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects non-UUIDs and local IDs', () => {
    expect(isUUID('local_123')).toBe(false);
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('123e4567-e89b-12d3-a456-42661417400Z')).toBe(false);
    expect(isUUID('')).toBe(false);
    // @ts-expect-error ensure type guard handles undefined
    expect(isUUID(undefined)).toBe(false);
  });
});


