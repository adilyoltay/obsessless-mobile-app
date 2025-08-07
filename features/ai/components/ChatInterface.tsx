/**
 * 💬 AI Chat Interface - Advanced Chat UI Component
 * 
 * Bu component modern, erişilebilir ve terapötik bir chat interface sağlar.
 * Sprint 1-2'deki güvenlik sistemleriyle tam entegre çalışır.
 * 
 * ⚠️ CRITICAL: Error Boundary ile wrap edilmeli
 * ⚠️ Feature flag kontrolü component seviyesinde yapılır
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAIChatStore } from '@/features/ai/store/aiChatStore';
import { AIChatErrorBoundary } from '@/features/ai/components/ErrorBoundary';
import { crisisDetectionService } from '@/features/ai/safety/crisisDetection';
import { AIMessage, CrisisRiskLevel, ConversationState } from '@/features/ai/types';

// =============================================================================
// 🎯 CHAT INTERFACE TYPES
// =============================================================================

interface ChatInterfaceProps {
  onConversationStateChange?: (state: ConversationState) => void;
  showHeader?: boolean;
  containerStyle?: any;
}

interface MessageBubbleProps {
  message: AIMessage;
  isLastMessage: boolean;
  onRetry?: () => void;
}

interface CrisisHelpBannerProps {
  riskLevel: CrisisRiskLevel;
  onDismiss: () => void;
}

// =============================================================================
// 💬 MAIN CHAT INTERFACE COMPONENT
// =============================================================================

const ChatInterfaceCore: React.FC<ChatInterfaceProps> = ({
  onConversationStateChange,
  showHeader = true,
  containerStyle
}) => {
  const { user } = useAuthContext();
  
  // Store state
  const {
    isEnabled,
    isInitialized,
    conversations,
    activeConversationId,
    ui,
    currentSession,
    // Actions
    initialize,
    shutdown,
    sendMessage,
    retryLastMessage,
    setInputText,
    clearError,
    dismissCrisisHelp,
    updateConversationState
  } = useAIChatStore();

  // Refs for animations and scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Current conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // =============================================================================
  // 🚀 LIFECYCLE & INITIALIZATION
  // =============================================================================

  useEffect(() => {
    if (!user?.id) return;

    // Initialize store
    initialize(user.id);

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Cleanup on unmount
    return () => {
      shutdown();
    };
  }, [user?.id]);

  // Feature flag disabled fallback
  if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
    return (
      <View style={styles.disabledContainer}>
        <MaterialCommunityIcons name="robot-off" size={64} color="#CBD5E0" />
        <Text style={styles.disabledTitle}>AI Chat Devre Dışı</Text>
        <Text style={styles.disabledMessage}>
          AI Chat özelliği şu anda kullanılamıyor. Bu özellik henüz geliştirilme aşamasında.
        </Text>
      </View>
    );
  }

  // Not initialized yet
  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>AI Chat hazırlanıyor...</Text>
      </View>
    );
  }

  // Not enabled (error state)
  if (!isEnabled) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Bağlantı Hatası</Text>
        <Text style={styles.errorMessage}>
          AI sistemi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => initialize(user?.id || '')}>
          <Text style={styles.retryButtonText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // =============================================================================
  // 🎛️ HANDLERS
  // =============================================================================

  const handleSendMessage = useCallback(async () => {
    if (!ui.inputText.trim() || ui.isLoading || !user?.id) return;

    const success = await sendMessage(ui.inputText, user.id);
    
    if (success) {
      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else {
      // Error haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [ui.inputText, ui.isLoading, user?.id, sendMessage]);

  const handleRetryMessage = useCallback(async () => {
    const success = await retryLastMessage();
    
    if (success) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [retryLastMessage]);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    
    // Context state tracking
    if (text.length > 100 && activeConversation?.context.currentState === ConversationState.STABLE) {
      updateConversationState(ConversationState.THERAPEUTIC);
      onConversationStateChange?.(ConversationState.THERAPEUTIC);
    }
  }, [setInputText, activeConversation, updateConversationState, onConversationStateChange]);

  const handleKeyPress = useCallback(({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // =============================================================================
  // 🎨 RENDER METHODS
  // =============================================================================

  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="robot" size={24} color="#10B981" />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>🧠 OKB Uzmanı AI</Text>
              <Text style={styles.headerSubtitle}>
                {currentSession ? 
                  `${currentSession.messageCount} mesaj • Güvenli alan` : 
                  'Hazırlanıyor...'
                }
              </Text>
            </View>
          </View>
          
          {/* Status indicator */}
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isEnabled ? '#10B981' : '#EF4444' }
          ]} />
        </View>
      </View>
    );
  };

  const renderCrisisHelp = () => {
    if (!ui.showCrisisHelp) return null;

    return (
      <CrisisHelpBanner 
        riskLevel={ui.lastCrisisLevel} 
        onDismiss={dismissCrisisHelp}
      />
    );
  };

  const renderMessages = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.messagesContainer}
      contentContainerStyle={styles.messagesContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLastMessage={index === messages.length - 1}
          onRetry={message.role === 'assistant' ? handleRetryMessage : undefined}
        />
      ))}
      
      {ui.isTyping && (
        <TypingIndicator />
      )}
    </ScrollView>
  );

  const renderInput = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.inputContainer}>
        {ui.error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert" size={16} color="#EF4444" />
            <Text style={styles.errorBannerText}>{ui.error}</Text>
            <TouchableOpacity onPress={clearError}>
              <MaterialCommunityIcons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={ui.inputText}
            onChangeText={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="OKB ile ilgili düşüncelerinizi paylaşın..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            editable={!ui.isLoading}
            textAlignVertical="top"
            accessibilityLabel="Mesaj yazma alanı"
            accessibilityHint="OKB konusunda düşüncelerinizi yazın"
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!ui.inputText.trim() || ui.isLoading) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!ui.inputText.trim() || ui.isLoading}
            accessibilityLabel="Mesaj gönder"
            accessibilityRole="button"
          >
            {ui.isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons 
                name="send" 
                size={20} 
                color="#FFFFFF" 
              />
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.inputHelper}>
          🔒 Güvenli • 🧠 AI destekli • 🌱 Terapötik yaklaşım
        </Text>
      </View>
    </KeyboardAvoidingView>
  );

  // =============================================================================
  // 🎨 MAIN RENDER
  // =============================================================================

  return (
    <Animated.View 
      style={[
        styles.container,
        containerStyle,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {renderHeader()}
      {renderCrisisHelp()}
      {renderMessages()}
      {renderInput()}
    </Animated.View>
  );
};

// =============================================================================
// 🧩 SUB-COMPONENTS
// =============================================================================

/**
 * Message Bubble Component
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isLastMessage, 
  onRetry 
}) => {
  const isUser = message.role === 'user';
  const isError = message.metadata?.crisisRisk === CrisisRiskLevel.CRITICAL;

  return (
    <View style={[
      styles.messageRow,
      isUser ? styles.userMessageRow : styles.aiMessageRow
    ]}>
      <View style={[
        styles.messageBubble,
        isUser ? styles.userMessage : styles.aiMessage,
        isError && styles.errorMessageBubble
      ]}>
        <Text style={[
          styles.messageText,
          isUser ? styles.userMessageText : styles.aiMessageText,
          isError && styles.errorMessageText
        ]}>
          {message.content}
        </Text>
        
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {message.timestamp.toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          
          {!isUser && message.metadata?.therapeuticIntent && (
            <View style={styles.intentTags}>
              {message.metadata.therapeuticIntent.slice(0, 2).map((intent, index) => (
                <Text key={index} style={styles.intentTag}>
                  {intent === 'support' ? '💙' : 
                   intent === 'crisis_intervention' ? '🚨' :
                   intent === 'empathy' ? '🤗' : '🧠'}
                </Text>
              ))}
            </View>
          )}
          
          {!isUser && isLastMessage && onRetry && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={onRetry}
              accessibilityLabel="Tekrar dene"
            >
              <MaterialCommunityIcons name="refresh" size={14} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

/**
 * Typing Indicator Component
 */
const TypingIndicator: React.FC = () => {
  const dotAnimation1 = useRef(new Animated.Value(0)).current;
  const dotAnimation2 = useRef(new Animated.Value(0)).current;
  const dotAnimation3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dotAnimation1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnimation2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnimation3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnimation1, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnimation2, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnimation3, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => animate());
    };

    animate();
  }, []);

  return (
    <View style={[styles.messageRow, styles.aiMessageRow]}>
      <View style={[styles.messageBubble, styles.aiMessage, styles.typingBubble]}>
        <Text style={styles.typingText}>AI uzmanınız düşünüyor</Text>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.typingDot, { opacity: dotAnimation1 }]} />
          <Animated.View style={[styles.typingDot, { opacity: dotAnimation2 }]} />
          <Animated.View style={[styles.typingDot, { opacity: dotAnimation3 }]} />
        </View>
      </View>
    </View>
  );
};

