# Offline Sync – Güvenilir Veri Senkronizasyonu

ObsessLess uygulaması, offline-first yaklaşımla kritik verilerin kaybını önler ve bağlantı geri döndüğünde güvenli şekilde senkronize eder.

## Temel Kavramlar

### Offline-First Yaklaşım
1. **Write-Local First**: Tüm değişiklikler önce local'e yazılır
2. **Background Sync**: Ağ bağlantısı olduğunda arkaplan senkronizasyonu
3. **Conflict Resolution**: Timestamp tabanlı çakışma çözümü
4. **Graceful Degradation**: Ağ yokken de tam işlevsellik

### Core Service
**File**: `services/offlineSync.ts`

Ana işlevler:
- Queue management (ekleme, işleme, temizleme)
- Retry logic with exponential backoff
- Dead Letter Queue (DLQ) handling
- Cache invalidation coordination

Ek notlar:
- DLQ: `services/sync/deadLetterQueue.ts` içinde `SUPPORTED_ENTITIES` listesi `user_profile` dahil olacak şekilde tutulur.
- Concurrency: Küçük eşzamanlılık (2) uygulanır ve aynı kullanıcıya ait item’larda sıralama korunur (aynı kullanıcı için aynı anda sadece bir iş yürütülür).
- Invalidation: Sadece başarıyla senkronize edilen entity’ler `emitSyncCompleted([...entities], userId)` ile yayınlanır.

## Queue Yapısı

### SyncQueueItem Interface
```typescript
interface SyncQueueItem {
  id: string; // Unique queue item identifier
  type: 'CREATE' | 'UPDATE' | 'DELETE'; // Operation type
  entity: SupportedEntity; // Target entity type
  data: any; // Operation payload
  timestamp: number; // Creation timestamp
  retryCount: number; // Current retry attempt
  deviceId?: string; // Device identifier
  lastModified?: number; // Last modification time
  priority?: 'high' | 'normal' | 'low'; // Processing priority
}
```

### Supported Entities
```typescript
type SupportedEntity = 
  | 'user_profile'
  | 'mood_entry' 
  | 'voice_checkin'
  | 'ai_profile'
  | 'treatment_plan'
  | 'achievement';

const SUPPORTED_ENTITIES: SupportedEntity[] = [
  'user_profile',
  'mood_entry',
  'voice_checkin',
  'ai_profile',
  'treatment_plan',
  'achievement'
];
```

### Entity Validation Guard
```typescript
// services/offlineSync.ts
const validateEntity = (entity: string): entity is SupportedEntity => {
  if (!SUPPORTED_ENTITIES.includes(entity as SupportedEntity)) {
    console.warn(`Unsupported entity type: ${entity}`);
    
    // Telemetry for monitoring
    trackSyncEvent('UNSUPPORTED_ENTITY_DROPPED', { entity });
    
    return false;
  }
  return true;
};
```

## User ID Validation

### resolveValidUserId Function
```typescript
// Critical UUID validation to prevent 'anon' errors
const resolveValidUserId = (data: any): string => {
  const userId = data.user_id || data.userId;
  
  // Validate UUID format
  if (!userId || typeof userId !== 'string') {
    throw new Error('Missing user ID in sync data');
  }
  
  // Prevent common invalid values
  const invalidValues = ['anon', 'anonymous', 'null', 'undefined', ''];
  if (invalidValues.includes(userId.toLowerCase())) {
    throw new Error(`Invalid user ID: ${userId}`);
  }
  
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error(`Invalid UUID format: ${userId}`);
  }
  
  return userId;
};
```

### Common UUID Issues Prevention
```typescript
// Before adding to queue
const sanitizeDataForSync = (data: any): any => {
  try {
    const validUserId = resolveValidUserId(data);
    
    return {
      ...data,
      user_id: validUserId,
      // Remove potentially problematic fields
      userId: undefined, // Normalize to user_id
      auth: undefined,   // Remove auth tokens
      session: undefined // Remove session data
    };
  } catch (error) {
    console.error('Data sanitization failed:', error);
    throw error;
  }
};
```

## Retry Logic & Backoff

### Exponential Backoff Strategy
```typescript
const calculateBackoffDelay = (retryCount: number): number => {
  // Base delay: 1 second, max: 5 minutes
  const baseDelay = 1000;
  const maxDelay = 5 * 60 * 1000;
  
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s...
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  
  // Add jitter (±25% randomness)
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
  
  // Apply limits
  const finalDelay = Math.min(exponentialDelay + jitter, maxDelay);
  
  return Math.max(finalDelay, baseDelay);
};
```

### Retry Configuration
```typescript
const RETRY_CONFIG = {
  MAX_RETRIES: 8,           // After 8 attempts → DLQ
  MAX_QUEUE_SIZE: 1000,     // Queue size limit
  BATCH_SIZE: 10,           // Items per batch
  SYNC_INTERVAL: 30000,     // 30 seconds base interval
  CONNECTION_CHECK_INTERVAL: 5000 // Network check frequency
};
```

## Dead Letter Queue (DLQ)

### DLQ Implementation
**File**: `services/sync/deadLetterQueue.ts`

