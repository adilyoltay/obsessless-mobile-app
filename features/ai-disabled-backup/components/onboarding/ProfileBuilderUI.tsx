/**
 * 👤 AI-Powered Profile Builder UI Component
 * 
 * Intelligent user profiling interface that leverages Y-BOCS analysis
 * and AI insights to create personalized therapeutic profiles.
 * 
 * Features:
 * ✅ Multi-step profile building wizard
 * ✅ Y-BOCS integration and AI recommendations  
 * ✅ Cultural adaptation for Turkish users
 * ✅ Smart goal suggestion system
 * ✅ Privacy-first data collection
 * ✅ Real-time validation
 * ✅ Accessibility support (WCAG 2.1 AA)
 * ✅ Offline capability
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Sprint 7 Backend Integration
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Types
import {
  UserProfile,
  OCDAnalysis,
  TherapeuticGoal,
  UserPreferences,
  CulturalContext,
  ProfileStep,
  AIError,
  ErrorSeverity,
  AIErrorCode
} from '@/features/ai/types';

// UI Components
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Picker } from '@/components/ui/Picker';
import { Switch } from '@/components/ui/Switch';
import { SegmentedButtons } from '@/components/ui/SegmentedButtons';
import { Loading } from '@/components/ui/Loading';

interface ProfileBuilderUIProps {
  ybocsAnalysis?: OCDAnalysis;
  onComplete: (profileData: Partial<UserProfile>) => void;
  isLoading?: boolean;
  userId?: string;
}

interface ProfileState {
  currentStep: ProfileStep;
  profileData: Partial<UserProfile>;
  suggestedGoals: TherapeuticGoal[];
  selectedGoals: string[];
  isGeneratingSuggestions: boolean;
  error: string | null;
  canProceed: boolean;
  completedSteps: Set<ProfileStep>;
}

// Profile Building Steps
const PROFILE_STEPS: ProfileStep[] = [
  'basic_info',
  'therapeutic_goals',
  'preferences',
  'cultural_context',
  'ai_enhancement'
];

// Turkish Cultural Context Options
const CULTURAL_FACTORS = [
  { id: 'family_involvement', label: 'Aile Desteği', description: 'Tedavi sürecinde ailenin rolü' },
  { id: 'religious_considerations', label: 'Dini Değerler', description: 'İnanç sistemine uygun yaklaşım' },
  { id: 'social_expectations', label: 'Toplumsal Beklentiler', description: 'Sosyal normlar ve beklentiler' },
  { id: 'communication_style', label: 'İletişim Tarzı', description: 'Direkt/dolaylı iletişim tercihi' },
  { id: 'gender_roles', label: 'Cinsiyet Rolleri', description: 'Geleneksel rol beklentileri' }
];

// Therapeutic Goal Categories
const GOAL_CATEGORIES = [
  {
    id: 'symptom_reduction',
    title: 'Semptom Azaltma',
    description: 'Obsesyon ve kompulsiyonları azaltmak',
    icon: '🎯'
  },
  {
    id: 'functional_improvement',
    title: 'İşlevsellik Artırma',
    description: 'Günlük yaşam kalitesini iyileştirmek',
    icon: '⚡'
  },
  {
    id: 'relationship_building',
    title: 'İlişki Geliştirme',
    description: 'Sosyal bağları güçlendirmek',
    icon: '🤝'
  },
  {
    id: 'emotional_regulation',
    title: 'Duygusal Düzenleme',
    description: 'Kaygı ve stresi yönetmek',
    icon: '🧘'
  },
  {
    id: 'cognitive_restructuring',
    title: 'Düşünce Değiştirme',
    description: 'Olumsuz düşünce kalıplarını değiştirmek',
    icon: '🧠'
  }
];

export const ProfileBuilderUI: React.FC<ProfileBuilderUIProps> = ({
  ybocsAnalysis,
  onComplete,
  isLoading = false,
  userId
}) => {
  const insets = useSafeAreaInsets();
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // State
  const [state, setState] = useState<ProfileState>({
    currentStep: 'basic_info',
    profileData: {},
    suggestedGoals: [],
    selectedGoals: [],
    isGeneratingSuggestions: false,
    error: null,
    canProceed: false,
    completedSteps: new Set()
  });

  /**
   * 🤖 Generate AI-Powered Goal Suggestions
   */
  const generateGoalSuggestions = useCallback(async () => {
    if (!ybocsAnalysis || !userId) return;

    setState(prev => ({ ...prev, isGeneratingSuggestions: true }));

    try {
      const suggestions = await userProfilingService.suggestTherapeuticGoals({
        ybocsAnalysis,
        culturalContext: state.profileData.culturalContext,
        userPreferences: state.profileData.preferences
      });

      setState(prev => ({
        ...prev,
        suggestedGoals: suggestions,
        isGeneratingSuggestions: false
      }));

      // Track AI suggestion generation
      await trackAIInteraction(AIEventType.USER_PROFILE_GENERATED, {
        userId,
        suggestionsCount: suggestions.length,
        ybocsIntegration: true,
        culturalAdaptation: !!state.profileData.culturalContext
      });

    } catch (error) {
      console.error('❌ Goal suggestion error:', error);
      setState(prev => ({
        ...prev,
        isGeneratingSuggestions: false,
        error: 'Hedef önerileri oluşturulurken hata oluştu.'
      }));
    }
  }, [ybocsAnalysis, userId, state.profileData.culturalContext, state.profileData.preferences]);

  /**
   * 📝 Update Profile Data
   */
  const updateProfileData = useCallback((updates: Partial<UserProfile>) => {
    setState(prev => ({
      ...prev,
      profileData: { ...prev.profileData, ...updates },
      error: null
    }));
  }, []);

  /**
   * ✅ Complete Current Step
   */
  const completeStep = useCallback(async (stepData?: any) => {
    const currentStepIndex = PROFILE_STEPS.indexOf(state.currentStep);
    const isLastStep = currentStepIndex === PROFILE_STEPS.length - 1;

    // Mark step as completed
    const newCompletedSteps = new Set(state.completedSteps);
    newCompletedSteps.add(state.currentStep);

    if (isLastStep) {
      // Generate final profile
      setState(prev => ({ ...prev, isGeneratingSuggestions: true }));

      try {
        const finalProfileData = {
          ...state.profileData,
          ...stepData,
          ybocsAnalysis,
          selectedGoals: state.selectedGoals,
          createdAt: new Date(),
          lastUpdated: new Date()
        };

        // Track profile completion
        await trackAIInteraction(AIEventType.USER_PROFILE_ENHANCED, {
          userId,
          profileCompleteness: calculateCompleteness(finalProfileData),
          stepsCompleted: newCompletedSteps.size,
          aiEnhanced: true
        });

        // Save progress
        if (userId) {
          await AsyncStorage.setItem(
            `profile_data_${userId}`,
            JSON.stringify(finalProfileData)
          );
        }

        onComplete(finalProfileData);

      } catch (error) {
        console.error('❌ Profile completion error:', error);
        setState(prev => ({
          ...prev,
          isGeneratingSuggestions: false,
          error: 'Profil tamamlanırken hata oluştu.'
        }));
      }
    } else {
      // Move to next step
      const nextStep = PROFILE_STEPS[currentStepIndex + 1];

      // Animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();

      setState(prev => ({
        ...prev,
        currentStep: nextStep,
        completedSteps: newCompletedSteps,
        canProceed: false,
        profileData: { ...prev.profileData, ...stepData }
      }));

      // Generate suggestions for therapeutic goals step
      if (nextStep === 'therapeutic_goals' && ybocsAnalysis) {
        generateGoalSuggestions();
      }

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [state.currentStep, state.completedSteps, state.profileData, state.selectedGoals, ybocsAnalysis, userId, onComplete, fadeAnim, slideAnim, generateGoalSuggestions]);

  /**
   * ⬅️ Go to Previous Step
   */
  const goToPreviousStep = useCallback(() => {
    const currentStepIndex = PROFILE_STEPS.indexOf(state.currentStep);
    if (currentStepIndex > 0) {
      const previousStep = PROFILE_STEPS[currentStepIndex - 1];
      setState(prev => ({
        ...prev,
        currentStep: previousStep,
        canProceed: true
      }));
    }
  }, [state.currentStep]);

  /**
   * 📊 Calculate Profile Completeness
   */
  const calculateCompleteness = useCallback((profileData: Partial<UserProfile>): number => {
    const keysPresent = Object.keys(profileData).length;
    return Math.min(100, Math.round((keysPresent / 5) * 100));
  }, []);

  /**
   * 🎨 Render Step Content
   */
  const renderStepContent = () => {
    switch (state.currentStep) {
      case 'basic_info':
        return (
          <BasicInfoStep
            profileData={state.profileData}
            onUpdate={updateProfileData}
            onCanProceed={(canProceed) => setState(prev => ({ ...prev, canProceed }))}
          />
        );

      case 'therapeutic_goals':
        return (
          <TherapeuticGoalsStep
            suggestedGoals={state.suggestedGoals}
            selectedGoals={state.selectedGoals}
            ybocsAnalysis={ybocsAnalysis}
            isGenerating={state.isGeneratingSuggestions}
            onGoalToggle={(goalId) => {
              const newSelected = state.selectedGoals.includes(goalId)
                ? state.selectedGoals.filter(id => id !== goalId)
                : [...state.selectedGoals, goalId];
              setState(prev => ({ 
                ...prev, 
                selectedGoals: newSelected,
                canProceed: newSelected.length > 0
              }));
            }}
          />
        );

      case 'preferences':
        return (
          <PreferencesStep
            profileData={state.profileData}
            onUpdate={updateProfileData}
            onCanProceed={(canProceed) => setState(prev => ({ ...prev, canProceed }))}
          />
        );

      case 'cultural_context':
        return (
          <CulturalContextStep
            profileData={state.profileData}
            onUpdate={updateProfileData}
            onCanProceed={(canProceed) => setState(prev => ({ ...prev, canProceed }))}
          />
        );

      case 'ai_enhancement':
        return (
          <AIEnhancementStep
            profileData={state.profileData}
            ybocsAnalysis={ybocsAnalysis}
            selectedGoals={state.selectedGoals}
            onCanProceed={(canProceed) => setState(prev => ({ ...prev, canProceed }))}
          />
        );

      default:
        return null;
    }
  };

  // Load saved progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!userId) return;

      try {
        const savedProfile = await AsyncStorage.getItem(`profile_data_${userId}`);
        if (savedProfile) {
          const profileData = JSON.parse(savedProfile);
          setState(prev => ({
            ...prev,
            profileData,
            canProceed: calculateCompleteness(profileData) > 0
          }));
        }
      } catch (error) {
        console.error('❌ Failed to load profile progress:', error);
      }
    };

    loadProgress();
  }, [userId, calculateCompleteness]);

  const currentStepIndex = PROFILE_STEPS.indexOf(state.currentStep);
  const progress = ((currentStepIndex + 1) / PROFILE_STEPS.length) * 100;
  const isLastStep = currentStepIndex === PROFILE_STEPS.length - 1;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kişisel Profiliniz</Text>
        <Text style={styles.headerSubtitle}>
          Adım {currentStepIndex + 1} / {PROFILE_STEPS.length}
        </Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(32, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}

          {/* Error Display */}
          {state.error && (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>⚠️ {state.error}</Text>
            </Card>
          )}
        </ScrollView>
      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        <View style={styles.navigationContainer}>
          <Button
            title="⬅️ Geri"
            onPress={goToPreviousStep}
            variant="outline"
            disabled={currentStepIndex === 0 || isLoading || state.isGeneratingSuggestions}
            style={styles.backButton}
          />
          
          <Button
            title={isLastStep ? "✅ Profili Tamamla" : "Devam Et ➡️"}
            onPress={() => completeStep()}
            disabled={!state.canProceed || isLoading || state.isGeneratingSuggestions}
            style={styles.nextButton}
          />
        </View>
      </View>

      {/* Loading Overlay */}
      {(state.isGeneratingSuggestions && !isLoading) && (
        <Loading overlay />
      )}
    </View>
  );
};

