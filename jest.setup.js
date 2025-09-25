/* eslint-env jest */
/* global jest, beforeAll */
// Basic Jest setup for React Native + Expo environment

// Load .env.local before anything else
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

// Force assign critical env from .env.local if present
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Ensure critical test env flags are set BEFORE any module evaluations (featureFlags reads these at import time)
process.env.TEST_MODE = process.env.TEST_MODE || '1';
process.env.TEST_TTL_MS = process.env.TEST_TTL_MS || '5000';
process.env.TEST_PIPELINE_STUB = process.env.TEST_PIPELINE_STUB || '1';
process.env.TEST_SEED_USER_ID = process.env.TEST_SEED_USER_ID || 'test-user-1';
process.env.EXPO_PUBLIC_ENABLE_AI = process.env.EXPO_PUBLIC_ENABLE_AI || 'true';

// Mock AsyncStorage to avoid native module errors in Jest
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key) => (store.has(key) ? String(store.get(key)) : null)),
      setItem: jest.fn(async (key, value) => { store.set(key, value); }),
      removeItem: jest.fn(async (key) => { store.delete(key); }),
      clear: jest.fn(async () => { store.clear(); }),
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
    },
  };
});

// Mock expo-constants env access used by featureFlags
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

// Force-enable unified pipeline flag globally in tests via module mock
jest.mock('@/constants/featureFlags', () => {
  const actual = jest.requireActual('@/constants/featureFlags');
  const original = actual.FEATURE_FLAGS;
  const patched = {
    ...original,
    isEnabled: (feature) => {
      if (feature === 'AI_UNIFIED_PIPELINE' || feature === 'AI_TELEMETRY') return true;
      return original.isEnabled(feature);
    },
  };
  return {
    __esModule: true,
    FEATURE_FLAGS: patched,
  };
});

// Some modules may import without alias; patch that path too
 

// Mock expo virtual env (ESM) used by expo packages
jest.mock('expo/virtual/env', () => ({
  __esModule: true,
  env: {},
}));

// Mock @expo/vector-icons to avoid ESM issues in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    MaterialCommunityIcons: (props) => {
      // Preserve testID and other relevant props for testing
      return React.createElement(View, {
        ...props,
        accessibilityRole: 'image',
        accessibilityLabel: `Icon: ${props.name || 'unknown'}`,
        // Preserve testID for queries
        testID: props.testID,
        // Store icon name as a data attribute for testing
        'data-icon-name': props.name
      });
    },
  };
});

// Mock expo-router used in navigation
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn() },
  useSegments: () => [],
  useLocalSearchParams: () => ({}),
}));

// Mock NetInfo (provide stable defaults for sync services)
jest.mock('@react-native-community/netinfo', () => {
  const listeners = new Set();
  const addEventListener = jest.fn((handler) => {
    listeners.add(handler);
    return () => listeners.delete(handler);
  });

  const fetch = jest.fn(async () => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  }));

  return {
    __esModule: true,
    default: {
      addEventListener,
      fetch,
      configure: jest.fn(),
    },
    addEventListener,
    fetch,
    configure: jest.fn(),
  };
});

// Mock @react-navigation/native to fix ES module transform issues
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useFocusEffect: jest.fn((cb) => { 
    if (typeof cb === 'function') cb();
  }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {}, name: 'Test' }),
  createStaticNavigation: jest.fn(),
}));

// Mock expo-linear-gradient to avoid native calls
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    LinearGradient: (props) => React.createElement(View, props),
  };
});

// Mock expo-haptics to avoid native calls
jest.mock('expo-haptics', () => ({
  __esModule: true,
  impactAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  __esModule: true,
  openURL: jest.fn(async () => true),
}));

// Mock expo-auth-session and web-browser chains used by services
jest.mock('expo-auth-session', () => ({
  __esModule: true,
  makeRedirectUri: jest.fn(() => 'https://example.com/callback'),
}));
jest.mock('expo-web-browser', () => ({
  __esModule: true,
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
  maybeCompleteAuthSession: jest.fn(() => {}),
}));
jest.mock('expo-modules-core', () => ({
  __esModule: true,
  NativeModulesProxy: {},
  EventEmitter: function() {},
}));

// Mock expo-location for tests (gracefully if not installed)
try {
  jest.mock('expo-location', () => ({
    __esModule: true,
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
  }));
} catch (e) {
  // ignore
}

// Minimal mock for react-native-paper to avoid hook/type issues in tests
jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const Primitive = ({ children, ...props }) => React.createElement(View, props, children);
  const TextPrimitive = ({ children, ...props }) => React.createElement(Text, props, children);

  const CardComponent = ({ children, ...props }) => React.createElement(View, props, children);
  CardComponent.Content = Primitive;

  return {
    __esModule: true,
    Text: TextPrimitive,
    Card: CardComponent,
    Chip: Primitive,
    Divider: Primitive,
    SegmentedButtons: Primitive,
    Button: Primitive,
  };
});

