// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

module.exports = {
  expo: {
    name: "obslessless-clean",
    slug: "obslessless-clean",
    version: "3.0.0",
    sdkVersion: "53.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#F9FAFB"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.adilyoltay.obslesstest",
      infoPlist: {
        NSMicrophoneUsageDescription: "Sesli check-in ve nefes egzersizleri için mikrofon erişimine ihtiyaç duyuyoruz. Erişim yalnızca sizin başlatmanızla kullanılır.",
        NSSpeechRecognitionUsageDescription: "Sesli check-in sırasında konuşmanızı cihaz üzerinde yazıya dönüştürmek için konuşma tanıma iznine ihtiyaç duyuyoruz. Veriler gizlilik odaklı işlenir."
      }
    },
    scheme: "obslesstest",
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.adilyoltay.obslesstest"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-secure-store",
      "expo-localization",
      "expo-font",
      "expo-router"
    ],
    extra: {
      eas: {
        projectId: "1e0473f8-f317-4813-9b20-4dbe892e3153"
      },
      // Pass environment variables to the app
      EXPO_PUBLIC_ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI || "true",
      EXPO_PUBLIC_ENABLE_AI_CHAT: process.env.EXPO_PUBLIC_ENABLE_AI_CHAT || "false",
      EXPO_PUBLIC_AI_PROVIDER: process.env.EXPO_PUBLIC_AI_PROVIDER || "gemini",
      // ⚠️ GEMINI_API_KEY REMOVED - Now managed securely via Supabase Edge Functions
      // EXPO_PUBLIC_GEMINI_API_KEY: REMOVED FOR SECURITY
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_ELEVENLABS_API_KEY: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
      EXPO_PUBLIC_AI_PROMPT_LOGGING: process.env.EXPO_PUBLIC_AI_PROMPT_LOGGING,
      EXPO_PUBLIC_MOCK_API: process.env.EXPO_PUBLIC_MOCK_API
    }
  }
};
