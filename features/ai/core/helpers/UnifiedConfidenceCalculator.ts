/**
 * UnifiedConfidenceCalculator
 * 
 * Tüm AI modülleri için merkezi confidence hesaplama sınıfı.
 * 12+ farklı confidence metodunu tek bir yerden yönetir.
 * 
 * @since 2025-01 - Monolitik Optimizasyon
 */

export interface ConfidenceParams {
  type: 'voice' | 'pattern' | 'cbt' | 'insights' | 'global' | 'breathwork' | 'mood';
  evidenceCount?: number;
  patternMatches?: number;
  textLength?: number;
  dataPoints?: number;
  sampleSize?: number;
  quality?: number;
  correlations?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface ConfidenceResult {
  confidence: number;
  uncertainty: number;
  factors: {
    base: number;
    evidence: number;
    quality: number;
    adjustment: number;
  };
  shouldAbstain: boolean;
}

export class UnifiedConfidenceCalculator {
  private readonly MIN_CONFIDENCE = 0.0;
  private readonly MAX_CONFIDENCE = 0.95;
  private readonly ABSTAIN_THRESHOLD = 0.4;
  
  // Type-specific weight configurations
  private readonly TYPE_WEIGHTS = {
    voice: { 
      base: 0.6, 
      evidence: 0.3, 
      length: 0.1,
      minEvidence: 2,
      abstainBelow: 0.45
    },
    pattern: { 
      base: 0.5, 
      evidence: 0.4, 
      quality: 0.1,
      minEvidence: 3,
      abstainBelow: 0.4
    },
    cbt: { 
      base: 0.4, 
      evidence: 0.5, 
      length: 0.1,
      minEvidence: 2,
      abstainBelow: 0.35
    },
    insights: { 
      base: 0.5, 
      evidence: 0.0,  // Not used but needed for type consistency
      dataPoints: 0.3, 
      quality: 0.2,
      minEvidence: 5,
      abstainBelow: 0.4
    },
    global: { 
      base: 0.3, 
      evidence: 0.0,  // Not used but needed for type consistency
      sampleSize: 0.4, 
      quality: 0.3,
      minEvidence: 10,
      abstainBelow: 0.3
    },
    breathwork: {
      base: 0.7,
      evidence: 0.2,
      length: 0.1,
      minEvidence: 1,
      abstainBelow: 0.5
    },
    mood: {
      base: 0.5,
      evidence: 0.3,
      quality: 0.2,
      minEvidence: 2,
      abstainBelow: 0.4
    }
  };
  
  /**
   * Ana confidence hesaplama metodu
   * Tüm eski confidence metodlarının yerine geçer
   */
  calculate(params: ConfidenceParams): number {
    const result = this.calculateWithDetails(params);
    return result.confidence;
  }
  
