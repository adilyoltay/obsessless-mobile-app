#!/usr/bin/env node

/**
 * Voice Analysis Test Script
 * 
 * Heuristic sistemin "Enerjim yüksek ve motivasyonum iyi. Yapacak çok şey var."
 * metnini doğru analiz edip etmediğini test eder.
 */

const testText = "Enerjim yüksek ve motivasyonum iyi. Yapacak çok şey var.";

console.log('🧪 Voice Analysis Test');
console.log('====================');
console.log('');
console.log('📝 Test Text:', testText);
console.log('');

console.log('🔍 EXPECTED RESULTS:');
console.log('- Mood: 7-8/10 (pozitif)');
console.log('- Energy: 8-9/10 (yüksek enerji)');
console.log('- Anxiety: 4-5/10 (düşük/normal)');  
console.log('- Emotion: enerjik veya kararlı');
console.log('- Confidence: >0.8');
console.log('');

console.log('🔧 ADDED PATTERNS:');
console.log('- "enerjim yüksek" → enerjik pattern (+5 energy)');
console.log('- "motivasyonum iyi" → enerjik pattern (+5 energy)');
console.log('- "yapacak çok şey var" → kararlı pattern (+4 energy)');
console.log('- "çok iyi", "gayet iyi" → mutlu pattern (+3 mood)');
console.log('');

console.log('📱 TO TEST:');
console.log('1. Open /debug-voice-analysis screen');
console.log('2. Paste test text above');  
console.log('3. Click "Analiz Et"');
console.log('4. Verify results match expectations');
console.log('');

console.log('🎯 SUCCESS CRITERIA:');
console.log('- Mood >= 7');
console.log('- Energy >= 8'); 
console.log('- Emotion = "enerjik" or "kararlı"');
console.log('- Confidence >= 0.8');

module.exports = {
  testText,
  expectedResults: {
    moodMin: 7,
    energyMin: 8,
    anxietyMax: 5,
    emotions: ['enerjik', 'kararlı'],
    confidenceMin: 0.8
  }
};
