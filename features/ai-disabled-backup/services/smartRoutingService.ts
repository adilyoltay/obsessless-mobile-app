/**
 * 🗂️ Smart Routing & Prefilling Service
 * 
 * Intelligent navigation system with:
 * - AI-based route prediction from analysis results
 * - Contextual form prefilling with extracted data
 * - Screen-specific parameter optimization
 * - User intent prediction and route suggestion
 * - Progressive enhancement based on user behavior
 * 
 * v2.1 - Week 2 Implementation
 */

import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface SmartRouteConfig {
  screen: string;
  params: Record<string, any>;
  priority: number; // 1-10, higher = more likely
  confidence: number; // 0-1, AI confidence in this route
  reasoning: string[];
  fallbackRoutes: SmartRouteConfig[];
  metadata: RouteMetadata;
}

export interface RouteMetadata {
  source: 'ai_analysis' | 'user_pattern' | 'context_inference' | 'fallback';
  generatedAt: number;
  userId: string;
  sessionId: string;
  analysisData: any;
  userPreferences?: UserRoutingPreferences;
}

export interface UserRoutingPreferences {
  preferredScreens: string[];
  formPrefillPreference: 'always' | 'contextual' | 'never';
  navigationStyle: 'direct' | 'confirmFirst' | 'progressive';
  lastUsedScreens: string[];
  screenSuccessRates: Record<string, number>;
  averageEngagementTimes: Record<string, number>;
}

export interface AnalysisResult {
  type: 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK' | 'MIXED';
  confidence: number;
  extractedData: Record<string, any>;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  context?: any;
  userInput?: string;
}

export interface PrefillData {
  screen: string;
  fields: Record<string, any>;
  validationRules?: Record<string, any>;
  autoSubmit?: boolean;
  skipConfirmation?: boolean;
}

// =============================================================================
// ROUTE MAPPING CONFIGURATIONS
// =============================================================================

const SCREEN_CONFIGS = {
  'mood': {
    path: '/(tabs)/index',
    supportedParams: ['prefill', 'mood', 'text', 'trigger', 'timestamp', 'context'],
    requiredForPrefill: ['mood'],
    validation: {
      mood: (val: any) => typeof val === 'number' && val >= 1 && val <= 10,
      text: (val: any) => typeof val === 'string' && val.length <= 500,
      trigger: (val: any) => ['voice', 'manual', 'scheduled', 'reminder'].includes(val)
    }
  },
  // No-op adapter: legacy 'cbt' routes now map to Mood screen
  'cbt': {
    path: '/(tabs)/index',
    supportedParams: ['prefill', 'mood', 'text', 'trigger', 'timestamp', 'context'],
    requiredForPrefill: ['mood'],
    validation: {
      mood: (val: any) => typeof val === 'number' && val >= 1 && val <= 10,
      text: (val: any) => typeof val === 'string' && val.length <= 500,
      trigger: (val: any) => ['voice', 'manual', 'scheduled', 'reminder'].includes(val)
    }
  },
  // No-op adapter: legacy 'tracking' routes now map to Breathwork screen
  'tracking': {
    path: '/(tabs)/breathwork',
    supportedParams: ['protocol', 'duration', 'autoStart', 'source', 'suggestionId', 'urgency', 'customization', 'anxietyLevel'],
    requiredForPrefill: ['protocol'],
    validation: {
      protocol: (val: any) => ['4-7-8', 'box', 'paced', 'extended', 'quick_calm', 'custom'].includes(val),
      duration: (val: any) => typeof val === 'number' && val > 0,
      autoStart: (val: any) => ['true', 'false'].includes(String(val)),
      anxietyLevel: (val: any) => typeof val === 'number' && val >= 1 && val <= 10
    }
  },

  
  'breathwork': {
    path: '/(tabs)/breathwork',
    supportedParams: ['protocol', 'duration', 'autoStart', 'source', 'suggestionId', 'urgency', 'customization', 'anxietyLevel'],
    requiredForPrefill: ['protocol'],
    validation: {
      protocol: (val: any) => ['4-7-8', 'box', 'paced', 'extended', 'quick_calm', 'custom'].includes(val),
      duration: (val: any) => typeof val === 'number' && val > 0,
      autoStart: (val: any) => ['true', 'false'].includes(String(val)),
      anxietyLevel: (val: any) => typeof val === 'number' && val >= 1 && val <= 10
    }
  }
};

