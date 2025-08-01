const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Replit CORS fix
if (process.env.REPL_ID) {
  config.server.port = process.env.PORT || 8081;
  config.server.host = '0.0.0.0';
}

module.exports = config;