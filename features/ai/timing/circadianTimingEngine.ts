/**
 * ⏰ Circadian Timing Engine - Smart Timing for Adaptive Suggestions
 * 
 * Optimal suggestion timing based on:
 * - Turkish cultural context (prayer times, meal times, work schedules)
 * - Individual circadian preferences learned from user behavior
 * - Real-world timing effectiveness from analytics
 * - Stress level and energy patterns throughout the day
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { adaptiveSuggestionAnalytics } from '../analytics/adaptiveSuggestionAnalytics';

// Types
interface CircadianProfile {
  userId: string;
  chronotype: 'morning' | 'evening' | 'intermediate'; // Learned from behavior
  optimalHours: {
    high: number[]; // Best hours (>70% effectiveness)
    medium: number[]; // Good hours (40-70% effectiveness) 
    low: number[]; // Poor hours (<40% effectiveness)
  };
  quietHours: {
    start: number; // 22
    end: number;   // 8
  };
  culturalFactors: {
    prayerTimes?: number[]; // Approximate prayer hours
    mealTimes: number[];    // Traditional meal times
    workHours: {
      start: number;
      end: number;
    };
    weekendPattern: boolean; // Different pattern on weekends
  };
  personalPatterns: {
    stressPeaks: number[]; // Hours when user typically stressed
    energyPeaks: number[];  // Hours when user has most energy
    responsiveHours: number[]; // Hours with highest CTR
  };
  lastUpdated: Date;
}

interface TimingRecommendation {
  score: number; // 0-100, higher = better timing
  rationale: string;
  confidence: number; // 0-1
  factors: {
    circadian: number;    // Circadian rhythm factor (-50 to +50)
    cultural: number;     // Cultural appropriateness (-30 to +30)
    personal: number;     // Personal pattern factor (-20 to +20)
    historical: number;   // Historical effectiveness (-20 to +20)
  };
  alternatives?: {
    hour: number;
    score: number;
    reason: string;
  }[];
}

interface CircadianConfig {
  enabled: boolean;
  learningEnabled: boolean; // Learn from user behavior
  culturalAdaptation: boolean;
  minimumDataPoints: number; // Before making recommendations
  adaptationRate: number; // How quickly to adapt to new patterns (0-1)
  confidenceThreshold: number; // Minimum confidence to override defaults
}

class CircadianTimingEngine {
  private static instance: CircadianTimingEngine;
  private config: CircadianConfig = {
    enabled: true,
    learningEnabled: true,
    culturalAdaptation: true,
    minimumDataPoints: 10,
    adaptationRate: 0.3,
    confidenceThreshold: 0.6
  };

  private constructor() {}

  public static getInstance(): CircadianTimingEngine {
    if (!CircadianTimingEngine.instance) {
      CircadianTimingEngine.instance = new CircadianTimingEngine();
    }
    return CircadianTimingEngine.instance;
  }

  /**
   * ⏰ Get timing recommendation for current moment
   */
  async getTimingRecommendation(userId: string): Promise<TimingRecommendation> {
    if (!this.config.enabled || !FEATURE_FLAGS.isEnabled('AI_ADAPTIVE_INTERVENTIONS')) {
      return this.getDefaultRecommendation();
    }

    try {
      const profile = await this.getUserCircadianProfile(userId);
      const currentHour = new Date().getHours();
      
      return this.calculateTimingScore(currentHour, profile);
      
    } catch (error) {
      console.error('❌ Failed to get timing recommendation:', error);
      return this.getDefaultRecommendation();
    }
  }

  /**
   * 📊 Get best timing for next 24 hours
   */
  async getOptimalTimingForNext24Hours(userId: string): Promise<Array<{
    hour: number;
    score: number;
    timeLabel: string;
    recommendation: 'optimal' | 'good' | 'avoid';
  }>> {
    const profile = await this.getUserCircadianProfile(userId);
    const results = [];
    
    for (let hour = 0; hour < 24; hour++) {
      const recommendation = this.calculateTimingScore(hour, profile);
      results.push({
        hour,
        score: recommendation.score,
        timeLabel: this.formatHour(hour),
        recommendation: recommendation.score >= 70 ? 'optimal' : 
                       recommendation.score >= 40 ? 'good' : 'avoid'
      });
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 🧠 Learn from user interaction patterns
   */
  async learnFromInteraction(
    userId: string, 
    hour: number, 
    wasSuccessful: boolean,
    stressLevel: 'low' | 'moderate' | 'high'
  ): Promise<void> {
    if (!this.config.learningEnabled) return;

    try {
      const profile = await this.getUserCircadianProfile(userId);
      
      // Update responsiveness data
      if (wasSuccessful) {
        if (!profile.personalPatterns.responsiveHours.includes(hour)) {
          profile.personalPatterns.responsiveHours.push(hour);
        }
      }
      
      // Update stress patterns
      if (stressLevel === 'high') {
        if (!profile.personalPatterns.stressPeaks.includes(hour)) {
          profile.personalPatterns.stressPeaks.push(hour);
        }
      }
      
      // Adaptive learning - gradually adjust optimal hours based on success
      if (wasSuccessful && profile.optimalHours.low.includes(hour)) {
        // Move from low to medium if consistently successful
        profile.optimalHours.low = profile.optimalHours.low.filter(h => h !== hour);
        profile.optimalHours.medium.push(hour);
      } else if (!wasSuccessful && profile.optimalHours.high.includes(hour)) {
        // Downgrade from high if failing
        profile.optimalHours.high = profile.optimalHours.high.filter(h => h !== hour);
        profile.optimalHours.medium.push(hour);
      }
      
      profile.lastUpdated = new Date();
      await this.saveUserCircadianProfile(profile);
      
      console.log(`🧠 Updated circadian profile for user at ${hour}:00 (success: ${wasSuccessful})`);
      
    } catch (error) {
      console.error('❌ Failed to learn from interaction:', error);
    }
  }

  /**
   * 📊 Calculate timing score for specific hour
   */
  private calculateTimingScore(hour: number, profile: CircadianProfile): TimingRecommendation {
    let score = 50; // Base score
    const factors = { circadian: 0, cultural: 0, personal: 0, historical: 0 };
    const rationales: string[] = [];
    
    // 1. Circadian rhythm factors (-50 to +50)
    if (profile.optimalHours.high.includes(hour)) {
      factors.circadian += 40;
      rationales.push('Optimal circadian window');
    } else if (profile.optimalHours.medium.includes(hour)) {
      factors.circadian += 15;
      rationales.push('Good circadian timing');
    } else if (profile.optimalHours.low.includes(hour)) {
      factors.circadian -= 30;
      rationales.push('Suboptimal circadian timing');
    }

    // Quiet hours penalty
    if (this.isQuietHour(hour, profile)) {
      factors.circadian -= 50;
      rationales.push('Quiet hours - not recommended');
    }
    
    // 2. Cultural factors (-30 to +30)
    if (this.config.culturalAdaptation) {
      if (this.isCulturallyAppropriate(hour, profile)) {
        factors.cultural += 20;
        rationales.push('Culturally appropriate time');
      } else if (this.isCulturallyPoor(hour, profile)) {
        factors.cultural -= 25;
        rationales.push('Culturally inappropriate time');
      }
    }
    
    // 3. Personal patterns (-20 to +20) 
    if (profile.personalPatterns.responsiveHours.includes(hour)) {
      factors.personal += 15;
      rationales.push('Historically responsive time');
    }
    
    if (profile.personalPatterns.stressPeaks.includes(hour)) {
      factors.personal -= 10;
      rationales.push('Typical stress peak time');
    }
    
    if (profile.personalPatterns.energyPeaks.includes(hour)) {
      factors.personal += 10;
      rationales.push('High energy time');
    }

    // 4. Historical effectiveness from analytics (-20 to +20)
    // This would ideally use real analytics data
    const isHistoricallyGood = this.getHistoricalEffectiveness(hour);
    if (isHistoricallyGood > 0.7) {
      factors.historical += 15;
      rationales.push('Strong historical performance');
    } else if (isHistoricallyGood < 0.3) {
      factors.historical -= 15;
      rationales.push('Poor historical performance');
    }
    
    // Calculate final score
    score += factors.circadian + factors.cultural + factors.personal + factors.historical;
    score = Math.max(0, Math.min(100, score)); // Clamp 0-100

    // Calculate confidence based on data availability
    const dataPoints = profile.personalPatterns.responsiveHours.length;
    const confidence = Math.min(0.9, Math.max(0.3, dataPoints / this.config.minimumDataPoints));

    // Generate alternatives
    const alternatives = this.generateAlternatives(hour, profile).slice(0, 3);

    return {
      score,
      rationale: rationales.join(', ') || 'Standard timing assessment',
      confidence,
      factors,
      alternatives
    };
  }

  /**
   * 👤 Get or create user circadian profile
   */
  private async getUserCircadianProfile(userId: string): Promise<CircadianProfile> {
    try {
      const key = `circadian_profile_${userId}`;
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        const profile = JSON.parse(stored);
        // Check if profile is recent (less than 30 days old)
        const daysSinceUpdate = (Date.now() - new Date(profile.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 30) {
          return profile;
        }
      }
      
      // Create new profile or refresh old one
      return await this.createDefaultProfile(userId);
      
    } catch (error) {
      console.error('❌ Failed to get circadian profile:', error);
      return await this.createDefaultProfile(userId);
    }
  }

  /**
   * 🆕 Create default circadian profile
   */
  private async createDefaultProfile(userId: string): Promise<CircadianProfile> {
    // Try to infer chronotype from analytics if available
    let chronotype: 'morning' | 'evening' | 'intermediate' = 'intermediate';
    let optimalHours = { high: [9, 10, 14, 15], medium: [8, 11, 13, 16, 19], low: [6, 7, 12, 17, 18, 20, 21] };

    try {
      // Get timing recommendations from analytics
      const timingData = await adaptiveSuggestionAnalytics.getOptimalTimingRecommendations();
      
      if (timingData.bestHours.length > 0) {
        const bestHours = timingData.bestHours.map(h => h.hour);
        const morningHours = bestHours.filter(h => h >= 6 && h <= 12).length;
        const eveningHours = bestHours.filter(h => h >= 17 && h <= 23).length;
        
        if (morningHours > eveningHours) {
          chronotype = 'morning';
          optimalHours.high = [7, 8, 9, 10];
          optimalHours.medium = [6, 11, 14, 15];
        } else if (eveningHours > morningHours) {
          chronotype = 'evening';
          optimalHours.high = [15, 16, 18, 19];
          optimalHours.medium = [14, 17, 20];
        }
      }
    } catch (error) {
      console.log('📊 No analytics data available, using defaults');
    }

    const profile: CircadianProfile = {
      userId,
      chronotype,
      optimalHours,
      quietHours: { start: 22, end: 8 },
      culturalFactors: {
        prayerTimes: [5, 12, 15, 18, 19], // Approximate prayer times
        mealTimes: [8, 13, 19], // Breakfast, lunch, dinner
        workHours: { start: 9, end: 18 },
        weekendPattern: true
      },
      personalPatterns: {
        stressPeaks: [],
        energyPeaks: [],
        responsiveHours: []
      },
      lastUpdated: new Date()
    };

    await this.saveUserCircadianProfile(profile);
    return profile;
  }

  /**
   * 💾 Save circadian profile
   */
  private async saveUserCircadianProfile(profile: CircadianProfile): Promise<void> {
    try {
      const key = `circadian_profile_${profile.userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(profile));
    } catch (error) {
      console.error('❌ Failed to save circadian profile:', error);
    }
  }

  /**
   * 🌙 Check if hour is in quiet period
   */
  private isQuietHour(hour: number, profile: CircadianProfile): boolean {
    const { start, end } = profile.quietHours;
    if (start > end) {
      // Crosses midnight (e.g., 22:00 - 08:00)
      return hour >= start || hour < end;
    } else {
      // Same day (e.g., 01:00 - 06:00)
      return hour >= start && hour < end;
    }
  }

  /**
   * 🕌 Check cultural appropriateness
   */
  private isCulturallyAppropriate(hour: number, profile: CircadianProfile): boolean {
    const { prayerTimes, mealTimes, workHours } = profile.culturalFactors;
    
    // Good times: Between meals, not during prayer times, within work hours
    const isWorkHours = hour >= workHours.start && hour <= workHours.end;
    const isMealTime = mealTimes?.some(mealHour => Math.abs(hour - mealHour) < 1);
    const isPrayerTime = prayerTimes?.some(prayerHour => Math.abs(hour - prayerHour) < 0.5);
    
    return isWorkHours && !isMealTime && !isPrayerTime;
  }

  /**
   * ❌ Check culturally poor timing
   */
  private isCulturallyPoor(hour: number, profile: CircadianProfile): boolean {
    const { prayerTimes, mealTimes } = profile.culturalFactors;
    
    // Poor times: During prayer or meal times, very early morning
    const isMealTime = mealTimes?.some(mealHour => Math.abs(hour - mealHour) < 1);
    const isPrayerTime = prayerTimes?.some(prayerHour => Math.abs(hour - prayerHour) < 0.5);
    const isVeryEarly = hour >= 5 && hour < 7;
    
    return isMealTime || isPrayerTime || isVeryEarly;
  }

  /**
   * 📊 Get historical effectiveness (simplified)
   */
  private getHistoricalEffectiveness(hour: number): number {
    // This would ideally query real analytics data
    // For now, using general patterns
    if (hour >= 9 && hour <= 11) return 0.8;  // Morning high
    if (hour >= 14 && hour <= 16) return 0.75; // Afternoon high
    if (hour >= 19 && hour <= 21) return 0.6;  // Evening moderate
    if (hour >= 22 || hour <= 6) return 0.1;   // Night/early morning low
    return 0.5; // Default moderate
  }

  /**
   * 🔄 Generate alternative timing suggestions
   */
  private generateAlternatives(currentHour: number, profile: CircadianProfile): Array<{
    hour: number;
    score: number;
    reason: string;
  }> {
    const alternatives = [];
    
    // Check +1, +2, +3 hours
    for (let offset of [1, 2, 3]) {
      const alternativeHour = (currentHour + offset) % 24;
      if (!this.isQuietHour(alternativeHour, profile)) {
        const recommendation = this.calculateTimingScore(alternativeHour, profile);
        alternatives.push({
          hour: alternativeHour,
          score: recommendation.score,
          reason: `${offset} saat sonra - ${recommendation.rationale}`
        });
      }
    }
    
    return alternatives.sort((a, b) => b.score - a.score);
  }

  /**
   * 🕐 Format hour for display
   */
  private formatHour(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  /**
   * ⚡ Get default recommendation when service unavailable
   */
  private getDefaultRecommendation(): TimingRecommendation {
    const currentHour = new Date().getHours();
    
    // Simple default scoring
    let score = 50;
    let rationale = 'Default timing assessment';
    
    if (currentHour >= 22 || currentHour <= 6) {
      score = 10;
      rationale = 'Quiet hours - not recommended';
    } else if ((currentHour >= 9 && currentHour <= 11) || (currentHour >= 14 && currentHour <= 16)) {
      score = 70;
      rationale = 'Generally good timing';
    }

    return {
      score,
      rationale,
      confidence: 0.3, // Low confidence for defaults
      factors: { circadian: 0, cultural: 0, personal: 0, historical: 0 }
    };
  }
}

export const circadianTimingEngine = CircadianTimingEngine.getInstance();
export type { TimingRecommendation, CircadianProfile };
export default circadianTimingEngine;
