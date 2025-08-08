/**
 * 🧠 Global AI Context Provider
 * 
 * Tüm AI servislerini merkezi olarak yöneten React Context.
 * Sprint 1-7'deki tüm AI özelliklerini koordine eder.
 * 
 * Features:
 * ✅ Centralized AI service management
 * ✅ Global AI state synchronization
 * ✅ Service initialization & health monitoring
 * ✅ Feature flag integration
 * ✅ Error handling & recovery
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth
import { useAuth } from '@/contexts/SupabaseAuthContext';

// AI Services - Sprint Integration
import { aiManager } from '@/features/ai/config/aiManager';
import { insightsCoordinator } from '@/features/ai/coordinators/insightsCoordinator';
import { contextIntelligence } from '@/features/ai/context/contextIntelligence';
import { adaptiveInterventions } from '@/features/ai/interventions/adaptiveInterventions';
import { jitaiEngine } from '@/features/ai/jitai/jitaiEngine';
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
import { onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { treatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { riskAssessmentService } from '@/features/ai/services/riskAssessmentService';
import { useAIChatStore } from '@/features/ai/store/aiChatStore';

// Types
import type { 
  UserProfile, 
  TreatmentPlan, 
  OnboardingSession,
  RiskAssessment,
  OCDAnalysis 
} from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Feature Flags
import { FEATURE_FLAGS } from '@/constants/featureFlags';

/**
 * 🎯 AI Context Interface
 */
interface AIContextType {
  // Service Status
  isInitialized: boolean;
  isInitializing: boolean;
  initializationError: string | null;
  
  // User AI Data
  userProfile: UserProfile | null;
  treatmentPlan: TreatmentPlan | null;
  currentRiskAssessment: RiskAssessment | null;
  onboardingSession: OnboardingSession | null;
  
  // AI Capabilities
  hasCompletedOnboarding: boolean;
  availableFeatures: string[];
  
  // Actions
  initializeAIServices: () => Promise<void>;
  startOnboarding: () => Promise<OnboardingSession | null>;
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  generateInsights: () => Promise<any[]>;
  assessRisk: () => Promise<RiskAssessment | null>;
  triggerIntervention: (context: any) => Promise<void>;
  
  // Chat Integration
  chatStore: ReturnType<typeof useAIChatStore>;
}

/**
 * 🧠 AI Context Creation
 */
const AIContext = createContext<AIContextType | undefined>(undefined);

/**
 * 🔧 AI Context Provider Props
 */
interface AIProviderProps {
  children: ReactNode;
}

/**
 * 🚀 AI Context Provider Component
 */