// Mock NetInfo (offline by default for OfflineBanner tests)
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  addEventListener: (cb) => {
    cb({ isConnected: false, isInternetReachable: false });
    return () => {};
  },
  fetch: jest.fn(async () => ({ isConnected: false, isInternetReachable: false })),
}));

// In live backend tests, make InteractionManager.runAfterInteractions synchronous to avoid teardown warnings
try {
  if (process.env.TEST_LIVE_BACKEND === '1') {
    const RN = require('react-native');
    if (RN && RN.InteractionManager) {
      RN.InteractionManager.runAfterInteractions = (cb) => {
        if (typeof cb === 'function') cb();
        return { cancel: () => {} };
      };
    }
  }
} catch (e) {}

// Mock Supabase only when not running live backend tests
if (process.env.TEST_LIVE_BACKEND !== '1') {
  jest.mock('@/lib/supabase', () => ({
    __esModule: true,
    supabase: {
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      },
      from: jest.fn(() => ({ select: jest.fn().mockResolvedValue({ data: [], error: null }) })),
    },
  }));
  jest.mock('@/services/supabase', () => ({
    __esModule: true,
    supabase: {
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      },
      from: jest.fn(() => ({ select: jest.fn().mockResolvedValue({ data: [], error: null }) })),
    },
  }));
}

// Stub polyfill auto ESM to avoid transform issues
jest.mock('react-native-url-polyfill/auto', () => ({}));

// Mock react-test-renderer to avoid native/renderer coupling in unit tests
jest.mock('react-test-renderer', () => {
  return {
    __esModule: true,
    act: (cb) => (typeof cb === 'function' ? cb() : undefined),
    default: {
      create: () => ({
        toJSON: () => ({}),
        update: () => {},
        unmount: () => {},
      }),
    },
  };
});

// Mock expo-modules-core's requireNativeModule for packages like expo-crypto
jest.mock('expo-modules-core', () => ({
  __esModule: true,
  NativeModulesProxy: {},
  EventEmitter: function() {},
  requireNativeModule: jest.fn(() => ({})),
}));

// Mock expo-crypto to avoid native module calls in tests
jest.mock('expo-crypto', () => ({
  __esModule: true,
  getRandomBytesAsync: jest.fn(async (n) => new Uint8Array(n || 16)),
}));

// Mock ResultCache to avoid undefined .catch() errors in tests
jest.mock('@/features/ai/cache/resultCache', () => ({
  __esModule: true,
  resultCache: {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined)
  }
}), { virtual: true });

// ============================================================================
// 🧪 QUALITY RIBBON TEST MODE INFRASTRUCTURE
// ============================================================================

// Set test mode environment variables
process.env.TEST_MODE = process.env.TEST_MODE || '1';
process.env.TEST_TTL_MS = process.env.TEST_TTL_MS || '5000';
process.env.TEST_PIPELINE_STUB = process.env.TEST_PIPELINE_STUB || '1';
process.env.TEST_SEED_USER_ID = process.env.TEST_SEED_USER_ID || 'test-user-1';
process.env.EXPO_PUBLIC_ENABLE_AI = process.env.EXPO_PUBLIC_ENABLE_AI || 'true';

// Force-enable unified pipeline in test runs (system-mode depends on this)
try {
  const { FEATURE_FLAGS } = require('./constants/featureFlags');
  const originalIsEnabled = FEATURE_FLAGS.isEnabled.bind(FEATURE_FLAGS);
  FEATURE_FLAGS.isEnabled = (flag) => {
    if (flag === 'AI_UNIFIED_PIPELINE') return true;
    return originalIsEnabled(flag);
  };
} catch (e) {
  // If feature flags module path differs in tests, skip override
}

// Import and expose test utilities globally
try {
  const {
    waitForElement,
    seedTestData,
    clearAllTestData,
    mockUnifiedPipelineProcess,
    seedTrackingCompulsions,
    seedCBTRecords,
    seedOCDScenario,
    cleanupSeeds,
    TEST_ENV,
  } = require('./__tests__/fixtures/seedData');

  global.waitForElement = waitForElement;
  global.seedTestData = seedTestData;
  global.clearAllTestData = clearAllTestData;
  global.mockUnifiedPipelineProcess = mockUnifiedPipelineProcess;
  global.seedTrackingCompulsions = seedTrackingCompulsions;
  global.seedCBTRecords = seedCBTRecords;
  global.seedOCDScenario = seedOCDScenario;
  global.cleanupSeeds = cleanupSeeds;
  global.TEST_ENV = TEST_ENV;
} catch (error) {
  // Optional fixtures not present in lean test environments.
}

// Silence noisy React warnings in test output (ErrorBoundary scenarios etc.)
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
