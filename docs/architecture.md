# Mimari Genel Bakış

ObsessLess mobil uygulaması, offline-first yaklaşımı benimseyen, katmanlı bir mimariyle inşa edilmiştir.

## Katmanlar

### UI Katmanı
- **React Native** (Expo SDK 51, RN 0.74+)
- **Navigasyon**: `expo-router` (dosya tabanlı)
- **Bileşenler**: Özel tasarım sistemi, `StyleSheet.create`
- **Erişilebilirlik**: `accessibilityLabel`, `accessibilityRole`

### State & Cache Katmanı
- **Global State**: Zustand stores (`store/`)
- **Async Cache**: TanStack Query (React Query)
- **Local Persistence**: AsyncStorage (sensitive data encrypted)

### Services Katmanı
- **Backend Integration**: `services/supabase.ts`
- **Offline Synchronization**: `services/offlineSync.ts`
- **Security**: `services/encryption/secureDataService.ts`
- **Telemetry**: `services/telemetry/`

### OfflineSync Katmanı
- **Queue Management**: AsyncStorage tabanlı FIFO queue
- **Retry Logic**: Exponential backoff + jitter
- **Dead Letter Queue**: Failed operation handling
- **Conflict Resolution**: Timestamp-based resolution

### UnifiedAIPipeline Katmanı
- **Single Entry Point**: `unifiedPipeline.process()`
- **Progressive UI**: Immediate heuristic + background LLM
- **Context Injection**: User profile adaptation
- **Telemetry Integration**: Comprehensive tracking
- **Helper Classes**: Confidence, PatternMatcher, Cache, Telemetry wrappers
- **Debug Tools**: MoodDataFlowTester for data flow validation

## Veri Akışı

### Temel Akış
1. **Authentication**: Supabase Auth
2. **Onboarding**: Local snapshot + Supabase UPSERT
3. **Offline Handling**: Queue operations when offline
4. **Synchronization**: Background sync when online
5. **AI Processing**: Context-aware analysis via UnifiedAIPipeline

### Online vs Offline Davranış
- **Online**: Doğrudan Supabase operations
- **Offline**: Queue'ya ekleme → background sync
- **Hybrid**: Progressive enhancement pattern

## Önemli Dosyalar ve Rolleri

### Core Services
- **`services/supabase.ts`**: Auth, CRUD operations, `upsertUserProfile()`
- **`services/offlineSync.ts`**: Queue management, sync processing, DLQ
- **`lib/queryClient.ts`**: TanStack Query configuration

### AI Pipeline
- **`features/ai/core/UnifiedAIPipeline.ts`**: Main AI processing entry
- **`features/ai/context/userProfileAdapter.ts`**: Context loading hierarchy
- **`features/ai/services/checkinService.ts`**: Voice analysis coordination

### Navigation & Guards
- **`components/navigation/NavigationGuard.tsx`**: Onboarding flow enforcement
- **`app/_layout.tsx`**: Root layout with auth guards

### Data Models
- **`types/`**: TypeScript type definitions
- **`constants/canonicalCategories.ts`**: Category mappings

## Mimari Diyagram

```mermaid
flowchart TB
    A[User Login] --> B{Onboarding Completed?}
    B -->|No| C[Onboarding v2 Flow]
    B -->|Yes| D[Main App]
    
    C --> E[Local Snapshot<br/>profile_v2]
    E --> F{Network Available?}
    F -->|Yes| G[Supabase UPSERT<br/>user_profiles]
    F -->|No| H[OfflineSync Queue<br/>entity: user_profile]
    
    G --> I[Cache Invalidation]
    H -->|Network Restored| G
    
    D --> J[User Interactions]
    J --> K[UnifiedAIPipeline<br/>process()]
    K --> L[Context Loading<br/>userProfileAdapter]
    L --> M[Progressive UI Response]
    
    I --> N[Background Sync]
    N --> O[Telemetry Events]
    M --> O
```

## Güvenlik ve Privacy

- **End-to-End Encryption**: AES-GCM şifreleme
- **Row Level Security**: Supabase RLS policies
- **PII Sanitization**: Server-bound data sanitization
- **Local Data Protection**: Secure AsyncStorage keys

## İlgili Bölümler

- [**Onboarding v2**](./onboarding-v2.md) – Detaylı onboarding akışı
- [**Offline Sync**](./sync.md) – Queue mekanizmaları
- [**AI Pipeline**](./ai-pipeline.md) – AI işlem hattı
- [**Data Model**](./data-model.md) – Supabase schema
- [**Security & Privacy**](./security-privacy.md) – Güvenlik politikaları
