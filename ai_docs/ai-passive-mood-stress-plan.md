# Apple Health Pasif Duygu/Stres AI Entegrasyon Planı (big‑mood‑detector)

## Amaç
- Apple Health verileri (HR/HRV, adım, uyku, aktif enerji) ile pasif olarak mood/enerji/anksiyete skorları + risk (depresyon/bipolar) tahmini.
- Tamamen cihaz‑içi (on‑device) tahmin; gizlilik ve pil dostu.
- Manuel mood girişlerini bozmadan AI tahminlerini ayrı bir akışta saklamak ve grafiklerde “overlay” olarak göstermek.

## Mimari Genel Bakış
- On‑device pipeline:
  - HealthKit → Günlük özellik çıkarımı (HRV SDNN/RMSSD, dinlenik nabız, adım, aktif enerji, uyku süre/kalite) → Model girdisi
  - big‑mood‑detector (TFLite): mood_score (0–100), energy_level (1–10), anxiety_level (1–10), risk skorları → çıktılar
  - Kalibrasyon (opsiyonel v2): az sayıda manuel mood girişine göre son katman/ölçek ayarı
- Veri akışı:
  - Tahminler cihazda üretilir; offline queue ile Supabase’e idempotent upsert.
  - Grafikler: manuel veriler öncelikli, tahminler “AI overlay” olarak sunulur.
- Gizlilik:
  - Ham HealthKit numune verisi sunucuya gitmez; (opsiyonel) günlük aggregate/özellik özetleri saklanabilir ya da hiç saklanmaz.

## Veritabanı Şeması (Supabase)
1) ai_mood_predictions (v1 çekirdek)
- id: uuid pk
- user_id: uuid
- bucket_granularity: 'hour'|'day' (v1: 'day')
- bucket_start_ts_utc: timestamptz
- bucket_ymd_local: text (YYYY-MM-DD)
- mood_score_pred: smallint (0–100)
- energy_level_pred: smallint (1–10)
- anxiety_level_pred: smallint (1–10)
- depression_risk: float8 null
- bipolar_risk: float8 null
- confidence: float8 null
- model_name: text
- model_version: text
- features_hash: text
- content_hash: text  // idempotency
- created_at: timestamptz default now()
- Unique: (user_id, bucket_granularity, bucket_ymd_local, model_name, model_version) veya (user_id, content_hash)
- Index: (user_id, bucket_ymd_local), (user_id, created_at)
- RLS: user_id = auth.uid()

2) health_features_daily (opsiyonel v1; tavsiye)
- id, user_id, date (date), source ('healthkit'), feature_version, quality_score (0–1)
- steps, active_energy, sleep_duration_min, sleep_efficiency, deep_sleep_ratio, stand_hours, vo2max
- hr_rest, hr_mean, hr_var, hrv_sdnn_median, hrv_rmssd
- features jsonb (ek türetilmişler)
- Unique: (user_id, date, source, feature_version)
- RLS: user_id = auth.uid()

3) ai_calibration_profiles (opsiyonel v2)
- id, user_id unique, model_name, model_version
- method ('linreg'|'isotonic'|...), params jsonb, sample_count, last_calibrated_at
- RLS: user_id = auth.uid()

## Service Katmanı
- Supabase: `AIPredictionService` (getPredictions, upsertPrediction).
- Local encrypted repo: `predictionRepository` (günlük bazlı okuma/yazma).
- HealthKit özellik çıkarımı: `healthSignals` (günlük özellik vektörü + kalite).

## Entegrasyon Adımları (Faz 1)
1) Altyapı:
   - Paketler: HealthKit (öneri: @kingstinct/react-native-healthkit), TFLite köprüsü (örn. react-native-tflite, tflite-react-native) veya TFJS’e dönüştürülmüş modelle @tensorflow/tfjs-react-native.
   - iOS: HealthKit izinleri (HR, HRV SDNN, adım, aktif enerji, uyku).
2) Veri Akışı:
   - Günlük periyotlu (uyku sonrası/şarja takılıyken) HealthKit sorguları → özellik çıkarımı.
3) Model Entegrasyonu:
   - big‑mood‑detector TFLite modelini assets’e koy; girdi normalizasyonunu modelin beklediği sıraya göre eşle.
   - Çıktıları {mood_score, energy_level, anxiety_level, riskler, confidence} şeklinde parse et.
4) Sonuçları Görselleştirme:
   - Mevcut grafikte manuel veriler “asıl” seri.
   - AI tahmini overlay (noktalı/yarı saydam) ve tooltip’te “AI Tahmin (güven: %x)”.
   - Gamification sadece manuel girişlere dayalı kalır.

## Idempotency & Sync
- features_hash = sha256(normalized_feature_vector + window)
- content_hash = sha256(user_id + bucket_ymd_local + model_name + model_version + features_hash)
- Offline queue → upsert (onConflict: content_hash veya composite unique).

## Kalite & Güvenlik
- HR/HRV outlier temizliği, uyku birleştirme.
- EMA/median filtre ile çizgi zıplama azaltma.
- RLS ve PII temizliği: yalnızca türetilmiş/aggregate sakla (ham örnekler cihazda).

## İzleme
- MAE, korelasyon (AI vs manuel), coverage (tahmin yapılabilen gün %), ort. response süresi, batarya etkisi.

## Riskler
- Model I/O şeması ve lisans teyit zorunlu.
- TF köprüleri ve iOS/Metal hızlandırma konfigürasyonu.

## SQL (taslak)
```sql
create table if not exists ai_mood_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bucket_granularity text not null check (bucket_granularity in ('hour','day')) default 'day',
  bucket_start_ts_utc timestamptz not null,
  bucket_ymd_local text not null,
  mood_score_pred smallint not null check (mood_score_pred between 0 and 100),
  energy_level_pred smallint not null check (energy_level_pred between 1 and 10),
  anxiety_level_pred smallint not null check (anxiety_level_pred between 1 and 10),
  depression_risk double precision,
  bipolar_risk double precision,
  confidence double precision,
  model_name text not null,
  model_version text not null,
  features_hash text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, bucket_granularity, bucket_ymd_local, model_name, model_version)
);
create index if not exists idx_ai_pred_user_ymd on ai_mood_predictions (user_id, bucket_ymd_local);
alter table ai_mood_predictions enable row level security;
create policy ai_pred_rls on ai_mood_predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

