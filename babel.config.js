module.exports = function(api) {
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
          },
        },
      ],
      // TODO: Uncomment after installing react-native-reanimated
      // 'react-native-reanimated/plugin', // Must be last
    ],
  };
};


