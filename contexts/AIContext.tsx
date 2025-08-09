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

import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { InteractionManager } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Auth
import { useAuth } from '@/contexts/SupabaseAuthContext';

// AI Services - Sprint Integration
import { aiManager } from '@/features/ai/config/aiManager';
import { insightsCoordinator } from '@/features/ai/coordinators/insightsCoordinator';
import contextIntelligenceEngine from '@/features/ai/context/contextIntelligence';
import adaptiveInterventionsEngine from '@/features/ai/interventions/adaptiveInterventions';

// Alias for backward compatibility
const contextIntelligence = contextIntelligenceEngine;
const adaptiveInterventions = adaptiveInterventionsEngine;
import { jitaiEngine } from '@/features/ai/jitai/jitaiEngine';
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
// Note: onboardingEngine removed - OnboardingFlowV3 uses direct state management
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { adaptiveTreatmentPlanningEngine as treatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { advancedRiskAssessmentService as riskAssessmentService } from '@/features/ai/services/riskAssessmentService';
import { artTherapyEngine } from '@/features/ai/artTherapy/artTherapyEngine';
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
  
  // Network Status
  isOnline: boolean;
  isConnected: boolean;
  networkType: string | null;
  
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
  
  // Network Status
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);
  
  // User AI Data
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [currentRiskAssessment, setCurrentRiskAssessment] = useState<RiskAssessment | null>(null);
  const [onboardingSession, setOnboardingSession] = useState<OnboardingSession | null>(null);
  
  // AI Capabilities
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);

  /**
   * 🔄 Initialize AI Services - Performance Optimized with Parallel Loading
   */
  const initializeAIServices = useCallback(async (): Promise<void> => {
    if (!user?.id || isInitializing) {
      return;
    }

    setIsInitializing(true);
    setInitializationError(null);
    const startTime = Date.now();

    try {
      console.log('🚀 Initializing AI services for user:', user.id);

      // Track initialization start
      await trackAIInteraction(AIEventType.CHAT_SESSION_STARTED, {
        userId: user.id,
        context: 'ai_context_initialization'
      });

      // Core manager initialization (must be first)
      await aiManager.initialize();

      // Prepare parallel service initialization tasks
      const initializationTasks: Array<{ name: string; task: () => Promise<void>; enabled: boolean }> = [
        {
          name: 'AI_INSIGHTS',
          enabled: FEATURE_FLAGS.isEnabled('AI_INSIGHTS'),
          task: async () => await insightsCoordinator.initialize()
        },
        {
          name: 'AI_CONTEXT_INTELLIGENCE',
          enabled: FEATURE_FLAGS.isEnabled('AI_CONTEXT_INTELLIGENCE'),
          task: async () => {
            if (contextIntelligence && typeof contextIntelligence.initialize === 'function') {
              await contextIntelligence.initialize();
            } else {
              throw new Error('Context Intelligence service not available');
            }
          }
        },
        {
          name: 'AI_ADAPTIVE_INTERVENTIONS',
          enabled: FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS'),
          task: async () => {
            if (adaptiveInterventions && typeof adaptiveInterventions.initialize === 'function') {
              await adaptiveInterventions.initialize();
            } else {
              throw new Error('Adaptive Interventions service not available');
            }
          }
        },
        {
          name: 'AI_JITAI',
          enabled: FEATURE_FLAGS.isEnabled('AI_JITAI'),
          task: async () => await jitaiEngine.initialize()
        },
        {
          name: 'AI_YBOCS_ANALYSIS',
          enabled: FEATURE_FLAGS.isEnabled('AI_YBOCS_ANALYSIS'),
          task: async () => {
            if (ybocsAnalysisService && typeof ybocsAnalysisService.initialize === 'function') {
              await ybocsAnalysisService.initialize();
            } else {
              throw new Error('Y-BOCS Analysis service not available');
            }
          }
        },
        {
          name: 'AI_USER_PROFILING',
          enabled: FEATURE_FLAGS.isEnabled('AI_USER_PROFILING'),
          task: async () => {
            if (userProfilingService && typeof userProfilingService.initialize === 'function') {
              await userProfilingService.initialize();
            } else {
              throw new Error('User Profiling service not available');
            }
          }
        },
        {
          name: 'AI_TREATMENT_PLANNING',
          enabled: FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING'),
          task: async () => {
            if (treatmentPlanningEngine && typeof treatmentPlanningEngine.initialize === "function") {
              await treatmentPlanningEngine.initialize();
            } else {
              throw new Error('Treatment Planning Engine not available');
            }
          }
        },
        {
          name: 'AI_RISK_ASSESSMENT',
          enabled: FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT'),
          task: async () => {
            if (riskAssessmentService && typeof riskAssessmentService.initialize === "function") {
              await riskAssessmentService.initialize();
            } else {
              throw new Error('Risk Assessment service not available');
            }
          }
        }
      ];

      // Execute initialization tasks in parallel with individual error handling
      const features: string[] = [];
      const results = await Promise.allSettled(
        initializationTasks
          .filter(task => task.enabled)
          .map(async (task) => {
            try {
              await task.task();
              features.push(task.name);
              console.log(`✅ ${task.name} initialized successfully`);
              return { name: task.name, success: true };
            } catch (error) {
              console.warn(`⚠️ ${task.name} initialization failed:`, error);
              return { name: task.name, success: false, error };
            }
          })
      );

      // Add always-available features
      if (FEATURE_FLAGS.isEnabled('AI_CHAT')) {
        features.push('AI_CHAT');
      }
      if (FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2')) {
        features.push('AI_ONBOARDING_V2');
        console.log('🎯 OnboardingFlowV3 enabled with direct state management');
      }

      setAvailableFeatures(features);

      // Load user data in background after UI updates
      InteractionManager.runAfterInteractions(() => {
        loadUserAIData();
      });

      setIsInitialized(true);
      const initTime = Date.now() - startTime;
      console.log(`✅ AI services initialized successfully in ${initTime}ms`);

      // Track successful initialization with performance metrics
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: user.id,
        context: 'ai_context_initialized',
        availableFeatures: features,
        initializationTime: initTime,
        successfulServices: features.length,
        totalAttempted: initializationTasks.filter(t => t.enabled).length
      });

    } catch (error) {
      const initTime = Date.now() - startTime;
      console.error('❌ AI services initialization failed:', error);
      setInitializationError(error instanceof Error ? error.message : 'Unknown error');
      
      // Track initialization failure
      await trackAIInteraction(AIEventType.CHAT_ERROR, {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        context: 'ai_context_initialization_failed',
        initializationTime: initTime
      });
    } finally {
      setIsInitializing(false);
    }
  }, [user?.id]);

  /**
   * 📊 Load User AI Data
   */
  const loadUserAIData = async (): Promise<void> => {
    if (!user?.id) {
      console.warn('⚠️ loadUserAIData: No user ID available');
      return;
    }

    // Güvenli user ID kontrolü
    const userId = user.id;
    if (typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ loadUserAIData: Invalid user ID:', userId);
      return;
    }

    try {
      // Check onboarding status - Supabase first then local fallback
      let completed = false;
      try {
        const { data: profileRow } = await supabaseService.supabaseClient
          .from('ai_profiles')
          .select('onboarding_completed, profile_data')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileRow) {
          completed = !!profileRow.onboarding_completed;
          // If profile_data exists in DB, sync to local
          if (profileRow.profile_data) {
            setUserProfile(profileRow.profile_data);
            await AsyncStorage.setItem(`ai_user_profile_${userId}`, JSON.stringify(profileRow.profile_data));
          }
        }
      } catch {}

      if (!completed) {
        const onboardingKey = `ai_onboarding_completed_${userId}`;
        const onboardingCompleted = await AsyncStorage.getItem(onboardingKey);
        completed = onboardingCompleted === 'true';
      }
      setHasCompletedOnboarding(completed);

      // Load user profile - prefer Supabase if available
      if (!userProfile) {
        const { data: profileRow } = await supabaseService.supabaseClient
          .from('ai_profiles')
          .select('profile_data')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileRow?.profile_data) {
          setUserProfile(profileRow.profile_data);
          await AsyncStorage.setItem(`ai_user_profile_${userId}`, JSON.stringify(profileRow.profile_data));
        } else {
          const profileKey = `ai_user_profile_${userId}`;
          const profileData = await AsyncStorage.getItem(profileKey);
          if (profileData) setUserProfile(JSON.parse(profileData));
        }
      }

      // Load treatment plan - prefer Supabase if available
      if (!treatmentPlan) {
        const { data: planRow } = await supabaseService.supabaseClient
          .from('ai_treatment_plans')
          .select('plan_data')
          .eq('user_id', userId)
          .maybeSingle();
        if (planRow?.plan_data) {
          setTreatmentPlan(planRow.plan_data);
          await AsyncStorage.setItem(`ai_treatment_plan_${userId}`, JSON.stringify(planRow.plan_data));
        } else {
          const treatmentKey = `ai_treatment_plan_${userId}`;
          const treatmentData = await AsyncStorage.getItem(treatmentKey);
          if (treatmentData) setTreatmentPlan(JSON.parse(treatmentData));
        }
      }

      // Load latest risk assessment
      const riskKey = `ai_risk_assessment_${userId}`;
      const riskData = await AsyncStorage.getItem(riskKey);
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
  const startOnboarding = useCallback(async (): Promise<OnboardingSession | null> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2')) {
      return null;
    }

    try {
      // OnboardingFlowV3 uses direct state management, create simple session object
      const session: OnboardingSession = {
        id: `onboarding_${user.id}_${Date.now()}`,
        userId: user.id,
        status: 'in_progress',
        currentStep: 'welcome',
        startedAt: new Date(),
        culturalContext: 'turkish',
        preferredLanguage: 'tr',
        progress: {
          completedSteps: [],
          totalSteps: 13,
          currentStepIndex: 0
        }
      };
      
      setOnboardingSession(session);
      return session;
    } catch (error) {
      console.error('❌ Error starting onboarding:', error);
      return null;
    }
  }, [user?.id]);

  /**
   * 👤 Update User Profile
   */
  const updateUserProfile = useCallback(async (profileUpdate: Partial<UserProfile>): Promise<void> => {
    if (!user?.id || !userProfile) return;

    const userId = user.id;
    if (typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ updateUserProfile: Invalid user ID:', userId);
      return;
    }

    try {
      const updatedProfile = { ...userProfile, ...profileUpdate };
      setUserProfile(updatedProfile);
      
      // Persist to storage with safe key
      const profileKey = `ai_user_profile_${userId}`;
      await AsyncStorage.setItem(profileKey, JSON.stringify(updatedProfile));

      // Update via service if available
      if (FEATURE_FLAGS.isEnabled('AI_USER_PROFILING')) {
        await userProfilingService.getInstance().updateProfile(userId, profileUpdate);
      }
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
    }
  }, [user?.id, userProfile]);

  /**
   * 💡 Generate Insights (Offline-Aware)
   */
  const generateInsights = useCallback(async (): Promise<any[]> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      return [];
    }

    // Offline fallback
    if (!isOnline) {
      console.warn('📱 Offline mode: Using cached insights');
      
      try {
        const cachedInsights = await AsyncStorage.getItem(`ai_cached_insights_${user.id}`);
        if (cachedInsights) {
          const parsed = JSON.parse(cachedInsights);
          // Return cached insights if less than 24 hours old
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            return parsed.insights || [];
          }
        }
      } catch (error) {
        console.error('❌ Error loading cached insights:', error);
      }
      
      // Return offline message as insight
      return [{
        id: 'offline_notice',
        type: 'system',
        content: 'İnternet bağlantısı olmadığı için önceki öngörüler gösteriliyor. Bağlantı kurulduğunda güncel öngörüler yüklenecek.',
        timestamp: new Date(),
        priority: 'low'
      }];
    }

    try {
      // Get today's data for insights context
      const todayData = {
        date: new Date().toDateString(),
        userId: user.id,
        profile: userProfile,
        treatmentPlan
      };

      // Check if generateDailyInsights method exists
      if (insightsCoordinator && typeof insightsCoordinator.generateDailyInsights === "function") {
        const insights = await insightsCoordinator.generateDailyInsights(user.id, todayData);
        
        // Cache successful insights
        if (insights && insights.length > 0) {
          try {
            await AsyncStorage.setItem(`ai_cached_insights_${user.id}`, JSON.stringify({
              insights,
              timestamp: Date.now()
            }));
          } catch (cacheError) {
            console.warn('⚠️ Failed to cache insights:', cacheError);
          }
        }
        
        return insights || [];
      } else {
        console.warn("⚠️ Insights Coordinator generateDailyInsights not available");
        return [];
      }
    } catch (error) {
      console.error('❌ Error generating insights:', error);
      return [];
    }
  }, [user?.id, userProfile, treatmentPlan, isOnline]);

  /**
   * 🛡️ Assess Risk
   */
  const assessRisk = useCallback(async (): Promise<RiskAssessment | null> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT')) {
      return null;
    }

    const userId = user.id;
    if (typeof userId !== 'string' || userId.trim() === '') {
      console.error('❌ assessRisk: Invalid user ID:', userId);
      return null;
    }

    try {
      const riskData = {
        userProfile,
        treatmentPlan
      };

      const assessment = await riskAssessmentService.assessRisk(userId, riskData);
      setCurrentRiskAssessment(assessment);

      // Persist to storage with safe key
      const riskKey = `ai_risk_assessment_${userId}`;
      await AsyncStorage.setItem(riskKey, JSON.stringify(assessment));

      return assessment;
    } catch (error) {
      console.error('❌ Error assessing risk:', error);
      return null;
    }
  }, [user?.id, userProfile, treatmentPlan]);

  /**
   * 🎯 Trigger Intervention
   */
  const triggerIntervention = useCallback(async (context: any): Promise<void> => {
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
  }, [user?.id, userProfile, currentRiskAssessment]);

  /**
   * 🌐 Network Status Monitoring
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('🌐 Network state changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      });
      
      setIsConnected(state.isConnected ?? false);
      setIsOnline(state.isInternetReachable ?? false);
      setNetworkType(state.type || null);
      
      // Track network changes for telemetry
      trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        networkStatus: state.isConnected ? 'connected' : 'disconnected',
        networkType: state.type,
        isInternetReachable: state.isInternetReachable,
        userId: user?.id
      });
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected ?? false);
      setIsOnline(state.isInternetReachable ?? false);
      setNetworkType(state.type || null);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  /**
   * 🔄 Auto-initialize when user changes
   */
  useEffect(() => {
    if (user?.id && !isInitialized && !isInitializing) {
      initializeAIServices();
    }
  }, [user?.id, isInitialized, isInitializing, initializeAIServices]);

  /**
   * 🔄 Reset AI state when user signs out
   */
  useEffect(() => {
    if (!user) {
      // User signed out - reset all AI state
      console.log('🔄 User signed out - resetting AI state');
      setIsInitialized(false);
      setUserProfile(null);
      setTreatmentPlan(null);
      setCurrentRiskAssessment(null);
      setOnboardingSession(null);
      setHasCompletedOnboarding(false);
      setAvailableFeatures([]);
    }
  }, [user]);

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

  // Optimize context value with useMemo to prevent unnecessary re-renders
  const contextValue: AIContextType = useMemo(() => ({
    // Service Status
    isInitialized,
    isInitializing,
    initializationError,
    
    // Network Status
    isOnline,
    isConnected,
    networkType,
    
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
  }), [
    isInitialized,
    isInitializing,
    initializationError,
    isOnline,
    isConnected,
    networkType,
    userProfile,
    treatmentPlan,
    currentRiskAssessment,
    onboardingSession,
    hasCompletedOnboarding,
    availableFeatures,
    initializeAIServices,
    startOnboarding,
    updateUserProfile,
    generateInsights,
    assessRisk,
    triggerIntervention,
    chatStore
  ]);

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