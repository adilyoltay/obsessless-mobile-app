/**
 * 💬 AI Chat Store - Context-Aware Conversation Management
 * 
 * Bu store AI sohbet sisteminin tüm state management'ini yönetir.
 * Sprint 1-2'de kurulan güvenlik altyapısını kullanır.
 * 
 * ⚠️ CRITICAL: Tüm mesajlar crisis detection ve content filtering'den geçer
 * ⚠️ Feature flag kontrolü her işlemde yapılır
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage, 
  ConversationContext, 
  ConversationState, 
  CrisisRiskLevel,
  AIConfig,
  UserTherapeuticProfile 
} from '@/features/ai/types';
import { aiManager } from '@/features/ai/config/aiManager';
import { crisisDetectionService } from '@/features/ai/safety/crisisDetection';
import { contentFilterService } from '@/features/ai/safety/contentFilter';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// 🎯 CHAT STORE TYPES
// =============================================================================

/**
 * Chat conversation data
 */
interface ChatConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  context: ConversationContext;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Chat UI state
 */
interface ChatUIState {
  isTyping: boolean;
  isLoading: boolean;
  error: string | null;
  inputText: string;
  showCrisisHelp: boolean;
  lastCrisisLevel: CrisisRiskLevel;
}

/**
 * AI Chat Store State
 */
interface AIChatState {
  // Core State
  isEnabled: boolean;
  isInitialized: boolean;
  
  // Conversations
  conversations: ChatConversation[];
  activeConversationId: string | null;
  
  // UI State
  ui: ChatUIState;
  
  // Current Session
  currentSession: {
    sessionId: string;
    startTime: Date;
    messageCount: number;
    crisisDetections: number;
    contentFiltered: number;
  } | null;
  
  // User Context
  userProfile: UserTherapeuticProfile | null;
  
  // Actions
  initialize: (userId: string) => Promise<void>;
  shutdown: () => Promise<void>;
  
  // Conversation Management
  createConversation: (title?: string) => Promise<string>;
  setActiveConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  
  // Messaging
  sendMessage: (content: string, userId: string) => Promise<boolean>;
  retryLastMessage: () => Promise<boolean>;
  
  // UI Actions
  setInputText: (text: string) => void;
  clearError: () => void;
  dismissCrisisHelp: () => void;
  
  // Context Management
  updateUserProfile: (profile: Partial<UserTherapeuticProfile>) => void;
  updateConversationState: (state: ConversationState) => void;
  
