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

 type CheckinPersist = { id: string; text: string; nlu: NLUResult; createdAt: string };

function SuggestionCard({ nlu, onSelect, lowConfidence, cbtSuggestion }: { nlu: NLUResult; onSelect: (route: 'ERP'|'REFRAME') => void; lowConfidence?: boolean; cbtSuggestion?: string; }) {
  const route = decideRoute(nlu);
  const title = route === 'ERP' ? (nlu.trigger === 'temizlik' ? 'ERP: Temizlik Tetkik' : 'ERP: Kontrol') : 'Bilişsel Çerçeveleme';
  const description = route === 'ERP'
    ? (nlu.trigger === 'temizlik' ? 'Kademeli maruz bırakma ile rahatlamayı erteleme pratiği' : 'Kontrol davranışını azaltma ve belirsizliğe tolerans')
    : 'Düşünceyi yeniden çerçeveleme ile hızlı rahatlama önerisi';
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
  const [showCBTFlow, setShowCBTFlow] = useState<boolean>(false);
  const [cbtStep, setCbtStep] = useState<'distortions' | 'evidence' | 'reframe'>('distortions');
  const [detectedDistortions, setDetectedDistortions] = useState<string[]>([]);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [evidenceFor, setEvidenceFor] = useState<string>('');
  const [evidenceAgainst, setEvidenceAgainst] = useState<string>('');
  const [cbtSuggestion, setCbtSuggestion] = useState<string>('');
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
    
    // Otomatik bilişsel çarpıtma tespiti
    console.log('🔍 CBT analizi başlatılıyor...', res.text);
    try {
      const { cbtEngine } = await import('@/features/ai/engines/cbtEngine');
      console.log('✅ CBT Engine yüklendi');
      
      const mockMessage = { 
        content: res.text, 
        role: 'user' as const,
        timestamp: new Date().toISOString(),
        id: `msg_${Date.now()}`
      };
      const mockContext = {
        conversationId: `conv_${Date.now()}`,
        userId: user?.id || 'anonymous',
        sessionStartTime: new Date().toISOString(),
        messages: [mockMessage],
        currentPhase: 'assessment' as const
      };
      
      console.log('📝 CBT parametreleri hazırlandı:', { message: mockMessage.content, userId: mockContext.userId });
      
      const assessment = await cbtEngine.detectCognitiveDistortions(mockMessage, mockContext);
      console.log('🧠 CBT Çarpıtma Analizi SONUCU:', assessment);
      
      if (assessment && assessment.detectedDistortions && assessment.detectedDistortions.length > 0) {
        console.log('🎯 Çarpıtmalar tespit edildi:', assessment.detectedDistortions);
        const distortionNames = assessment.detectedDistortions.map(d => {
          switch(d.type) {
            case 'CATASTROPHIZING': return 'Felaketleştirme';
            case 'ALL_OR_NOTHING': return 'Ya Hep Ya Hiç';
            case 'OVERGENERALIZATION': return 'Aşırı Genelleme';
            case 'MIND_READING': return 'Zihin Okuma';
            case 'LABELING': return 'Etiketleme';
            case 'FORTUNE_TELLING': return 'Falcılık';
            default: return d.type;
          }
        });
        setDetectedDistortions(distortionNames);
        // Çarpıtma varsa CBT akışını otomatik başlat
        setShowCBTFlow(true);
        setCbtStep('distortions');
        console.log('✅ CBT akışı başlatıldı, tespit edilen çarpıtmalar:', distortionNames);
      } else {
        console.log('❌ Hiç çarpıtma tespit edilmedi');
        // Heuristik fallback: felaketleştirme benzeri ifadeler için CBT'yi yine de başlat
        const lower = (res.text || '').toLowerCase();
        const looksCatastrophizing = /(ya\s|eğer\s|kesin|mutlaka|asla|olmazsa|hırsız|mahvolurum|felaket)/.test(lower);
        if (looksCatastrophizing && lower.length > 8) {
          setDetectedDistortions(['Felaketleştirme']);
          setSelectedDistortions(['Felaketleştirme']);
          setShowCBTFlow(true);
          setCbtStep('distortions');
          console.log('✅ Heuristik nedeniyle CBT akışı başlatıldı (Felaketleştirme)');
        }
      }
    } catch (cbtError) {
      console.log('❌ CBT analizi başarısız:', cbtError);
    }
    
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

  const saveCBTRecord = async () => {
    if (!user?.id) return;
    
    try {
      const moodBefore = Math.round((nlu?.mood || 50) / 10);
      const moodAfter = Math.min(moodBefore + 2, 10); // Simüle edilmiş iyileşme (max 10)
      
      const record = {
        user_id: user.id,
        thought: transcript,
        distortions: selectedDistortions,
        evidence_for: evidenceFor,
        evidence_against: evidenceAgainst,
        reframe: reframes[0] || '',
        mood_before: moodBefore,
        mood_after: moodAfter,
        trigger: nlu?.trigger,
        notes: ''
      };
      
      // Save to Supabase first
      try {
        const supabaseService = (await import('@/services/supabase')).default;
        const result = await supabaseService.saveCBTRecord(record);
        console.log('✅ CBT record saved to Supabase:', result?.id);
      } catch (error) {
        console.warn('⚠️ Supabase save failed, using local storage:', error);
      }
      
      // Also save to local storage for offline access
      const localRecord = {
        id: `cbt_${Date.now()}`,
        ...record,
        created_at: new Date().toISOString(),
        timestamp: new Date() // For backward compatibility
      };
      
      const key = StorageKeys.THOUGHT_RECORDS?.(user.id) || `thought_records_${user.id}`;
      const existing = await loadUserData<any[]>(key) || [];
      await saveUserData(key, [...existing, localRecord]);
      
      // Gamification
      try {
        const { useGamificationStore } = await import('@/store/gamificationStore');
        const { awardMicroReward } = useGamificationStore.getState();
        await awardMicroReward('cbt_completed', 15);
      } catch {}
      
      // Callback
      if (onSave) {
        onSave();
      }
      
      // Reset
      setShowCBTFlow(false);
      setCbtStep('distortions');
      setSelectedDistortions([]);
      setEvidenceFor('');
      setEvidenceAgainst('');
    } catch (error) {
      console.error('CBT kaydetme hatası:', error);
    }
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
        <SuggestionCard nlu={nlu} onSelect={handleSelect} lowConfidence={lowConfidence} cbtSuggestion={cbtSuggestion} />
      )}

      {/* Reframe Bottom Sheet */}
      <BottomSheet isVisible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.sheetTitle}>Yeni Bakış Açıları</Text>
        {reframes.map((r, i) => (
          <Text key={i} style={styles.sheetItem}>• {r}</Text>
        ))}
      </BottomSheet>

      {/* CBT Flow Bottom Sheet */}
      <BottomSheet isVisible={showCBTFlow} onClose={() => setShowCBTFlow(false)}>
        <Text style={styles.sheetTitle}>Düşünce Kaydı</Text>
        <Text style={styles.cbtThought}>{transcript}</Text>
        {cbtStep === 'distortions' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.sectionLabel}>Olası Bilişsel Çarpıtmalar</Text>
            <View style={styles.distortionChips}>
              {(detectedDistortions.length ? detectedDistortions : ['Felaketleştirme','Ya Hep Ya Hiç','Aşırı Genelleme']).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setSelectedDistortions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                  style={[styles.chip, selectedDistortions.includes(d) && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`Çarpıtma: ${d}`}
                >
                  <Text style={[styles.chipText, selectedDistortions.includes(d) && styles.chipTextSelected]}>{d}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <Button 
                title="Devam" 
                onPress={() => setCbtStep('evidence')} 
                variant="primary"
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
        {cbtStep === 'evidence' && (
          <View>
            <ScrollView style={{ maxHeight: 200 }}>
              <Text style={styles.sectionLabel}>Lehine Kanıtlar</Text>
              <TextInput
                placeholder="Bu düşünceyi destekleyen kanıtlar..."
                style={styles.input}
                multiline
                value={evidenceFor}
                onChangeText={setEvidenceFor}
              />
              <Text style={styles.sectionLabel}>Aleyhine Kanıtlar</Text>
              <TextInput
                placeholder="Bu düşünceye karşı kanıtlar..."
                style={styles.input}
                multiline
                value={evidenceAgainst}
                onChangeText={setEvidenceAgainst}
              />
            </ScrollView>
            <View style={styles.sheetActions}>
              <Button 
                title="Geri" 
                onPress={() => setCbtStep('distortions')} 
                variant="secondary"
                style={styles.actionButton}
              />
              <Button 
                title="Devam" 
                onPress={async () => {
                  if (reframes.length === 0) {
                    try {
                      const suggestions = await generateReframes({ text: transcript, lang: (nlu?.lang || 'tr') as any });
                      setReframes(suggestions.map(s => s.text));
                    } catch {}
                  }
                  setCbtStep('reframe');
                }} 
                variant="primary"
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
        {cbtStep === 'reframe' && (
          <View>
            <Text style={styles.sectionLabel}>Daha Dengeli Düşünceler</Text>
            {(reframes.length ? reframes : ['Dışarıda risk her zaman vardır ama kapıyı çoğu zaman kilitlediğim gerçeğini de hatırlayabilirim.','Kontrol etmeden de güvende olabilirim; hatırlatıcı listem var.']).map((r, i) => (
              <Text key={i} style={styles.sheetItem}>• {r}</Text>
            ))}
            <View style={styles.sheetActions}>
              <Button 
                title="Geri" 
                onPress={() => setCbtStep('evidence')} 
                variant="secondary"
                style={styles.actionButton}
              />
              <Button 
                title="Tamamla" 
                onPress={saveCBTRecord} 
                variant="primary"
                style={styles.actionButton}
              />
            </View>
          </View>
        )}
      </BottomSheet>
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


