
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
            '@': './',
          },
        },
      ],
      // Reanimated plugin sadece native platformlarda
      ...(process.env.EXPO_OS !== 'web' ? ['react-native-reanimated/plugin'] : []),
    ],
  };
};