  /**
   * Detaylı confidence hesaplama (debugging için)
   */
  calculateWithDetails(params: ConfidenceParams): ConfidenceResult {
    const weights = this.TYPE_WEIGHTS[params.type];
    const factors = {
      base: 0,
      evidence: 0,
      quality: 0,
      adjustment: 0
    };
    
    // Base confidence
    factors.base = this.getBaseScore(params);
    let score = weights.base * factors.base;
    
    // Evidence-based adjustment
    if (params.evidenceCount !== undefined && weights.evidence) {
      factors.evidence = this.getEvidenceScore(params.evidenceCount, weights.minEvidence);
      score += weights.evidence * factors.evidence;
    }
    
    if (params.patternMatches !== undefined && weights.evidence) {
      factors.evidence = Math.max(factors.evidence, this.getPatternScore(params.patternMatches));
      score += weights.evidence * factors.evidence * 0.5; // Pattern bonus
    }
    
    // Length adjustment for text-based
    if (params.textLength !== undefined && (weights as any).length) {
      const lengthScore = this.getLengthScore(params.textLength);
      factors.adjustment += (weights as any).length * lengthScore;
      score += (weights as any).length * lengthScore;
    }
    
    // Quality adjustment
    if (params.quality !== undefined && (weights as any).quality) {
      factors.quality = params.quality;
      score += (weights as any).quality * params.quality;
    }
    
    // Data points adjustment (for analytics)
    if (params.dataPoints !== undefined && (weights as any).dataPoints) {
      const dataScore = this.getDataPointsScore(params.dataPoints);
      factors.quality = Math.max(factors.quality, dataScore);
      score += (weights as any).dataPoints * dataScore;
    }
    
    // Sample size adjustment (for global analytics)
    if (params.sampleSize !== undefined && (weights as any).sampleSize) {
      const sampleScore = this.getSampleSizeScore(params.sampleSize);
      factors.quality = Math.max(factors.quality, sampleScore);
      score += (weights as any).sampleSize * sampleScore;
    }
    
    // Correlation bonus (for mood analytics)
    if (params.correlations) {
      const correlationBonus = this.getCorrelationBonus(params.correlations);
      factors.adjustment += correlationBonus * 0.1;
      score += correlationBonus * 0.1;
    }
    
    // Apply uncertainty
    const uncertainty = this.calculateUncertainty(params, weights);
    const finalScore = score * (1 - uncertainty);
    
    // Determine if should abstain
    const shouldAbstain = this.shouldAbstain(
      finalScore, 
      params.evidenceCount || 0, 
      weights
    );
    
    // Clamp to valid range
    const confidence = Math.max(
      this.MIN_CONFIDENCE, 
      Math.min(this.MAX_CONFIDENCE, finalScore)
    );
    
    return {
      confidence,
      uncertainty,
      factors,
      shouldAbstain
    };
  }
  
  /**
   * Base score hesaplama
   */
  private getBaseScore(params: ConfidenceParams): number {
    // Type-specific base scores
    const baseScores = {
      voice: 0.5,
      pattern: 0.45,
      cbt: 0.4,
      insights: 0.5,
      global: 0.35,
      breathwork: 0.6,
      mood: 0.5
    };
    
    return baseScores[params.type] || 0.5;
  }
  
  /**
   * Evidence-based scoring
   */
  private getEvidenceScore(count: number, minEvidence: number): number {
    if (count < minEvidence) {
      return count / minEvidence * 0.5; // Penalize low evidence
    }
    
    // Logarithmic growth after minimum
    return Math.min(1, 0.5 + Math.log10(count / minEvidence + 1) * 0.5);
  }
  
  /**
   * Pattern match scoring
   */
  private getPatternScore(matches: number): number {
    if (matches === 0) return 0;
    if (matches === 1) return 0.4;
    if (matches === 2) return 0.6;
    if (matches === 3) return 0.75;
    return Math.min(1, 0.75 + matches * 0.05);
  }
  
  /**
   * Text length scoring
   */
  private getLengthScore(length: number): number {
    if (length < 10) return 0.3;
    if (length < 30) return 0.5;
    if (length < 50) return 0.6;
    if (length < 100) return 0.7;
    if (length < 200) return 0.8;
    if (length < 500) return 0.9;
    return 1.0;
  }
  
  /**
   * Data points scoring (for analytics)
   */
  private getDataPointsScore(points: number): number {
    if (points < 3) return 0.2;
    if (points < 7) return 0.4;
    if (points < 14) return 0.6;
    if (points < 30) return 0.8;
    return Math.min(1, 0.8 + points / 200);
  }
  
  /**
   * Sample size scoring (for statistics)
   */
  private getSampleSizeScore(size: number): number {
    if (size < 5) return 0.2;
    if (size < 10) return 0.4;
    if (size < 20) return 0.6;
    if (size < 50) return 0.8;
    return Math.min(1, 0.8 + size / 500);
  }
  
