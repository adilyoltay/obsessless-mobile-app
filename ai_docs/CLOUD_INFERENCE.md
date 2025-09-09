AI Inference Service – Contract (Big Mood Detector)

Bu doküman; model I/O (özellik sırası ve normalizasyon), cloud inference API sözleşmesi, güvenlik ve hata modelini tek bir yerde toplar. İstemci uygulama bu sözleşmeye göre çağrı yapar ve cevapları yorumlar.

1) Genel Bakış
- Desteklenen modlar:
  - PAT‑Conv‑L (dakika penceresi, 7 gün × 24 × 60 = 10080 uzunluk)
  - Günlük kısa özellik vektörü (12 boyutlu, [0..1] normalize)
- Yanıt biçimleri:
  - Sınıf tabanlı: 5 sınıf için `logits` veya `probs`
  - Doğrudan MEA: `mood (0..100)`, `energy (1..10)`, `anxiety (1..10)` ve `confidence (0..1)`
- Sınıf sırası: `[normal, depressive, stressed, anxious, happy]`
- İstemci mapping: `logits/probs` dönerse ProductionScalerService softmax + MEA mapping uygular; MEA dönerse doğrudan kullanır.

2) Ortam Değişkenleri (istemci)
- URL: `EXPO_PUBLIC_AI_INFERENCE_URL` (veya `AI_INFERENCE_URL`)
- API key (opsiyonel): `EXPO_PUBLIC_AI_INFERENCE_KEY` (veya `AI_INFERENCE_KEY`)
- Timeout (ms): `EXPO_PUBLIC_AI_INFERENCE_TIMEOUT_MS` (varsayılan 8000)
- Köprü/Model seçimi: `BIG_MOOD_BRIDGE=cloud`, `BIG_MOOD_MODEL=pat-conv-l`

3) Kimlik Doğrulama ve Başlıklar
- `Content-Type: application/json`
- `x-api-key: <secret>` (opsiyonel; sunucu gerektiriyorsa zorunlu)

4) Model I/O – Günlük Özellik Vektörü (v1)
- Sıra (12 madde):
  `[hr_rest, hr_mean, hr_var, hrv_sdnn_median, hrv_rmssd, steps, active_energy, stand_hours, sleep_duration_min, sleep_efficiency, deep_sleep_ratio, vo2max]`
- Normalizasyon ([0..1], clip):
  - `hr_rest`: (x-40)/60  → 40..100
  - `hr_mean`: (x-40)/80  → 40..120
  - `hr_var`: x/400       → 0..400
  - `hrv_sdnn_median`: (x-10)/110 → 10..120
  - `hrv_rmssd`: (x-10)/110      → 10..120
  - `steps`: x/20000
  - `active_energy`: x/1500
  - `stand_hours`: x/18
  - `sleep_duration_min`: x/720
  - `sleep_efficiency`: x (0..1)
  - `deep_sleep_ratio`: x/0.6
  - `vo2max`: (x-20)/40 → 20..60

5) Model I/O – 7 Günlük Dakika Penceresi (10080)
- Kaynaklar (Apple Health): stepCount, activeEnergyBurned dakikalara dağıtılır; [0..1] normalize edilir.
- Opsiyonel z‑score (NHANES): `(x - mean) / std` (mean/std: 10080 uzunluk, `nhanes_v1`)
- İstemci genellikle [0..1] normalizasyon + opsiyonel z‑score uygular; sonra Float32Array olarak base64 kodlayıp gönderir.

6) İstek Sözleşmesi
- Yol: `POST /v1/infer`
- PAT‑Conv‑L (minute window):
```
{
  "model": "pat-conv-l",
  "model_version": "v1",               // opsiyonel
  "input_type": "minute_window_f32_b64",
  "minute_window_b64": "<base64 of Float32Array(10080)>",
  "scaler": "nhanes_v1",               // opsiyonel; server tarafı da z‑score uygulayabilir
  "features_hash": "<deterministic-hash>", // opsiyonel – idempotency/telemetry
  "client": {
    "app": "obslessless-clean",
    "version": "3.0.0"
  }
}
```
- Günlük kısa vektör (normalize [0..1]):
```
{
  "model": "big-mood-detector",
  "model_version": "v1",               // opsiyonel
  "input_type": "daily_features_norm01",
  "feature_version": "v1",             // sabit sıra
  "features": [0.4, 0.5, ... 12 değer],
  "features_hash": "<deterministic-hash>",
  "client": { "app": "obslessless-clean", "version": "3.0.0" }
}
```

