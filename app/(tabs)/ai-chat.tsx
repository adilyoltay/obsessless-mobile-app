import React, { useState, useCallback } from 'react';
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
  Dimensions
} from 'react-native';
import { Stack } from 'expo-router';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const { height: screenHeight } = Dimensions.get('window');

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Merhaba 🌱 Ben sizin dijital destek arkadaşınızım. Buradayım ve sizi dinliyorum. Size nasıl yardımcı olabilirim?',
      isUser: false,
      timestamp: new Date()
    },
    {
      id: '2',
      text: 'Bu güvenli bir alan. Duygularınızı özgürce paylaşabilirsiniz. 💙',
      isUser: false,
      timestamp: new Date(Date.now() - 1000)
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(() => {
    if (!inputText.trim()) return;

    // Kullanıcı mesajını ekle
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // AI typing simulation
    setIsTyping(true);
    
    setTimeout(() => {
      const aiResponse = generateTherapeuticResponse(userMessage.text);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setIsTyping(false);
      setMessages(prev => [...prev, botMessage]);
    }, 1500 + Math.random() * 1000);
  }, [inputText]);

  const generateTherapeuticResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    // OKB-Spesifik Terapötik Yanıtlar
    if (input.includes('kompulsiyon') || input.includes('takıntı') || input.includes('ritual') || input.includes('obsesyon')) {
      const responses = [
        'Kompulsiyonlar gerçekten zorlayıcı olabilir. Bu anı fark etmeniz çok önemli bir adım. 🌱 Şu anda nasıl hissediyorsunuz?',
        'OKB ile mücadele cesaret gerektirir. Her fark etme anı bir zaferdir. 💪 Bu durumla nasıl başa çıkmaya çalışıyorsunuz?',
        'Kompulsiyonları gözlemlemek, onları kontrol etmeye çalışmaktan daha güçlüdür. 🧘‍♀️ Şu anda hangi düşünceler aklınızdan geçiyor?'
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    if (input.includes('anksiyete') || input.includes('kaygı') || input.includes('korku') || input.includes('endişe')) {
      const responses = [
        'Anksiyete doğal bir tepki. Nefes alma pratiği deneyelim mi? 4 saniye nefes alın, 4 saniye tutun, 6 saniye bırakın. 🧘‍♀️',
        'Kaygı geçicidir, siz kalıcısınız. Şu anda hangi duyumları vücudunuzda hissediyorsunuz? 💙',
        'Bu anksiyeteyle birlikte olmak cesaret gerektirir. Sizinle birlikte nefes alalım. 🌊'
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    if (input.includes('erp') || input.includes('maruz') || input.includes('alıştırma')) {
      return 'ERP egzersizleri en etkili tedavi yöntemlerinden biri. Küçük adımlarla başlamak en iyisidir. 🚀 Hangi alanda kendinizi hazır hissediyorsunuz?';
    }
    
    if (input.includes('üzgün') || input.includes('depresyon') || input.includes('umutsuz') || input.includes('kötü')) {
      return 'Bu zor duygular geçicidir ve siz değerlisiniz. İyileşme doğrusal değildir. 💜 Bugün kendinize nasıl nazik davranabilirsiniz?';
    }
    
    if (input.includes('yardım') || input.includes('destek') || input.includes('ne yapmalı')) {
      return 'Size yardım etmek için buradayım. 🤝 OKB ile yaşamak kolay değil ama yalnız değilsiniz. Kompulsiyonlar, ERP teknikleri, nefes çalışmaları veya günlük başa çıkma stratejileri hakkında konuşabiliriz.';
    }
    
    // Genel destekleyici yanıt
    const generalResponses = [
      'Sizi dikkatlice dinliyorum. Bu duygularınızı paylaştığınız için cesursunuz. 💙 Biraz daha anlatır mısınız?',
      'Her yaşadığınız deneyim değerlidir. 🌱 Bu durumla ilgili daha fazla bilgi paylaşabilir misiniz?',
      'Yanınızdayım ve sizi anlıyorum. 🤗 Size nasıl daha iyi destek olabilirim?',
      'Duygularınız geçerli ve önemli. 💜 Bu konuda neler düşünüyorsunuz?'
    ];
    
    return generalResponses[Math.floor(Math.random() * generalResponses.length)];
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
      
      <Stack.Screen 
        options={{ 
          title: 'Destek Arkadaşınız',
          headerStyle: { backgroundColor: '#F7FAFC' },
          headerTitleStyle: { color: '#2D3748', fontSize: 18, fontWeight: '600' },
          headerShadowVisible: false,
        }} 
      />

      <View style={styles.container}>
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>🤖 ObsessLess AI Asistan</Text>
          <Text style={styles.headerSubtitle}>• Güvenli alan • Yargısız dinleme • 7/24 destek</Text>
        </View>

        {/* Messages Container - Fixed Height */}
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
                    message.isUser ? styles.userMessage : styles.aiMessage
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    message.isUser ? styles.userMessageText : styles.aiMessageText
                  ]}>
                    {message.text}
                  </Text>
                  <Text style={styles.timestamp}>
                    {message.timestamp.toLocaleTimeString('tr-TR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              </View>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <View style={[styles.messageRow, styles.aiMessageRow]}>
                <View style={[styles.messageBubble, styles.aiMessage]}>
                  <Text style={styles.typingText}>💭 Düşünüyor...</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Input Area - ABSOLUTE BOTTOM FIXED */}
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
                placeholder="Duygularınızı paylaşabilirsiniz..."
                placeholderTextColor="#A0AEC0"
                multiline
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  !inputText.trim() && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!inputText.trim()}
              >
                <Text style={styles.sendButtonText}>💌</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputHelperText}>
              • Güvenli alan • Yargısız dinleme • Gizli kalır
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
  },
  messagesWrapper: {
    flex: 1,
    marginBottom: 0, // Remove any bottom margin
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
  timestamp: {
    fontSize: 11,
    marginTop: 6,
    opacity: 0.6,
    color: '#718096',
    fontWeight: '300',
  },
  typingText: {
    fontSize: 14,
    color: '#68D391',
    fontStyle: 'italic',
  },
  // CRITICAL: BOTTOM TAB SAFE INPUT AREA
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 90 : 75, // INCREASED for bottom tab + safe area
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
    maxHeight: 100,
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