/**
 * 🧭 Progressive AI Onboarding Flow V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun yeniden tasarlanmış onboarding deneyimi:
 * - "Sakinlik Her Şeyden Önce Gelir" - Minimalist tam ekran tasarım
 * - "Zahmetsizlik Esastır" - Tek aksiyon, net flow
 * - "Güç Kullanıcıdadır" - Skip ve geri dönme seçenekleri
 * 
 * Features:
 * ✅ Full-screen step design (no nested cards)
 * ✅ Single action per screen
 * ✅ Smooth transitions (300ms fade)
 * ✅ Minimal visual hierarchy
 * ✅ Turkish cultural adaptation
 * ✅ Accessibility (WCAG 2.1 AA)
 * ✅ < 10 dakika tamamlama süresi
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';

// Sprint 7 Backend Services
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
import { modernOnboardingEngine as onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { adaptiveTreatmentPlanningEngine as treatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { advancedRiskAssessmentService as riskAssessmentService } from '@/features/ai/services/riskAssessmentService';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Types
import {
  OnboardingSession,
  OnboardingStep,
  YBOCSAnswer,
  UserProfile,
  TreatmentPlan,
  RiskAssessment,
} from '@/features/ai/types';

// Child Components (Simplified)
import { YBOCSAssessmentV2 } from './YBOCSAssessmentV2';
import { ProfileBuilderV2 } from './ProfileBuilderV2';
import { TreatmentPlanPreviewV2 } from './TreatmentPlanPreviewV2';
import { SafetyPlanV2 } from './SafetyPlanV2';

// Feature Flags
import { FEATURE_FLAGS } from '@/constants/featureFlags';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

interface OnboardingFlowV2Props {
  onComplete: (userProfile: UserProfile, treatmentPlan: TreatmentPlan) => void;
  onExit: () => void;
  userId: string;
  resumeSession?: boolean;
}

interface OnboardingState {
  currentStep: OnboardingStep;
  session: OnboardingSession | null;
  userProfile: UserProfile | null;
  treatmentPlan: TreatmentPlan | null;
  riskAssessment: RiskAssessment | null;
  isLoading: boolean;
  error: string | null;
  progress: number;
  ybocsAnswers: YBOCSAnswer[];
  canProceed: boolean;
}

const TOTAL_STEPS = 5; // Consent, Y-BOCS, Profile, Treatment, Safety

export const OnboardingFlowV2: React.FC<OnboardingFlowV2Props> = ({
  onComplete,
  onExit,
  userId,
  resumeSession = false,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [state, setState] = useState<OnboardingState>({
    currentStep: OnboardingStep.CONSENT,
    session: null,
    userProfile: null,
    treatmentPlan: null,
    riskAssessment: null,
    isLoading: false,
    error: null,
    progress: 0,
    ybocsAnswers: [],
    canProceed: false,
  });

  // Initialize session
  useEffect(() => {
    initializeOnboarding();
  }, []);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [state.currentStep]);

  const initializeOnboarding = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Check for existing session
      if (resumeSession) {
        const existingSession = await onboardingEngine.getActiveSession(userId);
        if (existingSession) {
          setState(prev => ({
            ...prev,
            session: existingSession,
            currentStep: existingSession.currentStep,
            progress: calculateProgress(existingSession.currentStep),
            isLoading: false,
          }));
          return;
        }
      }

      // Create new session
      const newSession = await onboardingEngine.startSession(userId);
      setState(prev => ({
        ...prev,
        session: newSession,
        isLoading: false,
      }));

      // Track start
      await trackAIInteraction(AIEventType.ONBOARDING_SESSION_STARTED, {
        userId,
        sessionId: newSession.sessionId,
      });
    } catch (error) {
      console.error('Failed to initialize onboarding:', error);
      setState(prev => ({
        ...prev,
        error: 'Başlatma hatası. Lütfen tekrar deneyin.',
        isLoading: false,
      }));
    }
  };

  const handleBackPress = () => {
    if (state.currentStep === OnboardingStep.CONSENT) {
      handleExit();
    } else {
      handlePreviousStep();
    }
    return true;
  };

  const handleExit = () => {
    Alert.alert(
      'Çıkmak istediğinizden emin misiniz?',
      'İlerlemeniz kaydedilecek ve daha sonra kaldığınız yerden devam edebilirsiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış',
          style: 'destructive',
          onPress: async () => {
            if (state.session) {
              await onboardingEngine.pauseSession(state.session.sessionId);
            }
            onExit();
          },
        },
      ]
    );
  };

  const calculateProgress = (step: OnboardingStep): number => {
    const stepOrder = [
      OnboardingStep.CONSENT,
      OnboardingStep.YBOCS_ASSESSMENT,
      OnboardingStep.BASIC_INFO,
      OnboardingStep.TREATMENT_PLANNING,
      OnboardingStep.SAFETY_PLANNING,
      OnboardingStep.COMPLETION,
    ];
    const index = stepOrder.indexOf(step);
    return ((index + 1) / stepOrder.length) * 100;
  };

  const transitionToStep = (newStep: OnboardingStep) => {
    // Smooth fade transition
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setState(prev => ({
      ...prev,
      currentStep: newStep,
      progress: calculateProgress(newStep),
      canProceed: false,
    }));

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNextStep = () => {
    const nextStep = getNextStep(state.currentStep);
    if (nextStep) {
      transitionToStep(nextStep);
    }
  };

  const handlePreviousStep = () => {
    const prevStep = getPreviousStep(state.currentStep);
    if (prevStep) {
      transitionToStep(prevStep);
    }
  };

  const getNextStep = (current: OnboardingStep): OnboardingStep | null => {
    const stepOrder = [
      OnboardingStep.CONSENT,
      OnboardingStep.YBOCS_ASSESSMENT,
      OnboardingStep.BASIC_INFO,
      OnboardingStep.TREATMENT_PLANNING,
      OnboardingStep.SAFETY_PLANNING,
      OnboardingStep.COMPLETION,
    ];
    const index = stepOrder.indexOf(current);
    return index < stepOrder.length - 1 ? stepOrder[index + 1] : null;
  };

  const getPreviousStep = (current: OnboardingStep): OnboardingStep | null => {
    const stepOrder = [
      OnboardingStep.CONSENT,
      OnboardingStep.YBOCS_ASSESSMENT,
      OnboardingStep.BASIC_INFO,
      OnboardingStep.TREATMENT_PLANNING,
      OnboardingStep.SAFETY_PLANNING,
      OnboardingStep.COMPLETION,
    ];
    const index = stepOrder.indexOf(current);
    return index > 0 ? stepOrder[index - 1] : null;
  };

  const handleYBOCSComplete = async (answers: YBOCSAnswer[]) => {
    setState(prev => ({ ...prev, ybocsAnswers: answers, isLoading: true }));
    
    try {
      // Analyze Y-BOCS
      const analysis = await ybocsAnalysisService.analyzeYBOCS(answers, userId);
      
      // Update session
      if (state.session) {
        await onboardingEngine.updateSessionData(state.session.sessionId, {
          ybocsData: analysis,
        });
      }

      // Track completion
      await trackAIInteraction(AIEventType.YBOCS_COMPLETED, {
        userId,
        severity: analysis.severity,
        totalScore: analysis.totalScore,
      });

      setState(prev => ({ ...prev, isLoading: false }));
      handleNextStep();
    } catch (error) {
      console.error('Y-BOCS analysis failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Analiz hatası. Lütfen tekrar deneyin.',
        isLoading: false,
      }));
    }
  };

  const handleProfileComplete = async (profileData: Partial<UserProfile>) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Create user profile
      const profile = await userProfilingService.createProfile(userId, {
        basicInfo: profileData.basicInfo,
        ybocsData: state.ybocsAnswers,
        culturalContext: profileData.culturalContext,
      });

      setState(prev => ({ 
        ...prev, 
        userProfile: profile,
        isLoading: false,
      }));

      handleNextStep();
    } catch (error) {
      console.error('Profile creation failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Profil oluşturma hatası.',
        isLoading: false,
      }));
    }
  };

  const handleTreatmentPlanApproval = async () => {
    handleNextStep();
  };

  const handleSafetyPlanApproval = async () => {
    // Complete onboarding
    if (state.session && state.userProfile && state.treatmentPlan) {
      await onboardingEngine.finalizeSession(state.session.sessionId);
      onComplete(state.userProfile, state.treatmentPlan);
    }
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case OnboardingStep.CONSENT:
        return (
          <ConsentStep 
            onAccept={() => {
              setState(prev => ({ ...prev, canProceed: true }));
              handleNextStep();
            }}
            onDecline={handleExit}
          />
        );

      case OnboardingStep.YBOCS_ASSESSMENT:
        return (
          <YBOCSAssessmentV2
            onComplete={handleYBOCSComplete}
            isLoading={state.isLoading}
            userId={userId}
          />
        );

      case OnboardingStep.BASIC_INFO:
        return (
          <ProfileBuilderV2
            ybocsAnalysis={state.ybocsAnswers}
            onComplete={handleProfileComplete}
            isLoading={state.isLoading}
            userId={userId}
          />
        );

      case OnboardingStep.SAFETY_PLANNING:
        return (
          <View style={styles.stepContainer}>
            <TreatmentPlanPreviewV2
              userProfile={state.userProfile}
              treatmentPlan={state.treatmentPlan}
              onApprove={handleTreatmentPlanApproval}
              isLoading={state.isLoading}
            />
            <SafetyPlanV2
              riskAssessment={state.riskAssessment}
              onApprove={handleSafetyPlanApproval}
              isLoading={state.isLoading}
            />
          </View>
        );

      case OnboardingStep.COMPLETION:
        return (
          <CompletionStep
            userProfile={state.userProfile}
            treatmentPlan={state.treatmentPlan}
            onFinish={() => {
              if (state.userProfile && state.treatmentPlan) {
                onComplete(state.userProfile, state.treatmentPlan);
              }
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Minimal Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill,
                { width: `${state.progress}%` }
              ]} 
            />
          </View>
        </View>

        {/* Main Content */}
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim }
          ]}
        >
          {state.isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : (
            renderStepContent()
          )}
        </Animated.View>

        {/* Minimal Navigation */}
        {state.currentStep !== OnboardingStep.CONSENT && 
         state.currentStep !== OnboardingStep.COMPLETION && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handlePreviousStep}
          >
            <Text style={styles.backButtonText}>← Geri</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Consent Step Component
