const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Replit CORS fix
if (process.env.REPL_ID) {
  config.server.port = process.env.PORT || 8081;
  config.server.host = '0.0.0.0';
}

// Fix path resolution issues
config.resolver.unstable_enablePackageExports = false;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require'];

// Custom serializer to fix path.relative() undefined issue
config.serializer = {
  ...config.serializer,
  customSerializer: null, // Disable custom serialization that might cause issues
  createModuleIdFactory: function() {
    return function(path) {
      // Ensure path is always a string
      if (typeof path !== 'string') {
        console.warn('⚠️ Non-string path detected:', path);
        return 0;
      }
      // Simple hash-based module ID to avoid path issues
      let hash = 0;
      for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };
  }
};

module.exports = config;