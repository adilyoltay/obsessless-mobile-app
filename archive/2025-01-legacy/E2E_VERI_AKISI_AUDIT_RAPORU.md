## ObsessLess Mobil • Uçtan Uca (E2E) Veri Akışı ve AI Analiz Zinciri Denetim Raporu

Tarih: 2025-08-17

### Kapsam
- Login → Profil/Onboarding → Kompulsiyon/ERP/Mood/Voice/Thought kayıtları → Offline-first senkronizasyon → AI veri birleştirme ve içgörü üretimi → Telemetri.
- Amaç: Offline ve Supabase kayıtlarının doğruluğu, kullanıcıya özel anahtarlar, AI pipeline bütünlüğü ve veri standardizasyonunun uçtan uca kaliteyi karşılayıp karşılamadığını doğrulamak.

### Yönetici Özeti (1 sayfa)
- Kimlik doğrulama, profil/onboarding, kompulsiyon, ERP, mood, voice/thought kayıtları ve AI içgörü hattı genel olarak doğru tasarlanmış ve çalışır durumda.
- Supabase şema/RLS politikaları uygulanmış; veri standardizasyonu ve PII maskesi aktif.
- Offline-first zincirde 3 kritik iyileştirme gereksinimi tespit edildi:
  - (A) OfflineSync için `currentUserId` kalıcı anahtarı set edilmiyor; `safeStorageKey` nedeniyle `anon` anahtarına düşme ve kullanıcılar arası karışma riski var.
  - (B) Kompulsiyon kayıtları Supabase hata durumunda kuyruklanmıyor (yalnızca lokale yazılıyor); çevrimdışı → çevrimi içi geçişte otomatik senkron garanti değil.
  - (C) OfflineSync, Supabase yerine REST `apiService` üzerinden senkron deniyor; proje prensibine (Supabase tek backend) aykırı.

Bu 3 iyileştirme uygulandığında offline-first entegrasyon tamamlanır ve analiz kalitesi uçtan uca production seviyesine çıkar.

---

## 1) Kimlik Doğrulama ve Profil/Onboarding

### Giriş ve Oturum Yönetimi
- Supabase session yenileme ve mevcut oturum denetimi var; başarıda `currentUser` set ediliyor.

```170:219:services/supabase.ts
  async initialize(): Promise<User | null> {
    ...
    const { data: { session }, error } = await this.client.auth.refreshSession();
    ...
    if (session?.user) { this.currentUser = session.user; return session.user; }
    ...
    const { data: { session: currentSession } } = await this.client.auth.getSession();
    if (currentSession?.user) { this.currentUser = currentSession.user; return currentSession.user; }
    return null;
  }
```

### Auth Context ve Kullanıcıya Özel Anahtar Migrasyonu
- Giriş sonrası kullanıcı ID tüm store’lara yayılıyor; eski anahtarlar kullanıcıya özel anahtarlara taşınıyor.

```217:223:contexts/SupabaseAuthContext.tsx
// Set user ID for all stores
setUserId(user.id);
// Initialize user-specific data migration
await migrateToUserSpecificStorage(user.id);
```

### Onboarding ve Profil Kalıcılığı (AsyncStorage + Supabase)
- Onboarding tamamlandığında hem yerel depolama hem Supabase `user_profiles`/AI tablalarına yazılıyor.

```112:121:store/onboardingStore.ts
await supabaseService.saveUserProfile({
  user_id: userId,
  ocd_symptoms: profile.primarySymptoms || [],
  daily_goal: profile.dailyGoal || 3,
  ybocs_score: profile.ybocsLiteScore || 0,
  ybocs_severity: profile.ybocsSeverity || 'Subclinical',
  onboarding_completed: true,
});
```

```83:92:app/(auth)/onboarding.tsx
await Promise.all([
  svc.upsertAIProfile(user.id, userProfile as any, true),
  svc.upsertAITreatmentPlan(user.id, treatmentPlan as any, 'active'),
]);
```

---

## 2) Kayıt Mekanizmaları (Compulsion, ERP, Mood, Voice/Thought)

### Kompulsiyon
- Tasarım: Offline-first. Önce AsyncStorage, sonra Supabase `compulsions` upsert.

```144:166:hooks/useCompulsions.ts
await AsyncStorage.setItem(`compulsions_${userId}`, JSON.stringify(updated));
try {
  await supabaseService.saveCompulsion({ user_id: userId, category: mapToCanonicalCategory(data.type), ...});
} catch { /* offline: yalnızca local */ }
```

```611:642:services/supabase.ts
async saveCompulsion(...){
  await this.ensureUserProfileExists(compulsion.user_id);
  const standardized = dataStandardizer.standardizeCompulsionData(mappedCompulsion);
  return await this.client.from('compulsions').upsert(standardized, { onConflict: 'id' }).select().single();
}
```

