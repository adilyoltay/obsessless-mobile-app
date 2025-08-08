/**
 * 🧠 Y-BOCS Assessment V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun Y-BOCS değerlendirmesi:
 * - Tek ekran, tek soru
 * - Minimal görsel karmaşa
 * - Net ilerleme göstergesi
 * - Yumuşak geçişler
 * 
 * Features:
 * ✅ Full-screen question layout
 * ✅ Single action per screen
 * ✅ Visual severity indicators
 * ✅ Smooth animations
 * ✅ Turkish adaptation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';

// Types
import {
  YBOCSAnswer,
  YBOCSQuestion,
  YBOCSQuestionType,
  OCDSeverityLevel,
} from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

const { width: screenWidth } = Dimensions.get('window');

// Anayasa v2.0 Renk Paleti
const COLORS = {
  background: '#F9FAFB',
  primary: '#10B981',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  error: '#EF4444',
  warning: '#F59E0B',
};

interface YBOCSAssessmentV2Props {
  onComplete: (answers: YBOCSAnswer[]) => void;
  isLoading?: boolean;
  userId?: string;
}

// Simplified Y-BOCS Questions (Turkish)
const YBOCS_QUESTIONS: YBOCSQuestion[] = [
  {
    id: 'obs_time',
    type: YBOCSQuestionType.OBSESSIONS,
    category: 'time',
    text: 'Günde ne kadar zamanınızı obsesyonlar alır?',
    description: 'İstenmeyen düşünceler için harcadığınız zaman',
    options: [
      { value: 0, label: 'Hiç', description: '0 saat' },
      { value: 1, label: 'Az', description: '< 1 saat' },
      { value: 2, label: 'Orta', description: '1-3 saat' },
      { value: 3, label: 'Çok', description: '3-8 saat' },
      { value: 4, label: 'Aşırı', description: '> 8 saat' }
    ],
  },
  {
    id: 'obs_interference',
    type: YBOCSQuestionType.OBSESSIONS,
    category: 'interference',
    text: 'Obsesyonlar günlük yaşamınızı ne kadar etkiliyor?',
    description: 'İş, sosyal hayat ve aktivitelere etkisi',
    options: [
      { value: 0, label: 'Etkilemiyor', description: 'Normal yaşam' },
      { value: 1, label: 'Hafif', description: 'Küçük aksamalar' },
      { value: 2, label: 'Orta', description: 'Belirgin etkiler' },
      { value: 3, label: 'Ciddi', description: 'Büyük engeller' },
      { value: 4, label: 'Tamamen', description: 'İşlevsizlik' }
    ],
  },
  {
    id: 'obs_distress',
    type: YBOCSQuestionType.OBSESSIONS,
    category: 'distress',
    text: 'Obsesyonlar ne kadar sıkıntı veriyor?',
    description: 'Duygusal rahatsızlık seviyesi',
    options: [
      { value: 0, label: 'Hiç', description: 'Rahatsız etmiyor' },
      { value: 1, label: 'Az', description: 'Hafif rahatsızlık' },
      { value: 2, label: 'Orta', description: 'Belirgin sıkıntı' },
      { value: 3, label: 'Çok', description: 'Yoğun sıkıntı' },
      { value: 4, label: 'Aşırı', description: 'Dayanılmaz' }
    ],
  },
  {
    id: 'comp_time',
    type: YBOCSQuestionType.COMPULSIONS,
    category: 'time',
    text: 'Günde ne kadar zamanınızı kompulsiyonlar alır?',
    description: 'Ritüeller için harcadığınız zaman',
    options: [
      { value: 0, label: 'Hiç', description: '0 saat' },
      { value: 1, label: 'Az', description: '< 1 saat' },
      { value: 2, label: 'Orta', description: '1-3 saat' },
      { value: 3, label: 'Çok', description: '3-8 saat' },
      { value: 4, label: 'Aşırı', description: '> 8 saat' }
    ],
  },
  {
    id: 'comp_interference',
    type: YBOCSQuestionType.COMPULSIONS,
    category: 'interference',
    text: 'Kompulsiyonlar günlük yaşamınızı ne kadar etkiliyor?',
    description: 'Ritüellerin yaşama etkisi',
    options: [
      { value: 0, label: 'Etkilemiyor', description: 'Normal yaşam' },
      { value: 1, label: 'Hafif', description: 'Küçük aksamalar' },
      { value: 2, label: 'Orta', description: 'Belirgin etkiler' },
      { value: 3, label: 'Ciddi', description: 'Büyük engeller' },
      { value: 4, label: 'Tamamen', description: 'İşlevsizlik' }
    ],
  },
];

export const YBOCSAssessmentV2: React.FC<YBOCSAssessmentV2Props> = ({
  onComplete,
  isLoading,
  userId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<YBOCSAnswer[]>([]);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = YBOCS_QUESTIONS[currentIndex];
  const progress = ((currentIndex + 1) / YBOCS_QUESTIONS.length) * 100;

  useEffect(() => {
    // Track question view
    if (userId && currentQuestion) {
      trackAIInteraction(AIEventType.YBOCS_QUESTION_VIEWED, {
        userId,
        questionId: currentQuestion.id,
        questionIndex: currentIndex,
      });
    }
  }, [currentIndex]);

  const handleAnswer = (value: number) => {
    setSelectedValue(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    if (selectedValue === null) return;

    // Save answer
    const answer: YBOCSAnswer = {
      questionId: currentQuestion.id,
      value: selectedValue,
      timestamp: new Date(),
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // Check if completed
    if (currentIndex === YBOCS_QUESTIONS.length - 1) {
      onComplete(newAnswers);
      return;
    }

    // Transition to next question
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -screenWidth,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setCurrentIndex(currentIndex + 1);
      setSelectedValue(null);
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePrevious = () => {
    if (currentIndex === 0) return;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenWidth,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setCurrentIndex(currentIndex - 1);
      const prevAnswer = answers[currentIndex - 1];
      setSelectedValue(prevAnswer ? prevAnswer.value : null);
      setAnswers(answers.slice(0, -1));
    });
  };

  const getSeverityColor = (value: number): string => {
    if (value === 0) return COLORS.primary;
    if (value === 1) return '#34D399';
    if (value === 2) return COLORS.warning;
    if (value === 3) return '#FB923C';
    return COLORS.error;
  };

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Soru {currentIndex + 1} / {YBOCS_QUESTIONS.length}
        </Text>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill,
              { width: `${progress}%` }
            ]} 
          />
        </View>
      </View>

      {/* Question Content */}
      <Animated.View 
        style={[
          styles.questionContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>{currentQuestion.text}</Text>
          <Text style={styles.questionDescription}>{currentQuestion.description}</Text>
        </View>

        {/* Answer Options */}
        <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
          {currentQuestion.options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionCard,
                selectedValue === option.value && styles.optionCardSelected,
              ]}
              onPress={() => handleAnswer(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionHeader}>
                  <View 
                    style={[
                      styles.optionIndicator,
                      selectedValue === option.value && {
                        backgroundColor: getSeverityColor(option.value)
                      }
                    ]}
                  >
                    {selectedValue === option.value && (
                      <MaterialCommunityIcons 
                        name="check" 
                        size={16} 
                        color={COLORS.white} 
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.optionLabel,
                    selectedValue === option.value && styles.optionLabelSelected
                  ]}>
                    {option.label}
                  </Text>
                </View>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          title={currentIndex === YBOCS_QUESTIONS.length - 1 ? "Tamamla" : "İleri"}
          onPress={handleNext}
          disabled={selectedValue === null}
          style={[
            styles.primaryButton,
            selectedValue === null && styles.disabledButton
          ]}
        />
        
        {currentIndex > 0 && (
          <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Önceki Soru</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  questionContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionHeader: {
    marginTop: 24,
    marginBottom: 32,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 8,
    lineHeight: 32,
  },
  questionDescription: {
    fontSize: 15,
    color: COLORS.secondaryText,
    lineHeight: 20,
  },
  optionsContainer: {
    flex: 1,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  optionLabelSelected: {
    color: COLORS.primary,
  },
  optionDescription: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginLeft: 36,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  disabledButton: {
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  backButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: COLORS.secondaryText,
  },
});

export default YBOCSAssessmentV2;
