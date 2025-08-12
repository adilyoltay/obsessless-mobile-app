import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { generateReframes } from '@/features/ai/services/reframeService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { Modal } from '@/components/ui/Modal';

type Distortion =
  | 'mind_reading' | 'catastrophizing' | 'should_statements' | 'all_or_nothing'
  | 'overgeneralization' | 'labeling' | 'mental_filter' | 'disqualifying_the_positive'
  | 'emotional_reasoning' | 'personalization';

export default function ThoughtRecordForm() {
  const [automaticThought, setAutomaticThought] = useState('');
  const [evidenceFor, setEvidenceFor] = useState('');
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [distortions, setDistortions] = useState<Distortion[]>([]);
  const [reframes, setReframes] = useState<string[]>([]);
  const [showReframe, setShowReframe] = useState(false);

  const toggleDistortion = (d: Distortion) => {
    setDistortions(prev => {
      const has = prev.includes(d);
      const next = has ? prev.filter(x => x !== d) : [...prev, d];
      if (next.length > 3) {
        Alert.alert('Uyarı', 'En fazla 3 bilişsel çarpıtma seçebilirsiniz.');
        return prev;
      }
      return next;
    });
  };

  const handleReframe = async () => {
    const text = [automaticThought, evidenceFor, evidenceAgainst].filter(Boolean).join(' | ');
    await trackAIInteraction(AIEventType.REFRAME_STARTED, { distortions: distortions.length });
    const out = await generateReframes({ text, lang: 'tr' });
    setReframes(out.map(o => o.text));
    setShowReframe(true);
    await trackAIInteraction(AIEventType.REFRAME_COMPLETED, { suggestions: out.length });
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
    <View style={styles.container}>
      <Text style={styles.title}>CBT Thought Record</Text>
      <Text style={styles.label}>Otomatik Düşünce</Text>
      <TextInput
        style={styles.input}
        value={automaticThought}
        onChangeText={setAutomaticThought}
        placeholder="Aklımdan geçen düşünce..."
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>Kanıtlar</Text>
      <TextInput
        style={styles.input}
        value={evidenceFor}
        onChangeText={setEvidenceFor}
        placeholder="Bu düşünceyi destekleyen kanıtlar..."
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>Karşı Kanıtlar</Text>
      <TextInput
        style={styles.input}
        value={evidenceAgainst}
        onChangeText={setEvidenceAgainst}
        placeholder="Bu düşünceye karşı kanıtlar..."
        multiline
        maxLength={1000}
      />

      <Text style={styles.label}>Bilişsel Çarpıtmalar (en fazla 3)</Text>
      <View style={styles.chips}>
        {(['mind_reading','catastrophizing','should_statements','all_or_nothing','overgeneralization','labeling','mental_filter','disqualifying_the_positive','emotional_reasoning','personalization'] as Distortion[]).map(d => (
          <Pressable key={d} style={[styles.chip, distortions.includes(d) && styles.chipActive]} onPress={() => { toggleDistortion(d); trackAIInteraction(AIEventType.DISTORTION_SELECTED, { id: d }).catch(() => {}); }}>
            <Text style={[styles.chipText, distortions.includes(d) && styles.chipTextActive]}>{d.replace(/_/g,' ')}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handleReframe}>
          <Text style={styles.buttonText}>Reframe Öner</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.save]} onPress={handleSave}>
          <Text style={styles.buttonText}>Kaydet</Text>
        </Pressable>
      </View>

      <Modal visible={showReframe} onClose={() => setShowReframe(false)}>
        <Text style={styles.modalTitle}>Kısa Alternatifler</Text>
        {reframes.map((r, i) => (
          <Text key={i} style={styles.modalItem}>• {r}</Text>
        ))}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
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
  buttonText: { color: 'white', fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalItem: { fontSize: 14, color: '#374151', marginBottom: 6 },
});