Durum: Supabase hatasında kuyruklama yapılmıyor (eksik). Aşağıda “Boşluklar” bölümünde detaylandırıldı.

### Terapi Oturumu
- Tasarım: Oturum bittiğinde local kalıcı kayıt + Supabase `therapy_sessions` upsert (dup. önleme).

```223:266:store/erpSessionStore.ts
const dbSession = dataStandardizer.standardizeERPSessionData({...});
await supabaseService.saveERPSession(dbSession as any);
// hata: offlineSyncService.storeERPSessionLocally(...) ile kuyruk
```

### Mood Tracking
- Tasarım: Günlük anahtarlar ile yerel saklama; Supabase `mood_tracking` tablosuna best‑effort upsert; `syncPendingEntries` ile toplu senkron.

```31:63:services/moodTrackingService.ts
await this.saveToLocalStorage(moodEntry);
try { await supabaseService.client.from('mood_tracking').upsert({...}); await this.markAsSynced(...); } catch { await this.incrementSyncAttempt(...); }
```

### Voice Check-in ve Thought Record
- Tasarım: Privacy-first; PII maskeleme çağrılarıyla Supabase `voice_checkins`/`thought_records` upsert.

```62:71:components/checkin/VoiceMoodCheckin.tsx
await supabaseService.saveVoiceCheckin({ user_id: user.id, text: sanitizePII(text), mood: n.mood, ... });
```

---

## 3) Kullanıcıya Özel Depolama Anahtarları

### Anahtar Tanımları ve Yardımcılar
- `utils/storage.ts` kullanıcıya özgü anahtarlar (`StorageKeys`), `getUserStorageKey`, `migrateToUserSpecificStorage` mevcut.

```8:19:utils/storage.ts
export const StorageKeys = { COMPULSIONS: (userId: string) => `compulsions_${userId}`, ERP_SESSIONS: (userId: string, date?: string) => ... } as const;
```

- `lib/queryClient.ts` `safeStorageKey(base, suffix, fallback='anon')` ile güvenli anahtar üretiyor.

```45:50:lib/queryClient.ts
export function safeStorageKey(base: string | undefined | null, suffix?: string, fallback: string = 'anon'): string {
  const baseStr = typeof base === 'string' && base.trim().length > 0 ? base : fallback;
  const suf = typeof suffix === 'string' && suffix.trim().length > 0 ? `_${suffix}` : '';
  return `${baseStr}${suf}`;
}
```

### Tespit
- `services/offlineSync.ts` birçok lokal anahtar için `currentUserId`’yi okuyor; ancak uygulama genelinde bu anahtar set edilmiyor. Bu, `safeStorageKey` ile `anon` fallback’ine düşerek kullanıcılar arası karışma riski doğuruyor. (Örn. `localCompulsions_anon`)

---

## 4) OfflineSync Mimarisi ve Doğrulama

### Tasarım
- Kuyruk yapısı, ağ dinleyicisi, dead-letter queue, batch optimizer ve circuit breaker mevcut.

```86:104:services/offlineSync.ts
async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
  const syncItem: SyncQueueItem = { ...item, id: `${Date.now()}_${...}`, timestamp: Date.now(), retryCount: 0, ... };
  this.syncQueue.push(syncItem);
  await this.saveSyncQueue();
  if (this.isOnline) { this.processSyncQueue(); }
}
```

```167:184:services/offlineSync.ts
private async syncItem(item: SyncQueueItem): Promise<void> {
  switch (item.entity) {
    case 'compulsion': await this.syncCompulsion(item); break;
    case 'therapy_session': await this.syncERPSession(item); break;
    case 'achievement': await this.syncAchievement(item); break;
    case 'mood_entry': await this.syncMoodEntry(item); break;
  }
}
```

### Tespit
- Kompulsiyon için `syncCompulsion` şu anda `apiService` üzerinden REST çağrıları yapıyor; proje prensibine aykırı (Supabase tek backend).
- Terapi için offline kuyruk bağlanmış; kompulsiyon için yerel yazım var ancak kuyruk eklenmiyor.
- `currentUserId` set edilmediği için local kuyruğun anahtarları `anon` olarak oluşabilir.

> Not (mimari dokümantasyon uyumu): `docs/ARCHITECTURE_OVERVIEW.md` içinde "`services/offlineSync.ts` kullanıcı kimliğini Supabase’ten çeker (AsyncStorage fallback)" denmektedir. Kaynak koda göre `loadSyncQueue/saveSyncQueue` aşamasında Supabase’tan kullanıcı ID’sini okumaya teşebbüs var; ancak `storeCompulsionLocally/storeERPSessionLocally` doğrudan `AsyncStorage.getItem('currentUserId')` kullanıyor. `currentUserId` set edilmediğinde fallback `anon` olur.

