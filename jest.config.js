module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native'
      + '|@react-native'
      + '|react-native-reanimated'
      + '|@react-native-async-storage'
      + '|expo'
      + '|expo-.*'
      + '|@expo'
      + '|@expo/.*'
      + '|@expo/vector-icons'
      + '|expo-modules-core'
      + ')/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'features/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  }
};