```typescript
interface DLQItem extends SyncQueueItem {
  failureReason: string;
  originalTimestamp: number;
  dlqTimestamp: number;
}

class DeadLetterQueue {
  async addToDLQ(item: SyncQueueItem, reason: string): Promise<void> {
    const dlqItem: DLQItem = {
      ...item,
      failureReason: reason,
      originalTimestamp: item.timestamp,
      dlqTimestamp: Date.now()
    };
    
    await AsyncStorage.setItem(
      `dlq_${item.id}`, 
      JSON.stringify(dlqItem)
    );
    
    // Telemetry tracking
    trackSyncEvent('ITEM_MOVED_TO_DLQ', {
      entity: item.entity,
      reason,
      retryCount: item.retryCount
    });
  }
  
  async retryFromDLQ(itemId: string): Promise<void> {
    const dlqKey = `dlq_${itemId}`;
    const dlqItemData = await AsyncStorage.getItem(dlqKey);
    
    if (!dlqItemData) return;
    
    const dlqItem: DLQItem = JSON.parse(dlqItemData);
    
    // Only retry if entity is still supported
    if (validateEntity(dlqItem.entity)) {
      // Reset retry count and re-queue
      const resetItem: SyncQueueItem = {
        ...dlqItem,
        retryCount: 0,
        timestamp: Date.now()
      };
      
      await offlineSyncService.addToSyncQueue(resetItem);
      await AsyncStorage.removeItem(dlqKey);
      
      trackSyncEvent('DLQ_ITEM_REQUEUED', { itemId });
    }
  }
}
```

### DLQ Management
```typescript
// Periodic DLQ cleanup (remove old items)
const cleanupDLQ = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const dlqKeys = keys.filter(key => key.startsWith('dlq_'));
  
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  for (const key of dlqKeys) {
    try {
      const itemData = await AsyncStorage.getItem(key);
      if (!itemData) continue;
      
      const item: DLQItem = JSON.parse(itemData);
      
      // Remove items older than 1 week
      if (item.dlqTimestamp < oneWeekAgo) {
        await AsyncStorage.removeItem(key);
        trackSyncEvent('DLQ_ITEM_EXPIRED', { itemId: item.id });
      }
    } catch (error) {
      // Remove corrupted items
      await AsyncStorage.removeItem(key);
    }
  }
};
```

## Sync Processing

### Batch Processing
```typescript
const processSyncBatch = async (items: SyncQueueItem[]): Promise<void> => {
  const results = await Promise.allSettled(
    items.map(item => processSingleItem(item))
  );
  
  results.forEach((result, index) => {
    const item = items[index];
    
    if (result.status === 'fulfilled') {
      // Success: remove from queue
      removeSyncItem(item.id);
      emitSyncCompleted(item.entity, item.data);
      
      trackSyncEvent('SYNC_ITEM_SUCCESS', {
        entity: item.entity,
        type: item.type,
        retryCount: item.retryCount
      });
    } else {
      // Failure: increment retry or move to DLQ
      handleSyncFailure(item, result.reason);
    }
  });
};
```

### Individual Item Processing
```typescript
const processSingleItem = async (item: SyncQueueItem): Promise<void> => {
  // Validate user ID before processing
  const userId = resolveValidUserId(item.data);
  
  // Route to appropriate handler
  switch (item.entity) {
    case 'user_profile':
      return await handleUserProfileSync(item);
    case 'mood_entry':
      return await handleMoodEntrySync(item);
    case 'voice_checkin':
      return await handleVoiceCheckinSync(item);
    // ... other handlers
    default:
      throw new Error(`No handler for entity: ${item.entity}`);
  }
};
```

### Entity-Specific Handlers
```typescript
const handleUserProfileSync = async (item: SyncQueueItem): Promise<void> => {
  const { user_id, payload } = item.data;
  
  try {
    // Use the established upsertUserProfile service
    await supabaseService.upsertUserProfile(user_id, payload);
    
    trackSyncEvent('USER_PROFILE_SYNCED', {
      userId: user_id,
      hasMotivations: payload.motivations?.length > 0,
      hasReminders: payload.reminders?.enabled
    });
  } catch (error) {
    // Re-throw for retry logic handling
    throw new Error(`User profile sync failed: ${error.message}`);
  }
};

const handleMoodEntrySync = async (item: SyncQueueItem): Promise<void> => {
  const { user_id, moodData } = item.data;
  
  try {
    await supabaseService.saveMoodEntry(user_id, moodData);
    
    trackSyncEvent('MOOD_ENTRY_SYNCED', {
      userId: user_id,
      moodScore: moodData.mood_score
    });
  } catch (error) {
    throw new Error(`Mood entry sync failed: ${error.message}`);
  }
};
```

## Cache Invalidation

### Post-Sync Cache Management
**File**: `hooks/useCacheInvalidation.ts`

