# Troubleshooting Guide

ObsessLess uygulamasında karşılaşılabilecek yaygın sorunlar ve çözümleri.

## Common Issues (Yaygın Sorunlar)

### Authentication & Session Issues

#### "Session refresh failed" / Oturum Yenileme Hatası
**Belirti**: İlk açılışta authentication hataları
**Neden**: Supabase session'ı expire olmuş veya corrupted
**Çözüm**:
```typescript
// services/supabase.ts içinde initialize() tekrar çağır
await supabaseService.initialize();

// Gerekirse manuel logout/login
await supabase.auth.signOut();
// Kullanıcıdan tekrar login olmasını iste
```

#### "User not authenticated" Errors
**Belirti**: API çağrılarında 401 Unauthorized
**Neden**: Auth token geçersiz veya eksik
**Çözüm**:
1. Session durumunu kontrol et
2. Token refresh dene
3. Gerekirse re-authentication yap

### Database & Sync Issues

#### "invalid input syntax for uuid 'anon'"
**Belirti**: Offline sync sırasında UUID hatası
**Neden**: Queue'ya `user_id='anon'` yazılması
**Çözüm**:
```typescript
// services/offlineSync.ts - resolveValidUserId otomatik temizler
// Manuel temizlik gerekiyorsa:
await AsyncStorage.removeItem('sync_queue');
// App'i online iken açın ve onboarding'i tamamlayın
```
**Önleme**: UUID validation `resolveValidUserId` fonksiyonunda yapılıyor

#### `lifestyle_exercise` CHECK Constraint Violation
**Belirti**: Database constraint hatası
**Neden**: Enum dışı değer (örn. 'heavy', 'very_intense')
**Çözüm**:
```sql
-- Geçerli enum değerleri
-- 'none', 'light', 'moderate', 'intense'

-- services/supabase.ts upsertUserProfile otomatik normalize eder
```
**Önleme**: Client-side enum validation ve normalization

#### Onboarding Loop (Sonsuz Yönlendirme)
**Belirti**: App sürekli onboarding sayfasına yönlendiriyor
**Neden**: Generic completion flag var, user-specific eksik
**Çözüm**:
```typescript
// components/navigation/NavigationGuard.tsx otomatik migrate eder
// Manuel çözüm:
await AsyncStorage.setItem(`ai_onboarding_completed_${userId}`, 'true');
await AsyncStorage.removeItem('ai_onboarding_completed');
```

### AI Pipeline Issues

#### "AI Pipeline not responding"
**Belirti**: Voice analysis çalışmıyor
**Neden**: UnifiedAIPipeline initialization sorunu
**Çözüm**:
1. Environment variables kontrol et
2. API keys doğruluğunu kontrol et
3. Network bağlantısını test et
4. Fallback heuristic'lerin çalıştığını doğrula

#### "Context loading failed"
**Belirti**: AI analizlerinde bağlam eksik
**Neden**: User profile adapter sorunu
**Çözüm**:
```typescript
// features/ai/context/userProfileAdapter.ts
// Priority: profile_v2 → onb_v1_payload → Supabase
// Manuel context reload:
await loadUserProfileContext(userId, { forceRefresh: true });
```

### Offline Sync Problems

#### Sync Queue Not Processing
**Belirti**: Offline veriler senkronize olmuyor
**Neden**: Network state yanlış algılanıyor veya queue corrupted
**Çözüm**:
```typescript
// Manuel sync tetikleme
await offlineSyncService.processSyncQueue();

// Queue temizleme (son çare)
await AsyncStorage.removeItem('offline_sync_queue');
```

#### DLQ (Dead Letter Queue) Accumulation
**Belirti**: Failed items DLQ'da biriküyor
**Neden**: Persistent validation hatası
**Çözüm**:
1. DLQ items'ları incele: `yarn debug:dlq`
2. Data validation'ı düzelt
3. DLQ cleanup çalıştır: `await cleanupDLQ()`

### Performance Issues

#### App Launch Time Slow
**Belirti**: 5+ saniye startup süresi
**Neden**: Heavy initialization, large AsyncStorage
**Çözüm**:
1. AsyncStorage cleanup: `await AsyncStorage.clear()` (test ortamında)
2. Cache invalidation: Query cache'i temizle
3. Bundle analyzer ile büyük dependencies tespit et

#### Memory Leaks
**Belirti**: App kullanımda yavaşlıyor
**Neden**: Event listeners, timers temizlenmiyor
**Çözüm**:
1. Component cleanup'larını kontrol et
2. useEffect dependency arrays'i doğrula
3. Memory profiler ile leak tespiti yap

### Network & API Issues

#### "Network request failed"
**Belirti**: API çağrıları başarısız oluyor
**Neden**: Network konfigürasyonu, CORS, certificate issues
**Çözüm**:
1. Network state kontrol et
2. API endpoint'leri test et
3. Certificate pinning (varsa) kontrol et
4. Proxy/VPN interference kontrol et

#### Rate Limiting
**Belirti**: "Too many requests" hatası
**Neden**: API rate limit aşılması
**Çözüm**:
1. Request frequency azalt
2. Batching uygula
3. Exponential backoff kullan
4. Circuit breaker pattern uygula

## Development Issues

### TypeScript Errors

#### "Cannot find module" Errors
**Çözüm**:
```bash
# Module resolution temizleme
rm -rf node_modules
yarn install

# TypeScript cache temizleme  
yarn typecheck --build --clean
```

#### Strict Mode Type Errors
**Çözüm**:
1. Null checks ekle: `value?.property`
2. Type guards kullan: `if (typeof value === 'string')`
3. Non-null assertion (dikkatli): `value!.property`

