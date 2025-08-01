/**
 * ObsessLess AI Sohbet Arayüzü
 * 
 * Empatik, erişilebilir ve terapötik olarak etkili sohbet deneyimi.
 * "Sakinlik Her Şeyden Önce Gelir" ilkesine uygun tasarım.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideInDown,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Types
import { AIMessage, MessageType } from '@/ai/types';

// Store
import { useAIChatStore } from '@/store/aiChatStore';

// Components
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Constants
const TYPING_ANIMATION_DURATION = 1500;
const MAX_MESSAGE_LENGTH = 1000;
const SUGGESTION_CHIPS = [
  'Bugün nasıl hissediyorum?',
  'OKB ile başa çıkma teknikleri',
  'Bir egzersiz öner',
  'Kaygımı azaltmak istiyorum',
];

interface ChatInterfaceProps {
  onClose?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Store
  const {
    messages,
    isTyping,
    conversationState,
    sendMessage,
    clearConversation,
  } = useAIChatStore();
  
  // Local state
  const [inputText, setInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Animations
  const typingDot1 = useSharedValue(0);
  const typingDot2 = useSharedValue(0);
  const typingDot3 = useSharedValue(0);
  
  // Kriz durumu kontrolü
  const isCrisisMode = conversationState.mood === 'crisis';
  
  useEffect(() => {
    // Typing animasyonu
    if (isTyping) {
      typingDot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
      
      typingDot2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 200 }),
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
      
      typingDot3.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 400 }),
          withTiming(1, { duration: 200 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
    }
  }, [isTyping]);
  
  // Mesaj gönderme
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || inputText.length > MAX_MESSAGE_LENGTH) return;
    
    const messageText = inputText.trim();
    setInputText('');
    setShowSuggestions(false);
    
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Mesajı gönder
    await sendMessage(messageText);
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, sendMessage]);
  
  // Öneri seçimi
  const handleSuggestionPress = useCallback((suggestion: string) => {
    setInputText(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);
  
  // Mesaj baloncuğu render
  const renderMessage = (message: AIMessage, index: number) => {
    const isUser = message.role === 'user';
    
    return (
      <Animated.View
        key={message.id}
        entering={isUser ? SlideInDown : SlideInUp}
        layout={Layout}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'Sen' : 'ObsessLess'}: ${message.content}`}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            message.type === 'crisis_support' && styles.crisisBubble,
          ]}
        >
          {/* Mesaj tipi ikonu */}
          {message.type !== 'text' && (
            <MaterialCommunityIcons
              name={getMessageTypeIcon(message.type)}
              size={16}
              color={isUser ? '#FFFFFF' : '#10B981'}
              style={styles.messageTypeIcon}
            />
          )}
          
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.assistantMessageText,
            ]}
          >
            {message.content}
          </Text>
          
          {/* Zaman damgası */}
          <Text style={styles.timestamp}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
        
        {/* Kullanıcı geri bildirimi */}
        {!isUser && message.type !== 'crisis_support' && (
          <View style={styles.feedbackContainer}>
            <Pressable
              onPress={() => handleFeedback(message.id, true)}
              style={styles.feedbackButton}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Faydalı"
            >
              <MaterialCommunityIcons
                name="thumb-up-outline"
                size={16}
                color="#6B7280"
              />
            </Pressable>
            <Pressable
              onPress={() => handleFeedback(message.id, false)}
              style={styles.feedbackButton}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Faydalı değil"
            >
              <MaterialCommunityIcons
                name="thumb-down-outline"
                size={16}
                color="#6B7280"
              />
            </Pressable>
          </View>
        )}
      </Animated.View>
    );
  };
  
  // Typing indicator
  const renderTypingIndicator = () => {
    const dot1Style = useAnimatedStyle(() => ({
      opacity: typingDot1.value,
    }));
    
    const dot2Style = useAnimatedStyle(() => ({
      opacity: typingDot2.value,
    }));
    
    const dot3Style = useAnimatedStyle(() => ({
      opacity: typingDot3.value,
    }));
    
    return (
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={styles.typingContainer}
      >
        <View style={styles.typingBubble}>
          <Animated.View style={[styles.typingDot, dot1Style]} />
          <Animated.View style={[styles.typingDot, dot2Style]} />
          <Animated.View style={[styles.typingDot, dot3Style]} />
        </View>
      </Animated.View>
    );
  };
  
  // Kriz uyarı kartı
  const renderCrisisCard = () => (
    <Animated.View
      entering={SlideInUp}
      style={styles.crisisCard}
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Acil durum desteği mevcut"
    >
      <MaterialCommunityIcons
        name="heart-pulse"
        size={32}
        color="#EF4444"
        style={styles.crisisIcon}
      />
      <Text style={styles.crisisTitle}>Seni Anlıyorum</Text>
      <Text style={styles.crisisText}>
        Zor bir dönemden geçiyor gibi görünüyorsun. Yalnız değilsin ve yardım almak güç gerektirir.
      </Text>
      
      <View style={styles.crisisActions}>
        <Button
          title="Acil Destek Hattı"
          onPress={handleEmergencyContact}
          style={styles.crisisButton}
          icon="phone"
        />
        <Button
          title="Nefes Egzersizi"
          onPress={handleBreathingExercise}
          variant="outline"
          style={styles.crisisButton}
          icon="meditation"
        />
      </View>
      
      <Text style={styles.crisisNote}>
        * Bu öneriler profesyonel yardımın yerini tutmaz
      </Text>
    </Animated.View>
  );
  
  // Öneri çipleri
  const renderSuggestions = () => {
    if (!showSuggestions || messages.length > 0) return null;
    
    return (
      <Animated.View
        entering={FadeIn}
        style={styles.suggestionsContainer}
      >
        <Text style={styles.suggestionsTitle}>Nasıl yardımcı olabilirim?</Text>
        <View style={styles.suggestionChips}>
          {SUGGESTION_CHIPS.map((suggestion, index) => (
            <Pressable
              key={index}
              onPress={() => handleSuggestionPress(suggestion)}
              style={({ pressed }) => [
                styles.suggestionChip,
                pressed && styles.suggestionChipPressed,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={suggestion}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    );
  };
  
  // Yardımcı fonksiyonlar
  const getMessageTypeIcon = (type: MessageType): string => {
    switch (type) {
      case 'insight': return 'lightbulb-outline';
      case 'exercise_prompt': return 'run';
      case 'reflection': return 'thought-bubble-outline';
      case 'encouragement': return 'heart-outline';
      case 'crisis_support': return 'lifebuoy';
      default: return 'chat-outline';
    }
  };
  
  const formatTime = (date: Date): string => {
    return new Date(date).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const handleFeedback = async (messageId: string, helpful: boolean) => {
    // TODO: Implement feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleEmergencyContact = () => {
    Alert.alert(
      'Acil Destek',
      'Acil destek hattına yönlendirileceksiniz. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ara', onPress: () => {/* TODO: Call emergency */} },
      ]
    );
  };
  
  const handleBreathingExercise = () => {
    // TODO: Navigate to breathing exercise
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="robot-happy-outline"
            size={24}
            color="#10B981"
          />
          <Text style={styles.headerTitle}>ObsessLess AI</Text>
          {isTyping && <ActivityIndicator size="small" color="#10B981" />}
        </View>
        
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Sohbeti kapat"
        >
          <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
        </Pressable>
      </View>
      
      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hoş geldin mesajı */}
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <MaterialCommunityIcons
              name="hand-wave"
              size={48}
              color="#10B981"
            />
            <Text style={styles.welcomeTitle}>Merhaba! 👋</Text>
            <Text style={styles.welcomeText}>
              Ben senin AI destekçinim. OKB yolculuğunda sana eşlik etmek için buradayım.
              Nasıl hissediyorsun?
            </Text>
          </View>
        )}
        
        {/* Öneriler */}
        {renderSuggestions()}
        
        {/* Mesajlar */}
        {messages.map((message, index) => renderMessage(message, index))}
        
        {/* Typing indicator */}
        {isTyping && renderTypingIndicator()}
        
        {/* Kriz kartı */}
        {isCrisisMode && renderCrisisCard()}
      </ScrollView>
      
      {/* Input */}
      {!isCrisisMode && (
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Mesajını yaz..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            accessible
            accessibilityRole="none"
            accessibilityLabel="Mesaj girişi"
            accessibilityHint="Mesajını yaz ve gönder butonuna bas"
          />
          
          <Pressable
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isTyping}
            style={({ pressed }) => [
              styles.sendButton,
              (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
              pressed && styles.sendButtonPressed,
            ]}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Mesajı gönder"
            accessibilityState={{ disabled: !inputText.trim() || isTyping }}
          >
            <MaterialCommunityIcons
              name="send"
              size={24}
              color={inputText.trim() && !isTyping ? '#FFFFFF' : '#9CA3AF'}
            />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  
  // Welcome
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  
  // Suggestions
  suggestionsContainer: {
    marginTop: 24,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  suggestionChipPressed: {
    backgroundColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
  },
  
  // Message
  messageContainer: {
    marginVertical: 4,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#10B981',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  crisisBubble: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#111827',
  },
  messageTypeIcon: {
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  
  // Feedback
  feedbackContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginLeft: 8,
  },
  feedbackButton: {
    padding: 4,
  },
  
  // Typing
  typingContainer: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
  typingBubble: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  
  // Crisis
  crisisCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  crisisIcon: {
    marginBottom: 12,
  },
  crisisTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  crisisText: {
    fontSize: 16,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  crisisActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  crisisButton: {
    minWidth: 140,
  },
  crisisNote: {
    fontSize: 12,
    color: '#991B1B',
    fontStyle: 'italic',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
}); 