---

## 5) AI Analizi ve Pipeline

### Orkestrasyon
- `AIContext.generateInsights` → (veri toplama, local/remote fallback) → `insightsCoordinator.generateDailyInsightsWithData` → `insightsEngineV2.generateInsights` → sonuçlar cache ve opsiyonel `ai_insights` tablosuna yazım.

```748:775:contexts/AIContext.tsx
const [compList, erpList] = await Promise.all([
  supabaseService.getCompulsions(user.id, startISO, endISO),
  supabaseService.getERPSessions(user.id, startISO, endISO),
]);
// Local fallbacks: AsyncStorage compulsions/therapy_sessions_{userId}
```

```870:879:contexts/AIContext.tsx
const insights = await insightsCoordinator.generateDailyInsightsWithData(user.id, userProfile as any, behavioralData, 'standard');
return insights || [];
```

```346:358:features/ai/engines/insightsEngineV2.ts
await trackAIInteraction(AIEventType.INSIGHTS_GENERATED, { userId, insightCount: insights.length, ... });
```

### Veri Birleştirme (Aggregator)
- Kompulsiyon ve Terapi Supabase’ten; mood son 30 gün yerel depodan toplanıyor.

```40:56:features/ai/pipeline/enhancedDataAggregation.ts
const [compulsions, therapySessions, moodEntries, profile] = await Promise.all([
  this.fetchCompulsions(userId, 30),
  this.fetchERPSessions(userId, 30),
  this.fetchMoodEntries(userId, 30),
  this.fetchUserProfile(userId)
]);
```

---

## 6) Veri Standardizasyonu ve Gizlilik

### Standartlaştırma
- Kategori eşleme, tarih/numerik sınırlar, metin temizliği ve PII maskesi aktif.

```89:101:utils/dataStandardization.ts
standardizeCompulsionData(schema: zod) // category map, trigger/notes PII mask, timestamp ISO
```

```102:124:utils/dataStandardization.ts
standardizeERPSessionData(schema: zod) // duration_seconds, anxiety_* sınırlar ve timestamps
```

### DB Uyum Kontrolü (ERP)
- DB şeması: `duration_seconds > 0`, `anxiety_* 1..10`. Standartlaştırma: `duration_seconds min(0)`, `anxiety_* 0..10`. Öneri: min değerleri DB ile hizala (aşağıda İyileştirmeler).

---

## 7) Supabase Şeması ve RLS

- `compulsions`, `therapy_sessions`, `user_profiles`, `gamification_profiles`, `mood_tracking`, `voice_checkins`, `thought_records`, `ai_profiles`, `ai_treatment_plans`, `ai_insights` tabloları mevcut; RLS etkin ve kullanıcının sadece kendi verilerini görmesine/işlemesine izin veriyor.

```56:85:database/schema.sql
CREATE TABLE public.compulsions (...);
ALTER TABLE public.compulsions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own compulsions" ON public.compulsions FOR ALL USING (auth.uid() = user_id);
```

```87:113:database/schema.sql
CREATE TABLE public.therapy_sessions (...);
ALTER TABLE public.therapy_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own erp sessions" ON public.therapy_sessions FOR ALL USING (auth.uid() = user_id);
```

```1:33:supabase/migrations/2025-08-12_app_add_voice_and_thought_records.sql
create table if not exists public.voice_checkins (...);
alter table public.voice_checkins enable row level security;
create policy "Users manage own voice_checkins" ...;
create table if not exists public.thought_records (...);
```

```3:46:supabase/migrations/2025-08-10_add_ai_tables.sql
CREATE TABLE IF NOT EXISTS public.ai_profiles (...);
CREATE TABLE IF NOT EXISTS public.ai_treatment_plans (...);
CREATE TABLE IF NOT EXISTS public.ai_insights (...);
ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY ...
```

---

## 8) Boşluklar ve Riskler

- (A) `currentUserId` set edilmiyor → offline anahtarlar `anon`’a düşebilir → çoklu kullanıcı/veri karışma riski.
- (B) Kompulsiyon kayıtlarında Supabase hatasında kuyruklama yok → çevrimiçi olunca otomatik senkron garantisi yok.
- (C) OfflineSync Supabase yerine `apiService` ile REST çağrısı yapıyor → mimari kurala aykırı ve şema/standardizasyon tutarlılığı riski.
- (D) Terapi standardizasyonu ile DB min sınırları arasında küçük uyumsuzluk (min değerler).

---

## 9) Önerilen İyileştirmeler (Hızlı Kazanımlar)

- (A) Giriş sonrası `currentUserId`’yi set et:
  - `contexts/SupabaseAuthContext.tsx` → auth başarılı olduğunda: `AsyncStorage.setItem('currentUserId', user.id)` (best‑effort try/catch).
