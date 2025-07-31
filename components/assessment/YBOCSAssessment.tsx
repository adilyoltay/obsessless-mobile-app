import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { Slider } from '@/components/ui/Slider';
import Button from '@/components/ui/Button';
import { useTranslation } from '../../hooks/useTranslation';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface YBOCSQuestion {
  id: string;
  category: 'obsession' | 'compulsion';
  question: string;
  labels: string[];
}

// Master Prompt: 10 soruluk Y-BOCS Lite - Her soru ayrı sayfa, Slider ile
const YBOCS_QUESTIONS: YBOCSQuestion[] = [
  {
    id: 'obs_time',
    category: 'obsession',
    question: 'Obsesyonlar ne kadar vaktinizi alıyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'obs_interference',
    category: 'obsession',
    question: 'Obsesyonlar sosyal ve iş hayatınızı ne kadar etkiliyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'obs_distress',
    category: 'obsession',
    question: 'Obsesyonlar ne kadar sıkıntı veriyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'obs_resistance',
    category: 'obsession',
    question: 'Obsesyonlara ne kadar direnebiliyorsunuz?',
    labels: ['Her zaman', 'Çok', 'Orta', 'Az', 'Hiç'],
  },
  {
    id: 'obs_control',
    category: 'obsession',
    question: 'Obsesyonlarınız üzerinde ne kadar kontrolünüz var?',
    labels: ['Tam', 'Çok', 'Orta', 'Az', 'Hiç'],
  },
  {
    id: 'comp_time',
    category: 'compulsion',
    question: 'Kompulsiyonlar ne kadar vaktinizi alıyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'comp_interference',
    category: 'compulsion',
    question: 'Kompulsiyonlar sosyal ve iş hayatınızı ne kadar etkiliyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'comp_distress',
    category: 'compulsion',
    question: 'Kompulsiyonlar ne kadar sıkıntı veriyor?',
    labels: ['Hiç', 'Hafif', 'Orta', 'Şiddetli', 'Aşırı'],
  },
  {
    id: 'comp_resistance',
    category: 'compulsion',
    question: 'Kompulsiyonlara ne kadar direnebiliyorsunuz?',
    labels: ['Her zaman', 'Çok', 'Orta', 'Az', 'Hiç'],
  },
  {
    id: 'comp_control',
    category: 'compulsion',
    question: 'Kompulsiyonlarınız üzerinde ne kadar kontrolünüz var?',
    labels: ['Tam', 'Çok', 'Orta', 'Az', 'Hiç'],
  },
];

interface YBOCSAssessmentProps {
  onComplete?: (results: { totalScore: number; severity: string; answers: Record<string, number> }) => void;
}

export function YBOCSAssessment({ onComplete }: YBOCSAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sliderValue, setSliderValue] = useState(2); // Default middle value

  console.log('🧠 Y-BOCS Assessment render:', { currentQuestion, totalQuestions: YBOCS_QUESTIONS.length });

  const question = YBOCS_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / YBOCS_QUESTIONS.length) * 100;

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    Haptics.selectionAsync();
  };

  const handleNext = () => {
    const newAnswers = { ...answers, [question.id]: sliderValue };
    setAnswers(newAnswers);

    if (currentQuestion < YBOCS_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSliderValue(2); // Reset to middle for next question
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Calculate total score and severity
      const totalScore = Object.values(newAnswers).reduce((sum, value) => sum + value, 0);
      let severity = 'Hafif';
      if (totalScore >= 16) severity = 'Şiddetli';
      else if (totalScore >= 8) severity = 'Orta';

      onComplete?.({ totalScore, severity, answers: newAnswers });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevAnswer = answers[YBOCS_QUESTIONS[currentQuestion - 1].id];
      setSliderValue(prevAnswer || 2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {currentQuestion + 1} / {YBOCS_QUESTIONS.length}
        </Text>
      </View>

      {/* Question Card */}
      <View style={styles.questionCard}>
        <Text style={styles.categoryTag}>
          {question.category === 'obsession' ? 'Obsesyon' : 'Kompulsiyon'}
        </Text>
        
        <Text style={styles.questionText}>
          {question.question}
        </Text>

        {/* Slider Section */}
        <View style={styles.sliderContainer}>
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            minimumValue={0}
            maximumValue={4}
            step={1}
            style={styles.slider}
          />
          
          {/* Slider Labels */}
          <View style={styles.labelContainer}>
            <Text style={styles.labelText}>{question.labels[0]}</Text>
            <Text style={styles.labelText}>{question.labels[4]}</Text>
          </View>
          
          {/* Current Value */}
          <View style={styles.currentValueContainer}>
            <Text style={styles.currentValue}>
              {question.labels[sliderValue]}
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {currentQuestion > 0 && (
          <Button
            onPress={handlePrevious}
            variant="secondary"
            style={styles.previousButton}
          >
            <Text style={styles.buttonText}>Önceki</Text>
          </Button>
        )}
        
        <Button
          onPress={handleNext}
          style={{
            ...styles.nextButton,
            ...(currentQuestion === 0 ? styles.fullWidthButton : {})
          }}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            {currentQuestion === YBOCS_QUESTIONS.length - 1 ? 'Tamamla' : 'Devam'}
          </Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'space-between',
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981', // Master Prompt Primary Color
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280', // Master Prompt Secondary Text
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  questionCard: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  categoryTag: {
    fontSize: 12,
    color: '#F97316', // Master Prompt Accent Color
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 24,
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827', // Master Prompt Primary Text
    lineHeight: 32,
    marginBottom: 48,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  sliderContainer: {
    paddingHorizontal: 16,
  },
  slider: {
    height: 40,
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  labelText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  currentValueContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter-Medium',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  previousButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  fullWidthButton: {
    flex: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});