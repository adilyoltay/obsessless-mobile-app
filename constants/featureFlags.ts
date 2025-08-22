/**
 * 🛡️ ObsessLess Feature Flag System - FAZ 0: Güvenlik ve Stabilite Hazırlığı
 * 
 * Bu sistem "Kapsamlı Yol Haritası" belgesindeki Görev 0.0.1 gereksinimlerine uygun olarak
 * tasarlanmıştır. Tüm AI özellikleri tek bir master switch ile kontrol edilir.
 * 
 * KRİTİK: Bu dosyadaki değişiklikler prodüksiyonu etkileyebilir!
 */

import Constants from 'expo-constants';

// 🎯 MASTER AI SWITCH - Tek bir toggle ile tüm AI özellikleri kontrol edilir
const getAIMasterEnabled = () => {
  // Expo config ve process env üzerinden kontrol (prod dahil)
  const enableAI = (Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_AI === 'true') ||
                   (process.env.EXPO_PUBLIC_ENABLE_AI === 'true');
  return enableAI;
};

const AI_MASTER_ENABLED = getAIMasterEnabled();

// Geçici: Prompt logging toggle (varsayılan kapalı, env ile açılabilir)
const AI_PROMPT_LOGGING_ENV = (Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_PROMPT_LOGGING === 'true') ||
                              (process.env.EXPO_PUBLIC_AI_PROMPT_LOGGING === 'true');

// 💬 AI_CHAT için bağımsız override desteği
const resolveChatEnabled = (): boolean => {
  const chatEnv = (Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_AI_CHAT ?? process.env.EXPO_PUBLIC_ENABLE_AI_CHAT);
  if (typeof chatEnv === 'string') {
    return chatEnv === 'true';
  }
  // Varsayılan: master switch ile aynı
  return AI_MASTER_ENABLED;
};
const AI_CHAT_ENABLED = resolveChatEnabled();

// Debug logging (development only) ve telemetry
if (__DEV__) {
  console.log('🔧 Feature Flags Debug:', {
    __DEV__,
    expoConfigExtra: Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_AI,
    processEnv: process.env.EXPO_PUBLIC_ENABLE_AI,
    AI_MASTER_ENABLED
  });
}

// AI Master Switch durumunu telemetriye gönder
if (typeof window !== 'undefined') {
  // Browser/mobile environment
  setTimeout(() => {
    import('@/features/ai/telemetry/aiTelemetry').then(({ trackAIInteraction, AIEventType }) => {
      trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        aiMasterEnabled: AI_MASTER_ENABLED,
        environment: __DEV__ ? 'development' : 'production',
        enabledFeatureCount: Object.values(featureFlagState).filter(Boolean).length
      });
    }).catch(() => {
      // Telemetry yüklenemezse sessizce devam et
    });
  }, 1000);
}