// =============================================================================
// DATA EXTRACTION PATTERNS
// =============================================================================

class DataExtractionEngine {
  /**
   * Extract structured data from text input for form prefilling
   */
  static extractFromText(text: string, targetScreen: string): Record<string, any> {
    const extracted: Record<string, any> = {};
    const lowerText = text.toLowerCase();
    
    switch (targetScreen) {
      case 'mood':
        extracted.mood = this.extractMoodScore(text);
        extracted.trigger = this.extractMoodTrigger(text);
        break;
        
      case 'cbt':
        extracted.situation = this.extractSituation(text);
        extracted.thoughts = this.extractThoughts(text);
        extracted.distortions = this.extractCognitiveDistortions(text);
        extracted.mood_before = this.extractMoodScore(text);
        break;
        
      case 'tracking':
        extracted.category = this.extractCompulsionCategory(text);
        extracted.resistanceLevel = this.extractResistanceLevel(text);
        extracted.intensity = this.extractIntensity(text);
        extracted.severity = this.extractSeverity(text);
        extracted.location = this.extractLocation(text);
        break;
        

        
      case 'breathwork':
        extracted.anxietyLevel = this.extractAnxietyLevel(text);
        extracted.protocol = this.selectBreathworkProtocol(text);
        break;
    }
    
    // Common extractions
    extracted.text = text;
    extracted.timestamp = Date.now();
    
    return extracted;
  }
  
  // Extraction helper methods
  private static extractMoodScore(text: string): number {
    const moodPatterns = {
      10: /mükemmel|harika|çok mutlu|en iyi|süper|muhteşem/i,
      9: /çok iyi|mutlu|keyifli|güzel|pozitif/i,
      8: /iyi|normal üstü|fena değil/i,
      7: /idare eder|ortalama üstü|kötü değil/i,
      6: /ortalama|normal|eh işte/i,
      5: /ne iyi ne kötü|kararsız|belirsiz/i,
      4: /biraz kötü|keyifsiz|moralim bozuk/i,
      3: /kötü|üzgün|mutsuz|depresif/i,
      2: /çok kötü|berbat|çok üzgün/i,
      1: /en kötü|dayanamıyorum|çok berbat|en dibime vurdum/i
    };
    
    for (const [score, pattern] of Object.entries(moodPatterns)) {
      if (pattern.test(text)) {
        return parseInt(score);
      }
    }
    
    return 5; // Default neutral
  }
  
  private static extractMoodTrigger(text: string): string {
    const triggers = {
      'work': /iş|çalış|patron|maaş|proje|toplantı|stres/i,
      'family': /aile|anne|baba|kardeş|eş|çocuk/i,
      'health': /sağlık|hastalık|ağrı|doktor|tedavi/i,
      'social': /arkadaş|sosyal|parti|etkinlik|yalnız/i,
      'financial': /para|borç|fatura|harcama|maaş/i,
      'relationship': /ilişki|sevgili|aşk|kavga|ayrılık/i,
      'other': /.*/
    };
    
    for (const [trigger, pattern] of Object.entries(triggers)) {
      if (pattern.test(text)) {
        return trigger;
      }
    }
    
    return 'other';
  }
  
  private static extractSituation(text: string): string {
    // Extract situational context for CBT
    const situationMarkers = [
      /durumda|olayda|anında|sırasında/i,
      /yaşadığım|karşılaştığım|başıma gelen/i,
      /ortamda|yerde|evde|işte/i
    ];
    
    for (const marker of situationMarkers) {
      const match = text.match(new RegExp(`(.{0,50})${marker.source}(.{0,50})`, 'i'));
      if (match) {
        return match[0].trim();
      }
    }
    
    // Fallback: first 100 characters
    return text.substring(0, 100);
  }
  
