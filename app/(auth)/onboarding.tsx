
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Platform } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// UI Components
import { Slider } from '@/components/ui/Slider';

// Store
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const { width, height } = Dimensions.get('window');

// OKB Semptom Temaları
const SYMPTOM_THEMES = [
  { id: 'contamination', label: 'Bulaşma', icon: 'hand-wash', color: '#10B981' },
  { id: 'checking', label: 'Kontrol', icon: 'magnify', color: '#10B981' },
  { id: 'symmetry', label: 'Simetri', icon: 'set-square', color: '#10B981' },
  { id: 'counting', label: 'Sayma', icon: 'numeric', color: '#10B981' },
  { id: 'mental', label: 'Zihinsel', icon: 'brain', color: '#10B981' },
  { id: 'hoarding', label: 'Biriktirme', icon: 'package-variant', color: '#10B981' },
];

// Y-BOCS Lite Soruları (10 kritik soru)
const YBOCS_QUESTIONS = [
  {
    id: 1,
    text: "Obsesif düşünceleriniz günde ne kadar süre alıyor?",
    labels: ["Hiç", "< 1 saat", "1-3 saat", "3-8 saat", "> 8 saat"]
  },
  {
    id: 2,
    text: "Bu düşünceler günlük yaşamınızı ne kadar etkiliyor?",
    labels: ["Hiç", "Az", "Orta", "Çok", "Aşırı"]
  },
  {
    id: 3,
    text: "Obsesif düşünceleriniz ne kadar sıkıntı veriyor?",
    labels: ["Hiç", "Az", "Orta", "Çok", "Aşırı"]
  },
  {
    id: 4,
    text: "Bu düşüncelere direnmek ne kadar zor?",
    labels: ["Kolay", "Az zor", "Orta", "Çok zor", "İmkansız"]
  },
  {
    id: 5,
    text: "Düşüncelerinizi kontrol edebiliyor musunuz?",
    labels: ["Tamamen", "Çoğunlukla", "Orta", "Az", "Hiç"]
  },
  {
    id: 6,
    text: "Kompulsiyonlarınız günde ne kadar süre alıyor?",
    labels: ["Hiç", "< 1 saat", "1-3 saat", "3-8 saat", "> 8 saat"]
  },
  {
    id: 7,
    text: "Kompulsiyonlar yaşamınızı ne kadar engelliyor?",
    labels: ["Hiç", "Az", "Orta", "Çok", "Aşırı"]
  },
  {
    id: 8,
    text: "Kompulsiyonları yapmadığınızda ne kadar rahatsız olursunuz?",
    labels: ["Hiç", "Az", "Orta", "Çok", "Aşırı"]
  },
  {
    id: 9,
    text: "Kompulsiyonlara direnmek ne kadar zor?",
    labels: ["Kolay", "Az zor", "Orta", "Çok zor", "İmkansız"]
  },
  {
    id: 10,
    text: "Kompulsiyonlarınızı kontrol edebiliyor musunuz?",
    labels: ["Tamamen", "Çoğunlukla", "Orta", "Az", "Hiç"]
  }
];

