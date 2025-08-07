/**
 * AI Chat Service - External API Integration
 * Supports OpenAI and Google Gemini with fallback mechanisms
 */

import { ChatContext, AIResponse, AIProvider } from '@/constants/aiConfig';
import { getAIConfig, OKB_SPECIALIST_SYSTEM_PROMPT, PROMPT_TEMPLATES } from '@/constants/aiConfig';
import { isFeatureEnabled } from '@/constants/featureFlags';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export { ChatContext } from '@/constants/aiConfig';

export interface ChatSession {
  messages: ChatMessage[];
  context?: ChatContext;
  provider: AIProvider;
  model: string;
}

class AIChatService {
  private static instance: AIChatService;
  private currentProvider: AIProvider;
  private config: any;

  private constructor() {
    const aiConfig = getAIConfig();
    this.currentProvider = aiConfig.provider;
    this.config = aiConfig.config;
    
    // Debug logging in development
    if (__DEV__) {
      console.log('[AIChatService] Config loaded:', {
        provider: this.currentProvider,
        hasApiKey: !!aiConfig.config.apiKey,
        model: aiConfig.config.model,
        apiKeyFirst10: aiConfig.config.apiKey?.substring(0, 10) + '...'
      });
    }
    
    // No fallback providers needed - using only selected provider
    console.log(`[AIChatService] Initialized with provider: ${this.currentProvider}`);
  }

