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
  // Deprecated implementation removed; left as minimal no-op to avoid side-effects
  private config: CrisisDetectionConfig = DEFAULT_CONFIG;
  private isInitialized: boolean = false;
  constructor(_: CrisisDetectionConfig = DEFAULT_CONFIG) {}
  private async initialize(): Promise<void> { return; }

  async detectCrisis(_: AIMessage, __: ConversationContext): Promise<CrisisDetectionResult> { return this.createSafeResult(); }

  private async keywordBasedDetection(_: AIMessage): Promise<Partial<CrisisDetectionResult>> { return {}; }

  private async contextualAnalysis(_: AIMessage, __: ConversationContext): Promise<Partial<CrisisDetectionResult>> { return {}; }

  private combineResults(_: Partial<CrisisDetectionResult>[], __: AIMessage, ___: ConversationContext): CrisisDetectionResult { return this.createSafeResult(); }

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