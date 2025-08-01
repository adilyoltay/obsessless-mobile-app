
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@/ai': './src/ai',
            '@/telemetry': './src/telemetry',
            '@/features': './src/features',
            '@/components': './components',
            '@/constants': './constants',
            '@/hooks': './hooks',
            '@/store': './store',
            '@/types': './types',
            '@/utils': './utils',
            '@/services': './services',
            '@/contexts': './contexts',
            '@/lib': './lib',
            '@/localization': './localization'
          }
        }
      ],
      'react-native-reanimated/plugin'
    ]
  };
};
