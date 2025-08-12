import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';
import { simpleNLU, trackCheckinLifecycle, trackRouteSuggested, NLUResult, decideRoute } from '@/features/ai/services/checkinService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { router } from 'expo-router';
import { generateReframes } from '@/features/ai/services/reframeService';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { saveUserData, loadUserData, StorageKeys } from '@/utils/storage';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

 type CheckinPersist = { id: string; text: string; nlu: NLUResult; createdAt: string };

function SuggestionCard({ nlu, onSelect, lowConfidence }: { nlu: NLUResult; onSelect: (route: 'ERP'|'REFRAME') => void; lowConfidence?: boolean; }) {
  const route = decideRoute(nlu);
  const title = route === 'ERP' ? (nlu.trigger === 'temizlik' ? 'ERP: Temizlik Tetkik' : 'ERP: Kontrol') : 'Bilişsel Çerçeveleme';
  const description = route === 'ERP'
    ? (nlu.trigger === 'temizlik' ? 'Kademeli maruz bırakma ile rahatlamayı erteleme pratiği' : 'Kontrol davranışını azaltma ve belirsizliğe tolerans')
    : 'Düşünceyi yeniden çerçeveleme ile hızlı rahatlama önerisi';
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

  useEffect(() => {
    if (nlu) {
      const route = decideRoute(nlu);
      const eventType: AIEventType = (AIEventType as any).SUGGESTION_SHOWN ?? AIEventType.ROUTE_SUGGESTED;
      trackAIInteraction(eventType, { feature: 'route_card', route, mood: nlu.mood, trigger: nlu.trigger }).catch(() => {});
    }
  }, [nlu]);

  const persistCheckin = async (text: string, n: NLUResult) => {
    if (!user?.id) return;
    const item: CheckinPersist = { id: `chk_${Date.now()}`, text, nlu: n, createdAt: new Date().toISOString() };
    try {
      const key = StorageKeys.CHECKINS(user.id);
      const prev = (await loadUserData<CheckinPersist[]>(key)) || [];
      const next = [...prev, item].slice(-50);
      await saveUserData(key, next);
      // Supabase sync (best-effort, privacy-first)
      try {
        const { supabaseService } = await import('@/services/supabase');
        const { sanitizePII } = await import('@/utils/privacy');
        await supabaseService.saveVoiceCheckin({
          user_id: user.id,
          text: sanitizePII(text),
          mood: n.mood,
          trigger: n.trigger,
          confidence: n.confidence,
          lang: n.lang,
        });
      } catch {}
    } catch { /* ignore */ }
  };

  const handleTranscription = async (res: { text: string; confidence: number; language: string; duration: number; }) => {
    setTranscript(res.text);
    const durationSec = Math.round((res.duration || 0) / 1000);
    if (durationSec < 5) {
      setTooShort(true);
      await trackCheckinLifecycle('stt_failed', { reason: 'too_short', durationSec });
      return;
    }
    const n = simpleNLU(res.text);
    setNlu(n);
    if ((res.confidence ?? 0) < 0.6) setLowConfidence(true);
    await persistCheckin(res.text, n);
  };

  const handleSelect = async (route: 'ERP'|'REFRAME') => {
    await trackRouteSuggested(route, { mood: nlu?.mood, trigger: nlu?.trigger, confidence: nlu?.confidence });
    if (route === 'ERP') {
      try {
        const { erpRecommendationService } = await import('@/features/ai/services/erpRecommendationService');
        if (user?.id) {
          const rec = await erpRecommendationService.getPersonalizedRecommendations(user.id);
          const first = rec?.recommendedExercises?.[0]?.exerciseId;
          await trackCheckinLifecycle('complete', { route: 'ERP', mood: nlu?.mood, trigger: nlu?.trigger, recommended: !!first });
          if (first) {
            router.push(`/erp-session?exerciseId=${encodeURIComponent(first)}`);
            return;
          }
        }
        const fallbackExercise = 'exposure_response_prevention';
        router.push(`/erp-session?exerciseId=${fallbackExercise}`);
      } catch {
        await trackCheckinLifecycle('complete', { route: 'ERP', mood: nlu?.mood, trigger: nlu?.trigger, error: 'recommendation_failed' });
        router.push('/erp-session?exerciseId=exposure_response_prevention');
      }
    } else {
      const suggestions = await generateReframes({ text: transcript, lang: (nlu?.lang || 'tr') as any });
      setReframes(suggestions.map(s => s.text));
      setShowReframe(true);
      await trackCheckinLifecycle('complete', { route: 'REFRAME', mood: nlu?.mood, trigger: nlu?.trigger, suggestions: suggestions.length });
    }
  };

  if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sesli Check-in</Text>
      <VoiceInterface 
        onTranscription={handleTranscription as any} 
        onError={async () => { await trackCheckinLifecycle('stt_failed', { reason: 'interface_error' }); }}
        onStartListening={async () => { await trackCheckinLifecycle('start', { source: 'ui' }); }}
      />
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


