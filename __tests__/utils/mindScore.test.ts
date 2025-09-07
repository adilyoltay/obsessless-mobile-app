import { to0100, weightedScore } from '@/utils/mindScore';

describe('mindScore utils', () => {
  it('to0100 scales 1–10 to 0–100 and clamps', () => {
    expect(to0100(7)).toBe(70);
    expect(to0100(0)).toBe(0);
    expect(to0100(120)).toBe(100);
    expect(to0100(null as any)).toBeNull();
  });

  it('weightedScore excludes anxiety when fallback=5 (50 after scaling)', () => {
    // mood=60, energy=7(70), anxiety=5(fallback)
    // Without anxiety: (60*0.5 + 70*0.3) / (0.8) = 63.75 → clamp
    const score = weightedScore(60, 7, 5);
    expect(score!).toBeCloseTo(63.75, 2);
  });

  it('weightedScore includes anxiety when not neutral center', () => {
    // mood=60, energy=7(70), anxiety=3(30) => inverse 70
    // (60*0.5 + 70*0.3 + 70*0.2) / 1.0 = 63
    const score = weightedScore(60, 7, 3);
    expect(score!).toBeCloseTo(63, 2);
  });
});

