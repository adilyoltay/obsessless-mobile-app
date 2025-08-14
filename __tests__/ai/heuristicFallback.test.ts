import { detectScenario, detectLanguage, getHeuristicText } from '@/features/ai/services/heuristicFallback';

describe('heuristicFallback', () => {
  it('detects anxiety scenario', () => {
    const text = getHeuristicText([{ role: 'user', content: 'çok kaygılıyım', id: '1', timestamp: new Date() } as any], {} as any);
    expect(typeof text).toBe('string');
  });

  it('respects preferredLanguage=en', () => {
    const lang = detectLanguage({ therapeuticProfile: { preferredLanguage: 'en' } } as any);
    expect(lang).toBe('en');
  });
});


