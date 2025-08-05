/**
 * AI Destekli Onboarding Akışı UI Komponenti
 * 
 * KRITIK: Feature flag kontrolü ile progressive enhancement
 * Mevcut onboarding'e zarar vermeden AI özellikleri ekler
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { aiOnboardingService } from '@/features/ai/services/aiOnboarding';
import { onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Props {
  userId: string;
  onComplete: (analysis: any) => void;
  onSkip?: () => void;
}

export const AIOnboardingFlow: React.FC<Props> = ({
  userId,
  onComplete,
  onSkip
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [openEndedResponse, setOpenEndedResponse] = useState('');
  const [session, setSession] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Feature flag kontrolü
  const isAIEnabled = FEATURE_FLAGS.isEnabled('AI_ONBOARDING');

  useEffect(() => {
    startOnboarding();
  }, []);

  const startOnboarding = async () => {
    try {
      setIsLoading(true);
      const newSession = await aiOnboardingService.startSession(userId);
      setSession(newSession);
      
      // İlk soruyu al
      const { question, aiEnhancement } = await aiOnboardingService.getNextQuestion();
      setCurrentQuestion({ question, aiEnhancement });
      setProgress(0);
    } catch (error) {
      console.error('[AIOnboarding] Start failed:', error);
      Alert.alert(
        'Hata',
        'Onboarding başlatılamadı. Lütfen tekrar deneyin.',
        [{ text: 'Tamam', onPress: onSkip }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (selectedValue === null) {
      Alert.alert('Uyarı', 'Lütfen bir seçenek seçin.');
      return;
    }

    setIsProcessing(true);

    try {
      const result = await aiOnboardingService.submitAnswer(
        currentQuestion.question.id,
        selectedValue,
        openEndedResponse
      );

      if (result.clarificationNeeded && result.aiFollowUp) {
        // AI takip sorusu göster
        Alert.alert(
          'Biraz daha detay',
          result.aiFollowUp,
          [{ text: 'Tamam' }]
        );
        setIsProcessing(false);
        return;
      }

      // Sonraki soruya geç
      const { question, aiEnhancement } = await aiOnboardingService.getNextQuestion();
      
      if (!question) {
        // Onboarding tamamlandı
        completeOnboarding();
      } else {
        setCurrentQuestion({ question, aiEnhancement });
        setSelectedValue(null);
        setOpenEndedResponse('');
        updateProgress();
      }
    } catch (error) {
      console.error('[AIOnboarding] Answer submission failed:', error);
      Alert.alert('Hata', 'Cevap gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsProcessing(false);
    }
  };

  const completeOnboarding = async () => {
    setIsLoading(true);

    try {
      // Y-BOCS sonuçlarını al
      const severity = await aiOnboardingService.completeSession();
      
      // AI analizi yap
      let analysis;
      if (isAIEnabled && session) {
        analysis = await onboardingEngine.analyzeResponses(
          session.answers,
          severity,
          userId
        );
      } else {
        analysis = { severity };
      }

      // Tamamlandı callback'i
      onComplete(analysis);
    } catch (error) {
      console.error('[AIOnboarding] Completion failed:', error);
      Alert.alert(
        'Hata',
        'Değerlendirme tamamlanamadı.',
        [{ text: 'Tamam', onPress: onSkip }]
      );
    }
  };

  const updateProgress = () => {
    if (!session) return;
    const totalQuestions = 10; // Y-BOCS soru sayısı
    const answeredQuestions = session.answers?.length || 0;
    setProgress((answeredQuestions / totalQuestions) * 100);
  };

  const renderOption = (option: any) => {
    const isSelected = selectedValue === option.value;
    
    return (
      <Pressable
        key={option.value}
        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
        onPress={() => setSelectedValue(option.value)}
      >
        <View style={styles.optionContent}>
          <View style={[styles.radio, isSelected && styles.radioSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
            {option.label}
          </Text>
        </View>
        <Text style={styles.optionValue}>{option.value}</Text>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Atla</Text>
        </Pressable>
        <Text style={styles.headerTitle}>OKB Değerlendirmesi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ProgressBar progress={progress} style={styles.progressBar} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.questionCard}>
          <Text style={styles.questionNumber}>
            Soru {(session?.currentQuestionIndex || 0) + 1} / 10
          </Text>
          
          <Text style={styles.questionText}>
            {currentQuestion.aiEnhancement?.enhancedPrompt || 
             currentQuestion.question.text}
          </Text>

          {/* AI örnekleri */}
          {isAIEnabled && currentQuestion.aiEnhancement?.examples.length > 0 && (
            <View style={styles.examplesContainer}>
              <Text style={styles.examplesTitle}>Örnekler:</Text>
              {currentQuestion.aiEnhancement.examples.map((example, index) => (
                <Text key={index} style={styles.exampleText}>• {example}</Text>
              ))}
            </View>
          )}
        </Card>

        {/* Seçenekler */}
        <View style={styles.optionsContainer}>
          {currentQuestion.question.options.map(renderOption)}
        </View>

        {/* AI destekli açık uçlu yanıt */}
        {isAIEnabled && (
          <Card style={styles.openEndedCard}>
            <Text style={styles.openEndedTitle}>
              Daha fazla detay vermek ister misiniz? (İsteğe bağlı)
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Deneyiminizi kendi kelimelerinizle anlatabilirsiniz..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={openEndedResponse}
              onChangeText={setOpenEndedResponse}
              textAlignVertical="top"
            />
            {currentQuestion.aiEnhancement?.clarificationHints && (
              <View style={styles.hintsContainer}>
                {currentQuestion.aiEnhancement.clarificationHints.map((hint, index) => (
                  <Text key={index} style={styles.hintText}>💡 {hint}</Text>
                ))}
              </View>
            )}
          </Card>
        )}

        <Button
          onPress={handleAnswer}
          disabled={selectedValue === null || isProcessing}
          loading={isProcessing}
          style={styles.continueButton}
        >
          {isProcessing ? 'İşleniyor...' : 'Devam Et'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  progressBar: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionCard: {
    marginBottom: 24,
    padding: 20,
  },
  questionNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 26,
  },
  examplesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    paddingLeft: 8,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  optionButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#10B981',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#065F46',
    fontWeight: '500',
  },
  optionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 12,
  },
  openEndedCard: {
    marginBottom: 24,
    padding: 20,
  },
  openEndedTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  hintsContainer: {
    marginTop: 12,
  },
  hintText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  continueButton: {
    marginBottom: 32,
  },
}); 