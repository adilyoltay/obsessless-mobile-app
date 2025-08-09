/**
 * 🧭 Progressive AI Onboarding Flow V3 - Master Prompt İlkeleri
 * 
 * Anayasa v2.0 Master Prompt ilkelerine tam uyumlu tasarım:
 * 
 * ✅ "Sakinlik Her Şeyden Önce Gelir" 
 *    - Tek card tasarım, minimal görsel karmaşa
 *    - Yumuşak geçişler ve sakin renkler
 *    - Acele ettirmeyen, rahatlatıcı arayüz
 * 
 * ✅ "Güç Kullanıcıdadır"
 *    - Kullanıcı kontrolünde ilerleme (otomatik değil)
 *    - Her adımda geri dönebilme
 *    - Skip ve özelleştirme seçenekleri
 * 
 * ✅ "Zahmetsizlik Esastır"
 *    - Tek buton ile ilerleme
 *    - Minimum bilişsel yük
 *    - Net ve anlaşılır adımlar
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';

// UI Components
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Types
import {
  YBOCSAnswer,
  UserProfile,
  TreatmentPlan,
  CulturalContext,
} from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Anayasa v2.0 Renk Paleti
const COLORS = {
  background: '#F9FAFB',
  cardBackground: '#FFFFFF',
  primary: '#10B981',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingFlowV3Props {
  onComplete: (userProfile: UserProfile, treatmentPlan: TreatmentPlan) => void;
  onExit: () => void;
  userId: string;
  resumeSession?: boolean;
}

// Adım tipleri - Master Prompt'a uygun sıralama
enum OnboardingStep {
  WELCOME = 'welcome',
  CONSENT = 'consent',
  YBOCS_INTRO = 'ybocs_intro',
  YBOCS_QUESTIONS = 'ybocs_questions',
  PROFILE_NAME = 'profile_name',
  PROFILE_CULTURE = 'profile_culture',
  PROFILE_GOALS = 'profile_goals',
  TREATMENT_PLAN = 'treatment_plan',
  SAFETY_PLAN = 'safety_plan',
  COMPLETION = 'completion',
}

// Y-BOCS Soruları
const YBOCS_QUESTIONS = [
  {
    id: 'obsessions_time',
    text: 'Obsesif düşünceler günde ne kadar vaktinizi alıyor?',
    category: 'obsessions',
  },
  {
    id: 'obsessions_interference',
    text: 'Obsesif düşünceler günlük yaşamınızı ne kadar etkiliyor?',
    category: 'obsessions',
  },
  {
    id: 'obsessions_distress',
    text: 'Obsesif düşünceler size ne kadar sıkıntı veriyor?',
    category: 'obsessions',
  },
  {
    id: 'compulsions_time',
    text: 'Kompulsiyonlar günde ne kadar vaktinizi alıyor?',
    category: 'compulsions',
  },
  {
    id: 'compulsions_interference',
    text: 'Kompulsiyonlar günlük yaşamınızı ne kadar etkiliyor?',
    category: 'compulsions',
  },
];

// Tedavi hedefleri
const TREATMENT_GOALS = [
  { id: 'reduce_anxiety', label: 'Kaygıyı Azaltmak', emoji: '😌' },
  { id: 'control_compulsions', label: 'Kompulsiyonları Kontrol Etmek', emoji: '💪' },
  { id: 'improve_daily_life', label: 'Günlük Yaşamı İyileştirmek', emoji: '🌟' },
  { id: 'better_relationships', label: 'İlişkileri Güçlendirmek', emoji: '❤️' },
  { id: 'increase_functionality', label: 'İşlevselliği Artırmak', emoji: '🎯' },
  { id: 'emotional_regulation', label: 'Duygu Düzenleme', emoji: '🧘' },
];

export const OnboardingFlowV3: React.FC<OnboardingFlowV3Props> = ({
  onComplete,
  onExit,
  userId,
  resumeSession = false,
}) => {
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
  const [ybocsAnswers, setYbocsAnswers] = useState<YBOCSAnswer[]>([]);
  const [currentYbocsIndex, setCurrentYbocsIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [userName, setUserName] = useState('');
  const [culturalContext, setCulturalContext] = useState<CulturalContext>({
    language: 'tr',
    religiousConsiderations: false,
    familyInvolvement: 'none',
    culturalFactors: [],
  });
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Session kaydetme
  useEffect(() => {
    if (currentStep !== OnboardingStep.WELCOME) {
      saveSession();
    }
  }, [currentStep, ybocsAnswers, userName, culturalContext, selectedGoals]);

  // Session yükleme
  useEffect(() => {
    if (resumeSession) {
      loadSession();
    }
  }, [resumeSession]);

  const saveSession = async () => {
    try {
      const sessionData = {
        currentStep,
        ybocsAnswers,
        currentYbocsIndex,
        userName,
        culturalContext,
        selectedGoals,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(
        `onboarding_session_${userId}`,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Session kaydetme hatası:', error);
    }
  };

  const loadSession = async () => {
    try {
      const saved = await AsyncStorage.getItem(`onboarding_session_${userId}`);
      if (saved) {
        const sessionData = JSON.parse(saved);
        setCurrentStep(sessionData.currentStep);
        setYbocsAnswers(sessionData.ybocsAnswers || []);
        setCurrentYbocsIndex(sessionData.currentYbocsIndex || 0);
        setUserName(sessionData.userName || '');
        setCulturalContext(sessionData.culturalContext || {
          language: 'tr',
          religiousConsiderations: false,
          familyInvolvement: 'none',
          culturalFactors: [],
        });
        setSelectedGoals(sessionData.selectedGoals || []);
      }
    } catch (error) {
      console.error('Session yükleme hatası:', error);
    }
  };

  // Adım geçiş animasyonu
  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  };

  // İleri gitme
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    animateTransition(() => {
      switch (currentStep) {
        case OnboardingStep.WELCOME:
          setCurrentStep(OnboardingStep.CONSENT);
          break;
        case OnboardingStep.CONSENT:
          setCurrentStep(OnboardingStep.YBOCS_INTRO);
          break;
        case OnboardingStep.YBOCS_INTRO:
          setCurrentStep(OnboardingStep.YBOCS_QUESTIONS);
          break;
        case OnboardingStep.YBOCS_QUESTIONS:
          if (currentYbocsIndex < YBOCS_QUESTIONS.length - 1) {
            // Y-BOCS cevabını kaydet
            const answer: YBOCSAnswer = {
              questionId: YBOCS_QUESTIONS[currentYbocsIndex].id,
              score: Math.round(sliderValue),
              category: YBOCS_QUESTIONS[currentYbocsIndex].category as 'obsessions' | 'compulsions',
            };
            setYbocsAnswers([...ybocsAnswers, answer]);
            setCurrentYbocsIndex(currentYbocsIndex + 1);
            setSliderValue(0);
          } else {
            // Son Y-BOCS cevabını kaydet ve profile geç
            const answer: YBOCSAnswer = {
              questionId: YBOCS_QUESTIONS[currentYbocsIndex].id,
              score: Math.round(sliderValue),
              category: YBOCS_QUESTIONS[currentYbocsIndex].category as 'obsessions' | 'compulsions',
            };
            setYbocsAnswers([...ybocsAnswers, answer]);
            setCurrentStep(OnboardingStep.PROFILE_NAME);
            setSliderValue(0);
          }
          break;
        case OnboardingStep.PROFILE_NAME:
          if (userName.trim()) {
            setCurrentStep(OnboardingStep.PROFILE_CULTURE);
          }
          break;
        case OnboardingStep.PROFILE_CULTURE:
          setCurrentStep(OnboardingStep.PROFILE_GOALS);
          break;
        case OnboardingStep.PROFILE_GOALS:
          if (selectedGoals.length > 0) {
            generateTreatmentPlan();
          }
          break;
        case OnboardingStep.TREATMENT_PLAN:
          setCurrentStep(OnboardingStep.SAFETY_PLAN);
          break;
        case OnboardingStep.SAFETY_PLAN:
          setCurrentStep(OnboardingStep.COMPLETION);
          break;
        case OnboardingStep.COMPLETION:
          completeOnboarding();
          break;
      }
    });
  };

  // Geri gitme
  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    animateTransition(() => {
      switch (currentStep) {
        case OnboardingStep.CONSENT:
          setCurrentStep(OnboardingStep.WELCOME);
          break;
        case OnboardingStep.YBOCS_INTRO:
          setCurrentStep(OnboardingStep.CONSENT);
          break;
        case OnboardingStep.YBOCS_QUESTIONS:
          if (currentYbocsIndex > 0) {
            setCurrentYbocsIndex(currentYbocsIndex - 1);
            const prevAnswers = [...ybocsAnswers];
            prevAnswers.pop();
            setYbocsAnswers(prevAnswers);
          } else {
            setCurrentStep(OnboardingStep.YBOCS_INTRO);
          }
          break;
        case OnboardingStep.PROFILE_NAME:
          setCurrentStep(OnboardingStep.YBOCS_QUESTIONS);
          setCurrentYbocsIndex(YBOCS_QUESTIONS.length - 1);
          break;
        case OnboardingStep.PROFILE_CULTURE:
          setCurrentStep(OnboardingStep.PROFILE_NAME);
          break;
        case OnboardingStep.PROFILE_GOALS:
          setCurrentStep(OnboardingStep.PROFILE_CULTURE);
          break;
        case OnboardingStep.TREATMENT_PLAN:
          setCurrentStep(OnboardingStep.PROFILE_GOALS);
          break;
        case OnboardingStep.SAFETY_PLAN:
          setCurrentStep(OnboardingStep.TREATMENT_PLAN);
          break;
        case OnboardingStep.COMPLETION:
          setCurrentStep(OnboardingStep.SAFETY_PLAN);
          break;
      }
    });
  };

  // Tedavi planı oluştur
  const generateTreatmentPlan = async () => {
    setIsLoading(true);
    
    // Telemetry
    trackAIInteraction({
      eventType: AIEventType.TREATMENT_PLAN_GENERATED,
      userId,
      metadata: {
        ybocsScore: calculateYBOCSScore(),
        goals: selectedGoals,
      },
    });

    // Mock tedavi planı (gerçekte AI'dan gelecek)
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep(OnboardingStep.TREATMENT_PLAN);
    }, 1500);
  };

  // Y-BOCS skoru hesapla
  const calculateYBOCSScore = () => {
    return ybocsAnswers.reduce((sum, answer) => sum + answer.score, 0);
  };

  // Onboarding tamamlama
  const completeOnboarding = async () => {
    const userProfile: UserProfile = {
      id: userId,
      name: userName,
      culturalContext,
      therapeuticGoals: selectedGoals,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const treatmentPlan: TreatmentPlan = {
      id: `plan_${userId}`,
      userId,
      ybocsScore: calculateYBOCSScore(),
      primaryGoals: selectedGoals.slice(0, 3),
      interventions: [],
      weeklySchedule: {},
      progressMetrics: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Session temizle
    await AsyncStorage.removeItem(`onboarding_session_${userId}`);

    // Tamamlama callback
    onComplete(userProfile, treatmentPlan);
  };

  // Progress hesaplama
  const getProgress = () => {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  // Slider renk hesaplama
  const getSliderColor = (value: number) => {
    if (value < 2) return COLORS.success;
    if (value < 3) return COLORS.warning;
    return COLORS.error;
  };

  // Step içeriğini render et
  const renderStepContent = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="hand-wave" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>ObsessLess'e Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>
              OKB yolculuğunuzda yanınızdayız
            </Text>
            <Text style={styles.description}>
              Size özel bir destek planı oluşturmak için birkaç kısa adımda 
              sizi tanımak istiyoruz. Bu süreç yaklaşık 10 dakika sürecek.
            </Text>
          </View>
        );

      case OnboardingStep.CONSENT:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="shield-check" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Gizlilik ve Güvenlik</Text>
            <ScrollView style={styles.consentScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.consentText}>
                {'\n'}🔒 <Text style={styles.bold}>Verileriniz Güvende</Text>
                {'\n'}Tüm bilgileriniz şifrelenerek saklanır ve asla üçüncü taraflarla paylaşılmaz.
                
                {'\n\n'}🤖 <Text style={styles.bold}>AI Destekli Kişiselleştirme</Text>
                {'\n'}Yapay zeka, size özel tedavi önerileri sunmak için verilerinizi analiz eder.
                
                {'\n\n'}🌍 <Text style={styles.bold}>Kültürel Duyarlılık</Text>
                {'\n'}Türk kültürüne uygun, dini ve ailevi değerleri gözeten bir yaklaşım sunarız.
                
                {'\n\n'}✅ <Text style={styles.bold}>Kanıta Dayalı Yöntemler</Text>
                {'\n'}Bilişsel Davranışçı Terapi ve Maruz Bırakma teknikleri kullanılır.
                
                {'\n\n'}Devam ederek, gizlilik politikamızı ve kullanım koşullarımızı kabul etmiş olursunuz.
              </Text>
            </ScrollView>
          </View>
        );

      case OnboardingStep.YBOCS_INTRO:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="clipboard-check" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>OKB Değerlendirmesi</Text>
            <Text style={styles.subtitle}>Y-BOCS Ölçeği</Text>
            <Text style={styles.description}>
              Şimdi size OKB belirtilerinizin şiddetini anlamak için 
              5 kısa soru soracağız. Her soruyu 0-4 arasında değerlendireceksiniz.
              {'\n\n'}
              <Text style={styles.bold}>0 = Hiç</Text> • <Text style={styles.bold}>4 = Aşırı derecede</Text>
            </Text>
          </View>
        );

      case OnboardingStep.YBOCS_QUESTIONS:
        const currentQuestion = YBOCS_QUESTIONS[currentYbocsIndex];
        return (
          <View style={styles.contentContainer}>
            <Text style={styles.questionNumber}>
              Soru {currentYbocsIndex + 1} / {YBOCS_QUESTIONS.length}
            </Text>
            <Text style={styles.questionText}>
              {currentQuestion.text}
            </Text>
            
            <View style={styles.sliderContainer}>
              <View style={styles.sliderValueContainer}>
                <Text style={[styles.sliderValue, { color: getSliderColor(sliderValue) }]}>
                  {Math.round(sliderValue)}
                </Text>
                <Text style={styles.sliderLabel}>
                  {sliderValue === 0 ? 'Hiç' :
                   sliderValue === 1 ? 'Hafif' :
                   sliderValue === 2 ? 'Orta' :
                   sliderValue === 3 ? 'Şiddetli' : 'Aşırı'}
                </Text>
              </View>
              
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
                minimumTrackTintColor={getSliderColor(sliderValue)}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor={getSliderColor(sliderValue)}
              />
              
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelText}>0</Text>
                <Text style={styles.sliderLabelText}>1</Text>
                <Text style={styles.sliderLabelText}>2</Text>
                <Text style={styles.sliderLabelText}>3</Text>
                <Text style={styles.sliderLabelText}>4</Text>
              </View>
            </View>
          </View>
        );

      case OnboardingStep.PROFILE_NAME:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="account" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Sizi Tanıyalım</Text>
            <Text style={styles.subtitle}>Size nasıl hitap edelim?</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Adınız"
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
            />
            
            <Text style={styles.hint}>
              Bu isim uygulama içinde size hitap etmek için kullanılacak
            </Text>
          </View>
        );

      case OnboardingStep.PROFILE_CULTURE:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="earth" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Kültürel Tercihler</Text>
            <Text style={styles.subtitle}>Size daha iyi destek olabilmemiz için</Text>
            
            <TouchableOpacity
              style={[
                styles.optionCard,
                culturalContext.religiousConsiderations && styles.optionCardSelected
              ]}
              onPress={() => setCulturalContext({
                ...culturalContext,
                religiousConsiderations: !culturalContext.religiousConsiderations
              })}
            >
              <MaterialCommunityIcons 
                name={culturalContext.religiousConsiderations ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24} 
                color={culturalContext.religiousConsiderations ? COLORS.primary : COLORS.secondaryText} 
              />
              <Text style={styles.optionText}>Dini hassasiyetlerimi göz önünde bulundur</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.optionCard,
                culturalContext.familyInvolvement === 'supportive' && styles.optionCardSelected
              ]}
              onPress={() => setCulturalContext({
                ...culturalContext,
                familyInvolvement: culturalContext.familyInvolvement === 'supportive' ? 'none' : 'supportive'
              })}
            >
              <MaterialCommunityIcons 
                name={culturalContext.familyInvolvement === 'supportive' ? "checkbox-marked" : "checkbox-blank-outline"}
                size={24} 
                color={culturalContext.familyInvolvement === 'supportive' ? COLORS.primary : COLORS.secondaryText} 
              />
              <Text style={styles.optionText}>Ailem tedavi sürecimde destekçi</Text>
            </TouchableOpacity>
          </View>
        );

      case OnboardingStep.PROFILE_GOALS:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="target" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Hedefleriniz</Text>
            <Text style={styles.subtitle}>En fazla 3 hedef seçin</Text>
            
            <ScrollView style={styles.goalsScroll} showsVerticalScrollIndicator={false}>
              {TREATMENT_GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[
                    styles.goalCard,
                    selectedGoals.includes(goal.id) && styles.goalCardSelected
                  ]}
                  onPress={() => {
                    if (selectedGoals.includes(goal.id)) {
                      setSelectedGoals(selectedGoals.filter(g => g !== goal.id));
                    } else if (selectedGoals.length < 3) {
                      setSelectedGoals([...selectedGoals, goal.id]);
                    }
                  }}
                  disabled={!selectedGoals.includes(goal.id) && selectedGoals.length >= 3}
                >
                  <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                  <Text style={[
                    styles.goalText,
                    selectedGoals.includes(goal.id) && styles.goalTextSelected
                  ]}>
                    {goal.label}
                  </Text>
                  {selectedGoals.includes(goal.id) && (
                    <MaterialCommunityIcons 
                      name="check-circle" 
                      size={20} 
                      color={COLORS.primary} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case OnboardingStep.TREATMENT_PLAN:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="clipboard-text" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Tedavi Planınız Hazır</Text>
            <Text style={styles.subtitle}>
              Y-BOCS Skorunuz: {calculateYBOCSScore()}
            </Text>
            
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>📅 4 Haftalık Program</Text>
              <Text style={styles.planText}>
                • Hafta 1-2: Temel ERP teknikleri{'\n'}
                • Hafta 3-4: İleri düzey müdahaleler
              </Text>
            </View>
            
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>🎯 Ana Hedefleriniz</Text>
              {selectedGoals.slice(0, 3).map((goalId) => {
                const goal = TREATMENT_GOALS.find(g => g.id === goalId);
                return (
                  <Text key={goalId} style={styles.planText}>
                    {goal?.emoji} {goal?.label}
                  </Text>
                );
              })}
            </View>
          </View>
        );

      case OnboardingStep.SAFETY_PLAN:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="lifebuoy" 
                size={80} 
                color={COLORS.primary} 
              />
            </View>
            <Text style={styles.title}>Güvenlik Planı</Text>
            <Text style={styles.subtitle}>Zor anlarda yanınızdayız</Text>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="phone" size={24} color={COLORS.primary} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Acil Durum Hattı</Text>
                <Text style={styles.safetyText}>182 - Psikolojik Destek</Text>
              </View>
            </View>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="alert" size={24} color={COLORS.warning} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Kriz Anında</Text>
                <Text style={styles.safetyText}>Uygulama içi SOS butonu kullanılabilir</Text>
              </View>
            </View>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="heart" size={24} color={COLORS.error} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Öz-Bakım</Text>
                <Text style={styles.safetyText}>Günlük nefes egzersizleri önerilir</Text>
              </View>
            </View>
          </View>
        );

      case OnboardingStep.COMPLETION:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="check-circle" 
                size={80} 
                color={COLORS.success} 
              />
            </View>
            <Text style={styles.title}>Tebrikler {userName}! 🎉</Text>
            <Text style={styles.subtitle}>
              Kişisel destek sisteminiz hazır
            </Text>
            <Text style={styles.description}>
              ObsessLess artık size özel çalışmaya başlayacak. 
              Her gün küçük adımlarla, birlikte ilerleyeceğiz.
              {'\n\n'}
              Unutmayın, bu bir maraton değil. Kendi hızınızda, 
              kendinize şefkatle yaklaşarak ilerleyin.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  // İleri butonu etkin mi?
  const isNextEnabled = () => {
    switch (currentStep) {
      case OnboardingStep.PROFILE_NAME:
        return userName.trim().length > 0;
      case OnboardingStep.PROFILE_GOALS:
        return selectedGoals.length > 0;
      default:
        return true;
    }
  };

  // Buton metni
  const getButtonText = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return 'Başlayalım';
      case OnboardingStep.CONSENT:
        return 'Kabul Ediyorum';
      case OnboardingStep.YBOCS_INTRO:
        return 'Değerlendirmeye Başla';
      case OnboardingStep.YBOCS_QUESTIONS:
        return currentYbocsIndex < YBOCS_QUESTIONS.length - 1 ? 'Sonraki Soru' : 'Devam Et';
      case OnboardingStep.PROFILE_NAME:
        return 'Devam Et';
      case OnboardingStep.PROFILE_CULTURE:
        return 'Devam Et';
      case OnboardingStep.PROFILE_GOALS:
        return isLoading ? 'Plan Oluşturuluyor...' : 'Planı Oluştur';
      case OnboardingStep.TREATMENT_PLAN:
        return 'Devam Et';
      case OnboardingStep.SAFETY_PLAN:
        return 'Anladım';
      case OnboardingStep.COMPLETION:
        return 'Uygulamaya Başla';
      default:
        return 'Devam Et';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentStep !== OnboardingStep.WELCOME && (
            <TouchableOpacity 
              onPress={handleBack}
              style={styles.backButton}
            >
              <MaterialCommunityIcons 
                name="arrow-left" 
                size={24} 
                color={COLORS.primaryText} 
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            onPress={onExit}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill,
                { width: `${getProgress()}%` }
              ]}
            />
          </View>
        </View>

        {/* Main Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
            },
          ]}
        >
          <Card style={styles.card}>
            {renderStepContent()}
            
            {/* Action Button */}
            <View style={styles.actionContainer}>
              <Button
                title={getButtonText()}
                onPress={handleNext}
                disabled={!isNextEnabled() || isLoading}
                loading={isLoading}
                style={styles.actionButton}
              />
            </View>
          </Card>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  backButton: {
    padding: 8,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: COLORS.secondaryText,
    fontSize: 16,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  cardContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    flex: 1,
    padding: 24,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primaryText,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  bold: {
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  consentScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
    marginTop: 16,
  },
  consentText: {
    fontSize: 15,
    color: COLORS.secondaryText,
    lineHeight: 22,
  },
  questionNumber: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 26,
  },
  sliderContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sliderValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  sliderLabel: {
    fontSize: 16,
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 12,
    color: COLORS.secondaryText,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: COLORS.primaryText,
    marginTop: 24,
    backgroundColor: COLORS.background,
  },
  hint: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 8,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: COLORS.cardBackground,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.primaryText,
    marginLeft: 12,
  },
  goalsScroll: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.35,
    marginTop: 16,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.cardBackground,
  },
  goalCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  goalEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  goalText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.primaryText,
  },
  goalTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  planCard: {
    width: '100%',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginTop: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  planText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    lineHeight: 20,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginTop: 12,
  },
  safetyTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  safetyText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  actionContainer: {
    marginTop: 24,
  },
  actionButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
  },
});

export default OnboardingFlowV3;