### Build Issues

#### Metro Bundle Errors
**Çözüm**:
```bash
# Metro cache temizleme
yarn start --reset-cache

# Watchman temizleme
watchman watch-del-all

# Node modules temizleme
rm -rf node_modules && yarn install
```

#### iOS Build Failures
**Çözüm**:
```bash
# CocoaPods temizleme
cd ios && rm -rf Pods && pod install && cd ..

# Xcode build temizleme
cd ios && xcodebuild clean && cd ..

# Derived data temizleme (Xcode)
rm -rf ~/Library/Developer/Xcode/DerivedData
```

#### Android Build Issues
**Çözüm**:
```bash
# Gradle temizleme
cd android && ./gradlew clean && cd ..

# ADB restart
adb kill-server && adb start-server

# Android cache temizleme
rm -rf ~/.gradle/caches/
```

## Debugging Tools & Commands

### Debug Commands
```bash
# Full diagnostic
yarn debug:full

# Specific components
yarn debug:sync          # Offline sync status
yarn debug:ai           # AI pipeline status  
yarn debug:auth         # Authentication status
yarn debug:cache        # Cache inspection

# Clear operations
yarn clear:cache        # Clear all caches
yarn clear:storage      # Clear AsyncStorage (destructive)
yarn clear:logs         # Clear debug logs
```

### Log Analysis
```typescript
// Enable debug logging
if (__DEV__) {
  console.log('[DEBUG] Sync queue status:', await getSyncStatus());
  console.log('[DEBUG] Auth state:', await getAuthState());
  console.log('[DEBUG] Cache status:', await getCacheStatus());
}

// Production error tracking
import crashlytics from '@react-native-firebase/crashlytics';

const logNonFatalError = (error: Error, context: string) => {
  crashlytics().log(`Context: ${context}`);
  crashlytics().recordError(error);
};
```

### Network Debugging
```typescript
// Network state monitoring
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener(state => {
  console.log('[NETWORK] Connection type:', state.type);
  console.log('[NETWORK] Is connected:', state.isConnected);
  console.log('[NETWORK] Is reachable:', state.isInternetReachable);
});

// API request debugging
const debugApiRequest = (url: string, response: Response) => {
  console.log(`[API] ${url} - Status: ${response.status}`);
  if (!response.ok) {
    console.log(`[API] Error: ${response.statusText}`);
  }
};
```

## Feature-Specific Issues

### Notifications Not Working
**Belirti**: Reminder'lar gelmiyor
**Neden**: Permission reddedilmiş veya scheduling sorunu
**Çözüm**:
1. Permission status kontrol et
2. Notification scheduling debug et
3. Device notification settings kontrol et
4. iOS: UNUserNotificationCenter permissions

### Voice Recognition Failing
**Belirti**: Ses tanıma çalışmıyor
**Neden**: Microphone permission, audio service configuration
**Çözüm**:
1. Microphone permission kontrol et
2. Audio session configuration kontrol et
3. voiceRecognitionService debug et
4. Device-specific audio issues kontrol et

### Telemetry Data Missing
**Belirti**: Analytics'te data eksik
**Neden**: Feature flag kapalı, network sorunu
**Çözüم**:
```typescript
// Feature flag kontrol et
if (!ENV.ENABLE_TELEMETRY) {
  console.log('[TELEMETRY] Disabled via feature flag');
}

// Network connectivity kontrol et
// Telemetry service status kontrol et
```

## Emergency Procedures

### App Crash Recovery
1. **Immediate**: Restart app
2. **Short-term**: Clear cache, restart device
3. **Medium-term**: Reinstall app (data loss possible)
4. **Long-term**: Contact support with crash logs

### Data Loss Prevention
```typescript
// Emergency backup before critical operations
const createEmergencyBackup = async () => {
  const criticalData = {
    profile: await AsyncStorage.getItem('profile_v2'),
    mood: await AsyncStorage.getItem('mood_entries_cache'),
    settings: await AsyncStorage.getItem('user_settings')
  };
  
  await AsyncStorage.setItem('emergency_backup', JSON.stringify({
    ...criticalData,
    timestamp: Date.now()
  }));
};
```

### Factory Reset Procedure
```typescript
const factoryReset = async () => {
  // 1. Backup critical data (optional)
  await createEmergencyBackup();
  
  // 2. Clear all local data
  await AsyncStorage.clear();
  
  // 3. Clear cache
  await queryClient.clear();
  
  // 4. Sign out
  await supabase.auth.signOut();
  
  // 5. Restart app
  // User will go through onboarding again
};
```

## Getting Help

### Log Collection
```bash
# Collect logs for support
yarn logs:collect

# Generated file: logs-YYYY-MM-DD-HHMMSS.zip
# Share this file with development team
```

### Support Information
**Before contacting support, please provide:**
1. Device info (iOS/Android version)
2. App version
3. Error messages (exact text)
4. Steps to reproduce
5. Network conditions
6. Recent changes (updates, new features used)

### Escalation Path
1. **Self-service**: Check this troubleshooting guide
2. **Community**: Check GitHub issues / Discord
3. **Support team**: Email with log files
4. **Emergency**: Critical bug hotline (production issues only)

## İlgili Bölümler

- [**Architecture**](./architecture.md) – System design for debugging
- [**Development**](./development.md) – Development tools and setup
- [**Testing**](./testing.md) – Testing and validation procedures
- [**Sync**](./sync.md) – Offline sync troubleshooting
- [**Onboarding v2**](./onboarding-v2.md) – Onboarding flow issues