// Feature flag değerlerini runtime'da değiştirmek için mutable obje
const featureFlagState: Record<string, boolean | number> = {
  // 🎯 MASTER AI SWITCH
  AI_ENABLED: AI_MASTER_ENABLED,
  // 🧩 AI RUNTIME MODULES: Onboarding’dan bağımsız ek analiz/telemetry modülleri
  AI_RUNTIME_MODULES: AI_MASTER_ENABLED,
  
  // 🤖 Tüm AI Features - Master switch'e bağlı
  AI_CHAT: AI_CHAT_ENABLED,
  AI_ONBOARDING: AI_MASTER_ENABLED,
  AI_INSIGHTS: AI_MASTER_ENABLED,
  AI_VOICE: AI_MASTER_ENABLED,
  AI_CBT_ENGINE: AI_MASTER_ENABLED,
  AI_EXTERNAL_API: AI_MASTER_ENABLED,
  AI_THERAPEUTIC_PROMPTS: AI_MASTER_ENABLED,
  AI_REAL_RESPONSES: AI_MASTER_ENABLED,
  AI_INSIGHTS_ENGINE_V2: AI_MASTER_ENABLED,
  AI_PATTERN_RECOGNITION_V2: AI_MASTER_ENABLED,
  AI_SMART_NOTIFICATIONS: AI_MASTER_ENABLED,
  // Removed deprecated flags
  AI_ADAPTIVE_INTERVENTIONS: AI_MASTER_ENABLED,
  AI_CONTEXT_INTELLIGENCE: AI_MASTER_ENABLED,
  AI_JITAI_SYSTEM: AI_MASTER_ENABLED,
  AI_ADVANCED_PERSONALIZATION: AI_MASTER_ENABLED,
  AI_MODEL_OPTIMIZATION: AI_MASTER_ENABLED,
  AI_PERFORMANCE_MONITORING: AI_MASTER_ENABLED,
  AI_ADVANCED_ANALYTICS: AI_MASTER_ENABLED,
  AI_DASHBOARD: AI_MASTER_ENABLED,
  // Onboarding Flow varsayılan olarak aktif; ayrı V2 flag kaldırıldı
  AI_YBOCS_ANALYSIS: AI_MASTER_ENABLED,
  AI_USER_PROFILING: AI_MASTER_ENABLED,
  AI_TREATMENT_PLANNING: AI_MASTER_ENABLED,
  AI_RISK_ASSESSMENT: AI_MASTER_ENABLED,
  AI_ONBOARDING_UI: AI_MASTER_ENABLED,
  AI_ONBOARDING_CONTEXT_INTEGRATION: AI_MASTER_ENABLED,
  AI_ONBOARDING_INTERVENTIONS_INTEGRATION: AI_MASTER_ENABLED,
  AI_ART_THERAPY: false, // TEMPORARILY DISABLED - geçici olarak kapatıldı

  AI_PREDICTIVE_INTERVENTION: AI_MASTER_ENABLED,
  // KALDIRILDI: AI_CRISIS_DETECTION
  
    // 🚀 CoreAnalysisService v1 flags
  AI_CORE_ANALYSIS: true, // Yeni CoreAnalysisService (ACTIVATED)
  AI_LLM_GATING: true, // LLM gating logic (ACTIVATED)
  AI_PROGRESSIVE: true, // Progressive UI updates (ACTIVATED)
  AI_ONBOARDING_REFINE: true, // Onboarding skeleton->refine (ACTIVATED)
  AI_THERAPY_STAIRCASE: true, // Deterministic therapy difficulty (ACTIVATED)
  
  // 🎯 Unified AI Pipeline flags (NEW - Jan 2025) - ACTIVATED
  AI_UNIFIED_PIPELINE: true, // Master toggle for unified pipeline (ACTIVATED)
  AI_UNIFIED_PIPELINE_PERCENTAGE: 100, // Full rollout for activation (100%)
  AI_UNIFIED_VOICE: true, // Voice module in pipeline
  AI_UNIFIED_PATTERNS: true, // Pattern recognition in pipeline
  AI_UNIFIED_INSIGHTS: true, // Insights generation in pipeline
  AI_UNIFIED_CBT: true, // CBT analysis in pipeline
  
  // 🌬️ Breathwork Suggestions (NEW - Week 2)
  AI_BREATHWORK_SUGGESTIONS: true, // AI-powered breathwork recommendations
  
  // 🎮 Dynamic Gamification (NEW - Week 2)
  AI_DYNAMIC_GAMIFICATION: true, // Context-based dynamic points calculation
  AI_DYNAMIC_MISSIONS: true, // AI-generated daily missions
  
  // 🗂️ Smart Routing & Prefilling (NEW - Week 2)
  AI_SMART_ROUTING: true, // Intelligent screen navigation with context
  AI_FORM_PREFILLING: true, // Automatic form prefilling from analysis
  
  // 🔀 LLM Flags (aliases → AI master)
  LLM_ROUTER: AI_MASTER_ENABLED,
  LLM_REFRAME: AI_MASTER_ENABLED,
  LLM_COACH_ADAPT: AI_MASTER_ENABLED,
  LLM_PDF_SUMMARY: AI_MASTER_ENABLED,
  
  // ⏰ JITAI granular flags
  JITAI_TIME: AI_MASTER_ENABLED,
  JITAI_GEOFENCE: false,
  
  // 📝 Prompt Logging (sanitized) – geçici debugging toggle
  AI_PROMPT_LOGGING: !!AI_PROMPT_LOGGING_ENV,
  
  // 🔧 Development Features
  DEBUG_MODE: __DEV__,
  MOCK_API_RESPONSES: __DEV__ && process.env.EXPO_PUBLIC_MOCK_API === 'true',
  
  // 📊 Telemetry Features
  AI_TELEMETRY: AI_MASTER_ENABLED, // Master switch ile kontrol edilir
  PERFORMANCE_MONITORING: true,
  ERROR_REPORTING: true,
  
  // 🚨 Safety Features (Always Enabled)
  SAFETY_CHECKS: true,
  CONTENT_FILTERING: true,
  RATE_LIMITING: true,
  
  // 🛡️ (Removed) ERP Module Feature Flag
  // ERP_MODULE_ENABLED: false, // Removed ERP module
};

// Feature flag logging için
const featureUsageLog: Record<string, number> = {};

