import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput } from 'react-native';
import ScreenLayout, { ScreenHeader } from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import moodTracker from '@/services/moodTrackingService';

export default function MoodsScreen() {
  const { user } = useAuth();
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(5);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await moodTracker.saveMoodEntry({
        user_id: user.id,
        mood_score: mood,
        energy_level: energy,
        anxiety_level: anxiety,
        notes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout>
      <View style={styles.container}>
        <ScreenHeader title="Duygu Takibi" subtitle="Nazik, hızlı ve sezgisel kayıt" />

        <Card variant="outlined" style={styles.card}>
          <View accessible accessibilityLabel="Mod seviyesi" style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Mod</Text>
              <Text style={styles.value}>{mood}</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={mood}
              onValueChange={setMood}
              style={styles.slider}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#10B981"
            />
          </View>

          <View accessible accessibilityLabel="Enerji seviyesi" style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Enerji</Text>
              <Text style={styles.value}>{energy}</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={energy}
              onValueChange={setEnergy}
              style={styles.slider}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#10B981"
            />
          </View>

          <View accessible accessibilityLabel="Anksiyete seviyesi" style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Anksiyete</Text>
              <Text style={styles.value}>{anxiety}</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={anxiety}
              onValueChange={setAnxiety}
              style={styles.slider}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#10B981"
            />
            <Text style={styles.hint}>İpucu: Değerler 1 (düşük) → 10 (yüksek) arasındadır.</Text>
          </View>

          <View style={styles.notesBox} accessibilityLabel="Notlar alanı">
            <Text style={styles.notesLabel}>Notlar</Text>
            <TextInput
              style={styles.input}
              placeholder="Bugünün kısa notu..."
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          <Button
            variant="primary"
            onPress={onSave}
            loading={saving}
            accessibilityLabel="Kaydet"
            style={styles.saveButton}
          >
            Kaydet
          </Button>
        </Card>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginTop: 8 },
  section: { marginTop: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  value: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  slider: { marginTop: 4 },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  notesBox: { marginTop: 16 },
  notesLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 70, textAlignVertical: 'top', backgroundColor: '#FFFFFF' },
  saveButton: { marginTop: 16 },
});


