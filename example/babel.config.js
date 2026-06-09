const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Serialises `'intent'`-directive functions to source strings at compile time (Hermes strips
    // function source at runtime). Referenced by absolute path since expo-intents is a local,
    // un-installed module in this example.
    plugins: [path.resolve(__dirname, '../babel-plugin.js')],
  };
};
