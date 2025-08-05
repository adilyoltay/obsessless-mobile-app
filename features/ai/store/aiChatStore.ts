/**
 * AI Chat Store - Zustand ile Konuşma Yönetimi
 * 
 * KRITIK: Store izole olmalı ve ana app state'ini etkilememeli
 * Ayrı Zustand store instance kullanır
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext,
  UserAIProfile,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';

// Konuşma durumu
export enum ConversationState {
  IDLE = 'idle',
  ACTIVE = 'active',
  THINKING = 'thinking',
  ERROR = 'error',
  ENDED = 'ended'
}

// Konuşma thread'i
export interface ConversationThread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: AIMessage[];
  state: ConversationState;
  metadata: ThreadMetadata;
  archived: boolean;
}

export interface ThreadMetadata {
  userId: string;
  sessionDuration: number;
  messageCount: number;
  therapeuticMilestones: string[];
  emotionalTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  lastActivity: Date;
  tags: string[];
}

// Store state interface
interface AIChatStore {
  // State
  isEnabled: boolean;
  currentThread: ConversationThread | null;
  threads: ConversationThread[];
  conversationContext: ConversationContext | null;
  isTyping: boolean;
  error: AIError | null;
  
  // Actions
  initialize: () => Promise<void>;
  shutdown: () => void;
  
  // Thread management
  createThread: (userId: string, title?: string) => ConversationThread;
  loadThread: (threadId: string) => Promise<void>;
  archiveThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  
  // Message management
  addMessage: (message: AIMessage) => void;
  updateMessage: (messageId: string, updates: Partial<AIMessage>) => void;
  deleteMessage: (messageId: string) => void;
  
  // Conversation flow
  setTyping: (isTyping: boolean) => void;
  setError: (error: AIError | null) => void;
  updateContext: (context: Partial<ConversationContext>) => void;
  
  // Analytics
  getConversationHealth: () => ConversationHealth;
  getMessageBatch: (batchSize: number) => AIMessage[];
  
  // Safety
  emergencyReset: () => void;
  exportConversation: (threadId: string) => Promise<string>;
}

// Konuşma sağlığı metrikleri
export interface ConversationHealth {
  messageFrequency: number; // Dakika başına mesaj
  averageResponseTime: number; // Milisaniye
  sentimentScore: number; // -1 ile 1 arası
  engagementLevel: 'low' | 'medium' | 'high';
  therapeuticProgress: number; // 0 ile 100 arası
}

// Store implementasyonu
export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isEnabled: false,
      currentThread: null,
      threads: [],
      conversationContext: null,
      isTyping: false,
      error: null,

      // Initialize
      initialize: async () => {
        if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
          console.log('[AIChatStore] AI Chat is disabled');
          return;
        }

        set({ isEnabled: true });
        
        // Kaydedilmiş thread'leri yükle
        try {
          const savedThreads = await AsyncStorage.getItem('@ai_chat_threads');
          if (savedThreads) {
            const threads = JSON.parse(savedThreads);
            set({ threads });
          }
        } catch (error) {
          console.error('[AIChatStore] Failed to load threads:', error);
        }

        // Telemetri
        await trackAIInteraction(AIEventType.FEATURE_ENABLED, {
          feature: 'chat_store'
        });
      },

      // Shutdown
      shutdown: () => {
        const { threads } = get();
        
        // Thread'leri kaydet
        AsyncStorage.setItem('@ai_chat_threads', JSON.stringify(threads))
          .catch(error => console.error('[AIChatStore] Failed to save threads:', error));

        set({
          isEnabled: false,
          currentThread: null,
          conversationContext: null,
          isTyping: false,
          error: null
        });

        // Telemetri
        trackAIInteraction(AIEventType.FEATURE_DISABLED, {
          feature: 'chat_store',
          total_threads: threads.length
        });
      },

      // Thread oluştur
      createThread: (userId: string, title?: string) => {
        const thread: ConversationThread = {
          id: `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: title || `Konuşma ${new Date().toLocaleDateString('tr-TR')}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [],
          state: ConversationState.IDLE,
          metadata: {
            userId,
            sessionDuration: 0,
            messageCount: 0,
            therapeuticMilestones: [],
            emotionalTrend: 'unknown',
            lastActivity: new Date(),
            tags: []
          },
          archived: false
        };

        set(state => ({
          threads: [...state.threads, thread],
          currentThread: thread
        }));

        // Telemetri
        trackAIInteraction(AIEventType.CONVERSATION_START, {
          thread_id: thread.id
        });

        return thread;
      },

      // Thread yükle
      loadThread: async (threadId: string) => {
        const { threads } = get();
        const thread = threads.find(t => t.id === threadId);
        
        if (!thread) {
          const error = new Error('Thread not found') as AIError;
          error.code = AIErrorCode.INVALID_RESPONSE;
          set({ error });
          return;
        }

        set({ currentThread: thread, error: null });
      },

      // Thread arşivle
      archiveThread: (threadId: string) => {
        set(state => ({
          threads: state.threads.map(thread =>
            thread.id === threadId
              ? { ...thread, archived: true, updatedAt: new Date() }
              : thread
          ),
          currentThread: state.currentThread?.id === threadId
            ? { ...state.currentThread, archived: true }
            : state.currentThread
        }));
      },

      // Thread sil
      deleteThread: (threadId: string) => {
        set(state => ({
          threads: state.threads.filter(t => t.id !== threadId),
          currentThread: state.currentThread?.id === threadId ? null : state.currentThread
        }));
      },

      // Mesaj ekle
      addMessage: (message: AIMessage) => {
        const { currentThread } = get();
        if (!currentThread) return;

        const updatedThread = {
          ...currentThread,
          messages: [...currentThread.messages, message],
          updatedAt: new Date(),
          state: ConversationState.ACTIVE,
          metadata: {
            ...currentThread.metadata,
            messageCount: currentThread.metadata.messageCount + 1,
            lastActivity: new Date()
          }
        };

        set(state => ({
          currentThread: updatedThread,
          threads: state.threads.map(t =>
            t.id === currentThread.id ? updatedThread : t
          )
        }));

        // Otomatik kaydetme
        get().saveThreads();
        
        // Milestone kontrolü
        get().checkTherapeuticMilestones(message);
      },

      // Mesaj güncelle
      updateMessage: (messageId: string, updates: Partial<AIMessage>) => {
        const { currentThread } = get();
        if (!currentThread) return;

        const updatedMessages = currentThread.messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );

        const updatedThread = {
          ...currentThread,
          messages: updatedMessages,
          updatedAt: new Date()
        };

        set(state => ({
          currentThread: updatedThread,
          threads: state.threads.map(t =>
            t.id === currentThread.id ? updatedThread : t
          )
        }));
      },

      // Mesaj sil
      deleteMessage: (messageId: string) => {
        const { currentThread } = get();
        if (!currentThread) return;

        const updatedMessages = currentThread.messages.filter(
          msg => msg.id !== messageId
        );

        const updatedThread = {
          ...currentThread,
          messages: updatedMessages,
          updatedAt: new Date(),
          metadata: {
            ...currentThread.metadata,
            messageCount: updatedMessages.length
          }
        };

        set(state => ({
          currentThread: updatedThread,
          threads: state.threads.map(t =>
            t.id === currentThread.id ? updatedThread : t
          )
        }));
      },

      // Typing durumu
      setTyping: (isTyping: boolean) => {
        set({ isTyping });
      },

      // Error durumu
      setError: (error: AIError | null) => {
        set({ error });
        
        if (error) {
          // Error telemetri
          trackAIInteraction(AIEventType.ERROR_OCCURRED, {
            error_code: error.code,
            severity: error.severity
          });
        }
      },

      // Context güncelle
      updateContext: (context: Partial<ConversationContext>) => {
        set(state => ({
          conversationContext: state.conversationContext
            ? { ...state.conversationContext, ...context }
            : context as ConversationContext
        }));
      },

      // Konuşma sağlığı analizi
      getConversationHealth: () => {
        const { currentThread } = get();
        if (!currentThread || currentThread.messages.length === 0) {
          return {
            messageFrequency: 0,
            averageResponseTime: 0,
            sentimentScore: 0,
            engagementLevel: 'low',
            therapeuticProgress: 0
          };
        }

        // Mesaj frekansı hesapla
        const duration = Date.now() - currentThread.createdAt.getTime();
        const messageFrequency = (currentThread.messages.length / duration) * 60000; // Dakika başına

        // Ortalama yanıt süresi
        let totalResponseTime = 0;
        let responseCount = 0;
        
        for (let i = 1; i < currentThread.messages.length; i++) {
          if (currentThread.messages[i].role === 'assistant' && 
              currentThread.messages[i - 1].role === 'user') {
            const responseTime = new Date(currentThread.messages[i].timestamp).getTime() -
                               new Date(currentThread.messages[i - 1].timestamp).getTime();
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
        
        const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

        // Sentiment analizi (basit)
        let sentimentSum = 0;
        currentThread.messages.forEach(msg => {
          if (msg.metadata?.sentiment) {
            sentimentSum += msg.metadata.sentiment === 'positive' ? 1 :
                           msg.metadata.sentiment === 'negative' ? -1 : 0;
          }
        });
        const sentimentScore = sentimentSum / currentThread.messages.length;

        // Engagement seviyesi
        const engagementLevel = messageFrequency > 2 ? 'high' :
                               messageFrequency > 0.5 ? 'medium' : 'low';

        // Terapötik ilerleme (milestone bazlı)
        const therapeuticProgress = Math.min(100, 
          currentThread.metadata.therapeuticMilestones.length * 20
        );

        return {
          messageFrequency,
          averageResponseTime,
          sentimentScore,
          engagementLevel,
          therapeuticProgress
        };
      },

      // Mesaj batch'i al
      getMessageBatch: (batchSize: number) => {
        const { currentThread } = get();
        if (!currentThread) return [];

        return currentThread.messages.slice(-batchSize);
      },

      // Acil durum reset
      emergencyReset: () => {
        console.warn('[AIChatStore] Emergency reset initiated');
        
        // Tüm state'i temizle
        set({
          isEnabled: false,
          currentThread: null,
          threads: [],
          conversationContext: null,
          isTyping: false,
          error: null
        });

        // Storage'ı temizle
        AsyncStorage.removeItem('@ai_chat_threads')
          .catch(error => console.error('[AIChatStore] Failed to clear storage:', error));

        // Telemetri
        trackAIInteraction(AIEventType.ERROR_OCCURRED, {
          error_type: 'emergency_reset'
        });
      },

      // Konuşmayı export et
      exportConversation: async (threadId: string) => {
        const { threads } = get();
        const thread = threads.find(t => t.id === threadId);
        
        if (!thread) {
          throw new Error('Thread not found');
        }

        // Privacy-compliant export
        const exportData = {
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt,
          messages: thread.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          metadata: {
            messageCount: thread.metadata.messageCount,
            duration: thread.metadata.sessionDuration,
            milestones: thread.metadata.therapeuticMilestones
          }
        };

        return JSON.stringify(exportData, null, 2);
      },

      // Yardımcı metodlar (private)
      saveThreads: async () => {
        const { threads } = get();
        try {
          await AsyncStorage.setItem('@ai_chat_threads', JSON.stringify(threads));
        } catch (error) {
          console.error('[AIChatStore] Failed to save threads:', error);
        }
      },

      checkTherapeuticMilestones: (message: AIMessage) => {
        const { currentThread } = get();
        if (!currentThread) return;

        // Basit milestone kontrolü
        const milestones = [...currentThread.metadata.therapeuticMilestones];
        
        // İlk 10 mesaj
        if (currentThread.messages.length === 10 && !milestones.includes('first_10_messages')) {
          milestones.push('first_10_messages');
        }
        
        // 30 dakika konuşma
        const duration = Date.now() - currentThread.createdAt.getTime();
        if (duration > 30 * 60 * 1000 && !milestones.includes('30_min_conversation')) {
          milestones.push('30_min_conversation');
        }
        
        // Pozitif sentiment
        if (message.metadata?.sentiment === 'positive' && 
            !milestones.includes('positive_sentiment')) {
          milestones.push('positive_sentiment');
        }

        if (milestones.length > currentThread.metadata.therapeuticMilestones.length) {
          set(state => ({
            currentThread: state.currentThread ? {
              ...state.currentThread,
              metadata: {
                ...state.currentThread.metadata,
                therapeuticMilestones: milestones
              }
            } : null
          }));
        }
      }
    }),
    {
      name: 'ai-chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        threads: state.threads,
        conversationContext: state.conversationContext
      })
    }
  )
); 