# Onboarding v2 – Kapsamlı Kullanıcı Profili Yönetimi

Onboarding v2, kullanıcı profilini yerel snapshot'tan başlayarak Supabase'e güvenli şekilde aktaran, offline-first bir yaklaşım benimser.

## Veri Modeli

### Payload Yapısı
```typescript
interface OnboardingV2Payload {
  profile: {
    age?: number;
    gender?: 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';
    locale?: string;
    timezone?: string;
  };
  motivations: string[];
  first_mood: {
    score?: number;
    tags?: string[];
  };
  lifestyle: {
    sleep_hours?: number;
    exercise?: 'none' | 'light' | 'moderate' | 'intense';
    social?: 'low' | 'medium' | 'high';
  };
  reminders: {
    enabled: boolean;
    time?: string;
    days?: string[];
    timezone?: string;
  };
  feature_flags: Record<string, any>;
  consent: {
    accepted: boolean;
  };
  meta: {
    version: 2;
  };
}
```

### Supabase Mapping (`user_profiles` tablosu)

**Kişisel Bilgiler:**
- `age`, `gender`, `locale`, `timezone`

**Onboarding Verileri:**
- `motivations[]`, `first_mood_score`, `first_mood_tags[]`

**Yaşam Tarzı:**
- `lifestyle_sleep_hours`, `lifestyle_exercise`, `lifestyle_social`

**Hatırlatıcılar:**
- `reminder_enabled`, `reminder_time`, `reminder_days[]`

**Sistem Alanları:**
- `feature_flags` (jsonb), `consent_accepted`, `consent_at`
- `onboarding_version=2`, `onboarding_completed_at`
- `updated_at` (sunucu tarafından set edilir)

### Validation Rules

**Gender Enum:**
```sql
gender IN ('female','male','non_binary','prefer_not_to_say')
```

**Lifestyle Exercise:**
```sql
lifestyle_exercise IN ('none','light','moderate','intense')
```

**Lifestyle Social:**
```sql
lifestyle_social IN ('low','medium','high')
```

**Timezone Priority:**
`profile.timezone` → `reminders.timezone` fallback logic

## Akış Adımları

### 1. Local Persistence
```typescript
// AsyncStorage keys
const PROFILE_V2_KEY = 'profile_v2';
const GENERIC_COMPLETION_KEY = 'ai_onboarding_completed';
const USER_SPECIFIC_KEY = `ai_onboarding_completed_${userId}`;
```

- **Snapshot**: Tüm payload `profile_v2` anahtarında saklanır
- **Completion Flags**: Generic + user-specific completion tracking

### 2. Reminders Planning
- Notification permissions requested
- **Silent fallback**: Permission denied durumunda akış kesintiye uğramaz
- Settings preserved for future permission grants

### 3. Supabase UPSERT
```typescript
// services/supabase.ts
async function upsertUserProfile(
  userId: string, 
  payload: OnboardingV2Payload
): Promise<void> {
  // Enum normalization
  // Timezone resolution
  // PII sanitization
  // UPSERT operation
}
```

**Key Features:**
- Automatic enum normalization
- PII sanitization before transmission
- Timezone conflict resolution
- No `created_at` override (server-managed)

### 4. Offline Fallback
```typescript
import { offlineSyncService } from '@/services/offlineSync';

await offlineSyncService.addToSyncQueue({
  entity: 'user_profile',
  type: 'UPDATE',
  data: { user_id: userId, payload }
});
```

### 5. Telemetry Tracking
```typescript
// Event: ONBOARDING_COMPLETED
const telemetryData = {
  duration: completionTime - startTime,
  motivations: payload.motivations,
  hasReminder: payload.reminders.enabled,
  timezone: resolvedTimezone
};
```

## Döngü Önleme Mekanizması

### NavigationGuard Logic
```typescript
// components/navigation/NavigationGuard.tsx
const guardLogic = async (userId: string) => {
  // 1. Check user-specific completion
  const userCompleted = await AsyncStorage.getItem(`ai_onboarding_completed_${userId}`);
  
  if (!userCompleted) {
    // 2. Check generic flag and migrate
    const genericFlag = await AsyncStorage.getItem('ai_onboarding_completed');
    
    if (genericFlag) {
      // Migrate to user-specific
      await AsyncStorage.setItem(`ai_onboarding_completed_${userId}`, 'true');
      await AsyncStorage.removeItem('ai_onboarding_completed');
    } else {
      // Force onboarding flow
      router.replace('/onboarding');
    }
  }
};
```

### Loop Prevention Features:
- **User-specific keys**: Prevents cross-user completion states
- **Migration logic**: Gracefully handles legacy generic flags
- **Forced routing**: Ensures incomplete onboarding cannot be bypassed

## AI Bağlam Enjeksiyonu

### Context Loading Hierarchy
```typescript
// features/ai/context/userProfileAdapter.ts
const loadUserProfileContext = async (userId: string) => {
  // Priority 1: Local snapshot
  const localProfile = await AsyncStorage.getItem('profile_v2');
  
  if (localProfile) return JSON.parse(localProfile);
  
  // Priority 2: Legacy fallback
  const legacyProfile = await AsyncStorage.getItem('onb_v1_payload');
  
  if (legacyProfile) return migrateLegacyProfile(JSON.parse(legacyProfile));
  
  // Priority 3: Remote fetch
  return await fetchUserProfileFromSupabase(userId);
};
```

### Non-Breaking Metadata Enhancement
```typescript
// features/ai/core/UnifiedAIPipeline.ts
const enhanceWithContext = (baseInput: any, context: any) => ({
  ...baseInput,
  metadata: {
    ...baseInput.metadata,
    // Non-breaking enhancements
    reminderBoost: context.reminders?.enabled ? 1.2 : 1.0,
    sleepContext: context.lifestyle?.sleep_hours,
    motivationTags: context.motivations
  }
});
```

## Error Handling & Recovery

### Common Issues & Solutions

**UUID Validation Error:**
```typescript
// services/offlineSync.ts - resolveValidUserId
const resolveValidUserId = (data: any) => {
  const userId = data.user_id || data.userId;
  
  if (!userId || userId === 'anon' || !isValidUUID(userId)) {
    throw new Error('Invalid user ID for sync operation');
  }
  
  return userId;
};
```

**Enum Constraint Violations:**
```typescript
// Automatic sanitization in upsertUserProfile
const sanitizeEnums = (payload: any) => ({
  ...payload,
  lifestyle_exercise: validateEnum(
    payload.lifestyle_exercise, 
    ['none', 'light', 'moderate', 'intense'],
    'none'
  )
});
```

## Testing Scenarios

### Unit Tests
- Payload validation and sanitization
- Enum normalization logic
- Context loading hierarchy
- Migration logic (generic → user-specific)

### Integration Tests
- End-to-end onboarding flow
- Offline → Online sync verification
- AI context injection validation
- Telemetry event generation

### Smoke Tests
- Complete onboarding with various data combinations
- Network interruption during sync
- Permission denied scenarios
- Cross-user isolation verification

## İlgili Bölümler

- [**Data Model**](./data-model.md) – Supabase schema details
- [**Offline Sync**](./sync.md) – Queue mechanisms and retry logic
- [**AI Pipeline**](./ai-pipeline.md) – Context injection and processing
- [**Architecture**](./architecture.md) – Overall system design
- [**Troubleshooting**](./troubleshooting.md) – Common issues and solutions
