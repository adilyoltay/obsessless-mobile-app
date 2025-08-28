/**
 * 🧭 Progressive AI Onboarding Flow V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun yeniden tasarlanmış onboarding deneyimi:
 * - "Sakinlik Her Şeyden Önce Gelir" - Minimalist tam ekran tasarım
 * - "Zahmetsizlik Esastır" - Tek aksiyon, net flow
 * - "Güç Kullanıcıdadır" - Skip ve geri dönme seçenekleri
 * 
 * ⚡ SIMPLIFIED VERSION - No complex engine dependencies
 * ✅ Direct state management
 * ✅ Simple step progression
 * ✅ Reliable button rendering
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UI Components
import Button from '@/components/ui/Button';

// Child Components (Simplified)
import { YBOCSAssessmentV2 } from './YBOCSAssessmentV2';
import { ProfileBuilderV2 } from './ProfileBuilderV2';

// Types
import {
  YBOCSAnswer,
  UserProfile,
  TreatmentPlan,
} from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Anayasa v2.0 Renk Paleti
const COLORS = {
  background: '#F9FAFB',
  primary: '#10B981',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  error: '#EF4444',
};

interface OnboardingFlowV2Props {
  onComplete: (userProfile: UserProfile, treatmentPlan: TreatmentPlan) => void;
  onExit: () => void;
  userId: string;
  resumeSession?: boolean;
}

// Simple step enum
enum SimpleStep {
  CONSENT = 'consent',
  YBOCS = 'ybocs',
  PROFILE = 'profile',
  COMPLETE = 'complete',
}

interface SimpleState {
  currentStep: SimpleStep;
  progress: number;
  ybocsAnswers: YBOCSAnswer[];
  userProfile: Partial<UserProfile> | null;
  isLoading: boolean;
}

const TOTAL_STEPS = 4;

export const OnboardingFlowV2: React.FC<OnboardingFlowV2Props> = ({
  onComplete,
  onExit,
  userId,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [state, setState] = useState<SimpleState>({
    currentStep: SimpleStep.CONSENT,
    progress: 25, // 1/4 steps
    ybocsAnswers: [],
    userProfile: null,
    isLoading: false,
  });

  const transitionToStep = (newStep: SimpleStep) => {
    const stepIndex = Object.values(SimpleStep).indexOf(newStep);
    const newProgress = ((stepIndex + 1) / TOTAL_STEPS) * 100;

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
      progress: newProgress,
    }));

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConsentAccept = async () => {
    console.log('✅ Consent accepted');
    
    // Track consent
    await trackAIInteraction(AIEventType.ONBOARDING_SESSION_STARTED, {
      userId,
      step: 'consent_accepted',
    });

    transitionToStep(SimpleStep.YBOCS);
  };

  const handleYBOCSComplete = async (answers: YBOCSAnswer[]) => {
    console.log('✅ Y-BOCS completed with', answers.length, 'answers');
    
    setState(prev => ({ ...prev, ybocsAnswers: answers }));
    
    // Track Y-BOCS completion
    await trackAIInteraction(AIEventType.YBOCS_COMPLETED, {
      userId,
      totalScore: answers.reduce((sum, a: any) => sum + Number(a?.value ?? 0), 0),
      answersCount: answers.length,
    });

    transitionToStep(SimpleStep.PROFILE);
  };

  const handleProfileComplete = async (profileData: Partial<UserProfile>) => {
    console.log('✅ Profile completed');
    
    setState(prev => ({ ...prev, userProfile: profileData }));
    
    // Track profile completion
    await trackAIInteraction(AIEventType.PROFILE_CREATED, {
      userId,
      hasGoals: !!profileData.therapeuticGoals?.length,
      hasCulturalContext: !!profileData.culturalContext,
    });

    transitionToStep(SimpleStep.COMPLETE);
  };

  const handleComplete = async () => {
    console.log('✅ Onboarding completed');

    // Create mock treatment plan
    const mockTreatmentPlan: any = {
      id: `plan_${userId}_${Date.now()}`,
      userId,
      createdAt: new Date(),
      lastUpdated: new Date(),
      currentPhase: 0,
      estimatedDuration: 4,
      userProfile: {
        preferredLanguage: 'tr',
        symptomSeverity: 0,
        communicationStyle: { formality: 'casual', directness: 'gentle', supportStyle: 'encouraging', humorAcceptable: false, preferredPronoun: 'they' },
        triggerWords: [], avoidanceTopics: [], preferredCBTTechniques: [], therapeuticGoals: [], riskFactors: []
      },
      culturalAdaptations: ['Türk kültürüne uygun örnekler'],
      accessibilityAccommodations: [],
      evidenceBasedInterventions: [],
      expectedOutcomes: [],
      successMetrics: [],
      adaptationTriggers: [],
      fallbackStrategies: [],
      emergencyProtocols: [],
      phases: [
        {
          id: 'phase-1',
          name: 'Farkındalık ve Kabul',
          description: 'OKB semptomlarına güvenli farkındalık',
          estimatedDuration: 1,
          objectives: ['OKB semptomlarını tanıma', 'Tetikleyicileri belirleme'],
          interventions: [],
          milestones: [],
          prerequisites: [],
          successCriteria: []
        }
      ]
    };

    // Create user profile
    const fullUserProfile: any = {
      userId,
      basicInfo: state.userProfile?.basicInfo || {
        age: 25,
        gender: 'belirtmek_istemiyorum',
      },
      culturalContext: state.userProfile?.culturalContext || {
        language: 'tr',
        country: 'TR',
        culturalBackground: ['Turkish'],
        communicationStyle: { formality: 'warm', directness: 'gentle', supportStyle: 'encouraging', humorAcceptable: true, preferredPronoun: 'siz' },
        stigmaFactors: [],
        supportSystemStructure: 'extended_family',
      },
      therapeuticGoals: state.userProfile?.therapeuticGoals || [],
      riskFactors: [],
      strengths: [],
      vulnerabilities: [],
      ocdSeverity: 'moderate',
      ocdThemes: ['contamination'],
      copingMechanisms: [],
      supportSystem: [],
      lastAssessmentDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem(`onboarding_completed_${userId}`, 'true');
      await AsyncStorage.setItem(`user_profile_${userId}`, JSON.stringify(fullUserProfile));
      await AsyncStorage.setItem(`treatment_plan_${userId}`, JSON.stringify(mockTreatmentPlan));
    } catch (error) {
      console.error('Error saving onboarding data:', error);
    }

    // Track completion
    await trackAIInteraction(AIEventType.ONBOARDING_SESSION_COMPLETED, {
      userId,
      totalSteps: TOTAL_STEPS,
      ybocsScore: state.ybocsAnswers.reduce((sum, a: any) => sum + Number(a?.value ?? 0), 0),
    });

    onComplete(fullUserProfile, mockTreatmentPlan);
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case SimpleStep.CONSENT:
        return <ConsentStep onAccept={handleConsentAccept} onDecline={onExit} />;

      case SimpleStep.YBOCS:
        return (
          <YBOCSAssessmentV2
            onComplete={handleYBOCSComplete}
            isLoading={state.isLoading}
            userId={userId}
          />
        );

      case SimpleStep.PROFILE:
        return (
          <ProfileBuilderV2
            ybocsAnalysis={state.ybocsAnswers}
            onComplete={handleProfileComplete}
            isLoading={state.isLoading}
            userId={userId}
          />
        );

      case SimpleStep.COMPLETE:
        return (
          <CompletionStep 
            onFinish={handleComplete}
            ybocsScore={state.ybocsAnswers.reduce((sum, a: any) => sum + Number(a?.value ?? 0), 0)}
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
          {renderStepContent()}
        </Animated.View>
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
  onFinish: () => void;
  ybocsScore: number;
}> = ({ onFinish, ybocsScore }) => (
  <View style={styles.stepContainer}>
    <View style={styles.completionIcon}>
      <MaterialCommunityIcons name="check-circle" size={80} color={COLORS.primary} />
    </View>
    
    <Text style={styles.stepTitle}>Tebrikler! 🎉</Text>
    <Text style={styles.stepSubtitle}>
      Kişiselleştirilmiş destek sisteminiz hazır
    </Text>

    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>Yolculuğunuz Başlıyor</Text>
      <Text style={styles.summaryText}>
        • Y-BOCS değerlendirmeniz tamamlandı{'\n'}
        • Kişisel profiliniz oluşturuldu{'\n'}
        • AI destekli takip sistemi aktif{'\n'}
        • Günlük destek araçları hazır
      </Text>
      
      {ybocsScore > 0 && (
        <Text style={styles.scoreText}>
          Değerlendirme puanınız: {ybocsScore}/20
        </Text>
      )}
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
  scoreText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 12,
  },
});

export default OnboardingFlowV2;