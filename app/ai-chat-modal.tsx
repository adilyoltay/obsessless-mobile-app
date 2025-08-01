/**
 * AI Chat Modal
 * 
 * Full-screen AI chat interface
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChatInterface } from '@/features/ai/components/ChatInterface';
import { useAIChatStore } from '@/features/ai/store/aiChatStore';
import { AIMessage } from '@/features/ai/types';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

export default function AIChatModal() {
  const router = useRouter();
  const chatStore = useAIChatStore();
  const [sessionId] = useState(`chat_${Date.now()}`);

  // Feature flag kontrolü
  if (!FEATURE_FLAGS.AI_CHAT) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.disabledContainer}>
          <MaterialCommunityIcons name="robot-off" size={64} color="#9CA3AF" />
          <Text style={styles.disabledTitle}>AI Chat Devre Dışı</Text>
          <Text style={styles.disabledText}>
            Bu özellik şu anda kullanılamıyor.
          </Text>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleSendMessage = async (message: string): Promise<AIMessage> => {
    // Burada gerçek AI servisi çağrılacak
    // Şimdilik mock response
    const mockResponses = [
      "Anladım, bugün kendinizi endişeli hissediyorsunuz. Bu duyguları daha detaylı anlatır mısınız?",
      "OKB ile mücadele etmek zor olabilir. Hangi kompulsiyonlar sizi en çok zorluyor?",
      "Harika bir ilerleme! Kompulsiyonlarınızı fark etmek önemli bir adım. Şimdi bunlarla nasıl başa çıkabileceğimizi konuşalım.",
      "Nefes egzersizleri yapmayı denediniz mi? Size yardımcı olabilecek birkaç teknik önerebilirim.",
      "Kendinize karşı nazik olun. İyileşme süreci inişli çıkışlı olabilir ve bu tamamen normal."
    ];

    const response: AIMessage = {
      id: `ai_${Date.now()}`,
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      role: 'assistant',
      timestamp: new Date(),
      metadata: {
        sessionId,
        contextType: 'chat',
        confidence: 0.9
      }
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    return response;
  };

  const handleCrisisDetected = () => {
    Alert.alert(
      '⚠️ Önemli',
      'Zor bir dönemden geçiyor gibi görünüyorsunuz. Profesyonel destek almanızı öneriyorum.',
      [
        {
          text: 'Acil Hatlar',
          onPress: () => {
            Alert.alert(
              'Acil Destek Hatları',
              '🆘 Ruh Sağlığı Destek Hattı: 182\n🚨 Acil Tıbbi Yardım: 112',
              [{ text: 'Tamam' }]
            );
          }
        },
        { text: 'Devam Et', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          presentation: 'modal',
          title: 'AI Asistan',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="close" size={24} color="#374151" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'AI Asistan Hakkında',
                  'Bu AI asistan, OKB ile mücadelenizde size destek olmak için tasarlandı. Profesyonel tıbbi tavsiye yerine geçmez.',
                  [{ text: 'Anladım' }]
                );
              }}
              style={styles.headerButton}
            >
              <MaterialCommunityIcons name="information" size={24} color="#374151" />
            </Pressable>
          ),
        }}
      />

      <ChatInterface
        sessionId={sessionId}
        userId="current-user" // Auth'dan alınacak
        onSendMessage={handleSendMessage}
        onCrisisDetected={handleCrisisDetected}
        placeholder="AI asistana bir şey sorun..."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerButton: {
    padding: 8,
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  disabledText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
}); 