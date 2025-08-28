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
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCanonicalCategoryIconName, getCanonicalCategoryColor } from '@/constants/canonicalCategories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase } from '@/lib/supabase';

// UI Components
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Lindsay Braman Style Illustrations
import { 
  OnboardingIllustrations,
  WelcomeIllustration,
  ConsentIllustration,
  AssessmentIllustration,
  ProfileIllustration,
  GoalsIllustration,
  TreatmentPlanIllustration,
  CompletionIllustration 
} from '@/components/illustrations/OnboardingIllustrations';

// OCD İllüstrasyonları

// Hedef İllüstrasyonları
import * as GoalsIllustrations from '@/components/illustrations/GoalsIllustrations';

// Design Tokens
import { Colors } from '@/constants/Colors';
import { CANONICAL_CATEGORIES } from '@/utils/categoryMapping';

// Screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types
import { OCDAnalysis } from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
// ybocsAnalysisService removed; use local fallback analysis

// Using global design tokens

type OnboardingCulturalContext = {
  language: string;
  religiousConsiderations: boolean;
  familyInvolvement: 'none' | 'supportive';
  culturalFactors: string[];
};

interface OnboardingFlowV3Props {
  onComplete: (userProfile: any, treatmentPlan: any) => void;
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
  { id: 'reduce_anxiety', label: 'Kaygıyı Azaltmak', emoji: '😌', Illustration: GoalsIllustrations.ReduceAnxietyIcon },
  { id: 'control_compulsions', label: 'Kompulsiyonları Kontrol Etmek', emoji: '💪', Illustration: GoalsIllustrations.ControlCompulsionsIcon },
  { id: 'improve_daily_life', label: 'Günlük Yaşamı İyileştirmek', emoji: '🌟', Illustration: GoalsIllustrations.ImproveDailyLifeIcon },
  { id: 'better_relationships', label: 'İlişkileri Güçlendirmek', emoji: '❤️', Illustration: GoalsIllustrations.BetterRelationshipsIcon },
  { id: 'increase_functionality', label: 'İşlevselliği Artırmak', emoji: '🎯', Illustration: GoalsIllustrations.IncreaseFunctionalityIcon },
  { id: 'emotional_regulation', label: 'Duygu Düzenleme', emoji: '🧘', Illustration: GoalsIllustrations.EmotionalRegulationIcon },
];

