import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, AccessibilityInfo, ScrollView } from 'react-native';
import { generateReframes } from '@/features/ai/services/reframeService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { Modal } from '@/components/ui/Modal';
import { saveUserData, loadUserData, StorageKeys } from '@/utils/storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';

// Calm, step-by-step CBT Thought Record (3 steps)
// Step 1: Automatic thought
// Step 2: Distortions + Evidence / Counter-evidence
// Step 3: New balanced view (<= 140) with Reframe suggestions

type Distortion =
  | 'mind_reading' | 'catastrophizing' | 'should_statements' | 'all_or_nothing'
  | 'overgeneralization' | 'labeling' | 'mental_filter' | 'disqualifying_the_positive'
  | 'emotional_reasoning' | 'personalization';

const ALL_DISTORTIONS: Distortion[] = [
  'mind_reading','catastrophizing','should_statements','all_or_nothing','overgeneralization','labeling','mental_filter','disqualifying_the_positive','emotional_reasoning','personalization'
];

export default function ThoughtRecordForm() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const tr: (k: string, f?: string) => string = t;
  const [step, setStep] = useState<1|2|3>(1);

  const labelFor = (key: Distortion) => tr(`cbt.distortions.${key}`, key.replace(/_/g, ' '));

  // Fields
  const [automaticThought, setAutomaticThought] = useState('');
  const [evidenceFor, setEvidenceFor] = useState('');
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [distortions, setDistortions] = useState<Distortion[]>([]);
  const [newView, setNewView] = useState('');

  // Reframe modal
  const [reframes, setReframes] = useState<string[]>([]);
  const [showReframe, setShowReframe] = useState(false);
  const [reframeLoading, setReframeLoading] = useState(false);

  // Load draft on mount
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const draft = await loadUserData<any>(StorageKeys.THOUGHT_RECORD_DRAFT(user.id));
      if (draft) {
        setAutomaticThought(draft.automaticThought || '');
        setEvidenceFor(draft.evidenceFor || '');
        setEvidenceAgainst(draft.evidenceAgainst || '');
        setDistortions(draft.distortions || []);
        setNewView(draft.newView || '');
      }
    })();
  }, [user?.id]);

  // Auto-save draft
  useEffect(() => {
    const saveDraft = async () => {
      if (!user?.id) return;
      const payload = { automaticThought, evidenceFor, evidenceAgainst, distortions, newView, language };
      await saveUserData(StorageKeys.THOUGHT_RECORD_DRAFT(user.id), payload);
    };
    // Debounce-like simple save
    const id = setTimeout(saveDraft, 400);
    return () => clearTimeout(id);
  }, [automaticThought, evidenceFor, evidenceAgainst, distortions, newView, language, user?.id]);

  const canNext = useMemo(() => {
    if (step === 1) return automaticThought.trim().length >= 1;
    if (step === 2) return distortions.length >= 1;
    return true;
  }, [step, automaticThought, distortions]);

  const toggleDistortion = async (d: Distortion) => {
    setDistortions(prev => {
      const has = prev.includes(d);
      const next = has ? prev.filter(x => x !== d) : [...prev, d];
      if (next.length > 3) {
        Alert.alert(t('general.error'), t('cbt.maxDistortions') || 'En fazla 3 bilişsel çarpıtma seçebilirsiniz.');
        return prev;
      }
      return next;
    });
    await trackAIInteraction(AIEventType.DISTORTION_SELECTED, { id: d }).catch(() => {});
  };

  const handleReframe = async () => {
    if (reframeLoading) return;
    setReframeLoading(true);
    try {
      const text = [automaticThought, evidenceFor, evidenceAgainst].filter(Boolean).join(' | ');
      await trackAIInteraction(AIEventType.REFRAME_STARTED, { distortions: distortions.length });
      const out = await generateReframes({ text, lang: language === 'tr' ? 'tr' : 'en' });
      setReframes(out.map(o => o.text));
      setShowReframe(true);
      await trackAIInteraction(AIEventType.REFRAME_COMPLETED, { suggestions: out.length });
      AccessibilityInfo.announceForAccessibility(t('cbt.reframesReady') || 'Yeni bakış açıları hazır');
    } finally {
      setReframeLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!automaticThought.trim()) {
      Alert.alert(t('general.error'), t('cbt.autoThoughtRequired') || 'Otomatik düşünce boş olamaz.');
      return;
    }

    const record = {
      id: `tr_${Date.now()}`,
      automaticThought,
      evidenceFor,
      evidenceAgainst,
      distortions,
      newView,
      language,
      createdAt: new Date().toISOString()
    };

    // Append to local list
    const key = StorageKeys.THOUGHT_RECORDS(user.id);
    const prev = await loadUserData<any[]>(key) || [];
    await saveUserData(key, [...prev, record]);

    // Supabase sync (best-effort)
    try {
      const { default: supabaseService } = await import('@/services/supabase');
      const { default: dataStandardizer } = await import('@/utils/dataStandardization');
      const standardized = dataStandardizer.standardizeThoughtRecordData({
        user_id: user.id,
        automatic_thought: automaticThought,
        evidence_for: evidenceFor,
        evidence_against: evidenceAgainst,
        distortions,
        new_view: newView,
        lang: language,
      });
      await supabaseService.saveThoughtRecord(standardized as any);
    } catch {}

    // Clear draft and reset form
    await saveUserData(StorageKeys.THOUGHT_RECORD_DRAFT(user.id), null as any);
    setAutomaticThought('');
    setEvidenceFor('');
    setEvidenceAgainst('');
    setDistortions([]);
    setNewView('');

    Alert.alert(t('general.success'), t('cbt.saved') || 'Kayıt alındı.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} accessibilityLabel={t('cbt.formLabel') || 'CBT düşünce kaydı formu'}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('cbt.title') || 'Nazikçe Düşünce Kaydı'}</Text>
        <Text style={styles.subtitle}>{t('cbt.subtitle') || 'Adım adım ilerleyelim. Dilediğin an durabilirsin.'}</Text>
        <View style={styles.stepper}><Text style={styles.stepText}>{t('cbt.step', 'Adım')} {step}/3</Text></View>
      </View>

      {step === 1 && (
        <View accessible accessibilityLabel={t('cbt.step1') || 'Adım 1: Otomatik düşünce'}>
          <Text style={styles.label}>{t('cbt.autoThought') || 'Otomatik Düşünce'}</Text>
          <TextInput style={styles.input} value={automaticThought} onChangeText={setAutomaticThought} placeholder={t('cbt.autoThoughtPh') || 'Aklımdan geçen düşünce...'} multiline maxLength={300} />
          <Text style={styles.hint}>{t('cbt.hintShort') || 'İpucu: Kısa ve net yazmak işini kolaylaştırır.'}</Text>
        </View>
      )}

      {step === 2 && (
        <View accessible accessibilityLabel={t('cbt.step2') || 'Adım 2: Çarpıtmalar ve kanıtlar'}>
          <Text style={styles.label}>{t('cbt.distortions') || 'Bilişsel Çarpıtmalar (en fazla 3)'}</Text>
          <View style={styles.chips}>
            {ALL_DISTORTIONS.map(d => (
              <Pressable key={d} style={[styles.chip, distortions.includes(d) && styles.chipActive]} onPress={() => toggleDistortion(d)} accessibilityRole="button" accessibilityLabel={`Çarpıtma ${d.replace(/_/g,' ')}`}>
                <Text style={[styles.chipText, distortions.includes(d) && styles.chipTextActive]}>{labelFor(d)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t('cbt.evidenceFor') || 'Kanıtlar'}</Text>
          <TextInput style={styles.input} value={evidenceFor} onChangeText={setEvidenceFor} placeholder={t('cbt.evidenceForPh') || 'Bu düşünceyi destekleyen kanıtlar...'} multiline maxLength={500} />
          <Text style={styles.label}>{t('cbt.evidenceAgainst') || 'Karşı Kanıtlar'}</Text>
          <TextInput style={styles.input} value={evidenceAgainst} onChangeText={setEvidenceAgainst} placeholder={t('cbt.evidenceAgainstPh') || 'Bu düşünceye karşı kanıtlar...'} multiline maxLength={500} />
        </View>
      )}

      {step === 3 && (
        <View accessible accessibilityLabel={t('cbt.step3') || 'Adım 3: Yeni bakış açısı'}>
          <Text style={styles.label}>{t('cbt.newView') || 'Yeni Bakış Açım (≤140)'}</Text>
          <TextInput style={styles.input} value={newView} onChangeText={(tVal)=> setNewView(tVal.slice(0,140))} placeholder={t('cbt.newViewPh') || 'Nazik, gerçekçi ve kısa bir alternatif...'} multiline maxLength={140} />
          <Text style={styles.counter}>{newView.length}/140</Text>
          <View style={styles.reframeRow}>
            <Pressable style={[styles.button, styles.secondary, reframeLoading && styles.disabled]} onPress={handleReframe} accessibilityRole="button" accessibilityLabel={t('cbt.getReframe') || 'Reframe önerisi al'} disabled={reframeLoading}>
              <Text style={styles.buttonText}>{reframeLoading ? (t('general.loading') || 'Yükleniyor...') : (t('cbt.getReframe') || 'Öneri Al')}</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.save]} onPress={handleSave} accessibilityRole="button" accessibilityLabel={t('general.save') || 'Kaydet'}>
              <Text style={styles.buttonText}>{t('general.save') || 'Kaydet'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.navRow}>
        {step > 1 && (
          <Pressable style={[styles.button, styles.secondary]} onPress={()=> setStep((s)=> (s-1) as any)} accessibilityRole="button" accessibilityLabel={t('general.previous') || 'Geri'}>
            <Text style={styles.buttonText}>{t('general.previous') || 'Geri'}</Text>
          </Pressable>
        )}
        {step < 3 && (
          <Pressable style={[styles.button, canNext ? styles.next : styles.disabled]} disabled={!canNext} onPress={()=> setStep((s)=> (s+1) as any)} accessibilityRole="button" accessibilityLabel={t('general.next') || 'İleri'}>
            <Text style={styles.buttonText}>{t('general.next') || 'İleri'}</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.modalTitle}>{t('cbt.altShort') || 'Kısa Alternatifler'}</Text>
        {reframes.map((r, i) => (
          <Pressable key={i} onPress={()=> { setNewView(r); setShowReframe(false); }} accessibilityRole="button" accessibilityLabel={`${t('general.apply') || 'Uygula'}: ${r}`}>
            <Text style={styles.modalItem}>• {r}</Text>
          </Pressable>
        ))}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  stepper: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  stepText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, minHeight: 60, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16 },
  chipActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  chipText: { fontSize: 12, color: '#6B7280' },
  chipTextActive: { color: '#065F46', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  save: { backgroundColor: '#10B981' },
  secondary: { backgroundColor: '#334155' },
  next: { backgroundColor: '#10B981' },
  disabled: { backgroundColor: '#CBD5E1' },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  reframeRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  counter: { fontSize: 12, color: '#64748B', marginTop: 6, alignSelf: 'flex-end' },
  buttonText: { color: 'white', fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalItem: { fontSize: 14, color: '#374151', marginBottom: 6 },
});


