/**
 * 🚀 Unified AI Pipeline v1.0
 * 
 * Tüm AI analizlerini tek pipeline'da toplar:
 * - Voice Analysis (Unified Voice)
 * - Pattern Recognition
 * - Insights Generation
 * - CBT Analysis
 * 
 * Today sayfası sadece bu servisi çağırır, sonuçlar 24 saat cache'lenir.
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackAIInteraction, AIEventType } from '../telemetry/aiTelemetry';

/**
 * Simple deterministic hash function for React Native
 * Replaces crypto module which is not available in React Native
 */
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UnifiedPipelineInput {
  userId: string;
  content: string | any; // Voice text, user data, etc.
  type: 'voice' | 'data' | 'mixed';
  context?: {
    source: 'today' | 'tracking' | 'erp' | 'cbt' | 'mood';
    timestamp?: number;
    metadata?: Record<string, any>;
  };
}

export interface UnifiedPipelineResult {
  // Voice Analysis Results
  voice?: {
    category: 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK' | 'OTHER';
    confidence: number;
    suggestion?: string;
    route?: string;
  };
  
  // Pattern Recognition Results
  patterns?: {
    temporal: Array<{
      type: string;
      frequency: number;
      timeOfDay?: string;
      trend: 'increasing' | 'decreasing' | 'stable';
    }>;
    behavioral: Array<{
      trigger: string;
      response: string;
      frequency: number;
      severity: number;
    }>;
    environmental: Array<{
      location?: string;
      context: string;
      correlation: number;
    }>;
  };
  
  // Insights Results
  insights?: {
    therapeutic: Array<{
      text: string;
      category: string;
      priority: 'high' | 'medium' | 'low';
      actionable: boolean;
    }>;
    progress: Array<{
      metric: string;
      value: number;
      change: number;
      interpretation: string;
    }>;
  };
  
  // CBT Analysis Results
  cbt?: {
    distortions: string[];
    reframes: string[];
    techniques: string[];
    confidence: number;
  };
  
  // Metadata
  metadata: {
    pipelineVersion: string;
    processedAt: number;
    cacheTTL: number;
    source: 'cache' | 'fresh';
    processingTime: number;
  };
}

// ============================================================================
// MAIN PIPELINE CLASS
// ============================================================================

export class UnifiedAIPipeline {
  private static instance: UnifiedAIPipeline;
  private cache: Map<string, { result: UnifiedPipelineResult; expires: number }> = new Map();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private invalidationHooks: Map<string, () => void> = new Map();
  
  private constructor() {
    this.setupInvalidationHooks();
    this.startCacheCleanup();
  }
  
  static getInstance(): UnifiedAIPipeline {
    if (!UnifiedAIPipeline.instance) {
      UnifiedAIPipeline.instance = new UnifiedAIPipeline();
    }
    return UnifiedAIPipeline.instance;
  }
  
  // ============================================================================
  // MAIN PROCESSING METHOD
  // ============================================================================
  
  async process(input: UnifiedPipelineInput): Promise<UnifiedPipelineResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(input);
    
