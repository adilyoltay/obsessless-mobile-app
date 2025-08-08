
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
            '@/assets': './assets',
            '@/components': './components',
            '@/constants': './constants',
            '@/hooks': './hooks',
            '@/store': './store',
            '@/types': './types',
            '@/utils': './utils',
            '@/services': './services',
            '@/contexts': './contexts',
            '@/lib': './lib',
            '@/localization': './localization',
            '@/features': './features'
          }
        }
      ],
      'react-native-reanimated/plugin'
    ]
  };
};