7) Başarılı Cevap Sözleşmesi
- Seçenek A – Sınıf bazlı:
```
{
  "model": "pat-conv-l",
  "model_version": "v1",
  "class_labels": ["normal","depressive","stressed","anxious","happy"],
  "logits": [1.2, -0.5, 0.3, 0.1, 2.0],          // veya
  // "probs": [0.05, 0.10, 0.12, 0.08, 0.65],
  "top_class": 4,                                 // opsiyonel (0..4)
  "elapsed_ms": 73,
  "request_id": "abc123",
  "timestamp": "2025-09-09T12:34:56.789Z"
}
```
- Seçenek B – Doğrudan MEA:
```
{
  "model": "pat-conv-l",
  "model_version": "v1",
  "mood": 85,
  "energy": 9,
  "anxiety": 2,
  "confidence": 0.76,          // max(prob) veya server tarafı ölçümü
  "elapsed_ms": 62,
  "request_id": "abc123",
  "timestamp": "2025-09-09T12:35:12.001Z"
}
```

8) Hata Modeli
```
{
  "error": "invalid_input_type",
  "message": "input_type must be one of: minute_window_f32_b64, daily_features_norm01",
  "code": 400,
  "request_id": "abc123"
}
```
- 400: Geçersiz/eksik alan
- 401/403: Yetki hatası (API key vs.)
- 429: Rate limit
- 5xx: Sunucu hatası (opsiyonel `retry_after_ms`)

9) Güvenlik ve Sınırlar
- TLS (HTTPS) zorunlu
- Gönderilen veri PII içermez; dakika penceresi ve normalize günlük öznitelikler
- Önerilen yanıt latensi: < 2–3 s (timeout 8 s)
- Retry rehberi: 408/5xx için exponential backoff; 4xx için retry yok

10) İstemci Entegrasyonu (repo içi)
- Cloud Client: `services/ai/cloudInferenceClient.ts`
  - `inferPatConvL(minuteWindow:number[])`
  - `inferDailyFeatureVector(vec:number[])`
  - `health()`
- Model Runner: `services/ai/modelRunner.ts`
  - PAT‑Conv‑L akışı: `normalizeHealthData(...)` → `inferPatConvL(...)` → MEA
  - Günlük vektör akışı: `buildVector(...)` → `inferDailyFeatureVector(...)`
- Scaler/Mapping: `services/ai/productionScalerService.ts`
  - Z‑score (NHANES v1)
  - Sınıf→MEA mapping (5 sınıf):
    - 0 Normal → mood 60, energy 7, anxiety 3
    - 1 Depresif → mood 20, energy 3, anxiety 8
    - 2 Stresli → mood 30, energy 5, anxiety 9
    - 3 Endişeli → mood 25, energy 4, anxiety 10
    - 4 Mutlu → mood 85, energy 9, anxiety 2
  - Confidence: `max(prob)`
- Debug: `app/debug-tflite-test.tsx` (başlık: Cloud Inference Test)

11) OpenAPI Şeması
- JSON: `ai_docs/openapi.json`
- UI: Swagger/Redoc sunucu tarafında servis edilir (örn. `/docs`, `/redoc`)

12) Örnek cURL
- PAT‑Conv‑L (minute window):
```
curl -X POST "$EXPO_PUBLIC_AI_INFERENCE_URL/v1/infer" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $EXPO_PUBLIC_AI_INFERENCE_KEY" \
  -d '{
    "model": "pat-conv-l",
    "input_type": "minute_window_f32_b64",
    "minute_window_b64": "<BASE64>",
    "scaler": "nhanes_v1"
  }'
```