export default function OnboardingScreen() {
  const { user } = useAuth();
  const {
    currentStep,
    profile,
    ybocsAnswers,
    nextStep,
    previousStep,
    setSymptoms,
    addYbocsAnswer,
    setDailyGoal,
    calculateYbocsSeverity,
    completeOnboarding,
  } = useOnboardingStore();

  const [currentYbocsQuestion, setCurrentYbocsQuestion] = React.useState(0);
  const [sliderValue, setSliderValue] = React.useState(0);

  // Step 1: Karşılama
  const renderWelcome = () => (
    <Animated.View 
      entering={FadeInDown.duration(600)} 
      style={styles.stepContainer}
    >
      <View style={styles.centerContent}>
        <View style={styles.illustrationContainer}>
          <MaterialCommunityIcons 
            name="hand-heart" 
            size={100} 
            color="#10B981" 
          />
        </View>
        
        <Text style={styles.welcomeTitle}>
          Merhaba {user?.email?.split('@')[0] || ''}! 👋
        </Text>
        
        <Text style={styles.welcomeText}>
          Seni daha iyi tanımak ve sana en uygun desteği sunmak için birkaç kısa adımımız var.
        </Text>
        
        <View style={styles.timeIndicator}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#10B981" />
          <Text style={styles.timeText}>90 saniye</Text>
        </View>
      </View>
      
      <View style={styles.bottomButtonContainer}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nextStep();
          }}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>Başlayalım</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  // Step 2: Semptom Seçimi
  const renderSymptomSelection = () => (
    <Animated.View 
      entering={FadeInDown.duration(600)} 
      style={styles.stepContainer}
    >
      <View style={styles.contentHeader}>
        <Text style={styles.stepTitle}>
          Hangi temalar seni etkiliyor?
        </Text>
        <Text style={styles.stepSubtitle}>
          Bir veya birkaçını seçebilirsin
        </Text>
      </View>
      
      <View style={styles.symptomGrid}>
        {SYMPTOM_THEMES.map((theme) => (
          <Pressable
            key={theme.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const symptoms = profile.primarySymptoms || [];
              if (symptoms.includes(theme.id)) {
                setSymptoms(symptoms.filter(s => s !== theme.id));
              } else {
                setSymptoms([...symptoms, theme.id]);
              }
            }}
            style={[
              styles.symptomCard,
              profile.primarySymptoms?.includes(theme.id) && styles.symptomCardActive
            ]}
          >
            <MaterialCommunityIcons 
              name={theme.icon as any} 
              size={32} 
              color={profile.primarySymptoms?.includes(theme.id) ? '#FFFFFF' : '#10B981'}
            />
            <Text style={[
              styles.symptomLabel,
              profile.primarySymptoms?.includes(theme.id) && styles.symptomLabelActive
            ]}>
              {theme.label}
            </Text>
          </Pressable>
        ))}
      </View>
      
      <View style={styles.navigationButtons}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            previousStep();
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Geri</Text>
        </Pressable>
        
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nextStep();
          }}
          disabled={!profile.primarySymptoms?.length}
          style={[
            styles.primaryButton,
            !profile.primarySymptoms?.length && styles.buttonDisabled
          ]}
        >
          <Text style={styles.primaryButtonText}>Devam</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  // Step 3: Y-BOCS Lite
  const renderYBOCS = () => {
    const question = YBOCS_QUESTIONS[currentYbocsQuestion];
    const progress = (currentYbocsQuestion + 1) / YBOCS_QUESTIONS.length;

    const handleSliderChange = (value: number) => {
      setSliderValue(value);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleYbocsNext = () => {
      addYbocsAnswer(sliderValue);
      
      if (currentYbocsQuestion < YBOCS_QUESTIONS.length - 1) {
        setCurrentYbocsQuestion(currentYbocsQuestion + 1);
        setSliderValue(0);
      } else {
        calculateYbocsSeverity();
        nextStep();
      }
    };

    return (
      <Animated.View 
        entering={FadeInDown.duration(600)} 
        style={styles.stepContainer}
      >
        <View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          
          <Text style={styles.questionNumber}>
            {currentYbocsQuestion + 1} / {YBOCS_QUESTIONS.length}
          </Text>
          
          <Text style={styles.questionText}>
            {question.text}
          </Text>
          
          <View style={styles.sliderSection}>
            <Slider
              value={sliderValue}
              onValueChange={handleSliderChange}
              minimumValue={0}
              maximumValue={4}
              step={1}
              style={styles.slider}
            />
            
            <View style={styles.sliderLabels}>
              {question.labels.map((label, index) => (
                <Text 
                  key={index} 
                  style={[
                    styles.sliderLabel,
                    sliderValue === index && styles.sliderLabelActive
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>
        </View>
        
        <View style={styles.navigationButtons}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (currentYbocsQuestion > 0) {
                setCurrentYbocsQuestion(currentYbocsQuestion - 1);
                setSliderValue(ybocsAnswers[currentYbocsQuestion - 1] || 0);
              } else {
                previousStep();
              }
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Geri</Text>
          </Pressable>
          
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleYbocsNext();
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              {currentYbocsQuestion === YBOCS_QUESTIONS.length - 1 ? 'Bitir' : 'Devam'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  // Step 4: Hedef Belirleme
  const renderGoalSetting = () => {
    const getSeverityColor = () => '#10B981';
    const getSeverityText = () => {
      switch (profile.ybocsSeverity) {
        case 'Subclinical': return 'Hafif';
        case 'Mild': return 'Düşük';
        case 'Moderate': return 'Orta';
        case 'Severe': return 'Yüksek';
        case 'Extreme': return 'Çok Yüksek';
        default: return 'Belirsiz';
      }
    };

    return (
      <Animated.View 
        entering={FadeInDown.duration(600)} 
        style={styles.stepContainer}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.resultCard}>
            <MaterialCommunityIcons 
              name="shield-check" 
              size={60} 
              color="#10B981" 
            />
            
            <Text style={styles.resultTitle}>
              Değerlendirme Tamamlandı
            </Text>
            
            <Text style={styles.severityText}>
              Şu anki durumun: {getSeverityText()}
            </Text>
            
            <Text style={styles.resultSubtext}>
              Unutma, bu sadece bir başlangıç. Birlikte ilerleyeceğiz.
            </Text>
          </View>
          
          <View style={styles.goalSection}>
            <Text style={styles.goalTitle}>
              Günlük hedefini belirle
            </Text>
            
            <Text style={styles.goalSubtitle}>
              Günde kaç egzersiz yapmak istersin?
            </Text>
            
            <View style={styles.stepperContainer}>
              <Pressable
                onPress={() => {
                  if ((profile.dailyGoal || 3) > 1) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDailyGoal((profile.dailyGoal || 3) - 1);
                  }
                }}
                style={styles.stepperButton}
              >
                <MaterialCommunityIcons name="minus" size={24} color="#6B7280" />
              </Pressable>
              
              <Text style={styles.stepperValue}>{profile.dailyGoal || 3}</Text>
              
              <Pressable
                onPress={() => {
                  if ((profile.dailyGoal || 3) < 10) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setDailyGoal((profile.dailyGoal || 3) + 1);
                  }
                }}
                style={styles.stepperButton}
              >
                <MaterialCommunityIcons name="plus" size={24} color="#6B7280" />
              </Pressable>
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.bottomButtonContainer}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              nextStep();
            }}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>Devam</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  // Step 5: Oyunlaştırma Tanıtımı
  const renderGamificationIntro = () => (
    <Animated.View 
      entering={FadeInDown.duration(600)} 
      style={styles.stepContainer}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.illustrationContainer}>
          <MaterialCommunityIcons 
            name="trophy" 
            size={100} 
            color="#F59E0B" 
          />
        </View>
        
        <Text style={styles.welcomeTitle}>
          Yolculuğunu Kutlayalım 🎉
        </Text>
        
        <Text style={styles.welcomeText}>
          İlerlemeni takip etmek ve başarılarını kutlamak için motivasyon sistemimizi kullanacağız.
        </Text>
        
        <View style={styles.gamificationFeatures}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name="fire" size={28} color="#F59E0B" />
            </View>
            <Text style={styles.featureTitle}>Günlük Seriler</Text>
            <Text style={styles.featureDescription}>Her gün hedefine ulaş</Text>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name="star" size={28} color="#10B981" />
            </View>
            <Text style={styles.featureTitle}>İyileşme Puanları</Text>
            <Text style={styles.featureDescription}>Her adımda puan kazan</Text>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name="medal" size={28} color="#8B5CF6" />
            </View>
            <Text style={styles.featureTitle}>Rozetler</Text>
            <Text style={styles.featureDescription}>Başarılarını kutla</Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.bottomButtonContainer}>
        <Pressable
          onPress={async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await completeOnboarding(user?.id);
            router.replace('/(tabs)');
          }}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>Harika, Başlayalım!</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderWelcome();
      case 1: return renderSymptomSelection();
      case 2: return renderYBOCS();
      case 3: return renderGoalSetting();
      case 4: return renderGamificationIntro();
      default: return renderWelcome();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Dots */}
      <View style={styles.progressDots}>
        {[0, 1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              currentStep === step && styles.stepDotActive,
              currentStep > step && styles.stepDotCompleted
            ]}
          />
        ))}
      </View>

      {renderStep()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#10B981',
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentHeader: {
    marginTop: 24,
    marginBottom: 32,
  },
  illustrationContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    alignSelf: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
    fontFamily: 'Inter',
  },
  timeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timeText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
  },
  symptomCard: {
    width: (width - 60) / 3,
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  symptomCardActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  symptomLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  symptomLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  questionNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 32,
    lineHeight: 28,
    fontFamily: 'Inter',
  },
  sliderSection: {
    marginBottom: 48,
  },
  slider: {
    height: 40,
    marginBottom: 16,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'center',
  },
  sliderLabelActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  severityText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  resultSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  goalSection: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  goalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    fontFamily: 'Inter',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
    minWidth: 50,
    textAlign: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  primaryButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  bottomButtonContainer: {
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
    paddingTop: 16,
  },
  continueButton: {
    height: 56,
    backgroundColor: '#10B981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  gamificationFeatures: {
    gap: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
});
