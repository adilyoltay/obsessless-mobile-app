const config = require('./app.config.ts');
console.log('Gemini Config:');
console.log('  Provider:', config.extra?.EXPO_PUBLIC_AI_PROVIDER || 'NOT SET');
console.log('  Has API Key:', !!config.extra?.EXPO_PUBLIC_GEMINI_API_KEY);
console.log('  Model:', config.extra?.EXPO_PUBLIC_GEMINI_MODEL || 'NOT SET');
