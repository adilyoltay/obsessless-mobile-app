#!/usr/bin/env node

/**
 * Debug Transcript & Emotion Mapping
 * 
 * Voice check-in flow'da neden doğru transcript ve emotion mapping
 * çalışmadığını test eder.
 */

console.log('🔍 VOICE CHECK-IN DEBUG ANALYSIS');
console.log('===============================\n');

// Test cases for transcript analysis
const testCases = [
  {
    input: "Bugün kendimi çok enerjik hissediyorum ve motivasyonum yüksek",
    expected: {
      mood: 7-8,
      energy: 8-9,
      anxiety: 3-4,
      emotion: "enerjik",
      primaryEmotion: "mutlu"
    }
  },
  {
    input: "Biraz kaygılı ve stresli hissediyorum, iş yoğunluğu beni etkiliyor",
    expected: {
      mood: 3-4,
      energy: 4-5,
      anxiety: 7-8,
      emotion: "kaygılı", 
      primaryEmotion: "korkmuş"
    }
  },
  {
    input: "Çok mutlu ve neşeliyim, arkadaşlarımla harika zaman geçirdik",
    expected: {
      mood: 8-9,
      energy: 7-8,
      anxiety: 2-3,
      emotion: "çok_mutlu",
      primaryEmotion: "mutlu"
    }
  }
];

console.log('📝 TEST CASES:');
testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. Input: "${testCase.input}"`);
  console.log(`   Expected Mood: ${testCase.expected.mood}`);
  console.log(`   Expected Energy: ${testCase.expected.energy}`);
  console.log(`   Expected Anxiety: ${testCase.expected.anxiety}`);
  console.log(`   Expected Emotion: ${testCase.expected.emotion}`);
  console.log(`   Expected Primary: ${testCase.expected.primaryEmotion}`);
});

console.log('\n🔧 DEBUGGING CHECKLIST:');
console.log('1. ✅ Speech-to-Text: Alert.prompt ile user input alıyor mu?');
console.log('2. ✅ Heuristic Analysis: Pattern matching doğru çalışıyor mu?');
console.log('3. ✅ Emotion Mapping: Heuristic emotion → Primary emotion mapping');
console.log('4. ✅ Mood Score Conversion: 1-10 → 0-100 range conversion');
console.log('5. ✅ Parameter Passing: router.push params doğru geçiyor mu?');
console.log('6. ✅ MoodQuickEntry: initialData.emotion set ediliyor mu?');

console.log('\n🧪 MANUAL TEST STEPS:');
console.log('1. Today page → Check-in Yap');
console.log('2. 5+ saniye ses kaydet');
console.log('3. Alert popup'ta gerçek metni gir');
console.log('4. Mood page açılmasını bekle');
console.log('5. Kontrol et:');
console.log('   - Notes field'da clean transcript var mı?');
console.log('   - Emotion wheel'da doğru emotion seçili mi?');
console.log('   - Slider'lar doğru pozisyonda mı?');
console.log('   - Trigger doğru seçili mi?');

console.log('\n🎯 SUCCESS CRITERIA:');
console.log('- Real transcript in notes (no prefix)');
console.log('- Correct emotion selected in wheel');
console.log('- Accurate mood/energy/anxiety sliders');  
console.log('- Proper trigger mapping');

module.exports = { testCases };
