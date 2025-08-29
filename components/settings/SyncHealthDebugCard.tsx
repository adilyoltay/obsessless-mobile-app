/**
 * Sync Health Debug Card
 * 
 * Post-AI cleanup için sync sistem sağlığını gösteren debug component.
 * Settings sayfasında development ve internal QA için kullanılır.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import syncMetrics from '@/services/syncMetrics';
import crashReporting from '@/services/crashReporting';

interface SyncHealthDebugCardProps {
  visible?: boolean;
}

export default function SyncHealthDebugCard({ visible = false }: SyncHealthDebugCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [crashes, setCrashes] = useState<any>(null);

  const loadData = async () => {
    try {
      const [syncHealth, formattedMetrics, crashSummary] = await Promise.all([
        syncMetrics.getSyncHealth(),
        syncMetrics.getFormattedMetrics(), 
        crashReporting.getCrashSummary()
      ]);

      setHealth(syncHealth);
      setMetrics(formattedMetrics);
      setCrashes(crashSummary);
    } catch (error) {
      console.warn('Failed to load debug data:', error);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return 'check-circle';
      case 'warning': return 'alert-circle';
      case 'critical': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Card style={styles.card}>
      <Pressable 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons 
            name="monitor-dashboard" 
            size={20} 
            color="#6B7280" 
          />
          <Text style={styles.headerTitle}>Sync & System Health</Text>
          {health && (
            <Badge
              variant={health.status === 'healthy' ? 'success' : 
                     health.status === 'warning' ? 'warning' : 'danger'}
              size="small"
              text={health.status.toUpperCase()}
            />
          )}
        </View>
        
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
        />
      </Pressable>

      {expanded && (
        <ScrollView 
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#10B981"
            />}
        >
          {/* Sync Health Status */}
          {health && (
            <View style={styles.section}>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons
                  name={getHealthIcon(health.status)}
                  size={24}
                  color={getHealthColor(health.status)}
                />
                <Text style={[styles.statusText, { color: getHealthColor(health.status) }]}>
                  {health.message}
                </Text>
              </View>
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Başarı Oranı</Text>
                  <Text style={styles.detailValue}>{health.details.successRate}%</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Ortalama Süre</Text>
                  <Text style={styles.detailValue}>{health.details.avgLatency || 'N/A'}ms</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Kuyruk Durumu</Text>
                  <Text style={styles.detailValue}>{health.details.queueBacklog} öğe</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Son Sync</Text>
                  <Text style={styles.detailValue}>
                    {health.details.lastSyncAge ? `${health.details.lastSyncAge}dk önce` : 'Hiç'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Detailed Metrics */}
          {metrics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Detaylı İstatistikler</Text>
              
              <View style={styles.metricsList}>
                {metrics.summary.map((item: string, index: number) => (
                  <Text key={index} style={styles.metricItem}>{item}</Text>
                ))}
              </View>
              
              <View style={styles.metricsList}>
                {metrics.details.map((item: string, index: number) => (
                  <Text key={index} style={styles.metricSubItem}>{item}</Text>
                ))}
              </View>
              
              {metrics.errors.length > 0 && (
                <View>
                  <Text style={styles.errorsTitle}>🚨 Sık Görülen Hatalar</Text>
                  <View style={styles.errorsList}>
                    {metrics.errors.map((error: string, index: number) => (
                      <Text key={index} style={styles.errorItem}>{error}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Crash Summary */}
          {crashes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💥 Crash Durumu</Text>
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Toplam Crash</Text>
                  <Text style={[styles.detailValue, { 
                    color: crashes.totalCrashes > 0 ? '#EF4444' : '#10B981' 
                  }]}>
                    {crashes.totalCrashes}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Son Crash</Text>
                  <Text style={styles.detailValue}>
                    {crashes.lastCrashTime ? 
                      new Date(crashes.lastCrashTime).toLocaleString('tr-TR') : 
                      'Hiç'
                    }
                  </Text>
                </View>
              </View>
              
              {crashes.commonErrors.length > 0 && (
                <View>
                  <Text style={styles.errorsTitle}>🔍 Yaygın Hatalar</Text>
                  <View style={styles.errorsList}>
                    {crashes.commonErrors.map((error: string, index: number) => (
                      <Text key={index} style={styles.errorItem}>{error}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable 
              style={[styles.actionButton, styles.warningButton]}
              onPress={() => syncMetrics.resetMetrics()}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#F59E0B" />
              <Text style={styles.warningButtonText}>Metrics Reset</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.actionButton, styles.dangerButton]}
              onPress={() => crashReporting.clearCrashReports()}
            >
              <MaterialCommunityIcons name="delete" size={16} color="#EF4444" />
              <Text style={styles.dangerButtonText}>Clear Crashes</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            🔧 Internal QA Tool - Production'da gizlenecek
          </Text>
        </ScrollView>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  content: {
    maxHeight: 400,
  },
  section: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    minWidth: '45%',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  metricsList: {
    marginBottom: 12,
  },
  metricItem: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'monospace',
    marginBottom: 4,
    paddingVertical: 2,
  },
  metricSubItem: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 3,
    paddingLeft: 8,
  },
  errorsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  errorsList: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
  },
  errorItem: {
    fontSize: 11,
    color: '#991B1B',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  warningButton: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  dangerButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  warningButtonText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  dangerButtonText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  footer: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 8,
    fontFamily: 'Inter',
  }
});
