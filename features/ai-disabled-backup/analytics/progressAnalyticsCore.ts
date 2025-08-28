/**
 * 📊 Progress Analytics Core - Types and Interfaces
 * Yalnızca tipler içeren hafifletilmiş modül. Runtime kullanım yok.
 */

export interface ProgressMetrics {
  compulsionFrequency: number[];
  resistanceRate: number[];
  moodScores: number[];
  exerciseCompletion: number[];
  sleepQuality: number[];
  socialInteraction: number[];
  medicationAdherence: boolean[];
  timestamps: Date[];
}

export interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'worsening';
  rate: number; // Change rate per week
  confidence: number; // 0-1
  projection: {
    oneWeek: number;
    oneMonth: number;
    threeMonths: number;
  };
}

export interface Pattern {
  id: string;
  type: 'temporal' | 'environmental' | 'behavioral' | 'emotional';
  description: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  triggers: string[];
  recommendations: string[];
  confidence: number;
}

export interface PredictiveInsight {
  type: 'risk' | 'opportunity' | 'milestone';
  timeframe: 'immediate' | 'short_term' | 'long_term';
  probability: number;
  description: string;
  preventiveActions?: string[];
  supportiveActions?: string[];
}

export interface TherapeuticOutcome {
  interventionId: string;
  interventionType: string;
  successRate: number;
  averageImprovement: number;
  userSatisfaction: number;
  continuationRecommended: boolean;
  alternativeSuggestions?: string[];
}

export interface PersonalizedGoal {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  metric: string;
  target: number;
  current: number;
  progress: number; // 0-100%
  difficulty: 'easy' | 'moderate' | 'challenging';
  adjustmentNeeded: boolean;
  adjustmentReason?: string;
  motivationalMessage: string;
}

export interface ProgressAnalyticsResult {
  metrics: ProgressMetrics;
  trends: Map<string, TrendAnalysis>;
  patterns: Pattern[];
  predictions: PredictiveInsight[];
  outcomes: TherapeuticOutcome[];
  goals: PersonalizedGoal[];
  overallProgress: number; // 0-100
  therapyPhase: 'initial' | 'active' | 'maintenance' | 'recovery';
  nextMilestone: {
    description: string;
    estimatedDate: Date;
    requirements: string[];
  };
}

// Not: Bu dosya yalnızca türleri ihrac eder. Fonksiyon/servis implementasyonu sprint planında kaldırıldı.

export interface ProgressTrackingContext {
  userId: string;
  timeRange: 'week' | 'month' | 'quarter' | 'year' | 'all';
  focusAreas?: string[];
  includeProjections: boolean;
}