  private static extractThoughts(text: string): string {
    const thoughtMarkers = [
      /düşündüm|aklımdan geçti|inandım|hissettim/i,
      /düşünce|his|inanç|kanı/i,
      /sanıyorum|inanıyorum|hissediyorum/i
    ];
    
    for (const marker of thoughtMarkers) {
      const match = text.match(new RegExp(`(.{0,50})${marker.source}(.{0,100})`, 'i'));
      if (match) {
        return match[0].trim();
      }
    }
    
    return text; // Fallback to full text
  }
  
  private static extractCognitiveDistortions(text: string): string[] {
    const distortions: string[] = [];
    const lowerText = text.toLowerCase();
    
    const distortionPatterns = {
      'catastrophizing': /en kötüsü|felाket|korkunç|berbat olacak|mahvoldum/i,
      'all_or_nothing': /hep|hiç|asla|kesinlikle|tamamen|hiçbir zaman/i,
      'mind_reading': /düşünüyor|ne dediğini biliyorum|beni|sevmiyor/i,
      'personalization': /benim yüzümden|benim hatam|ben sebep/i,
      'labeling': /ben bir|ben hiç|hep böyleyim|karakterim/i
    };
    
    for (const [distortion, pattern] of Object.entries(distortionPatterns)) {
      if (pattern.test(lowerText)) {
        distortions.push(distortion);
      }
    }
    
    return distortions;
  }
  
