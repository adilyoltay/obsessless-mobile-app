/**
 * ObsessLess AI Destekli Onboarding Akışı
 * 
 * Kullanıcıyı tanıyan, anlayan ve kişiselleştirilmiş bir yolculuk sunan
 * empatik onboarding deneyimi. "Güç Kullanıcıdadır" ilkesine uygun.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { router } from 'expo-router';

// Components
import { ChatInterface } from '@/components/ai/ChatInterface';
import Button from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';

// Services
import { analyzeUserProfile } from '@/ai/services/profileAnalyzer';
import { generatePersonalizedPlan } from '@/ai/services/treatmentPlanner';

// Store
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Types
import { OCDProfile, TherapyPreference } from '@/types/onboarding';

const { width } = Dimensions.get('window');

// Onboarding adımları
const ONBOARDING_STEPS = [
  'welcome',
  'chat_intro',
  'ocd_assessment',
  'therapy_preference',
  'goal_setting',
  'personalized_plan',
  'commitment',
] as const;

type OnboardingStep = typeof ONBOARDING_STEPS[number];

export const AIOnboardingFlow: React.FC = () => {
  const { user } = useAuth();
  const {
    currentStep,
    ocdProfile,
    therapyPreference,
    personalizedPlan,
    setCurrentStep,
    updateOCDProfile,
    setTherapyPreference,
    setPersonalizedPlan,
    completeOnboarding,
  } = useOnboardingStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const progress = useSharedValue(0);

  // Progress animasyonu
  useEffect(() => {
    const stepIndex = ONBOARDING_STEPS.indexOf(currentStep);
    progress.value = withSpring((stepIndex + 1) / ONBOARDING_STEPS.length);
  }, [currentStep]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Adım değiştirme
  const goToStep = useCallback((step: OnboardingStep) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep(step);
  }, [setCurrentStep]);

  const goNext = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      goToStep(ONBOARDING_STEPS[currentIndex + 1]);
    }
  }, [currentStep, goToStep]);

  const goBack = useCallback(() => {
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      goToStep(ONBOARDING_STEPS[currentIndex - 1]);
    }
  }, [currentStep, goToStep]);

  // AI analizi başlat
  const startAIAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      // Kullanıcı profilini analiz et
      const analysis = await analyzeUserProfile({
        chatHistory: [], // TODO: Chat geçmişini al
        assessmentResults: ocdProfile,
        preferences: therapyPreference,
      });

      // Kişiselleştirilmiş plan oluştur
      const plan = await generatePersonalizedPlan({
        userProfile: analysis,
        ocdSeverity: ocdProfile?.severity || 'moderate',
        preferredApproach: therapyPreference?.approach || 'cbt',
      });

      setPersonalizedPlan(plan);
      goNext();
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [ocdProfile, therapyPreference, setPersonalizedPlan, goNext]);

  // Onboarding tamamlama
  const handleCompleteOnboarding = useCallback(async () => {
    await completeOnboarding();
    router.replace('/(tabs)/');
  }, [completeOnboarding]);

  // Adım render fonksiyonları
  const renderWelcome = () => (
    <Animated.View
      entering={FadeIn}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      <View style={styles.welcomeContainer}>
        <MaterialCommunityIcons
          name="hand-wave"
          size={80}
          color="#10B981"
        />
        <Text style={styles.welcomeTitle}>
          Merhaba {user?.user_metadata?.name || 'Yolcu'} 👋
        </Text>
        <Text style={styles.welcomeSubtitle}>
          ObsessLess'e hoş geldin! Ben senin AI destekçinim.
        </Text>
        <Text style={styles.welcomeText}>
          Birlikte, OKB ile başa çıkma yolculuğunda sana özel bir plan oluşturacağız.
          Bu süreçte yanında olacağım ve seni anlayacağım.
        </Text>
        
        <View style={styles.featureList}>
          <FeatureItem
            icon="brain"
            title="Seni Tanıyacağım"
            description="OKB deneyimini anlayarak sana özel çözümler sunacağım"
          />
          <FeatureItem
            icon="heart"
            title="Empati ile Dinleyeceğim"
            description="Yargılamadan, sabırla ve anlayışla yanında olacağım"
          />
          <FeatureItem
            icon="shield-check"
            title="Güvendesin"
            description="Tüm bilgilerin şifreli ve gizli kalacak"
          />
        </View>

        <Button
          title="Başlayalım"
          onPress={goNext}
          style={styles.primaryButton}
          icon="arrow-right"
        />
      </View>
    </Animated.View>
  );

  const renderChatIntro = () => (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      <View style={styles.chatIntroContainer}>
        <MaterialCommunityIcons
          name="chat-processing-outline"
          size={64}
          color="#10B981"
        />
        <Text style={styles.stepTitle}>Seninle Konuşalım</Text>
        <Text style={styles.stepDescription}>
          Seni daha iyi tanımak için birkaç dakika sohbet edelim.
          Ne hissettiğini, neleri deneyimlediğini merak ediyorum.
        </Text>

        <Card style={styles.infoCard}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color="#3B82F6"
          />
          <Text style={styles.infoText}>
            Bu sohbet tamamen gizli kalacak ve sadece sana daha iyi yardımcı olmak için kullanılacak.
          </Text>
        </Card>

        <View style={styles.buttonGroup}>
          <Button
            title="Geri"
            onPress={goBack}
            variant="outline"
            style={styles.secondaryButton}
          />
          <Button
            title="Sohbete Başla"
            onPress={() => setShowChat(true)}
            style={styles.primaryButton}
            icon="chat"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderOCDAssessment = () => (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>OKB Deneyimin</Text>
        <Text style={styles.stepDescription}>
          Yaşadığın zorlukları daha iyi anlayabilmem için birkaç soru soracağım.
          Rahat hissettiğin kadarını paylaşabilirsin.
        </Text>

        <OCDAssessmentForm
          onComplete={(profile) => {
            updateOCDProfile(profile);
            goNext();
          }}
          onBack={goBack}
        />
      </ScrollView>
    </Animated.View>
  );

  const renderTherapyPreference = () => (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      <Text style={styles.stepTitle}>Tedavi Yaklaşımı Tercihin</Text>
      <Text style={styles.stepDescription}>
        Hangi yaklaşımın sana daha uygun olduğunu birlikte belirleyelim.
      </Text>

      <View style={styles.therapyOptions}>
        <TherapyOption
          id="cbt"
          title="Bilişsel Davranışçı Terapi (BDT)"
          description="Düşünce kalıplarını değiştirmeye odaklanır"
          icon="head-cog"
          selected={therapyPreference?.approach === 'cbt'}
          onSelect={() => setTherapyPreference({ approach: 'cbt' })}
        />
        
        <TherapyOption
          id="erp"
          title="Maruz Bırakma ve Tepki Önleme (ERP)"
          description="Korkularınla yüzleşme ve alışkanlıkları kırma"
          icon="shield-remove"
          selected={therapyPreference?.approach === 'erp'}
          onSelect={() => setTherapyPreference({ approach: 'erp' })}
        />
        
        <TherapyOption
          id="act"
          title="Kabul ve Kararlılık Terapisi (ACT)"
          description="Düşünceleri kabul etme ve değerlerle yaşama"
          icon="meditation"
          selected={therapyPreference?.approach === 'act'}
          onSelect={() => setTherapyPreference({ approach: 'act' })}
        />
        
        <TherapyOption
          id="mixed"
          title="Karma Yaklaşım"
          description="Tüm tekniklerin en iyilerini birleştir"
          icon="all-inclusive"
          selected={therapyPreference?.approach === 'mixed'}
          onSelect={() => setTherapyPreference({ approach: 'mixed' })}
        />
      </View>

      <View style={styles.buttonGroup}>
        <Button
          title="Geri"
          onPress={goBack}
          variant="outline"
          style={styles.secondaryButton}
        />
        <Button
          title="Devam"
          onPress={goNext}
          disabled={!therapyPreference}
          style={styles.primaryButton}
        />
      </View>
    </Animated.View>
  );

  const renderGoalSetting = () => (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      <Text style={styles.stepTitle}>Hedeflerini Belirleyelim</Text>
      <Text style={styles.stepDescription}>
        Bu yolculukta neleri başarmak istiyorsun? Birlikte gerçekçi ve anlamlı hedefler koyalım.
      </Text>

      <GoalSettingForm
        onComplete={(goals) => {
          // TODO: Hedefleri kaydet
          startAIAnalysis();
        }}
        onBack={goBack}
      />
    </Animated.View>
  );

  const renderPersonalizedPlan = () => (
    <Animated.View
      entering={SlideInRight}
      exiting={SlideOutLeft}
      style={styles.stepContainer}
    >
      {isAnalyzing ? (
        <View style={styles.analyzingContainer}>
          <MaterialCommunityIcons
            name="brain"
            size={64}
            color="#10B981"
          />
          <Text style={styles.analyzingTitle}>Planını Hazırlıyorum...</Text>
          <Text style={styles.analyzingText}>
            Verdiğin bilgileri analiz ediyorum ve sana özel bir tedavi planı oluşturuyorum.
          </Text>
          <ProgressBar indeterminate style={styles.analyzingProgress} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>Senin Kişisel Planın</Text>
          <Text style={styles.stepDescription}>
            İşte sana özel hazırladığım tedavi planı:
          </Text>

          {personalizedPlan && (
            <PersonalizedPlanView
              plan={personalizedPlan}
              onAccept={goNext}
              onModify={() => {
                // TODO: Plan düzenleme
              }}
            />
          )}
        </ScrollView>
      )}
    </Animated.View>
  );

  const renderCommitment = () => (
    <Animated.View
      entering={SlideInRight}
      style={styles.stepContainer}
    >
      <View style={styles.commitmentContainer}>
        <MaterialCommunityIcons
          name="handshake"
          size={80}
          color="#10B981"
        />
        <Text style={styles.commitmentTitle}>Birlikte Başaracağız</Text>
        <Text style={styles.commitmentText}>
          Bu yolculuk kolay olmayabilir, ama yanındayım. Her adımda seni destekleyeceğim.
          Kendine şefkat göstermeyi ve sabırlı olmayı unutma.
        </Text>

        <Card style={styles.commitmentCard}>
          <Text style={styles.commitmentPromise}>
            💚 Her gün küçük adımlar atacağız{'\n'}
            🌟 Başarılarını kutlayacağız{'\n'}
            🤗 Zorlandığında yanında olacağım{'\n'}
            🎯 Hedeflerine ulaşmana yardım edeceğim
          </Text>
        </Card>

        <Button
          title="Yolculuğa Başla"
          onPress={handleCompleteOnboarding}
          style={styles.primaryButton}
          icon="rocket-launch"
        />
      </View>
    </Animated.View>
  );

  // Ana render
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcome();
      case 'chat_intro':
        return renderChatIntro();
      case 'ocd_assessment':
        return renderOCDAssessment();
      case 'therapy_preference':
        return renderTherapyPreference();
      case 'goal_setting':
        return renderGoalSetting();
      case 'personalized_plan':
        return renderPersonalizedPlan();
      case 'commitment':
        return renderCommitment();
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </View>

      {/* Content */}
      {showChat ? (
        <ChatInterface
          onClose={() => {
            setShowChat(false);
            goNext();
          }}
        />
      ) : (
        renderCurrentStep()
      )}
    </KeyboardAvoidingView>
  );
};

