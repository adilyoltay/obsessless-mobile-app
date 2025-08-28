/**
 * ProgressiveEnhancer
 * 
 * Progressive UI enhancement için quick result + deep analysis pattern.
 * Kullanıcı anında yanıt alır, arka planda detaylı analiz devam eder.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

import { getPatternMatcher } from './BasePatternMatcher';
import { getConfidenceCalculator } from './UnifiedConfidenceCalculator';

/**
 * Simple React Native compatible EventEmitter alternative
 */
class SimpleEventEmitter {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  
  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.warn('EventEmitter listener error:', error);
        }
      });
    }
  }
  
  on(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
  
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export interface QuickResult {
  confidence: number;
  category: string;
  isHeuristic: true;
  timestamp: number;
  suggestion?: string;
  metadata?: Record<string, any>;
}

export interface DeepResult {
  confidence: number;
  category: string;
  isHeuristic: false;
  timestamp: number;
  deepInsights?: any[];
  patterns?: any[];
  suggestion?: string;
  metadata?: Record<string, any>;
}

export type ProgressiveResult = QuickResult | DeepResult;

export interface ProgressiveOptions {
  quickDelay?: number;        // Delay before quick result (ms)
  deepDelay?: number;         // Delay before deep analysis (ms)
  maxDeepDuration?: number;   // Max time for deep analysis (ms)
  enableDeepAnalysis?: boolean;
}

export class ProgressiveEnhancer extends SimpleEventEmitter {
  private deepAnalysisQueue: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private activeAnalyses: Map<string, Promise<DeepResult>> = new Map();
  private readonly patternMatcher = getPatternMatcher();
  private readonly confidenceCalculator = getConfidenceCalculator();
  
  // Default options
  private readonly defaultOptions: ProgressiveOptions = {
    quickDelay: 0,           // Immediate
    deepDelay: 100,         // 100ms delay
    maxDeepDuration: 5000,  // 5s max
    enableDeepAnalysis: true
  };
  
  /**
   * Process with progressive enhancement
   */
  async process(
    id: string,
    input: any,
    options?: ProgressiveOptions
  ): Promise<{ quick: QuickResult; deep?: Promise<DeepResult> }> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Cancel any existing analysis for this ID
    this.cancelAnalysis(id);
    
    // Get quick result
    const quickResult = await this.getQuickResult(input, opts.quickDelay);
    
    // Emit quick result event
    this.emit('quick-result', { id, result: quickResult });
    
    // Schedule deep analysis if enabled
    let deepPromise: Promise<DeepResult> | undefined;
    
    if (opts.enableDeepAnalysis) {
      deepPromise = this.scheduleDeepAnalysis(id, input, opts);
    }
    
    return { quick: quickResult, deep: deepPromise };
  }
  
  /**
   * Get quick heuristic result
   */
  async getQuickResult(input: any, delay: number = 0): Promise<QuickResult> {
    // Apply delay if specified
    if (delay > 0) {
      await this.delay(delay);
    }
    
    const text = this.extractText(input);
    const category = this.quickCategorize(text);
    const confidence = this.calculateQuickConfidence(text, category);
    const suggestion = this.generateQuickSuggestion(category, confidence);
    
    return {
      confidence,
      category,
      isHeuristic: true,
      timestamp: Date.now(),
      suggestion,
      metadata: {
        textLength: text.length,
        method: 'heuristic'
      }
    };
  }
  
  /**
   * Schedule deep analysis
   */
  private scheduleDeepAnalysis(
    id: string,
    input: any,
    options: ProgressiveOptions
  ): Promise<DeepResult> {
    // Create deep analysis promise
    const deepPromise = new Promise<DeepResult>((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          // Perform deep analysis
          const deepResult = await this.performDeepAnalysis(input, options);
          
          // Emit deep result event
          this.emit('deep-result', { id, result: deepResult });
          
          // Clean up
          this.deepAnalysisQueue.delete(id);
          this.activeAnalyses.delete(id);
          
          resolve(deepResult);
          
        } catch (error) {
          console.error('Deep analysis failed:', error);
          
          // Emit error event
          this.emit('deep-error', { id, error });
          
          // Clean up
          this.deepAnalysisQueue.delete(id);
          this.activeAnalyses.delete(id);
          
          reject(error);
        }
      }, options.deepDelay || 100);
      
      this.deepAnalysisQueue.set(id, timer);
    });
    
    // Add timeout wrapper
    const timeoutPromise = this.withTimeout(
      deepPromise, 
      options.maxDeepDuration || 5000
    );
    
    this.activeAnalyses.set(id, timeoutPromise);
    
    return timeoutPromise;
  }
  
  /**
   * Perform deep analysis
   */
  private async performDeepAnalysis(
    input: any,
    options: ProgressiveOptions
  ): Promise<DeepResult> {
    const text = this.extractText(input);
    
    // Comprehensive pattern matching
    const allPatterns = this.patternMatcher.matchAll(text);
    const bestMatch = this.patternMatcher.getBestMatch(text);
    
    // Calculate detailed confidence
    const confidenceResult = this.confidenceCalculator.calculateWithDetails({
      type: bestMatch ? this.mapPatternTypeToConfidenceType(bestMatch.type) : 'mood',
      textLength: text.length,
      patternMatches: this.countPatternMatches(allPatterns),
      evidenceCount: this.countEvidence(allPatterns)
    });
    
    // Generate insights
    const insights = this.generateInsights(text, allPatterns);
    
    // Determine final category
    const category = bestMatch?.match.pattern.category || 
                    this.determineCategoryFromPatterns(allPatterns) ||
                    'MOOD';
    
    // Generate comprehensive suggestion
    const suggestion = this.generateDeepSuggestion(
      category, 
      confidenceResult.confidence,
      insights
    );
    
    return {
      confidence: confidenceResult.confidence,
      category,
      isHeuristic: false,
      timestamp: Date.now(),
      deepInsights: insights,
      patterns: Array.from(allPatterns.values()).flat(),
      suggestion,
      metadata: {
        textLength: text.length,
        method: 'deep',
        patternTypes: Array.from(allPatterns.keys()),
        confidenceFactors: confidenceResult.factors,
        shouldAbstain: confidenceResult.shouldAbstain
      }
    };
  }
  
  /**
   * Quick categorization heuristic
   */
  private quickCategorize(text: string): string {
    const lower = text.toLowerCase();
    
    // Priority-based categorization
    if (lower.includes('nefes') || lower.includes('boğul') || lower.includes('breathe')) {
      return 'BREATHWORK';
    }
    
    if (lower.includes('kontrol') || lower.includes('takıntı') || lower.includes('obsesyon')) {
      return 'OCD';
    }
    
    if (lower.includes('düşünce') || lower.includes('inanç') || lower.includes('thought')) {
      return 'CBT';
    }
    
    if (lower.includes('egzersiz') || lower.includes('maruz') || lower.includes('exposure')) {
      return 'ERP';
    }
    
    // Default to mood
    return 'MOOD';
  }
  
  /**
   * Calculate quick confidence
   */
  private calculateQuickConfidence(text: string, category: string): number {
    // Base confidence based on text length
    let confidence = 0.5;
    
    if (text.length < 10) {
      confidence = 0.3;
    } else if (text.length < 30) {
      confidence = 0.4;
    } else if (text.length < 100) {
      confidence = 0.6;
    } else {
      confidence = 0.7;
    }
    
    // Adjust based on category certainty
    if (category === 'BREATHWORK' && text.includes('nefes')) {
      confidence += 0.2;
    } else if (category === 'OCD' && text.includes('takıntı')) {
      confidence += 0.15;
    }
    
    return Math.min(0.85, confidence); // Cap heuristic confidence
  }
  
  /**
   * Generate quick suggestion
   */
  private generateQuickSuggestion(category: string, confidence: number): string {
    const suggestions: Record<string, string[]> = {
      'MOOD': [
        'Duygularını kaydettiğin için teşekkürler.',
        'Şu anki hissiyatını anlamaya çalışıyorum.',
        'Biraz daha detay verir misin?'
      ],
      'BREATHWORK': [
        'Nefes egzersizi yapmak ister misin?',
        'Hemen sakinleşmene yardımcı olabilirim.',
        'Birlikte nefes alalım.'
      ],
      'OCD': [
        'Takıntılarınla başa çıkmana yardımcı olabilirim.',
        'Bu düşünceyi birlikte inceleyelim.',
        'Kompulsiyonlarını kaydetmek önemli.'
      ],
      'CBT': [
        'Düşüncelerini yeniden çerçeveleyebiliriz.',
        'Bu düşünceyi objektif olarak inceleyelim.',
        'Bilişsel çarpıtmaları tespit edelim.'
      ],
      'ERP': [
        'Maruz kalma egzersizi yapmaya hazır mısın?',
        'Adım adım ilerleyebiliriz.',
        'Kaygınla yüzleşmene yardımcı olacağım.'
      ]
    };
    
    const categorySuggestions = suggestions[category] || suggestions['MOOD'];
    
    // Select based on confidence
    if (confidence < 0.4) {
      return 'Seni daha iyi anlayabilmem için biraz daha bilgi verir misin?';
    } else if (confidence < 0.6) {
      return categorySuggestions[1];
    } else {
      return categorySuggestions[0];
    }
  }
  
  /**
   * Generate deep suggestion
   */
  private generateDeepSuggestion(
    category: string,
    confidence: number,
    insights: any[]
  ): string {
    // More sophisticated suggestion based on insights
    if (confidence < 0.4) {
      return 'Analiz sonuçlarına göre, daha fazla bilgiye ihtiyacım var. Nasıl yardımcı olabilirim?';
    }
    
    if (insights.length > 0) {
      const primaryInsight = insights[0];
      if (primaryInsight.type === 'pattern') {
        return `${primaryInsight.description} fark ettim. Bu konuda çalışmak ister misin?`;
      }
    }
    
    const suggestions: Record<string, string> = {
      'MOOD': 'Ruh halin hakkında detaylı bir analiz yaptım. Birlikte üzerinde çalışabiliriz.',
      'BREATHWORK': 'Nefes egzersizi senin için faydalı olabilir. Hemen başlayalım mı?',
      'OCD': 'OKB belirtileri tespit ettim. ERP egzersizleri yapmak ister misin?',
      'CBT': 'Bilişsel çarpıtmalar var gibi görünüyor. Bunları düzeltmek için çalışalım.',
      'ERP': 'Maruz kalma egzersizi için uygun bir zaman. Hazır mısın?'
    };
    
    return suggestions[category] || suggestions['MOOD'];
  }
  
  /**
   * Generate insights from patterns
   */
  private generateInsights(text: string, patterns: Map<any, any[]>): any[] {
    const insights: any[] = [];
    
    // Pattern-based insights
    for (const [type, matches] of patterns) {
      if (matches.length > 0) {
        insights.push({
          type: 'pattern',
          patternType: type,
          count: matches.length,
          confidence: matches[0].confidence,
          description: this.describePattern(type, matches)
        });
      }
    }
    
    // Text-based insights
    if (text.length > 100) {
      insights.push({
        type: 'length',
        description: 'Detaylı bir açıklama yaptın',
        value: text.length
      });
    }
    
    // Emotion insights
    const emotionWords = ['mutlu', 'üzgün', 'kızgın', 'endişeli', 'sakin'];
    const foundEmotions = emotionWords.filter(word => text.includes(word));
    if (foundEmotions.length > 0) {
      insights.push({
        type: 'emotion',
        emotions: foundEmotions,
        description: `${foundEmotions.join(', ')} hissediyorsun`
      });
    }
    
    return insights;
  }
  
  /**
   * Helper: Extract text from input
   */
  private extractText(input: any): string {
    if (typeof input === 'string') return input;
    if (typeof input === 'object') {
      return input.content || input.text || input.description || '';
    }
    return '';
  }
  
  /**
   * Helper: Count pattern matches
   */
  private countPatternMatches(patterns: Map<any, any[]>): number {
    let count = 0;
    for (const matches of patterns.values()) {
      count += matches.length;
    }
    return count;
  }
  
  /**
   * Helper: Count evidence
   */
  private countEvidence(patterns: Map<any, any[]>): number {
    return patterns.size;
  }
  
  /**
   * Helper: Map pattern type to confidence type
   */
  private mapPatternTypeToConfidenceType(patternType: any): any {
    const mapping: Record<string, any> = {
      'mood': 'mood',
      'cbt': 'cbt',
      'breathwork': 'breathwork',
      'ocd': 'pattern',
      'erp': 'pattern',
      'emotion': 'mood'
    };
    return mapping[patternType] || 'pattern';
  }
  
  /**
   * Helper: Determine category from patterns
   */
  private determineCategoryFromPatterns(patterns: Map<any, any[]>): string | null {
    if (patterns.has('breathwork') && patterns.get('breathwork')!.length > 0) {
      return 'BREATHWORK';
    }
    if (patterns.has('ocd') && patterns.get('ocd')!.length > 0) {
      return 'OCD';
    }
    if (patterns.has('cbt') && patterns.get('cbt')!.length > 0) {
      return 'CBT';
    }
    if (patterns.has('erp') && patterns.get('erp')!.length > 0) {
      return 'ERP';
    }
    if (patterns.has('mood') && patterns.get('mood')!.length > 0) {
      return 'MOOD';
    }
    return null;
  }
  
  /**
   * Helper: Describe pattern
   */
  private describePattern(type: string, matches: any[]): string {
    const descriptions: Record<string, string> = {
      'mood': 'Ruh hali kalıpları tespit edildi',
      'cbt': 'Bilişsel çarpıtmalar fark edildi',
      'breathwork': 'Nefes egzersizi ihtiyacı var',
      'ocd': 'OKB belirtileri gözlemlendi',
      'erp': 'ERP egzersizi uygun olabilir',
      'emotion': 'Duygusal ifadeler tespit edildi'
    };
    return descriptions[type] || 'Kalıplar tespit edildi';
  }
  
  /**
   * Cancel analysis
   */
  cancelAnalysis(id: string): void {
    // Cancel scheduled deep analysis
    const timer = this.deepAnalysisQueue.get(id);
    if (timer) {
      clearTimeout(timer);
      this.deepAnalysisQueue.delete(id);
    }
    
    // Note: We don't cancel already running analyses
    // They will complete but their results may be ignored
    this.activeAnalyses.delete(id);
    
    // Emit cancellation event
    this.emit('analysis-cancelled', { id });
  }
  
  /**
   * Cancel all analyses
   */
  cancelAll(): void {
    // Cancel all scheduled
    for (const [id, timer] of this.deepAnalysisQueue) {
      clearTimeout(timer);
      this.emit('analysis-cancelled', { id });
    }
    this.deepAnalysisQueue.clear();
    
    // Clear active (they will still complete)
    this.activeAnalyses.clear();
  }
  
  /**
   * Check if analysis is active
   */
  isAnalysisActive(id: string): boolean {
    return this.deepAnalysisQueue.has(id) || this.activeAnalyses.has(id);
  }
  
  /**
   * Get active analysis count
   */
  getActiveCount(): number {
    return this.deepAnalysisQueue.size + this.activeAnalyses.size;
  }
  
  /**
   * Helper: Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Helper: Add timeout to promise
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Deep analysis timeout')), timeoutMs)
      )
    ]);
  }
}

// Singleton instance
let instance: ProgressiveEnhancer | null = null;

export function getProgressiveEnhancer(): ProgressiveEnhancer {
  if (!instance) {
    instance = new ProgressiveEnhancer();
  }
  return instance;
}
