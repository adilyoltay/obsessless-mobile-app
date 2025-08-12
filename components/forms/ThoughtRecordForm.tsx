import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, AccessibilityInfo, ScrollView } from 'react-native';
import { generateReframes } from '@/features/ai/services/reframeService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { Modal } from '@/components/ui/Modal';

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
  const [step, setStep] = useState<1|2|3>(1);

  // Fields
  const [automaticThought, setAutomaticThought] = useState('');
  const [evidenceFor, setEvidenceFor] = useState('');
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [distortions, setDistortions] = useState<Distortion[]>([]);
  const [newView, setNewView] = useState('');

  // Reframe modal
  const [reframes, setReframes] = useState<string[]>([]);
  const [showReframe, setShowReframe] = useState(false);

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
        Alert.alert('Uyarı', 'En fazla 3 bilişsel çarpıtma seçebilirsiniz.');
        return prev;
      }
      return next;
    });
    await trackAIInteraction(AIEventType.DISTORTION_SELECTED, { id: d }).catch(() => {});
  };

  const handleReframe = async () => {
    const text = [automaticThought, evidenceFor, evidenceAgainst].filter(Boolean).join(' | ');
    await trackAIInteraction(AIEventType.REFRAME_STARTED, { distortions: distortions.length });
    const out = await generateReframes({ text, lang: 'tr' });
    setReframes(out.map(o => o.text));
    setShowReframe(true);
    await trackAIInteraction(AIEventType.REFRAME_COMPLETED, { suggestions: out.length });
    AccessibilityInfo.announceForAccessibility('Yeni bakış açıları hazır');
  };

  const handleSave = () => {
    if (!automaticThought.trim()) {
      Alert.alert('Uyarı', 'Otomatik düşünce boş olamaz.');
      return;
    }
    if ((!evidenceFor.trim() || !evidenceAgainst.trim()) && distortions.length > 0) {
      Alert.alert('Taslak Kaydedildi', 'Kanıt alanlarından biri boş. Taslak olarak kaydettik.');
      return;
    }
    Alert.alert('Kaydedildi', 'Kayıt alındı.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} accessibilityLabel="CBT düşünce kaydı formu">
      <View style={styles.header}>
        <Text style={styles.title}>Nazikçe Düşünce Kaydı</Text>
        <Text style={styles.subtitle}>Adım adım ilerleyelim. Dilediğin an durabilirsin.</Text>
        <View style={styles.stepper}><Text style={styles.stepText}>Adım {step}/3</Text></View>
      </View>

      {step === 1 && (
        <View accessible accessibilityLabel="Adım 1: Otomatik düşünce">
          <Text style={styles.label}>Otomatik Düşünce</Text>
          <TextInput style={styles.input} value={automaticThought} onChangeText={setAutomaticThought} placeholder="Aklımdan geçen düşünce..." multiline maxLength={300} />
          <Text style={styles.hint}>İpucu: Kısa ve net yazmak işini kolaylaştırır.</Text>
        </View>
      )}

      {step === 2 && (
        <View accessible accessibilityLabel="Adım 2: Çarpıtmalar ve kanıtlar">
          <Text style={styles.label}>Bilişsel Çarpıtmalar (en fazla 3)</Text>
          <View style={styles.chips}>
            {ALL_DISTORTIONS.map(d => (
              <Pressable key={d} style={[styles.chip, distortions.includes(d) && styles.chipActive]} onPress={() => toggleDistortion(d)} accessibilityRole="button" accessibilityLabel={`Çarpıtma ${d.replace(/_/g,' ')}`}>
                <Text style={[styles.chipText, distortions.includes(d) && styles.chipTextActive]}>{d.replace(/_/g,' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Kanıtlar</Text>
          <TextInput style={styles.input} value={evidenceFor} onChangeText={setEvidenceFor} placeholder="Bu düşünceyi destekleyen kanıtlar..." multiline maxLength={500} />
          <Text style={styles.label}>Karşı Kanıtlar</Text>
          <TextInput style={styles.input} value={evidenceAgainst} onChangeText={setEvidenceAgainst} placeholder="Bu düşünceye karşı kanıtlar..." multiline maxLength={500} />
        </View>
      )}

      {step === 3 && (
        <View accessible accessibilityLabel="Adım 3: Yeni bakış açısı">
          <Text style={styles.label}>Yeni Bakış Açım (≤140)</Text>
          <TextInput style={styles.input} value={newView} onChangeText={(t)=> setNewView(t.slice(0,140))} placeholder="Nazik, gerçekçi ve kısa bir alternatif..." multiline maxLength={140} />
          <Text style={styles.counter}>{newView.length}/140</Text>
          <View style={styles.reframeRow}>
            <Pressable style={[styles.button, styles.secondary]} onPress={handleReframe} accessibilityRole="button" accessibilityLabel="Reframe önerisi al">
              <Text style={styles.buttonText}>Öneri Al</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.save]} onPress={handleSave} accessibilityRole="button" accessibilityLabel="Kaydet">
              <Text style={styles.buttonText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.navRow}>
        {step > 1 && (
          <Pressable style={[styles.button, styles.secondary]} onPress={()=> setStep((s)=> (s-1) as any)} accessibilityRole="button" accessibilityLabel="Geri">
            <Text style={styles.buttonText}>Geri</Text>
          </Pressable>
        )}
        {step < 3 && (
          <Pressable style={[styles.button, canNext ? styles.next : styles.disabled]} disabled={!canNext} onPress={()=> setStep((s)=> (s+1) as any)} accessibilityRole="button" accessibilityLabel="İleri">
            <Text style={styles.buttonText}>İleri</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.modalTitle}>Kısa Alternatifler</Text>
        {reframes.map((r, i) => (
          <Pressable key={i} onPress={()=> { setNewView(r); setShowReframe(false); }} accessibilityRole="button" accessibilityLabel={`Öneriyi seç: ${r}`}>
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


