import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, TextInput } from 'react-native-paper';
import Slider from '@react-native-community/slider';
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
    <View style={styles.container}>
      <Card>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>Duygu Takibi</Text>
          <Text>Mod: {mood}</Text>
          <Slider minimumValue={1} maximumValue={10} step={1} value={mood} onValueChange={setMood} />
          <Text>Enerji: {energy}</Text>
          <Slider minimumValue={1} maximumValue={10} step={1} value={energy} onValueChange={setEnergy} />
          <Text>Anksiyete: {anxiety}</Text>
          <Slider minimumValue={1} maximumValue={10} step={1} value={anxiety} onValueChange={setAnxiety} />
          <TextInput label="Notlar" value={notes} onChangeText={setNotes} style={{ marginTop: 8 }} />
          <Button mode="contained" onPress={onSave} loading={saving} style={{ marginTop: 12 }}>Kaydet</Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F9FAFB' },
  title: { marginBottom: 12 },
});