- (B) Kompulsiyon hatasında kuyrukla:
  - `hooks/useCompulsions.ts` catch bloğunda: `offlineSyncService.addToSyncQueue({ type: 'CREATE', entity: 'compulsion', data: {...}})`.
- (C) OfflineSync’i Supabase’e bağla:
  - `services/offlineSync.ts` içindeki `syncCompulsion`/`syncERPSession` ‘da `apiService` yerine `supabaseService.saveCompulsion/saveERPSession` kullan.
- (D) Terapi standardizasyonu min değerleri DB ile hizala:
  - `utils/dataStandardization.ts`: `duration_seconds.min(1)`, `anxiety_initial/final.min(1)`.
- (E) (Opsiyonel) Idempotency:
  - `compulsions` için `(user_id, timestamp, category, coalesce(subcategory,''))` üzerinde unique index ile tekrar kayıtların önüne geç.
- (F) (Opsiyonel) Aggregator’da mood’u Supabase’ten de okuyabilme (çoklu cihaz senaryosu için), gizlilik ayarlarına saygılı şekilde.

---

## 10) Doğrulama Senaryoları (E2E Test)

- Senaryo 1: Offline kayıt → Online senkron
  - Uçak modunda 2 kompulsiyon + 1 Terapi kaydı oluştur.
  - Online olunca OfflineSync kuyruğu boşalmalı; Supabase tablolarında kayıtlar görünmeli.
- Senaryo 2: Supabase hatası → Kuyruklama
  - API cevaplarını mock ederek 500/429 döndür; kompulsiyon/Terapi kayıtları kuyruklanmalı, backoff + retry çalışmalı, DLQ sayaçları oluşmalı.
- Senaryo 3: Çoklu cihaz tutarlılık
  - Cihaz A’da kayıt ekle; cihaz B’de aynı kullanıcı ile giriş → son 24 saatin verisi ve içgörüler yüklenmeli (AIContext). Cache hit/miss telemetrisi kontrol.
- Senaryo 4: Veri standardizasyonu sınırları
  - Terapi min değerleri (duration=1, anxiety=1) ile gönder; DB kabul ve Supabase kayıt doğrulaması.
- Senaryo 5: Gizlilik
  - Voice/Thought metinlerinde email/telefon/kart/TC içeren örnekler PII maskesi ile `saveVoiceCheckin/saveThoughtRecord`’da maskelenmeli.

---

## 11) Ölçümleme ve İzleme

- Sync metrikleri: `last_sync_summary`, DLQ sayısı, başarı/başarısızlık oranı, conflict rate (`performanceMetricsService`).
- AI telemetri: `AIEventType.*` (INSIGHTS_GENERATED, RATE_LIMITED, CACHE_HIT/MISS, STORAGE_RETRY_*).
- Dashboards: Günlük senkron başarı oranı, ortalama gecikme, insight üretim sayısı, veri kalitesi (insightsCoordinator `executionMetrics.dataQuality`).

---

## 12) Sonuç

- Online senaryoda sistem hedeflenen akışları başarıyla yerine getiriyor.
- Offline-first zincirde tespit edilen 3 ana iyileştirme ile (kullanıcı anahtarı, kompulsiyon kuyruklama, Supabase’e bağlanan OfflineSync) üretim ortamı için beklenen analiz kalitesi ve veri bütünlüğü güvence altına alınır.

---

## Ek: Dosya ve Kod Referansları (Seçilmiş)

- Auth ve profil: `services/supabase.ts`, `contexts/SupabaseAuthContext.tsx`, `app/(auth)/onboarding.tsx`, `store/onboardingStore.ts`
- OfflineSync: `services/offlineSync.ts`, `services/sync/deadLetterQueue.ts`, `services/sync/batchOptimizer.ts`, `utils/circuitBreaker.ts`
- Kayıt akışları: `hooks/useCompulsions.ts`, `store/erpSessionStore.ts`, `services/moodTrackingService.ts`, `components/checkin/VoiceMoodCheckin.tsx`, `components/forms/ThoughtRecordForm.tsx`
- AI pipeline: `contexts/AIContext.tsx`, `features/ai/coordinators/insightsCoordinator.ts`, `features/ai/engines/insightsEngineV2.ts`, `features/ai/pipeline/enhancedDataAggregation.ts`
- Standardizasyon ve kategori eşleme: `utils/dataStandardization.ts`, `utils/categoryMapping.ts`
- Supabase şema: `database/schema.sql`, `supabase/migrations/*`

---

### Notlar
- `VoiceInterface` ses katmanı `voiceRecognitionService` üzerinden çalışır; doğrudan `expo-av` import edilmez (mimarî kural).
- Bu rapor, ilgili dosyalarda yapılan log/telemetri mesajlarını da referans olarak kabul eder.