/**
 * 📝 Basic Info Step Component
 */
const BasicInfoStep: React.FC<{
  profileData: Partial<UserProfile>;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onCanProceed: (canProceed: boolean) => void;
}> = ({ profileData, onUpdate, onCanProceed }) => {
  const [formData, setFormData] = useState({
    firstName: (profileData as any).firstName || '',
    age: (profileData as any).age || '',
    gender: (profileData as any).gender || '',
    occupation: (profileData as any).occupation || ''
  });

  // Update parent whenever form data changes
  useEffect(() => {
    onUpdate(formData as any);
  }, [formData.firstName, formData.age, formData.gender, formData.occupation]);

  // Update canProceed status
  useEffect(() => {
    const canProceed = formData.firstName.length > 0 && formData.age.length > 0;
    onCanProceed(canProceed);
  }, [formData.firstName, formData.age]);

  return (
    <Card style={styles.stepCard}>
      <Text style={styles.stepTitle}>Temel Bilgiler 📝</Text>
      <Text style={styles.stepDescription}>
        Size daha uygun bir deneyim sunabilmemiz için bazı temel bilgilere ihtiyacımız var.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>İsim *</Text>
        <Input
          value={formData.firstName}
          onChangeText={(text) => setFormData(prev => ({ ...prev, firstName: text }))}
          placeholder="Adınız"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Yaş *</Text>
        <Input
          value={formData.age}
          onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
          placeholder="Yaşınız"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Cinsiyet</Text>
        <SegmentedButtons
          value={formData.gender}
          onValueChange={(value) => {
            console.log('🎯 Gender selection:', value);
            setFormData(prev => ({ ...prev, gender: value }));
          }}
          buttons={[
            { value: 'female', label: 'Kadın' },
            { value: 'male', label: 'Erkek' },
            { value: 'other', label: 'Diğer' },
            { value: 'prefer_not_to_say', label: 'Belirtmek istemiyorum' }
          ]}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Meslek</Text>
        <Input
          value={formData.occupation}
          onChangeText={(text) => setFormData(prev => ({ ...prev, occupation: text }))}
          placeholder="Mesleğiniz (isteğe bağlı)"
        />
      </View>
    </Card>
  );
};