  private static extractCompulsionCategory(text: string): string {
    const categories = {
      'cleaning': /temiz|yıka|deterjan|mikrop|pis|kirli/i,
      'checking': /kontrol|bak|kilitle|kapat|aç/i,
      'counting': /say|rakam|çift|tekrar et/i,
      'arranging': /düzen|sıra|yerleştir|karıştır/i,
      'hoarding': /biriktir|at|sakla|topla/i,
      'other': /.*/
    };
    
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(text)) {
        return category;
      }
    }
    
    return 'other';
  }
  
  private static extractResistanceLevel(text: string): number {
    const resistancePatterns = {
      10: /direndim|karşı koydum|yapmadım|güçlü/i,
      8: /zorlandım ama|biraz direndim/i,
      6: /kararsız kaldım|emin değilim/i,
      4: /biraz yaptım|kısmen/i,
      2: /yapamadım|yenildim|dayanamadım/i,
      1: /tamamen yenildim|hiç direnemem/i
    };
    
    for (const [level, pattern] of Object.entries(resistancePatterns)) {
      if (pattern.test(text)) {
        return parseInt(level);
      }
    }
    
    return 5; // Default neutral
  }
  
  private static extractIntensity(text: string): number {
    const intensityPatterns = {
      10: /dayanılmaz|en şiddetli|çok güçlü/i,
      8: /çok şiddetli|yoğun|güçlü/i,
      6: /orta|normal|fena değil/i,
      4: /hafif|az|biraz/i,
      2: /çok hafif|neredeyse yok/i
    };
    
    for (const [intensity, pattern] of Object.entries(intensityPatterns)) {
      if (pattern.test(text)) {
        return parseInt(intensity);
      }
    }
    
    return 5; // Default medium
  }

  private static extractSeverity(text: string): number {
    const severityPatterns = {
      10: /dayanılmaz|çıldıracağım|en kötü|dehşet verici/i,
      9: /çok kötü|berbat|korkunç|vahim/i,
      8: /şiddetli|yoğun|güçlü|ağır/i,
      7: /ciddi|önemli|belirgin/i,
      6: /orta|normal|fena değil/i,
      5: /ne çok ne az|kararsız|belirsiz/i,
      4: /hafif|az|biraz|küçük/i,
      3: /çok hafif|minimal|az/i,
      2: /neredeyse yok|çok az/i,
      1: /yok denecek kadar az|hiç yok/i
    };
    
    for (const [severity, pattern] of Object.entries(severityPatterns)) {
      if (pattern.test(text)) {
        return parseInt(severity);
      }
    }
    
    return 5; // Default medium
  }
  
  private static extractLocation(text: string): string {
    const locations = {
      'home': /ev|evde|oda|mutfak|banyo/i,
      'work': /iş|ofis|çalış|iş yeri/i,
      'public': /dışarı|sokak|market|park|otobüs/i,
      'other': /.*/
    };
    
    for (const [location, pattern] of Object.entries(locations)) {
      if (pattern.test(text)) {
        return location;
      }
    }
    
    return 'other';
  }
  
  private static extractCategory(text: string): string {
    const categories = {
      'contamination': /mikrop|temiz|kirli|hastalık/i,
      'harm': /zarar|kaza|yaralanma|ölüm/i,
      'symmetry': /simetri|düzen|eşit|dengeli/i,
      'religious': /din|günah|ibadet|dua/i,
      'sexual': /cinsel|uygunsuz düşünce/i,
      'other': /.*/
    };
    
    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(text)) {
        return category;
      }
    }
    
    return 'other';
  }
  
  private static extractDifficulty(text: string): number {
    const difficultyPatterns = {
      10: /en zor|imkansız|dayanılmaz/i,
      8: /çok zor|çok güç/i,
      6: /zor|güç|zorlanıyorum/i,
      4: /orta|idare eder/i,
      2: /kolay|basit|rahatlıkla/i
    };
    
    for (const [difficulty, pattern] of Object.entries(difficultyPatterns)) {
      if (pattern.test(text)) {
        return parseInt(difficulty);
      }
    }
    
    return 5; // Default medium
  }
  
  private static extractPersonalGoal(text: string): string {
    const goalPatterns = [
      /hedefim|istiyorum|planım/i,
      /amaç|gaye|niyetim/i,
      /başarmak|yapmak|olmak/i
    ];
    
    for (const pattern of goalPatterns) {
      const match = text.match(new RegExp(`(.{0,30})${pattern.source}(.{0,50})`, 'i'));
      if (match) {
        return match[0].trim();
      }
    }
    
    return 'Genel iyileşme ve direncimi artırma';
  }
  
  private static extractAnxietyLevel(text: string): number {
    const anxietyPatterns = {
      10: /panik|dehşet|çok korkunç|dayanamıyorum/i,
      8: /çok endişeli|çok gergin|çok kaygılı/i,
      6: /endişeli|gergin|kaygılı|stresli/i,
      4: /biraz endişeli|hafif kaygı/i,
      2: /sakin|rahatlık|huzur/i
    };
    
    for (const [level, pattern] of Object.entries(anxietyPatterns)) {
      if (pattern.test(text)) {
        return parseInt(level);
      }
    }
    
    return 5; // Default medium
  }
  
  private static selectBreathworkProtocol(text: string): string {
    if (/panik|acil|hemen|şimdi/i.test(text)) return 'quick_calm';
    if (/uyku|gece|yat|dinlen/i.test(text)) return '4-7-8';
    if (/sakin|yavaş|rahatlat/i.test(text)) return 'paced';
    if (/odaklan|konsantre|denge/i.test(text)) return 'box';
    if (/uzun|derin|meditasyon/i.test(text)) return 'extended';
    
    return 'box'; // Default
  }
}

// =============================================================================
// MAIN SMART ROUTING SERVICE
// =============================================================================

export class SmartRoutingService {
  private static instance: SmartRoutingService;
  
  public static getInstance(): SmartRoutingService {
    if (!SmartRoutingService.instance) {
      SmartRoutingService.instance = new SmartRoutingService();
    }
    return SmartRoutingService.instance;
  }
  
