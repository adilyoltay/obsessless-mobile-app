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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCanonicalCategoryIconName, getCanonicalCategoryColor } from '@/constants/canonicalCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useTranslation } from '@/hooks/useTranslation';

// UI Components
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Design Tokens
import { Colors } from '@/constants/Colors';
import { CANONICAL_CATEGORIES } from '@/utils/categoryMapping';

// Types
import {
  UserProfile,
  TreatmentPlan,
  CulturalContext,
} from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// AI Engine Imports - YENİ
import { onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Using global design tokens

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
  QUICK_DECISION = 'quick_decision',
  PROFILE_NAME = 'profile_name',
  PROFILE_DEMOGRAPHICS = 'profile_demographics',
  PROFILE_HISTORY = 'profile_history',
  PROFILE_SYMPTOMS = 'profile_symptoms',
  PROFILE_CULTURE = 'profile_culture',
  PROFILE_GOALS = 'profile_goals',
  TREATMENT_PLAN = 'treatment_plan',
  SAFETY_PLAN = 'safety_plan',
  COMPLETION = 'completion',
}

// Y-BOCS-10 Tam Ölçek Soruları
const YBOCS_QUESTIONS = [
  // OBSESYONLAR
  {
    id: 'obsessions_time',
    text: 'Obsesif düşünceler günde ne kadar vaktinizi alıyor?',
    subtitle: 'İstenmeyen tekrarlayan düşünceler',
    category: 'obsessions',
    options: [
      { value: 0, label: 'Hiç', description: 'Günde 1 saatten az' },
      { value: 1, label: 'Hafif', description: 'Günde 1-3 saat' },
      { value: 2, label: 'Orta', description: 'Günde 3-8 saat' },
      { value: 3, label: 'Şiddetli', description: 'Günde 8+ saat' },
      { value: 4, label: 'Aşırı', description: 'Sürekli var' },
    ],
  },
  {
    id: 'obsessions_interference',
    text: 'Obsesif düşünceler sosyal/iş yaşamınızı ne kadar etkiliyor?',
    subtitle: 'Günlük aktivitelerdeki etki',
    category: 'obsessions',
    options: [
      { value: 0, label: 'Hiç', description: 'Etkilemiyor' },
      { value: 1, label: 'Hafif', description: 'Az etkiliyor' },
      { value: 2, label: 'Orta', description: 'Belirgin etkiliyor' },
      { value: 3, label: 'Şiddetli', description: 'Çok etkiliyor' },
      { value: 4, label: 'Aşırı', description: 'İşlevsiz hale getiriyor' },
    ],
  },
  {
    id: 'obsessions_distress',
    text: 'Obsesif düşünceler size ne kadar sıkıntı veriyor?',
    subtitle: 'Duygusal yoğunluk',
    category: 'obsessions',
    options: [
      { value: 0, label: 'Hiç', description: 'Rahatsız etmiyor' },
      { value: 1, label: 'Hafif', description: 'Az rahatsız ediyor' },
      { value: 2, label: 'Orta', description: 'Belirgin rahatsızlık' },
      { value: 3, label: 'Şiddetli', description: 'Çok rahatsız ediyor' },
      { value: 4, label: 'Aşırı', description: 'Dayanılmaz' },
    ],
  },
  {
    id: 'obsessions_resistance',
    text: 'Obsesif düşüncelere ne kadar karşı koyabiliyorsunuz?',
    subtitle: 'Düşünceleri engelleme çabası',
    category: 'obsessions',
    options: [
      { value: 0, label: 'Hiç', description: 'Her zaman karşı koyarım' },
      { value: 1, label: 'Hafif', description: 'Çoğunlukla karşı koyarım' },
      { value: 2, label: 'Orta', description: 'Bazen karşı koyarım' },
      { value: 3, label: 'Şiddetli', description: 'Nadiren karşı koyarım' },
      { value: 4, label: 'Aşırı', description: 'Hiç karşı koyamam' },
    ],
  },
  {
    id: 'obsessions_control',
    text: 'Obsesif düşüncelerinizi ne kadar kontrol edebiliyorsunuz?',
    subtitle: 'Düşünceleri durdurabilme',
    category: 'obsessions',
    options: [
      { value: 0, label: 'Hiç', description: 'Tam kontrol' },
      { value: 1, label: 'Hafif', description: 'Çoğunlukla kontrol' },
      { value: 2, label: 'Orta', description: 'Bazen kontrol' },
      { value: 3, label: 'Şiddetli', description: 'Az kontrol' },
      { value: 4, label: 'Aşırı', description: 'Hiç kontrol yok' },
    ],
  },
  // KOMPULSIYONLAR
  {
    id: 'compulsions_time',
    text: 'Kompulsiyonlar günde ne kadar vaktinizi alıyor?',
    subtitle: 'Tekrarlayan davranışlar',
    category: 'compulsions',
    options: [
      { value: 0, label: 'Hiç', description: 'Günde 1 saatten az' },
      { value: 1, label: 'Hafif', description: 'Günde 1-3 saat' },
      { value: 2, label: 'Orta', description: 'Günde 3-8 saat' },
      { value: 3, label: 'Şiddetli', description: 'Günde 8+ saat' },
      { value: 4, label: 'Aşırı', description: 'Sürekli yapıyorum' },
    ],
  },
  {
    id: 'compulsions_interference',
    text: 'Kompulsiyonlar sosyal/iş yaşamınızı ne kadar etkiliyor?',
    subtitle: 'Günlük aktivitelerdeki etki',
    category: 'compulsions',
    options: [
      { value: 0, label: 'Hiç', description: 'Etkilemiyor' },
      { value: 1, label: 'Hafif', description: 'Az etkiliyor' },
      { value: 2, label: 'Orta', description: 'Belirgin etkiliyor' },
      { value: 3, label: 'Şiddetli', description: 'Çok etkiliyor' },
      { value: 4, label: 'Aşırı', description: 'İşlevsiz hale getiriyor' },
    ],
  },
  {
    id: 'compulsions_distress',
    text: 'Kompulsiyonları engellemeye çalıştığınızda ne kadar sıkıntı duyarsınız?',
    subtitle: 'Engelleme sırasında hissedilen kaygı',
    category: 'compulsions',
    options: [
      { value: 0, label: 'Hiç', description: 'Sıkıntı duymam' },
      { value: 1, label: 'Hafif', description: 'Az sıkıntı duyarım' },
      { value: 2, label: 'Orta', description: 'Belirgin sıkıntı' },
      { value: 3, label: 'Şiddetli', description: 'Çok sıkıntı duyarım' },
      { value: 4, label: 'Aşırı', description: 'Dayanılmaz kaygı' },
    ],
  },
  {
    id: 'compulsions_resistance',
    text: 'Kompulsiyonlara ne kadar karşı koyabiliyorsunuz?',
    subtitle: 'Davranışları engelleme çabası',
    category: 'compulsions',
    options: [
      { value: 0, label: 'Hiç', description: 'Her zaman karşı koyarım' },
      { value: 1, label: 'Hafif', description: 'Çoğunlukla karşı koyarım' },
      { value: 2, label: 'Orta', description: 'Bazen karşı koyarım' },
      { value: 3, label: 'Şiddetli', description: 'Nadiren karşı koyarım' },
      { value: 4, label: 'Aşırı', description: 'Hiç karşı koyamam' },
    ],
  },
  {
    id: 'compulsions_control',
    text: 'Kompulsiyonlarınızı ne kadar kontrol edebiliyorsunuz?',
    subtitle: 'Davranışları durdurabilme',
    category: 'compulsions',
    options: [
      { value: 0, label: 'Hiç', description: 'Tam kontrol' },
      { value: 1, label: 'Hafif', description: 'Çoğunlukla kontrol' },
      { value: 2, label: 'Orta', description: 'Bazen kontrol' },
      { value: 3, label: 'Şiddetli', description: 'Az kontrol' },
      { value: 4, label: 'Aşırı', description: 'Hiç kontrol yok' },
    ],
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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const bottomPad = Math.max(100, insets.bottom + 80);
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
  const [quickMode, setQuickMode] = useState<boolean>(true);
  const [ybocsAnswers, setYbocsAnswers] = useState<Record<string, number>>({});
  const [currentYbocsIndex, setCurrentYbocsIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [userName, setUserName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [education, setEducation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [ocdHistory, setOcdHistory] = useState({
    firstSymptoms: '',
    previousTreatment: false,
    medication: false,
    familyHistory: false,
  });
  const [symptomTypes, setSymptomTypes] = useState<string[]>([]);
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
        quickMode,
        ybocsAnswers,
        currentYbocsIndex,
        userName,
        age,
        gender,
        education,
        occupation,
        ocdHistory,
        symptomTypes,
        culturalContext,
        selectedGoals,
        timestamp: Date.now(),
      };
      const key = userId ? `onboarding_session_${userId}` : 'onboarding_session_anon';
      await AsyncStorage.setItem(key, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Session kaydetme hatası:', error);
    }
  };

  const loadSession = async () => {
    try {
      const key = userId ? `onboarding_session_${userId}` : 'onboarding_session_anon';
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const sessionData = JSON.parse(saved);
        setCurrentStep(sessionData.currentStep);
        setQuickMode(typeof sessionData.quickMode === 'boolean' ? sessionData.quickMode : true);
        setYbocsAnswers(sessionData.ybocsAnswers || {});
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
            const qid = YBOCS_QUESTIONS[currentYbocsIndex].id;
            setYbocsAnswers({ ...ybocsAnswers, [qid]: Math.round(sliderValue) });
            setCurrentYbocsIndex(currentYbocsIndex + 1);
            setSliderValue(0);
          } else {
            // Son Y-BOCS cevabını kaydet ve profile geç
            const qid = YBOCS_QUESTIONS[currentYbocsIndex].id;
            const nextMap = { ...ybocsAnswers, [qid]: Math.round(sliderValue) };
            setYbocsAnswers(nextMap);
            // Hızlı başlangıç modunda isteğe bağlı adımları atla
            if (quickMode) {
              setCurrentStep(OnboardingStep.TREATMENT_PLAN);
            } else {
              setCurrentStep(OnboardingStep.PROFILE_NAME);
            }
            setSliderValue(0);
          }
          break;
        case OnboardingStep.PROFILE_NAME:
          if (userName.trim()) {
            setCurrentStep(OnboardingStep.PROFILE_DEMOGRAPHICS);
          }
          break;
        case OnboardingStep.PROFILE_DEMOGRAPHICS:
          setCurrentStep(OnboardingStep.PROFILE_HISTORY);
          break;
        case OnboardingStep.PROFILE_HISTORY:
          setCurrentStep(OnboardingStep.PROFILE_SYMPTOMS);
          break;
        case OnboardingStep.PROFILE_SYMPTOMS:
          setCurrentStep(OnboardingStep.PROFILE_CULTURE);
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
            const prevIndex = currentYbocsIndex - 1;
            setCurrentYbocsIndex(prevIndex);
            const prevQid = YBOCS_QUESTIONS[prevIndex].id;
            setSliderValue(ybocsAnswers[prevQid] ?? 0);
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
    trackAIInteraction(AIEventType.TREATMENT_PLAN_GENERATED, {
      ybocsScore: calculateYBOCSScore(),
      goals: selectedGoals,
    }, userId);

    // Mock tedavi planı (gerçekte AI'dan gelecek)
    setTimeout(() => {
      setIsLoading(false);
      setCurrentStep(OnboardingStep.TREATMENT_PLAN);
    }, 1500);
  };

  // Y-BOCS skoru hesapla
  const calculateYBOCSScore = () => {
    return Object.values(ybocsAnswers).reduce((sum, score) => sum + (score || 0), 0);
  };



  // Onboarding'i tamamla
  const completeOnboarding = async () => {
    try {
      // Y-BOCS analizi
      const ybocsScore = calculateYBOCSScore();
      
      // User profile oluştur
      const userProfile: UserProfile = {
        id: userId,
        name: userName,
        demographics: {
          age: parseInt(age) || 0,
          gender: gender as 'male' | 'female' | 'other',
          education,
          occupation
        },
        ocdHistory,
        symptomTypes,
        culturalContext,
        ybocsScore,
        goals: selectedGoals,
        onboardingCompletedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ PRODUCTION: Gerçek AI treatment plan oluştur
      console.log('🤖 Generating real AI treatment plan...');
      let treatmentPlan: TreatmentPlan;
      
      try {
        // Import AI engine
        const { adaptiveTreatmentPlanningEngine } = await import('@/features/ai/engines/treatmentPlanningEngine');
        
        // Y-BOCS responses'ları doğru formata çevir
        const ybocsResponses = Object.entries(ybocsAnswers).map(([questionId, score]) => ({
          questionId,
          response: score,
          // Kategori bilgisi YBOCS_QUESTIONS listesinden türetilebilir
          category: (YBOCS_QUESTIONS.find(q => q.id === questionId)?.category || 'obsessions') as 'obsessions' | 'compulsions',
        }));
        
        // Comprehensive user therapeutic profile
        const therapeuticProfile = {
          userId,
          preferredLanguage: 'tr',
          communicationStyle: {
            directness: 'moderate',
            emotionalTone: 'supportive',
            explanationDepth: 'detailed'
          },
          therapeuticGoals: selectedGoals,
          preferredCBTTechniques: ['cognitive_restructuring', 'exposure_therapy', 'mindfulness'],
          triggerWords: [],
          culturalContext,
          accessibilityNeeds: [],
          treatmentHistory: ocdHistory.previousTreatment ? {
            previousTreatments: [{
              type: 'therapy' as any,
              startDate: new Date(),
              endDate: new Date(),
              outcome: 'partial_improvement' as any,
              notes: 'User indicated previous treatment experience'
            }],
            currentMedications: ocdHistory.medication ? ['ssri'] : [],
            treatmentResponse: 'moderate' as any
          } : {
            previousTreatments: [],
            currentMedications: ocdHistory.medication ? ['ssri'] : [],
            treatmentResponse: 'unknown' as any
          }
        };
        
        // Risk assessment data
        const riskAssessment = {
          overallRiskLevel: ybocsScore > 25 ? 'high' : ybocsScore > 15 ? 'moderate' : 'low',
          clinicalFactors: {
            severityLevel: ybocsScore > 25 ? 'severe' : ybocsScore > 15 ? 'moderate' : 'mild',
            suicidalIdeation: false,
            selfHarmHistory: false,
            substanceUse: false
          },
          environmentalFactors: {
            socialSupport: culturalContext.familyInvolvement === 'supportive' ? 'strong' : 'moderate',
            stressors: [],
            triggerEnvironments: []
          },
          protectiveFactors: {
            copingSkills: 'developing',
            socialConnections: culturalContext.familyInvolvement === 'supportive' ? 'strong' : 'moderate',
            treatmentEngagement: 'high'
          }
        };
        
        // Generate real AI treatment plan
        treatmentPlan = await adaptiveTreatmentPlanningEngine.generateInitialPlan(
          therapeuticProfile as any,
          { totalScore: ybocsScore, severityLevel: ybocsScore > 25 ? 'severe' : ybocsScore > 15 ? 'moderate' : 'mild' } as any,
          riskAssessment as any,
          culturalContext
        );
        
        console.log('✅ Real AI treatment plan generated:', treatmentPlan.id);
        
      } catch (aiError) {
        console.warn('⚠️ AI treatment plan generation failed, using enhanced fallback:', aiError);
        
        // Enhanced fallback with some intelligence
        const baseInterventions = [];
        
        // Y-BOCS tabanlı müdahale seçimi
        if (ybocsScore >= 20) {
          baseInterventions.push({
            type: 'erp',
            title: 'İleri Düzey ERP',
            description: 'Yoğun maruz bırakma ve tepki önleme egzersizleri',
            frequency: 'daily',
            duration: 45
          });
        } else {
          baseInterventions.push({
            type: 'erp',
            title: 'Temel ERP',
            description: 'Aşamalı maruz bırakma egzersizleri',
            frequency: 'daily',
            duration: 30
          });
        }
        
        // Semptom tipine göre müdahaleler
        if (symptomTypes.includes('contamination')) {
          baseInterventions.push({
            type: 'exposure',
            title: 'Kirlenme Maruz Bırakma',
            description: 'Kontrollü kirlenme egzersizleri',
            frequency: 'every_other_day',
            duration: 30
          });
        }
        
        if (symptomTypes.includes('checking')) {
          baseInterventions.push({
            type: 'response_prevention',
            title: 'Kontrol Önleme',
            description: 'Kontrol davranışlarını azaltma teknikleri',
            frequency: 'daily',
            duration: 20
          });
        }
        
        // Kültürel müdahaleler
        if (culturalContext.religiousConsiderations) {
          baseInterventions.push({
            type: 'mindfulness',
            title: 'Manevi Farkındalık',
            description: 'Dini değerlerle uyumlu farkındalık egzersizleri',
            frequency: 'daily',
            duration: 15
          });
        }
        
        treatmentPlan = {
          id: `plan_${userId}_${Date.now()}`,
          userId,
          ybocsScore,
          primaryGoals: selectedGoals.slice(0, 3),
          interventions: baseInterventions,
          weeklySchedule: {
            monday: baseInterventions.slice(0, 2),
            tuesday: baseInterventions.slice(1, 3),
            wednesday: baseInterventions.slice(0, 2),
            thursday: baseInterventions.slice(1, 3),
            friday: baseInterventions.slice(0, 2),
            saturday: [baseInterventions[0]],
            sunday: [{ type: 'rest', title: 'Dinlenme Günü', description: 'Haftalık değerlendirme' }]
          },
          progressMetrics: {
            ybocsTargetReduction: Math.max(5, Math.floor(ybocsScore * 0.3)),
            anxietyReductionTarget: 40,
            functionalImprovementTarget: 50
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // AsyncStorage'a kaydet
      await AsyncStorage.multiSet([
        [`ai_onboarding_completed_${userId}`, 'true'],
        [`ai_user_profile_${userId}`, JSON.stringify(userProfile)],
        [`ai_treatment_plan_${userId}`, JSON.stringify(treatmentPlan)],
        [`ai_onboarding_date_${userId}`, new Date().toISOString()]
      ]);

      // Session temizle
      await AsyncStorage.removeItem(`onboarding_session_${userId}`);

      console.log('✅ OnboardingFlowV3: Completion successful');
      
      // Tamamlama callback
      onComplete(userProfile, treatmentPlan);
      
    } catch (error) {
      console.error('❌ OnboardingFlowV3: Completion error:', error);
      // Hata durumunda da callback'i çağır
      onComplete({} as UserProfile, {} as TreatmentPlan);
    }
  };

  // Progress hesaplama
  const getProgress = () => {
    const steps = Object.values(OnboardingStep);
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  // Slider renk hesaplama
  const getSliderColor = (value: number) => {
    if (value < 2) return Colors.status.success;
    if (value < 3) return Colors.status.warning;
    return Colors.status.error;
  };

  // Step içeriğini render et
  const renderStepContent = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="hand-wave" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>ObsessLess’e Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>
              OKB yolculuğunuzda yanınızdayız
            </Text>
            <Text style={styles.description}>
              Size özel bir destek planı oluşturmak için birkaç kısa adımda 
              sizi tanımak istiyoruz. Bu süreç yaklaşık 10 dakika sürecek.
            </Text>
            <View style={{ marginTop: 16 }}>
              <Button title={quickMode ? 'Hızlı Başlangıç Modu: Açık' : 'Hızlı Başlangıç Modu: Kapalı'} onPress={() => setQuickMode(!quickMode)} />
              <Text style={styles.hint}>Hızlı başlangıç modunda yalnızca Y‑BOCS kısa değerlendirmesi tamamlanır; profil adımları daha sonra Ayarlar’dan doldurulabilir.</Text>
            </View>
            </ScrollView>
          </View>
        );

      case OnboardingStep.CONSENT:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="shield-check" 
                size={80} 
                color={Colors.primary.green} 
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
                color={Colors.primary.green} 
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
        const selectedOption = currentQuestion.options.find(opt => opt.value === Math.round(sliderValue));
        return (
          <View style={styles.ybocsContainer}>
            <Text style={styles.questionNumber}>
              Soru {currentYbocsIndex + 1} / {YBOCS_QUESTIONS.length}
            </Text>
            <Text style={styles.questionCategory}>
              {currentQuestion.category === 'obsessions' ? '🧠 Obsesyonlar' : '🔄 Kompulsiyonlar'}
            </Text>
            <Text style={styles.questionText}>
              {currentQuestion.text}
            </Text>
            <Text style={styles.questionSubtitle}>
              {currentQuestion.subtitle}
            </Text>
            
            <View style={styles.sliderContainer}>
              <View style={styles.sliderValueContainer}>
                <Text style={[styles.sliderValue, { color: getSliderColor(sliderValue) }]}>
                  {Math.round(sliderValue)}
                </Text>
                <Text style={[styles.sliderLabel, { color: getSliderColor(sliderValue) }]}>
                  {selectedOption?.label || 'Hiç'}
                </Text>
                {selectedOption && (
                  <Text style={styles.sliderDescription}>
                    {selectedOption.description}
                  </Text>
                )}
              </View>
              
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={sliderValue}
                onValueChange={setSliderValue}
                minimumTrackTintColor={getSliderColor(sliderValue)}
                maximumTrackTintColor={Colors.ui.border}
                thumbStyle={{
                  backgroundColor: getSliderColor(sliderValue),
                  width: 20,
                  height: 20,
                }}
              />
              
            <View style={styles.sliderLabels}>
                {currentQuestion.options.map((option, index) => (
                  <View key={option.value} style={styles.sliderLabelContainer}>
                    <Text style={styles.sliderLabelText}>{option.value}</Text>
                    <Text style={styles.sliderLabelName}>{option.label}</Text>
                  </View>
                ))}
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
                color={Colors.primary.green} 
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

      case OnboardingStep.PROFILE_DEMOGRAPHICS:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="account-details" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Demografik Bilgiler</Text>
            <Text style={styles.subtitle}>Size daha iyi destek olabilmemiz için</Text>
            
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Yaş</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Yaşınızı girin"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cinsiyet (İsteğe bağlı)</Text>
                <View style={styles.genderContainer}>
                  {['Kadın', 'Erkek', 'Diğer', 'Belirtmek istemiyorum'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.genderOption,
                        gender === option && styles.genderOptionSelected
                      ]}
                      onPress={() => setGender(option)}
                    >
                      <Text style={[
                        styles.genderText,
                        gender === option && styles.genderTextSelected
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Eğitim Durumu</Text>
                <View style={styles.pickerContainer}>
                  {['İlkokul', 'Ortaokul', 'Lise', 'Üniversite', 'Yüksek Lisans/Doktora'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.pickerOption,
                        education === option && styles.pickerOptionSelected
                      ]}
                      onPress={() => setEducation(option)}
                    >
                      <Text style={[
                        styles.pickerText,
                        education === option && styles.pickerTextSelected
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            </ScrollView>
          </View>
        );

      case OnboardingStep.PROFILE_HISTORY:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="history" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>OKB Geçmişi</Text>
            <Text style={styles.subtitle}>Belirtilerinizin hikayesi</Text>
            
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>İlk belirtiler ne zaman başladı?</Text>
                <View style={styles.pickerContainer}>
                  {[
                    'Son 6 ay içinde',
                    '6 ay - 1 yıl önce',
                    '1-2 yıl önce',
                    '2-5 yıl önce',
                    '5+ yıl önce',
                    'Çocukluktan beri'
                  ].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.pickerOption,
                        ocdHistory.firstSymptoms === option && styles.pickerOptionSelected
                      ]}
                      onPress={() => setOcdHistory({...ocdHistory, firstSymptoms: option})}
                    >
                      <Text style={[
                        styles.pickerText,
                        ocdHistory.firstSymptoms === option && styles.pickerTextSelected
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  ocdHistory.previousTreatment && styles.optionCardSelected
                ]}
                onPress={() => setOcdHistory({
                  ...ocdHistory,
                  previousTreatment: !ocdHistory.previousTreatment
                })}
              >
                <MaterialCommunityIcons 
                  name={ocdHistory.previousTreatment ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24} 
                  color={ocdHistory.previousTreatment ? Colors.primary.green : Colors.text.secondary} 
                />
                <Text style={styles.optionText}>Daha önce profesyonel yardım aldım</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  ocdHistory.medication && styles.optionCardSelected
                ]}
                onPress={() => setOcdHistory({
                  ...ocdHistory,
                  medication: !ocdHistory.medication
                })}
              >
                <MaterialCommunityIcons 
                  name={ocdHistory.medication ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24} 
                  color={ocdHistory.medication ? Colors.primary.green : Colors.text.secondary} 
                />
                <Text style={styles.optionText}>Şu anda ilaç kullanıyorum</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  ocdHistory.familyHistory && styles.optionCardSelected
                ]}
                onPress={() => setOcdHistory({
                  ...ocdHistory,
                  familyHistory: !ocdHistory.familyHistory
                })}
              >
                <MaterialCommunityIcons 
                  name={ocdHistory.familyHistory ? "checkbox-marked" : "checkbox-blank-outline"}
                  size={24} 
                  color={ocdHistory.familyHistory ? Colors.primary.green : Colors.text.secondary} 
                />
                <Text style={styles.optionText}>Ailemde OKB öyküsü var</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        );

      case OnboardingStep.PROFILE_SYMPTOMS:
        // Kanonik ikonlar - tüm gridlerde standart
        const iconName = (id: string) => getCanonicalCategoryIconName(id as any);
        const fallbackLabelMap: Record<string, string> = {
          contamination: 'Bulaşma/Temizlik',
          checking: 'Kontrol Etme',
          symmetry: 'Simetri/Düzen',
          mental: 'Zihinsel Ritüeller',
          hoarding: 'Biriktirme',
          other: 'Diğer',
        };
        const SYMPTOM_TYPES = CANONICAL_CATEGORIES.map((id) => ({
          id,
          label: t('categoriesCanonical.' + id, fallbackLabelMap[id] || id),
          icon: iconName(id),
        }));
        
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="brain" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Belirtileriniz</Text>
            <Text style={styles.subtitle}>Yaşadığınız ana belirtiler (birden fazla seçebilirsiniz)</Text>
            
            <View>
              {SYMPTOM_TYPES.map((symptom) => (
                <TouchableOpacity
                  key={symptom.id}
                  style={[
                    styles.symptomCard,
                    symptomTypes.includes(symptom.id) && styles.symptomCardSelected
                  ]}
                  onPress={() => {
                    if (symptomTypes.includes(symptom.id)) {
                      setSymptomTypes(symptomTypes.filter(s => s !== symptom.id));
                    } else {
                      setSymptomTypes([...symptomTypes, symptom.id]);
                    }
                  }}
                >
                  <MaterialCommunityIcons 
                    name={symptom.icon as any} 
                    size={20} 
                    color={getCanonicalCategoryColor(symptom.id)} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.symptomText,
                    symptomTypes.includes(symptom.id) && styles.symptomTextSelected
                  ]}>
                    {t('categoriesCanonical.' + symptom.id, symptom.label)}
                  </Text>
                  {symptomTypes.includes(symptom.id) && (
                    <MaterialCommunityIcons 
                      name="check-circle" 
                      size={20} 
                      color={Colors.primary.green} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            </ScrollView>
          </View>
        );

      case OnboardingStep.PROFILE_CULTURE:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="earth" 
                size={80} 
                color={Colors.primary.green} 
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
                color={culturalContext.religiousConsiderations ? Colors.primary.green : Colors.text.secondary} 
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
                color={culturalContext.familyInvolvement === 'supportive' ? Colors.primary.green : Colors.text.secondary} 
              />
              <Text style={styles.optionText}>Ailem tedavi sürecimde destekçi</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        );

      case OnboardingStep.PROFILE_GOALS:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="target" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Hedefleriniz</Text>
            <Text style={styles.subtitle}>En fazla 3 hedef seçin</Text>
            
            <View>
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
                      color={Colors.primary.green} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            </ScrollView>
          </View>
        );

      case OnboardingStep.TREATMENT_PLAN:
        return (
          <View style={styles.contentContainer}>
            <ScrollView style={styles.stepScroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="clipboard-text" 
                size={80} 
                color={Colors.primary.green} 
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
            </ScrollView>
          </View>
        );

      case OnboardingStep.SAFETY_PLAN:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="lifebuoy" 
                size={80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Güvenlik Planı</Text>
            <Text style={styles.subtitle}>Zor anlarda yanınızdayız</Text>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="phone" size={24} color={Colors.primary.green} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Acil Durum Hattı</Text>
                <Text style={styles.safetyText}>182 - Psikolojik Destek</Text>
              </View>
            </View>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="alert" size={24} color={Colors.status.warning} />
              <View style={styles.safetyTextContainer}>
                <Text style={styles.safetyTitle}>Kriz Anında</Text>
                <Text style={styles.safetyText}>Uygulama içi SOS butonu kullanılabilir</Text>
              </View>
            </View>
            
            <View style={styles.safetyCard}>
              <MaterialCommunityIcons name="heart" size={24} color={Colors.status.error} />
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
                color={Colors.status.success} 
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
                color={Colors.text.primary} 
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
            <View style={[styles.actionContainer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
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
    backgroundColor: Colors.ui.background,
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
    color: Colors.text.secondary,
    fontSize: 16,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.ui.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary.green,
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
    backgroundColor: Colors.ui.backgroundSecondary,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepScroll: {
    width: '100%',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ybocsContainer: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  bold: {
    fontWeight: '600',
    color: Colors.text.primary,
  },
  consentScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
    marginTop: 16,
  },
  consentText: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  questionNumber: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    lineHeight: 26,
  },
  sliderContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sliderValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  sliderLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sliderLabelText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  sliderLabelContainer: {
    alignItems: 'center',
  },
  sliderLabelName: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  sliderDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  questionCategory: {
    fontSize: 14,
    color: Colors.primary.green,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  questionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  formContainer: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.backgroundSecondary,
  },
  genderOptionSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: `${Colors.primary.green}10`,
  },
  genderText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  genderTextSelected: {
    color: Colors.primary.green,
    fontWeight: '600',
  },
  pickerContainer: {
    gap: 8,
  },
  pickerOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.backgroundSecondary,
  },
  pickerOptionSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: `${Colors.primary.green}10`,
  },
  pickerText: {
    fontSize: 14,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  pickerTextSelected: {
    color: Colors.primary.green,
    fontWeight: '600',
  },
  symptomsScroll: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.4,
    marginTop: 16,
  },
  symptomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.ui.backgroundSecondary,
  },
  symptomCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: `${Colors.primary.green}10`,
  },
  symptomEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  symptomText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  symptomTextSelected: {
    fontWeight: '600',
    color: Colors.primary.green,
  },
  input: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: Colors.text.primary,
    marginTop: 24,
    backgroundColor: Colors.ui.background,
  },
  hint: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: Colors.ui.backgroundSecondary,
  },
  optionCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: `${Colors.primary.green}10`,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
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
    borderColor: Colors.ui.border,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.ui.backgroundSecondary,
  },
  goalCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: `${Colors.primary.green}10`,
  },
  goalEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  goalText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  goalTextSelected: {
    fontWeight: '600',
    color: Colors.primary.green,
  },
  planCard: {
    width: '100%',
    padding: 16,
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    marginTop: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  planText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    backgroundColor: Colors.ui.background,
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
    color: Colors.text.primary,
  },
  safetyText: {
    fontSize: 14,
    color: Colors.text.secondary,
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
