/* eslint-env jest */
// Basic Jest setup for React Native + Expo environment

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

// Mock expo virtual env (ESM) used by expo packages
jest.mock('expo/virtual/env', () => ({
  __esModule: true,
  env: {},
}));

// Mock @expo/vector-icons to avoid ESM issues in tests
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  MaterialCommunityIcons: (props) => null,
}));

// Mock expo-router used in navigation
jest.mock('expo-router', () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn() },
  useSegments: () => [],
}));

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

// Mock expo-location for tests
jest.mock('expo-location', () => ({
  __esModule: true,
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 0, longitude: 0 } })),
}));

// Silence React Native console warnings in tests
jest.spyOn(global.console, 'warn').mockImplementation(() => {});
jest.spyOn(global.console, 'error').mockImplementation(() => {});


