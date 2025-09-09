const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Simplified config for build stability
config.resolver.unstable_enablePackageExports = false;

// Local TFLite bundling no longer required (Cloud inference). Keep defaults.

module.exports = config;