  public static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  /**
   * Send message with selected AI provider only (no fallback)
   */
  public async sendMessage(
    userMessage: string,
    context?: ChatContext,
    messageHistory: ChatMessage[] = []
  ): Promise<AIResponse> {
    // Check if AI Chat is enabled
    if (!isFeatureEnabled('AI_CHAT')) {
      return this.getFallbackResponse(userMessage, false);
    }

    // Crisis detection
    if (this.detectCrisis(userMessage)) {
      return {
        success: true,
        message: this.getCrisisResponseMessage(),
        provider: 'claude' as AIProvider, // Use valid provider type
        model: 'safety-filter',
        timestamp: new Date()
      };
    }

    // Prepare messages with system prompt
    const systemPrompt = PROMPT_TEMPLATES.GENERAL_CHAT(userMessage, context);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt, timestamp: new Date() },
      ...messageHistory,
      { role: 'user', content: userMessage, timestamp: new Date() }
    ];

    // Use only the selected provider from AI_PROVIDER env variable
    const aiConfig = getAIConfig();
    const selectedProvider = aiConfig.provider;

    try {
      console.log(`[AIChatService] Using selected provider: ${selectedProvider}`);
      const response = await this.callAIProvider(selectedProvider, messages);
      
      if (response.success) {
        return response;
      } else {
        throw new Error('Provider response failed');
      }
    } catch (error) {
      console.warn(`[AIChatService] Selected provider ${selectedProvider} failed:`, error);
      
      // Return local fallback instead of trying other providers
      return this.getFallbackResponse(userMessage, false);
    }
  }

  /**
   * Call AI Provider with error handling
   */
  private async callAIProvider(
    provider: AIProvider, 
    messages: ChatMessage[]
  ): Promise<AIResponse> {
    // Get the current AI configuration
    const config = getAIConfig();
    
    // Make sure we're using the provider that was requested
    if (provider !== config.provider) {
      // If requested provider is different from config, get fresh config for that provider
      // This should not happen in single-provider mode, but keeping for safety
      console.warn(`[AIChatService] Provider mismatch: requested ${provider}, config has ${config.provider}`);
    }

    // Check if API key is properly configured
    if (!config.config.apiKey ||
        config.config.apiKey === '' ||
        config.config.apiKey === 'demo-key-disabled' ||
        config.config.apiKey.includes('your-') ||
        config.config.apiKey.includes('test-key')) {

      return {
        success: false,
        message: `🔧 ${provider.toUpperCase()} API anahtarı yapılandırılmamış. Şimdilik yerel AI desteği kullanılıyor.\n\n💡 Gerçek API anahtarları için .env.local dosyasını kontrol edin.`,
        provider: provider,
        model: 'fallback',
        timestamp: new Date(),
        error: 'API key not configured'
      };
    }

    switch (provider) {
      case 'openai':
        return this.callOpenAI(messages, config.config);
      case 'gemini':
        return this.callGemini(messages, config.config);
      case 'claude':
        return this.callClaude(messages, config.config);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * OpenAI API Integration
   */
  private async callOpenAI(
    messages: ChatMessage[], 
    config: any
  ): Promise<AIResponse> {
    // Create AbortController for timeout (React Native compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENAI_ORGANIZATION && {
            'OpenAI-Organization': process.env.OPENAI_ORGANIZATION
          })
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: OKB_SPECIALIST_SYSTEM_PROMPT },
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        message: data.choices[0]?.message?.content || 'Üzgünüm, yanıt oluşturamadım.',
        provider: 'openai',
        model: config.model,
        tokens: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0
        },
        timestamp: new Date()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Google Gemini API Integration
   */
  private async callGemini(
    messages: ChatMessage[], 
    config: any
  ): Promise<AIResponse> {
    // Create AbortController for timeout (React Native compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      // Prepare contents for Gemini API
      const contents = [
        { role: 'user', parts: [{ text: OKB_SPECIALIST_SYSTEM_PROMPT }] },
        ...messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }))
      ];

      const response = await fetch(
        `${config.baseURL}/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: config.maxTokens,
              temperature: config.temperature,
              topP: 0.8,
              topK: 40
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error('No content generated by Gemini');
      }

      return {
        success: true,
        message: content,
        provider: 'gemini',
        model: config.model,
        timestamp: new Date()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Anthropic Claude API Integration
   */
  private async callClaude(
    messages: ChatMessage[], 
    config: any
  ): Promise<AIResponse> {
    // Create AbortController for timeout (React Native compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      // Prepare messages for Claude API format
      const claudeMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }));

      // Add system message separately (Claude's format)
      const systemMessage = messages.find(msg => msg.role === 'system')?.content || 'Sen OKB konusunda uzman bir terapistsin. Kullanıcılara empatik ve profesyonel bir şekilde yardım et.';

      const response = await fetch(
        `${config.baseURL}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            system: systemMessage,
            messages: claudeMessages
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || 'API Error';
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(`Claude API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;

      if (!content) {
        throw new Error('No content generated by Claude');
      }

      return {
        success: true,
        message: content,
        provider: 'claude',
        model: config.model,
        timestamp: new Date()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * Crisis detection in user messages
   */
  private detectCrisis(message: string): boolean {
    const crisisKeywords = [
      'intihar', 'öldür', 'ölmek istiyorum', 'yaşamak istemiyorum',
      'kendime zarar', 'dayanamıyorum', 'umutsuz', 'çaresiz',
      'hiçbir şey işe yaramıyor', 'bitti artık', 'elveda'
    ];

    const lowerMessage = message.toLowerCase();
    return crisisKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Fallback response when all AI providers fail
   */
  private getFallbackResponse(userMessage: string, isCrisis: boolean): AIResponse {
    let fallbackMessage = '';

    if (isCrisis) {
      fallbackMessage = `🆘 Size derhal profesyonel yardım almanızı öneriyorum. 

📞 Acil Yardım Hatları:
• İntihar Önleme: 183
• AMATEM: 444 6 483
• Ruh Sağlığı ACİL: 112

💙 Lütfen yalnız olmadığınızı unutmayın. Bu zor anlar geçicidir ve size yardım edecek insanlar var.`;
    } else {
      fallbackMessage = `Üzgünüm, şu anda AI servislerimizde teknik bir sorun yaşanıyor. 

💚 Ancak size şunu hatırlatmak isterim: OKB ile mücadelenizde yalnız değilsiniz. Bu zorlu anları atlatabilecek güçteysiniz.

🔄 Lütfen birkaç dakika sonra tekrar deneyin veya uygulamanın diğer özelliklerini kullanın:
• ERP egzersizleri
• Nefes alma teknikleri  
• Günlük kayıt tutma

Bu geçici sorun için özür dileriz. 🙏`;
    }

    return {
      success: true,
      message: fallbackMessage,
      provider: 'fallback' as AIProvider,
      model: 'local-fallback',
      timestamp: new Date()
    };
  }

  /**
   * Get crisis response message
   */
  private getCrisisResponseMessage(): string {
    return `🆘 Size derhal profesyonel yardım almanızı öneriyorum. 

📞 Acil Yardım Hatları:
• İntihar Önleme: 183
• AMATEM: 444 6 483
• Ruh Sağlığı ACİL: 112

💙 Lütfen yalnız olmadığınızı unutmayın. Bu zor anlar geçicidir ve size yardım edecek insanlar var.`;
  }

  /**
   * Get chat session summary for context
   */
  public async generateSessionSummary(messages: ChatMessage[]): Promise<string> {
    if (messages.length < 3) return 'Kısa sohbet';

    const lastFewMessages = messages.slice(-6);
    const summaryPrompt = `Aşağıdaki OKB terapisi sohbetinin kısa bir özetini çıkar (maksimum 2 cümle):

${lastFewMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Özet:`;

    try {
      const response = await this.sendMessage(summaryPrompt);
      return response.message.slice(0, 100) + '...';
    } catch {
      return 'OKB desteği sohbeti';
    }
  }

  /**
   * Update user context for better responses
   */
  public updateUserContext(context: Partial<ChatContext>): void {
    // Store context in local storage or state management
    // This will be used for future conversations
    console.log('[AIChatService] Context updated:', context);
  }
}

export default AIChatService.getInstance(); 