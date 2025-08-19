/**
 * 🛡️ AI Error Boundary - Graceful Error Handling for AI Components
 * 
 * Bu component AI özelliklerinde oluşabilecek hataları yakalar ve
 * kullanıcı dostu fallback UI gösterir.
 * 
 * ⚠️ CRITICAL: AI components her zaman bu ErrorBoundary ile wrap edilmeli
 * ⚠️ Error'lar telemetry'ye loglanmalı ama PII içermemeli
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { AIError, AIErrorCode, ErrorSeverity } from '@/features/ai/types';
import { trackAIError, AIEventType, trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 ERROR BOUNDARY PROPS & STATE
// =============================================================================

interface AIErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  featureName: string;
  onError?: (error: AIError) => void;
  showRetryButton?: boolean;
  retryButtonText?: string;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: AIError | null;
  errorInfo: any;
  retryCount: number;
}

// =============================================================================
// 🛡️ AI ERROR BOUNDARY COMPONENT
// =============================================================================

export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: AIErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  /**
   * Error yakalama - React lifecycle method
   */
  static getDerivedStateFromError(error: Error): Partial<AIErrorBoundaryState> {
    // State güncelle, bir sonraki render'da fallback UI gösterilsin
    return {
      hasError: true,
      error: {
        code: AIErrorCode.UNKNOWN,
        message: error.message,
        timestamp: new Date(),
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        userMessage: 'Bir şeyler ters gitti. Lütfen tekrar deneyin.'
      }
    };
  }

  /**
   * Component error yakalandığında çalışır
   */
  componentDidCatch(error: Error, errorInfo: any): void {
    // Error'u telemetry'ye logla
    this.logError(error, errorInfo);
    
    // State'i güncelle
    this.setState({
      errorInfo,
      error: {
        code: this.classifyError(error),
        message: error.message,
        timestamp: new Date(),
        severity: this.getErrorSeverity(error),
        recoverable: this.isRecoverableError(error),
        userMessage: this.getUserFriendlyMessage(error),
        context: {
          componentStack: errorInfo?.componentStack,
          featureName: this.props.featureName
        }
      }
    });

    // Props'tan onError callback varsa çağır
    if (this.props.onError) {
      this.props.onError(this.state.error!);
    }

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Error'u telemetry sistemine logla
   */
  private async logError(error: Error, errorInfo: any): Promise<void> {
    try {
      const aiError: AIError = {
        code: this.classifyError(error),
        message: error.message,
        timestamp: new Date(),
        severity: this.getErrorSeverity(error),
        recoverable: this.isRecoverableError(error),
        context: {
          featureName: this.props.featureName,
          componentStack: errorInfo?.componentStack?.substring(0, 500), // Limit size
          retryCount: this.state.retryCount
        }
      };

      // Telemetry'ye gönder
      await trackAIError(aiError);
      
      // Error event track et
      await trackAIInteraction(AIEventType.API_ERROR, {
        feature: this.props.featureName,
        errorCode: aiError.code,
        severity: aiError.severity,
        recoverable: aiError.recoverable
      });

    } catch (telemetryError) {
      // Telemetry error'u console'a log et ama user'ı etkilemesin
      console.error('Failed to log AI error to telemetry:', telemetryError);
    }
  }

  /**
   * Error'u classify et
   */
  private classifyError(error: Error): AIErrorCode {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return AIErrorCode.NETWORK_ERROR;
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return AIErrorCode.RATE_LIMIT;
    }
    
    if (message.includes('invalid') || message.includes('malformed')) {
      return AIErrorCode.INVALID_RESPONSE;
    }
    
    if (message.includes('feature') || message.includes('disabled')) {
      return AIErrorCode.FEATURE_DISABLED;
    }
    
    return AIErrorCode.UNKNOWN;
  }

  /**
   * Error severity belirle
   */
  private getErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (message.includes('security') || message.includes('unauthorized')) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('network') || message.includes('timeout')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * Error'un recoverable olup olmadığını belirle
   */
  private isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network errors genelde recoverable
    if (message.includes('network') || message.includes('timeout')) {
      return true;
    }
    
    // Rate limit errors recoverable (wait and retry)
    if (message.includes('rate limit')) {
      return true;
    }
    
    // Security errors genelde recoverable değil
    if (message.includes('security') || message.includes('unauthorized')) {
      return false;
    }
    
    // Default olarak recoverable varsay
    return true;
  }

  /**
   * User-friendly error mesajı
   */
  private getUserFriendlyMessage(error: Error): string {
    const code = this.classifyError(error);
    
    const messages: Record<string, string> = {
      [AIErrorCode.NETWORK_ERROR]: 'Bağlantı sorunu yaşanıyor. İnternet bağlantınızı kontrol edin.',
      [AIErrorCode.RATE_LIMIT]: 'Çok hızlı istek gönderiyorsunuz. Lütfen biraz bekleyin.',
      [AIErrorCode.FEATURE_DISABLED]: 'Bu özellik şu anda kullanılamıyor.',
      [AIErrorCode.INVALID_RESPONSE]: 'Beklenmeyen bir yanıt alındı. Lütfen tekrar deneyin.',
      [AIErrorCode.SAFETY_VIOLATION]: 'Güvenlik kontrolü başarısız oldu.',
      [AIErrorCode.PRIVACY_VIOLATION]: 'Gizlilik ayarlarınız bu işleme izin vermiyor.',
      [AIErrorCode.MODEL_ERROR]: 'AI sistemi geçici olarak kullanılamıyor.',
      [AIErrorCode.UNKNOWN]: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
    };

    return messages[code] || messages[AIErrorCode.UNKNOWN];
  }

  /**
   * Retry fonksiyonu
   */
  private handleRetry = async (): Promise<void> => {
    if (this.state.retryCount >= this.maxRetries) {
      // Max retry'a ulaşıldı, farklı aksiyon gerekli
      await this.handleMaxRetriesReached();
      return;
    }

    // Retry count'u artır
    this.setState({
      retryCount: this.state.retryCount + 1
    });

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Error state'ini temizle - component yeniden render edilsin
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Retry event'ini track et
    await trackAIInteraction(AIEventType.USER_FEEDBACK_POSITIVE, {
      action: 'retry_after_error',
      feature: this.props.featureName,
      retryCount: this.state.retryCount
    });
  };

  /**
   * Max retry'a ulaşıldığında çalışır
   */
  private async handleMaxRetriesReached(): Promise<void> {
    console.warn(`Max retries reached for ${this.props.featureName}`);
    
    // Max retry event'ini track et
    await trackAIInteraction(AIEventType.FEATURE_ABANDONED, {
      feature: this.props.featureName,
      reason: 'max_retries_reached',
      retryCount: this.maxRetries
    });

    // Feature flag'i disable et (emergency case)
    if (this.state.error?.severity === ErrorSeverity.CRITICAL) {
      console.warn('Critical error - disabling feature flag');
      try {
        FEATURE_FLAGS.setFlag(this.props.featureName as any, false);
        await trackAIInteraction(AIEventType.FEATURE_DISABLED, {
          feature: this.props.featureName,
          reason: 'critical_error_auto_disable'
        });
      } catch (e) {
        console.warn('Failed to disable feature flag automatically:', e);
      }
    }
  }

  /**
   * Reset error state - programmatic reset için
   */
  public resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  render(): ReactNode {
    // Error varsa fallback UI göster
    if (this.state.hasError) {
      // Custom fallback varsa onu kullan
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            {/* Error Icon */}
            <MaterialCommunityIcons 
              name="alert-circle-outline" 
              size={48} 
              color="#EF4444" 
              style={styles.errorIcon}
            />
            
            {/* Error Title */}
            <Text style={styles.errorTitle}>
              Bir sorun oluştu
            </Text>
            
            {/* Error Message */}
            <Text style={styles.errorMessage}>
              {this.state.error?.userMessage || 'Beklenmeyen bir hata oluştu.'}
            </Text>

            {/* Feature Name */}
            <Text style={styles.featureName}>
              Özellik: {this.props.featureName}
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {/* Retry Button */}
              {this.props.showRetryButton !== false && 
               this.state.error?.recoverable && 
               this.state.retryCount < this.maxRetries && (
                <Pressable 
                  style={styles.retryButton}
                  onPress={this.handleRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Tekrar dene"
                >
                  <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>
                    {this.props.retryButtonText || 'Tekrar Dene'}
                  </Text>
                </Pressable>
              )}

              {/* Max retries reached message */}
              {this.state.retryCount >= this.maxRetries && (
                <View style={styles.maxRetriesContainer}>
                  <Text style={styles.maxRetriesText}>
                    Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.
                  </Text>
                </View>
              )}
            </View>

            {/* Development Info */}
            {__DEV__ && (
              <View style={styles.devInfo}>
                <Text style={styles.devTitle}>Debug Info:</Text>
                <Text style={styles.devText}>
                  Error Code: {this.state.error?.code}
                </Text>
                <Text style={styles.devText}>
                  Severity: {this.state.error?.severity}
                </Text>
                <Text style={styles.devText}>
                  Retry Count: {this.state.retryCount}/{this.maxRetries}
                </Text>
                <Text style={styles.devText}>
                  Recoverable: {this.state.error?.recoverable ? 'Yes' : 'No'}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    // Error yoksa normal children'ı render et
    return this.props.children;
  }
}

// =============================================================================
// 🎨 STYLES
// =============================================================================

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  errorContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  featureName: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  actionButtons: {
    width: '100%',
    alignItems: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  maxRetriesContainer: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginTop: 12,
  },
  maxRetriesText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  devInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    width: '100%',
  },
  devTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  devText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
});

// =============================================================================
// 🧩 HELPER COMPONENTS
// =============================================================================

/**
 * AI Chat özelliği için özelleştirilmiş Error Boundary
 */
export const AIChatErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AIErrorBoundary 
    featureName="AI_CHAT"
    showRetryButton={true}
    retryButtonText="Sohbeti Yeniden Başlat"
  >
    {children}
  </AIErrorBoundary>
);

/**
 * AI Insights özelliği için özelleştirilmiş Error Boundary
 */
export const AIInsightsErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AIErrorBoundary 
    featureName="AI_INSIGHTS"
    showRetryButton={true}
    retryButtonText="İçgörüleri Yenile"
  >
    {children}
  </AIErrorBoundary>
);

/**
 * AI Onboarding özelliği için özelleştirilmiş Error Boundary
 */
export const AIOnboardingErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AIErrorBoundary 
    featureName="AI_ONBOARDING"
    showRetryButton={true}
    retryButtonText="Değerlendirmeyi Tekrarla"
  >
    {children}
  </AIErrorBoundary>
);

// Export default
export default AIErrorBoundary;