/**
 * AI Chat Interface Component
 * 
 * KRITIK: Bu komponent features/ai/ altında tamamen izole
 * AI kapalıysa fallback UI gösterir
 * Error boundary ile korunur
 * Feature flag kontrolü zorunlu
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Animated,
  StyleSheet,
  AccessibilityInfo,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  AIMessageMetadata,
  AIError,
  AIErrorCode 
} from '@/features/ai/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Mesaj tipi enum'ı
enum MessageType {
  TEXT = 'text',
  SUGGESTION = 'suggestion',
  CRISIS_ALERT = 'crisis_alert',
  SYSTEM = 'system'
}

// Mesaj durumu enum'ı
enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  DELIVERED = 'delivered'
}

interface ChatMessage extends AIMessage {
  type: MessageType;
  status: MessageStatus;
  suggestions?: string[];
  isTyping?: boolean;
  error?: AIError;
}

interface ChatInterfaceProps {
  sessionId: string;
  userId: string;
  onSendMessage: (message: string) => Promise<AIMessage>;
  onCrisisDetected?: () => void;
  initialMessages?: ChatMessage[];
  placeholder?: string;
  disabled?: boolean;
}

// Fallback component for when AI is disabled
const ChatFallback: React.FC = () => (
  <View style={styles.fallbackContainer}>
    <MaterialCommunityIcons name="robot-off" size={64} color="#9CA3AF" />
    <Text style={styles.fallbackTitle}>AI Chat Özelliği Kapalı</Text>
    <Text style={styles.fallbackText}>
      Bu özellik şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.
    </Text>
  </View>
);

// Error boundary wrapper
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ChatInterface] Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Ana chat interface komponenti
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  userId,
  onSendMessage,
  onCrisisDetected,
  initialMessages = [],
  placeholder = "Mesajınızı yazın...",
  disabled = false
}) => {
  // Feature flag kontrolü
  if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
    return <ChatFallback />;
  }

  return (
    <ChatErrorBoundary fallback={<ChatFallback />}>
      <ActualChatInterface
        sessionId={sessionId}
        userId={userId}
        onSendMessage={onSendMessage}
        onCrisisDetected={onCrisisDetected}
        initialMessages={initialMessages}
        placeholder={placeholder}
        disabled={disabled}
      />
    </ChatErrorBoundary>
  );
};

// Gerçek chat interface implementasyonu
const ActualChatInterface: React.FC<ChatInterfaceProps> = ({
  sessionId,
  userId,
  onSendMessage,
  onCrisisDetected,
  initialMessages = [],
  placeholder,
  disabled
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const typingAnimation = useRef(new Animated.Value(0)).current;

  // Accessibility announcement
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      'AI sohbet arayüzü açıldı. Mesaj göndermek için metin kutusunu kullanın.'
    );
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Typing animation
  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingAnimation.setValue(0);
    }
  }, [isTyping, typingAnimation]);

  // Mesaj gönderme
  const handleSend = async () => {
    if (!inputText.trim() || isSending || disabled) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Kullanıcı mesajını ekle
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      content: messageText,
      role: 'user',
      timestamp: new Date(),
      type: MessageType.TEXT,
      status: MessageStatus.SENDING,
      metadata: {
        sessionId,
        contextType: 'chat'
      }
    };

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();

    // Typing indicator göster
    setIsTyping(true);

    try {
      // AI yanıtını al
      const aiResponse = await onSendMessage(messageText);
      
      // Kullanıcı mesajını güncelle (sent durumu)
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: MessageStatus.SENT }
            : msg
        )
      );

      // Crisis kontrolü
      if (aiResponse.metadata?.safety_score && aiResponse.metadata.safety_score < 0.3) {
        handleCrisisDetection();
      }

      // AI mesajını ekle
      const aiMessage: ChatMessage = {
        ...aiResponse,
        type: MessageType.TEXT,
        status: MessageStatus.DELIVERED,
        suggestions: extractSuggestions(aiResponse.content)
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Accessibility announcement
      AccessibilityInfo.announceForAccessibility(
        `AI yanıtı: ${aiResponse.content}`
      );
    } catch (error) {
      console.error('[ChatInterface] Send error:', error);
      
      // Hata mesajı ekle
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        content: 'Üzgünüm, mesajınız gönderilemedi. Lütfen tekrar deneyin.',
        role: 'assistant',
        timestamp: new Date(),
        type: MessageType.SYSTEM,
        status: MessageStatus.FAILED,
        error: error as AIError
      };

      setMessages(prev => [...prev, errorMessage]);
      
      // Kullanıcı mesajını failed olarak işaretle
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: MessageStatus.FAILED }
            : msg
        )
      );
    } finally {
      setIsTyping(false);
      setIsSending(false);
      scrollToBottom();
    }
  };

  // Crisis detection
  const handleCrisisDetection = () => {
    const crisisMessage: ChatMessage = {
      id: `crisis_${Date.now()}`,
      content: 'Zor bir dönemden geçiyor gibi görünüyorsunuz. Profesyonel destek almanızı öneriyorum.',
      role: 'system',
      timestamp: new Date(),
      type: MessageType.CRISIS_ALERT,
      status: MessageStatus.DELIVERED,
      metadata: {
        sessionId,
        contextType: 'crisis'
      }
    };

    setMessages(prev => [...prev, crisisMessage]);
    onCrisisDetected?.();
    
    Alert.alert(
      'Önemli',
      'Eğer kendinize zarar verme düşünceleriniz varsa, lütfen hemen 182 Ruh Sağlığı Destek Hattını arayın.',
      [
        { text: 'Tamam', style: 'default' },
        { text: '182\'yi Ara', onPress: () => {/* Tel link */} }
      ]
    );
  };

  // Suggestion'a tıklama
  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    inputRef.current?.focus();
  };

  // Mesaj retry
  const handleRetry = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.role === 'user') {
      setInputText(message.content);
      // Başarısız mesajı kaldır
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  };

  // Mesaj render
  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const showAvatar = index === 0 || messages[index - 1]?.role !== message.role;

    return (
      <Animated.View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
          {
            opacity: message.isTyping ? typingAnimation : 1,
          }
        ]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'Siz' : 'AI'}: ${message.content}`}
      >
        {!isUser && showAvatar && (
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons 
              name="robot-happy" 
              size={24} 
              color="#10B981" 
            />
          </View>
        )}

        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          message.type === MessageType.CRISIS_ALERT && styles.crisisBubble,
          message.status === MessageStatus.FAILED && styles.failedBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.aiText,
            message.type === MessageType.CRISIS_ALERT && styles.crisisText
          ]}>
            {message.content}
          </Text>

          {/* Status indicator */}
          {isUser && (
            <View style={styles.statusContainer}>
              {message.status === MessageStatus.SENDING && (
                <ActivityIndicator size="small" color="#9CA3AF" />
              )}
              {message.status === MessageStatus.SENT && (
                <MaterialCommunityIcons name="check" size={14} color="#9CA3AF" />
              )}
              {message.status === MessageStatus.DELIVERED && (
                <MaterialCommunityIcons name="check-all" size={14} color="#10B981" />
              )}
              {message.status === MessageStatus.FAILED && (
                <Pressable onPress={() => handleRetry(message.id)}>
                  <MaterialCommunityIcons name="alert-circle" size={14} color="#EF4444" />
                </Pressable>
              )}
            </View>
          )}

          {/* Timestamp */}
          <Text style={styles.timestamp}>
            {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {message.suggestions.map((suggestion, idx) => (
              <Pressable
                key={idx}
                style={styles.suggestionButton}
                onPress={() => handleSuggestionPress(suggestion)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Öneri: ${suggestion}`}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  // Typing indicator
  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <Animated.View style={[styles.typingContainer, { opacity: typingAnimation }]}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, styles.typingDotMiddle]} />
        <View style={styles.typingDot} />
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((message, index) => renderMessage(message, index))}
          {renderTypingIndicator()}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            editable={!disabled && !isSending}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessible
            accessibilityLabel="Mesaj giriş alanı"
            accessibilityHint="Mesajınızı yazın ve göndermek için gönder butonuna basın"
          />
          
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending || disabled) && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending || disabled}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Mesaj gönder"
            accessibilityState={{ disabled: !inputText.trim() || isSending || disabled }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons 
                name="send" 
                size={24} 
                color={inputText.trim() && !disabled ? '#FFFFFF' : '#9CA3AF'} 
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Yardımcı fonksiyonlar
function extractSuggestions(content: string): string[] {
  // Basit suggestion extraction - gerçek uygulamada AI'dan gelmeli
  const suggestions: string[] = [];
  
  if (content.includes('stres')) {
    suggestions.push('Stres yönetimi teknikleri');
    suggestions.push('Nefes egzersizleri');
  }
  
  if (content.includes('uyku')) {
    suggestions.push('Uyku hijyeni önerileri');
    suggestions.push('Gevşeme teknikleri');
  }
  
  return suggestions.slice(0, 3); // Max 3 suggestion
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoid: {
    flex: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  fallbackText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  crisisBubble: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  failedBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#374151',
  },
  crisisText: {
    color: '#991B1B',
    fontWeight: '500',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 4,
    right: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    maxWidth: '80%',
  },
  suggestionButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 2,
  },
  typingDotMiddle: {
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
}); 