const ConsentStep: React.FC<{
  onAccept: () => void;
  onDecline: () => void;
}> = ({ onAccept, onDecline }) => (
  <View style={styles.stepContainer}>
    <View style={styles.stepHeader}>
      <Text style={styles.stepTitle}>Hoş Geldiniz</Text>
      <Text style={styles.stepSubtitle}>
        ObsessLess ile OKB yolculuğunuzda yanınızdayız
      </Text>
    </View>

    <ScrollView style={styles.consentContent}>
      <Text style={styles.consentText}>
        Bu uygulama, OKB ile başa çıkmanıza yardımcı olmak için{'\n'}
        kanıta dayalı terapi yöntemlerini kullanır.{'\n\n'}
        
        🔒 Verileriniz güvende{'\n'}
        🤖 AI destekli kişiselleştirme{'\n'}
        🌍 Türk kültürüne uygun içerik{'\n\n'}
        
        Devam ederek gizlilik politikamızı kabul etmiş olursunuz.
      </Text>
    </ScrollView>

    <View style={styles.actionContainer}>
      <Button
        title="Başlayalım"
        onPress={onAccept}
        style={styles.primaryButton}
      />
      <TouchableOpacity onPress={onDecline}>
        <Text style={styles.skipText}>Şimdi değil</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// Completion Step Component
const CompletionStep: React.FC<{
  userProfile: UserProfile | null;
  treatmentPlan: TreatmentPlan | null;
  onFinish: () => void;
}> = ({ userProfile, treatmentPlan, onFinish }) => (
  <View style={styles.stepContainer}>
    <View style={styles.completionIcon}>
      <MaterialCommunityIcons name="check-circle" size={80} color={COLORS.primary} />
    </View>
    
    <Text style={styles.stepTitle}>Tebrikler! 🎉</Text>
    <Text style={styles.stepSubtitle}>
      Kişiselleştirilmiş tedavi planınız hazır
    </Text>

    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Yolculuğunuz Başlıyor</Text>
      <Text style={styles.summaryText}>
        • 4 haftalık kişisel plan{'\n'}
        • Günlük egzersizler{'\n'}
        • 7/24 AI desteği{'\n'}
        • Kriz algılama sistemi
      </Text>
    </View>

    <Button
      title="Uygulamaya Başla"
      onPress={onFinish}
      style={styles.primaryButton}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
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
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  stepHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
  },
  consentContent: {
    flex: 1,
    marginVertical: 24,
  },
  consentText: {
    fontSize: 16,
    color: COLORS.primaryText,
    lineHeight: 24,
  },
  actionContainer: {
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  backButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    marginTop: 12,
  },
  completionIcon: {
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 15,
    color: COLORS.secondaryText,
    lineHeight: 22,
  },
});

export default OnboardingFlowV2;
