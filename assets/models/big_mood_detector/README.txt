Place your TFJS model files here for @tensorflow/tfjs-react-native bundleResourceIO:

Required (example):
- model.json
- group1-shard1of1.bin (or multiple shard files)

If you prefer TFLite, place:
- big_mood_detector.tflite

Notes for TFLite:
- On iOS, ensure the .tflite file is added to the app bundle resources (Expo prebuild will include files referenced via require; modelRunner.ts uses expo-asset to resolve a local path).
- On Android, the file should be accessible under the app bundle. The expo-asset path resolution in modelRunner.ts attempts to provide a filesystem path to the TFLite bridge.

Update services/ai/modelRunner.ts with the correct asset paths if you change names.