// Alt bileşenler
const FeatureItem: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <MaterialCommunityIcons name={icon as any} size={32} color="#10B981" />
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const TherapyOption: React.FC<{
  id: string;
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
}> = ({ title, description, icon, selected, onSelect }) => (
  <Pressable
    onPress={onSelect}
    style={[
      styles.therapyOption,
      selected && styles.therapyOptionSelected,
    ]}
  >
    <MaterialCommunityIcons
      name={icon as any}
      size={32}
      color={selected ? '#10B981' : '#6B7280'}
    />
    <View style={styles.therapyContent}>
      <Text style={[
        styles.therapyTitle,
        selected && styles.therapyTitleSelected,
      ]}>
        {title}
      </Text>
      <Text style={styles.therapyDescription}>{description}</Text>
    </View>
    {selected && (
      <MaterialCommunityIcons
        name="check-circle"
        size={24}
        color="#10B981"
        style={styles.therapyCheck}
      />
    )}
  </Pressable>
);

// TODO: Implement these components
const OCDAssessmentForm = ({ onComplete, onBack }: any) => (
  <View>
    <Text>OCD Assessment Form - TODO</Text>
    <Button title="Devam" onPress={() => onComplete({})} />
  </View>
);

const GoalSettingForm = ({ onComplete, onBack }: any) => (
  <View>
    <Text>Goal Setting Form - TODO</Text>
    <Button title="Analizi Başlat" onPress={() => onComplete([])} />
  </View>
);

const PersonalizedPlanView = ({ plan, onAccept, onModify }: any) => (
  <View>
    <Text>Personalized Plan - TODO</Text>
    <Button title="Planı Kabul Et" onPress={onAccept} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  progressBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  
  // Steps
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  
  // Welcome
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 20,
    color: '#10B981',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  
  // Features
  featureList: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  featureContent: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  
  // Chat intro
  chatIntroContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  
  // Therapy options
  therapyOptions: {
    marginBottom: 32,
  },
  therapyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  therapyOptionSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  therapyContent: {
    flex: 1,
    marginLeft: 12,
  },
  therapyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  therapyTitleSelected: {
    color: '#10B981',
  },
  therapyDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  therapyCheck: {
    marginLeft: 8,
  },
  
  // Analyzing
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  analyzingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },
  analyzingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  analyzingProgress: {
    width: 200,
  },
  
  // Commitment
  commitmentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  commitmentTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 16,
  },
  commitmentText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  commitmentCard: {
    backgroundColor: '#F0FDF4',
    padding: 20,
    borderRadius: 16,
    marginBottom: 40,
  },
  commitmentPromise: {
    fontSize: 16,
    color: '#065F46',
    lineHeight: 28,
  },
  
  // Buttons
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
  },
}); 