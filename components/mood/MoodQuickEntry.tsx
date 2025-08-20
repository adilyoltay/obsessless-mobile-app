import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

interface MoodQuickEntryProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    mood: number;
    energy: number;
    anxiety: number;
    notes: string;
    trigger?: string;
  }) => void;
  initialData?: {
    mood?: number;
    energy?: number;
    anxiety?: number;
    notes?: string;
    trigger?: string;
  };
}

export function MoodQuickEntry({
  visible,
  onClose,
  onSubmit,
  initialData,
}: MoodQuickEntryProps) {
  const [mood, setMood] = useState(50);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(5);
  const [notes, setNotes] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState('');

  // Set initial values when modal opens
  React.useEffect(() => {
    if (visible && initialData) {
      setMood(initialData.mood || 50);
      setEnergy(initialData.energy || 5);
      setAnxiety(initialData.anxiety || 5);
      setNotes(initialData.notes || '');
      setSelectedTrigger(initialData.trigger || '');
    }
  }, [visible, initialData]);

  const triggers = [
    'İş/Okul',
    'İlişkiler',
    'Sağlık',
    'Finansal',
    'Aile',
    'Sosyal',
    'Uyku',
    'Egzersiz',
    'Diğer',
  ];

  const getMoodEmoji = (value: number) => {
    if (value < 20) return '😢';
    if (value < 40) return '😟';
    if (value < 60) return '😐';
    if (value < 80) return '🙂';
    return '😊';
  };

  const getMoodColor = (value: number) => {
    if (value < 20) return '#EF4444';
    if (value < 40) return '#F59E0B';
    if (value < 60) return '#FCD34D';
    if (value < 80) return '#84CC16';
    return '#10B981';
  };

  const handleSubmit = () => {
    onSubmit({
      mood,
      energy,
      anxiety,
      notes,
      trigger: selectedTrigger,
    });
    
    // Reset form
    setMood(50);
    setEnergy(5);
    setAnxiety(5);
    setNotes('');
    setSelectedTrigger('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Mood Kaydı</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mood Slider */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mood</Text>
                <View style={styles.valueContainer}>
                  <Text style={[styles.moodEmoji, { fontSize: 28 }]}>
                    {getMoodEmoji(mood)}
                  </Text>
                  <Text style={[styles.value, { color: getMoodColor(mood) }]}>
                    {Math.round(mood)}
                  </Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={mood}
                onValueChange={(value) => {
                  setMood(value);
                  if (value % 10 === 0) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                minimumTrackTintColor={getMoodColor(mood)}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={getMoodColor(mood)}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>Çok Kötü</Text>
                <Text style={styles.sliderLabel}>Çok İyi</Text>
              </View>
            </View>

            {/* Energy Level */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Enerji Seviyesi</Text>
                <Text style={styles.value}>{energy}/10</Text>
              </View>
              <View style={styles.levelButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <Pressable
                    key={level}
                    style={[
                      styles.levelButton,
                      energy >= level && styles.levelButtonActive,
                    ]}
                    onPress={() => {
                      setEnergy(level);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      styles.levelText,
                      energy >= level && styles.levelTextActive,
                    ]}>
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Anxiety Level */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Anksiyete Seviyesi</Text>
                <Text style={styles.value}>{anxiety}/10</Text>
              </View>
              <View style={styles.levelButtons}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                  <Pressable
                    key={level}
                    style={[
                      styles.levelButton,
                      anxiety >= level && [
                        styles.levelButtonActive,
                        { backgroundColor: anxiety >= level ? '#EF4444' : '#F3F4F6' },
                      ],
                    ]}
                    onPress={() => {
                      setAnxiety(level);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      styles.levelText,
                      anxiety >= level && styles.levelTextActive,
                    ]}>
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Triggers */}
            <View style={styles.section}>
              <Text style={styles.label}>Tetikleyici (Opsiyonel)</Text>
              <View style={styles.triggers}>
                {triggers.map((trigger) => (
                  <Pressable
                    key={trigger}
                    style={[
                      styles.triggerChip,
                      selectedTrigger === trigger && styles.triggerChipActive,
                    ]}
                    onPress={() => {
                      setSelectedTrigger(selectedTrigger === trigger ? '' : trigger);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={[
                      styles.triggerText,
                      selectedTrigger === trigger && styles.triggerTextActive,
                    ]}>
                      {trigger}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Notlar (Opsiyonel)</Text>
              <TextInput
                style={styles.textInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Bugün nasıl hissediyorsun?"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={onClose}
              style={styles.button}
            >
              İptal
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              style={styles.button}
            >
              Kaydet
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 5,
  },
  section: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 8,
  },
  moodEmoji: {
    fontSize: 24,
  },
  slider: {
    height: 40,
    marginHorizontal: -10,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  levelButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelButtonActive: {
    backgroundColor: '#10B981',
  },
  levelText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  levelTextActive: {
    color: '#FFFFFF',
  },
  triggers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  triggerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginBottom: 8,
  },
  triggerChipActive: {
    backgroundColor: '#10B981',
  },
  triggerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  triggerTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});