/**
 * 🎯 Therapeutic Goals Step Component
 */
const TherapeuticGoalsStep: React.FC<{
  suggestedGoals: TherapeuticGoal[];
  selectedGoals: string[];
  ybocsAnalysis?: OCDAnalysis;
  isGenerating: boolean;
  onGoalToggle: (goalId: string) => void;
}> = ({ suggestedGoals, selectedGoals, ybocsAnalysis, isGenerating, onGoalToggle }) => {
  return (
    <Card style={styles.stepCard}>
      <Text style={styles.stepTitle}>Tedavi Hedefleriniz 🎯</Text>
      <Text style={styles.stepDescription}>
        {ybocsAnalysis ? 
          'Y-BOCS değerlendirmenize dayanarak kişiselleştirilmiş hedefler önerdik. Size uygun olanları seçin.' :
          'Tedavi sürecinizde odaklanmak istediğiniz alanları seçin.'
        }
      </Text>

      {isGenerating ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>AI önerileri hazırlanıyor...</Text>
        </View>
      ) : (
        <View style={styles.goalsContainer}>
          {GOAL_CATEGORIES.map((category) => {
            const categoryGoals = suggestedGoals.filter(goal => goal.category === category.id);
            const isSelected = selectedGoals.includes(category.id);

            return (
              <View key={category.id} style={styles.goalCategory}>
                <Button
                  title={`${category.icon} ${category.title}`}
                  onPress={() => onGoalToggle(category.id)}
                  variant={isSelected ? 'primary' : 'outline'}
                  style={[styles.goalButton, isSelected && styles.selectedGoal]}
                />
                <Text style={styles.goalDescription}>{category.description}</Text>
                
                {categoryGoals.length > 0 && (
                  <View style={styles.aiSuggestions}>
                    <Text style={styles.aiSuggestionsLabel}>🤖 AI Önerisi:</Text>
                    {categoryGoals.slice(0, 2).map((goal, index) => (
                      <Text key={index} style={styles.aiSuggestionText}>
                        • {goal.description}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.selectionSummary}>
        <Text style={styles.summaryText}>
          {selectedGoals.length} hedef seçildi
        </Text>
      </View>
    </Card>
  );
};

/**
 * ⚙️ Preferences Step Component
 */
const PreferencesStep: React.FC<{
  profileData: Partial<UserProfile>;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onCanProceed: (canProceed: boolean) => void;
}> = ({ profileData, onUpdate, onCanProceed }) => {
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>(
    profileData.preferences || {}
  );

  // Update parent whenever preferences change
  useEffect(() => {
    onUpdate({ preferences });
  }, [preferences]);

  // Set canProceed status (preferences are optional)
  useEffect(() => {
    onCanProceed(true);
  }, []);

  return (
    <Card style={styles.stepCard}>
      <Text style={styles.stepTitle}>Tercihleriniz ⚙️</Text>
      <Text style={styles.stepDescription}>
        Deneyiminizi kişiselleştirmek için tercihlerinizi belirtin.
      </Text>

      <View style={styles.preferenceGroup}>
        <View style={styles.preferenceItem}>
          <Text style={styles.preferenceLabel}>Bildirimler</Text>
          <Switch
            value={preferences.notificationsEnabled || false}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, notificationsEnabled: value }))}
          />
        </View>
        <Text style={styles.preferenceDescription}>
          Hatırlatmalar ve motivasyon mesajları alın
        </Text>
      </View>

      <View style={styles.preferenceGroup}>
        <Text style={styles.label}>İletişim Tarzı</Text>
        <SegmentedButtons
          value={preferences.communicationStyle || 'balanced'}
          onValueChange={(value) => setPreferences(prev => ({ ...prev, communicationStyle: value }))}
          buttons={[
            { value: 'gentle', label: 'Yumuşak' },
            { value: 'balanced', label: 'Dengeli' },
            { value: 'direct', label: 'Direkt' }
          ]}
        />
      </View>

      <View style={styles.preferenceGroup}>
        <Text style={styles.label}>Motivasyon Düzeyi</Text>
        <SegmentedButtons
          value={preferences.motivationLevel || 'moderate'}
          onValueChange={(value) => setPreferences(prev => ({ ...prev, motivationLevel: value }))}
          buttons={[
            { value: 'low', label: 'Düşük' },
            { value: 'moderate', label: 'Orta' },
            { value: 'high', label: 'Yüksek' }
          ]}
        />
      </View>
    </Card>
  );
};

/**
 * 🌍 Cultural Context Step Component
 */
const CulturalContextStep: React.FC<{
  profileData: Partial<UserProfile>;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onCanProceed: (canProceed: boolean) => void;
}> = ({ profileData, onUpdate, onCanProceed }) => {
  const [culturalFactors, setCulturalFactors] = useState<string[]>(
    profileData.culturalContext?.factors || []
  );

  // Update parent whenever cultural factors change
  useEffect(() => {
    const culturalContext: any = {
      language: 'tr',
      country: 'TR',
      culturalBackground: ['Turkish'],
      communicationStyle: { formality: 'warm', directness: 'gentle', supportStyle: 'encouraging', humorAcceptable: true, preferredPronoun: 'siz' },
      stigmaFactors: [],
      supportSystemStructure: 'extended_family',
      factors: culturalFactors,
    };
    onUpdate({ culturalContext } as any);
  }, [culturalFactors]);

  // Set canProceed status (cultural context is optional but recommended)
  useEffect(() => {
    onCanProceed(true);
  }, []);

  const toggleFactor = (factorId: string) => {
    setCulturalFactors(prev => 
      prev.includes(factorId)
        ? prev.filter(id => id !== factorId)
        : [...prev, factorId]
    );
  };

  return (
    <Card style={styles.stepCard}>
      <Text style={styles.stepTitle}>Kültürel Bağlam 🌍</Text>
      <Text style={styles.stepDescription}>
        Size daha uygun bir tedavi deneyimi sunabilmemiz için kültürel faktörleri belirtin.
      </Text>

      <View style={styles.culturalFactors}>
        {CULTURAL_FACTORS.map((factor) => {
          const isSelected = culturalFactors.includes(factor.id);
          
          return (
            <View key={factor.id} style={styles.culturalFactor}>
              <Button
                title={factor.label}
                onPress={() => toggleFactor(factor.id)}
                variant={isSelected ? 'primary' : 'outline'}
                style={[styles.factorButton, isSelected && styles.selectedFactor]}
              />
              <Text style={styles.factorDescription}>{factor.description}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.culturalNote}>
        <Text style={styles.culturalNoteText}>
          💡 Bu bilgiler tedavi yaklaşımınızı kültürünüze uygun hale getirmek için kullanılır.
        </Text>
      </View>
    </Card>
  );
};

/**
 * 🤖 AI Enhancement Step Component
 */
const AIEnhancementStep: React.FC<{
  profileData: Partial<UserProfile>;
  ybocsAnalysis?: OCDAnalysis;
  selectedGoals: string[];
  onCanProceed: (canProceed: boolean) => void;
}> = ({ profileData, ybocsAnalysis, selectedGoals, onCanProceed }) => {
  // Set canProceed status (AI enhancement always allows proceed)
  useEffect(() => {
    onCanProceed(true);
  }, []);

  const completeness = ((Object.keys(profileData).length / 8) * 100); // Rough estimate

  return (
    <Card style={styles.stepCard}>
      <Text style={styles.stepTitle}>AI Destekli Profil 🤖</Text>
      <Text style={styles.stepDescription}>
        Profiliniz AI ile geliştirilmeye hazır. İşte size özel deneyimin özeti:
      </Text>

      <View style={styles.enhancementSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Profil Tamamlanma:</Text>
          <Text style={styles.summaryValue}>{Math.round(completeness)}%</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Seçilen Hedefler:</Text>
          <Text style={styles.summaryValue}>{selectedGoals.length} hedef</Text>
        </View>

        {ybocsAnalysis && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Y-BOCS Analizi:</Text>
            <Text style={styles.summaryValue}>✅ Tamamlandı</Text>
          </View>
        )}

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Kültürel Uyarlama:</Text>
          <Text style={styles.summaryValue}>
            {profileData.culturalContext?.factors?.length || 0} faktör
          </Text>
        </View>
      </View>

      <View style={styles.aiFeatures}>
        <Text style={styles.aiFeaturesTitle}>🚀 AI ile Neler Mümkün:</Text>
        <Text style={styles.aiFeatureItem}>✨ Kişiselleştirilmiş öngörüler</Text>
        <Text style={styles.aiFeatureItem}>📊 Akıllı progress takibi</Text>
        <Text style={styles.aiFeatureItem}>💡 Contextual öneriler</Text>
        <Text style={styles.aiFeatureItem}>🛡️ Proaktif güvenlik</Text>
        <Text style={styles.aiFeatureItem}>🎯 Adaptive müdahaleler</Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    padding: 20,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  preferenceGroup: {
    marginBottom: 24,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  goalsContainer: {
    marginTop: 16,
  },
  goalCategory: {
    marginBottom: 20,
  },
  goalButton: {
    marginBottom: 8,
    borderRadius: 12,
  },
  selectedGoal: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  goalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  aiSuggestions: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  aiSuggestionsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0c4a6e',
    marginBottom: 6,
  },
  aiSuggestionText: {
    fontSize: 12,
    color: '#0c4a6e',
    marginBottom: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  selectionSummary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  culturalFactors: {
    marginTop: 16,
  },
  culturalFactor: {
    marginBottom: 16,
  },
  factorButton: {
    marginBottom: 8,
    borderRadius: 10,
  },
  selectedFactor: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  factorDescription: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 4,
  },
  culturalNote: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  culturalNoteText: {
    fontSize: 13,
    color: '#047857',
    fontStyle: 'italic',
  },
  enhancementSummary: {
    marginTop: 16,
    marginBottom: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  aiFeatures: {
    backgroundColor: '#f8fafc',
    borderColor: '#3b82f6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  aiFeaturesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  aiFeatureItem: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 6,
    paddingLeft: 8,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flex: 0.35,
    marginRight: 12,
  },
  nextButton: {
    flex: 0.65,
  },
});

export default ProfileBuilderUI;