```typescript
const emitSyncCompleted = (entity: SupportedEntity, data: any): void => {
  // Entity-specific cache invalidation
  switch (entity) {
    case 'user_profile':
      // Invalidate user profile queries
      queryClient.invalidateQueries(['user_profile', data.user_id]);
      queryClient.invalidateQueries(['ai_context', data.user_id]);
      break;
      
    case 'mood_entry':
      // Invalidate mood-related queries
      queryClient.invalidateQueries(['mood_entries', data.user_id]);
      queryClient.invalidateQueries(['mood_analytics', data.user_id]);
      break;
      
    case 'voice_checkin':
      // Invalidate voice and AI queries
      queryClient.invalidateQueries(['voice_history', data.user_id]);
      queryClient.invalidateQueries(['ai_analysis', data.user_id]);
      break;
      
    default:
      // Generic invalidation
      queryClient.invalidateQueries([entity, data.user_id]);
  }
  
  // Emit global sync event
  eventEmitter.emit('syncCompleted', { entity, data });
};
```

### Cache Coordination
```typescript
// Coordinate cache invalidation across the app
const useCacheInvalidation = () => {
  useEffect(() => {
    const handleSyncCompleted = ({ entity, data }: SyncCompletedEvent) => {
      // Additional UI updates based on sync completion
      if (entity === 'user_profile') {
        // Refresh AI context for immediate use
        queryClient.prefetchQuery(
          ['ai_context', data.user_id],
          () => loadUserProfileContext(data.user_id)
        );
      }
    };
    
    eventEmitter.on('syncCompleted', handleSyncCompleted);
    
    return () => {
      eventEmitter.off('syncCompleted', handleSyncCompleted);
    };
  }, []);
};
```

## Usage Examples

### Adding Items to Sync Queue
```typescript
import { offlineSyncService } from '@/services/offlineSync';

// Onboarding profile sync
const syncOnboardingProfile = async (userId: string, payload: any) => {
  try {
    await offlineSyncService.addToSyncQueue({
      type: 'UPDATE',
      entity: 'user_profile',
      data: { user_id: userId, payload },
      priority: 'high' // High priority for onboarding
    });
  } catch (error) {
    console.error('Failed to queue profile sync:', error);
    // Handle gracefully - data is still saved locally
  }
};

// Mood entry sync
const syncMoodEntry = async (userId: string, moodData: any) => {
  await offlineSyncService.addToSyncQueue({
    type: 'CREATE',
    entity: 'mood_entry',
    data: { user_id: userId, moodData }
  });
};

// Voice checkin sync
const syncVoiceCheckin = async (userId: string, voiceData: any) => {
  await offlineSyncService.addToSyncQueue({
    type: 'CREATE',
    entity: 'voice_checkin',
    data: { user_id: userId, voiceData }
  });
};
```

### Manual Sync Triggering
```typescript
// Force sync attempt (useful for "retry" buttons)
const triggerManualSync = async (): Promise<boolean> => {
  try {
    const success = await offlineSyncService.processSyncQueue();
    
    if (success) {
      showToast('Senkronizasyon tamamlandı', 'success');
    } else {
      showToast('Senkronizasyon başarısız, tekrar denenecek', 'warning');
    }
    
    return success;
  } catch (error) {
    showToast('Senkronizasyon hatası', 'error');
    return false;
  }
};
```

## Telemetry & Monitoring

### Key Telemetry Events
```typescript
// Sync lifecycle events
trackSyncEvent('SYNC_QUEUE_ITEM_ADDED', {
  entity: string,
  type: 'CREATE' | 'UPDATE' | 'DELETE',
  queueSize: number
});

trackSyncEvent('SYNC_BATCH_STARTED', {
  batchSize: number,
  entities: string[]
});

trackSyncEvent('SYNC_BATCH_COMPLETED', {
  successCount: number,
  failureCount: number,
  duration: number
});

// Error and recovery events
trackSyncEvent('SYNC_ITEM_FAILED', {
  entity: string,
  retryCount: number,
  error: string
});

trackSyncEvent('DLQ_ITEM_ADDED', {
  entity: string,
  finalError: string
});

// Network and performance events
trackSyncEvent('NETWORK_RESTORED', {
  queueSize: number,
  dlqSize: number
});
```

### Health Monitoring
```typescript
const getSyncHealth = (): SyncHealthStatus => {
  return {
    queueSize: syncQueue.length,
    dlqSize: dlqQueue.length,
    lastSyncAttempt: lastSyncTimestamp,
    lastSuccessfulSync: lastSuccessTimestamp,
    networkStatus: networkStatus,
    retryRate: calculateRetryRate(),
    avgSyncDuration: calculateAverageSyncDuration()
  };
};
```

## Testing Strategies

### Unit Tests
- Queue item validation
- UUID sanitization logic
- Retry backoff calculations
- Entity handler functionality

### Integration Tests
- End-to-end sync flows
- Network interruption scenarios
- DLQ recovery processes
- Cache invalidation verification

### Smoke Tests
- Large queue processing
- Mixed entity type batches
- Error recovery patterns
- Performance under load

## İlgili Bölümler

- [**Data Model**](./data-model.md) – Supabase table structures
- [**Onboarding v2**](./onboarding-v2.md) – Profile sync integration
- [**Architecture**](./architecture.md) – Overall system design
- [**Troubleshooting**](./troubleshooting.md) – Common sync issues and solutions
