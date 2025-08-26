# Testing Strategy & QA

ObsessLess uygulaması için kapsamlı test stratejisi ve kalite güvence süreçleri.

## Test Hierarchy

### 1. Static Analysis (Statik Analiz)
En hızlı geri bildirim sağlayan otomatik kontroller.

```bash
# TypeScript type checking
yarn typecheck
yarn typecheck --watch

# Code quality (ESLint + Prettier)
yarn lint
yarn lint:fix
yarn lint --max-warnings=0
```

### 2. Unit Tests
İzole bileşen ve fonksiyon testleri.

#### Core Services Testing
- **Supabase Service**: `upsertUserProfile()` enum normalizasyonu
- **User Profile Adapter**: Local→remote fallback hierarchy
- **Offline Sync**: UUID validation, DLQ handling
- **AI Pipeline**: Context enhancement, telemetry

#### Test Examples
```typescript
// services/supabase.ts mapping tests
describe('upsertUserProfile', () => {
  it('normalizes enum values correctly', async () => {
    const mockPayload = {
      lifestyle_exercise: 'HEAVY', // Invalid
      lifestyle_social: 'VERY_LOW' // Invalid
    };

    const result = await supabaseService.upsertUserProfile(userId, mockPayload);
    
    expect(result.lifestyle_exercise).toBe('intense');
    expect(result.lifestyle_social).toBe('low');
  });
});

// AI context adapter tests  
describe('loadUserProfileContext', () => {
  it('follows priority hierarchy: local → legacy → remote', async () => {
    await AsyncStorage.setItem('profile_v2', JSON.stringify({ motivations: ['test'] }));
    
    const context = await loadUserProfileContext(userId);
    
    expect(context.motivations).toEqual(['test']);
    expect(supabaseService.getUserProfile).not.toHaveBeenCalled();
  });
});
```

### 3. Integration Tests
Bileşenler arası etkileşim testleri.

#### Onboarding Flow Integration
- Local snapshot creation
- Sync queue management
- Cache invalidation
- Telemetry event generation

#### AI Pipeline Integration
- Context loading with profile data
- Metadata enhancement verification
- Progressive UI response validation

### 4. Smoke Tests
Critical path end-to-end testing.

#### Online Onboarding Smoke Test
```typescript
it('completes onboarding and context is available immediately', async () => {
  // Network available
  mockNetworkState({ isConnected: true });
  
  // Complete onboarding
  const payload = createValidOnboardingPayload();
  await completeOnboardingFlow(userId, payload);
  
  // Verify immediate UPSERT
  expect(supabaseService.upsertUserProfile).toHaveBeenCalledWith(userId, payload);
  
  // Simulate app restart
  await simulateAppRestart();
  
  // Verify context loading
  const context = await loadUserProfileContext(userId);
  expect(context.motivations).toEqual(payload.motivations);
});
```

#### Offline→Online Sync Smoke Test
```typescript
it('queues onboarding offline and syncs when online', async () => {
  // Start offline
  mockNetworkState({ isConnected: false });
  
  // Complete onboarding offline
  await completeOnboardingFlow(userId, payload);
  
  // Verify queue creation
  const queueItems = await offlineSyncService.getQueueItems();
  expect(queueItems).toHaveLength(1);
  expect(queueItems[0].entity).toBe('user_profile');
  
  // Go online and process
  mockNetworkState({ isConnected: true });
  await offlineSyncService.processSyncQueue();
  
  // Verify sync completion
  expect(supabaseService.upsertUserProfile).toHaveBeenCalledWith(userId, payload);
  
  // Verify cache invalidation
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['user_profile', userId]);
});
```

#### AI Pipeline Smoke Test
```typescript
it('processes voice with progressive UI and metadata enhancement', async () => {
  // Setup user context
  await setupCompleteUserProfile(userId);
  
  const result = await unifiedPipeline.process({
    userId,
    content: "Bugün çok gerginim, nefes alamıyorum",
    type: 'voice',
    context: { source: 'today' }
  });
  
  // Verify immediate heuristic response
  expect(result.voice).toBeDefined();
  expect(result.voice?.category).toMatch(/MOOD|BREATHWORK/);
  
  // Verify metadata enhancement
  expect(result.metadata).toHaveProperty('reminderBoost');
  expect(result.metadata).toHaveProperty('motivationTags');
});
```

### 5. Live Backend Tests (CI Only)
Real Supabase integration tests.

```bash
# Enable live testing
TEST_LIVE_BACKEND=1 yarn test:live
```

```typescript
// __tests__/live/OnboardingLive.spec.ts
describe('Live Onboarding Tests', () => {
  it('actually saves to Supabase and retrieves correctly', async () => {
    if (process.env.TEST_LIVE_BACKEND !== '1') {
      test.skip('Live backend tests disabled');
    }
    
    const testUserId = createTestUser();
    const payload = createValidOnboardingPayload();
    
    // Real Supabase call
    await supabaseService.upsertUserProfile(testUserId, payload);
    
    // Verify actual database state
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    
    expect(data).toMatchObject({
      motivations: payload.motivations,
      onboarding_version: 2
    });
    
    // Cleanup
    await cleanupTestUser(testUserId);
  });
});
```

## Test Infrastructure

### Commands
```bash
# Development
yarn test
yarn test:unit
yarn test:integration
yarn test:smoke
yarn test:watch
yarn test:coverage

# CI/CD
yarn test:ci
TEST_LIVE_BACKEND=1 yarn test:live
```

### Configuration
```javascript
// jest.config.js
module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: [
    '**/__tests__/**/*.test.ts',           // Unit
    '**/__tests__/**/*.integration.test.ts', // Integration
    '**/__tests__/**/*.smoke.test.ts'      // Smoke
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Telemetry Validation
Critical telemetry events that must be tested:
- `ONBOARDING_COMPLETED` with correct metadata
- `UNIFIED_PIPELINE_STARTED` / `_COMPLETED` / `_ERROR`
- Sync events: `SYNC_QUEUE_ITEM_ADDED`, `SYNC_BATCH_COMPLETED`
- Cache events: `CACHE_HIT`, `CACHE_MISS`

## Quality Gates

### Pre-commit Requirements
- [ ] TypeScript compilation passes
- [ ] ESLint warnings = 0
- [ ] Unit tests pass
- [ ] Coverage threshold met (80%)

### Pre-deployment Requirements
- [ ] All test categories pass
- [ ] Integration tests validate critical paths
- [ ] Smoke tests confirm end-to-end workflows
- [ ] Performance benchmarks met

### Production Gates
- [ ] Live backend tests pass
- [ ] Security scans complete
- [ ] Load testing completed
- [ ] Rollback plan validated

## İlgili Bölümler

- [**Development**](./development.md) – Development setup and tools
- [**Architecture**](./architecture.md) – System design for testability
- [**Release**](./release.md) – Deployment pipeline integration
- [**Troubleshooting**](./troubleshooting.md) – Test debugging and common issues