  // Emergency Controls
  emergencyStop: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

// =============================================================================
// 🔧 CHAT STORE IMPLEMENTATION
// =============================================================================

export const useAIChatStore = create<AIChatState>()(
  persist(
    (set, get) => ({
      // Initial State
      isEnabled: false,
      isInitialized: false,
      conversations: [],
      activeConversationId: null,
      ui: {
        isTyping: false,
        isLoading: false,
        error: null,
        inputText: '',
        showCrisisHelp: false,
        lastCrisisLevel: CrisisRiskLevel.NONE
      },
      currentSession: null,
      userProfile: null,

      // =============================================================================
      // 🚀 INITIALIZATION
      // =============================================================================

      /**
       * Store'u başlat
       */
      initialize: async (userId: string) => {
        console.log('💬 AI Chat Store: Initializing...');
        
        try {
          // Feature flag kontrolü
          if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
            console.log('🚫 AI Chat disabled by feature flag');
            set({ isEnabled: false });
            return;
          }

          // AI Manager hazır mı kontrol et
          if (!aiManager.isEnabled) {
            console.log('🚫 AI Manager not enabled');
            set({ isEnabled: false });
            return;
          }

          // Crisis detection ve content filter hazır mı
          if (!crisisDetectionService.isEnabled || !contentFilterService.isEnabled) {
            console.log('🚫 Safety systems not ready');
            set({ isEnabled: false });
            return;
          }

          // Session başlat
          const sessionId = `chat_${userId}_${Date.now()}`;
          const currentSession = {
            sessionId,
            startTime: new Date(),
            messageCount: 0,
            crisisDetections: 0,
            contentFiltered: 0
          };

          // Store state güncelle
          set({
            isEnabled: true,
            isInitialized: true,
            currentSession,
            ui: { ...get().ui, error: null }
          });

          // Eğer aktif conversation yoksa yeni bir tane oluştur
          const state = get();
          if (!state.activeConversationId && state.conversations.length === 0) {
            await get().createConversation('Hoş Geldiniz Sohbeti');
          }

          // Telemetry
          await trackAIInteraction(AIEventType.CHAT_SESSION_STARTED, {
            userId,
            sessionId,
            timestamp: new Date().toISOString()
          });

          console.log('✅ AI Chat Store initialized successfully');

        } catch (error) {
          console.error('❌ AI Chat Store initialization failed:', error);
          set({
            isEnabled: false,
            ui: { ...get().ui, error: 'Chat sistemi başlatılamadı. Lütfen daha sonra tekrar deneyin.' }
          });
        }
      },

      /**
       * Store'u kapat
       */
      shutdown: async () => {
        console.log('💬 AI Chat Store: Shutting down...');
        
        const state = get();
        
        // Session'ı sonlandır
        if (state.currentSession) {
          await trackAIInteraction(AIEventType.CHAT_SESSION_ENDED, {
            sessionId: state.currentSession.sessionId,
            duration: Date.now() - state.currentSession.startTime.getTime(),
            messageCount: state.currentSession.messageCount,
            crisisDetections: state.currentSession.crisisDetections,
            contentFiltered: state.currentSession.contentFiltered
          });
        }

        set({
          isEnabled: false,
          isInitialized: false,
          currentSession: null,
          ui: {
            isTyping: false,
            isLoading: false,
            error: null,
            inputText: '',
            showCrisisHelp: false,
            lastCrisisLevel: CrisisRiskLevel.NONE
          }
        });
      },

      // =============================================================================
      // 💬 CONVERSATION MANAGEMENT
      // =============================================================================

      /**
       * Yeni conversation oluştur
       */
      createConversation: async (title?: string) => {
        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        
        const conversation: ChatConversation = {
          id: conversationId,
          title: title || `Sohbet ${now.toLocaleDateString('tr-TR')}`,
          messages: [],
          context: {
            userId: '', // Will be set when first message is sent
            sessionId: get().currentSession?.sessionId || '',
            conversationHistory: [],
            userProfile: get().userProfile || {
              preferredLanguage: 'tr',
              symptomSeverity: 5,
              triggerWords: [],
              avoidanceTopics: [],
              preferredCBTTechniques: [],
              therapeuticGoals: [],
              communicationStyle: {
                formality: 'warm',
                directness: 'gentle',
                supportStyle: 'encouraging',
                humorAcceptable: false,
                preferredPronoun: 'siz'
              },
              riskFactors: []
            },
            currentState: ConversationState.STABLE,
            startTime: now,
            lastActivity: now,
            messageCount: 0,
            topicHistory: [],
            therapeuticGoals: [],
            sessionObjectives: ['Kullanıcıyı desteklemek', 'CBT teknikleri paylaşmak'],
            progressNotes: []
          },
          createdAt: now,
          updatedAt: now,
          isActive: true
        };

        // Welcome message ekle
        const welcomeMessage: AIMessage = {
          id: `msg_welcome_${Date.now()}`,
          content: 'Merhaba! 🌱 Ben ObsessLess AI uzmanınızım. OKB konusunda size destek olmak için buradayım. Bugün nasıl hissediyorsunuz?',
          role: 'assistant',
          timestamp: now,
          metadata: {
            sessionId: conversation.context.sessionId,
            contextType: 'chat',
            sentiment: {
              polarity: 'positive',
              intensity: 0.8,
              emotions: [{ emotion: 'hope', confidence: 0.9 }]
            },
            confidence: 1.0,
            safetyScore: 1.0,
            crisisRisk: CrisisRiskLevel.NONE,
            therapeuticIntent: ['welcome', 'support_offering'],
            emotionalTone: 'supportive'
          }
        };

        conversation.messages.push(welcomeMessage);
        conversation.context.conversationHistory.push(welcomeMessage);

        // Store'a ekle
        set(state => ({
          conversations: [...state.conversations, conversation],
          activeConversationId: conversationId
        }));

        return conversationId;
      },

      /**
       * Aktif conversation'ı değiştir
       */
      setActiveConversation: (conversationId: string) => {
        const state = get();
        const conversation = state.conversations.find(c => c.id === conversationId);
        
        if (conversation) {
          set({ activeConversationId: conversationId });
        }
      },

      /**
       * Conversation sil
       */
      deleteConversation: async (conversationId: string) => {
        set(state => ({
          conversations: state.conversations.filter(c => c.id !== conversationId),
          activeConversationId: state.activeConversationId === conversationId 
            ? state.conversations.find(c => c.id !== conversationId)?.id || null 
            : state.activeConversationId
        }));
      },

      // =============================================================================
      // 📨 MESSAGING
      // =============================================================================

      /**
       * Mesaj gönder - Ana fonksiyon
       */
      sendMessage: async (content: string, userId: string) => {
        const state = get();
        
        // Prerequisite checks
        if (!state.isEnabled || !state.isInitialized) {
          set(state => ({ ui: { ...state.ui, error: 'Chat sistemi hazır değil.' }}));
          return false;
        }

        if (!content.trim()) {
          return false;
        }

        // Active conversation kontrolü
        if (!state.activeConversationId) {
          await get().createConversation();
        }

        const activeConversation = state.conversations.find(c => c.id === state.activeConversationId);
        if (!activeConversation) {
          set(state => ({ ui: { ...state.ui, error: 'Aktif sohbet bulunamadı.' }}));
          return false;
        }

        // UI state güncelle
        set(state => ({
          ui: {
            ...state.ui,
            isLoading: true,
            isTyping: true,
            error: null,
            inputText: ''
          }
        }));

        try {
          // 1. User mesajını oluştur
          const userMessage: AIMessage = {
            id: `msg_user_${Date.now()}`,
            content: content.trim(),
            role: 'user',
            timestamp: new Date(),
            metadata: {
              sessionId: activeConversation.context.sessionId,
              contextType: 'chat',
              containsPII: false,
              anonymized: true
            }
          };

          // 2. Crisis Detection
          const crisisResult = await crisisDetectionService.detectCrisis(
            userMessage, 
            activeConversation.context
          );

          // Crisis varsa özel handling
          if (crisisResult.riskLevel !== CrisisRiskLevel.NONE) {
            return await get().handleCrisisMessage(userMessage, crisisResult, userId);
          }

          // 3. User mesajını conversation'a ekle
          set(state => ({
            conversations: state.conversations.map(conv => 
              conv.id === state.activeConversationId 
                ? {
                    ...conv,
                    messages: [...conv.messages, userMessage],
                    context: {
                      ...conv.context,
                      conversationHistory: [...conv.context.conversationHistory, userMessage],
                      lastActivity: new Date(),
                      messageCount: conv.context.messageCount + 1
                    },
                    updatedAt: new Date()
                  }
                : conv
            )
          }));

          // 4. AI Response generate et
          const aiResponse = await get().generateAIResponse(userMessage, activeConversation.context, userId);
          
          if (!aiResponse) {
            throw new Error('AI response generation failed');
          }

          // 5. Content Filtering
          const filterResult = await contentFilterService.filterContent(aiResponse, { isTherapeutic: true });
          
          if (!filterResult.allowed) {
            return await get().handleFilteredResponse(filterResult, userId);
          }

          // 6. AI mesajını conversation'a ekle
          set(state => ({
            conversations: state.conversations.map(conv => 
              conv.id === state.activeConversationId 
                ? {
                    ...conv,
                    messages: [...conv.messages, aiResponse],
                    context: {
                      ...conv.context,
                      conversationHistory: [...conv.context.conversationHistory, aiResponse],
                      lastActivity: new Date(),
                      messageCount: conv.context.messageCount + 1
                    },
                    updatedAt: new Date()
                  }
                : conv
            ),
            ui: {
              ...state.ui,
              isLoading: false,
              isTyping: false
            }
          }));

          // 7. Session stats güncelle
          if (state.currentSession) {
            set(state => ({
              currentSession: {
                ...state.currentSession!,
                messageCount: state.currentSession!.messageCount + 2 // user + ai
              }
            }));
          }

          // 8. Telemetry
          await trackAIInteraction(AIEventType.CHAT_MESSAGE_SENT, {
            userId,
            sessionId: activeConversation.context.sessionId,
            messageLength: content.length,
            responseTime: Date.now() - userMessage.timestamp.getTime(),
            crisisLevel: crisisResult.riskLevel,
            contentFiltered: !filterResult.allowed
          });

          return true;

        } catch (error) {
          console.error('❌ Send message error:', error);
          
          set(state => ({
            ui: {
              ...state.ui,
              isLoading: false,
              isTyping: false,
              error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.'
            }
          }));
          
          return false;
        }
      },

      /**
       * Son mesajı tekrar dene
       */
      retryLastMessage: async () => {
        const state = get();
        const activeConversation = state.conversations.find(c => c.id === state.activeConversationId);
        
        if (!activeConversation || activeConversation.messages.length === 0) {
          return false;
        }

        const lastUserMessage = [...activeConversation.messages]
          .reverse()
          .find(msg => msg.role === 'user');

        if (!lastUserMessage) {
          return false;
        }

        // Son AI mesajını sil
        set(state => ({
          conversations: state.conversations.map(conv => 
            conv.id === state.activeConversationId 
              ? {
                  ...conv,
                  messages: conv.messages.filter(msg => 
                    msg.role === 'user' || msg.timestamp <= lastUserMessage.timestamp
                  )
                }
              : conv
          )
        }));

        // Mesajı tekrar gönder
        return await get().sendMessage(lastUserMessage.content, activeConversation.context.userId);
      },

      // =============================================================================
      // 🎛️ UI ACTIONS
      // =============================================================================

      setInputText: (text: string) => {
        set(state => ({
          ui: { ...state.ui, inputText: text }
        }));
      },

      clearError: () => {
        set(state => ({
          ui: { ...state.ui, error: null }
        }));
      },

      dismissCrisisHelp: () => {
        set(state => ({
          ui: { ...state.ui, showCrisisHelp: false }
        }));
      },

      // =============================================================================
      // 👤 CONTEXT MANAGEMENT
      // =============================================================================

      updateUserProfile: (profile: Partial<UserTherapeuticProfile>) => {
        set(state => ({
          userProfile: state.userProfile ? { ...state.userProfile, ...profile } : profile as UserTherapeuticProfile
        }));
      },

      updateConversationState: (newState: ConversationState) => {
        set(state => ({
          conversations: state.conversations.map(conv => 
            conv.id === state.activeConversationId 
              ? {
                  ...conv,
                  context: { ...conv.context, currentState: newState }
                }
              : conv
          )
        }));
      },

      // =============================================================================
      // 🚨 EMERGENCY CONTROLS
      // =============================================================================

      emergencyStop: async () => {
        console.warn('🚨 AI Chat Emergency Stop activated');
        
        await get().shutdown();
        
        set({
          ui: {
            isTyping: false,
            isLoading: false,
            error: 'Acil durum protokolü aktive edildi. Chat sistemi durduruldu.',
            inputText: '',
            showCrisisHelp: true,
            lastCrisisLevel: CrisisRiskLevel.CRITICAL
          }
        });
      },

      clearAllData: async () => {
        console.warn('🗑️ AI Chat: Clearing all data');
        
        set({
          conversations: [],
          activeConversationId: null,
          userProfile: null,
          ui: {
            isTyping: false,
            isLoading: false,
            error: null,
            inputText: '',
            showCrisisHelp: false,
            lastCrisisLevel: CrisisRiskLevel.NONE
          }
        });
      }

    }),
    {
      name: 'ai-chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        userProfile: state.userProfile
      })
    }
  )
);

