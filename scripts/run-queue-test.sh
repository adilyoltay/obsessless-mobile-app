#!/bin/bash

echo "🧪 ======================================"
echo "    QUEUE OVERFLOW TEST BAŞLATIYOR"  
echo "======================================"
echo ""

echo "1️⃣ Uygulamanın açık olduğunu kontrol et..."
echo "   iOS Simulator ya da Android emulator'da uygulama çalışmalı"
echo ""

echo "2️⃣ Metro console'da bu komutları sırayla çalıştır:"
echo ""

echo "⬇️  COPY-PASTE EDİLECEK KOMUTLAR  ⬇️"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'EOF'

// 🔍 Debug komutlarının var olup olmadığını kontrol et
console.log('🔍 Checking debug functions...');
console.log('testQueueStats:', typeof testQueueStats);
console.log('testQueueOverflow:', typeof testQueueOverflow);
console.log('quickQueueCheck:', typeof quickQueueCheck);

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'EOF'

// 📊 İlk queue durumu
console.log('\n📊 === BASELINE TEST ===');
testQueueStats();

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'EOF'

// 🧪 Hafif test (50 item)
console.log('\n🧪 === LIGHT LOAD TEST ===');
testQueueOverflow(50).then(result => {
  console.log('Light test result:', result);
  console.log('Queue check after light test:');
  return quickQueueCheck();
});

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'EOF'

// 💥 Ağır test (overflow'u zorla)
console.log('\n💥 === HEAVY LOAD TEST (FORCE OVERFLOW) ===');
testQueueOverflowHeavy().then(result => {
  console.log('Heavy test result:', result);
  console.log('Final queue stats:');
  return testQueueStats();
}).then(finalStats => {
  console.log('\n🏆 === TEST SUMMARY ===');
  console.log(`Queue utilization: ${finalStats.utilizationPercent}%`);
  console.log(`Overflow count: ${finalStats.overflowCount}`);
  console.log(`Near capacity: ${finalStats.isNearCapacity ? '⚠️ YES' : '✅ No'}`);
  console.log(finalStats.size <= finalStats.maxSize ? '✅ SIZE LIMIT RESPECTED' : '❌ SIZE LIMIT EXCEEDED');
});

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "3️⃣ Test sonuçlarını bekle ve sonuçları paylaş!"
echo ""
echo "🎯 BEKLENİLEN SONUÇLAR:"
echo "   ✅ Queue size ≤ 1000 (MAX_QUEUE_SIZE)"
echo "   ✅ Overflow count > 0 (ağır testte)"
echo "   ✅ Near capacity warning tetiklendi"
echo "   ✅ Priority preservation çalışıyor"
echo ""
