/**
 * 📱 Detox E2E Test Configuration
 * ObsessLess için end-to-end test konfigürasyonu
 */

module.exports = {
  testRunner: {
    args: {
      '$0': 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupFilesAfterEnv: ['<rootDir>/e2e/init.js'],
      testEnvironment: 'node'
    }
  },
  
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ObsessLess.app',
      build: 'xcodebuild -workspace ios/ObsessLess.xcworkspace -scheme ObsessLess -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/ObsessLess.app',
      build: 'xcodebuild -workspace ios/ObsessLess.xcworkspace -scheme ObsessLess -configuration Release -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081]
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release'
    }
  },
  
  devices: {
    'ios.simulator': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14'
      }
    },
    'android.emulator': {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_33'
      }
    },
    'android.attached': {
      type: 'android.attached',
      device: {
        adbName: '.*'
      }
    }
  },
  
  configurations: {
    'ios.sim.debug': {
      device: 'ios.simulator',
      app: 'ios.debug'
    },
    'ios.sim.release': {
      device: 'ios.simulator',
      app: 'ios.release'
    },
    'android.emu.debug': {
      device: 'android.emulator',
      app: 'android.debug'
    },
    'android.emu.release': {
      device: 'android.emulator',
      app: 'android.release'
    },
    'android.att.debug': {
      device: 'android.attached',
      app: 'android.debug'
    },
    'android.att.release': {
      device: 'android.attached',
      app: 'android.release'
    }
  }
};