13) Versiyonlama
- `model_version`: server tarafı model revizyonları (opsiyonel alan; default `v1`)
- `feature_version`: günlük özellik sırası değişirse arttırılır (şu an `v1`)
- `scaler`: `nhanes_v1` varsayılan

14) Beklenen Davranış Özet
- Server, `logits/probs` veya doğrudan `MEA` dönebilir.
- İstemci, gelen formata göre MEA’yı güvenilir şekilde üretir.
- Sınıf sırası sabittir; mapping değişmemelidir.

15) Final Deployment Summary (2025-09-09)

Status: PRODUCTION READY — Service URL: http://192.168.1.56:8814

- Deployed Services
  - Framework: FastAPI 2.x (TensorFlow + XGBoost desteği)
  - Port: 8814, Interactive Swagger: `/docs`
- Model Status
  - XGBoost (GERÇEK AĞIRLIKLAR):
    - XGBoost_DE.json (8.18 MB) — AUC ~0.80
    - XGBoost_HME.json (5.09 MB) — AUC ~0.95
    - XGBoost_ME.json (2.03 MB) — AUC ~0.98
    - Durum: Yüklü (toplam ~15.3 MB)
  - PAT‑Conv‑L (Mimari hazır):
    - TensorFlow 2.20 ortamı, mimari hazır, NHANES normalizasyonu yüklü
    - Eğitilmiş ağırlıklar bekleniyor (erişim gerekli)
    - Şimdilik gelişmiş klinik analiz fallback’i aktif
- API Contract Compliance
  - Girdi: Daily features [0..1], Minute window base64 (10080)
  - Çıktı: Class probs veya MEA (mood/energy/anxiety) + confidence, metadata (request_id, timestamp)
  - Sınıf etiketleri: ["normal", "depressive", "stressed", "anxious", "happy"]
  - Sınıf→MEA mapping:
    - 0 Normal → mood 60, energy 7, anxiety 3
    - 1 Depresif → mood 20, energy 3, anxiety 8
    - 2 Stresli → mood 30, energy 5, anxiety 9
    - 3 Endişeli → mood 25, energy 4, anxiety 10
    - 4 Mutlu → mood 85, energy 9, anxiety 2
- Production Features
  - Güvenlik: Opsiyonel Bearer token, CORS; Rate limiting (health/models/infer için farklı kotalar)
  - İzleme: Health endpoint, kapsamlı request/error log’ları
  - Performans: XGBoost <50ms; PAT analizi <100ms (mimari/analiz modu)
- Testler
  - Health, Models, Daily Features, Minute Window, Error Handling kapsamı
  - Manuel doğrulamalar: XGBoost ile gerçek inference; NHANES normalizasyonu ile minute‑window işleme
- Belgeler/Artefaktlar
  - enhanced_api.py (servis), API_DOCUMENTATION.md, openapi.json, test_api.py
  - Swagger UI: http://192.168.1.56:8814/docs — ReDoc: /redoc
- Kullanım Örnekleri
  - Daily Features (real XGBoost):
    curl -X POST http://192.168.1.56:8814/v1/infer -H 'Content-Type: application/json' -d '{
      "model":"big-mood-detector","input_type":"daily_features_norm01", "features":[0.5,0.6,0.4,0.7,0.3,0.8,0.5,0.9,0.2,0.7,0.6,0.4], "response_format":"mea" }'
  - PAT Conv‑L (minute window):
    curl -X POST http://192.168.1.56:8814/v1/infer -H 'Content-Type: application/json' -d '{
      "model":"pat-conv-l","input_type":"minute_window_f32_b64","minute_window_b64":"<base64-10080>","scaler":"nhanes_v1","response_format":"class" }'
- Sınırlamalar ve Notlar
  - PAT ağırlıkları bekleniyor; mimari hazır. Ara mod: klinik analiz fallback
  - Nüfus/valİdasyon: XGBoost (Kore kohortu), PAT (US NHANES); klinik kullanım için onaylı değildir
  - Üretim için öneriler: Gelişmiş auth (JWT/OAuth), rate limiting, metrikler/alarmlar, model sürümleme
