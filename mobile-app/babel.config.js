module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated plugin is injected by babel-preset-expo (do not add it again — duplicate causes TurboModule errors)
  };
};
