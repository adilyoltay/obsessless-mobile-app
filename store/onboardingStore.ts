import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserOCDProfile {
  primarySymptoms: string[]; // e.g., ['contamination', 'checking']
  ybocsLiteScore: number;
  ybocsSeverity: 'Subclinical' | 'Mild' | 'Moderate' | 'Severe' | 'Extreme';
  dailyGoal: number; // Hedeflenen günlük egzersiz sayısı
  onboardingCompleted: boolean;
}

interface OnboardingState {
  currentStep: number;
  profile: Partial<UserOCDProfile>;
  ybocsAnswers: number[];
  startTime: number;
  
  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  setSymptoms: (symptoms: string[]) => void;
  addYbocsAnswer: (answer: number) => void;
  setDailyGoal: (goal: number) => void;
  calculateYbocsSeverity: () => void;
  completeOnboarding: (userId?: string) => Promise<void>;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 0,
  profile: {
    primarySymptoms: [],
    ybocsLiteScore: 0,
    ybocsSeverity: 'Subclinical',
    dailyGoal: 3,
    onboardingCompleted: false,
  },
  ybocsAnswers: [],
  startTime: Date.now(),

  setStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => ({ 
    currentStep: Math.min(state.currentStep + 1, 4) 
  })),
  
  previousStep: () => set((state) => ({ 
    currentStep: Math.max(state.currentStep - 1, 0) 
  })),

  setSymptoms: (symptoms) => set((state) => ({
    profile: { ...state.profile, primarySymptoms: symptoms }
  })),

  addYbocsAnswer: (answer) => set((state) => ({
    ybocsAnswers: [...state.ybocsAnswers, answer]
  })),

  setDailyGoal: (goal) => set((state) => ({
    profile: { ...state.profile, dailyGoal: goal }
  })),

  calculateYbocsSeverity: () => {
    const { ybocsAnswers } = get();
    const totalScore = ybocsAnswers.reduce((sum, answer) => sum + answer, 0);
    
    let severity: UserOCDProfile['ybocsSeverity'];
    if (totalScore <= 7) severity = 'Subclinical';
    else if (totalScore <= 15) severity = 'Mild';
    else if (totalScore <= 23) severity = 'Moderate';
    else if (totalScore <= 31) severity = 'Severe';
    else severity = 'Extreme';

    set((state) => ({
      profile: { 
        ...state.profile, 
        ybocsLiteScore: totalScore,
        ybocsSeverity: severity
      }
    }));
  },

  completeOnboarding: async (userId) => {
    const endTime = Date.now();
    const { startTime, profile } = get();
    const duration = (endTime - startTime) / 1000; // seconds
    
    console.log(`✅ Onboarding completed in ${duration}s (Target: ≤90s)`);
    
    try {
      if (userId) {
        // Save profile completion status
        await AsyncStorage.setItem('profileCompleted', 'true');
        
        // Save user profile
        const completeProfile = {
          ...profile,
          onboardingCompleted: true,
          completedAt: new Date().toISOString()
        };
        
        await AsyncStorage.setItem(
          `ocd_profile_${userId}`,
          JSON.stringify(completeProfile)
        );
        
        console.log('✅ Profile saved to AsyncStorage');
      }
    } catch (error) {
      console.error('❌ Failed to save profile:', error);
    }
    
    set((state) => ({
      profile: { ...state.profile, onboardingCompleted: true }
    }));
  },

  resetOnboarding: () => set({
    currentStep: 0,
    profile: {
      primarySymptoms: [],
      ybocsLiteScore: 0,
      ybocsSeverity: 'Subclinical',
      dailyGoal: 3,
      onboardingCompleted: false,
    },
    ybocsAnswers: [],
    startTime: Date.now(),
  }),
})); 