    // 1. Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      await trackAIInteraction(AIEventType.CACHE_HIT, {
        userId: input.userId,
        pipeline: 'unified',
        cacheKey
      });
      
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          source: 'cache'
        }
      };
    }
    
    // 2. Process through pipeline
    const result = await this.executePipeline(input);
    
    // 3. Cache the result
    this.setCache(cacheKey, result);
    
    // 4. Track telemetry
    await trackAIInteraction(AIEventType.ANALYSIS_COMPLETED, {
      userId: input.userId,
      pipeline: 'unified',
      processingTime: Date.now() - startTime,
      modules: this.getEnabledModules()
    });
    
    return {
      ...result,
      metadata: {
        ...result.metadata,
        source: 'fresh',
        processingTime: Date.now() - startTime
      }
    };
  }
  
  // ============================================================================
  // PIPELINE EXECUTION
  // ============================================================================
  
  private async executePipeline(input: UnifiedPipelineInput): Promise<UnifiedPipelineResult> {
    const result: UnifiedPipelineResult = {
      metadata: {
        pipelineVersion: '1.0.0',
        processedAt: Date.now(),
        cacheTTL: this.DEFAULT_TTL,
        source: 'fresh',
        processingTime: 0
      }
    };
    
    // Run analyses in parallel where possible
    const promises: Promise<void>[] = [];
    
    // 1. Voice Analysis (if voice input)
    if (input.type === 'voice' || input.type === 'mixed') {
      promises.push(
        this.processVoiceAnalysis(input).then(voice => {
          result.voice = voice;
        })
      );
    }
    
    // 2. Pattern Recognition (always run)
    promises.push(
      this.processPatternRecognition(input).then(patterns => {
        result.patterns = patterns;
      })
    );
    
    // 3. CBT Analysis (if relevant)
    if (this.shouldRunCBT(input)) {
      promises.push(
        this.processCBTAnalysis(input).then(cbt => {
          result.cbt = cbt;
        })
      );
    }
    
    // Wait for parallel analyses
    await Promise.allSettled(promises);
    
    // 4. Insights Generation (depends on patterns, so run after)
    if (result.patterns) {
      result.insights = await this.processInsightsGeneration(input, result.patterns);
    }
    
    return result;
  }
  
  // ============================================================================
  // INDIVIDUAL PROCESSORS
  // ============================================================================
  
  private async processVoiceAnalysis(input: UnifiedPipelineInput): Promise<any> {
    try {
      // Import lazily for better performance
      const { unifiedVoiceAnalysis } = await import('../services/checkinService');
      
      const analysis = await unifiedVoiceAnalysis(
        typeof input.content === 'string' ? input.content : JSON.stringify(input.content),
        { source: input.context?.source || 'today' }
      );
      
      return {
        category: analysis.type,
        confidence: analysis.confidence,
        suggestion: analysis.suggestion,
        route: analysis.route
      };
    } catch (error) {
      console.warn('Voice analysis failed:', error);
      return null;
    }
  }
  
  private async processPatternRecognition(input: UnifiedPipelineInput): Promise<any> {
    try {
      // Simplified pattern recognition logic
      // In real implementation, would use patternRecognitionV2
      
      const patterns = {
        temporal: [],
        behavioral: [],
        environmental: []
      };
      
      // Extract patterns from user data
      if (typeof input.content === 'object' && input.content.compulsions) {
        // Temporal patterns
        const timePatterns = this.extractTemporalPatterns(input.content.compulsions);
        patterns.temporal = timePatterns;
        
        // Behavioral patterns
        const behaviorPatterns = this.extractBehavioralPatterns(input.content.compulsions);
        patterns.behavioral = behaviorPatterns;
      }
      
      return patterns;
    } catch (error) {
      console.warn('Pattern recognition failed:', error);
      return null;
    }
  }
  
  private async processCBTAnalysis(input: UnifiedPipelineInput): Promise<any> {
    try {
      const { cbtEngine } = await import('../engines/cbtEngine');
      
      if (!cbtEngine.enabled) {
        return null;
      }
      
      const text = typeof input.content === 'string' 
        ? input.content 
        : input.content.description || '';
      
      const distortions = await cbtEngine.detectDistortions(text);
      const reframes = await cbtEngine.suggestReframes(text, distortions);
      
      return {
        distortions: distortions.map(d => d.name),
        reframes,
        techniques: [],
        confidence: 0.85
      };
    } catch (error) {
      console.warn('CBT analysis failed:', error);
      return null;
    }
  }
  
  private async processInsightsGeneration(
    input: UnifiedPipelineInput, 
    patterns: any
  ): Promise<any> {
    try {
      const insights = {
        therapeutic: [],
        progress: []
      };
      
      // Generate insights based on patterns
      if (patterns.temporal.length > 0) {
        insights.therapeutic.push({
          text: `Kompulsiyonlarınız genellikle ${patterns.temporal[0].timeOfDay} saatlerinde artıyor.`,
          category: 'pattern',
          priority: 'high' as const,
          actionable: true
        });
      }
      
      if (patterns.behavioral.length > 0) {
        insights.progress.push({
          metric: 'trigger_awareness',
          value: patterns.behavioral.length,
          change: 0,
          interpretation: 'Tetikleyici farkındalığınız artıyor'
        });
      }
      
      return insights;
    } catch (error) {
      console.warn('Insights generation failed:', error);
      return null;
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private extractTemporalPatterns(compulsions: any[]): any[] {
    // Group by hour of day
    const hourGroups = {};
    
    compulsions.forEach(c => {
      const hour = new Date(c.timestamp).getHours();
      hourGroups[hour] = (hourGroups[hour] || 0) + 1;
    });
    
    // Find peak hours
    const patterns = [];
    Object.entries(hourGroups).forEach(([hour, count]) => {
      if (count > 2) {
        patterns.push({
          type: 'peak_hour',
          frequency: count as number,
          timeOfDay: `${hour}:00`,
          trend: 'stable'
        });
      }
    });
    
    return patterns;
  }
  
  private extractBehavioralPatterns(compulsions: any[]): any[] {
    // Group by trigger
    const triggerGroups = {};
    
    compulsions.forEach(c => {
      const trigger = c.trigger || 'unknown';
      if (!triggerGroups[trigger]) {
        triggerGroups[trigger] = {
          count: 0,
          totalSeverity: 0
        };
      }
      triggerGroups[trigger].count++;
      triggerGroups[trigger].totalSeverity += c.severity || 5;
    });
    
    // Convert to patterns
    const patterns = [];
    Object.entries(triggerGroups).forEach(([trigger, data]: [string, any]) => {
      patterns.push({
        trigger,
        response: 'compulsion',
        frequency: data.count,
        severity: Math.round(data.totalSeverity / data.count)
      });
    });
    
    return patterns;
  }
  
  private shouldRunCBT(input: UnifiedPipelineInput): boolean {
    return input.type === 'voice' || 
           input.context?.source === 'cbt' ||
           (typeof input.content === 'string' && input.content.length > 50);
  }
  
  private getEnabledModules(): string[] {
    const modules = [];
    if (FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE')) modules.push('voice');
    if (FEATURE_FLAGS.isEnabled('AI_PATTERN_RECOGNITION')) modules.push('patterns');
    if (FEATURE_FLAGS.isEnabled('AI_INSIGHTS_ENGINE_V2')) modules.push('insights');
    if (FEATURE_FLAGS.isEnabled('AI_CBT_ENGINE')) modules.push('cbt');
    return modules;
  }
  
  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  private generateCacheKey(input: UnifiedPipelineInput): string {
    const data = {
      userId: input.userId,
      type: input.type,
      content: typeof input.content === 'string' 
        ? input.content.substring(0, 100) 
        : JSON.stringify(input.content).substring(0, 100),
      source: input.context?.source
    };
    
    return `unified:${input.userId}:${simpleHash(JSON.stringify(data))}`;
  }
  
  private getFromCache(key: string): UnifiedPipelineResult | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    if (cached.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  private setCache(key: string, result: UnifiedPipelineResult): void {
    this.cache.set(key, {
      result,
      expires: Date.now() + this.DEFAULT_TTL
    });
    
    // Also persist to AsyncStorage for offline
    this.persistToStorage(key, result);
  }
  
  private async persistToStorage(key: string, result: UnifiedPipelineResult): Promise<void> {
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          result,
          expires: Date.now() + this.DEFAULT_TTL
        })
      );
    } catch (error) {
      console.warn('Failed to persist to storage:', error);
    }
  }
  
  // ============================================================================
  // INVALIDATION HOOKS
  // ============================================================================
  
  private setupInvalidationHooks(): void {
    // Hook: New compulsion recorded
    this.invalidationHooks.set('compulsion_added', () => {
      this.invalidateUserCache('patterns');
    });
    
    // Hook: ERP session completed
    this.invalidationHooks.set('erp_completed', () => {
      this.invalidateUserCache('insights');
    });
    
    // Hook: Mood entry added
    this.invalidationHooks.set('mood_added', () => {
      this.invalidateUserCache('all');
    });
    
    // Hook: Manual refresh requested
    this.invalidationHooks.set('manual_refresh', () => {
      this.cache.clear();
    });
  }
  
  public triggerInvalidation(hook: string, userId?: string): void {
    const handler = this.invalidationHooks.get(hook);
    if (handler) {
      handler();
    }
    
    // Track invalidation
    trackAIInteraction(AIEventType.CACHE_INVALIDATION, {
      hook,
      userId,
      timestamp: Date.now()
    });
  }
  
  private invalidateUserCache(type: 'patterns' | 'insights' | 'all', userId?: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (userId && !key.includes(userId)) return;
      
      if (type === 'all' || key.includes(type)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
  
  // ============================================================================
  // CACHE CLEANUP
  // ============================================================================
  
  private startCacheCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((value, key) => {
        if (value.expires < now) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        console.log(`🧹 Cleaned ${keysToDelete.length} expired cache entries`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const unifiedPipeline = UnifiedAIPipeline.getInstance();