  /**
   * Generate smart route configuration from AI analysis result
   */
  async generateSmartRoute(
    analysisResult: AnalysisResult,
    userId: string,
    sessionId: string = `session_${Date.now()}`
  ): Promise<SmartRouteConfig | null> {
    try {
      if (!FEATURE_FLAGS.isEnabled('AI_SMART_ROUTING')) {
        return this.generateFallbackRoute(analysisResult, userId);
      }
      
      // Load user routing preferences
      const userPreferences = await this.getUserRoutingPreferences(userId);
      
      // Generate route based on analysis result
      const route = await this.analyzeAndRoute(analysisResult, userPreferences, userId, sessionId);
      
      if (route) {
        // Track route generation
        await trackAIInteraction('smart_route_generated' as AIEventType, {
          userId,
          sessionId,
          targetScreen: route.screen,
          confidence: route.confidence,
          priority: route.priority,
          source: route.metadata.source,
          analysisType: analysisResult.type
        });
        
        // Update user preferences based on generated route
        await this.updateUserPreferences(userId, route);
      }
      
      return route;
      
    } catch (error) {
      console.error('Smart route generation failed:', error);
      return this.generateFallbackRoute(analysisResult, userId);
    }
  }
  
  /**
   * Navigate to a screen with smart prefilling
   */
  async navigateWithPrefill(
    routeConfig: SmartRouteConfig,
    options: {
      confirmFirst?: boolean;
      showProgress?: boolean;
      onSuccess?: () => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<boolean> {
    try {
      const { screen, params } = routeConfig;
      const screenConfig = SCREEN_CONFIGS[screen as keyof typeof SCREEN_CONFIGS];
      
      if (!screenConfig) {
        throw new Error(`Unknown screen: ${screen}`);
      }
      
      // Validate parameters
      const validatedParams = this.validateAndCleanParams(params, screenConfig);
      
      // Add prefill flag
      validatedParams.prefill = 'true';
      
      // Track navigation attempt
      await trackAIInteraction('smart_navigation_attempted' as AIEventType, {
        userId: routeConfig.metadata.userId,
        screen,
        params: Object.keys(validatedParams),
        confidence: routeConfig.confidence
      });
      
      // Navigate
      router.push({
        pathname: screenConfig.path as any,
        params: validatedParams
      });
      
      // Track successful navigation
      await trackAIInteraction('smart_navigation_completed' as AIEventType, {
        userId: routeConfig.metadata.userId,
        screen,
        success: true
      });
      
      options.onSuccess?.();
      return true;
      
    } catch (error) {
      console.error('Smart navigation failed:', error);
      
      // Track navigation failure
      await trackAIInteraction('smart_navigation_failed' as AIEventType, {
        userId: routeConfig.metadata.userId,
        screen: routeConfig.screen,
        error: error instanceof Error ? error.message : String(error)
      });
      
      options.onError?.(error instanceof Error ? error.message : 'Navigation failed');
      return false;
    }
  }
  
  /**
   * Get multiple route suggestions ranked by priority
   */
  async getRouteSuggestions(
    analysisResult: AnalysisResult,
    userId: string,
    maxSuggestions: number = 3
  ): Promise<SmartRouteConfig[]> {
    const suggestions: SmartRouteConfig[] = [];
    
    try {
      const userPreferences = await this.getUserRoutingPreferences(userId);
      
      // Primary route (highest confidence)
      const primaryRoute = await this.generateSmartRoute(analysisResult, userId);
      if (primaryRoute) {
        suggestions.push(primaryRoute);
      }
      
      // Alternative routes based on analysis type
      const alternativeRoutes = await this.generateAlternativeRoutes(
        analysisResult,
        userPreferences,
        userId
      );
      
      suggestions.push(...alternativeRoutes);
      
      // Sort by priority and limit
      return suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxSuggestions);
        
    } catch (error) {
      console.error('Route suggestions generation failed:', error);
      return suggestions;
    }
  }
  
  // Private helper methods
  private async analyzeAndRoute(
    analysisResult: AnalysisResult,
    userPreferences: UserRoutingPreferences,
    userId: string,
    sessionId: string
  ): Promise<SmartRouteConfig | null> {
    const { type, confidence, extractedData, urgency, context, userInput } = analysisResult;
    
    let targetScreen: string;
    let priority: number;
    let routeConfidence: number;
    let reasoning: string[] = [];
    
    // Primary routing logic based on analysis type
    switch (type) {
      case 'CBT':
        // Remapped to Mood
        targetScreen = 'mood';
        priority = 8;
        routeConfidence = confidence;
        reasoning.push(`CBT analysis remapped to Mood with ${Math.round(confidence * 100)}% confidence`);
        break;

      case 'OCD':
        // Remapped to Breathwork
        targetScreen = 'breathwork';
        priority = urgency === 'critical' ? 10 : 7;
        routeConfidence = confidence;
        reasoning.push(`OCD patterns remapped to Breathwork with ${Math.round(confidence * 100)}% confidence`);
        break;
        

        
      case 'MOOD':
        targetScreen = 'mood';
        priority = 5;
        routeConfidence = confidence;
        reasoning.push(`Mood tracking recommended`);
        break;
        
      case 'BREATHWORK':
        targetScreen = 'breathwork';
        priority = urgency === 'critical' ? 10 : 4;
        routeConfidence = confidence;
        reasoning.push(`Breathwork session recommended (urgency: ${urgency})`);
        break;
        
      default:
        // Mixed or unclear - use user preferences
        const preferredScreen = userPreferences.preferredScreens[0];
        if (preferredScreen) {
          targetScreen = preferredScreen;
          priority = 3;
          routeConfidence = 0.5;
          reasoning.push('Based on user preferences (mixed analysis)');
        } else {
          return null;
        }
    }
    
    // Apply user preference adjustments
    if (userPreferences.preferredScreens.includes(targetScreen)) {
      priority += 1;
      reasoning.push('Matched user preferred screen');
    }
    
    const screenSuccessRate = userPreferences.screenSuccessRates[targetScreen] || 0.5;
    if (screenSuccessRate > 0.7) {
      priority += 1;
      routeConfidence = Math.min(routeConfidence + 0.1, 1);
      reasoning.push(`High success rate on ${targetScreen} (${Math.round(screenSuccessRate * 100)}%)`);
    }
    
    // Extract and prepare prefill data
    const prefillData = this.preparePrefillData(targetScreen, extractedData, userInput || '', context);
    
    // Generate fallback routes
    const fallbackRoutes = this.generateFallbackRoutes(type, userId);
    
    return {
      screen: targetScreen,
      params: prefillData.fields,
      priority,
      confidence: routeConfidence,
      reasoning,
      fallbackRoutes,
      metadata: {
        source: 'ai_analysis',
        generatedAt: Date.now(),
        userId,
        sessionId,
        analysisData: analysisResult,
        userPreferences
      }
    };
  }
  
  private preparePrefillData(
    targetScreen: string,
    extractedData: Record<string, any>,
    userInput: string,
    context: any
  ): PrefillData {
    const screenConfig = SCREEN_CONFIGS[targetScreen as keyof typeof SCREEN_CONFIGS];
    
    if (!screenConfig) {
      return { screen: targetScreen, fields: {} };
    }
    
    // Extract data from user input using AI
    const aiExtracted = DataExtractionEngine.extractFromText(userInput, targetScreen);
    
    // Merge extracted data with analysis results
    const mergedData = { ...extractedData, ...aiExtracted };
    
    // Filter only supported parameters
    const validFields: Record<string, any> = {};
    
    screenConfig.supportedParams.forEach(param => {
      if (mergedData[param] !== undefined) {
        validFields[param] = mergedData[param];
      }
    });
    
    return {
      screen: targetScreen,
      fields: validFields,
      validationRules: screenConfig.validation,
      autoSubmit: false,
      skipConfirmation: false
    };
  }
  
  private validateAndCleanParams(
    params: Record<string, any>,
    screenConfig: any
  ): Record<string, any> {
    const validatedParams: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (screenConfig.supportedParams.includes(key)) {
        const validator = screenConfig.validation?.[key];
        
        if (!validator || validator(value)) {
          validatedParams[key] = String(value); // Convert to string for router params
        }
      }
    }
    
    return validatedParams;
  }
  
