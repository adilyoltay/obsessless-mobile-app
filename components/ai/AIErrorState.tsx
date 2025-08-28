/**
 * 🚨 AI Error State Component
 * 
 * Reusable component for showing AI-related error states with retry functionality.
 * Provides consistent UX for AI failures across the app.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AIErrorType } from '@/features/ai-fallbacks/aiErrorFeedbackService';

interface AIErrorStateProps {
  errorType?: AIErrorType;
  title?: string;
  message?: string;
  suggestion?: string;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  showRetry?: boolean;
  retryLabel?: string;
  retryDisabled?: boolean;
  compact?: boolean; // For inline error states
  style?: any;
}

export default function AIErrorState({
  errorType = AIErrorType.UNKNOWN_ERROR,
  title,
  message,
  suggestion,
  onRetry,
  onDismiss,
  showRetry = true,
  retryLabel = 'Tekrar Dene',
  retryDisabled = false,
  compact = false,
  style
}: AIErrorStateProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  // Get default content based on error type
  const getDefaultContent = () => {
    switch (errorType) {
      case AIErrorType.TOKEN_BUDGET_EXCEEDED:
        return {
          icon: 'chart-timeline-variant',
          iconColor: '#F59E0B',
          title: title || 'Günlük Limit Doldu',
          message: message || 'AI analizin için bugünkü limitin doldu. Temel özellikler çalışmaya devam ediyor.',
          suggestion: suggestion || '💡 Yarın daha detaylı analizler için geri gel!'
        };

      case AIErrorType.LOW_CONFIDENCE_ABSTAIN:
        return {
          icon: 'help-circle-outline',
          iconColor: '#6B7280',
          title: title || 'Biraz Belirsiz',
          message: message || 'Yazınız hakkında kesin bir analiz yapamadım.',
          suggestion: suggestion || '💭 Daha detaylı yazabilir veya farklı bir yaklaşım deneyebilirsin.'
        };

      case AIErrorType.NETWORK_FAILURE:
        return {
          icon: 'wifi-off',
          iconColor: '#EF4444',
          title: title || 'Bağlantı Sorunu',
          message: message || 'İnternet bağlantın zayıf. Çevrimdışı modda devam ediyoruz.',
          suggestion: suggestion || '📶 Bağlantı düzeldiğinde otomatik olarak senkronize olacak.'
        };

      case AIErrorType.PROGRESSIVE_ENHANCEMENT_FAILED:
        return {
          icon: 'lightning-bolt-outline',
          iconColor: '#8B5CF6',
          title: title || 'Hızlı Analiz Kullanılamıyor',
          message: message || 'AI analizin biraz daha uzun sürecek.',
          suggestion: suggestion || '⏱️ Sabırlı ol, daha detaylı analiz hazırlanıyor.'
        };

      case AIErrorType.SERVICE_UNAVAILABLE:
        return {
          icon: 'cog-outline',
          iconColor: '#EF4444',
          title: title || 'AI Servisi Bakımda',
          message: message || 'AI özellikleri geçici olarak kullanılamıyor.',
          suggestion: suggestion || '🔄 Biraz sonra tekrar dene.'
        };

      case AIErrorType.DATA_INSUFFICIENT:
        return {
          icon: 'chart-line',
          iconColor: '#3B82F6',
          title: title || 'Daha Fazla Veri Gerekli',
          message: message || 'AI analizi için yeterli veri yok.',
          suggestion: suggestion || '📈 Biraz daha kullandıktan sonra daha iyi öneriler alacaksın!'
        };

      default:
        return {
          icon: 'robot-confused-outline',
          iconColor: '#6B7280',
          title: title || 'AI Özelliği Geçici Kullanılamıyor',
          message: message || 'Beklenmedik bir sorun oluştu.',
          suggestion: suggestion || '🔄 Tekrar denemeni öneriyoruz.'
        };
    }
  };

  const content = getDefaultContent();
  
  const handleRetry = async () => {
    if (!onRetry || isRetrying || retryDisabled) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <MaterialCommunityIcons
          name={content.icon as any}
          size={16}
          color={content.iconColor}
          style={styles.compactIcon}
        />
        <Text style={styles.compactMessage}>{content.message}</Text>
        {showRetry && onRetry && (
          <Pressable 
            onPress={handleRetry}
            disabled={isRetrying || retryDisabled}
            style={[styles.compactRetryButton, (isRetrying || retryDisabled) && styles.retryButtonDisabled]}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={16} color="#3B82F6" />
            )}
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={content.icon as any}
          size={48}
          color={content.iconColor}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.message}>{content.message}</Text>
        {content.suggestion && (
          <Text style={styles.suggestion}>{content.suggestion}</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {showRetry && onRetry && (
          <Pressable
            onPress={handleRetry}
            disabled={isRetrying || retryDisabled}
            style={[styles.retryButton, (isRetrying || retryDisabled) && styles.retryButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
            )}
            <Text style={[styles.retryButtonText, isRetrying && styles.retryButtonTextDisabled]}>
              {isRetrying ? 'Deneniyor...' : retryLabel}
            </Text>
          </Pressable>
        )}

        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            style={styles.dismissButton}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <Text style={styles.dismissButtonText}>Kapat</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  suggestion: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButtonTextDisabled: {
    color: '#E5E7EB',
  },
  dismissButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  compactIcon: {
    marginRight: 8,
  },
  compactMessage: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 18,
  },
  compactRetryButton: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 4,
  },
});
