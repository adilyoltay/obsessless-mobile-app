import type { ExpoConfig } from 'expo/config'

// Opsiyonel: .env.local yüklemeye çalış (yoksa sessizce geç)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: '.env.local' })
} catch {}

const config: ExpoConfig = {
  name: 'obslessless-clean',
  slug: 'obslessless-clean',
  version: '3.0.0',
  sdkVersion: '53.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F9FAFB',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.adilyoltay.obslesstest',
    infoPlist: {
      // Allow local dev server asset loading (HTTP) for TFLite during development
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsArbitraryLoadsInWebContent: true,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          // Allow Metro/IP-based dev servers (adjust if your IP changes)
          'localhost': {
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true,
          },
          '127.0.0.1': {
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true,
          },
          // Example LAN IP used by Expo/Metro; safe for development only
          '10.0.0.25': {
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true,
          },
        },
      },
      NSMicrophoneUsageDescription:
        'Sesli check-in ve nefes egzersizleri için mikrofon erişimine ihtiyaç duyuyoruz. Erişim yalnızca sizin başlatmanızla kullanılır.',
      NSSpeechRecognitionUsageDescription:
        'Sesli check-in sırasında konuşmanızı cihaz üzerinde yazıya dönüştürmek için konuşma tanıma iznine ihtiyaç duyuyoruz. Veriler gizlilik odaklı işlenir.',
      NSHealthShareUsageDescription:
        'Apple Health verilerinizi (HR/HRV, adım, uyku vb.) yalnızca cihaz içinde işleyerek ruh hali ve stres tahmini yapmak için okuruz. Veriler cihaz dışına gönderilmez.',
      NSHealthUpdateUsageDescription:
        'Apple Health verilerini güncelleme izni, gerekli olduğu durumlarda sağlık verilerinizi senkronize etmek için istenir.',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: {
          localhost: {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: 'TLSv1.0',
          },
          '127.0.0.1': {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: 'TLSv1.0',
          },
          '192.168.1.56': {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: 'TLSv1.0',
          },
        },
      },
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
    },
  },
  scheme: 'obslesstest',
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.adilyoltay.obslesstest',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  // Ensure assets like .tflite are bundled in release builds
  assetBundlePatterns: ['**/*'],
  plugins: [
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    'expo-router',
    // HealthKit entitlements & ayarlar - geçici olarak devre dışı
    // '@kingstinct/react-native-healthkit',
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.1',
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '1e0473f8-f317-4813-9b20-4dbe892e3153',
    },
    // 🚫 AI DISABLED: All AI features off by default
    EXPO_PUBLIC_ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI ?? 'false', // ← Changed from 'true'
    EXPO_PUBLIC_ENABLE_AI_CHAT: process.env.EXPO_PUBLIC_ENABLE_AI_CHAT ?? 'false',
    EXPO_PUBLIC_AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER ?? 'gemini',
    EXPO_PUBLIC_ENABLE_AI_TELEMETRY: process.env.EXPO_PUBLIC_ENABLE_AI_TELEMETRY ?? 'false', // ← Changed from 'true'
    EXPO_PUBLIC_AI_DEBUG_MODE: process.env.EXPO_PUBLIC_AI_DEBUG_MODE ?? 'false',
    EXPO_PUBLIC_AI_VERBOSE_LOGGING: process.env.EXPO_PUBLIC_AI_VERBOSE_LOGGING ?? 'false',

    // CoreAnalysisService v1 configurations
    EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_HEURISTIC_MOOD: process.env.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_HEURISTIC_MOOD ?? '0.65',
    EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_LOW: process.env.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_LOW ?? '0.60',
    EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_COMPLEX: process.env.EXPO_PUBLIC_AI_CONFIDENCE_THRESHOLD_LLM_COMPLEX ?? '0.80',
    EXPO_PUBLIC_AI_TEXT_LENGTH_THRESHOLD: process.env.EXPO_PUBLIC_AI_TEXT_LENGTH_THRESHOLD ?? '280',
    EXPO_PUBLIC_AI_LLM_RATE_LIMIT_PER_10MIN: process.env.EXPO_PUBLIC_AI_LLM_RATE_LIMIT_PER_10MIN ?? '3',
    EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT: process.env.EXPO_PUBLIC_AI_LLM_DAILY_TOKEN_SOFT_LIMIT ?? '20000',
    EXPO_PUBLIC_CACHE_TTL_INSIGHTS_HOURS: process.env.EXPO_PUBLIC_CACHE_TTL_INSIGHTS_HOURS ?? '24',
    EXPO_PUBLIC_CACHE_TTL_ERP_PLAN_HOURS: process.env.EXPO_PUBLIC_CACHE_TTL_ERP_PLAN_HOURS ?? '12',
    EXPO_PUBLIC_CACHE_TTL_VOICE_HOURS: process.env.EXPO_PUBLIC_CACHE_TTL_VOICE_HOURS ?? '1',
    EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS: process.env.EXPO_PUBLIC_CACHE_TTL_TODAY_DIGEST_HOURS ?? '12',
    EXPO_PUBLIC_BATCH_SCHEDULE_LOCAL: process.env.EXPO_PUBLIC_BATCH_SCHEDULE_LOCAL ?? '03:05',
    EXPO_PUBLIC_ERP_DIFFICULTY_FLOOR: process.env.EXPO_PUBLIC_ERP_DIFFICULTY_FLOOR ?? '1',
    EXPO_PUBLIC_ERP_DIFFICULTY_CEILING: process.env.EXPO_PUBLIC_ERP_DIFFICULTY_CEILING ?? '10',
    EXPO_PUBLIC_ERP_DIFFICULTY_MAX_DELTA: process.env.EXPO_PUBLIC_ERP_DIFFICULTY_MAX_DELTA ?? '1',
    EXPO_PUBLIC_ERP_DROP_PROMOTION_THRESHOLD: process.env.EXPO_PUBLIC_ERP_DROP_PROMOTION_THRESHOLD ?? '0.30',
    EXPO_PUBLIC_ERP_REBOUND_DEMOTION_THRESHOLD: process.env.EXPO_PUBLIC_ERP_REBOUND_DEMOTION_THRESHOLD ?? '0.20',

    // Hassas bilgiler sadece ortam değişkenlerinden
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    // ⚠️ GEMINI_API_KEY artık Supabase Edge Functions'da güvenli şekilde saklanıyor
    // EXPO_PUBLIC_GEMINI_API_KEY: REMOVED - API key'ler server-side Edge Functions'ta
    EXPO_PUBLIC_GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-1.5-flash',
    EXPO_PUBLIC_GOOGLE_STT_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY,
    EXPO_PUBLIC_ELEVENLABS_API_KEY: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,

    // Big Mood model bridge + selection
    BIG_MOOD_BRIDGE: process.env.BIG_MOOD_BRIDGE, // 'cloud' | 'placeholder' (legacy values map to cloud internally)
    BIG_MOOD_MODEL: process.env.BIG_MOOD_MODEL,   // e.g., 'pat-conv-l'

    // Cloud inference service
    EXPO_PUBLIC_AI_INFERENCE_URL: process.env.EXPO_PUBLIC_AI_INFERENCE_URL || process.env.AI_INFERENCE_URL,
    EXPO_PUBLIC_AI_INFERENCE_KEY: process.env.EXPO_PUBLIC_AI_INFERENCE_KEY || process.env.AI_INFERENCE_KEY,
    EXPO_PUBLIC_AI_INFERENCE_TIMEOUT_MS: process.env.EXPO_PUBLIC_AI_INFERENCE_TIMEOUT_MS || process.env.AI_INFERENCE_TIMEOUT_MS || '8000',
  },
}

export default config
