/**
 * 🔔 Sync Status Notification Component
 * 
 * Displays queue overflow warnings, encryption failures, and other
 * sync-related notifications to keep users informed about data status.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeTrackAIInteraction, AIEventType } from '@/services/telemetry/noopTelemetry';

interface SyncNotification {
  type: 'queue_overflow_risk' | 'encryption_failure' | 'security_alert';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  actionRequired: boolean;
  droppedItemCount?: number;
  requiresAppRestart?: boolean;
}

export function SyncStatusNotification() {
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    checkForNotifications();
    
    // Check for new notifications every 30 seconds
    const interval = setInterval(checkForNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkForNotifications = async () => {
    try {
      const activeNotifications: SyncNotification[] = [];

      // Check for queue overflow notifications
      const overflowNotif = await AsyncStorage.getItem('sync_risk_notification');
      if (overflowNotif) {
        try {
          const parsed = JSON.parse(overflowNotif);
          activeNotifications.push(parsed);
        } catch {}
      }

      // Check for security alerts (encryption failures)
      const securityAlert = await AsyncStorage.getItem('security_alert');
      if (securityAlert) {
        try {
          const parsed = JSON.parse(securityAlert);
          activeNotifications.push(parsed);
        } catch {}
      }

      // Check for general AI error feedback
      const errorFeedback = await AsyncStorage.getItem('ai_error_feedback_queue');
      if (errorFeedback) {
        try {
          const parsed = JSON.parse(errorFeedback);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Convert AI feedback to sync notifications
            parsed.forEach(feedback => {
              if (feedback.severity === 'error' || feedback.actionRequired) {
                activeNotifications.push({
                  type: 'security_alert',
                  message: feedback.message,
                  severity: feedback.severity,
                  timestamp: new Date().toISOString(),
                  actionRequired: feedback.actionRequired
                });
              }
            });
          }
        } catch {}
      }

      // Only update state if there are actual changes to prevent unnecessary renders
      const hasChanges = JSON.stringify(activeNotifications) !== JSON.stringify(notifications);
      if (hasChanges) {
        setNotifications(activeNotifications);
        setIsVisible(activeNotifications.length > 0);
      }

    } catch (error) {
      console.error('❌ Failed to check for sync notifications:', error);
    }
  };

  const handleDismiss = async (index: number) => {
    try {
      const notification = notifications[index];
      
      // Remove from storage
      if (notification.type === 'queue_overflow_risk') {
        await AsyncStorage.removeItem('sync_risk_notification');
      } else if (notification.type === 'encryption_failure' || notification.type === 'security_alert') {
        await AsyncStorage.removeItem('security_alert');
      }

      // Track dismissal
      await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'sync_notification_dismissed',
        notificationType: notification.type,
        severity: notification.severity
      });

      // Update state
      const newNotifications = notifications.filter((_, i) => i !== index);
      setNotifications(newNotifications);
      setIsVisible(newNotifications.length > 0);

    } catch (error) {
      console.error('❌ Failed to dismiss notification:', error);
    }
  };

  const handleAction = async (notification: SyncNotification) => {
    try {
      if (notification.type === 'queue_overflow_risk') {
        // Show detailed overflow information
        Alert.alert(
          'Senkronizasyon Kuyruğu Dolu',
          `${notification.droppedItemCount || 'Bazı'} kayıtlar senkronizasyon kuyruğundan çıkarılmış ve yedeklendi. İnternet bağlantınızı kontrol edin ve uygulamayı yeniden başlatın.`,
          [
            { text: 'Tamam', style: 'default' },
            { 
              text: 'Detaylar', 
              onPress: () => showQueueDetails(notification) 
            }
          ]
        );
      } else if (notification.requiresAppRestart) {
        Alert.alert(
          'Uygulama Yeniden Başlatılmalı',
          'Güvenlik sorunu nedeniyle uygulamanın yeniden başlatılması gerekiyor.',
          [
            { text: 'Tamam', style: 'destructive' }
          ]
        );
      }

      // Track action
      await safeTrackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'sync_notification_action_taken',
        notificationType: notification.type,
        severity: notification.severity
      });

    } catch (error) {
      console.error('❌ Failed to handle notification action:', error);
    }
  };

  const showQueueDetails = async (notification: SyncNotification) => {
    try {
      // Import and show queue stats if available
      const { offlineSyncService } = await import('@/services/offlineSync');
      const stats = offlineSyncService.getQueueStats();
      
      Alert.alert(
        'Kuyruk Durumu',
        `Toplam öğe: ${stats.size}/${stats.maxSize}\n` +
        `Kullanım: %${stats.utilizationPercent}\n` +
        `Taşma sayısı: ${stats.overflowCount}\n` +
        `En eski öğe: ${stats.oldestItemAge ? Math.round(stats.oldestItemAge / 60000) + ' dakika' : 'Yok'}`,
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      console.error('❌ Failed to show queue details:', error);
    }
  };

  const getSeverityColor = (severity: SyncNotification['severity']) => {
    switch (severity) {
      case 'critical': return '#EF4444';
      case 'error': return '#F97316';
      case 'warning': return '#F59E0B';
      case 'info': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = (severity: SyncNotification['severity']) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {notifications.map((notification, index) => (
        <View 
          key={index} 
          style={[
            styles.notification,
            { borderLeftColor: getSeverityColor(notification.severity) }
          ]}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.icon}>
                {getSeverityIcon(notification.severity)}
              </Text>
              <Text style={[styles.message, { color: getSeverityColor(notification.severity) }]}>
                {notification.message}
              </Text>
            </View>
            
            <View style={styles.actions}>
              {notification.actionRequired && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: getSeverityColor(notification.severity) }]}
                  onPress={() => handleAction(notification)}
                >
                  <Text style={styles.actionButtonText}>
                    {notification.requiresAppRestart ? 'Detay' : 'İşlem'}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => handleDismiss(index)}
              >
                <Text style={styles.dismissButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // Below status bar
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 10,
  },
  notification: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
  dismissButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