export const FEATURE_FLAGS = {
  ...featureFlagState,
  
  /**
   * 🔍 Feature durumunu kontrol eder
   * Kullanım loglaması ve runtime kontrolleri içerir
   */
  isEnabled: (feature: keyof typeof featureFlagState): boolean => {
    // Kullanım sayacı
    featureUsageLog[feature] = (featureUsageLog[feature] || 0) + 1;
    
    // Geliştirme modunda log
    if (__DEV__) {
      console.log(`🏳️ Feature Flag Check: ${feature} = ${featureFlagState[feature]}`);
    }
    
    // Master AI switch kontrolü
    if (feature.startsWith('AI_') && feature !== 'AI_ENABLED' && !featureFlagState.AI_ENABLED) {
      return false;
    }
    
    // Additional runtime checks
    if (feature.startsWith('AI_') && !featureFlagState.SAFETY_CHECKS) {
      console.warn('⚠️ AI features disabled: Safety checks are off');
      return false;
    }
    
    // Remote kill switch capability (gelecekte API'den kontrol edilebilir)
    if (typeof (global as any).__OBSESSLESS_KILL_SWITCH !== 'undefined') {
      console.warn('🚨 Emergency kill switch activated');
      return false;
    }
    
    // Handle number values (like percentages) - treat as enabled if > 0
    const value = featureFlagState[feature];
    if (typeof value === 'number') {
      return value > 0;
    }
    
    return !!value;
  },
  
  /**
   * 🚨 Acil durum fonksiyonu - Tüm AI özelliklerini kapatır
   */
  disableAll: async (): Promise<void> => {
    console.warn('🚨 EMERGENCY: Disabling all AI features');
    
    Object.keys(featureFlagState).forEach(key => {
      if (key.startsWith('AI_')) {
        featureFlagState[key] = false;
      }
    });
    
    // Global kill switch aktive et
    (global as any).__OBSESSLESS_KILL_SWITCH = true;
    
    // Telemetry + persist
    try {
      const { trackAIInteraction, AIEventType } = await import('@/features/ai/telemetry/aiTelemetry');
      await trackAIInteraction(AIEventType.EMERGENCY_SHUTDOWN, {
        timestamp: new Date().toISOString(),
        reason: 'feature_flags_disabled',
        previousFlags: { ...featureFlagState }
      });
    } catch {}
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('emergency_shutdown_timestamp', new Date().toISOString());
    } catch {}
  },
  
  /**
   * 🔧 Runtime'da feature flag değiştirme (sadece development)
   * Master AI switch değiştirildiğinde tüm AI özellikleri etkilenir
   */
  setFlag: (feature: keyof typeof featureFlagState, value: boolean | number): void => {
    if (!__DEV__) {
      console.warn('⚠️ Feature flag changes only allowed in development');
      return;
    }
    
    console.log(`🔧 Changing feature flag: ${feature} = ${value}`);
    
    // Master AI switch değiştiriliyorsa tüm AI özelliklerini güncelle
    if (feature === 'AI_ENABLED') {
      Object.keys(featureFlagState).forEach(key => {
        if (key.startsWith('AI_')) {
          featureFlagState[key] = value;
        }
      });
    } else {
      featureFlagState[feature] = value;
    }
  },
  
  /**
   * 📊 Feature kullanım istatistikleri
   */
  getUsageStats: (): Record<string, number> => {
    return { ...featureUsageLog };
  },
  
  /**
   * 🔄 Tüm AI özelliklerini yeniden aktifleştir (development only)
   */
  reactivateAll: (): void => {
    if (!__DEV__) {
      console.warn('⚠️ Feature reactivation only allowed in development');
      return;
    }
    
    console.log('🔄 Reactivating all AI features');
    delete (global as any).__OBSESSLESS_KILL_SWITCH;
    
    // Master switch'i aktifleştir
    const masterEnabled = (Constants.expoConfig?.extra?.EXPO_PUBLIC_ENABLE_AI === 'true') ||
                          (process.env.EXPO_PUBLIC_ENABLE_AI === 'true');
    Object.keys(featureFlagState).forEach(key => {
      if (key.startsWith('AI_')) {
        featureFlagState[key] = masterEnabled;
      }
    });
  }
} as const;

// AI Configuration - Yol Haritası Uyumlu
export const AI_CONFIG = {
  // Default provider - environment'tan override edilebilir
  DEFAULT_PROVIDER: (() => {
    const raw = (Constants.expoConfig?.extra?.EXPO_PUBLIC_AI_PROVIDER as string) ||
                (process.env.EXPO_PUBLIC_AI_PROVIDER as string) ||
                'gemini';
    const lower = String(raw).toLowerCase();
    // Gemini-only: başka değer gelirse gemini'ye düş
    return (lower === 'gemini' ? 'gemini' : 'gemini') as 'gemini';
  })(),
  
  // Provider priorities (single provider)
  PROVIDER_PRIORITY: ['gemini'] as const,
  
  // Feature-specific AI requirements
  CHAT_REQUIRES_EXTERNAL_AI: true,
  INSIGHTS_USES_LOCAL_AI: true,
  VOICE_USES_HYBRID_AI: true,
  
  // Safety configurations
  MAX_TOKENS: 4000,
  TEMPERATURE_LIMIT: 0.8,
  SAFETY_THRESHOLD: 0.9,
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_REQUESTS_PER_HOUR: 1000,
} as const;