  private generateFallbackRoute(
    analysisResult: AnalysisResult,
    userId: string
  ): SmartRouteConfig {
    // Simple fallback routing
    const fallbackScreens = {
      'CBT': 'mood',
      'OCD': 'breathwork',

      'MOOD': 'mood',
      'BREATHWORK': 'breathwork'
    } as Record<string, string>;
    
    const screen = fallbackScreens[analysisResult.type] || 'mood';
    
    return {
      screen,
      params: { 
        text: analysisResult.extractedData.text || '',
        prefill: 'true'
      },
      priority: 3,
      confidence: 0.5,
      reasoning: ['Fallback route (feature disabled)'],
      fallbackRoutes: [],
      metadata: {
        source: 'fallback',
        generatedAt: Date.now(),
        userId,
        sessionId: `fallback_${Date.now()}`,
        analysisData: analysisResult
      }
    };
  }
  
  private async generateAlternativeRoutes(
    analysisResult: AnalysisResult,
    userPreferences: UserRoutingPreferences,
    userId: string
  ): Promise<SmartRouteConfig[]> {
    const alternatives: SmartRouteConfig[] = [];
    const allowedScreens = new Set(['mood', 'breathwork']);
    
    // Add user's frequently used screens as alternatives
    const frequentScreens = Object.entries(userPreferences.screenSuccessRates)
      .filter(([_, rate]) => rate > 0.6)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 2)
      .map(([screen]) => screen)
      .filter((screen) => allowedScreens.has(screen));
    
