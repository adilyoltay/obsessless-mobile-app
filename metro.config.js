const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Simplified config for build stability
config.resolver.unstable_enablePackageExports = false;

module.exports = config;