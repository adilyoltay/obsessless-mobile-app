import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import offlineSyncUserFeedbackService, { SyncErrorSummary } from '@/services/offlineSyncUserFeedbackService';
import { Card } from '@/components/ui/Card';

/**
 * 🔔 SYNC ERROR SUMMARY CARD
 * 
 * Displays sync error summary and allows user to take actions:
 * - Shows count of unresolved sync errors
 * - Displays critical error warnings
 * - Provides manual sync retry button
 * - Auto-updates every 30 seconds
 */

interface SyncErrorSummaryCardProps {
  style?: any;
  onManualSync?: () => Promise<void>;
  showOnlyWhenErrors?: boolean; // Only show when there are errors
}

export default function SyncErrorSummaryCard({
  style,
  onManualSync,
  showOnlyWhenErrors = true
}: SyncErrorSummaryCardProps) {
  const [errorSummary, setErrorSummary] = useState<SyncErrorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  /**
   * 📊 Load sync error summary
   */
  const loadErrorSummary = async () => {
    try {
      setIsLoading(true);
      const summary = await offlineSyncUserFeedbackService.getSyncErrorSummary();
      setErrorSummary(summary);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('❌ Failed to load sync error summary:', error);
      setErrorSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 🔄 Trigger manual sync
   */
  const handleManualSync = async () => {
    try {
      setIsManualSyncing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (onManualSync) {
        await onManualSync();
      } else {
        // Default manual sync implementation
        const { offlineSyncService } = await import('@/services/offlineSync');
        await offlineSyncService.processSyncQueue();
      }

      // Reload summary after sync
      setTimeout(() => {
        loadErrorSummary();
      }, 1000);

    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      Alert.alert(
        'Sync Hatası',
        'Manuel senkronizasyon başarısız oldu. İnternet bağlantınızı kontrol edin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsManualSyncing(false);
    }
  };

  /**
   * 📋 Show detailed error list
   */
  const showErrorDetails = () => {
    if (!errorSummary) return;

    const { unresolvedErrors, criticalErrors, affectedEntities } = errorSummary;
    
    const entityNames = {
      mood_entry: 'Mood kayıtları',
      achievement: 'Başarılar',
      ai_profile: 'AI profili',
      treatment_plan: 'Tedavi planı',
      voice_checkin: 'Ses kayıtları',
      user_profile: 'Kullanıcı profili'
    };

    const affectedEntityNames = affectedEntities
      .map(entity => entityNames[entity as keyof typeof entityNames] || entity)
      .join(', ');

    Alert.alert(
      'Senkronizasyon Detayları',
      `${unresolvedErrors} adet veri senkronize edilemiyor.\n\n` +
      `${criticalErrors > 0 ? `🚨 ${criticalErrors} kritik hata\n\n` : ''}` +
      `Etkilenen veriler:\n${affectedEntityNames || 'Yok'}`,
      [
        { text: 'Yeniden Dene', onPress: handleManualSync },
        { text: 'Tamam', style: 'cancel' }
      ]
    );
  };

  /**
   * 🧹 Clean up old resolved errors
   */
  const cleanupOldErrors = async () => {
    try {
      const cleanedCount = await offlineSyncUserFeedbackService.cleanupResolvedErrors(7);
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old resolved errors`);
        await loadErrorSummary(); // Reload after cleanup
      }
    } catch (error) {
      console.warn('⚠️ Error cleanup failed:', error);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    loadErrorSummary();
    
    const interval = setInterval(() => {
      loadErrorSummary();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup old errors on mount
  useEffect(() => {
    cleanupOldErrors();
  }, []);

  // Don't render if no errors and showOnlyWhenErrors is true
  if (showOnlyWhenErrors && (!errorSummary || errorSummary.unresolvedErrors === 0)) {
    return null;
  }

  if (isLoading && !errorSummary) {
    return (
      <Card style={[styles.card, style] as any}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.loadingText}>Senkronizasyon durumu kontrol ediliyor...</Text>
        </View>
      </Card>
    );
  }

  if (!errorSummary) {
    return null;
  }

  const { unresolvedErrors, criticalErrors, needsUserAttention, lastErrorTime } = errorSummary;
  const timeSinceLastError = lastErrorTime ? Math.round((Date.now() - lastErrorTime) / (60 * 1000)) : 0;

  // Color scheme based on error severity
  const cardStyle = criticalErrors > 0 ? styles.criticalCard :
                   unresolvedErrors >= 3 ? styles.warningCard :
                   unresolvedErrors > 0 ? styles.infoCard : styles.successCard;

  const iconName = criticalErrors > 0 ? 'alert-circle' :
                  unresolvedErrors >= 3 ? 'alert-triangle' :
                  unresolvedErrors > 0 ? 'information' : 'check-circle';

  const iconColor = criticalErrors > 0 ? '#DC2626' :
                   unresolvedErrors >= 3 ? '#F59E0B' :
                   unresolvedErrors > 0 ? '#3B82F6' : '#10B981';

  const title = criticalErrors > 0 ? 'Kritik Sync Hatası' :
               unresolvedErrors >= 3 ? 'Sync Uyarısı' :
               unresolvedErrors > 0 ? 'Sync Sorunu' : 'Sync Durumu İyi';

  const message = criticalErrors > 0 
    ? `${criticalErrors} kritik veri senkronize edilemiyor. Verileriniz kaybolabilir.`
    : unresolvedErrors >= 3
    ? `${unresolvedErrors} veri senkronize edilemiyor. İnternet bağlantısını kontrol edin.`
    : unresolvedErrors > 0
    ? `${unresolvedErrors} veri beklemede. ${timeSinceLastError}dk önce son hata.`
    : 'Tüm veriler başarıyla senkronize edildi.';

  return (
    <Card style={[styles.card, cardStyle, style] as any}>
      <View style={styles.header}>
        <View style={styles.iconTitleContainer}>
          <MaterialCommunityIcons
            name={iconName as any}
            size={24}
            color={iconColor}
            style={styles.icon}
          />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        </View>
        
        {needsUserAttention && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>!</Text>
          </View>
        )}
      </View>

      {unresolvedErrors > 0 && (
        <View style={styles.actions}>
          <Pressable
            style={styles.detailsButton}
            onPress={showErrorDetails}
            android_ripple={{ color: '#E5E7EB' }}
          >
            <Text style={styles.detailsButtonText}>Detayları Gör</Text>
          </Pressable>

          <Pressable
            style={[styles.syncButton, isManualSyncing && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={isManualSyncing}
            android_ripple={{ color: '#DBEAFE' }}
          >
            {isManualSyncing ? (
              <>
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
                <Text style={styles.syncButtonText}>Deneniyor...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={16} color="#3B82F6" style={{ marginRight: 4 }} />
                <Text style={styles.syncButtonText}>Yeniden Dene</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {lastUpdated && (
        <Text style={styles.lastUpdated}>
          Son kontrol: {new Date(lastUpdated).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  criticalCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  infoCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  badge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  detailsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    flex: 1,
    marginRight: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
  syncButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontFamily: 'Inter-Medium',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
});
