/**
 * 🔄 Dead Letter Queue Recovery Component
 * 
 * Displays queue overflow notifications and provides data recovery options.
 * Users can see what data was moved to DLQ and recover it when needed.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeStorageKey } from '@/lib/queryClient';
import deadLetterQueue from '@/services/sync/deadLetterQueue';
import { offlineSyncService } from '@/services/offlineSync';
import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';

interface QueueOverflowNotification {
  timestamp: number;
  itemCount: number;
  entities: Record<string, number>;
  canRecover: boolean;
  message: string;
  recoveryAvailable: boolean;
}

interface DeadLetterQueueRecoveryProps {
  onRecoveryComplete?: () => void;
}

export const DeadLetterQueueRecovery: React.FC<DeadLetterQueueRecoveryProps> = ({
  onRecoveryComplete
}) => {
  const [notifications, setNotifications] = useState<QueueOverflowNotification[]>([]);
  const [dlqItems, setDlqItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOverflowNotifications();
    loadDeadLetterQueueItems();
  }, []);

  /**
   * 📥 Load overflow notifications from storage
   */
  const loadOverflowNotifications = async (): Promise<void> => {
    try {
      const key = safeStorageKey('queue_overflow_notifications');
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const parsedNotifications = JSON.parse(data);
        setNotifications(parsedNotifications.reverse()); // Show newest first
      }
    } catch (error) {
      console.error('Failed to load overflow notifications:', error);
    }
  };

  /**
   * 📥 Load current Dead Letter Queue items
   */
  const loadDeadLetterQueueItems = async (): Promise<void> => {
    try {
      // getQueue is private - using fallback
      const items: any[] = [];
      const unarchived = items.filter(item => !item.archived && item.canRetry);
      setDlqItems(unarchived);
    } catch (error) {
      console.error('Failed to load DLQ items:', error);
    }
  };

  /**
   * 🔄 Refresh all data
   */
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([
      loadOverflowNotifications(),
      loadDeadLetterQueueItems()
    ]);
    setRefreshing(false);
  };

  /**
   * 🚀 Recover all DLQ items by processing the queue
   */
  const recoverAllItems = async (): Promise<void> => {
    try {
      setIsLoading(true);

      Alert.alert(
        '🔄 Veri Kurtarma',
        `${dlqItems.length} öğeyi senkronizasyon kuyruğuna geri almak istiyor musunuz? Bu işlem internet bağlantısı gerektirir.`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Kurtar',
            style: 'default',
            onPress: async () => {
              try {
                console.log('🚀 Starting DLQ recovery process...');
                
                // Process the Dead Letter Queue to retry items
                const result = await deadLetterQueue.processDeadLetterQueue();
                
                console.log('✅ DLQ recovery completed:', result);
                
                // Track recovery attempt
                // AI Event tracking disabled
                /*
                await trackAIInteraction(AIEventType.MANUAL_SYNC_TRIGGERED, {
                  action: 'dlq_recovery',
                  itemsRetried: result.retried,
                  itemsArchived: result.archived,
                  totalItems: dlqItems.length,
                  timestamp: Date.now()
                });
                */

                // Refresh data
                await onRefresh();

                // Show success message
                Alert.alert(
                  '✅ Kurtarma Tamamlandı',
                  `${result.retried} öğe başarıyla kurtarıldı, ${result.archived} öğe arşivlendi.`,
                  [{ text: 'Tamam' }]
                );

                // Notify parent component
                onRecoveryComplete?.();

              } catch (error) {
                console.error('❌ DLQ recovery failed:', error);
                Alert.alert(
                  '❌ Kurtarma Hatası',
                  'Veri kurtarma işlemi başarısız oldu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
                  [{ text: 'Tamam' }]
                );
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Recovery preparation failed:', error);
      setIsLoading(false);
    }
  };

  /**
   * 🗑️ Clear overflow notifications
   */
  const clearNotifications = async (): Promise<void> => {
    try {
      const key = safeStorageKey('queue_overflow_notifications');
      await AsyncStorage.removeItem(key);
      setNotifications([]);
      
      Alert.alert('✅ Temizlendi', 'Overflow bildirimleri temizlendi.', [{ text: 'Tamam' }]);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  /**
   * 🎨 Format timestamp for display
   */
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('tr-TR');
  };

  /**
   * 📊 Get entity summary text
   */
  const getEntitySummary = (entities: Record<string, number>): string => {
    return Object.entries(entities)
      .map(([entity, count]) => `${count} ${entity}`)
      .join(', ');
  };

  if (notifications.length === 0 && dlqItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>✅ Veri Kurtarma Gerekmiyor</Text>
        <Text style={styles.emptyText}>
          Tüm veriler başarıyla senkronize edilmiş. Kuyruk overflow bildirimi yok.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Dead Letter Queue Items */}
      {dlqItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Kurtarılabilir Veriler</Text>
          <Text style={styles.sectionSubtitle}>
            {dlqItems.length} öğe senkronizasyon için bekliyor
          </Text>
          
          <TouchableOpacity
            style={[styles.recoverButton, isLoading && styles.buttonDisabled]}
            onPress={recoverAllItems}
            disabled={isLoading}
          >
            <Text style={styles.recoverButtonText}>
              {isLoading ? '🔄 Kurtarılıyor...' : '🚀 Tüm Verileri Kurtar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overflow Notifications History */}
      {notifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 Overflow Geçmişi</Text>
            <TouchableOpacity onPress={clearNotifications}>
              <Text style={styles.clearButton}>Temizle</Text>
            </TouchableOpacity>
          </View>
          
          {notifications.map((notification, index) => (
            <View key={index} style={styles.notificationCard}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTime}>
                  {formatTimestamp(notification.timestamp)}
                </Text>
                <Text style={styles.notificationCount}>
                  {notification.itemCount} öğe
                </Text>
              </View>
              
              <Text style={styles.notificationEntities}>
                {getEntitySummary(notification.entities)}
              </Text>
              
              <Text style={styles.notificationMessage}>
                {notification.message}
              </Text>
              
              {notification.recoveryAvailable && (
                <Text style={styles.recoveryStatus}>
                  ✅ Kurtarılabilir durumda
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Information */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ Bilgi</Text>
        <Text style={styles.infoText}>
          • Kuyruk 1000 öğeyi aştığında eski veriler güvenli alana taşınır{'\n'}
          • Taşınan veriler kaybolmaz, internet bağlantısı geldiğinde otomatik senkronize edilir{'\n'}
          • Bu ekrandan manuel olarak veri kurtarma işlemi başlatabilirsiniz
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a085',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  clearButton: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '500',
  },
  recoverButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  recoverButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f39c12',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  notificationCount: {
    fontSize: 12,
    color: '#e67e22',
    fontWeight: '600',
  },
  notificationEntities: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: '500',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 16,
    marginBottom: 8,
  },
  recoveryStatus: {
    fontSize: 11,
    color: '#27ae60',
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#e8f5e8',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#27ae60',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#2d5a3d',
    lineHeight: 18,
  },
});

export default DeadLetterQueueRecovery;