export const OnboardingFlowV3: React.FC<OnboardingFlowV3Props> = ({
  onComplete,
  onExit,
  userId,
  resumeSession = false,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Animasyon değerleri
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
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
  const [culturalContext, setCulturalContext] = useState<OnboardingCulturalContext>({
    language: 'tr',
    religiousConsiderations: false,
    familyInvolvement: 'none',
    culturalFactors: [],
  });
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // AI sonuçlarının yerel state'te tutulması
  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<OCDAnalysis | null>(null);

  // Session kaydetme
  useEffect(() => {
    if (currentStep !== OnboardingStep.WELCOME) {
      saveSession();
    }
  }, [currentStep, ybocsAnswers, userName, culturalContext, selectedGoals]);

  // Session yükleme ve kullanıcı bilgilerini yükleme
  useEffect(() => {
    if (resumeSession) {
      loadSession();
    }
    // Kullanıcı ismini yükle
    loadUserName();
  }, [resumeSession]);

  // Android geri tuşu kontrolü
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Onboarding'i tamamlamadan çıkışı engelle
      Alert.alert(
        'Onboarding\'den Çıkmak İstediğinize Emin Misiniz?',
        'Kişiselleştirilmiş tedavi planınızı oluşturmak için lütfen tüm adımları tamamlayın.',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Çık', 
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Uyarı',
                'Onboarding tamamlanmadan uygulamayı kullanamazsınız. Yine de çıkmak istiyor musunuz?',
                [
                  { text: 'Hayır, Devam Et', style: 'cancel' },
                  { text: 'Evet, Çık', onPress: () => onExit(), style: 'destructive' }
                ]
              );
            }
          }
        ]
      );
      return true; // Geri tuşunu override et
    });

    return () => backHandler.remove();
  }, []);

  const saveSession = async () => {
    try {
      const sessionData = {
        currentStep,
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
    // Debounce to prevent rapid multiple presses
    const now = Date.now();
    if (isLoading) {
      console.log('⚠️ Button press ignored - already loading');
      return;
    }
    
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
            // Profil adımlarına geç
            setCurrentStep(OnboardingStep.PROFILE_NAME);
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
        case OnboardingStep.PROFILE_DEMOGRAPHICS:
          setCurrentStep(OnboardingStep.PROFILE_NAME);
          break;
        case OnboardingStep.PROFILE_HISTORY:
          setCurrentStep(OnboardingStep.PROFILE_DEMOGRAPHICS);
          break;
        case OnboardingStep.PROFILE_SYMPTOMS:
          setCurrentStep(OnboardingStep.PROFILE_HISTORY);
          break;
        case OnboardingStep.PROFILE_CULTURE:
          setCurrentStep(OnboardingStep.PROFILE_SYMPTOMS);
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

    try {
      // Telemetry (request)
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'treatment_plan_request' }, userId);

      // Y-BOCS cevapları
      const ybocsResponses = Object.entries(ybocsAnswers).map(([questionId, score]) => ({
        questionId,
        response: score,
      }));

      // AI destekli analiz (fallback manuel)
      let analysis;
      try {
        // ybocsAnalysisService removed; use local calculation only
        throw new Error('ybocsAnalysisService removed');
      } catch {
        analysis = { totalScore: calculateYBOCSScore(), subscores: { obsessions: 0, compulsions: 0 }, severityLevel: 'moderate', dominantSymptoms: [], riskFactors: [], confidence: 0.5, culturalConsiderations: [], recommendedInterventions: [] } as OCDAnalysis;
      }

      // AI treatment plan preview (basit yerel plan)
      try {
        const ybocsScorePreview = calculateYBOCSScore();
        const baseInterventions = ybocsScorePreview >= 20
          ? [{ type: 'therapy', title: 'İleri Düzey Terapi', description: 'Yoğun maruz bırakma ve tepki önleme egzersizleri', frequency: 'daily', duration: 45 }]
          : [{ type: 'therapy', title: 'Temel Terapi', description: 'Aşamalı maruz bırakma egzersizleri', frequency: 'daily', duration: 30 }];
        const plan = {
          id: `plan_preview_${userId}_${Date.now()}`,
          userId,
          ybocsScore: ybocsScorePreview,
          primaryGoals: selectedGoals.slice(0, 3),
          interventions: baseInterventions,
          weeklySchedule: {
            monday: baseInterventions,
            tuesday: baseInterventions,
            wednesday: baseInterventions,
            thursday: baseInterventions,
            friday: baseInterventions,
            saturday: baseInterventions.slice(0, 1),
            sunday: [{ type: 'rest', title: 'Dinlenme Günü', description: 'Haftalık değerlendirme' }]
          },
          progressMetrics: {
            ybocsTargetReduction: Math.max(5, Math.floor(ybocsScorePreview * 0.3)),
            anxietyReductionTarget: 40,
            functionalImprovementTarget: 50
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try {
          await AsyncStorage.setItem(`ai_onboarding_ybocs_${userId}`, JSON.stringify(analysis));
          await AsyncStorage.setItem(`ai_onboarding_treatment_plan_${userId}`, JSON.stringify(plan));
        } catch {}
        setGeneratedPlan(plan);
        setGeneratedAnalysis(analysis);
        setCurrentStep(OnboardingStep.TREATMENT_PLAN);
      } catch (e) {
        setCurrentStep(OnboardingStep.TREATMENT_PLAN);
      }

      // Telemetry (generated)
      await trackAIInteraction(AIEventType.TREATMENT_PLAN_GENERATED, { ybocsScore: calculateYBOCSScore(), goals: selectedGoals }, userId);
    } finally {
      setIsLoading(false);
    }
  };

  // Y-BOCS skoru hesapla
  const calculateYBOCSScore = () => {
    return Object.values(ybocsAnswers).reduce((sum, score) => sum + (score || 0), 0);
  };

  // Kullanıcı ismini yükle
  const loadUserName = async () => {
    try {
      // Önce AsyncStorage'dan kontrol et
      const savedName = await AsyncStorage.getItem(`user_name_${userId}`);
      if (savedName) {
        setUserName(savedName);
        return;
      }

      // Supabase'den kullanıcı bilgilerini al
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        // Email'den isim çıkar veya metadata'dan al
        const displayName = user.user_metadata?.full_name || 
                          user.user_metadata?.name || 
                          user.email?.split('@')[0] || 
                          '';
        if (displayName) {
          setUserName(displayName);
        }
      }
    } catch (error) {
      console.log('Error loading user name:', error);
    }
  };



  // Onboarding'i tamamla
  const completeOnboarding = async () => {
    // Prevent multiple calls
    if (isLoading) {
      console.log('⚠️ Onboarding completion already in progress');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Y-BOCS analizi
      const ybocsScore = calculateYBOCSScore();
      
      // User profile oluştur
      const userProfile: any = {
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
      let treatmentPlan: any;
      
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
              type: 'therapy',
              startDate: new Date(),
              endDate: new Date(),
              outcome: 'partial_improvement',
              notes: 'User indicated previous treatment experience'
            }],
            currentMedications: ocdHistory.medication ? ['ssri'] : [],
            treatmentResponse: 'moderate'
          } : {
            previousTreatments: [],
            currentMedications: ocdHistory.medication ? ['ssri'] : [],
            treatmentResponse: 'unknown'
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
        const minimalYbocs: any = {
          totalScore: ybocsScore,
          subscores: { obsessions: Math.floor(ybocsScore / 2), compulsions: Math.ceil(ybocsScore / 2) },
          severityLevel: ybocsScore > 31 ? 'extreme' : ybocsScore > 23 ? 'severe' : ybocsScore > 15 ? 'moderate' : ybocsScore > 7 ? 'mild' : 'minimal',
          dominantSymptoms: symptomTypes,
          riskFactors: [],
          confidence: 0.6,
          culturalConsiderations: [],
          recommendedInterventions: []
        };
        treatmentPlan = await adaptiveTreatmentPlanningEngine.generateInitialPlan(
          therapeuticProfile as any,
          minimalYbocs,
          riskAssessment as any,
          culturalContext as any
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

      // AsyncStorage + Encrypted kaydet
      try {
        const { useSecureStorage } = await import('@/hooks/useSecureStorage');
        const { setItem } = useSecureStorage();
        await Promise.all([
          AsyncStorage.setItem(`ai_onboarding_completed_${userId}`, 'true'),
          setItem(`ai_user_profile_${userId}`, userProfile, true),
          setItem(`ai_treatment_plan_${userId}`, treatmentPlan, true),
          AsyncStorage.setItem(`ai_onboarding_date_${userId}`, new Date().toISOString()),
        ]);
      } catch {
        // Fallback to plain if secure fails
        await AsyncStorage.multiSet([
          [`ai_onboarding_completed_${userId}`, 'true'],
          [`ai_user_profile_${userId}`, JSON.stringify(userProfile)],
          [`ai_treatment_plan_${userId}`, JSON.stringify(treatmentPlan)],
          [`ai_onboarding_date_${userId}`, new Date().toISOString()],
        ]);
      }

      // Note: Supabase sync handled by parent component to avoid duplicate upsert calls
      console.log('✅ OnboardingFlowV3 completed - local data persisted, parent will handle Supabase sync');

      // Session temizle
      await AsyncStorage.removeItem(`onboarding_session_${userId}`);

      console.log('✅ OnboardingFlowV3: Completion successful');
      
      // Tamamlama callback
      onComplete(userProfile, treatmentPlan);
      
    } catch (error) {
      console.error('❌ OnboardingFlowV3: Completion error:', error);
      // Hata durumunda da callback'i çağır
      onComplete({} as any, {} as any);
    } finally {
      // Reset loading state after completion
      setIsLoading(false);
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
            <View style={styles.iconContainer}>
              <WelcomeIllustration width={200} height={200} />
            </View>
            <Text style={styles.title}>ObsessLess'e Hoş Geldiniz</Text>
            <Text style={styles.subtitle}>
              OKB yolculuğunuzda yanınızdayız
            </Text>
            <Text style={styles.description}>
              Size özel bir destek planı oluşturmak için birkaç adımda 
              sizi tanımak istiyoruz. Bu süreç yaklaşık 15-20 dakika sürecek.
            </Text>
            <View style={{ marginTop: 16 }}>
              <Text style={styles.hint}>Lütfen tüm adımları tamamlayarak kişiselleştirilmiş tedavi planınızı oluşturun.</Text>
            </View>
          </View>
        );

      case OnboardingStep.CONSENT:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <ConsentIllustration width={200} height={200} />
            </View>
            <Text style={styles.title}>Gizlilik ve Güvenlik</Text>
            <View style={{ flex: 1 }}>
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
            </View>
          </View>
        );

      case OnboardingStep.YBOCS_INTRO:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <AssessmentIllustration width={200} height={200} />
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
        const selectedValue = Math.round(sliderValue);
        return (
          <View style={styles.ybocsContainer}>
            {/* Progress indicator */}
            <View style={styles.questionProgressContainer}>
              <Text style={styles.questionNumber}>
                {currentYbocsIndex + 1}/{YBOCS_QUESTIONS.length}
              </Text>
            </View>
            
            {/* Question text */}
            <Text style={styles.questionText}>
              {currentQuestion.text}
            </Text>
            
            {/* Options with full width cards */}
            <View style={styles.optionsFullWidthContainer}>
              {currentQuestion.options.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionFullWidthCard,
                      isSelected && styles.optionFullWidthCardSelected
                    ]}
                    onPress={() => {
                      setSliderValue(option.value);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionFullWidthContent}>
                      <Text style={[
                        styles.optionFullWidthLabel,
                        isSelected && styles.optionFullWidthLabelSelected
                      ]}>
                        {option.label}
                      </Text>
                      <View style={[
                        styles.checkCircle,
                        isSelected && styles.checkCircleSelected
                      ]}>
                        {isSelected && (
                          <MaterialCommunityIcons 
                            name="check" 
                            size={16} 
                            color="#FFFFFF" 
                          />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          
          </View>
        );

      case OnboardingStep.PROFILE_NAME:
        return (
          <View style={styles.contentContainer}>
            <View style={styles.iconContainer}>
              <ProfileIllustration width={200} height={200} />
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

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="account-details" 
                size={SCREEN_HEIGHT < 700 ? 60 : 80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Demografik Bilgiler</Text>
            <Text style={styles.subtitle}>Size daha iyi destek olabilmemiz için</Text>
            
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Yaş</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="Yaşınızı girin"
                  placeholderTextColor="#9CA3AF"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cinsiyet</Text>
                <View style={styles.modernSelectionGrid}>
                  {['Kadın', 'Erkek', 'Diğer'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.modernSelectionCard,
                        gender === option && styles.modernSelectionCardSelected
                      ]}
                      onPress={() => setGender(option)}
                    >
                      <MaterialCommunityIcons 
                        name={option === 'Kadın' ? 'gender-female' : option === 'Erkek' ? 'gender-male' : 'gender-transgender'} 
                        size={24} 
                        color={gender === option ? Colors.primary.green : '#9CA3AF'} 
                      />
                      <Text style={[
                        styles.modernSelectionText,
                        gender === option && styles.modernSelectionTextSelected
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

          </View>
        );

      case OnboardingStep.PROFILE_HISTORY:
        return (
          <View style={styles.contentContainer}>

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="history" 
                size={SCREEN_HEIGHT < 700 ? 60 : 80} 
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

          </View>
        );

      case OnboardingStep.PROFILE_SYMPTOMS:
        // Lindsay Braman SVG illüstrasyonları
        const getSymptomIllustration = (id: string) => {
          // Illustrations removed, use default icon
          return null;
        };
        
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
          Illustration: getSymptomIllustration(id),
        }));
        
        return (
          <View style={styles.contentContainer}>

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="brain" 
                size={SCREEN_HEIGHT < 700 ? 60 : 80} 
                color={Colors.primary.green} 
              />
            </View>
            <Text style={styles.title}>Belirtileriniz</Text>
            <Text style={styles.subtitle}>Yaşadığınız ana belirtiler</Text>
            
            <View style={styles.symptomGrid}>
              {SYMPTOM_TYPES.map((symptom) => {
                const IllustrationComponent = symptom.Illustration;
                return (
                  <TouchableOpacity
                    key={symptom.id}
                    style={[
                      styles.symptomGridCard,
                      symptomTypes.includes(symptom.id) && styles.symptomGridCardSelected
                    ]}
                    onPress={() => {
                      if (symptomTypes.includes(symptom.id)) {
                        setSymptomTypes(symptomTypes.filter(s => s !== symptom.id));
                      } else {
                        setSymptomTypes([...symptomTypes, symptom.id]);
                      }
                    }}
                  >
                    <View style={{ 
                      width: SCREEN_HEIGHT < 700 ? 32 : 40,
                      height: SCREEN_HEIGHT < 700 ? 32 : 40,
                      backgroundColor: '#E5E7EB',
                      borderRadius: 6
                    }} />
                  <Text style={[
                    styles.symptomGridText,
                    symptomTypes.includes(symptom.id) && styles.symptomGridTextSelected
                  ]}>
                    {t('categoriesCanonical.' + symptom.id, symptom.label)}
                  </Text>
                  {symptomTypes.includes(symptom.id) && (
                    <View style={styles.symptomCheckmark}>
                      <MaterialCommunityIcons 
                        name="check" 
                        size={14} 
                        color="#FFFFFF" 
                      />
                    </View>
                  )}
                </TouchableOpacity>
                );
              })}
            </View>

          </View>
        );

      case OnboardingStep.PROFILE_CULTURE:
        return (
          <View style={styles.contentContainer}>

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

          </View>
        );

      case OnboardingStep.PROFILE_GOALS:
        return (
          <View style={styles.contentContainer}>

            <View style={styles.iconContainer}>
              <GoalsIllustration 
                width={SCREEN_HEIGHT < 700 ? 150 : 200} 
                height={SCREEN_HEIGHT < 700 ? 150 : 200} 
              />
            </View>
            <Text style={styles.title}>Hedefleriniz</Text>
            <Text style={styles.subtitle}>En fazla 3 hedef seçin</Text>
            
            <View style={styles.goalsFullWidthContainer}>
              {TREATMENT_GOALS.map((goal) => {
                const IllustrationComponent = goal.Illustration;
                const isSelected = selectedGoals.includes(goal.id);
                const isDisabled = !isSelected && selectedGoals.length >= 3;
                
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[
                      styles.goalFullWidthCard,
                      isSelected && styles.goalFullWidthCardSelected,
                      isDisabled && styles.goalFullWidthCardDisabled
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedGoals(selectedGoals.filter(g => g !== goal.id));
                      } else if (selectedGoals.length < 3) {
                        setSelectedGoals([...selectedGoals, goal.id]);
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    disabled={isDisabled}
                  >
                    <View style={styles.goalFullWidthContent}>
                      <View style={styles.goalIconContainer}>
                        <View style={{ 
                          width: SCREEN_HEIGHT < 700 ? 36 : 45,
                          height: SCREEN_HEIGHT < 700 ? 36 : 45,
                          backgroundColor: '#E5E7EB',
                          borderRadius: 8
                        }} />
                      </View>
                      <Text style={[
                        styles.goalFullWidthText,
                        isSelected && styles.goalFullWidthTextSelected,
                        isDisabled && styles.goalFullWidthTextDisabled
                      ]}>
                        {goal.label}
                      </Text>
                      <View style={[
                        styles.goalCheckCircle,
                        isSelected && styles.goalCheckCircleSelected
                      ]}>
                        {isSelected && (
                          <MaterialCommunityIcons 
                            name="check" 
                            size={16} 
                            color="#FFFFFF" 
                          />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        );

      case OnboardingStep.TREATMENT_PLAN:
        const ybocsScore = calculateYBOCSScore();
        const getSeverityLevel = (score: number) => {
          if (score <= 7) return { level: 'Minimal', color: '#10B981', description: 'Belirtiler çok hafif' };
          if (score <= 15) return { level: 'Hafif', color: '#84CC16', description: 'Hafif düzeyde OKB belirtileri' };
          if (score <= 23) return { level: 'Orta', color: '#F59E0B', description: 'Orta düzeyde tedavi gerekli' };
          if (score <= 31) return { level: 'Ciddi', color: '#EF4444', description: 'Yoğun tedavi önerilir' };
          return { level: 'Çok Ciddi', color: '#991B1B', description: 'Acil tedavi gerekli' };
        };
        
        const severity = getSeverityLevel(ybocsScore);
        const progressPercentage = Math.min((ybocsScore / 40) * 100, 100);
        
        // AI Destekli Rapor Oluştur
        const generateAIReport = () => {
          const symptoms = symptomTypes.map(id => {
            const label = { 
              contamination: 'Bulaşma/Temizlik',
              checking: 'Kontrol Etme',
              symmetry: 'Simetri/Düzen',
              mental: 'Zihinsel Ritüeller',
              hoarding: 'Biriktirme',
              other: 'Diğer'
            }[id] || id;
            return label;
          }).join(', ');
          
          const goals = selectedGoals.map(id => {
            const goal = TREATMENT_GOALS.find(g => g.id === id);
            return goal?.label || id;
          }).join(', ');
          
          return `${userName} için hazırlanan tedavi planı:\n\n` +
                 `• OKB Şiddeti: ${severity.level} (${ybocsScore}/40)\n` +
                 `• Ana Belirtiler: ${symptoms || 'Belirtilmemiş'}\n` +
                 `• Tedavi Hedefleri: ${goals}\n\n` +
                 `Önerilen Yaklaşım:\n` +
                 (ybocsScore >= 16 ? 
                   `• Yoğun ERP programı (günlük 45 dk)\n• CBT destekli bilişsel yeniden yapılandırma\n• Haftalık ilerleme takibi` :
                   `• Kademeli maruz bırakma egzersizleri\n• Günlük 30 dk ERP uygulaması\n• İki haftada bir değerlendirme`);
        };
        
        return (
          <View style={styles.contentContainer}>

            <View style={styles.iconContainer}>
              <TreatmentPlanIllustration width={200} height={200} 
              />
            </View>
            <Text style={styles.title}>Tedavi Planınız Hazır</Text>
            
            {/* Y-BOCS Skor Grafiği */}
            <View style={styles.ybocsGraphContainer}>
              <Text style={styles.ybocsGraphTitle}>Y-BOCS Skorunuz</Text>
              <View style={styles.ybocsScoreDisplay}>
                <Text style={[styles.ybocsScoreNumber, { color: severity.color }]}>
                  {ybocsScore}
                </Text>
                <Text style={styles.ybocsScoreMax}>/40</Text>
              </View>
              
              {/* Progress Bar */}
              <View style={styles.ybocsProgressBar}>
                <View style={[styles.ybocsProgressFill, { 
                  width: `${progressPercentage}%`,
                  backgroundColor: severity.color 
                }]} />
              </View>
              
              {/* Severity Label */}
              <View style={[styles.ybocsSeverityBadge, { backgroundColor: `${severity.color}20` }]}>
                <Text style={[styles.ybocsSeverityText, { color: severity.color }]}>
                  {severity.level}: {severity.description}
                </Text>
              </View>
            </View>
            
            {/* AI Destekli Rapor */}
            <View style={styles.aiReportCard}>
              <View style={styles.aiReportHeader}>
                <MaterialCommunityIcons name="robot" size={20} color={Colors.primary.green} />
                <Text style={styles.aiReportTitle}>AI Destekli Analiz</Text>
              </View>
              <Text style={styles.aiReportText}>
                {generateAIReport()}
              </Text>
            </View>
            
            {/* Ana Hedefler */}
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>🎯 Ana Hedefleriniz</Text>
              {selectedGoals.slice(0, 3).map((goalId) => {
                const goal = TREATMENT_GOALS.find(g => g.id === goalId);
                const GoalIcon = goal?.Illustration;
                return (
                  <View key={goalId} style={styles.goalRow}>
                    {GoalIcon && <GoalIcon width={24} height={24} />}
                    <Text style={styles.goalRowText}>{goal?.label}</Text>
                  </View>
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
              <CompletionIllustration width={200} height={200} />
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
          
          <View style={{ flex: 1 }} />
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

        {/* Main Content Area with Flex */}
        <View style={styles.contentWrapper}>
          {/* Scrollable Card */}
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
              <ScrollView 
                style={styles.scrollContent}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderStepContent()}
              </ScrollView>
            </Card>
          </Animated.View>

          {/* Fixed Action Button Container */}
          <View style={[styles.fixedButtonContainer, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <Button
              title={getButtonText()}
              onPress={handleNext}
              disabled={!isNextEnabled() || isLoading}
              loading={isLoading}
              style={styles.actionButton}
            />
          </View>
        </View>
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
  contentWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  cardContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.ui.backgroundSecondary,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: SCREEN_HEIGHT < 700 ? 20 : 40,
    flexGrow: 1,
  },
  fixedButtonContainer: {
    backgroundColor: Colors.ui.backgroundSecondary,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'flex-start',
  },
  ybocsContainer: {
    paddingTop: 12,
  },
  iconContainer: {
    marginBottom: SCREEN_HEIGHT < 700 ? 8 : 16,
  },
  title: {
    fontSize: SCREEN_HEIGHT < 700 ? 20 : 24,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: SCREEN_HEIGHT < 700 ? 14 : 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT < 700 ? 12 : 16,
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

  consentText: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  questionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.green,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 28,
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
    flex: 1,
  },
  inputGroup: {
    marginBottom: SCREEN_HEIGHT < 700 ? 12 : 16,
  },
  inputLabel: {
    fontSize: SCREEN_HEIGHT < 700 ? 14 : 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
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
    height: SCREEN_HEIGHT < 700 ? 44 : 52,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: SCREEN_HEIGHT < 700 ? 14 : 16,
    color: Colors.text.primary,
    marginTop: SCREEN_HEIGHT < 700 ? 12 : 20,
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
  actionButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
  },
  
  // Y-BOCS Question Styles - Full Width Design
  questionProgressContainer: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionsFullWidthContainer: {
    width: '100%',
    marginTop: 8,
  },
  optionFullWidthCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  optionFullWidthCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: '#F0FDF4',
  },
  optionFullWidthContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionFullWidthLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#374151',
  },
  optionFullWidthLabelSelected: {
    color: '#374151',
    fontWeight: '600',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: Colors.primary.green,
  },
  
  // Modern Mobile-First Form Styles
  modernInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  modernSelectionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modernSelectionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: SCREEN_HEIGHT < 700 ? 12 : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernSelectionCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: '#F0FDF4',
  },
  modernSelectionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  modernSelectionTextSelected: {
    color: Colors.primary.green,
    fontWeight: '600',
  },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: SCREEN_HEIGHT < 700 ? 8 : 12,
  },
  symptomGridCard: {
    width: '47%',
    marginHorizontal: '1.5%',
    marginVertical: SCREEN_HEIGHT < 700 ? 4 : 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: SCREEN_HEIGHT < 700 ? 12 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  symptomGridCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: '#F0FDF4',
  },
  symptomGridText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  symptomGridTextSelected: {
    color: Colors.primary.green,
    fontWeight: '600',
  },
  symptomCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Goals Full Width Styles
  goalsFullWidthContainer: {
    width: '100%',
    marginTop: 8,
  },
  goalFullWidthCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SCREEN_HEIGHT < 700 ? 10 : 14,
    paddingHorizontal: 16,
    marginVertical: SCREEN_HEIGHT < 700 ? 4 : 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  goalFullWidthCardSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: '#F0FDF4',
  },
  goalFullWidthCardDisabled: {
    opacity: 0.5,
  },
  goalFullWidthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalIconContainer: {
    marginRight: 12,
  },
  goalFullWidthText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  goalFullWidthTextSelected: {
    color: '#374151',
    fontWeight: '600',
  },
  goalFullWidthTextDisabled: {
    color: '#9CA3AF',
  },
  goalCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckCircleSelected: {
    borderColor: Colors.primary.green,
    backgroundColor: Colors.primary.green,
  },
  
  // Y-BOCS Graph Styles
  ybocsGraphContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ybocsGraphTitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  ybocsScoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: 8,
  },
  ybocsScoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  ybocsScoreMax: {
    fontSize: 20,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  ybocsProgressBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 12,
  },
  ybocsProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  ybocsSeverityBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  ybocsSeverityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // AI Report Styles
  aiReportCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.primary.green,
  },
  aiReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiReportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  aiReportText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  goalRowText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 8,
  },
});

export default OnboardingFlowV3;
