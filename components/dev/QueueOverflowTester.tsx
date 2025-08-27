import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { offlineSyncService } from '@/services/offlineSync';

/**
 * 🧪 Queue Overflow Test Component
 * 
 * Tests the MAX_QUEUE_SIZE overflow mechanism by:
 * 1. Showing current queue stats
 * 2. Adding synthetic items to trigger overflow
 * 3. Verifying overflow handling works correctly
 * 
 * Usage: Add to dev screens or access via debug overlay
 */
export default function QueueOverflowTester() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addTestResult = (result: any) => {
    setTestResults(prev => [...prev, { 
      ...result, 
      timestamp: new Date().toISOString(),
      id: Date.now() 
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // 📊 Check current queue health
  const checkQueueStats = async () => {
    try {
      const stats = offlineSyncService.getQueueStats();
      addTestResult({
        type: 'QUEUE_STATS',
        status: 'INFO', 
        data: stats,
        message: `Queue: ${stats.size}/${stats.maxSize} (${stats.utilizationPercent}%)`
      });
    } catch (error) {
      addTestResult({
        type: 'QUEUE_STATS',
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // 🚨 Test overflow mechanism with synthetic data
  const testOverflow = async (itemCount: number = 50) => {
    setIsRunning(true);
    try {
      addTestResult({
        type: 'OVERFLOW_TEST_START',
        status: 'INFO',
        message: `Adding ${itemCount} synthetic items to test overflow...`
      });

      // Get initial stats
      const initialStats = offlineSyncService.getQueueStats();
      
      // Add synthetic test items with different priorities
      const promises = Array.from({ length: itemCount }, async (_, i) => {
        const priority = i < 10 ? 'critical' : i < 25 ? 'high' : 'normal';
        const item = {
          type: 'CREATE' as const,
          entity: 'mood_entry' as const,
          data: {
            user_id: 'test-user-overflow',
            mood_score: Math.floor(Math.random() * 100),
            energy_level: Math.floor(Math.random() * 10),
            anxiety_level: Math.floor(Math.random() * 10),
            notes: `Test overflow item #${i}`,
            test_marker: 'OVERFLOW_TEST'
          },
          priority: priority as any
        };
        
        try {
          await offlineSyncService.addToSyncQueue(item);
          return { success: true, index: i };
        } catch (error) {
          return { success: false, index: i, error };
        }
      });

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      // Get final stats
      const finalStats = offlineSyncService.getQueueStats();

      addTestResult({
        type: 'OVERFLOW_TEST_COMPLETE',
        status: successful > 0 ? 'SUCCESS' : 'ERROR',
        data: {
          initialSize: initialStats.size,
          finalSize: finalStats.size,
          itemsAdded: successful,
          itemsFailed: failed,
          overflowTriggered: finalStats.overflowCount > initialStats.overflowCount,
          overflowCount: finalStats.overflowCount,
          priorityCounts: finalStats.priorityCounts
        },
        message: `Added ${successful}/${itemCount} items. Queue: ${initialStats.size} → ${finalStats.size}. Overflows: ${finalStats.overflowCount}`
      });

    } catch (error) {
      addTestResult({
        type: 'OVERFLOW_TEST_ERROR',
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsRunning(false);
    }
  };

  // 🧹 Clean test data from queue
  const cleanTestData = async () => {
    try {
      addTestResult({
        type: 'CLEANUP',
        status: 'INFO',
        message: 'Note: Test data cleanup requires manual implementation or app restart'
      });
    } catch (error) {
      addTestResult({
        type: 'CLEANUP_ERROR',
        status: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '#10B981';
      case 'ERROR': return '#EF4444';  
      case 'WARNING': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Queue Overflow Tester</Text>
      
      <View style={styles.controls}>
        <Pressable
          style={[styles.button, { backgroundColor: '#3B82F6' }]}
          onPress={checkQueueStats}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>📊 Check Stats</Text>
        </Pressable>
        
        <Pressable
          style={[styles.button, { backgroundColor: '#DC2626' }]}
          onPress={() => testOverflow(50)}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>🚨 Test Overflow (50)</Text>
        </Pressable>
        
        <Pressable
          style={[styles.button, { backgroundColor: '#059669' }]}
          onPress={() => testOverflow(150)}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>💥 Heavy Test (150)</Text>
        </Pressable>
        
        <Pressable
          style={[styles.button, { backgroundColor: '#6B7280' }]}
          onPress={clearResults}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>🧹 Clear</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.results}>
        {testResults.length === 0 && (
          <Text style={styles.placeholder}>Press buttons above to run tests</Text>
        )}
        
        {testResults.slice().reverse().map((result) => (
          <View key={result.id} style={styles.resultItem}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultType, { color: getStatusColor(result.status) }]}>
                {result.type}
              </Text>
              <Text style={styles.resultTime}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            
            {result.message && (
              <Text style={styles.resultMessage}>{result.message}</Text>
            )}
            
            {result.data && (
              <Text style={styles.resultData}>
                {JSON.stringify(result.data, null, 2)}
              </Text>
            )}
            
            {result.error && (
              <Text style={styles.resultError}>❌ {result.error}</Text>
            )}
          </View>
        ))}
      </ScrollView>
      
      {isRunning && (
        <View style={styles.loading}>
          <Text style={styles.loadingText}>⏳ Running test...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    minWidth: 100,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
  results: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 12,
  },
  placeholder: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  resultItem: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultType: {
    fontWeight: '600',
    fontSize: 12,
  },
  resultTime: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  resultMessage: {
    color: '#E5E7EB',
    fontSize: 12,
    marginBottom: 4,
  },
  resultData: {
    color: '#10B981',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#1F2937',
    padding: 8,
    borderRadius: 4,
  },
  resultError: {
    color: '#FCA5A5',
    fontSize: 12,
    backgroundColor: '#7F1D1D',
    padding: 6,
    borderRadius: 4,
  },
  loading: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
});