/**
 * Crisis Help Banner Component
 */
const CrisisHelpBanner: React.FC<CrisisHelpBannerProps> = ({ riskLevel, onDismiss }) => {
  const getBannerColor = () => {
    switch (riskLevel) {
      case CrisisRiskLevel.CRITICAL: return '#DC2626';
      case CrisisRiskLevel.HIGH: return '#EA580C';
      case CrisisRiskLevel.MEDIUM: return '#D97706';
      default: return '#059669';
    }
  };

  const getBannerText = () => {
    switch (riskLevel) {
      case CrisisRiskLevel.CRITICAL: 
        return 'Acil yardıma ihtiyacınız var. Lütfen 183\'ü arayın.';
      case CrisisRiskLevel.HIGH: 
        return 'Profesyonel destek almanızı öneriyoruz.';
      case CrisisRiskLevel.MEDIUM: 
        return 'İhtiyacınız olursa destek kaynaklarını kullanın.';
      default: 
        return 'Her şey yolunda, size yardımcı olmaya devam ediyoruz.';
    }
  };

  return (
    <View style={[styles.crisisBanner, { backgroundColor: getBannerColor() }]}>
      <MaterialCommunityIcons name="alert" size={20} color="#FFFFFF" />
      <Text style={styles.crisisBannerText}>{getBannerText()}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// 🎨 STYLES
// =============================================================================

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  
  // Disabled State
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  disabledMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Crisis Banner
  crisisBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  crisisBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    marginVertical: 4,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  aiMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.8,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  errorMessageBubble: {
    borderLeftColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#374151',
  },
  errorMessageText: {
    color: '#DC2626',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  intentTags: {
    flexDirection: 'row',
  },
  intentTag: {
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Typing Indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginHorizontal: 2,
  },
  
  // Input
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    marginHorizontal: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    backgroundColor: '#F9FAFB',
    color: '#374151',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E0',
  },
  inputHelper: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});

// =============================================================================
// 🎯 EXPORT WITH ERROR BOUNDARY
// =============================================================================

const ChatInterface: React.FC<ChatInterfaceProps> = (props) => (
  <AIChatErrorBoundary>
    <ChatInterfaceCore {...props} />
  </AIChatErrorBoundary>
);

export default ChatInterface;
export { ChatInterface, type ChatInterfaceProps };