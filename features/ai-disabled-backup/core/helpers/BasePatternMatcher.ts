/**
 * BasePatternMatcher
 * 
 * Tüm pattern matching işlemlerini merkezi olarak yöneten sınıf.
 * Mood, CBT, Breathwork ve diğer pattern'leri tek yerden yönetir.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

export interface Pattern {
  id: string;
  regex?: RegExp;
  keywords?: string[];
  weight: number;
  category: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface PatternMatch {
  pattern: Pattern;
  confidence: number;
  matches: string[];
  positions?: number[];
  context?: string;
}

export type PatternType = 'mood' | 'cbt' | 'breathwork' | 'ocd' | 'erp' | 'emotion' | 'behavioral' | 'trigger';

export class BasePatternMatcher {
  private patterns = new Map<PatternType, Pattern[]>();
  private compiledRegexCache = new Map<string, RegExp>();
  
  constructor() {
    this.initializePatterns();
  }
  
  /**
   * Initialize all pattern sets
   */
  private initializePatterns(): void {
    // Mood patterns - Turkish
    this.patterns.set('mood', [
      // Negative mood patterns
      { 
        id: 'mood_sad_tr', 
        keywords: ['üzgün', 'mutsuz', 'kötü', 'berbat', 'perişan', 'kahroldum'], 
        weight: 0.85, 
        category: 'negative',
        priority: 1
      },
      { 
        id: 'mood_depressed_tr', 
        keywords: ['depresif', 'depresyon', 'umutsuz', 'çaresiz', 'karanlık'], 
        weight: 0.95, 
        category: 'negative',
        priority: 2
      },
      { 
        id: 'mood_anxious_tr', 
        keywords: ['endişeli', 'kaygılı', 'tedirgin', 'huzursuz', 'gergin'], 
        weight: 0.8, 
        category: 'anxious',
        priority: 1
      },
      // Positive mood patterns
      { 
        id: 'mood_happy_tr', 
        keywords: ['mutlu', 'iyi', 'harika', 'süper', 'mükemmel', 'şahane'], 
        weight: 0.85, 
        category: 'positive',
        priority: 1
      },
      { 
        id: 'mood_calm_tr', 
        keywords: ['sakin', 'rahat', 'huzurlu', 'dingin', 'peaceful'], 
        weight: 0.75, 
        category: 'positive',
        priority: 2
      },
      // Neutral patterns
      { 
        id: 'mood_neutral_tr', 
        keywords: ['normal', 'idare', 'fena değil', 'orta', 'ne iyi ne kötü'], 
        weight: 0.6, 
        category: 'neutral',
        priority: 3
      }
    ]);
    
    // CBT Cognitive Distortion patterns - Turkish
    this.patterns.set('cbt', [
      // Catastrophizing
      { 
        id: 'cbt_catastrophic_tr', 
        keywords: ['felaket', 'korkunç', 'mahvoldum', 'sonumuz', 'yıkım', 'kıyamet'],
        regex: /her şey (mahvoldu|bitti|berbat)/gi,
        weight: 0.9, 
        category: 'catastrophizing',
        metadata: { severity: 'high' }
      },
      // All-or-Nothing
      { 
        id: 'cbt_all_or_nothing_tr', 
        keywords: ['hep', 'hiç', 'asla', 'her zaman', 'kesinlikle', 'tamamen'],
        regex: /(hep|hiç|asla|her zaman) (böyle|şöyle|oluyor)/gi,
        weight: 0.85, 
        category: 'all_or_nothing',
        metadata: { severity: 'medium' }
      },
      // Mind Reading
      { 
        id: 'cbt_mindreading_tr', 
        keywords: ['biliyor', 'düşünüyor', 'hissediyor', 'anlamış', 'fark etmiş'],
        regex: /(herkes|onlar|o) .* (biliyor|düşünüyor|hissediyor)/gi,
        weight: 0.75, 
        category: 'mind_reading',
        metadata: { severity: 'medium' }
      },
      // Personalization
      { 
        id: 'cbt_personalization_tr', 
        keywords: ['benim yüzümden', 'benim hatam', 'ben sebep', 'suçluyum'],
        weight: 0.8, 
        category: 'personalization',
        metadata: { severity: 'medium' }
      },
      // Should Statements
      { 
        id: 'cbt_should_tr', 
        keywords: ['yapmalıyım', 'etmeliyim', 'zorundayım', 'mecburum', 'şart'],
        regex: /(yapmalı|etmeli|olmalı|gerekirdi)/gi,
        weight: 0.7, 
        category: 'should_statements',
        metadata: { severity: 'low' }
      }
    ]);
    
    // Breathwork trigger patterns
    this.patterns.set('breathwork', [
      // Breathing issues
      { 
        id: 'breath_difficulty_tr', 
        keywords: ['nefes', 'boğuluyorum', 'hava', 'soluk', 'nefessiz'],
        regex: /nefes (alamıyorum|almakta zorlanıyorum|darlığı)/gi,
        weight: 0.95, 
        category: 'breathing_issue',
        priority: 1
      },
      // Panic symptoms
      { 
        id: 'breath_panic_tr', 
        keywords: ['panik', 'kalp', 'çarpıntı', 'terleme', 'titreme'],
        weight: 0.9, 
        category: 'panic',
        priority: 1
      },
      // Stress indicators
      { 
        id: 'breath_stress_tr', 
        keywords: ['stres', 'gergin', 'kasılmış', 'sıkışmış', 'bunalmış'],
        weight: 0.75, 
        category: 'stress',
        priority: 2
      },
      // Request for breathing
      { 
        id: 'breath_request_tr', 
        keywords: ['nefes egzersizi', 'rahatlamak', 'sakinleşmek'],
        regex: /(nefes|rahatla|sakinleş) .* (istiyorum|lazım|gerek)/gi,
        weight: 0.85, 
        category: 'request',
        priority: 1
      }
    ]);
    
    // OCD patterns
    this.patterns.set('ocd', [
      // Checking compulsions
      { 
        id: 'ocd_checking_tr', 
        keywords: ['kontrol', 'emin', 'tekrar', 'baktım', 'kapattım mı'],
        regex: /(kontrol|emin|tekrar) .* (ettim|etmeliyim|etsem)/gi,
        weight: 0.85, 
        category: 'checking'
      },
      // Contamination
      { 
        id: 'ocd_contamination_tr', 
        keywords: ['kirli', 'mikrop', 'bulaşır', 'temiz', 'hijyen', 'pislik'],
        weight: 0.8, 
        category: 'contamination'
      },
      // Intrusive thoughts
      { 
        id: 'ocd_intrusive_tr', 
        keywords: ['aklıma takıldı', 'kafama takıldı', 'düşünmeden edemiyorum', 'obsesyon'],
        weight: 0.9, 
        category: 'intrusive'
      },
      // Symmetry/Order
      { 
        id: 'ocd_symmetry_tr', 
        keywords: ['düzgün', 'simetrik', 'düzenli', 'yerinde', 'hizalı'],
        regex: /(düzgün|düzenli|simetrik) (olmalı|değil|olması)/gi,
        weight: 0.7, 
        category: 'symmetry'
      }
    ]);
    
    // Emotion patterns
    this.patterns.set('emotion', [
      // Basic emotions
      { id: 'emotion_joy', keywords: ['sevinç', 'neşe', 'keyif'], weight: 0.8, category: 'joy' },
      { id: 'emotion_fear', keywords: ['korku', 'korkuyorum', 'ürktüm'], weight: 0.85, category: 'fear' },
      { id: 'emotion_anger', keywords: ['öfke', 'kızgın', 'sinirli'], weight: 0.85, category: 'anger' },
      { id: 'emotion_sadness', keywords: ['üzüntü', 'hüzün', 'keder'], weight: 0.8, category: 'sadness' },
      { id: 'emotion_disgust', keywords: ['iğrenç', 'tiksiniyorum', 'mide bulandırıcı'], weight: 0.75, category: 'disgust' },
      { id: 'emotion_surprise', keywords: ['şaşkın', 'şaşırdım', 'beklemiyordum'], weight: 0.7, category: 'surprise' }
    ]);
    
    // ERP patterns (simplified, as ERP module removed but may have legacy references)
    this.patterns.set('erp', [
      { id: 'erp_exposure', keywords: ['maruz', 'yüzleş', 'karşılaş'], weight: 0.7, category: 'exposure' },
      { id: 'erp_prevention', keywords: ['engelle', 'yapma', 'durdur'], weight: 0.7, category: 'prevention' }
    ]);
    
    // Behavioral patterns (migrated from UnifiedAIPipeline.extractTextPatterns)
    this.patterns.set('behavioral', [
      { id: 'behavioral_repeat', keywords: ['tekrar'], weight: 0.6, category: 'repetition' },
      { id: 'behavioral_control', keywords: ['kontrol'], weight: 0.6, category: 'checking' },
      { id: 'behavioral_cleaning', keywords: ['temizlik'], weight: 0.6, category: 'cleaning' },
      { id: 'behavioral_counting', keywords: ['sayma'], weight: 0.6, category: 'counting' },
      { id: 'behavioral_ordering', keywords: ['sıralama'], weight: 0.6, category: 'ordering' }
    ]);
    
    // Trigger patterns (migrated from UnifiedAIPipeline.extractTextPatterns)  
    this.patterns.set('trigger', [
      { id: 'trigger_stress', keywords: ['stres'], weight: 0.5, category: 'stress' },
      { id: 'trigger_anxiety', keywords: ['endişe'], weight: 0.5, category: 'anxiety' },
      { id: 'trigger_fear', keywords: ['korku'], weight: 0.5, category: 'fear' },
      { id: 'trigger_dirty', keywords: ['kirli'], weight: 0.5, category: 'contamination' },
      { id: 'trigger_security', keywords: ['güvenlik'], weight: 0.5, category: 'security' }
    ]);
  }
  
  /**
   * Match text against patterns
   */
  match(text: string, type: PatternType): PatternMatch[] {
    const normalizedText = this.normalize(text);
    const typePatterns = this.patterns.get(type) || [];
    const matches: PatternMatch[] = [];
    
    for (const pattern of typePatterns) {
      const match = this.matchPattern(normalizedText, pattern);
      if (match && match.confidence > 0.3) {
        matches.push(match);
      }
    }
    
    // Sort by confidence and priority
    return matches.sort((a, b) => {
      // First sort by confidence
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      
      // Then by priority if available
      const priorityA = a.pattern.priority || 999;
      const priorityB = b.pattern.priority || 999;
      return priorityA - priorityB;
    });
  }
  
  /**
   * Match against all pattern types
   */
  matchAll(text: string): Map<PatternType, PatternMatch[]> {
    const results = new Map<PatternType, PatternMatch[]>();
    
    for (const type of this.patterns.keys()) {
      const matches = this.match(text, type);
      if (matches.length > 0) {
        results.set(type, matches);
      }
    }
    
    return results;
  }
  
  /**
   * Get best match across all types
   */
  getBestMatch(text: string): { type: PatternType; match: PatternMatch } | null {
    const allMatches = this.matchAll(text);
    let bestMatch: { type: PatternType; match: PatternMatch } | null = null;
    let highestConfidence = 0;
    
    for (const [type, matches] of allMatches) {
      if (matches.length > 0 && matches[0].confidence > highestConfidence) {
        highestConfidence = matches[0].confidence;
        bestMatch = { type, match: matches[0] };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Normalize text for matching
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Match single pattern against text
   */
  private matchPattern(text: string, pattern: Pattern): PatternMatch | null {
    const foundMatches: string[] = [];
    const positions: number[] = [];
    let matchScore = 0;
    let matchCount = 0;
    
    // Keyword matching
    if (pattern.keywords) {
      for (const keyword of pattern.keywords) {
        const keywordLower = keyword.toLowerCase();
        let index = text.indexOf(keywordLower);
        while (index !== -1) {
          foundMatches.push(keyword);
          positions.push(index);
          matchCount++;
          index = text.indexOf(keywordLower, index + 1);
        }
      }
      
      if (matchCount > 0) {
        // Score based on matches vs total keywords
        matchScore = (matchCount / pattern.keywords.length) * pattern.weight;
        
        // Bonus for multiple matches
        if (matchCount > 1) {
          matchScore *= 1 + (matchCount - 1) * 0.1;
        }
      }
    }
    
    // Regex matching
    if (pattern.regex) {
      const regex = this.getCompiledRegex(pattern);
      const regexMatches = text.match(regex);
      if (regexMatches) {
        foundMatches.push(...regexMatches);
        matchScore = Math.max(matchScore, pattern.weight);
        
        // Find positions
        let match;
        const globalRegex = new RegExp(regex.source, regex.flags + (regex.global ? '' : 'g'));
        while ((match = globalRegex.exec(text)) !== null) {
          positions.push(match.index);
        }
      }
    }
    
    if (foundMatches.length === 0) return null;
    
    // Calculate confidence
    const confidence = Math.min(0.95, matchScore);
    
    // Extract context around matches
    const context = this.extractContext(text, positions[0], 30);
    
    return {
      pattern,
      confidence,
      matches: [...new Set(foundMatches)], // Unique matches
      positions,
      context
    };
  }
  
  /**
   * Get compiled regex with caching
   */
  private getCompiledRegex(pattern: Pattern): RegExp {
    if (!pattern.regex) return /(?:)/;
    
    const key = pattern.id;
    if (!this.compiledRegexCache.has(key)) {
      this.compiledRegexCache.set(key, pattern.regex);
    }
    
    return this.compiledRegexCache.get(key)!;
  }
  
  /**
   * Extract context around match position
   */
  private extractContext(text: string, position: number, contextLength: number = 30): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(text.length, position + contextLength);
    
    let context = text.substring(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }
  
  /**
   * Add custom pattern dynamically
   */
  addPattern(type: PatternType, pattern: Pattern): void {
    const patterns = this.patterns.get(type) || [];
    patterns.push(pattern);
    this.patterns.set(type, patterns);
  }
  
  /**
   * Remove pattern by ID
   */
  removePattern(type: PatternType, patternId: string): boolean {
    const patterns = this.patterns.get(type);
    if (!patterns) return false;
    
    const index = patterns.findIndex(p => p.id === patternId);
    if (index !== -1) {
      patterns.splice(index, 1);
      return true;
    }
    
    return false;
  }
  
  /**
   * Extract text patterns in UnifiedAIPipeline format (migrated)
   * This method replaces UnifiedAIPipeline.extractTextPatterns
   */
  extractTextPatterns(content: string): { behavioral: any[]; triggers: any[] } {
    const result = {
      behavioral: [],
      triggers: []
    };
    
    // Match behavioral patterns
    const behavioralMatches = this.match(content, 'behavioral');
    for (const match of behavioralMatches) {
      result.behavioral.push({
        type: 'text_behavioral',
        keyword: match.matches[0],
        context: content,
        confidence: match.confidence
      });
    }
    
    // Match trigger patterns
    const triggerMatches = this.match(content, 'trigger');
    for (const match of triggerMatches) {
      result.triggers.push({
        type: 'text_trigger',
        trigger: match.matches[0],
        context: content,
        confidence: match.confidence
      });
    }
    
    return result;
  }
  
  /**
   * Get statistics about patterns
   */
  getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalPatterns: 0,
      byType: {}
    };
    
    for (const [type, patterns] of this.patterns) {
      stats.totalPatterns += patterns.length;
      stats.byType[type] = {
        count: patterns.length,
        categories: [...new Set(patterns.map(p => p.category))]
      };
    }
    
    return stats;
  }
}

// Singleton instance
let instance: BasePatternMatcher | null = null;

export function getPatternMatcher(): BasePatternMatcher {
  if (!instance) {
    instance = new BasePatternMatcher();
  }
  return instance;
}