// =============================================================================
// 🔧 HELPER METHODS (Store extension)
// =============================================================================

// Store'u extend et - helper methods
const originalStore = useAIChatStore.getState();

// Crisis message handling
originalStore.handleCrisisMessage = async function(
  userMessage: AIMessage, 
  crisisResult: any, 
  userId: string
) {
  console.warn('🚨 Crisis message detected:', crisisResult.riskLevel);
  
  // Crisis UI göster
  useAIChatStore.setState(state => ({
    ui: {
      ...state.ui,
      showCrisisHelp: true,
      lastCrisisLevel: crisisResult.riskLevel,
      isLoading: false,
      isTyping: false
    },
    currentSession: state.currentSession ? {
      ...state.currentSession,
      crisisDetections: state.currentSession.crisisDetections + 1
    } : null
  }));

  // Crisis response mesajı
  const crisisResponse: AIMessage = {
    id: `msg_crisis_${Date.now()}`,
    content: this.getCrisisResponseMessage(crisisResult.riskLevel),
    role: 'assistant',
    timestamp: new Date(),
    metadata: {
      sessionId: userMessage.metadata?.sessionId || '',
      contextType: 'crisis',
      crisisRisk: crisisResult.riskLevel,
      therapeuticIntent: ['crisis_intervention', 'safety'],
      emotionalTone: 'supportive'
    }
  };

  // Conversation'a ekle
  useAIChatStore.setState(state => ({
    conversations: state.conversations.map(conv => 
      conv.id === state.activeConversationId 
        ? {
            ...conv,
            messages: [...conv.messages, userMessage, crisisResponse],
            context: {
              ...conv.context,
              currentState: ConversationState.CRISIS,
              conversationHistory: [...conv.context.conversationHistory, userMessage, crisisResponse]
            }
          }
        : conv
    )
  }));

  return true;
};

