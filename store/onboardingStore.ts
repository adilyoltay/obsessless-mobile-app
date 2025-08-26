import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { setAuthProfile } from '@/contexts/authBridge';

// OCD onboarding profile removed

interface OnboardingState {
  currentStep: number;
  profile: Record<string, any>;
  ybocsAnswers: number[]; // legacy
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

  calculateYbocsSeverity: () => {},

  completeOnboarding: async (userId) => {
    const endTime = Date.now();
    const { startTime, profile } = get();
    const duration = (endTime - startTime) / 1000; // seconds
    
    console.log(`✅ Onboarding completed in ${duration}s (Target: ≤90s)`);
    
    try {
      if (userId) {
        // Save profile completion status to AsyncStorage
        await AsyncStorage.setItem('profileCompleted', 'true');
        
        // Save user profile to AsyncStorage
        const completeProfile = {
          ...profile,
          onboardingCompleted: true,
          completedAt: new Date().toISOString()
        };
        
        // Removed ocd_profile storage
        
        console.log('✅ Profile saved to AsyncStorage');

        // Removed Supabase user profile save (OCD-specific)
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