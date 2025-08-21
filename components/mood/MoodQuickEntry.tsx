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

  /**
   * 🎭 Enhanced Emotion-to-Mood Algorithm with Secondary Contributions
   * Based on AI_FEATURES_MOOD_SCREEN.md specifications
   */
  const getMoodScoreFromEmotion = (emotion: { primary: string; secondary?: string } | null): number => {
    if (!emotion) return 50;
    
    // 🎯 Primary emotion base scores (core emotional states)
    const primaryScores: Record<string, number> = {
      // High positive emotions
      'mutlu': 85,      // Joy/Happy
      'coşkulu': 82,    // Excited
      'neşeli': 80,     // Cheerful
      
      // Medium-high positive
      'güvenli': 75,    // Safe/Secure
      'rahat': 72,      // Comfortable
      'umutlu': 70,     // Hopeful
      
      // Neutral-positive
      'şaşkın': 62,     // Surprised (curious)
      'meraklı': 60,    // Curious
      'karışık': 58,    // Mixed feelings
      
      // Neutral
      'normal': 50,     // Normal/Baseline
      'sakin': 55,      // Calm (slightly positive)
      
      // Medium negative  
      'üzgün': 35,      // Sad
      'yorgun': 32,     // Tired
      'hayal kırıklığı': 30, // Disappointed
      
      // High negative
      'kızgın': 25,     // Angry
      'korkmuş': 20,    // Scared/Afraid
      'endişeli': 18,   // Anxious
      
      // Very high negative
      'çaresiz': 15,    // Hopeless
      'utanç': 12,      // Shame
      'suçlu': 10,      // Guilty
    };
    
    // 🎨 Secondary emotion modifiers (fine-tuning adjustments)
    const secondaryModifiers: Record<string, number> = {
      // Happiness boosters
      'keyifli': +8,    // Delightful
      'heyecanlı': +6,  // Enthusiastic
      'gururlu': +5,    // Proud
      'memnun': +4,     // Satisfied
      'şükran': +7,     // Grateful
      
      // Energy modifiers
      'enerjik': +5,    // Energetic
      'dinamik': +4,    // Dynamic
      'aktif': +3,      // Active
      'halsiz': -6,     // Weak/Tired
      'bitkin': -8,     // Exhausted
      
      // Anxiety penalties
      'gergin': -7,     // Tense
      'stresli': -6,    // Stressed
      'tedirgin': -8,   // Uneasy
      'panik': -12,     // Panic
      
      // Depression indicators  
      'umutsuz': -10,   // Hopeless
      'boş': -8,        // Empty
      'anlamsız': -9,   // Meaningless
      'yalnız': -7,     // Lonely
      
      // Anger adjustments
      'sinirli': -5,    // Irritated
      'öfkeli': -8,     // Furious
      'bıkkın': -4,     // Fed up
      'kızgın': -6,     // Mad
      
      // Peace/calm bonuses
      'huzurlu': +6,    // Peaceful
      'dengeli': +5,    // Balanced
      'rahatlamış': +4, // Relaxed
      'dingin': +3,     // Serene
      
      // Motivation modifiers
      'motive': +6,     // Motivated
      'kararlı': +4,    // Determined
      'istekli': +5,    // Willing
      'cesaretli': +7,  // Brave
      
      // Social emotions
      'sevgi': +8,      // Love
      'minnettarlık': +6, // Appreciation
      'empati': +4,     // Empathy
      'reddedilmiş': -9, // Rejected
    };
    
    // Calculate final score
    const baseScore = primaryScores[emotion.primary.toLowerCase()] || 50;
    const secondaryBonus = emotion.secondary 
      ? (secondaryModifiers[emotion.secondary.toLowerCase()] || 0) 
      : 0;
    
    const finalScore = Math.max(0, Math.min(100, baseScore + secondaryBonus));
    
    // 🔍 Debug logging for emotion analysis
    console.log('🎭 Emotion Score Calculation:', {
      primary: emotion.primary,
      secondary: emotion.secondary,
      baseScore,
      secondaryBonus,
      finalScore
    });
    
    return finalScore;
  };

  /**
   * 🎨 Dynamic Color Psychology for Mood Visualization
   * Based on scientific color-emotion research and UX best practices
   */
  const getMoodColor = (value: number): string => {
    // Very Happy (80-100): Rich Green - prosperity, growth, positivity
    if (value >= 80) return '#10B981'; // Emerald green - very positive
    
    // Happy (60-79): Light Green - balance, harmony, hope
    if (value >= 60) return '#84CC16'; // Lime green - positive
    
    // Neutral (40-59): Warm Yellow - neutrality, caution, balance
    if (value >= 40) return '#FCD34D'; // Yellow - neutral
    
    // Sad (20-39): Orange - warning, concern, attention needed
    if (value >= 20) return '#F59E0B'; // Amber orange - concerning
    
    // Very Sad (0-19): Red - urgency, crisis, immediate attention
    return '#EF4444'; // Red - critical/very negative
  };

  /**
   * 🎨 Get mood color with transparency for background use
   */
  const getMoodColorWithOpacity = (value: number, opacity: number = 0.1): string => {
    const baseColor = getMoodColor(value);
    // Convert hex to rgba
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  /**
   * 🎭 Get descriptive mood label based on score
   */
  const getMoodLabel = (value: number): string => {
    if (value >= 85) return 'Harika! 🌟';
    if (value >= 70) return 'Çok İyi 😊';
    if (value >= 60) return 'İyi 🙂';
    if (value >= 50) return 'Normal 😐';
    if (value >= 40) return 'Orta 😕';
    if (value >= 30) return 'Düşük 😞';
    if (value >= 20) return 'Zor 😢';
    return 'Çok Zor 😰';
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
                    <View style={[
                      styles.moodPreview,
                      { 
                        backgroundColor: getMoodColorWithOpacity(getMoodScoreFromEmotion(selectedEmotion), 0.2),
                        borderColor: getMoodColor(getMoodScoreFromEmotion(selectedEmotion))
                      }
                    ]}>
                      <Text style={[
                        styles.moodPreviewText,
                        { color: getMoodColor(getMoodScoreFromEmotion(selectedEmotion)) }
                      ]}>
                        {getMoodLabel(getMoodScoreFromEmotion(selectedEmotion))} ({getMoodScoreFromEmotion(selectedEmotion)})
                      </Text>
                    </View>
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
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 120,
  },
  moodPreview: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  moodPreviewText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
