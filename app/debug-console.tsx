/**
 * Debug Console - Hidden Admin Screen
 * 
 * Access: /debug-console (hidden URL, not in navigation)
 * Purpose: Internal QA and production monitoring
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Services
import syncMetrics from '@/services/syncMetrics';
import crashReporting from '@/services/crashReporting'; 
import asyncStorageHygiene from '@/services/asyncStorageHygiene';
import performanceMonitor from '@/services/performanceMonitor';
import smartNotifications from '@/services/smartNotifications';
import { offlineSyncService } from '@/services/offlineSync';

// Components
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import SyncHealthDebugCard from '@/components/settings/SyncHealthDebugCard';

export default function DebugConsole() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [crashes, setCrashes] = useState<any>(null);
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [notifications, setNotifications] = useState<any>(null);

  const loadDebugData = async () => {
    try {
      console.log('🔍 Loading debug console data...');
      
      const [
        syncHealth,
        storageUsage,
        crashSummary,
        performanceData,
        notificationStatus
      ] = await Promise.all([
        syncMetrics.getSyncHealth(),
        asyncStorageHygiene.getFormattedUsage(),
        crashReporting.getCrashSummary(),
        performanceMonitor.getFormattedMetrics(),
        smartNotifications.getNotificationStatus()
      ]);

      setMetrics(syncHealth);
      setStorage(storageUsage);
      setCrashes(crashSummary);
      setPerformance(performanceData);
      setNotifications(notificationStatus);

      // Auth info (safe data only)
      setAuthInfo({
        userId: user?.id?.slice(0, 8) + '...' || 'Not logged in',
        email: user?.email?.replace(/(.{3}).*@/, '$1***@') || 'No email',
        lastSignIn: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('tr-TR') : 'Never',
        createdAt: user?.created_at ? new Date(user.created_at).toLocaleString('tr-TR') : 'Unknown'
      });

    } catch (error) {
      console.error('Failed to load debug data:', error);
    }
  };

  useEffect(() => {
    loadDebugData();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDebugData();
    setRefreshing(false);
  };

  const handleClearStorage = () => {
    Alert.alert(
      'Storage Temizliği',
      'Eski cache ve temp verilerini temizlemek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await asyncStorageHygiene.performMaintenance(user?.id || 'unknown');
              Alert.alert(
                'Temizlik Tamamlandı',
                `${result.totalCleaned} key silindi\n${Math.round(result.freedBytes / 1024)}KB boşaltıldı\n\n${result.actions.join('\n')}`
              );
              handleRefresh();
            } catch (error) {
              Alert.alert('Hata', 'Temizlik başarısız');
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return 'check-circle';
      case 'warning': return 'alert-circle';
      case 'critical': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: '🔧 Debug Console',
          headerShown: true,
          headerBackVisible: true,
          headerStyle: { backgroundColor: '#1F2937' },
          headerTintColor: '#FFFFFF'
        }} 
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#10B981"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="console" size={32} color="#10B981" />
          <Text style={styles.title}>System Debug Console</Text>
          <Text style={styles.subtitle}>Internal QA & Production Monitoring</Text>
        </View>

        {/* Auth Status */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account-key" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Authentication Status</Text>
          </View>
          
          {authInfo && (
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>User ID</Text>
                <Text style={styles.infoValue}>{authInfo.userId}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{authInfo.email}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Last Sign In</Text>
                <Text style={styles.infoValue}>{authInfo.lastSignIn}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Created At</Text>
                <Text style={styles.infoValue}>{authInfo.createdAt}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Sync Health */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="sync" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Sync Health</Text>
            {metrics && (
              <Badge
                variant={metrics.status === 'healthy' ? 'success' : 
                       metrics.status === 'warning' ? 'warning' : 'danger'}
                size="small"
                text={metrics.status.toUpperCase()}
              />
            )}
          </View>
          
          {metrics && (
            <>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons
                  name={getStatusIcon(metrics.status)}
                  size={24}
                  color={getStatusColor(metrics.status)}
                />
                <Text style={[styles.statusText, { color: getStatusColor(metrics.status) }]}>
                  {metrics.message}
                </Text>
              </View>
              
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Success Rate</Text>
                  <Text style={[styles.metricValue, { 
                    color: metrics.details.successRate >= 90 ? '#10B981' : 
                           metrics.details.successRate >= 70 ? '#F59E0B' : '#EF4444'
                  }]}>
                    {metrics.details.successRate}%
                  </Text>
                </View>
                
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Queue Backlog</Text>
                  <Text style={[styles.metricValue, {
                    color: metrics.details.queueBacklog === 0 ? '#10B981' :
                           metrics.details.queueBacklog < 10 ? '#F59E0B' : '#EF4444'
                  }]}>
                    {metrics.details.queueBacklog}
                  </Text>
                </View>
                
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Avg Latency</Text>
                  <Text style={styles.metricValue}>
                    {metrics.details.avgLatency || 'N/A'}ms
                  </Text>
                </View>
                
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Last Sync</Text>
                  <Text style={styles.metricValue}>
                    {metrics.details.lastSyncAge ? `${metrics.details.lastSyncAge}m ago` : 'Never'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {/* Storage Health */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="database" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Storage Health</Text>
          </View>
          
          {storage && (
            <>
              <View style={styles.infoList}>
                {storage.summary.map((item: string, index: number) => (
                  <Text key={index} style={styles.infoListItem}>{item}</Text>
                ))}
              </View>
              
              <Text style={styles.subsectionTitle}>Breakdown by Category:</Text>
              <View style={styles.infoList}>
                {storage.breakdown.map((item: string, index: number) => (
                  <Text key={index} style={styles.infoSubItem}>{item}</Text>
                ))}
              </View>
              
              <View style={styles.healthStatus}>
                <Text style={styles.healthText}>{storage.health}</Text>
              </View>
              
              {storage.recommendations.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Recommendations:</Text>
                  <View style={styles.infoList}>
                    {storage.recommendations.map((rec: string, index: number) => (
                      <Text key={index} style={styles.recommendationItem}>• {rec}</Text>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        {/* Crash Summary */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="alert-octagon" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Crash Summary</Text>
            <Badge
              variant={crashes?.totalCrashes === 0 ? 'success' : 
                     crashes?.totalCrashes < 3 ? 'warning' : 'danger'}
              size="small"
              text={crashes?.totalCrashes || 0}
            />
          </View>
          
          {crashes && (
            <>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Total Crashes</Text>
                  <Text style={[styles.infoValue, { 
                    color: crashes.totalCrashes === 0 ? '#10B981' : '#EF4444' 
                  }]}>
                    {crashes.totalCrashes}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Last Crash</Text>
                  <Text style={styles.infoValue}>
                    {crashes.lastCrashTime ? 
                      new Date(crashes.lastCrashTime).toLocaleString('tr-TR') : 
                      'Never'
                    }
                  </Text>
                </View>
              </View>
              
              {crashes.commonErrors.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Common Errors:</Text>
                  <View style={styles.errorList}>
                    {crashes.commonErrors.map((error: string, index: number) => (
                      <Text key={index} style={styles.errorItem}>{error}</Text>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        {/* Performance Metrics */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="speedometer" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Performance Metrics</Text>
          </View>
          
          {performance && (
            <>
              <View style={styles.infoList}>
                {performance.summary.map((item: string, index: number) => (
                  <Text key={index} style={styles.infoListItem}>{item}</Text>
                ))}
              </View>
              
              <Text style={styles.subsectionTitle}>Budget Status:</Text>
              <View style={styles.infoList}>
                {performance.details.map((item: string, index: number) => (
                  <Text key={index} style={styles.infoSubItem}>{item}</Text>
                ))}
              </View>
              
              {performance.alerts.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Performance Alerts:</Text>
                  <View style={styles.errorList}>
                    {performance.alerts.map((alert: string, index: number) => (
                      <Text key={index} style={styles.errorItem}>{alert}</Text>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        {/* Notifications Status */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="bell" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Notifications</Text>
            {notifications && (
              <Badge
                variant={notifications.permissionGranted ? 'success' : 'danger'}
                size="small"
                text={notifications.permissionGranted ? 'ENABLED' : 'DISABLED'}
              />
            )}
          </View>
          
          {notifications && (
            <>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Permission</Text>
                  <Text style={[styles.infoValue, { 
                    color: notifications.permissionGranted ? '#10B981' : '#EF4444' 
                  }]}>
                    {notifications.permissionGranted ? 'Granted' : 'Denied'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Scheduled</Text>
                  <Text style={styles.infoValue}>{notifications.scheduledCount}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Last Scheduled</Text>
                  <Text style={styles.infoValue}>
                    {notifications.lastScheduled ? 
                      new Date(notifications.lastScheduled).toLocaleString('tr-TR') : 
                      'Never'
                    }
                  </Text>
                </View>
              </View>
              
              {notifications.nextNotifications.length > 0 && (
                <>
                  <Text style={styles.subsectionTitle}>Next Notifications:</Text>
                  <View style={styles.infoList}>
                    {notifications.nextNotifications.map((notif: any, index: number) => (
                      <Text key={index} style={styles.infoSubItem}>
                        {notif.content?.title || 'Unknown'} - {
                          notif.trigger?.dateComponents ? 
                          `${notif.trigger.dateComponents.hour}:${notif.trigger.dateComponents.minute.toString().padStart(2, '0')}` :
                          'No schedule'
                        }
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        {/* Actions */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="wrench" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Admin Actions</Text>
          </View>
          
          <View style={styles.actionGrid}>
            <Pressable 
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => offlineSyncService.forceSyncNow()}
            >
              <MaterialCommunityIcons name="sync" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Force Sync</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.warningAction]}
              onPress={handleClearStorage}
            >
              <MaterialCommunityIcons name="broom" size={20} color="#F59E0B" />
              <Text style={styles.warningActionText}>Clean Storage</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.infoAction]}
              onPress={() => syncMetrics.resetMetrics()}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#3B82F6" />
              <Text style={styles.infoActionText}>Reset Metrics</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.dangerAction]}
              onPress={() => crashReporting.clearCrashReports()}
            >
              <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
              <Text style={styles.dangerActionText}>Clear Crashes</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.infoAction]}
              onPress={() => performanceMonitor.resetMetrics()}
            >
              <MaterialCommunityIcons name="speedometer" size={20} color="#3B82F6" />
              <Text style={styles.infoActionText}>Reset Perf</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.warningAction]}
              onPress={() => smartNotifications.rescheduleNotifications(user?.id)}
            >
              <MaterialCommunityIcons name="bell-ring" size={20} color="#F59E0B" />
              <Text style={styles.warningActionText}>Resched Notifs</Text>
            </Pressable>
          </View>
        </Card>

        {/* System Info */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information" size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>System Information</Text>
          </View>
          
          <View style={styles.infoList}>
            <Text style={styles.infoListItem}>📱 Platform: React Native (Expo)</Text>
            <Text style={styles.infoListItem}>🚫 AI Status: Completely disabled</Text>
            <Text style={styles.infoListItem}>🔒 Encryption: AES-256-GCM active</Text>
            <Text style={styles.infoListItem}>📊 Telemetry: No-op (AI-free)</Text>
            <Text style={styles.infoListItem}>🌐 Backend: Supabase (PostgreSQL + RLS)</Text>
            <Text style={styles.infoListItem}>💾 Storage: AsyncStorage (encrypted)</Text>
          </View>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🔐 This screen is for internal QA only.{'\n'}
            Production'da gizlenecek veya access control ile korunacak.
          </Text>
          
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color="#6B7280" />
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    fontFamily: 'Inter',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  metricCard: {
    minWidth: '45%',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  infoItem: {
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  infoList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoListItem: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  infoSubItem: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 4,
    paddingLeft: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  healthStatus: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  healthText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter',
  },
  recommendationItem: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  errorList: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  errorItem: {
    fontSize: 11,
    color: '#991B1B',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: '45%',
  },
  primaryAction: {
    backgroundColor: '#10B981',
  },
  warningAction: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  infoAction: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dangerAction: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  warningActionText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  infoActionText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  dangerActionText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
});
