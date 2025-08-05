import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  SafeAreaView,
  Alert
} from 'react-native';
import { Stack } from 'expo-router';
import AIChatService from '@/services/aiChatService';
import { ChatMessage } from '@/services/aiChatService';
import { ChatContext } from '@/constants/aiConfig';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';

interface DisplayMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  provider?: string;
  isError?: boolean;
}

export default function AIChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: '1',
      text: 'Merhaba! 🌱 Ben ObsessLess AI uzmanınızım. OKB konusunda size destek olmak için buradayım. Bugün nasıl hissediyorsunuz?',
      isUser: false,
      timestamp: new Date(),
      provider: 'system'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!isFeatureEnabled('AI_CHAT')) {
      Alert.alert(
        'AI Chat Devre Dışı',
        'AI Chat özelliği şu anda kullanılamıyor.',
        [{ text: 'Tamam' }]
      );
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isTyping) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    const userChatMessage: ChatMessage = {
      role: 'user',
      content: userMessage.text,
      timestamp: new Date()
    };

    const updatedHistory = [...chatHistory, userChatMessage];
    setChatHistory(updatedHistory);

    try {
      const context: ChatContext = {
        userProfile: {
          ocdSymptoms: ['contamination', 'checking'],
          severityLevel: 6,
          triggerAreas: ['bathroom', 'kitchen'],
          copingStrategies: ['breathing', 'grounding']
        },
        currentMood: 'anxious',
        sessionHistory: []
      };

      const aiResponse = await AIChatService.sendMessage(
        userMessage.text,
        context,
        updatedHistory
      );

      const aiMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.message,
        isUser: false,
        timestamp: new Date(),
        provider: aiResponse.provider,
        isError: !aiResponse.success
      };

      setMessages(prev => [...prev, aiMessage]);
      setCurrentProvider(aiResponse.provider);

      const aiChatMessage: ChatMessage = {
        role: 'assistant',
        content: aiResponse.message,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiChatMessage]);

    } catch (error) {
      console.error('[AI Chat Error]:', error);

      const errorMessage: DisplayMessage = {
        id: (Date.now() + 2).toString(),
        text: 'Üzgünüm, şu anda teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin. 🔧\n\nBu arada nefes alma egzersizi yapmayı deneyin: 4 saniye nefes alın, 4 saniye tutun, 6 saniye bırakın. 🧘‍♀️',
        isUser: false,
        timestamp: new Date(),
        provider: 'error',
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, chatHistory]);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />

      <Stack.Screen
        options={{
          title: 'AI Uzman Desteği',
          headerStyle: { backgroundColor: '#F7FAFC' },
          headerTitleStyle: { color: '#2D3748', fontSize: 18, fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.container}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>🧠 OKB Uzmanı AI Asistan</Text>
          <Text style={styles.headerSubtitle}>
            {currentProvider
              ? `• ${currentProvider.toUpperCase()} ile güçlendirildi • Güvenli ve gizli`
              : '• Güvenli alan • Yargısız dinleme • 7/24 destek'
            }
          </Text>
        </View>

        <View style={styles.messagesWrapper}>
          <ScrollView
            style={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.isUser ? styles.userMessageRow : styles.aiMessageRow
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    message.isUser ? styles.userMessage : styles.aiMessage,
                    message.isError && styles.errorMessage
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    message.isUser ? styles.userMessageText : styles.aiMessageText,
                    message.isError && styles.errorMessageText
                  ]}>
                    {message.text}
                  </Text>
                  <View style={styles.messageFooter}>
                    <Text style={styles.timestamp}>
                      {message.timestamp.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                    {message.provider && message.provider !== 'system' && (
                      <Text style={styles.providerTag}>
                        {message.provider === 'error' ? '⚠️' : `🤖 ${message.provider}`}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}

            {isTyping && (
              <View style={[styles.messageRow, styles.aiMessageRow]}>
                <View style={[styles.messageBubble, styles.aiMessage]}>
                  <Text style={styles.typingText}>🧠 AI uzmanınız düşünüyor...</Text>
                  <Text style={styles.typingSubtext}>Kişiselleştirilmiş yanıt hazırlanıyor</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="OKB ile ilgili düşüncelerinizi paylaşın..."
                placeholderTextColor="#A0AEC0"
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                editable={!isTyping}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isTyping) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!inputText.trim() || isTyping}
              >
                <Text style={styles.sendButtonText}>
                  {isTyping ? '⏳' : '🚀'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHelperText}>
              • AI uzman desteği • Bilimsel kanıta dayalı • Tamamen gizli
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  headerInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#718096',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  messagesWrapper: {
    flex: 1,
    marginBottom: 0,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageRow: {
    marginVertical: 6,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  aiMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#CBD5E0',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  userMessage: {
    backgroundColor: '#E2E8F0',
    borderBottomRightRadius: 6,
  },
  aiMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#68D391',
  },
  errorMessage: {
    borderLeftColor: '#F56565',
    backgroundColor: '#FED7D7',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  userMessageText: {
    color: '#2D3748',
  },
  aiMessageText: {
    color: '#2D3748',
  },
  errorMessageText: {
    color: '#C53030',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.6,
    color: '#718096',
    fontWeight: '300',
  },
  providerTag: {
    fontSize: 10,
    color: '#68D391',
    fontWeight: '500',
  },
  typingText: {
    fontSize: 14,
    color: '#68D391',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  typingSubtext: {
    fontSize: 12,
    color: '#A0AEC0',
    fontStyle: 'italic',
    marginTop: 2,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    maxHeight: 120,
    marginRight: 12,
    backgroundColor: '#F7FAFC',
    color: '#2D3748',
    minHeight: 48,
    fontWeight: '400',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#68D391',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#68D391',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 18,
  },
  inputHelperText: {
    fontSize: 12,
    color: '#A0AEC0',
    textAlign: 'center',
    fontWeight: '300',
    fontStyle: 'italic',
  },
}); 