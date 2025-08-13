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
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.adilyoltay.obslesstest',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Sesli check-in ve nefes egzersizleri için mikrofon erişimine ihtiyaç duyuyoruz. Erişim yalnızca sizin başlatmanızla kullanılır.',
      NSSpeechRecognitionUsageDescription:
        'Sesli check-in sırasında konuşmanızı cihaz üzerinde yazıya dönüştürmek için konuşma tanıma iznine ihtiyaç duyuyoruz. Veriler gizlilik odaklı işlenir.',
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
  plugins: ['expo-secure-store', 'expo-localization', 'expo-font', 'expo-router'],
  extra: {
    eas: {
      projectId: '1e0473f8-f317-4813-9b20-4dbe892e3153',
    },
    // Özellik bayrakları ve AI sağlayıcı
    EXPO_PUBLIC_ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI ?? 'true',
    EXPO_PUBLIC_ENABLE_AI_CHAT: process.env.EXPO_PUBLIC_ENABLE_AI_CHAT ?? 'false',
    EXPO_PUBLIC_AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER ?? 'gemini',
    EXPO_PUBLIC_ENABLE_AI_TELEMETRY: process.env.EXPO_PUBLIC_ENABLE_AI_TELEMETRY ?? 'true',
    EXPO_PUBLIC_AI_DEBUG_MODE: process.env.EXPO_PUBLIC_AI_DEBUG_MODE ?? 'false',
    EXPO_PUBLIC_AI_VERBOSE_LOGGING: process.env.EXPO_PUBLIC_AI_VERBOSE_LOGGING ?? 'false',

    // Hassas bilgiler sadece ortam değişkenlerinden
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    EXPO_PUBLIC_GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-1.5-flash',
    EXPO_PUBLIC_GOOGLE_STT_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY,
    EXPO_PUBLIC_ELEVENLABS_API_KEY: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
}

export default config


