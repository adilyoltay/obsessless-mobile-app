import AsyncStorage from '@react-native-async-storage/async-storage';

export const TestValidator = {
  // Senaryo 1: Yeni Kullanıcı Validasyonu
  async validateNewUser(userId: string) {
    console.log('🧪 Validating New User Scenario...');
    
    const results = {
      profile: false,
      compulsion: false,
      gamification: false,
      firstBadge: false,
      healingPoints: false
    };
    
    try {
      // 1. Profile kontrolü
      const profile = await AsyncStorage.getItem(`ocd_profile_${userId}`);
      if (profile) {
        const parsed = JSON.parse(profile);
        results.profile = parsed.selectedSymptoms?.includes('cleaning') && 
                         parsed.selectedSymptoms?.includes('checking');
        console.log('✅ Profile:', results.profile ? 'Valid' : 'Invalid');
      }
      
      // 2. Kompulsiyon kaydı kontrolü
      const compulsions = await AsyncStorage.getItem(`compulsions_${userId}`);
      if (compulsions) {
        const parsed = JSON.parse(compulsions);
        results.compulsion = parsed.length > 0 && 
                            parsed[0].type === 'cleaning' &&
                            parsed[0].resistanceLevel === 7;
        console.log('✅ First Compulsion:', results.compulsion ? 'Valid' : 'Invalid');
      }
      
      // 3. Gamification profili kontrolü
      const gamification = await AsyncStorage.getItem(`gamification_${userId}`);
      if (gamification) {
        const parsed = JSON.parse(gamification);
        results.gamification = parsed.healingPointsTotal >= 20;
        results.healingPoints = parsed.healingPointsToday >= 5;
        results.firstBadge = parsed.unlockedAchievements?.includes('first_compulsion');
        
        console.log('✅ Gamification Profile:', results.gamification ? 'Valid' : 'Invalid');
        console.log('✅ Healing Points:', parsed.healingPointsTotal);
        console.log('✅ First Badge:', results.firstBadge ? 'Earned' : 'Not earned');
      }
      
      // Özet
      const allPassed = Object.values(results).every(v => v === true);
      console.log('\n📊 Senaryo 1 Sonucu:', allPassed ? '✅ BAŞARILI' : '❌ BAŞARISIZ');
      console.log('Detaylar:', results);
      
      return results;
    } catch (error) {
      console.error('❌ Validation error:', error);
      return results;
    }
  },
  
  // Senaryo 2: Günlük Rutin Validasyonu
  async validateDailyRoutine(userId: string) {
    console.log('🧪 Validating Daily Routine Scenario...');
    
    const today = new Date().toDateString();
    
    try {
      // Kompulsiyonları kontrol et
      const compulsions = await AsyncStorage.getItem(`compulsions_${userId}`);
      const todayCompulsions = compulsions ? 
        JSON.parse(compulsions).filter((c: any) => 
          new Date(c.timestamp).toDateString() === today
        ) : [];
      
      // Terapi oturumlarını kontrol et
      const erpSessions = await AsyncStorage.getItem(`therapy_sessions_${userId}_${today}`);
      const todayTerapi = erpSessions ? JSON.parse(erpSessions) : [];
      
      // Ortalama direnç hesapla
      const avgResistance = todayCompulsions.length > 0 ?
        todayCompulsions.reduce((sum: number, c: any) => sum + c.resistanceLevel, 0) / todayCompulsions.length :
        0;
      
      console.log('📊 Günlük Özet:');
      console.log(`- Kompulsiyon Sayısı: ${todayCompulsions.length}`);
      console.log(`- Terapi Oturumu Sayısı: ${todayTerapi.length}`);
      console.log(`- Ortalama Direnç: ${avgResistance.toFixed(1)}/10`);
      
      // Günlük hedef kontrolü
      const dailyGoalMet = todayCompulsions.length >= 3;
      console.log(`- Günlük Hedef: ${dailyGoalMet ? '✅ Tamamlandı' : '❌ Tamamlanmadı'}`);
      
      return {
        compulsionCount: todayCompulsions.length,
        erpCount: todayTerapi.length,
        avgResistance,
        dailyGoalMet
      };
    } catch (error) {
      console.error('❌ Daily routine validation error:', error);
      return null;
    }
  },
  
  // Senaryo 3: Çoklu Kullanıcı İzolasyonu
  async validateMultiUser(userIds: string[]) {
    console.log('🧪 Validating Multi-User Isolation...');
    
    const userData: Record<string, any> = {};
    
    for (const userId of userIds) {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.includes(userId));
      
      userData[userId] = {
        keyCount: userKeys.length,
        compulsions: 0,
        erpSessions: 0,
        settings: null
      };
      
      // Kompulsiyon sayısı
      const compulsions = await AsyncStorage.getItem(`compulsions_${userId}`);
      if (compulsions) {
        userData[userId].compulsions = JSON.parse(compulsions).length;
      }
      
      // Ayarlar kontrolü
      const settings = await AsyncStorage.getItem(`settings_${userId}`);
      if (settings) {
        userData[userId].settings = JSON.parse(settings);
      }
    }
    
    console.log('📊 Kullanıcı Verileri:');
    Object.entries(userData).forEach(([userId, data]) => {
      console.log(`\n👤 ${userId}:`);
      console.log(`  - Toplam Key: ${data.keyCount}`);
      console.log(`  - Kompulsiyon: ${data.compulsions}`);
      console.log(`  - Ayarlar: ${data.settings ? JSON.stringify(data.settings) : 'Yok'}`);
    });
    
    // İzolasyon kontrolü
    const isolated = userIds.every((userId, index) => {
      return userIds.every((otherId, otherIndex) => {
        if (index === otherIndex) return true;
        return !userData[userId].keyCount || !userData[otherId].keyCount ||
               userData[userId].keyCount !== userData[otherId].keyCount;
      });
    });
    
    console.log(`\n🔒 Veri İzolasyonu: ${isolated ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);
    
    return { userData, isolated };
  },
  
  // Performans Testi
  async validatePerformance() {
    console.log('🧪 Running Performance Tests...');
    
    const metrics = {
      storageWrite: 0,
      storageRead: 0,
      listRender: 0,
      navigation: 0
    };
    
    // Storage yazma testi
    const writeStart = Date.now();
    const testData = Array(50).fill(null).map((_, i) => ({
      id: `perf_${i}`,
      type: 'test',
      resistanceLevel: Math.floor(Math.random() * 10) + 1
    }));
    
    await AsyncStorage.setItem('perf_test', JSON.stringify(testData));
    metrics.storageWrite = Date.now() - writeStart;
    
    // Storage okuma testi
    const readStart = Date.now();
    await AsyncStorage.getItem('perf_test');
    metrics.storageRead = Date.now() - readStart;
    
    // Temizlik
    await AsyncStorage.removeItem('perf_test');
    
    console.log('📊 Performans Metrikleri:');
    console.log(`- Storage Yazma: ${metrics.storageWrite}ms ${metrics.storageWrite < 500 ? '✅' : '⚠️'}`);
    console.log(`- Storage Okuma: ${metrics.storageRead}ms ${metrics.storageRead < 100 ? '✅' : '⚠️'}`);
    
    return metrics;
  },
  
  // Master test suite
  async runAllValidations(userId?: string) {
    console.log('🚀 ObsessLess Test Validation Suite\n');
    console.log('=' .repeat(50));
    
    if (userId) {
      // Senaryo 1
      await this.validateNewUser(userId);
      console.log('\n' + '-'.repeat(50) + '\n');
      
      // Senaryo 2
      await this.validateDailyRoutine(userId);
      console.log('\n' + '-'.repeat(50) + '\n');
    }
    
    // Performans
    await this.validatePerformance();
    console.log('\n' + '='.repeat(50));
    
    console.log('\n✅ Tüm testler tamamlandı!');
  }
};

// Export for console access
if (__DEV__) {
  (global as any).TestValidator = TestValidator;
} 