#!/usr/bin/env node

/**
 * TFLite Model Test Script
 * 
 * Bu script, TFLite modelini test etmek için kullanılır.
 * Terminal'den çalıştırılabilir.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🤖 TFLite Model Test Script Başlatılıyor...\n');

// Test adımları
const steps = [
  {
    name: 'Bağımlılıkları Kontrol Et',
    command: 'npm list react-native-fast-tflite',
    description: 'TFLite paketinin yüklü olduğunu kontrol eder'
  },
  {
    name: 'Model Dosyasını Kontrol Et',
    command: 'ls -la assets/models/big_mood_detector/',
    description: 'Model dosyasının varlığını kontrol eder'
  },
  {
    name: 'iOS Projesini Kontrol Et',
    command: 'ls -la ios/',
    description: 'iOS projesinin oluşturulduğunu kontrol eder'
  },
  {
    name: 'Pod Install Kontrol Et',
    command: 'ls -la ios/Pods/',
    description: 'Pod bağımlılıklarının yüklendiğini kontrol eder'
  }
];

async function runTests() {
  let allPassed = true;

  for (const step of steps) {
    console.log(`📋 ${step.name}...`);
    console.log(`   ${step.description}`);
    
    try {
      const output = execSync(step.command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      console.log('   ✅ Başarılı\n');
      
      // Model dosyası kontrolü için özel mesaj
      if (step.name === 'Model Dosyasını Kontrol Et') {
        if (output.includes('big_mood_detector.tflite')) {
          console.log('   📁 Model dosyası bulundu\n');
        } else {
          console.log('   ⚠️  Model dosyası bulunamadı - placeholder dosya mevcut\n');
        }
      }
      
    } catch (error) {
      console.log('   ❌ Başarısız');
      console.log(`   Hata: ${error.message}\n`);
      allPassed = false;
    }
  }

  // Sonuç
  console.log('📊 Test Sonuçları:');
  if (allPassed) {
    console.log('✅ Tüm kontroller başarılı!');
    console.log('\n🎯 Sonraki Adımlar:');
    console.log('1. Gerçek model dosyasını assets/models/big_mood_detector/big_mood_detector.tflite konumuna yerleştirin');
    console.log('2. Uygulamayı çalıştırın: npx expo run:ios');
    console.log('3. Debug ekranını açın: app/debug-tflite-test.tsx');
    console.log('4. Model testini çalıştırın');
  } else {
    console.log('❌ Bazı kontroller başarısız oldu');
    console.log('\n🔧 Çözüm Önerileri:');
    console.log('1. npm install --legacy-peer-deps komutunu çalıştırın');
    console.log('2. npx expo prebuild -p ios komutunu çalıştırın');
    console.log('3. cd ios && pod install && cd .. komutunu çalıştırın');
  }
}

// Script'i çalıştır
runTests().catch(console.error);
