// Expo's default Babel preset. Custom plugins go here once we need them
// (e.g. reanimated/plugin when we adopt react-native-reanimated).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
