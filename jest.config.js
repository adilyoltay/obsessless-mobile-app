module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native' +
      '|@react-native' +
      '|react-native-reanimated' +
      '|@react-native-async-storage' +
      '|expo' +
      '|expo-.*' +
      '|@expo' +
      '|@expo/.*' +
      '|@expo/vector-icons' +
      '|expo-modules-core' +
      '|@react-native-community/netinfo' +
      ')/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};


