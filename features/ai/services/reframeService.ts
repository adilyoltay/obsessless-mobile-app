import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { externalAIService } from '@/features/ai/services/externalAIService';

export type ReframeSuggestion = { id: string; text: string };

const clamp140 = (s: string) => (s.length > 140 ? s.slice(0, 137) + '...' : s);

function fallbackReframes(text: string, lang: 'tr'|'en'): ReframeSuggestion[] {
  const baseTR = [
    'Bu düşünce bir olasılık, bir gerçek değil. Bugün küçük bir adım atabilirim.',
    'Belirsizlik hayatın parçası. Mükemmel olmak zorunda değilim.',
    'Ne hissedersem hissedeyim, nazikçe kendime alan açabilirim.',
  ];
  const baseEN = [
    'This thought is a possibility, not a fact. I can take a small step today.',
    'Uncertainty is part of life. I don’t have to be perfect.',
    'Whatever I feel, I can give myself gentle space.',
  ];
  const arr = lang === 'tr' ? baseTR : baseEN;
  return arr.map((t, i) => ({ id: `fb_${i}`, text: clamp140(t) }));
}

export async function generateReframes(input: { text: string; lang: 'tr'|'en' }): Promise<ReframeSuggestion[]> {
  await trackAIInteraction(AIEventType.SUGGESTION_SHOWN, { feature: 'reframe', lang: input.lang });

  if (!FEATURE_FLAGS.isEnabled('LLM_REFRAME') || !FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API')) {
    return fallbackReframes(input.text, input.lang);
  }

  try {
    const promptTR = `Kullanıcı metni: "${input.text}"
Lütfen 2-3 adet, en fazla 140 karakterlik, yargılamayan ve şefkatli bilişsel yeniden çerçeveleme önerisi üret. Sadece madde madde kısa öneriler ver.`;
    const promptEN = `User text: "${input.text}"
Please generate 2-3 short, compassionate cognitive reframe suggestions (max 140 chars each). Return only bullet items.`;

    const response = await externalAIService.getAIResponse(
      [
        { id: 'sys', role: 'system', content: input.lang === 'tr' ? 'Şefkatli terapötik asistan.' : 'Compassionate therapeutic assistant.', timestamp: new Date() },
        { id: 'u1', role: 'user', content: input.lang === 'tr' ? promptTR : promptEN, timestamp: new Date() },
      ] as any,
      {
        context: {
          userId: 'reframe',
          sessionId: `reframe_${Date.now()}`,
          conversationHistory: [],
          userProfile: {} as any,
          currentState: 'therapeutic' as any,
          startTime: new Date(),
          lastActivity: new Date(),
          messageCount: 1,
          topicHistory: [],
          therapeuticGoals: [],
          sessionObjectives: [],
          progressNotes: [],
        },
      } as any
    );

    const content = (response.content || '').trim();
    const lines = content
      .split(/\n|\r/g)
      .map(l => l.replace(/^[-•\*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((t, i) => ({ id: `llm_${i}`, text: clamp140(t) }));
    if (lines.length === 0) return fallbackReframes(input.text, input.lang);
    return lines;
  } catch (e) {
    return fallbackReframes(input.text, input.lang);
  }
}


