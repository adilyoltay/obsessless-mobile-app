import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';
import { simpleNLU, trackCheckinLifecycle, trackRouteSuggested, NLUResult, decideRoute } from '@/features/ai/services/checkinService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { router, useLocalSearchParams } from 'expo-router';
import { generateReframes } from '@/features/ai/services/reframeService';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { saveUserData, loadUserData, StorageKeys } from '@/utils/storage';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';

 type CheckinPersist = { id: string; text: string; nlu: NLUResult; createdAt: string };

function SuggestionCard({ nlu, onSelect, lowConfidence, cbtSuggestion }: { nlu: NLUResult; onSelect: (route: 'REFRAME') => void; lowConfidence?: boolean; cbtSuggestion?: string; }) {
  const route = decideRoute(nlu);
  const title = 'Bilişsel Çerçeveleme';
  const description = 'Düşünceyi yeniden çerçeveleme ile hızlı rahatlama önerisi';
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{title} {lowConfidence && <Text style={styles.badge}>Düşük Güven</Text>}</Text>
      <Text style={styles.cardText}>{description}</Text>
      {cbtSuggestion && (
        <View style={styles.cbtSuggestionContainer}>
          <Text style={styles.cbtSuggestionIcon}>💭</Text>
          <Text style={styles.cbtSuggestionText}>{cbtSuggestion}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button title="Devam Et" onPress={() => onSelect(route)} />
      </View>
    </Card>
  );
}

interface VoiceMoodCheckinProps {
  isVisible?: boolean;
  onClose?: () => void;
  onSave?: () => void;
  initialText?: string;
  mode?: 'mood' | 'cbt';
}

export default function VoiceMoodCheckin({ 
  isVisible = true, 
  onClose, 
  onSave,
  initialText,
  mode = 'mood'
}: VoiceMoodCheckinProps) {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ cbtText?: string }>();
  const [transcript, setTranscript] = useState<string>('');
  const [nlu, setNlu] = useState<NLUResult | null>(null);
  const [tooShort, setTooShort] = useState<boolean>(false);
  const [lowConfidence, setLowConfidence] = useState<boolean>(false);
  const [showReframe, setShowReframe] = useState<boolean>(false);
  // CBT flow removed
  const [cbtAutoStarted, setCbtAutoStarted] = useState<boolean>(false);
  const [reframes, setReframes] = useState<string[]>([]);

  useEffect(() => {
    if (nlu) {
      const route = decideRoute(nlu);
      // Use SUGGESTION_SHOWN when available; else log ROUTE_SUGGESTED only once
      trackAIInteraction(AIEventType.SUGGESTION_SHOWN, { feature: 'route_card', route, mood: nlu.mood, trigger: nlu.trigger })
        .catch(() => trackAIInteraction(AIEventType.ROUTE_SUGGESTED, { feature: 'route_card', route, mood: nlu.mood, trigger: nlu.trigger }));
    }
  }, [nlu]);

  // Auto-trigger CBT flow if cbtText parameter or initialText is provided
  useEffect(() => {
    const textToProcess = params.cbtText || initialText;
    if (textToProcess && !cbtAutoStarted) {
      console.log('🎯 Auto-triggering CBT from parameter:', textToProcess);
      setCbtAutoStarted(true);
      // CBT modunda doğrudan CBT akışını başlat
      if (mode === 'cbt') {
        setShowCBTFlow(true);
        setCbtStep('distortions');
      }
      handleTranscription({
        text: textToProcess,
        confidence: 0.9,
        language: 'tr-TR',
        duration: 3000,
        timestamp: new Date(),
        alternatives: []
      });
    }
  }, [params.cbtText, initialText, mode, cbtAutoStarted]);

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
        // Mikro ödül: voice mood check-in
        try {
          const { useGamificationStore } = await import('@/store/gamificationStore');
          useGamificationStore.getState().awardMicroReward('voice_mood_checkin');
        } catch {}
      } catch (dbErr) {
        // Supabase başarısız: offline kuyruk
        try {
          const { offlineSyncService } = await import('@/services/offlineSync');
          await offlineSyncService.addToSyncQueue({
            type: 'CREATE',
            entity: 'voice_checkin',
            data: {
              id: item.id,
              user_id: user.id,
              text,
              mood: n.mood,
              trigger: n.trigger,
              confidence: n.confidence,
              lang: n.lang,
              timestamp: item.createdAt,
              kind: 'voice_checkin',
            },
          });
          // Mikro ödül yine de verilsin (offline durumda da teşvik)
          try {
            const { useGamificationStore } = await import('@/store/gamificationStore');
            useGamificationStore.getState().awardMicroReward('voice_mood_checkin');
          } catch {}
        } catch {}
      }
    } catch { /* ignore */ }
  };

  const handleTranscription = async (res: { text: string; confidence: number; language: string; duration: number; timestamp?: Date; alternatives?: string[]; }) => {
    console.log('🎯 handleTranscription ÇAĞRILDI!', res);
    setTranscript(res.text);
    const durationSec = Math.round((res.duration || 0) / 1000);
    console.log('⏱️ Duration check:', { duration: res.duration, durationSec, text: res.text });
    if (durationSec < 2 && res.text.length < 10) { // Daha esnek kontrol
      setTooShort(true);
      await trackCheckinLifecycle('stt_failed', { reason: 'too_short', durationSec });
      return;
    }
    const n = simpleNLU(res.text);
    setNlu(n);
    if ((res.confidence ?? 0) < 0.6) setLowConfidence(true);
    
    // Console output for verification
    try {
      const decided = decideRoute(n);
      console.log('🎤 Voice Check-in Transcribed:', {
        text: res.text,
        confidence: res.confidence,
        language: res.language,
        durationSec,
      });
      console.log('🧠 NLU Analysis:', {
        mood: n.mood,
        trigger: n.trigger,
        confidence: n.confidence,
        route: decided,
      });
    } catch {}
    
    // CBT analizi kaldırıldı
    
    await persistCheckin(res.text, n);
  };

  // Eğer route paramları ile bir CBT metni geldiyse otomatik başlat
  useEffect(() => {
    const incoming = typeof params.cbtText === 'string' ? params.cbtText.trim() : '';
    if (!cbtAutoStarted && incoming.length > 0) {
      setCbtAutoStarted(true);
      handleTranscription({
        text: incoming,
        confidence: 0.9,
        language: 'tr-TR',
        duration: 5000
      } as any);
    }
  }, [params.cbtText, cbtAutoStarted]);

  // CBT kayıt akışı kaldırıldı

  const handleSelect = async (route: 'REFRAME') => {
    await trackRouteSuggested(route, { mood: nlu?.mood, trigger: nlu?.trigger, confidence: nlu?.confidence });
    {
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
        onTranscription={handleTranscription} 
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

      {/* Reframe Bottom Sheet */}
      <BottomSheet isVisible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.sheetTitle}>Yeni Bakış Açıları</Text>
        {reframes.map((r, i) => (
          <Text key={i} style={styles.sheetItem}>• {r}</Text>
        ))}
      </BottomSheet>

      {/* CBT Flow removed */}
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
  cbtSuggestionContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cbtSuggestionIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  cbtSuggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  sheetItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
    gap: 12,
    paddingHorizontal: 4,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
  },
  cbtThought: {
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  distortionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  chipSelected: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  chipTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});


