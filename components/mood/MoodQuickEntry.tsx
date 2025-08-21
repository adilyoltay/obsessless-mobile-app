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
import EmotionWheel from '@/components/illustrations/EmotionWheel';

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
  const [selectedEmotion, setSelectedEmotion] = useState<{ primary: string; secondary?: string } | null>(null);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(5);
  const [notes, setNotes] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState('');

  // Set initial values when modal opens
  React.useEffect(() => {
    if (visible && initialData) {
      // Mood artık emotion wheel ile seçilecek
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

  const getMoodScoreFromEmotion = (emotion: { primary: string; secondary?: string } | null): number => {
    if (!emotion) return 50;
    
    // Ana duygulara göre temel skor
    const primaryScores: Record<string, number> = {
      'mutlu': 80,
      'güvenli': 75,
      'şaşkın': 60,
      'üzgün': 40,
      'korkmuş': 35,
      'kızgın': 30,
    };
    
    return primaryScores[emotion.primary] || 50;
  };

  const getMoodColor = (value: number) => {
    if (value < 20) return '#EF4444';
    if (value < 40) return '#F59E0B';
    if (value < 60) return '#FCD34D';
    if (value < 80) return '#84CC16';
    return '#10B981';
  };

  const handleSubmit = () => {
    // Emotion'ı mood score'a çevir (basit bir mapping)
    const moodScore = getMoodScoreFromEmotion(selectedEmotion);
    
    onSubmit({
      mood: moodScore,
      energy,
      anxiety,
      notes,
      trigger: selectedTrigger,
    });
    
    // Reset form
    setSelectedEmotion(null);
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
            {/* Emotion Wheel - Lindsay Braman Style */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Duygu Seçimi</Text>
                {selectedEmotion && (
                  <View style={styles.valueContainer}>
                    <Text style={styles.selectedEmotionText}>
                      {selectedEmotion.primary}
                      {selectedEmotion.secondary && ` - ${selectedEmotion.secondary}`}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.emotionWheelContainer}>
                <EmotionWheel
                  size={280}
                  selectedEmotion={selectedEmotion}
                  onEmotionSelect={(primary, secondary) => {
                    setSelectedEmotion({ primary, secondary });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  interactive={true}
                />
              </View>
              <Text style={styles.emotionHelperText}>
                Ana duyguya dokunun, ardından alt duyguları keşfedin
              </Text>
            </View>

            {/* Energy Level Slider */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Enerji Seviyesi</Text>
                <View style={styles.valueContainer}>
                  <MaterialCommunityIcons 
                    name="lightning-bolt" 
                    size={20} 
                    color={energy > 5 ? '#10B981' : '#6B7280'} 
                  />
                  <Text style={[styles.value, { color: energy > 5 ? '#10B981' : '#6B7280' }]}>
                    {Math.round(energy)}/10
                  </Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                value={energy}
                step={1}
                onValueChange={(value) => {
                  setEnergy(value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                minimumTrackTintColor="#10B981"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#10B981"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>Düşük</Text>
                <Text style={styles.sliderLabel}>Yüksek</Text>
              </View>
            </View>

            {/* Anxiety Level Slider */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Anksiyete Seviyesi</Text>
                <View style={styles.valueContainer}>
                  <MaterialCommunityIcons 
                    name="alert-circle-outline" 
                    size={20} 
                    color={anxiety > 5 ? '#EF4444' : '#6B7280'} 
                  />
                  <Text style={[styles.value, { color: anxiety > 5 ? '#EF4444' : '#6B7280' }]}>
                    {Math.round(anxiety)}/10
                  </Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                value={anxiety}
                step={1}
                onValueChange={(value) => {
                  setAnxiety(value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                minimumTrackTintColor="#EF4444"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#EF4444"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>Sakin</Text>
                <Text style={styles.sliderLabel}>Kaygılı</Text>
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
  emotionWheelContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  selectedEmotionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  emotionHelperText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
