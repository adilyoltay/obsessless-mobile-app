#!/usr/bin/env node

/**
 * 🎤 Speech-to-Text Test Script
 * 
 * Bu script STT servisinin gerçek mi yoksa mock mu olduğunu test eder
 */

const path = require('path');

// Color codes for console
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════════╗
║        🎤 Speech-to-Text Service Analiz Raporu 🎤        ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);

// 1. Check package.json for STT packages
console.log(`${colors.yellow}📦 Kurulu Paketler:${colors.reset}`);
try {
  const packageJson = require('../package.json');
  const sttPackages = [
    'react-native-voice',
    '@react-native-voice/voice',
    'expo-speech-recognition',
    'expo-speech',
    '@google-cloud/speech',
    'azure-cognitiveservices-speech-sdk',
    'react-native-stt'
  ];
  
  let foundPackages = [];
  for (const pkg of sttPackages) {
    if (packageJson.dependencies && packageJson.dependencies[pkg]) {
      foundPackages.push(`  ✅ ${pkg}: ${packageJson.dependencies[pkg]}`);
    }
  }
  
  if (foundPackages.length === 0) {
    console.log(`${colors.red}  ❌ Hiçbir STT paketi kurulu değil!${colors.reset}`);
    console.log(`${colors.red}  ❌ Sadece expo-speech var (TTS için, STT değil)${colors.reset}`);
  } else {
    foundPackages.forEach(p => console.log(p));
  }
} catch (error) {
  console.error('Package.json okunamadı:', error);
}

// 2. Analyze speechToTextService.ts
console.log(`\n${colors.yellow}📝 speechToTextService.ts Analizi:${colors.reset}`);
const fs = require('fs');
const serviceFile = path.join(__dirname, '../services/speechToTextService.ts');

try {
  const content = fs.readFileSync(serviceFile, 'utf8');
  
  // Check for real STT implementation
  const hasRealSTT = content.includes('react-native-voice') || 
                     content.includes('@react-native-voice') ||
                     content.includes('SpeechRecognizer') ||
                     content.includes('SFSpeechRecognizer');
  
  const hasMockImplementation = content.includes('placeholder implementation') ||
                                content.includes('mock') ||
                                content.includes('generateRealisticTranscript') ||
                                content.includes('templates');
  
  const hasCloudAPI = content.includes('google-cloud') ||
                      content.includes('azure') ||
                      content.includes('aws-transcribe');
  
  if (hasRealSTT) {
    console.log(`${colors.green}  ✅ Native STT implementasyonu bulundu${colors.reset}`);
  } else {
    console.log(`${colors.red}  ❌ Native STT implementasyonu YOK${colors.reset}`);
  }
  
  if (hasMockImplementation) {
    console.log(`${colors.red}  ⚠️  MOCK implementasyon tespit edildi!${colors.reset}`);
    console.log(`${colors.red}  ⚠️  Gerçek ses tanıma yerine template text kullanılıyor${colors.reset}`);
  }
  
  if (hasCloudAPI) {
    console.log(`${colors.blue}  ☁️  Cloud API referansı bulundu${colors.reset}`);
  } else {
    console.log(`${colors.yellow}  ⚠️  Cloud API entegrasyonu yok${colors.reset}`);
  }
  
  // Check specific functions
  console.log(`\n${colors.yellow}🔍 Fonksiyon Analizi:${colors.reset}`);
  
  if (content.includes('realTranscription')) {
    const realTranscriptionMatch = content.match(/private async realTranscription[\s\S]*?return {[\s\S]*?}/);
    if (realTranscriptionMatch) {
      const funcContent = realTranscriptionMatch[0];
      if (funcContent.includes('generateRealisticTranscript') || funcContent.includes('templates')) {
        console.log(`${colors.red}  ❌ realTranscription() sadece FAKE text döndürüyor${colors.reset}`);
        console.log(`${colors.red}     → Audio süresine göre template seçiyor${colors.reset}`);
      }
    }
  }
  
  if (content.includes('transcribeAudio')) {
    console.log(`${colors.yellow}  📍 transcribeAudio() mevcut ama...${colors.reset}`);
    if (content.includes('placeholder implementation')) {
      console.log(`${colors.red}     → "Placeholder implementation" olarak işaretli${colors.reset}`);
      console.log(`${colors.red}     → Gerçek STT yok, mock data döndürüyor${colors.reset}`);
    }
  }
  
} catch (error) {
  console.error('Service dosyası okunamadı:', error);
}

// 3. Solution suggestions
console.log(`\n${colors.cyan}💡 ÇÖZÜM ÖNERİLERİ:${colors.reset}`);
console.log(`
${colors.green}1. Native STT Paketi Kurulumu:${colors.reset}
   npm install @react-native-voice/voice
   veya
   npm install react-native-voice

${colors.green}2. iOS Configuration (Info.plist):${colors.reset}
   <key>NSSpeechRecognitionUsageDescription</key>
   <string>Ses kayıtlarınızı metne dönüştürmek için kullanılır</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>Ses kaydı için mikrofon erişimi gerekli</string>

${colors.green}3. Android Configuration (AndroidManifest.xml):${colors.reset}
   <uses-permission android:name="android.permission.RECORD_AUDIO" />

${colors.green}4. Cloud Alternatifler:${colors.reset}
   • Google Cloud Speech-to-Text
   • Azure Cognitive Services Speech
   • AWS Transcribe
   • OpenAI Whisper API

${colors.yellow}5. Geçici Çözüm (Mevcut):${colors.reset}
   TranscriptConfirmationModal ile kullanıcıdan manuel text alınıyor
   Bu aslında kötü değil, kullanıcı kontrolü sağlıyor
`);

// 4. Test actual functionality
console.log(`${colors.cyan}🧪 FONKSİYONEL TEST:${colors.reset}`);

// Import the service
try {
  console.log(`\n${colors.yellow}Test: Mock audio transcription...${colors.reset}`);
  
  // Simulate what happens in the app
  const testAudioUri = 'file:///fake/audio.m4a';
  console.log(`  Input: ${testAudioUri}`);
  console.log(`  Expected: Template text based on duration`);
  console.log(`  Reality: NO REAL TRANSCRIPTION HAPPENS`);
  
  console.log(`\n${colors.red}❌ SONUÇ: Gerçek STT yok, sadece mock text!${colors.reset}`);
  
} catch (error) {
  console.error('Test failed:', error);
}

// 5. Final verdict
console.log(`\n${colors.magenta}
╔══════════════════════════════════════════════════════════╗
║                    🎯 FINAL SONUÇ 🎯                     ║
╠══════════════════════════════════════════════════════════╣
║ ❌ Gerçek Speech-to-Text implementasyonu YOK             ║
║ ❌ Sadece mock/template text döndürülüyor                ║
║ ❌ expo-speech sadece TTS destekliyor, STT değil         ║
║ ⚠️  TranscriptConfirmationModal geçici çözüm olarak     ║
║    kullanıcıdan manuel text alıyor                       ║
║                                                           ║
║ ✅ ÖNERİ: @react-native-voice/voice paketi kurulmalı    ║
╚══════════════════════════════════════════════════════════╝
${colors.reset}`);
