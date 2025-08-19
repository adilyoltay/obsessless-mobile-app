/**
 * 🧠 Y-BOCS Assessment V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun Y-BOCS değerlendirmesi:
 * - Tek ekran, tek soru
 * - TEK AKSIYON: Slider ile değer seçimi
 * - Otomatik ilerleme
 * - Minimal görsel karmaşa
 * 
 * Features:
 * ✅ Full-screen question layout
 * ✅ SINGLE ACTION: Slider input only
 * ✅ Auto-progress on selection
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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// UI Components
import Button from '@/components/ui/Button';
import Slider from '@react-native-community/slider';

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
  success: '#10B981',
  mild: '#34D399',
  moderate: '#FCD34D',
  severe: '#FB923C',
  extreme: '#EF4444',
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
    description: 'Kaydırıcıyı kullanarak değerlendirin',
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
    description: 'Kaydırıcıyı kullanarak değerlendirin',
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
    description: 'Kaydırıcıyı kullanarak değerlendirin',
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
    description: 'Kaydırıcıyı kullanarak değerlendirin',
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
    description: 'Kaydırıcıyı kullanarak değerlendirin',
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
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<YBOCSAnswer[]>([]);
  const [sliderValue, setSliderValue] = useState(2); // Start at middle
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const autoProgressTimer = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = YBOCS_QUESTIONS[currentIndex];
  const progress = ((currentIndex + 1) / YBOCS_QUESTIONS.length) * 100;
  const currentOption = currentQuestion.options[sliderValue];

  useEffect(() => {
    // Track question view
    if (userId && currentQuestion) {
      trackAIInteraction(AIEventType.YBOCS_QUESTION_VIEWED, {
        userId,
        questionId: currentQuestion.id,
        questionIndex: currentIndex,
      });
    }
    
    // Reset for new question
    setHasInteracted(false);
    setSliderValue(2); // Reset to middle
  }, [currentIndex]);

  // Auto-progress after user interacts with slider
  useEffect(() => {
    if (hasInteracted) {
      // Clear any existing timer
      if (autoProgressTimer.current) {
        clearTimeout(autoProgressTimer.current as unknown as number);
      }
      
      // Set new timer for auto-progress
      autoProgressTimer.current = setTimeout(() => {
        handleNext();
      }, 1500); // 1.5 seconds after interaction
      
      return () => {
        if (autoProgressTimer.current) {
          clearTimeout(autoProgressTimer.current as unknown as number);
        }
      };
    }
  }, [hasInteracted, sliderValue]);

  const handleSliderChange = (value: number) => {
    setSliderValue(Math.round(value));
    setHasInteracted(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    // Clear timer
    if (autoProgressTimer.current) {
      clearTimeout(autoProgressTimer.current as unknown as number);
    }

    // Save answer
    const answer: YBOCSAnswer = {
      questionId: currentQuestion.id,
      value: sliderValue,
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
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePrevious = () => {
    if (currentIndex === 0) return;

    // Clear timer
    if (autoProgressTimer.current) {
      clearTimeout(autoProgressTimer.current as unknown as number);
    }

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
      if (prevAnswer) {
        setSliderValue(Number((prevAnswer as any).value ?? 0));
        setAnswers(answers.slice(0, -1));
      }
    });
  };

  const getSeverityColor = (value: number): string => {
    if (value === 0) return COLORS.success;
    if (value === 1) return COLORS.mild;
    if (value === 2) return COLORS.moderate;
    if (value === 3) return COLORS.severe;
    return COLORS.extreme;
  };

  const getSeverityEmoji = (value: number): string => {
    if (value === 0) return '😊';
    if (value === 1) return '🙂';
    if (value === 2) return '😐';
    if (value === 3) return '😟';
    return '😰';
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

        {/* Single Slider Input - THE ONLY ACTION */}
        <View style={styles.sliderContainer}>
          {/* Current Value Display */}
          <View style={styles.valueDisplay}>
            <Text style={styles.valueEmoji}>{getSeverityEmoji(sliderValue)}</Text>
            <Text style={[styles.valueLabel, { color: getSeverityColor(sliderValue) }]}>
              {currentOption.label}
            </Text>
            <Text style={styles.valueDescription}>{currentOption.description}</Text>
          </View>

          {/* Slider */}
          <View style={styles.sliderWrapper}>
            <Slider
              value={sliderValue}
              onValueChange={handleSliderChange}
              minimumValue={0}
              maximumValue={4}
              step={1}
              minimumTrackTintColor={getSeverityColor(sliderValue)}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={getSeverityColor(sliderValue)}
              style={styles.slider}
            />
            
            {/* Slider Labels */}
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelMin}>Hiç</Text>
              <Text style={styles.sliderLabelMax}>Aşırı</Text>
            </View>
          </View>

          {/* Auto-progress indicator */}
          {hasInteracted && (
            <Animated.View style={styles.autoProgressIndicator}>
              <Text style={styles.autoProgressText}>
                Otomatik ilerleme...
              </Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>

      {/* Minimal Navigation - Only Back Button */}
      {currentIndex > 0 && (
        <TouchableOpacity 
          onPress={handlePrevious} 
          style={[styles.backButton, { bottom: Math.max(40, insets.bottom + 12) }]}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
      )}

      {/* Manual Continue (Hidden by default, shown only if needed) */}
      {currentIndex === YBOCS_QUESTIONS.length - 1 && hasInteracted && (
        <View style={[styles.completeContainer, { bottom: Math.max(100, insets.bottom + 60) }]}>
          <Button
            title="Değerlendirmeyi Tamamla"
            onPress={handleNext}
            style={styles.completeButton}
          />
        </View>
      )}
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
    marginTop: 32,
    marginBottom: 48,
    alignItems: 'center',
  },
  questionText: {
    fontSize: 26,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 12,
    lineHeight: 34,
    textAlign: 'center',
  },
  questionDescription: {
    fontSize: 16,
    color: COLORS.secondaryText,
    lineHeight: 22,
    textAlign: 'center',
  },
  sliderContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  valueDisplay: {
    alignItems: 'center',
    marginBottom: 48,
  },
  valueEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  valueLabel: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  valueDescription: {
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  sliderWrapper: {
    paddingHorizontal: 20,
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  sliderLabelMin: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  sliderLabelMax: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  autoProgressIndicator: {
    alignItems: 'center',
    marginTop: 32,
  },
  autoProgressText: {
    fontSize: 14,
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  backButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    padding: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  completeContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
});

export default YBOCSAssessmentV2;