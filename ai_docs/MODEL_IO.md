# big-mood-detector — Model I/O Sozlesmesi (Oneri)

Bu dokuman, cihaz-ici tahmin icin kullanilacak modelin girdi/cikti sozlesmesini ve normalizasyonunu tanimlar. Amac: HealthKit kaynakli gunluk ozellik vektorunu kararlı bir sirada normalize ederek modele vermek ve tahmin ciktilarini uygulama metrikleriyle hizalamak.

## Giris Ozellikleri (Gunluk, v1)
- hr_rest: dinlenik nabiz (bpm)
- hr_mean: gunluk ortalama nabiz (bpm)
- hr_var: gunluk nabiz varyansi
- hrv_sdnn_median: SDNN median (ms)
- hrv_rmssd: RMSSD (ms)
- steps: adim sayisi (adet)
- active_energy: aktif enerji (kcal)
- stand_hours: ayakta gecirilen saat (saat)
- sleep_duration_min: toplam uyku (dk)
- sleep_efficiency: uyku verimliligi (0..1)
- deep_sleep_ratio: derin uyku orani (0..1)
- vo2max: VO2Max (opsiyonel)

Uyku kategorileri icin esleme:
- inBed: yatakta kalma suresi (inBed)
- asleep: uyku suresi (tum uyku alt tipleri dahil)
- asleepDeep: derin uyku (varsa)
- awake: uyanik (sleep_efficiency hesaplamasina dahil degil)

Hesaplama:
- sleep_duration_min = asleep toplam dakika
- sleep_efficiency = asleep / inBed (inBed>0 ise)
- deep_sleep_ratio = asleepDeep / asleep (asleep>0 ise)

Sira (fixed order):

```
[hr_rest, hr_mean, hr_var, hrv_sdnn_median, hrv_rmssd, steps,
 active_energy, stand_hours, sleep_duration_min, sleep_efficiency,
 deep_sleep_ratio, vo2max]
```

Eksik alanlar icin NaN yerine makul varsayilanlar veya 0 kullanilabilir. Normalizasyonda bunlari 0’a map edip ayrica kalite metriğiyle (quality_score) isaretlemek onerilir.

## Normalizasyon (Ornek araliklar)
- hr_rest: 40..100 bpm -> (x-40)/60
- hr_mean: 40..120 bpm -> (x-40)/80
- hr_var: 0..400 -> x/400
- hrv_sdnn_median: 10..120 ms -> (x-10)/110
- hrv_rmssd: 10..120 ms -> (x-10)/110
- steps: 0..20000 -> x/20000
- active_energy: 0..1500 kcal -> x/1500
- stand_hours: 0..18 -> x/18
- sleep_duration_min: 0..720 -> x/720
- sleep_efficiency: 0..1 -> x
- deep_sleep_ratio: 0..0.6 -> x/0.6
- vo2max: 20..60 -> (x-20)/40

Degerler [0,1] araligina sikistirilir, sinirlar disina tasanlar clip edilir.

## Ciktilar
- mood_score_pred: 0..100
- energy_level_pred: 1..10
- anxiety_level_pred: 1..10
- depression_risk: 0..1 (opsiyonel)
- bipolar_risk: 0..1 (opsiyonel)
- confidence: 0..1 (tahmin guveni, opsiyonel)

## Ozellik Hash’i (features_hash)
- Amac: idempotent upsert ve model girdisinin versiyonlanmasi.
- Hesaplama: JSON.stringify(normalize edilmis ozellikler + feature_version + tarih penceresi) -> deterministik bir hash (or. sha-256 veya 32-bit basit hash). Projede su an basit (non-crypto) bir hash kullanilmaktadir.

## Entegrasyon Akisi
1) HealthKit -> gunluk ozellikler (`healthSignals.getDailyFeatures`)
2) `buildFeatureVector` + `normalizeFeatureVector` -> `features_hash`
3) Model inference (`modelRunner.runBigMoodDetector`)
4) `queueDailyPrediction` ile `ai_mood_prediction` kuyruğuna ekle -> offline sync ile DB’ye upsert

Not: Gercek model dosyasi (TFLite) ve kopru secimi (rn-tflite, tfjs-react-native) degisebilir; bu sozlesme I/O sabit kalacak sekilde tasarlanmistir.

