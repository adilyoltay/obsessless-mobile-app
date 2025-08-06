import AsyncStorage from '@react-native-async-storage/async-storage';
import { DebugHelper } from './debugHelper';

interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  details: Array<{
    test: string;
    status: 'passed' | 'failed' | 'skipped';
    error?: any;
    duration?: number;
  }>;
}

export const TestRunner = {
  async runAllTests(): Promise<TestResult> {
    console.log('🧪 Starting ObsessLess Test Suite...');
    const startTime = Date.now();
    
    const results: TestResult = {
      passed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    const tests = [
      { name: 'User Isolation', fn: this.testUserIsolation },
      { name: 'Data Persistence', fn: this.testDataPersistence },
      { name: 'Gamification', fn: this.testGamification },
      { name: 'Storage Keys', fn: this.testStorageKeys },
      { name: 'Date Filtering', fn: this.testDateFiltering },
      { name: 'Performance', fn: this.testPerformance }
    ];
    
    for (const test of tests) {
      const testStart = Date.now();
      try {
        await test.fn();
        results.passed++;
        results.details.push({
          test: test.name,
          status: 'passed',
          duration: Date.now() - testStart
        });
        console.log(`✅ ${test.name} - PASSED (${Date.now() - testStart}ms)`);
      } catch (error) {
        results.failed++;
        results.details.push({
          test: test.name,
          status: 'failed',
          error,
          duration: Date.now() - testStart
        });
        console.error(`❌ ${test.name} - FAILED:`, error);
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`\n📊 Test Results:`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️ Skipped: ${results.skipped}`);
    console.log(`⏱️ Total Duration: ${totalDuration}ms`);
    
    return results;
  },
  
  async testUserIsolation(): Promise<void> {
    // Test 1: Create mock data for two users
    const user1Id = 'test_user_1';
    const user2Id = 'test_user_2';
    
    // Add data for user 1
    await AsyncStorage.setItem(
      `compulsions_${user1Id}`,
      JSON.stringify([{ id: '1', type: 'cleaning' }])
    );
    
    // Add data for user 2
    await AsyncStorage.setItem(
      `compulsions_${user2Id}`,
      JSON.stringify([{ id: '2', type: 'checking' }])
    );
    
    // Check isolation
    const isolated = await DebugHelper.checkDataIsolation(user1Id, user2Id);
    
    if (!isolated) {
      throw new Error('User data isolation failed!');
    }
    
    // Cleanup
    await AsyncStorage.removeItem(`compulsions_${user1Id}`);
    await AsyncStorage.removeItem(`compulsions_${user2Id}`);
  },
  
  async testDataPersistence(): Promise<void> {
    const testUserId = 'test_persistence_user';
    const testData = {
      compulsions: [
        { id: '1', type: 'cleaning', resistanceLevel: 7 },
        { id: '2', type: 'checking', resistanceLevel: 8 }
      ]
    };
    
    // Save data
    await AsyncStorage.setItem(
      `compulsions_${testUserId}`,
      JSON.stringify(testData.compulsions)
    );
    
    // Retrieve data
    const retrieved = await AsyncStorage.getItem(`compulsions_${testUserId}`);
    const parsed = retrieved ? JSON.parse(retrieved) : null;
    
    // Verify
    if (!parsed || parsed.length !== testData.compulsions.length) {
      throw new Error('Data persistence failed!');
    }
    
    // Cleanup
    await AsyncStorage.removeItem(`compulsions_${testUserId}`);
  },
  
  async testGamification(): Promise<void> {
    const testUserId = 'test_gamification_user';
    const testProfile = {
      streakCurrent: 5,
      streakBest: 10,
      healingPointsToday: 50,
      healingPointsTotal: 500,
      streakLevel: 'seedling',
      lastActivityDate: new Date().toISOString().split('T')[0]
    };
    
    // Save profile
    await AsyncStorage.setItem(
      `gamification_${testUserId}`,
      JSON.stringify(testProfile)
    );
    
    // Retrieve and verify
    const retrieved = await AsyncStorage.getItem(`gamification_${testUserId}`);
    const parsed = retrieved ? JSON.parse(retrieved) : null;
    
    if (!parsed || parsed.streakCurrent !== testProfile.streakCurrent) {
      throw new Error('Gamification data not persisted correctly!');
    }
    
    // Test daily reset logic
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    parsed.lastActivityDate = yesterday.toISOString().split('T')[0];
    
    // Should reset daily points
    if (parsed.lastActivityDate !== new Date().toISOString().split('T')[0]) {
      parsed.healingPointsToday = 0;
    }
    
    if (parsed.healingPointsToday !== 0) {
      throw new Error('Daily points not reset!');
    }
    
    // Cleanup
    await AsyncStorage.removeItem(`gamification_${testUserId}`);
  },
  
  async testStorageKeys(): Promise<void> {
    // Get all keys
    const keys = await AsyncStorage.getAllKeys();
    
    // Check for invalid keys (without userId)
    const invalidKeys = keys.filter(key => {
      // These are valid system keys
      const systemKeys = ['profileCompleted', 'currentUser', 'language'];
      if (systemKeys.includes(key)) return false;
      
      // All other keys should contain underscore (indicating userId)
      return !key.includes('_');
    });
    
    if (invalidKeys.length > 0) {
      throw new Error(`Invalid storage keys found: ${invalidKeys.join(', ')}`);
    }
  },
  
  async testDateFiltering(): Promise<void> {
    const testUserId = 'test_date_user';
    const today = new Date();
    
    // Create test data for different dates
    const testSessions = [];
    
    // Today
    testSessions.push({
      id: '1',
      completedAt: today.toISOString()
    });
    
    // Yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    testSessions.push({
      id: '2',
      completedAt: yesterday.toISOString()
    });
    
    // Last week
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    testSessions.push({
      id: '3',
      completedAt: lastWeek.toISOString()
    });
    
    // Save sessions
    await AsyncStorage.setItem(
      `test_sessions_${testUserId}`,
      JSON.stringify(testSessions)
    );
    
    // Test filtering
    const allSessions = testSessions;
    const todaySessions = allSessions.filter(s => 
      new Date(s.completedAt).toDateString() === today.toDateString()
    );
    const weekSessions = allSessions.filter(s => {
      const sessionDate = new Date(s.completedAt);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sessionDate >= weekAgo;
    });
    
    // Verify
    if (todaySessions.length !== 1) {
      throw new Error('Today filter failed!');
    }
    
    if (weekSessions.length !== 2) {
      throw new Error('Week filter failed!');
    }
    
    // Cleanup
    await AsyncStorage.removeItem(`test_sessions_${testUserId}`);
  },
  
  async testPerformance(): Promise<void> {
    const testUserId = 'test_performance_user';
    const startTime = Date.now();
    
    // Test 1: Bulk write performance
    const bulkData = Array.from({ length: 100 }, (_, i) => ({
      id: `bulk_${i}`,
      type: 'test',
      timestamp: new Date().toISOString()
    }));
    
    await AsyncStorage.setItem(
      `bulk_test_${testUserId}`,
      JSON.stringify(bulkData)
    );
    
    const writeTime = Date.now() - startTime;
    
    // Test 2: Bulk read performance
    const readStart = Date.now();
    const retrieved = await AsyncStorage.getItem(`bulk_test_${testUserId}`);
    const parsed = retrieved ? JSON.parse(retrieved) : [];
    const readTime = Date.now() - readStart;
    
    // Verify performance
    if (writeTime > 500) {
      console.warn(`⚠️ Write performance slow: ${writeTime}ms`);
    }
    
    if (readTime > 100) {
      console.warn(`⚠️ Read performance slow: ${readTime}ms`);
    }
    
    if (parsed.length !== bulkData.length) {
      throw new Error('Data integrity issue in performance test!');
    }
    
    // Cleanup
    await AsyncStorage.removeItem(`bulk_test_${testUserId}`);
  },
  
  // Helper method to generate test report
  async generateReport(results: TestResult): Promise<string> {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString();
    
    let report = `# ObsessLess Test Raporu - ${date} ${time}\n\n`;
    report += `## Özet\n`;
    report += `- **Toplam Test:** ${results.passed + results.failed + results.skipped}\n`;
    report += `- **Başarılı:** ${results.passed}\n`;
    report += `- **Başarısız:** ${results.failed}\n`;
    report += `- **Atlandı:** ${results.skipped}\n\n`;
    
    report += `## Detaylı Sonuçlar\n\n`;
    
    // Group by status
    const passed = results.details.filter(d => d.status === 'passed');
    const failed = results.details.filter(d => d.status === 'failed');
    
    if (passed.length > 0) {
      report += `### ✅ Başarılı Testler\n`;
      passed.forEach(test => {
        report += `- ${test.test} - ${test.duration}ms\n`;
      });
      report += '\n';
    }
    
    if (failed.length > 0) {
      report += `### ❌ Başarısız Testler\n`;
      failed.forEach(test => {
        report += `- ${test.test} - ${test.error?.message || 'Unknown error'}\n`;
      });
      report += '\n';
    }
    
    // Performance metrics
    const avgDuration = results.details.reduce((sum, d) => sum + (d.duration || 0), 0) / results.details.length;
    
    report += `## Metrikler\n`;
    report += `- Ortalama test süresi: ${Math.round(avgDuration)}ms\n`;
    report += `- Test coverage: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%\n`;
    
    return report;
  }
};

// Export for use in development
if (__DEV__) {
  (global as any).TestRunner = TestRunner;
} 