  /**
   * Correlation bonus calculation
   */
  private getCorrelationBonus(correlations: Record<string, number>): number {
    const values = Object.values(correlations);
    if (values.length === 0) return 0;
    
    // Strong correlations (>0.7 or <-0.7) give bonus
    const strongCorrelations = values.filter(r => Math.abs(r) > 0.7).length;
    const moderateCorrelations = values.filter(r => Math.abs(r) > 0.5).length;
    
    return Math.min(1, strongCorrelations * 0.3 + moderateCorrelations * 0.1);
  }
  
  /**
   * Dynamic uncertainty calculation
   */
  private calculateUncertainty(
    params: ConfidenceParams, 
    weights: any
  ): number {
    let uncertainty = 0.1; // Base uncertainty
    
    // Low evidence uncertainty
    if (params.evidenceCount !== undefined && params.evidenceCount < weights.minEvidence) {
      uncertainty += 0.2 * (1 - params.evidenceCount / weights.minEvidence);
    }
    
    // Short text uncertainty
    if (params.textLength !== undefined && params.textLength < 20) {
      uncertainty += 0.15 * (1 - params.textLength / 20);
    }
    
    // Low quality uncertainty
    if (params.quality !== undefined && params.quality < 0.5) {
      uncertainty += 0.1 * (1 - params.quality / 0.5);
    }
    
    // Small sample uncertainty
    if (params.sampleSize !== undefined && params.sampleSize < 10) {
      uncertainty += 0.15 * (1 - params.sampleSize / 10);
    }
    
    return Math.min(0.5, uncertainty);
  }
  
  /**
   * Determine if should abstain from making prediction
   */
  private shouldAbstain(
    confidence: number, 
    evidenceCount: number, 
    weights: any
  ): boolean {
    // Check confidence threshold
    if (confidence < weights.abstainBelow) {
      return true;
    }
    
    // Check minimum evidence
    if (evidenceCount < weights.minEvidence * 0.5) {
      return true;
    }
    
    // Check global abstain threshold
    if (confidence < this.ABSTAIN_THRESHOLD && evidenceCount < 2) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Backwards compatibility methods
   * These map old method names to the new unified calculator
   */
  
  calculateVoiceConfidence(text: string, patterns: number): number {
    return this.calculate({
      type: 'voice',
      textLength: text.length,
      patternMatches: patterns,
      evidenceCount: patterns
    });
  }
  
  calculatePatternConfidence(dataPoints: number): number {
    return this.calculate({
      type: 'pattern',
      dataPoints,
      evidenceCount: dataPoints
    });
  }
  
  calculateCBTConfidence(distortions: any[], textLength: number): number {
    return this.calculate({
      type: 'cbt',
      evidenceCount: distortions.length,
      textLength,
      patternMatches: distortions.length
    });
  }
  
  calculateCBTProgressConfidence(records: any[]): number {
    return this.calculate({
      type: 'cbt',
      sampleSize: records.length,
      dataPoints: records.length,
      quality: records.length > 5 ? 0.8 : 0.5
    });
  }
  
  calculateGlobalConfidence(
    sampleSize: number, 
    dataQuality: number, 
    profileConfidence: number,
    correlations?: Record<string, number>
  ): number {
    return this.calculate({
      type: 'global',
      sampleSize,
      quality: dataQuality,
      dataPoints: sampleSize,
      correlations,
      metadata: { profileConfidence }
    });
  }
  
  calculateAnalyticsGlobalConfidence(
    moods: any[], 
    dataQuality: number, 
    profile: any
  ): number {
    return this.calculate({
      type: 'global',
      sampleSize: moods.length,
      quality: dataQuality,
      dataPoints: moods.length,
      metadata: { profile }
    });
  }
}

// Singleton instance
let instance: UnifiedConfidenceCalculator | null = null;

export function getConfidenceCalculator(): UnifiedConfidenceCalculator {
  if (!instance) {
    instance = new UnifiedConfidenceCalculator();
  }
  return instance;
}
