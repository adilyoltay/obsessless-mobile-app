Big Mood Detector – Production Integration Summary

- Scaler: `services/ai/productionScalerService.ts`
  - Dynamically loads optional NHANES scaler `assets/models/big_mood_detector/nhanes_scaler_stats.json` (mean/std; 10,080 each).
  - Builds 7‑day minute activity window (10080) via `get7DayMinuteActivityWindow(...)` and applies z‑score if scaler is present.
  - Maps PAT‑Conv‑L 5‑class outputs to MEA (mood/energy/anxiety) with softmax confidence (max probability).

- Model Runner: `services/ai/modelRunner.ts`
  - Bridge selection via env: `BIG_MOOD_BRIDGE=tflite|tfjs|placeholder`.
  - TFLite path resolved with `expo-asset`; runs on `react-native-fast-tflite` when available.
  - When `BIG_MOOD_MODEL=pat-conv-l`, uses ProductionScalerService for input normalization and output MEA mapping; otherwise falls back to short feature vector flow.
  - Env lookup supports Expo `extra` fallback (`EXPO_PUBLIC_` variants).

- Health Signals: `services/ai/healthSignals.ts`
  - Provides `get7DayMinuteActivityWindow()` distributing Apple Health stepCount and activeEnergyBurned into minute bins; normalizes to [0..1].
  - `getDailyFeatures()` extracts HR/HRV/Steps/Energy/Sleep; supports asleepCore/deep/REM to compute `sleep_efficiency` and `deep_sleep_ratio`.

- TFLite Test Service: `services/tfliteModelTestService.ts`
  - Loads `assets/models/big_mood_detector/big_mood_detector.tflite` using `expo-asset` + `react-native-fast-tflite`.
  - Generates realistic 10080‑len inputs via ProductionScalerService, runs `runSync`, reports: `moodCategory` (by argmax), `confidence` (softmax max), `rawOutput` (first 5), `processingTime (ms)`.
  - Usage: `import { tfliteModelTestService } from '@/services/tfliteModelTestService'; await tfliteModelTestService.runFullTest();`

- Environment
  - Set in shell or `.env.local` and forwarded via `app.config.ts` extra:
    - `BIG_MOOD_BRIDGE=tflite`
    - `BIG_MOOD_MODEL=pat-conv-l`

- Assets
  - Model: `assets/models/big_mood_detector/big_mood_detector.tflite`
  - Optional Scaler: `assets/models/big_mood_detector/nhanes_scaler_stats.json`
  - Metro config includes `.tflite` in `metro.config.js`.

- ETS (manual)
  - Today screen ETS button triggers `runDailyOnce(userId, YYYY-MM-DD)` and upserts `ai_mood_predictions` via offline sync.

Notes
- If the scaler JSON is not present, normalization falls back to the already normalized [0..1] activity vector.
- There are unrelated TypeScript warnings in other files; they don’t affect this integration path but may appear in `npm run typecheck`.

