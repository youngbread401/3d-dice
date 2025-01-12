const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyLinkNativeLibraries: true
    },
    removeUnusedImports: false,
  }, argv);
  
  // Customize the config before returning it.
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "fs": false,
    "path": false,
    "crypto": false
  };

  return config;
}; 