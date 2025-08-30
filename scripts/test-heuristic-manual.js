#!/usr/bin/env node

/**
 * Manual Heuristic Test
 * 
 * Heuristik servisi gerçek metinlerle test eder
 */

async function testHeuristic() {
  console.log('🧠 HEURISTIC MANUAL TEST');
  console.log('========================\n');

  // Simulate the service (since we can't import React Native modules in Node)
  const testText1 = "Bugün kendimi çok enerjik hissediyorum ve motivasyonum yüksek";
  const testText2 = "Biraz kaygılı ve stresli hissediyorum";
  const testText3 = "Çok mutlu ve neşeliyim bugün";

  console.log('📝 TEST 1: Enerjik Text');
  console.log(`Input: "${testText1}"`);
  console.log('🔍 Should match patterns:');
  console.log('- "enerjim yüksek" → enerjik pattern (+5 energy)');
  console.log('- "motivasyonum yüksek" → enerjik pattern (+5 energy)');
  console.log('- "çok" → intensity modifier (1.5x)');
  console.log('Expected: mood=8, energy=9, anxiety=4, emotion=enerjik');
  console.log('');

  console.log('📝 TEST 2: Kaygılı Text');  
  console.log(`Input: "${testText2}"`);
  console.log('🔍 Should match patterns:');
  console.log('- "kaygılı" → kaygılı pattern (+4 anxiety)');
  console.log('- "stresli" → kaygılı pattern (+4 anxiety)');
  console.log('- "biraz" → intensity modifier (0.7x)');
  console.log('Expected: mood=3, energy=4, anxiety=7, emotion=kaygılı');
  console.log('');

  console.log('📝 TEST 3: Mutlu Text');
  console.log(`Input: "${testText3}"`);
  console.log('🔍 Should match patterns:');
  console.log('- "çok mutlu" → çok_mutlu pattern (+5 mood)');  
  console.log('- "neşeliyim" → mutlu pattern (+3 mood)');
  console.log('- "çok" → intensity modifier (1.5x)');
  console.log('Expected: mood=9, energy=7, anxiety=3, emotion=çok_mutlu');
  console.log('');

  console.log('🔧 DEBUGGING STEPS:');
  console.log('1. Check if patterns array contains target keywords');
  console.log('2. Verify preprocessText() cleans text properly');
  console.log('3. Check findPatternMatches() finds correct patterns');
  console.log('4. Verify calculateMoodMetrics() applies impacts correctly');
  console.log('5. Test normalizeScore() converts to 1-10 range properly');
  console.log('');

  console.log('🧪 TO TEST IN APP:');
  console.log('1. Use /debug-voice-analysis screen');
  console.log('2. Test with above 3 texts');
  console.log('3. Verify analysis results match expectations');
  console.log('4. Check emotion mapping to primary emotions');
}

testHeuristic().catch(console.error);