    for (const screen of frequentScreens) {
      if (screen !== analysisResult.type.toLowerCase()) {
        alternatives.push({
          screen,
          params: { prefill: 'true' },
          priority: 2,
          confidence: 0.4,
          reasoning: [`Alternative based on user success history`],
          fallbackRoutes: [],
          metadata: {
            source: 'user_pattern',
            generatedAt: Date.now(),
            userId,
            sessionId: `alt_${Date.now()}`,
            analysisData: analysisResult,
            userPreferences
          }
        });
      }
    }
    
    return alternatives;
  }
  
  private generateFallbackRoutes(
    analysisType: string,
    userId: string
  ): SmartRouteConfig[] {
    const fallbacks: SmartRouteConfig[] = [];
    
    // Always include mood as ultimate fallback
    if (analysisType !== 'MOOD') {
      fallbacks.push({
        screen: 'mood',
        params: { prefill: 'true' },
        priority: 1,
        confidence: 0.3,
        reasoning: ['Universal fallback'],
        fallbackRoutes: [],
        metadata: {
          source: 'fallback',
          generatedAt: Date.now(),
          userId,
          sessionId: `fallback_${Date.now()}`,
          analysisData: null
        }
      });
    }
    
    return fallbacks;
  }
  
  private async getUserRoutingPreferences(userId: string): Promise<UserRoutingPreferences> {
    try {
      const storageKey = `routing_preferences_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Default preferences
      return {
        preferredScreens: ['mood'],
        formPrefillPreference: 'contextual',
        navigationStyle: 'direct',
        lastUsedScreens: [],
        screenSuccessRates: {},
        averageEngagementTimes: {}
      };
      
    } catch (error) {
      console.error('Failed to load routing preferences:', error);
      return {
        preferredScreens: [],
        formPrefillPreference: 'contextual',
        navigationStyle: 'direct',
        lastUsedScreens: [],
        screenSuccessRates: {},
        averageEngagementTimes: {}
      };
    }
  }
  
  private async updateUserPreferences(
    userId: string,
    route: SmartRouteConfig
  ): Promise<void> {
    try {
      const preferences = await this.getUserRoutingPreferences(userId);
      
      // Update last used screens
      preferences.lastUsedScreens.unshift(route.screen);
      preferences.lastUsedScreens = preferences.lastUsedScreens.slice(0, 10); // Keep last 10
      
      // Update preferred screens based on usage
      if (!preferences.preferredScreens.includes(route.screen)) {
        preferences.preferredScreens.push(route.screen);
      }
      
      const storageKey = `routing_preferences_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(preferences));
      
    } catch (error) {
      console.error('Failed to update routing preferences:', error);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const smartRoutingService = SmartRoutingService.getInstance();
