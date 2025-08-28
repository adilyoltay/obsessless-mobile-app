/**
 * 👤 Profile Builder V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun profil oluşturma:
 * - Tek ekran, tek soru
 * - TEK AKSIYON: Tek input veya seçim
 * - Otomatik ilerleme
 * - Minimal görsel karmaşa
 * 
 * Features:
 * ✅ Full-screen single-step layout
 * ✅ SINGLE ACTION: One input per screen
 * ✅ Auto-focus and smooth transitions
 * ✅ Turkish cultural context
 * ✅ Simple form validation
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';

// Types
import {
  YBOCSAnswer,
  UserProfile,
  CulturalContext,
  TherapeuticGoal,
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
  warning: '#F59E0B',
};

interface ProfileBuilderV2Props {
  ybocsAnalysis: YBOCSAnswer[];
  onComplete: (profile: Partial<UserProfile>) => void;
  isLoading?: boolean;
  userId?: string;
}

// Profile steps enum
enum ProfileStep {
  BASIC_INFO = 'basic_info',
  CULTURAL_CONTEXT = 'cultural_context', 
  THERAPEUTIC_GOALS = 'therapeutic_goals',
  COMPLETE = 'complete',
}

interface ProfileState {
  currentStep: ProfileStep;
  progress: number;
  basicInfo: {
    firstName: string;
    age: string;
    gender: string;
  };
  culturalContext: Partial<CulturalContext>;
  therapeuticGoals: string[];
}

const TOTAL_STEPS = 3;

const GENDER_OPTIONS = [
  { value: 'erkek', label: 'Erkek', emoji: '👨' },
  { value: 'kadin', label: 'Kadın', emoji: '👩' },
  { value: 'belirtmek_istemiyorum', label: 'Belirtmek İstemiyorum', emoji: '🤷' },
];

const GOAL_OPTIONS = [
  { value: 'reduce_obsessions', label: 'Obsesyonları azaltmak', emoji: '🧠' },
  { value: 'control_compulsions', label: 'Kompulsiyonları kontrol etmek', emoji: '✋' },
  { value: 'daily_functioning', label: 'Günlük yaşamı iyileştirmek', emoji: '🌅' },
  { value: 'anxiety_management', label: 'Kaygıyı yönetmek', emoji: '😌' },
  { value: 'social_relationships', label: 'İlişkileri geliştirmek', emoji: '👥' },
  { value: 'work_performance', label: 'İş performansını artırmak', emoji: '💼' },
];

export const ProfileBuilderV2: React.FC<ProfileBuilderV2Props> = ({
  ybocsAnalysis,
  onComplete,
  isLoading,
  userId,
}) => {
  const [state, setState] = useState<ProfileState>({
    currentStep: ProfileStep.BASIC_INFO,
    progress: 33, // 1/3 steps
    basicInfo: {
      firstName: '',
      age: '',
      gender: '',
    },
    culturalContext: {
      language: 'tr',
      country: 'TR',
      culturalBackground: ['Turkish'],
      communicationStyle: { formality: 'warm', directness: 'gentle', supportStyle: 'encouraging', humorAcceptable: true, preferredPronoun: 'siz' },
      stigmaFactors: ['family_expectations'],
      supportSystemStructure: 'extended_family',
    },
    therapeuticGoals: [],
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const transitionToStep = (newStep: ProfileStep) => {
    const stepIndex = Object.values(ProfileStep).indexOf(newStep);
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

  // Auto-focus input when step changes
  useEffect(() => {
    if (state.currentStep === ProfileStep.BASIC_INFO && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [state.currentStep]);

  const handleBasicInfoNext = () => {
    if (!state.basicInfo.firstName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    trackAIInteraction(AIEventType.ONBOARDING_STEP_COMPLETED, {
      userId: userId || 'anonymous',
      step: 'basic_info',
      data: { hasFirstName: !!state.basicInfo.firstName },
    });

    transitionToStep(ProfileStep.CULTURAL_CONTEXT);
  };

  const handleCulturalContextNext = () => {
    trackAIInteraction(AIEventType.ONBOARDING_STEP_COMPLETED, {
      userId: userId || 'anonymous',
      step: 'cultural_context',
    });

    transitionToStep(ProfileStep.THERAPEUTIC_GOALS);
  };

  const handleGoalsComplete = () => {
    if (state.therapeuticGoals.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    const profile: Partial<UserProfile> = {
      basicInfo: { age: Number.isFinite(Number(state.basicInfo.age)) ? Number(state.basicInfo.age) : undefined, gender: state.basicInfo.gender },
      culturalContext: state.culturalContext as any,
      therapeuticGoals: state.therapeuticGoals.map(goal => ({
        id: goal,
        description: GOAL_OPTIONS.find(opt => opt.value === goal)?.label || goal,
        priority: 'medium',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
    } as Partial<UserProfile>;

    onComplete(profile);
  };

  const handleGenderSelect = (gender: string) => {
    setState(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, gender }
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleGoalToggle = (goalValue: string) => {
    setState(prev => {
      const goals = prev.therapeuticGoals.includes(goalValue)
        ? prev.therapeuticGoals.filter(g => g !== goalValue)
        : [...prev.therapeuticGoals, goalValue];
      
      return {
        ...prev,
        therapeuticGoals: goals
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case ProfileStep.BASIC_INFO:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tanışalım</Text>
            <Text style={styles.stepSubtitle}>
              Size nasıl hitap edelim?
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder="Adınız"
                value={state.basicInfo.firstName}
                onChangeText={(text) => setState(prev => ({
                  ...prev,
                  basicInfo: { ...prev.basicInfo, firstName: text }
                }))}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={handleBasicInfoNext}
              />
            </View>

            {/* Gender Selection */}
            <View style={styles.genderContainer}>
              <Text style={styles.genderTitle}>Cinsiyet (Opsiyonel)</Text>
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderOption,
                      state.basicInfo.gender === option.value && styles.genderOptionSelected
                    ]}
                    onPress={() => handleGenderSelect(option.value)}
                  >
                    <Text style={styles.genderEmoji}>{option.emoji}</Text>
                    <Text style={[
                      styles.genderLabel,
                      state.basicInfo.gender === option.value && styles.genderLabelSelected
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Devam Et"
              onPress={handleBasicInfoNext}
              style={[
                styles.continueButton,
                !state.basicInfo.firstName.trim() && styles.continueButtonDisabled
              ]}
              disabled={!state.basicInfo.firstName.trim()}
            />
          </View>
        );

      case ProfileStep.CULTURAL_CONTEXT:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Kültürel Bağlam</Text>
            <Text style={styles.stepSubtitle}>
              Türk kültürüne uygun destek sağlıyoruz
            </Text>

            <View style={styles.culturalInfo}>
              <View style={styles.culturalItem}>
                <Text style={styles.culturalEmoji}>🇹🇷</Text>
                <Text style={styles.culturalText}>Türkçe dil desteği</Text>
              </View>
              <View style={styles.culturalItem}>
                <Text style={styles.culturalEmoji}>👨‍👩‍👧‍👦</Text>
                <Text style={styles.culturalText}>Aile değerleri odaklı</Text>
              </View>
              <View style={styles.culturalItem}>
                <Text style={styles.culturalEmoji}>🤲</Text>
                <Text style={styles.culturalText}>Maneviyat dostu yaklaşım</Text>
              </View>
            </View>

            <Button
              title="Devam Et"
              onPress={handleCulturalContextNext}
              style={styles.continueButton}
            />
          </View>
        );

      case ProfileStep.THERAPEUTIC_GOALS:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Hedefleriniz</Text>
            <Text style={styles.stepSubtitle}>
              Hangi konularda destek almak istiyorsunuz?
            </Text>

            <View style={styles.goalsContainer}>
              {GOAL_OPTIONS.slice(0, 4).map((goal) => ( // Show only first 4 goals
                <TouchableOpacity
                  key={goal.value}
                  style={[
                    styles.goalOption,
                    state.therapeuticGoals.includes(goal.value) && styles.goalOptionSelected
                  ]}
                  onPress={() => handleGoalToggle(goal.value)}
                >
                  <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                  <Text style={[
                    styles.goalLabel,
                    state.therapeuticGoals.includes(goal.value) && styles.goalLabelSelected
                  ]}>
                    {goal.label}
                  </Text>
                  {state.therapeuticGoals.includes(goal.value) && (
                    <MaterialCommunityIcons 
                      name="check-circle" 
                      size={24} 
                      color={COLORS.primary} 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.goalHint}>
              {state.therapeuticGoals.length} hedef seçildi
            </Text>

            <Button
              title="Profili Tamamla"
              onPress={handleGoalsComplete}
              style={[
                styles.continueButton,
                state.therapeuticGoals.length === 0 && styles.continueButtonDisabled
              ]}
              disabled={state.therapeuticGoals.length === 0}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Adım {Object.values(ProfileStep).indexOf(state.currentStep) + 1} / {TOTAL_STEPS}
        </Text>
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
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 32,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: COLORS.primaryText,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  genderContainer: {
    marginBottom: 32,
  },
  genderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 16,
    textAlign: 'center',
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  genderOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    minWidth: 100,
  },
  genderOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  genderEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  genderLabel: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  genderLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  culturalInfo: {
    marginBottom: 40,
  },
  culturalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  culturalEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  culturalText: {
    fontSize: 16,
    color: COLORS.primaryText,
    flex: 1,
  },
  goalsContainer: {
    marginBottom: 20,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  goalOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  goalEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  goalLabel: {
    fontSize: 16,
    color: COLORS.primaryText,
    flex: 1,
  },
  goalLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  goalHint: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  continueButtonDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default ProfileBuilderV2;