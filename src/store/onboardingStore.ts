/**
 * ObsessLess Onboarding Store
 * 
 * AI destekli onboarding akışının state yönetimi.
 * Kullanıcı ilerlemesini ve kişiselleştirme verilerini saklar.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalizedTreatmentPlan } from '@/ai/services/treatmentPlanner';
import { UserProfileAnalysis } from '@/ai/services/profileAnalyzer';
import { StorageKeys } from '@/utils/storage';

// Onboarding adımları
export type OnboardingStep = 
  | 'welcome'
  | 'chat_intro'
  | 'ocd_assessment'
  | 'therapy_preference'
  | 'goal_setting'
  | 'personalized_plan'
  | 'commitment';

// OKB profili
export interface OCDProfile {
  severity: 'mild' | 'moderate' | 'severe';
  primaryObsessions: string[];
  primaryCompulsions: string[];
  triggers: string[];
  avoidanceBehaviors: string[];
  functionalImpairment: number; // 1-10
  insightLevel: 'good' | 'fair' | 'poor';
  duration: string; // Ne kadar süredir
  previousTreatment: boolean;
}

// Terapi tercihi
export interface TherapyPreference {
  approach: 'cbt' | 'erp' | 'act' | 'mixed';
  timeCommitment: 'minimal' | 'moderate' | 'full';
  preferredSessionTime: 'morning' | 'afternoon' | 'evening';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
}

// Hedefler
export interface UserGoal {
  id: string;
  title: string;
  description: string;
  timeframe: 'short' | 'medium' | 'long'; // 1 ay, 3 ay, 6+ ay
  priority: 'high' | 'medium' | 'low';
  measurable: string; // Nasıl ölçülecek
}

// Onboarding state
interface OnboardingState {
  // Mevcut durum
  isCompleted: boolean;
  currentStep: OnboardingStep;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Kullanıcı verileri
  ocdProfile: OCDProfile | null;
  therapyPreference: TherapyPreference | null;
  userGoals: UserGoal[];
  chatHistory: any[]; // AI sohbet geçmişi
  
  // AI analiz sonuçları
  userProfileAnalysis: UserProfileAnalysis | null;
  personalizedPlan: PersonalizedTreatmentPlan | null;
  
  // İlerleme takibi
  completedSteps: OnboardingStep[];
  stepData: Record<string, any>; // Her adımın verileri
  
  // Actions
  setCurrentStep: (step: OnboardingStep) => void;
  updateOCDProfile: (profile: Partial<OCDProfile>) => void;
  setTherapyPreference: (preference: TherapyPreference) => void;
  addUserGoal: (goal: UserGoal) => void;
  removeUserGoal: (goalId: string) => void;
  updateChatHistory: (messages: any[]) => void;
  setUserProfileAnalysis: (analysis: UserProfileAnalysis) => void;
  setPersonalizedPlan: (plan: PersonalizedTreatmentPlan) => void;
  saveStepData: (step: OnboardingStep, data: any) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
  
  // Yardımcı fonksiyonlar
  getProgress: () => number;
  isStepCompleted: (step: OnboardingStep) => boolean;
  canProceedToStep: (step: OnboardingStep) => boolean;
}

// Varsayılan değerler
const defaultState = {
  isCompleted: false,
  currentStep: 'welcome' as OnboardingStep,
  startedAt: null,
  completedAt: null,
  ocdProfile: null,
  therapyPreference: null,
  userGoals: [],
  chatHistory: [],
  userProfileAnalysis: null,
  personalizedPlan: null,
  completedSteps: [],
  stepData: {},
};

// Store oluştur
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      
      // Adım değiştirme
      setCurrentStep: (step: OnboardingStep) => {
        const state = get();
        
        // İlk adımsa başlangıç zamanını kaydet
        if (!state.startedAt) {
          set({ startedAt: new Date() });
        }
        
        // Mevcut adımı tamamlanmış olarak işaretle
        const completedSteps = [...state.completedSteps];
        if (!completedSteps.includes(state.currentStep)) {
          completedSteps.push(state.currentStep);
        }
        
        set({
          currentStep: step,
          completedSteps,
        });
      },
      
      // OKB profili güncelleme
      updateOCDProfile: (profile: Partial<OCDProfile>) => {
        const current = get().ocdProfile || {} as OCDProfile;
        set({
          ocdProfile: { ...current, ...profile },
        });
      },
      
      // Terapi tercihi
      setTherapyPreference: (preference: TherapyPreference) => {
        set({ therapyPreference: preference });
      },
      
      // Hedef ekleme
      addUserGoal: (goal: UserGoal) => {
        const goals = [...get().userGoals, goal];
        set({ userGoals: goals });
      },
      
      // Hedef silme
      removeUserGoal: (goalId: string) => {
        const goals = get().userGoals.filter(g => g.id !== goalId);
        set({ userGoals: goals });
      },
      
      // Sohbet geçmişi güncelleme
      updateChatHistory: (messages: any[]) => {
        set({ chatHistory: messages });
      },
      
      // Profil analizi
      setUserProfileAnalysis: (analysis: UserProfileAnalysis) => {
        set({ userProfileAnalysis: analysis });
      },
      
      // Kişisel plan
      setPersonalizedPlan: (plan: PersonalizedTreatmentPlan) => {
        set({ personalizedPlan: plan });
      },
      
      // Adım verisi kaydetme
      saveStepData: (step: OnboardingStep, data: any) => {
        const stepData = { ...get().stepData };
        stepData[step] = data;
        set({ stepData });
      },
      
      // Onboarding tamamlama
      completeOnboarding: async () => {
        const state = get();
        
        // Tüm gerekli veriler var mı kontrol et
        if (!state.ocdProfile || !state.therapyPreference || !state.personalizedPlan) {
          throw new Error('Onboarding verileri eksik');
        }
        
        set({
          isCompleted: true,
          completedAt: new Date(),
        });
        
        // Kullanıcı verilerini kaydet
        try {
          // TODO: Verileri Supabase'e kaydet
          const userId = await AsyncStorage.getItem('userId');
          if (userId) {
            await AsyncStorage.setItem(
              StorageKeys.USER_PROFILE(userId),
              JSON.stringify({
                ocdProfile: state.ocdProfile,
                therapyPreference: state.therapyPreference,
                userGoals: state.userGoals,
                personalizedPlan: state.personalizedPlan,
                completedAt: state.completedAt,
              })
            );
          }
        } catch (error) {
          console.error('Onboarding save error:', error);
        }
      },
      
      // Onboarding sıfırlama
      resetOnboarding: () => {
        set(defaultState);
      },
      
      // İlerleme hesaplama
      getProgress: () => {
        const totalSteps = 7; // Toplam adım sayısı
        const completed = get().completedSteps.length;
        return (completed / totalSteps) * 100;
      },
      
      // Adım tamamlanmış mı
      isStepCompleted: (step: OnboardingStep) => {
        return get().completedSteps.includes(step);
      },
      
      // Adıma geçilebilir mi
      canProceedToStep: (step: OnboardingStep) => {
        const state = get();
        
        // Adım sırasına göre kontrol
        const stepOrder: OnboardingStep[] = [
          'welcome',
          'chat_intro',
          'ocd_assessment',
          'therapy_preference',
          'goal_setting',
          'personalized_plan',
          'commitment',
        ];
        
        const targetIndex = stepOrder.indexOf(step);
        const currentIndex = stepOrder.indexOf(state.currentStep);
        
        // Geriye gidebilir
        if (targetIndex <= currentIndex) return true;
        
        // İleriye sadece bir adım gidebilir ve mevcut adım tamamlanmış olmalı
        if (targetIndex === currentIndex + 1) {
          // Özel kontroller
          switch (state.currentStep) {
            case 'chat_intro':
              return state.chatHistory.length > 0;
            case 'ocd_assessment':
              return state.ocdProfile !== null;
            case 'therapy_preference':
              return state.therapyPreference !== null;
            case 'goal_setting':
              return state.userGoals.length > 0;
            case 'personalized_plan':
              return state.personalizedPlan !== null;
            default:
              return true;
          }
        }
        
        return false;
      },
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isCompleted: state.isCompleted,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        ocdProfile: state.ocdProfile,
        therapyPreference: state.therapyPreference,
        userGoals: state.userGoals,
        personalizedPlan: state.personalizedPlan,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      }),
    }
  )
);

// Onboarding durumunu kontrol eden yardımcı hook
export const useOnboardingStatus = () => {
  const { isCompleted, getProgress, currentStep } = useOnboardingStore();
  
  return {
    isCompleted,
    progress: getProgress(),
    currentStep,
    shouldShowOnboarding: !isCompleted,
  };
}; 