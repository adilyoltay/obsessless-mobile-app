# Development Guide

ObsessLess mobil uygulamasını yerel ortamda geliştirmek için kapsamlı rehber.

## Sistem Gereksinimleri

### Temel Araçlar
- **Node.js**: 18+ (LTS önerilen)
- **Yarn**: Package manager (npm yerine tercih edilir)
- **Git**: Version control

### Mobile Development
- **Expo CLI**: `npm install -g @expo/cli`
- **EAS CLI**: `npm install -g eas-cli` (build ve deploy için)

### iOS Development (macOS)
- **Xcode**: App Store'dan en son sürüm
- **iOS Simulator**: Xcode ile birlikte gelir
- **CocoaPods**: `sudo gem install cocoapods`

### Android Development
- **Android Studio**: https://developer.android.com/studio
- **Android SDK**: API Level 31+ (Android 12+)
- **Android Emulator**: Android Studio AVD Manager
- **Java**: JDK 11 veya üzeri

### Backend Services
- **Supabase hesabı**: Database ve auth için
- **Supabase CLI**: `npm install -g supabase` (opsiyonel, migrations için)

## Environment Configuration

### Environment Variables

**.env dosyası** (proje kökünde):
```bash
# Supabase Configuration (Zorunlu)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Features (Opsiyonel)
EXPO_PUBLIC_ENABLE_AI=true
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key

# Development Settings (Opsiyonel)
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_DEV_MODE=true

# Testing Configuration (Opsiyonel)
TEST_MODE=false
TEST_TTL_MS=5000
TEST_LIVE_BACKEND=0
```

### Supabase Setup
```bash
# 1. Supabase projesini klonla (opsiyonel)
npx supabase init

# 2. Local development (opsiyonel)
npx supabase start

# 3. Remote bağlantı için .env dosyasını yapılandır
```

### Environment Validation
```typescript
// lib/env.ts
export const ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  ENABLE_AI: process.env.EXPO_PUBLIC_ENABLE_AI === 'true',
  DEV_MODE: process.env.EXPO_PUBLIC_DEV_MODE === 'true',
};

// Startup validation
const validateEnv = () => {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variables');
  }
};
```

## Development Commands

### Setup & Installation
```bash
# Proje bağımlılıklarını yükle
yarn install

# iOS dependencies (macOS only)
cd ios && pod install && cd ..

# TypeScript ve lint kontrolü
yarn typecheck
yarn lint
```

### Development Servers
```bash
# Expo development server
yarn start

# iOS simulator (macOS only)
yarn ios

# Android emulator/device
yarn android

# Web development (limited support)
yarn web
```

### Code Quality
```bash
# TypeScript type checking
yarn typecheck

# ESLint ve Prettier
yarn lint
yarn lint:fix

# Test execution
yarn test
yarn test:unit
yarn test:integration
yarn test:watch
```

### Build & Deploy
```bash
# EAS Build (production)
eas build --platform all

# Local builds (development)
eas build --platform all --local

# Submit to stores
eas submit --platform all
```

## Project Structure

