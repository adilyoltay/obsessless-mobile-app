import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({ errorInfo });
    
    // Log error for debugging (in production, send to crash reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info for user support
    this.logErrorToStorage(error, errorInfo);
  }

  logErrorToStorage = async (error: Error, errorInfo: any) => {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: 'React Native App'
      };
      
      const existingLogs = await AsyncStorage.getItem('error_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(errorLog);
      
      // Keep only last 10 errors
      const recentLogs = logs.slice(-10);
      await AsyncStorage.setItem('error_logs', JSON.stringify(recentLogs));
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  };

  handleRestart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReportIssue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Create a simple error report
    const errorMessage = this.state.error?.message || 'Bilinmeyen hata';
    const subject = encodeURIComponent('ObsessLess - Hata Raporu');
    const body = encodeURIComponent(`
Merhaba ObsessLess Destek Ekibi,

Uygulamada bir hata oluştu:

Hata: ${errorMessage}
Zaman: ${new Date().toLocaleString('tr-TR')}
Platform: React Native

Lütfen bu sorunu inceleyin.

Teşekkürler
    `);
    
    // In a real app, you'd integrate with a bug reporting service
    console.log('Bug report would be sent:', { subject, body });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Master Prompt: Sakinleştirici ve empatik tasarım */}
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name="alert-circle-outline" 
                size={64} 
                color="#F59E0B" 
              />
            </View>
            
            <Text style={styles.title}>Oops! Bir sorun oluştu 😔</Text>
            
            <Text style={styles.description}>
              Endişelenme, bu senin hatan değil. Uygulama beklenmedik bir durumla karşılaştı. 
              Verilerini kaybetmedin ve birkaç saniye içinde her şey normale dönecek.
            </Text>
            
            <Text style={styles.suggestion}>
              💡 İpucu: Bu durumlar nadiren olur ve genellikle uygulamayı yeniden başlatmak sorunu çözer.
            </Text>
            
            {/* Action Buttons - Master Prompt: Kontrolü kullanıcıya ver */}
            <View style={styles.actions}>
              <Pressable 
                style={styles.primaryButton} 
                onPress={this.handleRestart}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Yeniden Başlat</Text>
              </Pressable>
              
              <Pressable 
                style={styles.secondaryButton} 
                onPress={this.handleReportIssue}
              >
                <MaterialCommunityIcons name="bug" size={20} color="#6B7280" />
                <Text style={styles.secondaryButtonText}>Sorunu Bildir</Text>
              </Pressable>
            </View>
            
            {/* Technical Details (Collapsible) */}
            {__DEV__ && this.state.error && (
              <View style={styles.technicalDetails}>
                <Text style={styles.technicalTitle}>🔧 Geliştirici Bilgileri:</Text>
                <Text style={styles.technicalText}>
                  {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <Text style={styles.technicalStack}>
                    {this.state.error.stack.slice(0, 200)}...
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  suggestion: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 32,
    fontFamily: 'Inter',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  technicalDetails: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    width: '100%',
  },
  technicalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  technicalText: {
    fontSize: 12,
    color: '#7F1D1D',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  technicalStack: {
    fontSize: 10,
    color: '#991B1B',
    fontFamily: 'monospace',
    opacity: 0.8,
  },
});

export default ErrorBoundary; 