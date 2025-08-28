/**
 * 🧭 Progressive AI Onboarding Flow Component
 * 
 * Modern onboarding experience that leverages Sprint 7's AI infrastructure:
 * - Y-BOCS Analysis Service integration
 * - Onboarding Engine v2.0 orchestration  
 * - User Profiling Service integration
 * - Treatment Planning Engine preview
 * - Risk Assessment visualization
 * 
 * Features:
 * ✅ Step-by-step progressive disclosure
 * ✅ Contextual help and guidance
 * ✅ Turkish cultural adaptation
 * ✅ Crisis detection and safety protocols
 * ✅ Accessibility (WCAG 2.1 AA)
 * ✅ Offline-first architecture
 * ✅ Privacy-by-design
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// UI Components
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Sprint 7 Backend Services
// ybocsAnalysisService removed with OCD module cleanup
import { modernOnboardingEngine as onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { adaptiveTreatmentPlanningEngine as treatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { advancedRiskAssessmentService as riskAssessmentService } from '@/features/ai/services/riskAssessmentService';

// Previous Sprint Integrations
import { aiManager } from '@/features/ai/config/aiManager';
// Crisis detection removed
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Types
import {
  OnboardingSession,
  OnboardingStep,
  YBOCSAnswer,
  UserTherapeuticProfile as UserProfile,
  TreatmentPlan,
  RiskAssessment,
  AIError,
  ErrorSeverity,
  AIErrorCode
} from '@/features/ai/types';

// UI Components
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Loading } from '@/components/ui/Loading';

// Child Components (to be created)
import { YBOCSAssessmentUI } from './YBOCSAssessmentUI';
import { ProfileBuilderUI } from './ProfileBuilderUI';
import { TreatmentPlanPreview } from './TreatmentPlanPreview';
import { RiskAssessmentIndicator } from './RiskAssessmentIndicator';

// Feature Flags
import { FEATURE_FLAGS } from '@/constants/featureFlags';

interface OnboardingFlowProps {
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onExit,
  userId,
  resumeSession = false
}) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // State
  const [state, setState] = useState<OnboardingState>({
    currentStep: OnboardingStep.WELCOME,
    session: null,
    userProfile: null,
    treatmentPlan: null,
    riskAssessment: null,
    isLoading: false,
    error: null,
    progress: 0,
    ybocsAnswers: [],
    canProceed: false
  });

  // Check feature flags
  const isAIOnboardingEnabled = true;
  const isYBOCSAnalysisEnabled = FEATURE_FLAGS.isEnabled('AI_YBOCS_ANALYSIS');
  const isUserProfilingEnabled = FEATURE_FLAGS.isEnabled('AI_USER_PROFILING');
  const isTreatmentPlanningEnabled = FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING');
  const isRiskAssessmentEnabled = FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT');

  /**
   * 🚀 Initialize Onboarding Session
   */
  const initializeOnboarding = useCallback(async () => {
    if (!isAIOnboardingEnabled) {
      Alert.alert(
        'Özellik Kullanılamıyor',
        'AI destekli onboarding şu anda aktif değil.',
        [{ text: 'Tamam', onPress: onExit }]
      );
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Track onboarding start
      await trackAIInteraction(AIEventType.ONBOARDING_SESSION_STARTED, {
        userId,
        resumeSession,
        culturalContext: 'turkish',
        deviceInfo: Platform.OS
      });

      // Initialize or resume session
      let session: OnboardingSession;
      
      if (resumeSession) {
        const savedSession = await AsyncStorage.getItem(`onboarding_session_${userId || 'anon'}`);
        if (savedSession) {
          session = JSON.parse(savedSession);
          console.log('📱 Onboarding session resumed:', session.id);
        } else {
          session = await onboardingEngine.initializeSession(userId, {
            culturalContext: 'turkish',
            preferredLanguage: 'tr',
            deviceCapabilities: {
              pushNotifications: true,
              biometrics: Platform.OS === 'ios',
              offline: true
            }
          });
        }
      } else {
        session = await onboardingEngine.initializeSession(userId, {
          culturalContext: 'turkish',
          preferredLanguage: 'tr',
          deviceCapabilities: {
            pushNotifications: true,
            biometrics: Platform.OS === 'ios',
            offline: true
          }
        });
      }

      // Calculate progress
      const stepProgress = calculateStepProgress(session.currentStep);

      setState(prev => ({
        ...prev,
        session,
        currentStep: session.currentStep,
        progress: stepProgress,
        isLoading: false,
        canProceed: true
      }));

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: stepProgress,
          duration: 800,
          useNativeDriver: false,
        })
      ]).start();

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    } catch (error) {
      console.error('❌ Onboarding initialization error:', error);
      
      const aiError: AIError = {
        code: AIErrorCode.INITIALIZATION_FAILED,
        message: `Onboarding initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        context: {
          component: 'OnboardingFlow',
          method: 'initializeOnboarding',
          userId,
          resumeSession
        }
      };

      await trackAIInteraction(AIEventType.API_ERROR, { error: aiError });

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Onboarding başlatılırken bir hata oluştu. Lütfen tekrar deneyin.',
        canProceed: false
      }));
    }
  }, [userId, resumeSession, isAIOnboardingEnabled, onExit, fadeAnim, slideAnim, progressAnim]);

  /**
   * 📊 Calculate Step Progress
   */
  const calculateStepProgress = (step: OnboardingStep): number => {
    const stepOrder = [
      OnboardingStep.WELCOME,
      OnboardingStep.CONSENT, // ✅ Doğru enum değeri
      OnboardingStep.BASIC_INFO,
      OnboardingStep.YBOCS_ASSESSMENT,
      OnboardingStep.SYMPTOM_EXPLORATION, // ✅ Doğru enum değeri
      OnboardingStep.TREATMENT_PLANNING, // ✅ Doğru enum değeri
      OnboardingStep.SAFETY_PLANNING, // ✅ Doğru enum değeri
      OnboardingStep.COMPLETION
    ];
    
    const currentIndex = stepOrder.indexOf(step);
    return currentIndex >= 0 ? (currentIndex / (stepOrder.length - 1)) * 100 : 0;
  };

  /**
   * 🔄 Get Next Step in Onboarding Flow
   */
  const getNextStep = (currentStep: OnboardingStep): OnboardingStep | null => {
    const stepOrder = [
      OnboardingStep.WELCOME,
      OnboardingStep.CONSENT, // ✅ PRIVACY_CONSENT yerine CONSENT
      OnboardingStep.BASIC_INFO,
      OnboardingStep.YBOCS_ASSESSMENT,
      OnboardingStep.SYMPTOM_EXPLORATION, // ✅ PROFILE_BUILDING yerine gerçek enum değeri
      OnboardingStep.TREATMENT_PLANNING, // ✅ TREATMENT_PREVIEW yerine gerçek enum değeri
      OnboardingStep.SAFETY_PLANNING, // ✅ SAFETY_PLAN yerine gerçek enum değeri
      OnboardingStep.COMPLETION
    ];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      return stepOrder[currentIndex + 1];
    }
    return null; // No more steps
  };

  /**
   * 📈 Calculate Progress Percentage
   */
  const calculateProgress = (step: OnboardingStep): number => {
    return calculateStepProgress(step);
  };


  /**
   * 🧠 Handle Y-BOCS Assessment Completion
   */
  const handleYBOCSCompletion = useCallback(async (answers: YBOCSAnswer[]) => {
    console.log('🧭 OnboardingFlow: handleYBOCSCompletion called with', answers.length, 'answers');
    
    if (!isYBOCSAnalysisEnabled || !state.session) {
      console.warn('⚠️ Y-BOCS completion blocked:', { isYBOCSAnalysisEnabled, hasSession: !!state.session });
      return;
    }

    console.log('🔄 Starting Y-BOCS analysis...');
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Analyze Y-BOCS responses (minimal local analysis)
      const analysis = (() => {
        const totalScore = (answers || []).reduce((s: number, a: any) => s + (Number(a?.response ?? 0) || 0), 0);
        const severityLevel = totalScore > 31 ? 'extreme' : totalScore > 23 ? 'severe' : totalScore > 15 ? 'moderate' : totalScore > 7 ? 'mild' : 'minimal';
        return { totalScore, severityLevel, dominantSymptoms: [], riskFactors: [] } as any;
      })();
      console.log('✅ Y-BOCS analysis completed:', { 
        severityLevel: analysis.severityLevel, 
        totalScore: analysis.totalScore 
      });

      // Update session with Y-BOCS data
      console.log('💾 Updating session with Y-BOCS data...');
      const updatedSession = await onboardingEngine.updateSessionData(
        state.session.id,
        { ybocsAnalysis: analysis }
      );
      console.log('✅ Session updated successfully');

      console.log('🔄 Updating OnboardingFlow state...');
      setState(prev => ({
        ...prev,
        ybocsAnswers: answers,
        session: updatedSession,
        canProceed: true,
        isLoading: false
      }));
      console.log('✅ OnboardingFlow state updated');

      // Track Y-BOCS completion
      console.log('📊 Tracking Y-BOCS completion...');
      await trackAIInteraction(AIEventType.YBOCS_ANALYSIS_COMPLETED, {
        sessionId: state.session.id,
        severityLevel: analysis.severityLevel,
        primarySymptoms: analysis.dominantSymptoms || [],
        riskFactors: analysis.riskFactors.length
      });
      console.log('✅ Y-BOCS completion tracked');

      console.log('🎉 Y-BOCS completion process finished successfully!');

      // Move to next step (Symptom Exploration)
      console.log('🚀 Moving to next step: SYMPTOM_EXPLORATION');
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentStep: OnboardingStep.SYMPTOM_EXPLORATION, // ✅ Doğru enum değeri
          canProceed: true // Enable continue button for symptom exploration
        }));
        console.log('✅ Moved to SYMPTOM_EXPLORATION step with canProceed: true');
      }, 1000); // Small delay for user feedback

    } catch (error) {
      console.error('❌ Y-BOCS analysis error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Y-BOCS analizi sırasında hata oluştu.'
      }));
    }
  }, [isYBOCSAnalysisEnabled, state.session]);

  /**
   * 👤 Handle Profile Building Completion
   */
  const handleProfileCompletion = useCallback(async (profileData: Partial<UserProfile>) => {
    if (!isUserProfilingEnabled || !state.session) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Generate AI-enhanced profile
      const enhancedProfile = await userProfilingService.generateProfile(userId, {
        basicInfo: profileData,
        ybocsData: state.ybocsAnswers,
        culturalContext: 'turkish'
      });

      setState(prev => ({
        ...prev,
        userProfile: enhancedProfile as any,
        canProceed: true,
        isLoading: false
      }));

      // Track profile generation
      await trackAIInteraction(AIEventType.USER_PROFILE_GENERATED, {
        sessionId: state.session.id,
        // completenessScore removed from telemetry to match relaxed profile shape
        primaryGoals: (enhancedProfile as any).therapeuticGoals?.slice(0, 3)
      });

      // 🚀 CRITICAL: Move to next step after profile completion
      console.log('🚀 Profile completed, moving to next step: TREATMENT_PLANNING');
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentStep: OnboardingStep.TREATMENT_PLANNING,
          canProceed: true // Enable continue button for treatment planning
        }));
        console.log('✅ Moved to TREATMENT_PLANNING step with canProceed: true');
      }, 1000);

    } catch (error) {
      console.error('❌ Profile generation error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Profil oluşturulurken hata oluştu.'
      }));
    }
  }, [isUserProfilingEnabled, state.session, userId]);

  /**
   * 📋 Generate Treatment Plan Preview
   */
  const generateTreatmentPlan = useCallback(async () => {
    if (!isTreatmentPlanningEnabled || !state.userProfile || !state.session) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Generate treatment plan
      const treatmentPlan = await treatmentPlanningEngine.generateTreatmentPlan(userId, {
        userProfile: state.userProfile,
        ybocsAnalysis: state.ybocsAnswers,
        culturalAdaptation: 'turkish'
      });

      // Risk assessment
      let riskAssessment: RiskAssessment | null = null;
      if (isRiskAssessmentEnabled) {
        riskAssessment = await riskAssessmentService.assessRisk(userId, {
          userProfile: state.userProfile,
          ybocsData: state.ybocsAnswers,
          treatmentPlan
        });
      }

      setState(prev => ({
        ...prev,
        treatmentPlan,
        riskAssessment,
        canProceed: true,
        isLoading: false
      }));

      // Track plan generation
      await trackAIInteraction(AIEventType.TREATMENT_PLAN_GENERATED, {
        sessionId: state.session.id,
        planDuration: treatmentPlan.estimatedDuration,
        phases: Array.isArray(treatmentPlan.phases) ? treatmentPlan.phases.length : 0,
      });

    } catch (error) {
      console.error('❌ Treatment plan generation error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Tedavi planı oluşturulurken hata oluştu.'
      }));
    }
  }, [isTreatmentPlanningEnabled, isRiskAssessmentEnabled, state.userProfile, state.session, userId]);

  /**
   * 📋 Handle Treatment Plan Completion
   */
  const handleTreatmentPlanCompletion = useCallback(async (treatmentPlan: TreatmentPlan) => {
    if (!isRiskAssessmentEnabled || !state.session) return;

    console.log('📋 Treatment plan completed, moving to SAFETY_PLANNING');
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Generate risk assessment based on treatment plan
      const riskAssessment = await riskAssessmentService.assessRisk(userId, {
        userProfile: state.userProfile || ({} as any),
        ybocsData: state.ybocsAnswers,
        treatmentPlan: treatmentPlan
      });

      setState(prev => ({
        ...prev,
        riskAssessment,
        isLoading: false,
        canProceed: true
      }));

      // Track treatment plan completion
      await trackAIInteraction(AIEventType.TREATMENT_PLAN_GENERATED, {
        sessionId: state.session.id,
        planId: treatmentPlan.id,
        phases: Array.isArray(treatmentPlan.phases) ? treatmentPlan.phases.length : 0,
        estimatedDuration: treatmentPlan.estimatedDuration
      });

      // 🚀 CRITICAL: Move to next step after treatment plan completion
      console.log('🚀 Treatment plan completed, moving to next step: SAFETY_PLANNING');
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentStep: OnboardingStep.SAFETY_PLANNING,
          canProceed: true // Enable continue button for safety planning
        }));
        console.log('✅ Moved to SAFETY_PLANNING step with canProceed: true');
      }, 1000);

    } catch (error) {
      console.error('❌ Treatment plan completion error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Risk değerlendirmesi sırasında hata oluştu.'
      }));
    }
  }, [isRiskAssessmentEnabled, state.session, state.userProfile, userId]);

  /**
   * 🛡️ Handle Risk Assessment Completion  
   */
  const handleRiskAssessmentCompletion = useCallback(async () => {
    if (!state.session) return;

    console.log('🛡️ Risk assessment reviewed, moving to COMPLETION');

    // 🚀 CRITICAL: Move to completion step
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: OnboardingStep.COMPLETION,
        canProceed: true // Enable completion button
      }));
      console.log('✅ Moved to COMPLETION step with canProceed: true');
    }, 500);

  }, [state.session]);

  /**
   * ✅ Complete Onboarding
   */
  const completeOnboarding = useCallback(async () => {
    if (!state.session || !state.userProfile || !state.treatmentPlan) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Finalize onboarding session
      await onboardingEngine.finalizeSession(state.session.id);

      // Save completed data
      await AsyncStorage.multiSet([
        [`user_profile_${userId}`, JSON.stringify(state.userProfile)],
        [`treatment_plan_${userId}`, JSON.stringify(state.treatmentPlan)],
        [`onboarding_completed_${userId}`, new Date().toISOString()]
      ]);

      // Clear session storage
      await AsyncStorage.removeItem(`onboarding_session_${userId}`);

      // Track completion
      await trackAIInteraction(AIEventType.ONBOARDING_SESSION_COMPLETED, {
        sessionId: state.session.id,
        totalDuration: Date.now() - new Date(state.session.startTime).getTime(),
        completedSteps: Array.isArray(state.session.completedSteps) ? state.session.completedSteps.length : 0,
      });

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Complete with results
      onComplete(state.userProfile, state.treatmentPlan);

    } catch (error) {
      console.error('❌ Onboarding completion error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Onboarding tamamlanırken hata oluştu.'
      }));
    }
  }, [state.session, state.userProfile, state.treatmentPlan, state.riskAssessment, userId, onComplete]);

  /**
   * ➡️ Proceed to Next Step
   */
  const proceedToNextStep = useCallback(async () => {
    console.log('🔄 proceedToNextStep called - session:', !!state.session, 'isLoading:', state.isLoading, 'canProceed:', state.canProceed);
    
    if (!state.session || state.isLoading) {
      console.log('❌ proceedToNextStep blocked - session:', !!state.session, 'isLoading:', state.isLoading);
      return;
    }

    console.log('✅ proceedToNextStep proceeding...');
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('🧭 Proceeding to next step from:', state.currentStep);
      
      // Update session with current step progress
      const updatedSession = await onboardingEngine.updateStep(
        state.session.id,
        state.currentStep,
        { completed: true, timestamp: new Date() }
      );

      // Determine next step
      const nextStep = getNextStep(state.currentStep);
      console.log('🔄 getNextStep result:', state.currentStep, '->', nextStep);
      
      if (nextStep) {
        console.log('✅ Moving to next step:', nextStep);
        setState(prev => ({
          ...prev,
          currentStep: nextStep,
          session: { ...updatedSession, currentStep: nextStep },
          progress: calculateProgress(nextStep),
          canProceed: false, // Reset for next step
          isLoading: false
        }));

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Track step progression
        await trackAIInteraction(AIEventType.ONBOARDING_STEP_COMPLETED, {
          sessionId: state.session.id,
          completedStep: state.currentStep,
          nextStep,
          progress: calculateProgress(nextStep)
        });

      } else {
        // No more steps, complete onboarding
        await completeOnboarding();
      }

    } catch (error) {
      console.error('❌ Step progression error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Adım geçişinde hata oluştu.'
      }));
    }
  }, [state.session, state.currentStep, state.isLoading, completeOnboarding]);



  /**
   * 🚫 Handle Back Navigation
   */
  const handleBackPress = useCallback(() => {
    Alert.alert(
      'Onboarding\u2019den Çık',
      'Kaydedilmemiş ilerlemeniz kaybolacak. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çık', 
          style: 'destructive',
          onPress: onExit
        }
      ]
    );
    return true;
  }, [onExit]);

  // Initialize onboarding on mount
  useEffect(() => {
    initializeOnboarding();
  }, [initializeOnboarding]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [handleBackPress]);

  // Trigger specific step actions
  useEffect(() => {
    switch (state.currentStep) {
      case OnboardingStep.YBOCS_ASSESSMENT:
        setState(prev => ({ ...prev, canProceed: state.ybocsAnswers.length > 0 }));
        break;
      case OnboardingStep.SYMPTOM_EXPLORATION: // ✅ PROFILE_BUILDING yerine doğru enum
        setState(prev => ({ ...prev, canProceed: !!state.userProfile }));
        break;
      case OnboardingStep.TREATMENT_PLANNING: // ✅ TREATMENT_PREVIEW yerine doğru enum
        if (state.userProfile && !state.treatmentPlan) {
          generateTreatmentPlan();
        }
        setState(prev => ({ ...prev, canProceed: !!state.treatmentPlan }));
        break;
      case OnboardingStep.COMPLETION:
        setState(prev => ({ ...prev, canProceed: true }));
        break;
      default:
        setState(prev => ({ ...prev, canProceed: true }));
    }
  }, [state.currentStep, state.ybocsAnswers, state.userProfile, state.treatmentPlan, generateTreatmentPlan]);

  /**
   * 🎨 Render Step Content
   */
  const renderStepContent = () => {
    console.log('🎨 renderStepContent called for step:', state.currentStep);
    switch (state.currentStep) {
      case OnboardingStep.WELCOME:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>ObsessLess’e Hoş Geldiniz 🌟</Text>
            <Text style={styles.stepDescription}>
              OKB ile mücadelenizde size özel, AI destekli bir deneyim oluşturacağız. 
              Bu süreç yaklaşık 10-15 dakika sürecek.
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>✅ Kişiselleştirilmiş değerlendirme</Text>
              <Text style={styles.featureItem}>✅ AI destekli tedavi planı</Text>
              <Text style={styles.featureItem}>✅ Güvenli ve özel</Text>
              <Text style={styles.featureItem}>✅ Türkçe ve kültürümüze uygun</Text>
            </View>
          </Card>
        );

      case OnboardingStep.CONSENT:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>Gizlilik ve Güvenlik 🔒</Text>
            <Text style={styles.stepDescription}>
              Verileriniz cihazınızda güvenle saklanır. AI analizleri anonim olarak yapılır 
              ve hassas bilgileriniz asla paylaşılmaz.
            </Text>
            <View style={styles.consentOptions}>
              <View style={styles.consentItem}>
                <Text style={styles.consentText}>✓ Y-BOCS değerlendirme verilerinin AI analizi</Text>
              </View>
              <View style={styles.consentItem}>
                <Text style={styles.consentText}>✓ Kişiselleştirilmiş öneriler için profil oluşturma</Text>
              </View>
              <View style={styles.consentItem}>
                <Text style={styles.consentText}>✓ Anonim kullanım analitiği</Text>
              </View>
            </View>
          </Card>
        );

      case OnboardingStep.BASIC_INFO:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>Temel Bilgiler 📝</Text>
            <Text style={styles.stepDescription}>
              Size en uygun deneyimi sunabilmemiz için bazı temel bilgilere ihtiyacımız var.
            </Text>
            {/* BasicInfoForm component will be implemented */}
          </Card>
        );

      case OnboardingStep.YBOCS_ASSESSMENT:
        return (
          <YBOCSAssessmentUI
            onComplete={handleYBOCSCompletion}
            isLoading={state.isLoading}
          />
        );

      case OnboardingStep.SYMPTOM_EXPLORATION:
        return (
          <ProfileBuilderUI
            ybocsAnalysis={undefined}
            onComplete={handleProfileCompletion}
            isLoading={state.isLoading}
          />
        );

      case OnboardingStep.TREATMENT_PLANNING:
        return (
          <TreatmentPlanPreview
            userProfile={state.userProfile}
            treatmentPlan={state.treatmentPlan}
            onComplete={handleTreatmentPlanCompletion}
            isLoading={state.isLoading}
          />
        );

      case OnboardingStep.SAFETY_PLANNING:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>Güvenlik Planınız 🛡️</Text>
            <Text style={styles.stepDescription}>
              Zorlu anlarınızda size yardımcı olacak güvenlik planınızı oluşturduk.
            </Text>
            {state.riskAssessment && (
              <RiskAssessmentIndicator 
                riskAssessment={state.riskAssessment}
                showDetails={true}
              />
            )}
            <View style={styles.safetyActions}>
              <Button
                title="✅ Güvenlik Planını Onayla"
                onPress={() => {
                  console.log('✅ Safety plan approved, calling handleRiskAssessmentCompletion');
                  handleRiskAssessmentCompletion();
                }}
                style={styles.approveButton}
              />
            </View>
          </Card>
        );

      case OnboardingStep.COMPLETION:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>Tebrikler! 🎉</Text>
            <Text style={styles.stepDescription}>
              ObsessLess deneyiminiz hazır. Size özel AI destekli tedavi yolculuğunuz başlıyor.
            </Text>
            <View style={styles.completionSummary}>
              <Text style={styles.summaryItem}>
                ✅ Y-BOCS değerlendirmeniz tamamlandı
              </Text>
              <Text style={styles.summaryItem}>
                ✅ Kişisel profiliniz oluşturuldu
              </Text>
              <Text style={styles.summaryItem}>
                ✅ Tedavi planınız hazırlandı
              </Text>
              <Text style={styles.summaryItem}>
                ✅ Güvenlik protokolleriniz aktif
              </Text>
            </View>
          </Card>
        );

      default:
        return (
          <Card style={styles.stepCard}>
            <Text style={styles.stepTitle}>Yükleniyor...</Text>
          </Card>
        );
    }
  };

  if (!isAIOnboardingEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.disabledContainer}>
          <Text style={styles.disabledTitle}>AI Onboarding Kullanılamıyor</Text>
          <Text style={styles.disabledText}>
            Bu özellik şu anda aktif değil. Lütfen daha sonra tekrar deneyin.
          </Text>
          <Button title="Geri Dön" onPress={onExit} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={state.progress} 
              height={4}
            />
            <Text style={styles.progressText}>
              {Math.round(state.progress)}% tamamlandı
            </Text>
          </View>
        </View>

        {/* Content */}
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}

            {/* Error Display */}
            {state.error && (
              <Card style={styles.errorCard}>
                <Text style={styles.errorText}>⚠️ {state.error}</Text>
                <Button
                  title="Tekrar Dene"
                  onPress={initializeOnboarding}
                  variant="outline"
                />
              </Card>
            )}
          </ScrollView>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.buttonContainer}>
            <Button
              title="Çıkış"
              onPress={handleBackPress}
              variant="outline"
              style={styles.exitButton}
            />
            
            {state.currentStep === OnboardingStep.COMPLETION ? (
              <Button
                title="Başla!"
                onPress={completeOnboarding}
                disabled={!state.canProceed || state.isLoading}
                style={styles.nextButton}
              />
            ) : (
              <Button
                title="Devam Et"
                onPress={() => {
                  console.log('🔘 Devam Et button pressed - canProceed:', state.canProceed, 'isLoading:', state.isLoading, 'session:', !!state.session);
                  proceedToNextStep();
                }}
                disabled={!state.canProceed || state.isLoading}
                style={styles.nextButton}
              />
            )}
          </View>
        </View>

        {/* Loading Overlay */}
        {state.isLoading && <Loading overlay />}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  gradient: {
    flex: 1,
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disabledTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  disabledText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  stepCard: {
    padding: 24,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  featureList: {
    marginTop: 16,
  },
  featureItem: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    paddingLeft: 8,
  },
  consentOptions: {
    marginTop: 16,
  },
  consentItem: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  consentText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 20,
  },
  completionSummary: {
    marginTop: 16,
  },
  summaryItem: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
    paddingLeft: 8,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exitButton: {
    flex: 0.4,
    marginRight: 12,
  },
  nextButton: {
    flex: 0.6,
  },
  safetyActions: {
    marginTop: 20,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
});

export default OnboardingFlow;