### Core Architecture
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── forms/          # Form components
│   ├── layout/         # Layout components
│   └── navigation/     # Navigation components
├── features/           # Feature-based modules
│   ├── ai/            # AI processing pipeline
│   ├── onboarding/    # User onboarding
│   └── artTherapy/    # Art therapy features
├── services/          # Business logic services
├── hooks/             # Custom React hooks
├── store/             # Zustand stores
├── utils/             # Utility functions
└── types/             # TypeScript definitions
```

### Key Files & Responsibilities

#### AI Pipeline
- **`features/ai/core/UnifiedAIPipeline.ts`**: Merkezi AI işlem hattı
- **`features/ai/context/userProfileAdapter.ts`**: Kullanıcı bağlamı adaptörü
- **`features/ai/services/checkinService.ts`**: Ses analizi koordinasyonu

#### Data Layer
- **`services/supabase.ts`**: Supabase istemci ve CRUD operations
- **`services/offlineSync.ts`**: Offline queue ve senkronizasyon
- **`lib/queryClient.ts`**: TanStack Query yapılandırması

#### State Management
- **`store/moodOnboardingStore.ts`**: Onboarding state
- **`store/aiSettingsStore.ts`**: AI ayarları
- **`store/gamificationStore.ts`**: Gamification durumu

#### Navigation & Guards
- **`app/_layout.tsx`**: Root layout ve auth guards
- **`components/navigation/NavigationGuard.tsx`**: Onboarding zorlaması
- **`app/(tabs)/_layout.tsx`**: Tab navigation yapılandırması

#### Services
- **`services/encryption/secureDataService.ts`**: AES-GCM şifreleme (RN uyumlu: `react-native-quick-crypto` + `react-native-get-random-values`). Expo/Hermes ortamında Web Crypto bağımlılığı kaldırılmıştır. Fallback: `SHA256_FALLBACK` sadece non-secret telemetry hash için.
  - Kurulum: `yarn add react-native-quick-crypto react-native-get-random-values`
  - Test: `__tests__/unit/secureDataService.roundtrip.test.ts` büyük veri + Unicode round‑trip
- **`services/telemetry/performanceMetricsService.ts`**: Performance tracking
- **`services/autoRecordService.ts`**: Otomatik kayıt servisi

### Database Migrations
```
supabase/migrations/
├── 20250120_create_mood_entries_table.sql
├── 2025-08-10_add_ai_tables.sql
├── 2025-08-27_add_onboarding_profile_v2.sql
└── 2025-01-21_create_cbt_thought_records_table.sql
```

## Development Workflows

### Feature Development
1. **Branch Creation**: `git checkout -b feat/feature-name`
2. **Environment Setup**: Env variables kontrolü
3. **Development**: Local development server
4. **Testing**: Unit/integration tests
5. **Code Review**: PR oluşturma
6. **Deployment**: EAS build ve deploy

### Code Quality Standards
```bash
# Pre-commit hooks (husky)
yarn husky install

# TypeScript strict mode
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true

# ESLint configuration
extends: [
  "@expo/eslint-config-expo",
  "@typescript-eslint/recommended"
]
```

### Testing Strategy
```bash
# Unit tests (Jest)
yarn test:unit

# Integration tests
yarn test:integration

# Live backend tests
TEST_LIVE_BACKEND=1 yarn test:live

# E2E tests (Detox - future)
yarn test:e2e
```

## Debugging & Development Tools

### React Native Debugger
```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Enable debugging
yarn start
# Then press 'j' to open debugger
```

### Flipper Integration
```javascript
// App.tsx - Development only
if (__DEV__) {
  import('@flipper/react-native').then(flipper => {
    flipper.flipperStart();
  });
}
```

### Performance Monitoring
```typescript
// Development performance tracking
import { trackPerformance } from '@/services/telemetry/performanceMetricsService';

const trackScreenLoad = (screenName: string) => {
  if (__DEV__) {
    trackPerformance('SCREEN_LOAD', { screenName });
  }
};
```

## Common Development Issues

### iOS Specific
```bash
# Clean Xcode build
cd ios && xcodebuild clean && cd ..

# Reset CocoaPods
cd ios && rm -rf Pods && pod install && cd ..

# Clear Metro cache
yarn start --clear-cache
```

### Android Specific
```bash
# Clean Gradle
cd android && ./gradlew clean && cd ..

# Reset ADB
adb kill-server && adb start-server

# Clear React Native cache
npx react-native-clean-project
```

### Metro Bundler Issues
```bash
# Reset Metro cache
yarn start --reset-cache

# Clear watchman
watchman watch-del-all

# Clear node_modules
rm -rf node_modules && yarn install
```

## Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
npx expo export --dump-sourcemap
npx react-native-bundle-visualizer

# Tree shaking verification
yarn analyze
```

### Memory Profiling
```typescript
// Memory leak detection (development)
import { enableScreens } from 'react-native-screens';
enableScreens();

// Performance monitoring
import { enableBatching } from 'react-native-reanimated';
enableBatching();
```

## Deployment Preparation

### Pre-deployment Checklist
- [ ] Environment variables configured
- [ ] TypeScript errors resolved
- [ ] Lint warnings addressed
- [ ] Tests passing
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Migration scripts tested

### Build Configuration
```javascript
// app.config.js
export default {
  expo: {
    name: "ObsessLess",
    slug: "obsessless",
    version: "1.0.0",
    platforms: ["ios", "android"],
    
    // Build configurations
    ios: {
      bundleIdentifier: "com.obsessless.app",
      buildNumber: "1"
    },
    
    android: {
      package: "com.obsessless.app",
      versionCode: 1
    }
  }
};
```

## İlgili Bölümler

- [**Architecture**](./architecture.md) – System design overview
- [**Testing**](./testing.md) – Testing strategies and tools
- [**Release**](./release.md) – Deployment and release process
- [**Troubleshooting**](./troubleshooting.md) – Common issues and solutions
