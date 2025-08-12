import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';
import { simpleNLU, decideRoute, trackCheckinLifecycle, trackRouteSuggested, NLUResult } from '@/features/ai/services/checkinService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { router } from 'expo-router';
import { generateReframes } from '@/features/ai/services/reframeService';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/SupabaseAuthContext';

type SuggestionCardProps = {
  nlu: NLUResult;
  onSelect: (route: 'ERP'|'REFRAME') => void;
  lowConfidence?: boolean;
};

function SuggestionCard({ nlu, onSelect, lowConfidence }: SuggestionCardProps) {
  const title = nlu.trigger === 'temizlik' ? 'ERP: Temizlik Tetkik' : nlu.trigger === 'kontrol' ? 'ERP: Kontrol' : 'Bilişsel Çerçeveleme';
  const description = nlu.trigger === 'temizlik'
    ? 'Kademeli maruz bırakma ile rahatlamayı erteleme pratiği'
    : nlu.trigger === 'kontrol'
      ? 'Kontrol davranışını azaltma ve belirsizliğe tolerans'
      : 'Düşünceyi yeniden çerçeveleme ile hızlı rahatlama önerisi';
  const route = nlu.mood <= 50 || ['temizlik','kontrol'].includes(nlu.trigger) ? 'ERP' : 'REFRAME';
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{title} {lowConfidence && <Text style={styles.badge}>Düşük Güven</Text>}</Text>
      <Text style={styles.cardText}>{description}</Text>
      <View style={styles.actions}>
        <Button title="Devam Et" onPress={() => onSelect(route)} />
      </View>
    </Card>
  );
}

export default function VoiceMoodCheckin() {
  const { user } = useAuth();
  const [transcript, setTranscript] = useState<string>('');
  const [nlu, setNlu] = useState<NLUResult | null>(null);
  const [tooShort, setTooShort] = useState<boolean>(false);
  const [lowConfidence, setLowConfidence] = useState<boolean>(false);
  const [showReframe, setShowReframe] = useState<boolean>(false);
  const [reframes, setReframes] = useState<string[]>([]);

  const handleTranscription = async (res: { text: string; confidence: number; language: string; duration: number; }) => {
    setTranscript(res.text);
    const durationSec = Math.round((res.duration || 0) / 1000);
    if (durationSec < 5) {
      setTooShort(true);
      await trackCheckinLifecycle('stt_failed', { reason: 'too_short', durationSec });
      return;
    }
    if (durationSec > 90) {
      // Uzun monolog: biz yine NLU yapalım ama UI’ı sade tutalım
    }
    await trackCheckinLifecycle('start', { durationSec, sttConfidence: res.confidence });
    const n = simpleNLU(res.text);
    setNlu(n);
    if ((res.confidence ?? 0) < 0.6) setLowConfidence(true);
  };

  const handleSelect = async (route: 'ERP'|'REFRAME') => {
    await trackRouteSuggested(route, { mood: nlu?.mood, trigger: nlu?.trigger, confidence: nlu?.confidence });
    if (route === 'ERP') {
      // Kişiselleştirilmiş egzersiz: erpRecommendationService ile almayı dene
      try {
        const { erpRecommendationService } = await import('@/features/ai/services/erpRecommendationService');
        if (user?.id) {
          const rec = await erpRecommendationService.getPersonalizedRecommendations(user.id);
          const first = rec?.recommendedExercises?.[0]?.exerciseId;
          if (first) {
            router.push(`/erp-session?exerciseId=${encodeURIComponent(first)}`);
            return;
          }
        }
        // Fallback: tematik id seçimi
        const fallbackExercise = 'exposure_response_prevention';
        router.push(`/erp-session?exerciseId=${fallbackExercise}`);
      } catch {
        router.push('/erp-session?exerciseId=exposure_response_prevention');
      }
    } else {
      const suggestions = await generateReframes({ text: transcript, lang: (nlu?.lang || 'tr') as any });
      setReframes(suggestions.map(s => s.text));
      setShowReframe(true);
    }
  };

  if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sesli Check-in</Text>
      <VoiceInterface onTranscription={handleTranscription as any} />
      {tooShort && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Yetersiz Veri</Text>
          <Text style={styles.cardText}>Kısa bir kayıt oldu. İstersen yazıyla paylaşabilirsin.</Text>
        </Card>
      )}
      {nlu && (
        <SuggestionCard nlu={nlu} onSelect={handleSelect} lowConfidence={lowConfidence} />
      )}

      {/* Reframe Modal */}
      <Modal visible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.modalTitle}>Yeni Bakış Açıları</Text>
        {reframes.map((r, i) => (
          <Text key={i} style={styles.modalItem}>• {r}</Text>
        ))}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  card: { marginTop: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  badge: { fontSize: 12, color: '#6B7280' },
  cardText: { marginTop: 6, color: '#4B5563' },
  actions: { marginTop: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalItem: { fontSize: 14, color: '#374151', marginBottom: 6 },
});