// Crisis response messages
originalStore.getCrisisResponseMessage = function(riskLevel: CrisisRiskLevel): string {
  switch (riskLevel) {
    case CrisisRiskLevel.CRITICAL:
      return `🚨 Anlattıklarınızdan çok endişe duyuyorum. Şu anda güvende olmanız çok önemli.

**ACİL YARDIM HATLARI:**
📞 Yaşam Hattı: 183
📞 AMATEM: 444 0 644
📞 Acil Servis: 112

Lütfen derhal bir uzmanla konuşun. Yalnız değilsiniz ve yardım almak cesaret gerektirir. ❤️`;

    case CrisisRiskLevel.HIGH:
      return `⚠️ Şu anda zor bir dönemden geçtiğinizi anlıyorum. Bu düşünceler ve hisler geçici, siz kalıcısınız.

**DESTEK KAYNAKLARI:**
📞 Kriz Hattı: 183
🏥 En yakın hastane acil servisine gidin
👨‍⚕️ Psikiyatrist ile randevu alın

Kendinizi güvende hissetmiyorsanız, lütfen birisiyle iletişime geçin. Bu yalnız geçirmeniz gereken bir süreç değil.`;

    case CrisisRiskLevel.MEDIUM:
      return `💛 Bu zorlu anlardan geçtiğinizi görebiliyorum. Bu hisler normal ve anlaşılabilir.

**KENDİNİZE BAKIN:**
🧘‍♀️ Derin nefes alın: 4 saniye içeri, 4 saniye bekleyin, 6 saniye dışarı
🌿 Güvenli alanınızda kalın
💙 Güvendiğiniz biriyle konuşun

İhtiyacınız olursa profesyonel destek almaktan çekinmeyin. Bu cesaret göstergisidir.`;

    default:
      return 'Size nasıl destek olabilirim?';
  }
};

