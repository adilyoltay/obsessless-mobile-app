module.exports = {
  testRunner: {
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest && cd ..',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_API_31_AOSP',
      },
    },
  },
  configurations: {
    'android.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
