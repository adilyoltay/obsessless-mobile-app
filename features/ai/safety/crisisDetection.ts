/**
 * 🚨 Crisis Detection System - Real-time Safety Monitoring
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  CrisisRiskLevel, 
  CrisisDetectionResult, 
  CrisisAction, 
  AIMessage,
  ConversationContext
} from '@/features/ai/types';
import { AIEventType, trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';

interface CrisisDetectionConfig {
  enabled: boolean;
  sensitivityLevel: number;
  humanReviewThreshold: number;
  emergencyThreshold: number;
  languageSupport: string[];
}

const DEFAULT_CONFIG: CrisisDetectionConfig = {
  enabled: false, // Default off; runtime'da feature flag ile açık değilse çalışmaz
  sensitivityLevel: 0.8,
  humanReviewThreshold: 0.7,
  emergencyThreshold: 0.9,
  languageSupport: ['tr', 'en']
};

// Crisis keywords for Turkish
const TURKISH_CRISIS_KEYWORDS = {
  suicide: {
    direct: ['intihar', 'ölmek istiyorum', 'kendimi öldür', 'yaşamak istemiyorum'],
    indirect: ['herşey bitsin', 'yoruldum', 'çok ağır', 'takatim kalmadı'],
    weight: 1.0
  },
  selfHarm: {
    direct: ['kendime zarar', 'kendimi kes', 'acı çekmek'],
    indirect: ['hak etmiyorum', 'değersizim', 'kimse umursamaz'],
    weight: 0.8
  },
  hopelessness: {
    direct: ['çaresizim', 'çıkış yolu yok', 'hiçbir umut yok'],
    indirect: ['hiçbir şey işe yaramaz', 'boşuna uğraşıyorum'],
    weight: 0.6
  },
  panic: {
    direct: ['panik atak', 'nefes alamıyorum', 'kalp krizi geçiriyorum'],
    indirect: ['çok korkuyorum', 'terlemeler', 'titriyorum'],
    weight: 0.7
  }
};

// Crisis keywords for English  
const ENGLISH_CRISIS_KEYWORDS = {
  suicide: {
    direct: ['kill myself', 'want to die', 'end my life', 'suicide'],
    indirect: ['everything should end', 'I\'m tired', 'too heavy'],
    weight: 1.0
  },
  selfHarm: {
    direct: ['hurt myself', 'cut myself', 'punish myself'],
    indirect: ['don\'t deserve', 'I\'m bad', 'worthless'],
    weight: 0.8
  },
  hopelessness: {
    direct: ['no hope', 'nothing will change', 'helpless'],
    indirect: ['nothing works', 'trying in vain', 'doesn\'t matter'],
    weight: 0.6
  },
  panic: {
    direct: ['panic attack', 'can\'t breathe', 'heart attack'],
    indirect: ['very scared', 'sweating', 'shaking'],
    weight: 0.7
  }
};

export class CrisisDetectionService {
  private config: CrisisDetectionConfig;
  private isInitialized: boolean = false;
  
  constructor(config: CrisisDetectionConfig = DEFAULT_CONFIG) {
    this.config = config;
    // Koşullu init: Flag kapalıysa init etme, gereksiz log/kaynak tüketimini engelle
    if (FEATURE_FLAGS.isEnabled('AI_CRISIS_DETECTION')) {
      this.initialize();
    } else {
      this.config.enabled = false;
      this.isInitialized = false;
    }
  }

  private async initialize(): Promise<void> {
    if (!FEATURE_FLAGS.isEnabled('AI_CRISIS_DETECTION')) {
      this.config.enabled = false;
      return;
    }
    
    this.isInitialized = true;
    console.log('🚨 Crisis Detection Service initialized');
  }

  async detectCrisis(
    message: AIMessage,
    context: ConversationContext
  ): Promise<CrisisDetectionResult> {
    if (!this.isInitialized || !this.config.enabled) {
      return this.createSafeResult();
    }

    try {
      const keywordResult = await this.keywordBasedDetection(message);
      const contextResult = await this.contextualAnalysis(message, context);
      
      const combinedResult = this.combineResults([keywordResult, contextResult], message, context);
      
      await this.handleRiskLevel(combinedResult, context);
      
      return combinedResult;
    } catch (error) {
      console.error('Crisis detection error:', error);
      return this.createErrorResult(message);
    }
  }

  private async keywordBasedDetection(message: AIMessage): Promise<Partial<CrisisDetectionResult>> {
    const content = message.content.toLowerCase();
    let maxRiskScore = 0;
    let detectedTriggers: string[] = [];

    for (const [category, categoryData] of Object.entries(TURKISH_CRISIS_KEYWORDS)) {
      for (const keyword of categoryData.direct) {
        if (content.includes(keyword.toLowerCase())) {
          const score = categoryData.weight * 1.0;
          if (score > maxRiskScore) maxRiskScore = score;
          detectedTriggers.push(`direct:${category}:${keyword}`);
        }
      }
      
      for (const keyword of categoryData.indirect) {
        if (content.includes(keyword.toLowerCase())) {
          const score = categoryData.weight * 0.6;
          if (score > maxRiskScore) maxRiskScore = score;
          detectedTriggers.push(`indirect:${category}:${keyword}`);
        }
      }
    }

    return {
      riskLevel: this.scoreToRiskLevel(maxRiskScore),
      confidence: Math.min(maxRiskScore, 0.9),
      triggers: detectedTriggers.slice(0, 5)
    };
  }

  private async contextualAnalysis(
    message: AIMessage,
    context: ConversationContext
  ): Promise<Partial<CrisisDetectionResult>> {
    let riskScore = 0;
    let triggers: string[] = [];

    if (context.currentState === 'crisis') {
      riskScore += 0.6;
      triggers.push('already_in_crisis_state');
    } else if (context.currentState === 'elevated') {
      riskScore += 0.3;
      triggers.push('elevated_state_risk');
    }

    const hour = new Date().getHours();
    if (hour >= 23 || hour <= 5) {
      riskScore += 0.2;
      triggers.push('late_night_communication');
    }

    return {
      riskLevel: this.scoreToRiskLevel(riskScore),
      confidence: Math.min(riskScore * 0.9, 0.8),
      triggers
    };
  }

  private combineResults(
    results: Partial<CrisisDetectionResult>[],
    message: AIMessage,
    context: ConversationContext
  ): CrisisDetectionResult {
    let maxRiskLevel = CrisisRiskLevel.NONE;
    let totalConfidence = 0;
    let allTriggers: string[] = [];

    for (const result of results) {
      if (result.riskLevel && this.riskLevelToScore(result.riskLevel) > this.riskLevelToScore(maxRiskLevel)) {
        maxRiskLevel = result.riskLevel;
      }
      if (result.confidence) totalConfidence += result.confidence;
      if (result.triggers) allTriggers.push(...result.triggers);
    }

    const avgConfidence = totalConfidence / results.length;
    const recommendedAction = this.determineRecommendedAction(maxRiskLevel, avgConfidence);

    return {
      riskLevel: maxRiskLevel,
      confidence: Math.min(avgConfidence, 0.95),
      triggers: [...new Set(allTriggers)],
      recommendedAction,
      humanReviewRequired: avgConfidence >= this.config.humanReviewThreshold || 
                          maxRiskLevel === CrisisRiskLevel.HIGH ||
                          maxRiskLevel === CrisisRiskLevel.CRITICAL,
      timestamp: new Date()
    };
  }

  private determineRecommendedAction(riskLevel: CrisisRiskLevel, confidence: number): CrisisAction {
    if (riskLevel === CrisisRiskLevel.CRITICAL) return CrisisAction.IMMEDIATE_INTERVENTION;
    if (riskLevel === CrisisRiskLevel.HIGH) return CrisisAction.ESCALATE_TO_HUMAN;
    if (riskLevel === CrisisRiskLevel.MEDIUM) return CrisisAction.PROVIDE_RESOURCES;
    return CrisisAction.CONTINUE_NORMAL;
  }

  private async handleRiskLevel(result: CrisisDetectionResult, context: ConversationContext): Promise<void> {
    await trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, {
      riskLevel: result.riskLevel,
      triggerCount: result.triggers.length
    }, context.userId);

    switch (result.riskLevel) {
      case CrisisRiskLevel.CRITICAL:
        console.warn('🚨 CRITICAL CRISIS DETECTED');
        await trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, {
          severity: 'CRITICAL',
          userId: context.userId
        });
        break;
      case CrisisRiskLevel.HIGH:
        console.warn('⚠️ HIGH RISK DETECTED');
        break;
    }
  }

  private scoreToRiskLevel(score: number): CrisisRiskLevel {
    if (score >= 0.9) return CrisisRiskLevel.CRITICAL;
    if (score >= 0.7) return CrisisRiskLevel.HIGH;
    if (score >= 0.4) return CrisisRiskLevel.MEDIUM;
    if (score >= 0.2) return CrisisRiskLevel.LOW;
    return CrisisRiskLevel.NONE;
  }

  private riskLevelToScore(level: CrisisRiskLevel): number {
    switch (level) {
      case CrisisRiskLevel.CRITICAL: return 1.0;
      case CrisisRiskLevel.HIGH: return 0.8;
      case CrisisRiskLevel.MEDIUM: return 0.6;
      case CrisisRiskLevel.LOW: return 0.3;
      default: return 0.0;
    }
  }

  private createSafeResult(): CrisisDetectionResult {
    return {
      riskLevel: CrisisRiskLevel.NONE,
      confidence: 0,
      triggers: [],
      recommendedAction: CrisisAction.CONTINUE_NORMAL,
      humanReviewRequired: false,
      timestamp: new Date()
    };
  }

  private createErrorResult(message: AIMessage): CrisisDetectionResult {
    return {
      riskLevel: CrisisRiskLevel.MEDIUM,
      confidence: 0.5,
      triggers: ['detection_error'],
      recommendedAction: CrisisAction.ESCALATE_TO_HUMAN,
      humanReviewRequired: true,
      timestamp: new Date()
    };
  }

  get isEnabled(): boolean {
    return this.config.enabled && this.isInitialized;
  }
}

// Prefer explicit creation to avoid side effects at module import time
export const getCrisisDetectionService = () => null; // fully removed

export { CrisisDetectionConfig, DEFAULT_CONFIG as DEFAULT_CRISIS_CONFIG };