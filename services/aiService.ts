/**
 * AI Service Client
 * 
 * Frontend client for AI backend integration
 */

import { supabase } from '@/lib/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage,
  AIError,
  AIErrorCode,
  TherapeuticInsight
} from '@/features/ai/types';
import { logger } from '@/utils/logger';

// API endpoints
const AI_FUNCTIONS = {
  CHAT: 'ai-chat',
  PATTERNS: 'ai-patterns',
  INSIGHTS: 'ai-insights',
  VOICE_STT: 'ai-voice-stt'
};

class AIService {
  private static instance: AIService;
  private baseUrl: string;

  private constructor() {
    // Get Supabase URL from environment or client
    this.baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  }

  static getInstance(): AIService {
    if (!this.instance) {
      this.instance = new AIService();
    }
    return this.instance;
  }

  /**
   * Send chat message to AI
   */
  async sendChatMessage(
    message: string,
    conversationId?: string,
    context?: any
  ): Promise<AIMessage> {
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      throw this.createError('AI Chat is disabled', AIErrorCode.FEATURE_DISABLED);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      const { data, error } = await supabase.functions.invoke(AI_FUNCTIONS.CHAT, {
        body: {
          message,
          conversationId,
          userId: user.id,
          context
        }
      });

      if (error) {
        throw this.createError(error.message);
      }

      // Convert response to AIMessage
      const aiMessage: AIMessage = {
        id: `ai_${Date.now()}`,
        content: data.message,
        role: 'assistant',
        timestamp: new Date(),
        metadata: {
          ...data.metadata,
          conversationId: data.conversationId
        }
      };

      logger.ai.info('Chat message sent successfully', {
        conversationId: data.conversationId,
        messageLength: message.length
      });

      return aiMessage;
    } catch (error) {
      logger.ai.error('Failed to send chat message', error);
      throw this.handleError(error);
    }
  }

  /**
   * Analyze patterns
   */
  async analyzePatterns(
    timeframe: number = 30,
    includeInsights: boolean = true
  ): Promise<{
    patterns: any[];
    insights: TherapeuticInsight[];
    metadata: any;
  }> {
    if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS')) {
      throw this.createError('AI Insights is disabled', AIErrorCode.FEATURE_DISABLED);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      const { data, error } = await supabase.functions.invoke(AI_FUNCTIONS.PATTERNS, {
        body: {
          userId: user.id,
          timeframe,
          includeInsights
        }
      });

      if (error) {
        throw this.createError(error.message);
      }

      logger.ai.info('Pattern analysis completed', {
        patternsFound: data.patterns.length,
        insightsGenerated: data.insights.length
      });

      return data;
    } catch (error) {
      logger.ai.error('Failed to analyze patterns', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get AI conversations
   */
  async getConversations(limit: number = 10): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      const { data, error } = await supabase
        .from('ai_conversations')
        .select(`
          *,
          ai_messages (
            id,
            role,
            content,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw this.createError(error.message);
      }

      return data || [];
    } catch (error) {
      logger.ai.error('Failed to get conversations', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        throw this.createError(error.message);
      }

      return (data || []).map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.created_at),
        metadata: msg.metadata
      }));
    } catch (error) {
      logger.ai.error('Failed to get conversation messages', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get user insights
   */
  async getInsights(
    category?: string,
    limit: number = 10
  ): Promise<TherapeuticInsight[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      let query = supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .is('read_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        throw this.createError(error.message);
      }

      return (data || []).map(insight => ({
        type: insight.category as any,
        content: insight.content,
        confidence: insight.confidence,
        clinicalRelevance: insight.clinical_relevance,
        timestamp: new Date(insight.created_at)
      }));
    } catch (error) {
      logger.ai.error('Failed to get insights', error);
      throw this.handleError(error);
    }
  }

  /**
   * Mark insight as read
   */
  async markInsightAsRead(insightId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .update({ read_at: new Date().toISOString() })
        .eq('id', insightId);

      if (error) {
        throw this.createError(error.message);
      }
    } catch (error) {
      logger.ai.error('Failed to mark insight as read', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update insight feedback
   */
  async updateInsightFeedback(
    insightId: string,
    helpful: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .update({ helpful })
        .eq('id', insightId);

      if (error) {
        throw this.createError(error.message);
      }

      logger.ai.info('Insight feedback updated', { insightId, helpful });
    } catch (error) {
      logger.ai.error('Failed to update insight feedback', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get or create user AI profile
   */
  async getUserProfile(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      // Try to get existing profile
      let { data: profile, error } = await supabase
        .from('user_ai_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Create if doesn't exist
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('user_ai_profiles')
          .insert({
            user_id: user.id,
            preferred_language: 'tr',
            communication_style: 'supportive',
            privacy_preferences: {
              dataRetention: 'standard',
              analyticsConsent: true,
              therapistSharing: false,
              anonymizedDataUsage: true
            }
          })
          .select()
          .single();

        if (createError) {
          throw this.createError(createError.message);
        }

        profile = newProfile;
      }

      return profile;
    } catch (error) {
      logger.ai.error('Failed to get user profile', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update user AI profile
   */
  async updateUserProfile(updates: Partial<any>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw this.createError('User not authenticated', AIErrorCode.UNKNOWN);
      }

      const { error } = await supabase
        .from('user_ai_profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        throw this.createError(error.message);
      }

      logger.ai.info('User AI profile updated');
    } catch (error) {
      logger.ai.error('Failed to update user profile', error);
      throw this.handleError(error);
    }
  }

  /**
   * Speech to text conversion
   */
  async speechToText(audioUri: string): Promise<string> {
    if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
      throw this.createError('AI Voice is disabled', AIErrorCode.FEATURE_DISABLED);
    }

    try {
      // In a real implementation, this would:
      // 1. Convert audio file to base64 or blob
      // 2. Send to STT edge function
      // 3. Return transcription
      
      // Mock implementation for now
      logger.ai.info('Speech to text requested', { audioUri });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return 'Bu bir test transkripsiyonudur. Gerçek STT servisi bağlandığında ses dosyanız yazıya dönüştürülecektir.';
    } catch (error) {
      logger.ai.error('Failed to convert speech to text', error);
      throw this.handleError(error);
    }
  }

  /**
   * Log telemetry event
   */
  async logTelemetry(
    eventType: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('ai_telemetry')
        .insert({
          user_id: user?.id || null,
          event_type: eventType,
          metadata
        });
    } catch (error) {
      // Telemetry errors should not break the app
      logger.ai.warn('Failed to log telemetry', error);
    }
  }

  // Helper methods

  private createError(
    message: string,
    code: AIErrorCode = AIErrorCode.UNKNOWN
  ): AIError {
    const error = new Error(message) as AIError;
    error.code = code;
    error.severity = 'medium';
    error.userMessage = this.getUserFriendlyMessage(code);
    return error;
  }

  private handleError(error: any): AIError {
    if (error.code) {
      return error;
    }

    const aiError = this.createError(
      error.message || 'An unknown error occurred'
    );

    // Check for specific error types
    if (error.message?.includes('network')) {
      aiError.code = AIErrorCode.NETWORK_ERROR;
      aiError.userMessage = 'İnternet bağlantınızı kontrol edin';
    } else if (error.message?.includes('rate limit')) {
      aiError.code = AIErrorCode.RATE_LIMIT;
      aiError.userMessage = 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin';
    }

    return aiError;
  }

  private getUserFriendlyMessage(code: AIErrorCode): string {
    const messages = {
      [AIErrorCode.FEATURE_DISABLED]: 'Bu özellik şu anda kullanılamıyor',
      [AIErrorCode.NETWORK_ERROR]: 'Bağlantı hatası oluştu',
      [AIErrorCode.RATE_LIMIT]: 'Çok fazla istek gönderdiniz',
      [AIErrorCode.INVALID_RESPONSE]: 'Geçersiz yanıt alındı',
      [AIErrorCode.SAFETY_VIOLATION]: 'Güvenlik ihlali tespit edildi',
      [AIErrorCode.PRIVACY_VIOLATION]: 'Gizlilik ihlali tespit edildi',
      [AIErrorCode.MODEL_ERROR]: 'AI modeli hatası',
      [AIErrorCode.UNKNOWN]: 'Bir hata oluştu'
    };

    return messages[code] || messages[AIErrorCode.UNKNOWN];
  }
}

// Export singleton instance
export const aiService = AIService.getInstance(); 