// AI Response generation
originalStore.generateAIResponse = async function(
  userMessage: AIMessage,
  context: ConversationContext,
  userId: string
): Promise<AIMessage | null> {
  // Bu kısım Sprint 4'te CBT Engine ile implement edilecek
  // Şimdilik mock response
  
  const mockResponses = [
    "Bunu paylaştığınız için teşekkürler. Bu durumla başa çıkmak kolay değil ama siz yalnız değilsiniz. 💙",
    "OKB ile yaşamak zorlu olabilir. Bu düşünceler sizin kim olduğunuzu tanımlamaz. Neler hissettiğinizi biraz daha anlatabilir misiniz?",
    "Bu konuda endişelenmeniz çok anlaşılabilir. Birlikte bu durumla başa çıkmanın yollarını keşfedelim. 🌱",
    "Fark ettiğiniz bu kalıp çok değerli. Bu farkındalık iyileşme sürecinizin önemli bir parçası. 🎯"
  ];

  const response: AIMessage = {
    id: `msg_ai_${Date.now()}`,
    content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
    role: 'assistant',
    timestamp: new Date(),
    metadata: {
      sessionId: context.sessionId,
      contextType: 'chat',
      therapeuticIntent: ['support', 'empathy'],
      emotionalTone: 'supportive',
      confidence: 0.8,
      safetyScore: 1.0,
      crisisRisk: CrisisRiskLevel.NONE
    }
  };

  return response;
};

// Filtered response handling
originalStore.handleFilteredResponse = async function(filterResult: any, userId: string) {
  console.warn('🔒 AI response filtered:', filterResult.severity);
  
  useAIChatStore.setState(state => ({
    ui: {
      ...state.ui,
      isLoading: false,
      isTyping: false,
      error: 'AI yanıtı güvenlik kontrolünden geçemedi. Lütfen farklı bir konu hakkında konuşalım.'
    },
    currentSession: state.currentSession ? {
      ...state.currentSession,
      contentFiltered: state.currentSession.contentFiltered + 1
    } : null
  }));

  return false;
};

// Export store and utilities
export default useAIChatStore;