import { externalAIService } from '@/features/ai/services/externalAIService';

describe('externalAIService heuristic fallback', () => {
  it('returns fallback when service disabled', async () => {
    // @ts-ignore - force disabled state
    (externalAIService as any).isEnabled = false;
    const res = await externalAIService.getAIResponse([
      { id: '1', role: 'user', content: 'Merhaba', timestamp: new Date() }
    ] as any, {} as any);
    expect(res.provider).toBe('local');
    expect(res.fallbackUsed).toBeTruthy();
    expect(typeof res.content).toBe('string');
  });
});


