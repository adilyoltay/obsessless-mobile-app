/**
 * 🔧 Adaptive Analytics Debug Overlay
 * 
 * Development-only overlay to quickly access adaptive suggestion analytics.
 * Can be triggered by long-press on AI badge or debug gestures.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AdaptiveSuggestionDashboard from '../analytics/AdaptiveSuggestionDashboard';
import { adaptiveSuggestionAnalytics } from '@/features/ai/analytics/adaptiveSuggestionAnalytics';

interface DebugOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export const AdaptiveAnalyticsDebugOverlay: React.FC<DebugOverlayProps> = ({ 
  visible, 
  onClose 
}) => {
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleClearData = async () => {
    try {
      await adaptiveSuggestionAnalytics.clearOldData(0); // Clear all data
      Alert.alert(
        'Veri Temizlendi',
        'Tüm adaptive suggestion analytics verisi temizlendi.',
        [{ text: 'Tamam' }]
      );
      setShowConfirmClear(false);
    } catch (error) {
      console.error('❌ Failed to clear analytics data:', error);
      Alert.alert(
        'Hata',
        'Analytics verisi temizlenirken hata oluştu.',
        [{ text: 'Tamam' }]
      );
    }
  };

  const showClearConfirmation = () => {
    Alert.alert(
      'Veri Temizle',
      'Tüm adaptive suggestion analytics verisi silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Temizle', 
          style: 'destructive',
          onPress: handleClearData 
        }
      ]
    );
  };

  if (!__DEV__) {
    // Production'da gösterme
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Debug Header */}
        <View style={styles.debugHeader}>
          <View style={styles.debugBadge}>
            <MaterialCommunityIcons name="bug" size={16} color="white" />
            <Text style={styles.debugBadgeText}>DEBUG</Text>
          </View>
          
          <Pressable onPress={showClearConfirmation} style={styles.clearButton}>
            <MaterialCommunityIcons name="delete-outline" size={20} color="#DC2626" />
            <Text style={styles.clearButtonText}>Veri Temizle</Text>
          </Pressable>
        </View>

        {/* Dashboard */}
        <AdaptiveSuggestionDashboard 
          style={styles.dashboard}
          onClose={onClose}
          isOverlay={false}
        />
      </View>
    </Modal>
  );
};

/**
 * 🎯 Debug Trigger Component
 * Can be embedded in any screen for easy access to analytics
 */
export const AdaptiveAnalyticsTrigger: React.FC<{
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = ({ position = 'bottom-right' }) => {
  const [overlayVisible, setOverlayVisible] = useState(false);

  if (!__DEV__) {
    return null;
  }

  const getPositionStyle = () => {
    switch (position) {
      case 'top-left':
        return { top: 60, left: 20 };
      case 'top-right':
        return { top: 60, right: 20 };
      case 'bottom-left':
        return { bottom: 100, left: 20 };
      case 'bottom-right':
        return { bottom: 100, right: 20 };
    }
  };

  return (
    <>
      <Pressable
        style={[styles.trigger, getPositionStyle()]}
        onPress={() => setOverlayVisible(true)}
        onLongPress={() => {
          // Long press for additional debug actions
          Alert.alert(
            '🔧 Debug Analytics',
            'Adaptive suggestion analytics debug menüsü',
            [
              { text: 'İptal', style: 'cancel' },
              { 
                text: 'Analytics Aç', 
                onPress: () => setOverlayVisible(true) 
              }
            ]
          );
        }}
      >
        <MaterialCommunityIcons name="chart-box" size={20} color="white" />
      </Pressable>

      <AdaptiveAnalyticsDebugOverlay
        visible={overlayVisible}
        onClose={() => setOverlayVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1F2937',
    paddingTop: 60, // Account for status bar
  },

  debugBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  debugBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  },

  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DC2626',
  },

  clearButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  },

  dashboard: {
    flex: 1,
  },

  trigger: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
});

export default AdaptiveAnalyticsDebugOverlay;
