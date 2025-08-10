import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { useCompulsions } from '@/hooks/useCompulsions';
import InterventionCard from '@/components/InterventionCard';
import {
  evaluateContext,
  ContextEvaluation,
  InterventionCategory,
} from '@/features/ai/interventions/adaptiveInterventions';

interface Suggestion {
  title: string;
  description: string;
  instructions: string[];
  category: InterventionCategory;
}

const compulsionSuggestions: Record<string, Suggestion> = {
  washing: {
    title: 'Maruz Kalma Denemesi',
    description: 'Ellerini yıkamadan önce kısa bir bekleme süresi dene.',
    instructions: ['Derin nefes al', 'Dürtünün geçişini izle', '2 dakika bekle'],
    category: InterventionCategory.MINDFULNESS,
  },
  checking: {
    title: 'Tek Kontrol Kuralı',
    description: 'Sadece bir kez kontrol et ve uzaklaş.',
    instructions: ['Kontrol listesi hazırla', 'Bir kez kontrol et', 'Sonucu kabul et'],
    category: InterventionCategory.ROUTINE_SUPPORT,
  },
  default: {
    title: 'Farkındalık Molası',
    description: 'Kısa bir nefes egzersizi ile zihnini toparla.',
    instructions: ['4 saniye nefes al', '4 saniye tut', '4 saniye ver'],
    category: InterventionCategory.STRESS_REDUCTION,
  },
};

const fallbackSuggestion: Suggestion = {
  title: 'Nefes Egzersizi',
  description: 'Konum izni olmadan genel bir rahatlama önerisi.',
  instructions: ['4 saniye nefes al', '4 saniye tut', '4 saniye ver'],
  category: InterventionCategory.MINDFULNESS,
};

export default function CompulsionInterventions() {
  const { data: compulsions } = useCompulsions();
  const [context, setContext] = useState<ContextEvaluation | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const ctx = await evaluateContext(null, new Date());
          setContext(ctx);
          return;
        }
        const loc = await Location.getCurrentPositionAsync();
        const ctx = await evaluateContext(
          { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          new Date()
        );
        setContext(ctx);
      } catch (e) {
        const ctx = await evaluateContext(null, new Date());
        setContext(ctx);
      }
    })();
  }, []);

  const last = compulsions?.[0];
  if (!last || !context) return null;

  const suggestion = context.fallback
    ? fallbackSuggestion
    : compulsionSuggestions[last.type] || compulsionSuggestions.default;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 16 }}>
      <InterventionCard
        title={suggestion.title}
        description={suggestion.description}
        instructions={suggestion.instructions}
      />
    </View>
  );
}