export function AIProvider({ children }: AIProviderProps) {
  const { user } = useAuth();
  const chatStore = useAIChatStore();
  
  // Service Status
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // User AI Data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [currentRiskAssessment, setCurrentRiskAssessment] = useState<RiskAssessment | null>(null);
  const [onboardingSession, setOnboardingSession] = useState<OnboardingSession | null>(null);
  
  // AI Capabilities
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);

  /**
   * 🔄 Initialize AI Services
   */
  const initializeAIServices = async (): Promise<void> => {
    if (!user?.id || isInitializing) {
      return;
    }

    setIsInitializing(true);
    setInitializationError(null);

    try {
      console.log('🚀 Initializing AI services for user:', user.id);

      // Track initialization start
      await trackAIInteraction(AIEventType.CHAT_SESSION_STARTED, {
        userId: user.id,
        context: 'ai_context_initialization'
      });

      // Initialize core AI manager
      await aiManager.initialize();

      // Get available features based on flags
      const features = [];
      
      if (FEATURE_FLAGS.isEnabled('AI_CHAT')) {
        features.push('AI_CHAT');
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
        await insightsCoordinator.initialize();
        features.push('AI_INSIGHTS');
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_CONTEXT_INTELLIGENCE')) {
        if (contextIntelligence && typeof contextIntelligence.initialize === 'function') {
          await contextIntelligence.initialize();
          features.push('AI_CONTEXT_INTELLIGENCE');
        } else {
          console.warn('⚠️ Context Intelligence service not available');
        }
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
        if (adaptiveInterventions && typeof adaptiveInterventions.initialize === 'function') {
          await adaptiveInterventions.initialize();
          features.push('AI_ADAPTIVE_INTERVENTIONS');
        } else {
          console.warn('⚠️ Adaptive Interventions service not available');
        }
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_JITAI')) {
        await jitaiEngine.initialize();
        features.push('AI_JITAI');
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_YBOCS_ANALYSIS')) {
        if (ybocsAnalysisService && typeof ybocsAnalysisService.initialize === 'function') {
          await ybocsAnalysisService.initialize();
          features.push('AI_YBOCS_ANALYSIS');
        } else {
          console.warn('⚠️ Y-BOCS Analysis service not available');
        }
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2')) {
        if (onboardingEngine && typeof onboardingEngine.initialize === 'function') {
          await onboardingEngine.initialize();
          features.push('AI_ONBOARDING_V2');
        } else {
          console.warn('⚠️ Onboarding Engine not available');
        }
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_USER_PROFILING')) {
        if (userProfilingService && typeof userProfilingService.initialize === 'function') {
          await userProfilingService.initialize();
          features.push('AI_USER_PROFILING');
        } else {
          console.warn('⚠️ User Profiling service not available');
        }
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING')) {
        if (treatmentPlanningEngine && typeof treatmentPlanningEngine.initialize === "function") { await treatmentPlanningEngine.initialize(); } else { console.warn("⚠️ Treatment Planning Engine not available"); }
        features.push('AI_TREATMENT_PLANNING');
      }
      
      if (FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT')) {
        if (riskAssessmentService && typeof riskAssessmentService.initialize === "function") { await riskAssessmentService.initialize(); } else { console.warn("⚠️ Risk Assessment service not available"); }
        features.push('AI_RISK_ASSESSMENT');
      }

      setAvailableFeatures(features);

      // Load existing user data
      await loadUserAIData();

      setIsInitialized(true);
      console.log('✅ AI services initialized successfully');

      // Track successful initialization
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: user.id,
        context: 'ai_context_initialized',
        availableFeatures: features
      });

    } catch (error) {
      console.error('❌ AI services initialization failed:', error);
      setInitializationError(error instanceof Error ? error.message : 'Unknown error');
      
      // Track initialization failure
      await trackAIInteraction(AIEventType.CHAT_ERROR, {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'ai_context_initialization_failed'
      });
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * 📊 Load User AI Data
   */
  const loadUserAIData = async (): Promise<void> => {
    if (!user?.id) return;

    try {
      // Check onboarding status
      const onboardingCompleted = await AsyncStorage.getItem(`ai_onboarding_completed_${user.id}`);
      setHasCompletedOnboarding(onboardingCompleted === 'true');

      // Load user profile
      const profileData = await AsyncStorage.getItem(`ai_user_profile_${user.id}`);
      if (profileData) {
        setUserProfile(JSON.parse(profileData));
      }

      // Load treatment plan
      const treatmentData = await AsyncStorage.getItem(`ai_treatment_plan_${user.id}`);
      if (treatmentData) {
        setTreatmentPlan(JSON.parse(treatmentData));
      }

      // Load latest risk assessment
      const riskData = await AsyncStorage.getItem(`ai_risk_assessment_${user.id}`);
      if (riskData) {
        setCurrentRiskAssessment(JSON.parse(riskData));
      }

    } catch (error) {
      console.error('❌ Error loading user AI data:', error);
    }
  };

  /**
   * 🧭 Start Onboarding
   */
  const startOnboarding = async (): Promise<OnboardingSession | null> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2')) {
      return null;
    }

    try {
      const session = await onboardingEngine.getInstance().initializeSession(user.id, {
        culturalContext: 'turkish',
        preferredLanguage: 'tr'
      });
      
      setOnboardingSession(session);
      return session;
    } catch (error) {
      console.error('❌ Error starting onboarding:', error);
      return null;
    }
  };

  /**
   * 👤 Update User Profile
   */
  const updateUserProfile = async (profileUpdate: Partial<UserProfile>): Promise<void> => {
    if (!user?.id || !userProfile) return;

    try {
      const updatedProfile = { ...userProfile, ...profileUpdate };
      setUserProfile(updatedProfile);
      
      // Persist to storage
      await AsyncStorage.setItem(
        `ai_user_profile_${user.id}`, 
        JSON.stringify(updatedProfile)
      );

      // Update via service if available
      if (FEATURE_FLAGS.isEnabled('AI_USER_PROFILING')) {
        await userProfilingService.getInstance().updateProfile(user.id, profileUpdate);
      }
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
    }
  };

  /**
   * 💡 Generate Insights
   */
  const generateInsights = async (): Promise<any[]> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      return [];
    }

    try {
      // Get today's data for insights context
      const todayData = {
        date: new Date().toDateString(),
        userId: user.id,
        profile: userProfile,
        treatmentPlan
      };

      const insights = await insightsCoordinator.generateDailyInsights(user.id, todayData);
      return insights || [];
    } catch (error) {
      console.error('❌ Error generating insights:', error);
      return [];
    }
  };

  /**
   * 🛡️ Assess Risk
   */
  const assessRisk = async (): Promise<RiskAssessment | null> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT')) {
      return null;
    }

    try {
      const riskData = {
        userProfile,
        treatmentPlan
      };

      const assessment = await riskAssessmentService.getInstance().assessRisk(user.id, riskData);
      setCurrentRiskAssessment(assessment);

      // Persist to storage
      await AsyncStorage.setItem(
        `ai_risk_assessment_${user.id}`, 
        JSON.stringify(assessment)
      );

      return assessment;
    } catch (error) {
      console.error('❌ Error assessing risk:', error);
      return null;
    }
  };

  /**
   * 🎯 Trigger Intervention
   */
  const triggerIntervention = async (context: any): Promise<void> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
      return;
    }

    try {
      await adaptiveInterventions.triggerIntervention(user.id, {
        ...context,
        userProfile,
        riskLevel: currentRiskAssessment?.riskLevel
      });
    } catch (error) {
      console.error('❌ Error triggering intervention:', error);
    }
  };

  /**
   * 🔄 Auto-initialize when user changes
   */
  useEffect(() => {
    if (user?.id && !isInitialized && !isInitializing) {
      initializeAIServices();
    }
  }, [user?.id]);

  /**
   * 🧹 Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cleanup AI services if needed
      setIsInitialized(false);
      setUserProfile(null);
      setTreatmentPlan(null);
      setCurrentRiskAssessment(null);
      setOnboardingSession(null);
    };
  }, []);

  const contextValue: AIContextType = {
    // Service Status
    isInitialized,
    isInitializing,
    initializationError,
    
    // User AI Data
    userProfile,
    treatmentPlan,
    currentRiskAssessment,
    onboardingSession,
    
    // AI Capabilities
    hasCompletedOnboarding,
    availableFeatures,
    
    // Actions
    initializeAIServices,
    startOnboarding,
    updateUserProfile,
    generateInsights,
    assessRisk,
    triggerIntervention,
    
    // Chat Integration
    chatStore
  };

  return (
    <AIContext.Provider value={contextValue}>
      {children}
    </AIContext.Provider>
  );
}

/**
 * 🪝 useAI Hook
 */
export function useAI(): AIContextType {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

/**
 * 🎯 Selective AI Hooks for Performance
 */

// For components that only need service status
export function useAIStatus() {
  const { isInitialized, isInitializing, initializationError, availableFeatures } = useAI();
  return { isInitialized, isInitializing, initializationError, availableFeatures };
}

// For components that only need user data
export function useAIUserData() {
  const { userProfile, treatmentPlan, currentRiskAssessment, hasCompletedOnboarding } = useAI();
  return { userProfile, treatmentPlan, currentRiskAssessment, hasCompletedOnboarding };
}

// For components that only need actions
export function useAIActions() {
  const { 
    initializeAIServices, 
    startOnboarding, 
    updateUserProfile, 
    generateInsights, 
    assessRisk, 
    triggerIntervention 
  } = useAI();
  return { 
    initializeAIServices, 
    startOnboarding, 
    updateUserProfile, 
    generateInsights, 
    assessRisk, 
    triggerIntervention 
  };
}