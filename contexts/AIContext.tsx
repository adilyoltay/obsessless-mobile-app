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
import { safeStorageKey } from '@/lib/queryClient';
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
// Risk Assessment Service (advanced) - runtime optional
import { advancedRiskAssessmentService as riskAssessmentService } from '@/features/ai/services/riskAssessmentService';
// Art Therapy Engine import'u yalnızca feature flag açıkken dinamik yüklenecek
// AI Chat removed

// Types
import type {
  UserTherapeuticProfile as UserProfile,
  TreatmentPlan,
  OnboardingSession,
  CulturalContext,
  CommunicationStyle,
  RiskAssessment,
  OCDAnalysis
} from '@/features/ai/types';
import { OnboardingStep, OnboardingSessionState } from '@/features/ai/types';

// Telemetry
import { trackAIInteraction, trackAIError, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

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
  safeMode: boolean;
  safeModeReason?: 'env' | 'memory' | 'errors';
  
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
  // assessRisk removed
  triggerIntervention: (context: any) => Promise<void>;
  
  // Chat Integration removed
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
  // Chat store removed
  
  // Service Status
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  
  // Network Status
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);
  const [safeMode, setSafeMode] = useState<boolean>(false);
  const [safeModeReason, setSafeModeReason] = useState<'env' | 'memory' | 'errors' | undefined>(undefined);
  
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
      if (__DEV__) console.log('🚀 Initializing AI services for user:', user.id);

      // Track initialization start (system-level event)
      await trackAIInteraction(AIEventType.SYSTEM_STARTED, {
        userId: user.id,
        context: 'ai_context_initialization'
      });

      // Core manager initialization (must be first)
      await aiManager.initialize();
      // Environment doğrulaması: eğer AIManager prerequisites fail ise güvenli mod
      if (!aiManager.isEnabled) {
        setSafeMode(true);
        setSafeModeReason('env');
      }

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
          enabled: FEATURE_FLAGS.isEnabled('AI_JITAI_SYSTEM'),
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
          name: 'AI_EXTERNAL_SERVICE',
          enabled: FEATURE_FLAGS.isEnabled('AI_EXTERNAL_API'),
          task: async () => {
            const { externalAIService } = await import('@/features/ai/services/externalAIService');
            await externalAIService.initialize();
          }
        },
        {
          name: 'AI_CBT_ENGINE',
          enabled: FEATURE_FLAGS.isEnabled('AI_CBT_ENGINE'),
          task: async () => {
            const { cbtEngine } = await import('@/features/ai/engines/cbtEngine');
            await cbtEngine.initialize();
          }
        },
        {
          name: 'AI_INSIGHTS_ENGINE_V2',
          enabled: FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2'),
          task: async () => {
            const { insightsEngineV2 } = await import('@/features/ai/engines/insightsEngineV2');
            await insightsEngineV2.initialize();
          }
        },
        {
          name: 'AI_PATTERN_RECOGNITION_V2',
          enabled: FEATURE_FLAGS.isEnabled('AI_PATTERN_RECOGNITION_V2'),
          task: async () => {
            const { patternRecognitionV2 } = await import('@/features/ai/services/patternRecognitionV2');
            await patternRecognitionV2.initialize();
          }
        },
        {
          name: 'AI_SMART_NOTIFICATIONS',
          enabled: FEATURE_FLAGS.isEnabled('AI_SMART_NOTIFICATIONS'),
          task: async () => {
            const { smartNotificationService } = await import('@/features/ai/services/smartNotifications');
            await smartNotificationService.initialize();
          }
        },
        {
          name: 'AI_THERAPEUTIC_PROMPTS',
          enabled: FEATURE_FLAGS.isEnabled('AI_THERAPEUTIC_PROMPTS'),
          task: async () => {
            const { therapeuticPromptEngine } = await import('@/features/ai/prompts/therapeuticPrompts');
            await therapeuticPromptEngine.initialize();
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
          name: 'AI_ART_THERAPY',
          enabled: FEATURE_FLAGS.isEnabled('AI_ART_THERAPY'),
          task: async () => {
            const { artTherapyEngine } = await import('@/features/ai/artTherapy/artTherapyEngine');
            if (artTherapyEngine && typeof artTherapyEngine.initialize === 'function') {
              await artTherapyEngine.initialize();
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
              if (__DEV__) console.log(`✅ ${task.name} initialized successfully`);
              return { name: task.name, success: true };
            } catch (error) {
              if (__DEV__) console.warn(`⚠️ ${task.name} initialization failed:`, error);
              try {
                await trackAIInteraction(
                  AIEventType.SYSTEM_STATUS,
                  {
                    event: 'service_init_failed',
                    service: task.name,
                    error: error instanceof Error ? error.message : String(error)
                  },
                  user?.id
                );
              } catch {}
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
        if (__DEV__) console.log('🎯 OnboardingFlowV3 enabled with direct state management');
      }

      setAvailableFeatures(features);

      // Load user data in background after UI updates (with basic retry)
      InteractionManager.runAfterInteractions(() => {
        let attempts = 0;
        const tryLoad = async () => {
          try {
            await loadUserAIData();
          } catch (e) {
            if (attempts < 2) {
              attempts++;
              setTimeout(tryLoad, 300 * attempts);
            }
          }
        };
        tryLoad();
      });

      setIsInitialized(true);
      const initTime = Date.now() - startTime;
      if (__DEV__) console.log(`✅ AI services initialized successfully in ${initTime}ms`);

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
      if (__DEV__) console.error('❌ AI services initialization failed:', error);
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
      if (__DEV__) console.warn('⚠️ loadUserAIData: No user ID available');
      return;
    }

    // Güvenli user ID kontrolü
    const userId = user.id;
    if (typeof userId !== 'string' || userId.trim() === '') {
      if (__DEV__) console.error('❌ loadUserAIData: Invalid user ID:', userId);
      return;
    }

    try {
      // Supabase çağrılarını paralel çalıştır
      const [profileRowRes, planRowRes] = await Promise.all([
        supabaseService.supabaseClient
          .from('ai_profiles')
          .select('onboarding_completed, profile_data')
          .eq('user_id', userId)
          .maybeSingle(),
        supabaseService.supabaseClient
          .from('ai_treatment_plans')
          .select('plan_data')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      // Onboarding completion
      let completed = false;
      const profileRow = profileRowRes?.data as any;
      if (profileRow) {
        completed = !!profileRow.onboarding_completed;
        if (profileRow.profile_data) {
          setUserProfile(profileRow.profile_data);
          try { await AsyncStorage.setItem(`ai_user_profile_${userId}`, JSON.stringify(profileRow.profile_data)); } catch {}
        }
      }

      // Profile fallbacks (ai_* → legacy)
      if (!profileRow?.profile_data) {
        let loadedProfile: any | null = null;

        // 1) ai_* local
        try {
          const aiLocal = await AsyncStorage.getItem(`ai_user_profile_${userId}`);
          if (aiLocal) loadedProfile = JSON.parse(aiLocal);
        } catch {}

        // 2) legacy local
        if (!loadedProfile) {
          try {
            const legacy = await AsyncStorage.getItem(`user_profile_${userId}`);
            if (legacy) loadedProfile = JSON.parse(legacy);
          } catch {}
        }

        if (loadedProfile) {
          setUserProfile(loadedProfile);
          // normalize to ai_* keys
          try { await AsyncStorage.setItem(`ai_user_profile_${userId}`, JSON.stringify(loadedProfile)); } catch {}

          // background upsert (best-effort)
          try {
            const { supabaseService: svc } = await import('@/services/supabase');
            await svc.upsertAIProfile(userId, loadedProfile, completed);
          } catch {}
        }
      }

      // Onboarding flag fallbacks
      if (!completed) {
        const aiCompleted = await AsyncStorage.getItem(`ai_onboarding_completed_${userId}`);
        if (aiCompleted === 'true') completed = true;
        if (!completed) {
          const legacyCompleted = await AsyncStorage.getItem(`onboarding_completed_${userId}`);
          if (legacyCompleted === 'true') completed = true;
        }
      }
      setHasCompletedOnboarding(completed);

      // Treatment plan
      const planRow = planRowRes?.data as any;
      if (planRow?.plan_data) {
        setTreatmentPlan(planRow.plan_data);
        try { await AsyncStorage.setItem(`ai_treatment_plan_${userId}`, JSON.stringify(planRow.plan_data)); } catch {}
      } else {
        // ai_* local
        let localPlan: any | null = null;
        try {
          const aiPlan = await AsyncStorage.getItem(`ai_treatment_plan_${userId}`);
          if (aiPlan) localPlan = JSON.parse(aiPlan);
        } catch {}

        // legacy local
        if (!localPlan) {
          try {
            const legacyPlan = await AsyncStorage.getItem(`treatment_plan_${userId}`);
            if (legacyPlan) localPlan = JSON.parse(legacyPlan);
          } catch {}
        }

        if (localPlan) {
          setTreatmentPlan(localPlan);
          try { await AsyncStorage.setItem(`ai_treatment_plan_${userId}`, JSON.stringify(localPlan)); } catch {}
          // background upsert
          try {
            const { supabaseService: svc } = await import('@/services/supabase');
            await svc.upsertAITreatmentPlan(userId, localPlan, 'active');
          } catch {}
        }
      }

      // Load latest risk assessment
      const riskKey = `ai_risk_assessment_${userId}`;
      const riskData = await AsyncStorage.getItem(riskKey);
      if (riskData) {
        setCurrentRiskAssessment(JSON.parse(riskData));
      }

      // Telemetry: cross-device sync verification
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'ai_context_sync_check',
        profilePresent: !!(profileRow?.profile_data || userProfile),
        planPresent: !!(planRow?.plan_data || treatmentPlan),
        completed,
        source: 'supabase_pull',
      }, userId);

    } catch (error) {
      if (__DEV__) console.error('❌ Error loading user AI data:', error);
      // Telemetry: Hata raporla
      await trackAIError({
        code: 'storage_error' as any,
        message: 'Error loading user AI data',
        severity: 'medium' as any,
      }, {
        component: 'AIContext',
        method: 'loadUserAIData'
      });
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
        startTime: new Date(),
        currentStep: OnboardingStep.WELCOME,
        completedSteps: [],
        ybocsData: [],
        userProfile: {},
        sessionState: OnboardingSessionState.ACTIVE,
        culturalContext: {
          language: 'tr',
          country: 'TR',
          culturalBackground: ['turkish'],
          communicationStyle: {
            formality: 'warm',
            directness: 'gentle',
            supportStyle: 'encouraging',
            humorAcceptable: false,
            preferredPronoun: ''
          } as CommunicationStyle
        } as CulturalContext,
        progress: {
          totalSteps: 13,
          completedSteps: 0,
          estimatedTimeRemaining: 20
        }
      };
      
      setOnboardingSession(session);
      return session;
    } catch (error) {
      if (__DEV__) console.error('❌ Error starting onboarding:', error);
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
      if (__DEV__) console.error('❌ updateUserProfile: Invalid user ID:', userId);
      return;
    }

    try {
      const updatedProfile = { ...userProfile, ...profileUpdate };
      setUserProfile(updatedProfile);
      
      // Persist to storage with safe key
      const profileKey = `ai_user_profile_${userId}`;
      // Safe write with small retry/backoff
      {
        let attempts = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await AsyncStorage.setItem(profileKey, JSON.stringify(updatedProfile));
            break;
          } catch (e) {
            if (attempts >= 2) break;
            attempts++;
            await new Promise(r => setTimeout(r, 200 * attempts));
          }
        }
      }

      // Update via service if available
      if (FEATURE_FLAGS.isEnabled('AI_USER_PROFILING')) {
        await userProfilingService.updateProfile(userId, profileUpdate as any);
      }
    } catch (error) {
      if (__DEV__) console.error('❌ Error updating user profile:', error);
    }
  }, [user?.id, userProfile]);

  /**
   * 💡 Generate Insights (Offline-Aware)
   */
  // Simple cooldown to avoid rapid re-execution/rate-limit: 60s
  const lastInsightsRef = React.useRef<number>(0);
  const insightsInFlightRef = React.useRef<boolean>(false);
  const insightsQueueRef = React.useRef<Promise<any[]> | null>(null);

  const generateInsights = useCallback(async (): Promise<any[]> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      return [];
    }

    // Cooldown: skip if last call within 60s
    const now = Date.now();
    if (now - (lastInsightsRef.current || 0) < 60_000) {
      try {
        const cached = await AsyncStorage.getItem(`ai_cached_insights_${safeStorageKey(user.id)}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          try { await trackAIInteraction(AIEventType.INSIGHTS_CACHE_HIT, { userId: user.id, source: 'cooldown_cache' }, user.id); } catch {}
          return parsed.insights || [];
        }
      } catch {}
      try { await trackAIInteraction(AIEventType.INSIGHTS_CACHE_MISS, { userId: user.id, reason: 'cooldown_cache_empty' }, user.id); } catch {}
      return [];
    }

    // Offline fallback
    if (!isOnline) {
      if (__DEV__) console.warn('📱 Offline mode: Using cached insights');
      
      try {
        const cachedInsights = await AsyncStorage.getItem(`ai_cached_insights_${safeStorageKey(user.id)}`);
        if (cachedInsights) {
          const parsed = JSON.parse(cachedInsights);
          // Return cached insights if less than 24 hours old
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            try { await trackAIInteraction(AIEventType.INSIGHTS_CACHE_HIT, { userId: user.id, source: 'offline_cache' }, user.id); } catch {}
            return parsed.insights || [];
          }
        }
      } catch (error) {
        if (__DEV__) console.error('❌ Error loading cached insights:', error);
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

    if (insightsInFlightRef.current) {
      if (insightsQueueRef.current) {
        if (__DEV__) console.warn('⏳ Insights in progress – returning queued promise');
        return insightsQueueRef.current;
      }
      if (__DEV__) console.warn('⏳ Insights in progress – waiting for completion');
    }
    try {
      insightsInFlightRef.current = true;
      const queued = (async () => {
      // 24 saatlik zaman penceresi
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      // DB'den davranışsal veriler (paralel)
      let dbCompulsions: any[] = [];
      let dbErpSessions: any[] = [];
      try {
        const [compList, erpList] = await Promise.all([
          (async () => await (await import('@/services/supabase')).supabaseService.getCompulsions(user.id, startISO, endISO))(),
          (async () => await (await import('@/services/supabase')).supabaseService.getERPSessions(user.id, startISO, endISO))()
        ]);
        dbCompulsions = compList || [];
        dbErpSessions = erpList || [];
      } catch (e) {
        if (__DEV__) console.warn('⚠️ DB behavioral fetch failed, will use local fallbacks');
      }

      // Local fallbacks
      const today = new Date().toDateString();
      const compulsionsKey = `compulsions_${safeStorageKey(user.id)}`;
      const compulsionsRaw = await AsyncStorage.getItem(compulsionsKey);
      const allCompulsions = compulsionsRaw ? JSON.parse(compulsionsRaw) : [];
      const todayCompulsions = allCompulsions.filter((c: any) => new Date(c.timestamp).toDateString() === today);

      const erpKey = `erp_sessions_${safeStorageKey(user.id)}_${today}`;
      const erpRaw = await AsyncStorage.getItem(erpKey);
      const todayErpSessions = erpRaw ? JSON.parse(erpRaw) : [];

      const compulsions = dbCompulsions.length ? dbCompulsions : todayCompulsions;
      const erpSessions = dbErpSessions.length ? dbErpSessions : todayErpSessions;

      const behavioralData = {
        compulsions,
        moods: [],
        exercises: erpSessions,
        achievements: [],
        assessments: []
      };

      // Veri yeterlilik guard'ı
      const hasProfile = !!userProfile;
      const interactionsCount = (compulsions?.length || 0) + (erpSessions?.length || 0);
      if (!hasProfile || interactionsCount === 0) {
        try {
          await trackAIInteraction(AIEventType.INSIGHTS_DATA_INSUFFICIENT, {
            userId: user.id,
            hasProfile,
            interactionsCount
          }, user.id);
        } catch {}
        // Kullanıcıya sade uyarı içeriği döndür
        return [{
          id: 'data_insufficient_notice',
          type: 'system',
          content: 'Daha anlamlı içgörüler için bugün en az bir kayıt ekleyin (kompulsiyon veya ERP).',
          timestamp: new Date(),
          priority: 'low'
        }];
      }

      // Prefer enriched insights if method exists
      if (insightsCoordinator && typeof (insightsCoordinator as any).generateDailyInsightsWithData === "function") {
        const insights = await (insightsCoordinator as any).generateDailyInsightsWithData(
          user.id,
          userProfile as any,
          behavioralData,
          'standard'
        );
        
        // Cache successful insights
        if (insights && insights.length > 0) {
          try {
            // Safe cache write with 2 retries
            let attempts = 0;
            while (true) {
              try {
                await AsyncStorage.setItem(`ai_cached_insights_${safeStorageKey(user.id)}`, JSON.stringify({ insights, timestamp: Date.now() }));
                break;
              } catch (e) {
                if (attempts >= 2) break;
                attempts++;
                await new Promise(r => setTimeout(r, 150 * attempts));
              }
            }
            // Persist to Supabase (non-blocking)
            try {
              const { default: supabaseService } = await import('@/services/supabase');
              await supabaseService.supabaseClient
                .from('ai_insights')
                .insert({ user_id: user.id, insights });
            } catch (persistErr) {
              if (__DEV__) console.warn('Persist ai_insights failed:', persistErr);
            }
          } catch (cacheError) {
            if (__DEV__) console.warn('⚠️ Failed to cache insights:', cacheError);
          }
        }
        
        lastInsightsRef.current = Date.now();
        // Fallback to cached if none generated
        if (!insights || insights.length === 0) {
          try {
            const cached = await AsyncStorage.getItem(`ai_cached_insights_${safeStorageKey(user.id)}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              try { await trackAIInteraction(AIEventType.INSIGHTS_CACHE_HIT, { userId: user.id, source: 'post_generation_cache' }, user.id); } catch {}
              return parsed.insights || [];
            }
          } catch {}
        }
        return insights || [];
      } else {
        if (__DEV__) console.warn("⚠️ Insights Coordinator generateDailyInsights not available");
        // Try legacy path
        if (typeof insightsCoordinator.generateDailyInsights === 'function') {
          const insights = await insightsCoordinator.generateDailyInsights(user.id, userProfile as any);
          if (insights && insights.length > 0) {
            try {
              await AsyncStorage.setItem(`ai_cached_insights_${safeStorageKey(user.id)}`, JSON.stringify({ insights, timestamp: Date.now() }));
            } catch (cacheError) {
              if (__DEV__) console.warn('⚠️ Failed to cache insights:', cacheError);
            }
          }
          lastInsightsRef.current = Date.now();
          return insights || [];
        }
        return [];
      }
      })();
      insightsQueueRef.current = queued;
      const awaited = await queued;
      return awaited;
    } catch (error) {
      if (__DEV__) console.error('❌ Error generating insights:', error);
      return [];
    } finally {
      insightsInFlightRef.current = false;
      insightsQueueRef.current = null;
    }
  }, [user?.id, userProfile, treatmentPlan, isOnline]);

  /**
   * 🛡️ Assess Risk
   */
  // assessRisk removed

  /**
   * 🎯 Trigger Intervention
   */
  const triggerIntervention = useCallback(async (context: any): Promise<void> => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
      return;
    }

    try {
      await (adaptiveInterventions as any).triggerContextualIntervention({
        userId: user.id,
        userProfile: userProfile as any,
        currentContext: {
          analysisId: `ctx_${Date.now()}`,
          riskAssessment: { overallRisk: (currentRiskAssessment?.immediateRisk as any) || 'low', riskFactors: [], protectiveFactors: [], interventionUrgency: 'low' },
          userState: { stressLevel: 'medium', activityState: 'unknown', energyLevel: 50, socialEngagement: 50 },
          environmentalFactors: [],
          insights: { patterns: [] }
        },
        userConfig: (adaptiveInterventions as any).getDefaultConfig(),
        recentInterventions: [],
        recentUserActivity: { lastAppUsage: new Date(), sessionDuration: 0 },
        deviceState: { batteryLevel: 1, isCharging: false, networkConnected: true, inFocus: true }
      });
    } catch (error) {
      if (__DEV__) console.error('❌ Error triggering intervention:', error);
    }
  }, [user?.id, userProfile, currentRiskAssessment]);

  // Wrap non-memo callbacks if any were missed
  // (generateInsights and updateUserProfile are already memoized)

  /**
   * 🌐 Network Status Monitoring
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (__DEV__) console.log('🌐 Network state changed:', {
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

  // Bellek eşiği kontrolü (UI tarafı): 150MB üzeri → Safe Mode
  useEffect(() => {
    const perf: any = (globalThis as any).performance;
    if (!perf || !perf.memory) return;
    const threshold = 150 * 1024 * 1024;
    const timer = setInterval(() => {
      try {
        const used = perf.memory?.usedJSHeapSize as number | undefined;
        if (typeof used === 'number' && used > threshold) {
          if (!safeMode) {
            setSafeMode(true);
            setSafeModeReason('memory');
            try {
              trackAIInteraction(AIEventType.SYSTEM_STATUS, {
                event: 'memory_threshold_safe_mode',
                usedHeap: used
              });
            } catch {}
          }
        }
      } catch {}
    }, 60_000);
    return () => clearInterval(timer);
  }, [safeMode]);

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
      if (__DEV__) console.log('🔄 User signed out - resetting AI state');
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
    safeMode,
    safeModeReason,
    
    // Network Status
    isOnline,
    isConnected,
    networkType,
    // safeMode dışa vurulmuyor; ileride UI için eklenebilir
    
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
    triggerIntervention
  }), [
    isInitialized,
    isInitializing,
    initializationError,
    safeMode,
    safeModeReason,
    isOnline,
    isConnected,
    networkType,
    safeMode,
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
    triggerIntervention
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
  const { userProfile, treatmentPlan, hasCompletedOnboarding } = useAI();
  return { userProfile, treatmentPlan, hasCompletedOnboarding };
}

// For components that only need actions
export function useAIActions() {
  const { 
    initializeAIServices, 
    startOnboarding, 
    updateUserProfile, 
    generateInsights, 
    triggerIntervention 
  } = useAI();
  return { 
    initializeAIServices, 
    startOnboarding, 
    updateUserProfile, 
    generateInsights, 
    triggerIntervention 
  };
}