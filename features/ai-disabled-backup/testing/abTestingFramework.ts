/**
 * 🧪 A/B Testing Framework for Adaptive Suggestions
 * 
 * Test different approaches to adaptive interventions:
 * - Suggestion frequencies (conservative vs aggressive)
 * - Timing strategies (circadian-based vs fixed)
 * - Content approaches (direct vs gentle)
 * - Cooldown periods (2h vs 4h vs 6h)
 * 
 * Privacy-first with opt-in participation and clear user control.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { adaptiveSuggestionAnalytics } from '../analytics/adaptiveSuggestionAnalytics';

// Types
interface ABTest {
  testId: string;
  name: string;
  description: string;
  
  // Test configuration
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'active' | 'paused' | 'completed';
  
  // Participation
  participationRate: number; // 0-1, what % of users should see this test
  eligibilityCriteria: {
    minAppUsageDays?: number;
    requiredFeatureFlags?: string[];
    excludeUserIds?: string[];
  };
  
  // Test variants
  variants: ABTestVariant[];
  
  // Success metrics
  primaryMetric: 'click_through_rate' | 'dismissal_rate' | 'engagement_time' | 'user_satisfaction';
  secondaryMetrics?: ('click_through_rate' | 'dismissal_rate' | 'engagement_time' | 'user_satisfaction')[];
  
  // Sample size and confidence
  targetSampleSize: number;
  confidenceLevel: number; // 0.95 for 95%
  minimumEffectSize: number; // Minimum improvement to consider significant
}

interface ABTestVariant {
  variantId: string;
  name: string;
  weight: number; // 0-1, traffic allocation
  
  // Test parameters
  parameters: {
    // Timing parameters
    cooldownHours?: number;
    snoozeHours?: number;
    respectCircadianTiming?: boolean;
    minimumTimingScore?: number; // 0-100
    
    // Content parameters
    communicationStyle?: 'direct' | 'gentle' | 'encouraging';
    showConfidence?: boolean;
    showTimingReason?: boolean;
    
    // Frequency parameters
    maxSuggestionsPerDay?: number;
    maxSuggestionsPerHour?: number;
    aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
    
    // UI parameters
    cardStyle?: 'compact' | 'detailed';
    showProgress?: boolean;
    useAnimation?: boolean;
  };
}

interface ABTestAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: Date;
  isActive: boolean;
}

interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  eventType: 'suggestion_shown' | 'suggestion_clicked' | 'suggestion_dismissed';
  timestamp: Date;
  metadata: {
    suggestionCategory?: string;
    timingScore?: number;
    userStressLevel?: string;
    sessionDuration?: number;
    snoozeHours?: number;
  };
}

interface ABTestAnalysis {
  testId: string;
  status: 'insufficient_data' | 'in_progress' | 'significant' | 'inconclusive';
  results: {
    [variantId: string]: {
      sampleSize: number;
      clickThroughRate: number;
      dismissalRate: number;
      avgEngagementTime: number;
      confidence: number; // Statistical confidence
      isWinning?: boolean;
    };
  };
  recommendation: 'continue' | 'stop_test' | 'extend_test' | 'implement_winner';
  winningVariant?: string;
  statisticalSignificance?: number;
}

class ABTestingFramework {
  private static instance: ABTestingFramework;
  private readonly STORAGE_KEYS = {
    TESTS: 'ab_tests',
    ASSIGNMENTS: 'ab_test_assignments',
    RESULTS: 'ab_test_results'
  };

  private constructor() {}

  public static getInstance(): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
    }
    return ABTestingFramework.instance;
  }

  /**
   * 🧪 Get user's test assignment for adaptive suggestions
   */
  async getUserTestAssignment(userId: string): Promise<{
    testId: string | null;
    variantId: string | null;
    parameters: ABTestVariant['parameters'] | null;
  }> {
    if (!FEATURE_FLAGS.isEnabled('AI_AB_TESTING')) {
      return { testId: null, variantId: null, parameters: null };
    }

    try {
      // Check if user has existing assignment
      const assignment = await this.getExistingAssignment(userId);
      if (assignment) {
        const test = await this.getTest(assignment.testId);
        if (test && test.status === 'active') {
          const variant = test.variants.find(v => v.variantId === assignment.variantId);
          return {
            testId: assignment.testId,
            variantId: assignment.variantId,
            parameters: variant?.parameters || null
          };
        }
      }

      // Check for new test eligibility
      const eligibleTest = await this.findEligibleTest(userId);
      if (eligibleTest) {
        const assignedVariant = this.assignUserToVariant(eligibleTest);
        const newAssignment: ABTestAssignment = {
          userId,
          testId: eligibleTest.testId,
          variantId: assignedVariant.variantId,
          assignedAt: new Date(),
          isActive: true
        };
        
        await this.saveAssignment(newAssignment);
        
        console.log(`🧪 User assigned to A/B test: ${eligibleTest.name} - ${assignedVariant.name}`);
        
        return {
          testId: eligibleTest.testId,
          variantId: assignedVariant.variantId,
          parameters: assignedVariant.parameters
        };
      }

      return { testId: null, variantId: null, parameters: null };
      
    } catch (error) {
      console.error('❌ Failed to get A/B test assignment:', error);
      return { testId: null, variantId: null, parameters: null };
    }
  }

  /**
   * 📊 Record A/B test event
   */
  async recordTestEvent(
    userId: string,
    eventType: ABTestResult['eventType'],
    metadata: ABTestResult['metadata'] = {}
  ): Promise<void> {
    try {
      const assignment = await this.getExistingAssignment(userId);
      if (!assignment || !assignment.isActive) return;

      const result: ABTestResult = {
        testId: assignment.testId,
        variantId: assignment.variantId,
        userId,
        eventType,
        timestamp: new Date(),
        metadata
      };

      await this.saveTestResult(result);
      console.log(`📊 Recorded A/B test event: ${eventType} for variant ${assignment.variantId}`);
      
    } catch (error) {
      console.error('❌ Failed to record A/B test event:', error);
    }
  }

  /**
   * 🏗️ Create new A/B test
   */
  async createTest(test: ABTest): Promise<void> {
    try {
      const tests = await this.getTests();
      tests.push(test);
      await AsyncStorage.setItem(this.STORAGE_KEYS.TESTS, JSON.stringify(tests));
      console.log(`🧪 Created A/B test: ${test.name}`);
    } catch (error) {
      console.error('❌ Failed to create A/B test:', error);
    }
  }

  /**
   * 📊 Get test analysis
   */
  async getTestAnalysis(testId: string): Promise<ABTestAnalysis | null> {
    try {
      const results = await this.getTestResults(testId);
      if (results.length === 0) {
        return {
          testId,
          status: 'insufficient_data',
          results: {},
          recommendation: 'continue'
        };
      }

      const test = await this.getTest(testId);
      if (!test) return null;

      const analysis: ABTestAnalysis = {
        testId,
        status: 'in_progress',
        results: {},
        recommendation: 'continue'
      };

      // Calculate metrics for each variant
      for (const variant of test.variants) {
        const variantResults = results.filter(r => r.variantId === variant.variantId);
        const shown = variantResults.filter(r => r.eventType === 'suggestion_shown');
        const clicked = variantResults.filter(r => r.eventType === 'suggestion_clicked');
        const dismissed = variantResults.filter(r => r.eventType === 'suggestion_dismissed');

        const clickThroughRate = shown.length > 0 ? clicked.length / shown.length : 0;
        const dismissalRate = shown.length > 0 ? dismissed.length / shown.length : 0;
        const engagementTimes = clicked
          .map(r => r.metadata.sessionDuration || 0)
          .filter(t => t > 0);
        const avgEngagementTime = engagementTimes.length > 0 
          ? engagementTimes.reduce((sum, t) => sum + t, 0) / engagementTimes.length 
          : 0;

        analysis.results[variant.variantId] = {
          sampleSize: shown.length,
          clickThroughRate,
          dismissalRate,
          avgEngagementTime,
          confidence: this.calculateStatisticalConfidence(shown.length, clickThroughRate)
        };
      }

      // Determine winning variant and statistical significance
      const variants = Object.entries(analysis.results);
      if (variants.length >= 2) {
        const sortedByMetric = variants.sort((a, b) => {
          const metricA = this.getMetricValue(a[1], test.primaryMetric);
          const metricB = this.getMetricValue(b[1], test.primaryMetric);
          return metricB - metricA; // Higher is better for CTR, engagement; lower for dismissal
        });

        const [winnerData, runnerUpData] = sortedByMetric;
        const winnerMetric = this.getMetricValue(winnerData[1], test.primaryMetric);
        const runnerUpMetric = this.getMetricValue(runnerUpData[1], test.primaryMetric);
        
        if (winnerData[1].sampleSize >= test.targetSampleSize && 
            winnerData[1].confidence >= test.confidenceLevel &&
            Math.abs(winnerMetric - runnerUpMetric) >= test.minimumEffectSize) {
          
          analysis.status = 'significant';
          analysis.winningVariant = winnerData[0];
          analysis.recommendation = 'implement_winner';
          analysis.results[winnerData[0]].isWinning = true;
        }
      }

      return analysis;
      
    } catch (error) {
      console.error('❌ Failed to analyze A/B test:', error);
      return null;
    }
  }

  /**
   * 📦 Get predefined test templates
   */
  getTestTemplates(): ABTest[] {
    return [
      {
        testId: 'cooldown_frequency_test',
        name: 'Suggestion Frequency Test',
        description: 'Test different cooldown periods: 2h vs 4h vs 6h',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        status: 'draft',
        participationRate: 0.3,
        eligibilityCriteria: {
          minAppUsageDays: 7
        },
        variants: [
          {
            variantId: 'control_4h',
            name: 'Control (4h cooldown)',
            weight: 0.4,
            parameters: {
              cooldownHours: 4,
              snoozeHours: 2
            }
          },
          {
            variantId: 'aggressive_2h',
            name: 'Aggressive (2h cooldown)',
            weight: 0.3,
            parameters: {
              cooldownHours: 2,
              snoozeHours: 1,
              maxSuggestionsPerDay: 8
            }
          },
          {
            variantId: 'conservative_6h',
            name: 'Conservative (6h cooldown)',
            weight: 0.3,
            parameters: {
              cooldownHours: 6,
              snoozeHours: 3,
              maxSuggestionsPerDay: 4
            }
          }
        ],
        primaryMetric: 'click_through_rate',
        secondaryMetrics: ['dismissal_rate', 'engagement_time'],
        targetSampleSize: 100,
        confidenceLevel: 0.95,
        minimumEffectSize: 0.05
      },

      {
        testId: 'timing_strategy_test',
        name: 'Timing Strategy Test',
        description: 'Test circadian-based timing vs fixed timing',
        startDate: new Date(),
        endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
        status: 'draft',
        participationRate: 0.25,
        eligibilityCriteria: {
          minAppUsageDays: 14
        },
        variants: [
          {
            variantId: 'circadian_based',
            name: 'Smart Timing (Circadian)',
            weight: 0.5,
            parameters: {
              respectCircadianTiming: true,
              minimumTimingScore: 50,
              showTimingReason: true
            }
          },
          {
            variantId: 'fixed_timing',
            name: 'Fixed Timing',
            weight: 0.5,
            parameters: {
              respectCircadianTiming: false,
              minimumTimingScore: 0
            }
          }
        ],
        primaryMetric: 'click_through_rate',
        secondaryMetrics: ['user_satisfaction', 'engagement_time'],
        targetSampleSize: 150,
        confidenceLevel: 0.95,
        minimumEffectSize: 0.08
      },

      {
        testId: 'communication_style_test',
        name: 'Communication Style Test',
        description: 'Test direct vs gentle vs encouraging messaging',
        startDate: new Date(),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        status: 'draft',
        participationRate: 0.4,
        eligibilityCriteria: {},
        variants: [
          {
            variantId: 'encouraging',
            name: 'Encouraging Style',
            weight: 0.4,
            parameters: {
              communicationStyle: 'encouraging',
              showProgress: true
            }
          },
          {
            variantId: 'direct',
            name: 'Direct Style',
            weight: 0.3,
            parameters: {
              communicationStyle: 'direct',
              cardStyle: 'compact'
            }
          },
          {
            variantId: 'gentle',
            name: 'Gentle Style',
            weight: 0.3,
            parameters: {
              communicationStyle: 'gentle',
              cardStyle: 'detailed',
              useAnimation: true
            }
          }
        ],
        primaryMetric: 'user_satisfaction',
        secondaryMetrics: ['click_through_rate', 'dismissal_rate'],
        targetSampleSize: 80,
        confidenceLevel: 0.90,
        minimumEffectSize: 0.10
      }
    ];
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async getExistingAssignment(userId: string): Promise<ABTestAssignment | null> {
    try {
      const assignments = await this.getAssignments();
      return assignments.find(a => a.userId === userId && a.isActive) || null;
    } catch (error) {
      return null;
    }
  }

  private async findEligibleTest(userId: string): Promise<ABTest | null> {
    try {
      const tests = await this.getTests();
      const activeTests = tests.filter(t => 
        t.status === 'active' && 
        new Date() >= t.startDate && 
        new Date() <= t.endDate
      );

      for (const test of activeTests) {
        // Check eligibility
        if (!await this.isUserEligible(userId, test)) continue;

        // Check participation rate
        if (Math.random() > test.participationRate) continue;

        return test;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async isUserEligible(userId: string, test: ABTest): Promise<boolean> {
    const { eligibilityCriteria } = test;
    
    // Check exclusion list
    if (eligibilityCriteria.excludeUserIds?.includes(userId)) {
      return false;
    }

    // Check minimum usage days (simplified - would need real user data)
    if (eligibilityCriteria.minAppUsageDays) {
      // In a real implementation, check against user registration date
      // For now, assume eligible
    }

    // Check feature flags
    if (eligibilityCriteria.requiredFeatureFlags) {
      for (const flag of eligibilityCriteria.requiredFeatureFlags) {
        if (!FEATURE_FLAGS.isEnabled(flag as any)) {
          return false;
        }
      }
    }

    return true;
  }

  private assignUserToVariant(test: ABTest): ABTestVariant {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return variant;
      }
    }
    
    // Fallback to first variant
    return test.variants[0];
  }

  private getMetricValue(result: ABTestAnalysis['results'][string], metric: ABTest['primaryMetric']): number {
    switch (metric) {
      case 'click_through_rate':
        return result.clickThroughRate;
      case 'dismissal_rate':
        return 1 - result.dismissalRate; // Higher is better (lower dismissal)
      case 'engagement_time':
        return result.avgEngagementTime;
      case 'user_satisfaction':
        return result.clickThroughRate; // Proxy for satisfaction
      default:
        return result.clickThroughRate;
    }
  }

  private calculateStatisticalConfidence(sampleSize: number, successRate: number): number {
    // Simplified confidence calculation
    // In production, use proper statistical tests
    if (sampleSize < 10) return 0.1;
    if (sampleSize < 50) return 0.5;
    if (sampleSize < 100) return 0.8;
    return 0.95;
  }

  // Storage helpers
  private async getTests(): Promise<ABTest[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.TESTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  private async getTest(testId: string): Promise<ABTest | null> {
    const tests = await this.getTests();
    return tests.find(t => t.testId === testId) || null;
  }

  private async getAssignments(): Promise<ABTestAssignment[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.ASSIGNMENTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  private async saveAssignment(assignment: ABTestAssignment): Promise<void> {
    try {
      const assignments = await this.getAssignments();
      assignments.push(assignment);
      await AsyncStorage.setItem(this.STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
    } catch (error) {
      console.error('❌ Failed to save A/B test assignment:', error);
    }
  }

  private async getTestResults(testId?: string): Promise<ABTestResult[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.RESULTS);
      const results: ABTestResult[] = stored ? JSON.parse(stored) : [];
      return testId ? results.filter(r => r.testId === testId) : results;
    } catch (error) {
      return [];
    }
  }

  private async saveTestResult(result: ABTestResult): Promise<void> {
    try {
      const results = await this.getTestResults();
      results.push(result);
      // Keep only last 1000 results
      const trimmed = results.slice(-1000);
      await AsyncStorage.setItem(this.STORAGE_KEYS.RESULTS, JSON.stringify(trimmed));
    } catch (error) {
      console.error('❌ Failed to save A/B test result:', error);
    }
  }
}

export const abTestingFramework = ABTestingFramework.getInstance();
export type { ABTest, ABTestVariant, ABTestAnalysis, ABTestAssignment };
export default abTestingFramework;
