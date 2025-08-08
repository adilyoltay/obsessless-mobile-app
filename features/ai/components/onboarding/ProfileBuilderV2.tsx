/**
 * 👤 Profile Builder V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun profil oluşturma:
 * - Her adım tam ekran
 * - Minimal form alanları
 * - Tek aksiyon prensibi
 * - Otomatik odaklanma
 * 
 * Features:
 * ✅ Full-screen step design
 * ✅ Auto-focus next field
 * ✅ Keyboard avoiding view
 * ✅ Cultural adaptation
 * ✅ Privacy-first approach
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';

// Types
import {
  UserProfile,
  YBOCSAnswer,
  CulturalContext,
  ProfileStep,
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
  ybocsAnalysis?: YBOCSAnswer[];
  onComplete: (profileData: Partial<UserProfile>) => void;
  isLoading?: boolean;
  userId?: string;
}

interface ProfileFormData {
  firstName: string;
  age: string;
  gender: string;
  occupation: string;
  culturalFactors: string[];
  therapyGoals: string[];
}

const PROFILE_STEPS = [
  { id: 'name', title: 'Adınız nedir?', subtitle: 'Size nasıl hitap edelim?' },
  { id: 'age', title: 'Yaşınız kaç?', subtitle: 'Yaş grubunuza uygun içerik sunmak için' },
  { id: 'gender', title: 'Cinsiyetiniz?', subtitle: 'Kişiselleştirilmiş destek için (opsiyonel)' },
  { id: 'occupation', title: 'Mesleğiniz?', subtitle: 'Günlük rutininizi anlamak için' },
  { id: 'cultural', title: 'Kültürel değerleriniz', subtitle: 'Size özel yaklaşım için' },
  { id: 'goals', title: 'Hedefleriniz', subtitle: 'Neyi başarmak istiyorsunuz?' },
];

const CULTURAL_OPTIONS = [
  { id: 'family_values', label: 'Aile değerleri önemli', icon: 'home-heart' },
  { id: 'religious_values', label: 'Dini değerler önemli', icon: 'hands-pray' },
  { id: 'privacy_important', label: 'Gizlilik çok önemli', icon: 'shield-lock' },
  { id: 'traditional_approach', label: 'Geleneksel yaklaşım', icon: 'account-group' },
];

const THERAPY_GOALS = [
  { id: 'reduce_obsessions', label: 'Obsesyonları azaltmak', icon: 'head-minus' },
  { id: 'reduce_compulsions', label: 'Kompulsiyonları azaltmak', icon: 'hand-back-left' },
  { id: 'improve_daily_life', label: 'Günlük yaşamı iyileştirmek', icon: 'calendar-check' },
  { id: 'reduce_anxiety', label: 'Kaygıyı azaltmak', icon: 'emoticon-happy' },
  { id: 'better_relationships', label: 'İlişkileri düzeltmek', icon: 'account-heart' },
];

export const ProfileBuilderV2: React.FC<ProfileBuilderV2Props> = ({
  ybocsAnalysis,
  onComplete,
  isLoading,
  userId,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    age: '',
    gender: '',
    occupation: '',
    culturalFactors: [],
    therapyGoals: [],
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);

  const currentStep = PROFILE_STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / PROFILE_STEPS.length) * 100;

  useEffect(() => {
    // Auto-focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, [currentStepIndex]);

  const handleNext = () => {
    // Validate current step
    if (!validateStep()) return;

    // Check if completed
    if (currentStepIndex === PROFILE_STEPS.length - 1) {
      completeProfile();
      return;
    }

    // Transition to next step
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
    ]).start(() => {
      setCurrentStepIndex(currentStepIndex + 1);
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePrevious = () => {
    if (currentStepIndex === 0) return;

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
    ]).start(() => {
      setCurrentStepIndex(currentStepIndex - 1);
    });
  };

  const validateStep = (): boolean => {
    switch (currentStep.id) {
      case 'name':
        return formData.firstName.trim().length > 0;
      case 'age':
        const age = parseInt(formData.age);
        return age > 0 && age < 120;
      case 'cultural':
        return formData.culturalFactors.length > 0;
      case 'goals':
        return formData.therapyGoals.length > 0;
      default:
        return true;
    }
  };

  const completeProfile = async () => {
    const profileData: Partial<UserProfile> = {
      basicInfo: {
        firstName: formData.firstName,
        age: formData.age,
        gender: formData.gender || undefined,
        occupation: formData.occupation || undefined,
      },
      culturalContext: {
        factors: formData.culturalFactors,
        language: 'tr',
        region: 'turkey',
      },
      therapeuticGoals: formData.therapyGoals.map(id => ({
        id,
        title: THERAPY_GOALS.find(g => g.id === id)?.label || '',
        priority: 'high',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })),
    };

    // Track completion
    if (userId) {
      await trackAIInteraction(AIEventType.PROFILE_CREATED, {
        userId,
        hasGoals: formData.therapyGoals.length > 0,
        hasCulturalContext: formData.culturalFactors.length > 0,
      });
    }

    onComplete(profileData);
  };

  const toggleArrayItem = (array: string[], item: string): string[] => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'name':
        return (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Adınız"
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
          </View>
        );

      case 'age':
        return (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Yaşınız"
              value={formData.age}
              onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={handleNext}
              maxLength={3}
            />
          </View>
        );

      case 'gender':
        return (
          <View style={styles.optionsContainer}>
            {['Erkek', 'Kadın', 'Belirtmek istemiyorum'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.optionButton,
                  formData.gender === option && styles.optionButtonSelected,
                ]}
                onPress={() => {
                  setFormData({ ...formData, gender: option });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.optionText,
                  formData.gender === option && styles.optionTextSelected,
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'occupation':
        return (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Mesleğiniz (opsiyonel)"
              value={formData.occupation}
              onChangeText={(text) => setFormData({ ...formData, occupation: text })}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
            <TouchableOpacity onPress={handleNext} style={styles.skipButton}>
              <Text style={styles.skipText}>Atla →</Text>
            </TouchableOpacity>
          </View>
        );

      case 'cultural':
        return (
          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {CULTURAL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.checkboxCard,
                  formData.culturalFactors.includes(option.id) && styles.checkboxCardSelected,
                ]}
                onPress={() => {
                  setFormData({
                    ...formData,
                    culturalFactors: toggleArrayItem(formData.culturalFactors, option.id),
                  });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <MaterialCommunityIcons
                  name={option.icon as any}
                  size={24}
                  color={formData.culturalFactors.includes(option.id) ? COLORS.primary : COLORS.secondaryText}
                />
                <Text style={[
                  styles.checkboxLabel,
                  formData.culturalFactors.includes(option.id) && styles.checkboxLabelSelected,
                ]}>
                  {option.label}
                </Text>
                <View style={[
                  styles.checkbox,
                  formData.culturalFactors.includes(option.id) && styles.checkboxSelected,
                ]}>
                  {formData.culturalFactors.includes(option.id) && (
                    <MaterialCommunityIcons name="check" size={16} color={COLORS.white} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case 'goals':
        return (
          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {THERAPY_GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.checkboxCard,
                  formData.therapyGoals.includes(goal.id) && styles.checkboxCardSelected,
                ]}
                onPress={() => {
                  setFormData({
                    ...formData,
                    therapyGoals: toggleArrayItem(formData.therapyGoals, goal.id),
                  });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <MaterialCommunityIcons
                  name={goal.icon as any}
                  size={24}
                  color={formData.therapyGoals.includes(goal.id) ? COLORS.primary : COLORS.secondaryText}
                />
                <Text style={[
                  styles.checkboxLabel,
                  formData.therapyGoals.includes(goal.id) && styles.checkboxLabelSelected,
                ]}>
                  {goal.label}
                </Text>
                <View style={[
                  styles.checkbox,
                  formData.therapyGoals.includes(goal.id) && styles.checkboxSelected,
                ]}>
                  {formData.therapyGoals.includes(goal.id) && (
                    <MaterialCommunityIcons name="check" size={16} color={COLORS.white} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
          Adım {currentStepIndex + 1} / {PROFILE_STEPS.length}
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

      {/* Step Content */}
      <Animated.View 
        style={[
          styles.stepContainer,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
        </View>

        {renderStepContent()}
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          title={currentStepIndex === PROFILE_STEPS.length - 1 ? "Profili Tamamla" : "İleri"}
          onPress={handleNext}
          disabled={!validateStep()}
          style={[
            styles.primaryButton,
            !validateStep() && styles.disabledButton,
          ]}
        />
        
        {currentStepIndex > 0 && (
          <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Geri</Text>
          </TouchableOpacity>
        )}
      </View>
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
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepHeader: {
    marginTop: 32,
    marginBottom: 40,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 24,
    fontWeight: '500',
    color: COLORS.primaryText,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  skipButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    color: COLORS.secondaryText,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  optionButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  optionText: {
    fontSize: 18,
    color: COLORS.primaryText,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  checkboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checkboxCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    color: COLORS.primaryText,
    marginLeft: 12,
  },
  checkboxLabelSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  disabledButton: {
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  backButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: COLORS.secondaryText,
  },
});

export default ProfileBuilderV2;
