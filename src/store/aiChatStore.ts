/**
 * ObsessLess AI Sohbet Durum Yöneticisi
 * 
 * Zustand tabanlı gelişmiş sohbet state yönetimi.
 * Kalıcı bağlam, akıllı mesaj gruplama ve offline desteği sağlar.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Types
import { 
  AIMessage, 
  ConversationContext, 
  AIResponse,
  MessageType 
} from '@/ai/types';

// Services
import { detectCrisis } from '@/ai/safety/crisisDetection';
import { trackAIInteraction } from '@/telemetry/aiTelemetry';

// Utils
import { StorageKeys } from '@/utils/storage';

// Constants
const MAX_MESSAGES_IN_MEMORY = 100;
const CONTEXT_WINDOW_SIZE = 10; // Son 10 mesaj bağlam için kullanılır
const MESSAGE_GROUP_TIMEOUT = 60000; // 1 dakika

interface MessageGroup {
  id: string;
  messages: AIMessage[];
  startTime: Date;
  endTime: Date;
  topic?: string;
}

interface AIChatState {
  // Mesajlar ve gruplar
  messages: AIMessage[];
  messageGroups: MessageGroup[];
  currentGroupId: string | null;
  
  // Konuşma durumu
  conversationContext: ConversationContext;
  conversationState: {
    mood: 'positive' | 'neutral' | 'anxious' | 'distressed' | 'crisis';
    isActive: boolean;
    lastInteraction: Date;
  };
  
  // UI durumu
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Offline kuyruk
  offlineQueue: {
    id: string;
    message: string;
    timestamp: Date;
  }[];
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  receiveMessage: (response: AIResponse) => void;
  updateConversationContext: (updates: Partial<ConversationContext>) => void;
  clearConversation: () => void;
  loadConversationHistory: () => Promise<void>;
  retryOfflineMessages: () => Promise<void>;
  
  // Mesaj gruplama
  startNewMessageGroup: (topic?: string) => void;
  endCurrentMessageGroup: () => void;
  
  // Bağlam yönetimi
  getRecentContext: () => AIMessage[];
  updateMood: (mood: ConversationContext['state']['mood']) => void;
  
  // Yardımcı
  setTyping: (isTyping: boolean) => void;
  setError: (error: string | null) => void;
}

// Yardımcı fonksiyonlar
const generateMessageId = async (): Promise<string> => {
  const random = Math.random().toString();
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${random}`
  );
  return hash.substring(0, 16);
};

const createEmptyContext = (userId: string): ConversationContext => ({
  sessionId: '',
  userId,
  startTime: new Date(),
  lastActiveTime: new Date(),
  state: {
    mood: 'neutral',
    topics: [],
    exercises: [],
    insights: [],
  },
  ocdContext: {
    currentObsessions: [],
    recentCompulsions: [],
    triggerPatterns: [],
    copingStrategies: [],
    progressIndicators: {
      anxietyLevel: 5,
      resistanceSuccess: 0,
      insightLevel: 1,
    },
  },
  safetyTracking: {
    crisisFlags: 0,
    lastCrisisCheck: new Date(),
    interventionsSuggested: [],
    professionalReferralMade: false,
  },
  metrics: {
    messageCount: 0,
    averageResponseTime: 0,
    userEngagementScore: 0,
    therapeuticProgress: 0,
  },
});

// Store oluştur
export const useAIChatStore = create<AIChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      messageGroups: [],
      currentGroupId: null,
      conversationContext: createEmptyContext(''),
      conversationState: {
        mood: 'neutral',
        isActive: false,
        lastInteraction: new Date(),
      },
      isTyping: false,
      isLoading: false,
      error: null,
      offlineQueue: [],
      
      // Mesaj gönderme
      sendMessage: async (content: string) => {
        const state = get();
        const messageId = await generateMessageId();
        
        // Kullanıcı mesajını ekle
        const userMessage: AIMessage = {
          id: messageId,
          role: 'user',
          content,
          type: 'text',
          timestamp: new Date(),
          metadata: {
            privacyLevel: 'private',
          },
        };
        
        set({
          messages: [...state.messages, userMessage],
          isTyping: true,
          error: null,
          conversationState: {
            ...state.conversationState,
            lastInteraction: new Date(),
          },
        });
        
        // Mesaj sayısını güncelle
        state.updateConversationContext({
          metrics: {
            ...state.conversationContext.metrics,
            messageCount: state.conversationContext.metrics.messageCount + 1,
          },
        });
        
        // Kriz tespiti
        const crisisDetected = await detectCrisis(content);
        if (crisisDetected) {
          state.updateMood('crisis');
          await trackAIInteraction('safety.crisis_detected', {
            messageLength: content.length,
          }, 'sensitive');
        }
        
        // Telemetri
        await trackAIInteraction('message.sent', {
          messageLength: content.length,
          mood: state.conversationState.mood,
          sessionId: state.conversationContext.sessionId,
        });
        
        try {
          // TODO: AI servisine mesaj gönder
          // const response = await aiService.sendMessage(content, state.getRecentContext());
          
          // Simülasyon için dummy yanıt
          setTimeout(() => {
            const dummyResponse: AIResponse = {
              message: {
                id: 'dummy-' + Date.now(),
                role: 'assistant',
                content: 'Bu bir test yanıtıdır. Gerçek AI entegrasyonu yakında eklenecek.',
                type: 'text',
                timestamp: new Date(),
                metadata: {
                  model: 'gpt-4',
                  processingTime: 1500,
                  confidence: 0.95,
                  privacyLevel: 'private',
                },
              },
            };
            
            get().receiveMessage(dummyResponse);
          }, 1500);
          
        } catch (error) {
          console.error('Message send error:', error);
          
          // Offline kuyruğa ekle
          set({
            offlineQueue: [
              ...state.offlineQueue,
              {
                id: messageId,
                message: content,
                timestamp: new Date(),
              },
            ],
            isTyping: false,
            error: 'Mesaj gönderilemedi. İnternet bağlantınızı kontrol edin.',
          });
        }
      },
      
      // Mesaj alma
      receiveMessage: (response: AIResponse) => {
        const state = get();
        
        set({
          messages: [...state.messages, response.message],
          isTyping: false,
          conversationState: {
            ...state.conversationState,
            lastInteraction: new Date(),
          },
        });
        
        // Önerileri işle
        if (response.suggestions) {
          // TODO: Önerileri UI'da göster
        }
        
        // Egzersizleri işle
        if (response.exercises) {
          state.updateConversationContext({
            state: {
              ...state.conversationContext.state,
              exercises: [
                ...state.conversationContext.state.exercises,
                ...response.exercises.map(e => e.id),
              ],
            },
          });
        }
        
        // Telemetri
        trackAIInteraction('message.received', {
          responseTime: response.message.metadata?.processingTime,
          messageType: response.message.type,
          hasExercises: !!response.exercises,
          hasSuggestions: !!response.suggestions,
        });
      },
      
      // Bağlam güncelleme
      updateConversationContext: (updates: Partial<ConversationContext>) => {
        const state = get();
        set({
          conversationContext: {
            ...state.conversationContext,
            ...updates,
            lastActiveTime: new Date(),
          },
        });
      },
      
      // Konuşmayı temizle
      clearConversation: () => {
        const state = get();
        const userId = state.conversationContext.userId;
        
        set({
          messages: [],
          messageGroups: [],
          currentGroupId: null,
          conversationContext: createEmptyContext(userId),
          conversationState: {
            mood: 'neutral',
            isActive: false,
            lastInteraction: new Date(),
          },
          error: null,
        });
        
        // Telemetri
        trackAIInteraction('conversation.cleared', {});
      },
      
      // Konuşma geçmişini yükle
      loadConversationHistory: async () => {
        try {
          set({ isLoading: true });
          
          const stored = await AsyncStorage.getItem(StorageKeys.AI_CHAT_HISTORY);
          if (stored) {
            const history = JSON.parse(stored);
            
            // Tarih objelerini düzelt
            history.messages = history.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }));
            
            set({
              messages: history.messages.slice(-MAX_MESSAGES_IN_MEMORY),
              conversationContext: {
                ...history.conversationContext,
                startTime: new Date(history.conversationContext.startTime),
                lastActiveTime: new Date(history.conversationContext.lastActiveTime),
              },
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Load history error:', error);
          set({ isLoading: false, error: 'Geçmiş yüklenemedi' });
        }
      },
      
      // Offline mesajları yeniden gönder
      retryOfflineMessages: async () => {
        const state = get();
        const queue = [...state.offlineQueue];
        
        set({ offlineQueue: [] });
        
        for (const item of queue) {
          await state.sendMessage(item.message);
        }
      },
      
      // Yeni mesaj grubu başlat
      startNewMessageGroup: (topic?: string) => {
        const groupId = Date.now().toString();
        
        set({
          currentGroupId: groupId,
          messageGroups: [
            ...get().messageGroups,
            {
              id: groupId,
              messages: [],
              startTime: new Date(),
              endTime: new Date(),
              topic,
            },
          ],
        });
      },
      
      // Mevcut grubu bitir
      endCurrentMessageGroup: () => {
        const state = get();
        if (!state.currentGroupId) return;
        
        const groups = state.messageGroups.map(group => {
          if (group.id === state.currentGroupId) {
            return {
              ...group,
              endTime: new Date(),
              messages: state.messages.filter(
                msg => new Date(msg.timestamp) >= group.startTime
              ),
            };
          }
          return group;
        });
        
        set({
          messageGroups: groups,
          currentGroupId: null,
        });
      },
      
      // Son bağlamı al
      getRecentContext: () => {
        const state = get();
        return state.messages.slice(-CONTEXT_WINDOW_SIZE);
      },
      
      // Ruh halini güncelle
      updateMood: (mood: ConversationContext['state']['mood']) => {
        const state = get();
        
        set({
          conversationState: {
            ...state.conversationState,
            mood,
          },
          conversationContext: {
            ...state.conversationContext,
            state: {
              ...state.conversationContext.state,
              mood,
            },
          },
        });
        
        // Kriz durumunda güvenlik takibi
        if (mood === 'crisis') {
          const safetyTracking = state.conversationContext.safetyTracking;
          state.updateConversationContext({
            safetyTracking: {
              ...safetyTracking,
              crisisFlags: safetyTracking.crisisFlags + 1,
              lastCrisisCheck: new Date(),
            },
          });
        }
      },
      
      // UI yardımcıları
      setTyping: (isTyping: boolean) => set({ isTyping }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'ai-chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Son 50 mesaj
        conversationContext: state.conversationContext,
        messageGroups: state.messageGroups.slice(-10), // Son 10 grup
      }),
    }
  )
); 