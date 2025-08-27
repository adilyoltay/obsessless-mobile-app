/**
 * 🎭 Advanced Mood Pattern Analysis Service
 * 
 * Implements advanced mood pattern recognition from AI_FEATURES_MOOD_SCREEN.md:
 * - Temporal patterns (hourly, daily, weekly cycles)
 * - Trigger-mood correlation analysis
 * - MEA (Mood-Energy-Anxiety) correlation matrix
 * - Predictive mood intervention
 * 
 * Created: Jan 2025 - Part of Mood Screen AI Enhancement Project
 */

import { MoodEntry } from '@/services/moodTrackingService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface MoodPattern {
  type: 'temporal' | 'trigger' | 'weekly_cycle' | 'mea_correlation';
  title: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  suggestion?: string;
  data?: any;
}

interface TemporalPattern extends MoodPattern {
  type: 'temporal';
  timeRange: 'hourly' | 'daily' | 'weekly';
  peakHours?: number[];
  lowHours?: number[];
  averageScore?: number;
  variance?: number;
}

interface TriggerCorrelationPattern extends MoodPattern {
  type: 'trigger';
  trigger: string;
  averageMoodImpact: number;
  frequency: number;
  correlationStrength: number;
}

interface WeeklyCyclePattern extends MoodPattern {
  type: 'weekly_cycle';
  cycleType: 'monday_blues' | 'weekend_boost' | 'midweek_dip' | 'stable_week';
  dayAverages: Record<string, number>;
}

interface MEACorrelationPattern extends MoodPattern {
  type: 'mea_correlation';
  correlations: {
    moodEnergy: number;
    moodAnxiety: number;
    energyAnxiety: number;
  };
  profileType: 'optimal' | 'depression_risk' | 'manic_tendency' | 'balanced' | 'unstable';
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

export class MoodPatternAnalysisService {
  private static instance: MoodPatternAnalysisService;
  
  static getInstance(): MoodPatternAnalysisService {
    if (!MoodPatternAnalysisService.instance) {
      MoodPatternAnalysisService.instance = new MoodPatternAnalysisService();
    }
    return MoodPatternAnalysisService.instance;
  }

  /**
   * 🔍 Main analysis entry point - discovers all mood patterns
   */
  async analyzeMoodPatterns(
    moodEntries: MoodEntry[], 
    userId: string,
    analysisType: 'full' | 'temporal' | 'trigger' | 'mea' = 'full'
  ): Promise<MoodPattern[]> {
    const startTime = Date.now();
    console.log(`🎭 Starting mood pattern analysis for ${moodEntries.length} entries`);

    // Track analysis start
    await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
      userId,
      dataType: 'mood_patterns',
      entryCount: moodEntries.length,
      analysisType,
      timestamp: startTime
    });

    const patterns: MoodPattern[] = [];

    try {
      // Filter out invalid entries
      const validEntries = moodEntries.filter(entry => 
        entry.mood_score !== undefined && 
        entry.energy_level !== undefined && 
        entry.anxiety_level !== undefined
      );

      // 📊 ENHANCED THRESHOLD: Require more entries for reliable pattern analysis
      const MIN_ENTRIES_BASIC = 7;   // Basic patterns need 7 entries minimum
      const MIN_ENTRIES_ADVANCED = 14; // Advanced correlations need 2 weeks of data
      
      if (validEntries.length < MIN_ENTRIES_BASIC) {
        console.warn(`⚠️ Insufficient data for pattern analysis (need at least ${MIN_ENTRIES_BASIC} entries, got ${validEntries.length})`);
        
        // 📈 PARTIAL ANALYSIS: If we have some data (3-6 entries), provide limited insights with low confidence
        // Note: Full reliable analysis requires 7+ entries, but we still show basic patterns for engagement
        if (validEntries.length >= 3) {
          const limitedPattern: MoodPattern = {
            id: `limited_${Date.now()}`,
            type: 'general',
            confidence: Math.max(0.2, (validEntries.length / MIN_ENTRIES_BASIC) * 0.5), // Max 50% confidence for limited data
            description: `Sınırlı veri ile genel eğilim (${validEntries.length} kayıt)`,
            actionableInsights: [
              `Daha güvenilir analiz için en az ${MIN_ENTRIES_BASIC - validEntries.length} gün daha mood kaydı gerekiyor.`,
              'Mevcut verilerle genel bir eğilim gözlemlenebiliyor ancak kesin pattern'ler için daha fazla data gerekli.'
            ],
            triggers: [],
            timePattern: 'insufficient_data',
            severity: 'low' as any
          };
          patterns.push(limitedPattern);
        }
        
        return patterns;
      }

      // Run different analysis types based on request
      if (analysisType === 'full' || analysisType === 'temporal') {
        const temporalPatterns = await this.analyzeTemporalPatterns(validEntries);
        patterns.push(...temporalPatterns);
      }

      // 🔍 TRIGGER ANALYSIS: Requires sufficient sample size for correlation reliability
      if (analysisType === 'full' || analysisType === 'trigger') {
        if (validEntries.length >= MIN_ENTRIES_BASIC) {
          const triggerPatterns = await this.analyzeTriggerMoodCorrelation(validEntries);
          patterns.push(...triggerPatterns);
        } else {
          console.log(`⚠️ Skipping trigger analysis: need ${MIN_ENTRIES_BASIC} entries, have ${validEntries.length}`);
        }
      }

      // 📊 MEA CORRELATION: Requires advanced sample size for reliable mood-energy-anxiety patterns
      if (analysisType === 'full' || analysisType === 'mea') {
        if (validEntries.length >= MIN_ENTRIES_ADVANCED) {
          const meaPatterns = await this.analyzeMEACorrelation(validEntries);
          patterns.push(...meaPatterns);
        } else if (validEntries.length >= MIN_ENTRIES_BASIC) {
          // Provide simplified MEA analysis with lower confidence
          console.log(`📊 Running simplified MEA analysis with ${validEntries.length} entries`);
          const meaPatterns = await this.analyzeMEACorrelation(validEntries);
          // Reduce confidence for patterns with insufficient data
          meaPatterns.forEach(pattern => {
            pattern.confidence = Math.min(pattern.confidence * 0.7, 0.6); // Cap at 60% for limited data
            pattern.description = `${pattern.description} (sınırlı veri)`;
          });
          patterns.push(...meaPatterns);
        }
      }

      // 📅 WEEKLY CYCLE ANALYSIS: Enhanced threshold for seasonal pattern detection
      if (analysisType === 'full' && validEntries.length >= MIN_ENTRIES_ADVANCED) {
        const weeklyPatterns = await this.analyzeWeeklyCycles(validEntries);
        patterns.push(...weeklyPatterns);
      } else if (analysisType === 'full' && validEntries.length >= MIN_ENTRIES_BASIC) {
        console.log(`📅 Insufficient data for weekly cycle analysis: need ${MIN_ENTRIES_ADVANCED} entries for reliable weekly patterns`);
      }

      // Sort patterns by actionability and severity
      const sortedPatterns = patterns.sort((a, b) => {
        if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      console.log(`✅ Found ${sortedPatterns.length} mood patterns in ${Date.now() - startTime}ms`);

      // Track analysis completion
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        insightsCount: sortedPatterns.length,
        processingTime: Date.now() - startTime,
        highPriorityPatterns: sortedPatterns.filter(p => p.severity === 'high' || p.severity === 'critical').length,
        source: 'mood_pattern_analysis'
      });

      return sortedPatterns;

    } catch (error) {
      console.error('❌ Mood pattern analysis failed:', error);
      
      await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
        userId,
        component: 'moodPatternAnalysis',
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });

      return patterns;
    }
  }

  // =============================================================================
  // TEMPORAL PATTERN ANALYSIS
  // =============================================================================

  private async analyzeTemporalPatterns(entries: MoodEntry[]): Promise<TemporalPattern[]> {
    const patterns: TemporalPattern[] = [];

    // 1. HOURLY PATTERNS
    const hourlyPatterns = this.analyzeHourlyPatterns(entries);
    patterns.push(...hourlyPatterns);

    // 2. DAILY PATTERNS
    const dailyPatterns = this.analyzeDailyPatterns(entries);
    patterns.push(...dailyPatterns);

    return patterns;
  }

  private analyzeHourlyPatterns(entries: MoodEntry[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];
    
    // Group entries by hour
    const hourlyMoods: Record<number, number[]> = {};
    
    entries.forEach(entry => {
      // ✅ FIXED: Handle both timestamp and created_at fields, with fallback
      const dateValue = (entry as any).timestamp || (entry as any).created_at || Date.now();
      const hour = new Date(dateValue).getHours();
      
      // Validate hour is a valid number
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        if (!hourlyMoods[hour]) hourlyMoods[hour] = [];
        hourlyMoods[hour].push(entry.mood_score);
      }
    });

    // Calculate hourly averages
    const hourlyAverages: Record<number, number> = {};
    Object.entries(hourlyMoods).forEach(([hour, moods]) => {
      hourlyAverages[parseInt(hour)] = moods.reduce((a, b) => a + b, 0) / moods.length;
    });

    // Find low mood hours (below 40)
    const lowMoodHours = Object.entries(hourlyAverages)
      .filter(([, avgMood]) => avgMood < 40)
      .map(([hour, avgMood]) => ({ 
        hour: parseInt(hour), 
        avgMood 
      }))
      .filter(item => !isNaN(item.hour)); // ✅ FIXED: Filter out NaN hours

    if (lowMoodHours.length > 0) {
      const lowestHour = lowMoodHours.reduce((prev, curr) => 
        prev.avgMood < curr.avgMood ? prev : curr
      );

      // ✅ FIXED: Validate hour before using in title
      const hourText = !isNaN(lowestHour.hour) ? `${lowestHour.hour}:00` : 'Bazı Saatlerde';
      
      patterns.push({
        type: 'temporal',
        timeRange: 'hourly',
        title: `${hourText} Civarında Düşük Mood`,
        description: `Bu saatlerde mood ortalamanız ${lowestHour.avgMood.toFixed(1)}/100`,
        confidence: Math.min(0.9, hourlyMoods[lowestHour.hour]?.length * 0.1 || 0.5),
        severity: lowestHour.avgMood < 25 ? 'high' : 'medium',
        actionable: true,
        suggestion: !isNaN(lowestHour.hour) 
          ? `${lowestHour.hour}:00 civarında destekleyici aktiviteler planlayın (nefes egzersizi, müzik, kısa yürüyüş)`
          : 'Düşük mood anlarında destekleyici aktiviteler planlayın (nefes egzersizi, müzik, kısa yürüyüş)',
        lowHours: [lowestHour.hour],
        averageScore: lowestHour.avgMood,
        data: {
          hourlyAverages,
          dataPoints: hourlyMoods[lowestHour.hour]?.length || 0
        }
      });
    }

    // Find peak mood hours (above 70)
    const peakMoodHours = Object.entries(hourlyAverages)
      .filter(([, avgMood]) => avgMood > 70)
      .map(([hour, avgMood]) => ({ hour: parseInt(hour), avgMood }))
      .filter(item => !isNaN(item.hour)); // ✅ FIXED: Filter out NaN hours

    if (peakMoodHours.length > 0) {
      const peakHour = peakMoodHours.reduce((prev, curr) => 
        prev.avgMood > curr.avgMood ? prev : curr
      );

      // ✅ FIXED: Validate hour before using in title
      const hourText = !isNaN(peakHour.hour) ? `${peakHour.hour}:00` : 'Bazı Saatlerde';
      
      patterns.push({
        type: 'temporal',
        timeRange: 'hourly',
        title: `${hourText} Civarında Yüksek Enerji`,
        description: `Bu saatlerde mood ortalamanız ${peakHour.avgMood.toFixed(1)}/100`,
        confidence: Math.min(0.9, hourlyMoods[peakHour.hour]?.length * 0.1 || 0.5),
        severity: 'low',
        actionable: true,
        suggestion: !isNaN(peakHour.hour)
          ? `${peakHour.hour}:00 civarında önemli görevlerinizi planlayın - en verimli olduğunuz saatler`
          : 'Yüksek mood anlarında önemli görevlerinizi planlayın - en verimli olduğunuz saatler',
        peakHours: [peakHour.hour],
        averageScore: peakHour.avgMood,
        data: {
          hourlyAverages,
          dataPoints: hourlyMoods[peakHour.hour]?.length || 0
        }
      });
    }

    return patterns;
  }

  private analyzeDailyPatterns(entries: MoodEntry[]): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];
    
    // Group entries by day of week
    const dailyMoods: Record<string, number[]> = {};
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    
    entries.forEach(entry => {
      // ✅ FIXED: Handle both timestamp and created_at fields, with fallback
      const dateValue = (entry as any).timestamp || (entry as any).created_at || Date.now();
      const dayOfWeek = new Date(dateValue).getDay();
      
      // Validate dayOfWeek is a valid number
      if (!isNaN(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
        const dayName = dayNames[dayOfWeek];
        if (dayName) {
          if (!dailyMoods[dayName]) dailyMoods[dayName] = [];
          dailyMoods[dayName].push(entry.mood_score);
        }
      }
    });

    // Calculate daily averages
    const dailyAverages: Record<string, number> = {};
    Object.entries(dailyMoods).forEach(([day, moods]) => {
      if (moods.length > 0) {
        dailyAverages[day] = moods.reduce((a, b) => a + b, 0) / moods.length;
      }
    });

    // Find problematic days
    const lowDays = Object.entries(dailyAverages)
      .filter(([, avg]) => avg < 45)
      .sort((a, b) => a[1] - b[1]);

    if (lowDays.length > 0) {
      const [worstDay, worstAvg] = lowDays[0];
      
      patterns.push({
        type: 'temporal',
        timeRange: 'daily',
        title: `${worstDay} Günleri Zorlu Geçiyor`,
        description: `${worstDay} günlerinde mood ortalamanız ${worstAvg.toFixed(1)}/100`,
        confidence: Math.min(0.9, dailyMoods[worstDay]?.length * 0.15 || 0.6),
        severity: worstAvg < 30 ? 'high' : 'medium',
        actionable: true,
        suggestion: `${worstDay} günleri için özel destek planı oluşturun: gevşeme teknikleri, sosyal destek, hafif aktiviteler`,
        averageScore: worstAvg,
        data: {
          dailyAverages,
          dataPoints: dailyMoods[worstDay]?.length || 0,
          allDayData: dailyMoods
        }
      });
    }

    return patterns;
  }

  // =============================================================================
  // TRIGGER-MOOD CORRELATION ANALYSIS
  // =============================================================================

  private async analyzeTriggerMoodCorrelation(entries: MoodEntry[]): Promise<TriggerCorrelationPattern[]> {
    const patterns: TriggerCorrelationPattern[] = [];

    // Group entries by trigger
    const triggerMoodMap = new Map<string, number[]>();
    
    entries.forEach(entry => {
      if (entry.triggers && Array.isArray(entry.triggers)) {
        entry.triggers.forEach(trigger => {
          if (!triggerMoodMap.has(trigger)) {
            triggerMoodMap.set(trigger, []);
          }
          triggerMoodMap.get(trigger)!.push(entry.mood_score);
        });
      }
    });

    // Analyze each trigger
    const correlations: Array<{
      trigger: string;
      averageMoodImpact: number;
      frequency: number;
      correlationStrength: number;
    }> = [];

    triggerMoodMap.forEach((moods, trigger) => {
      if (moods.length >= 2) { // Need at least 2 data points
        const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
        const frequency = moods.length;
        
        // Calculate correlation strength based on variance and sample size
        const variance = this.calculateVariance(moods);
        const correlationStrength = Math.min(1, (frequency * 0.1) * (1 / (variance + 0.1)));

        correlations.push({
          trigger,
          averageMoodImpact: avgMood,
          frequency,
          correlationStrength
        });
      }
    });

    // Sort by impact severity (frequency * deviation from 50)
    correlations.sort((a, b) => {
      const impactA = a.frequency * Math.abs(50 - a.averageMoodImpact);
      const impactB = b.frequency * Math.abs(50 - b.averageMoodImpact);
      return impactB - impactA;
    });

    // Create patterns for most significant correlations
    correlations.slice(0, 5).forEach(correlation => {
      const isNegative = correlation.averageMoodImpact < 45;
      const isStrong = correlation.correlationStrength > 0.6 && correlation.frequency >= 3;

      if (isStrong) {
        patterns.push({
          type: 'trigger',
          trigger: correlation.trigger,
          title: `"${correlation.trigger}" ${isNegative ? 'Mood Düşürücü' : 'Mood Yükseltici'} Etki`,
          description: `Bu tetikleyici ${correlation.frequency} kez yaşandı, ortalama mood ${correlation.averageMoodImpact.toFixed(1)}/100`,
          confidence: correlation.correlationStrength,
          severity: isNegative && correlation.averageMoodImpact < 30 ? 'high' : 
                   isNegative ? 'medium' : 'low',
          actionable: isNegative,
          suggestion: isNegative 
            ? `"${correlation.trigger}" durumları için başa çıkma stratejileri geliştirin`
            : `"${correlation.trigger}" aktivitelerini artırın - size iyi geliyor`,
          averageMoodImpact: correlation.averageMoodImpact,
          frequency: correlation.frequency,
          correlationStrength: correlation.correlationStrength
        });
      }
    });

    return patterns;
  }

  // =============================================================================
  // MOOD-ENERGY-ANXIETY (MEA) CORRELATION ANALYSIS
  // =============================================================================

  private async analyzeMEACorrelation(entries: MoodEntry[]): Promise<MEACorrelationPattern[]> {
    const patterns: MEACorrelationPattern[] = [];

    if (entries.length < 5) {
      console.warn('⚠️ Insufficient data for MEA correlation analysis');
      return patterns;
    }

    // Extract data arrays
    const moods = entries.map(e => e.mood_score);
    const energies = entries.map(e => e.energy_level);
    const anxieties = entries.map(e => e.anxiety_level);

    // Calculate correlations
    const moodEnergyCorr = this.calculateCorrelation(moods, energies);
    const moodAnxietyCorr = this.calculateCorrelation(moods, anxieties);
    const energyAnxietyCorr = this.calculateCorrelation(energies, anxieties);

    // Determine emotional profile
    const profileType = this.determineEmotionalProfile({
      moodEnergy: moodEnergyCorr,
      moodAnxiety: moodAnxietyCorr,
      energyAnxiety: energyAnxietyCorr
    });

    const pattern: MEACorrelationPattern = {
      type: 'mea_correlation',
      title: this.getProfileTitle(profileType),
      description: this.getProfileDescription(profileType, {
        moodEnergy: moodEnergyCorr,
        moodAnxiety: moodAnxietyCorr,
        energyAnxiety: energyAnxietyCorr
      }),
      confidence: Math.min(0.9, entries.length * 0.05),
      severity: this.getProfileSeverity(profileType),
      actionable: profileType !== 'optimal',
      suggestion: this.getProfileSuggestion(profileType),
      correlations: {
        moodEnergy: moodEnergyCorr,
        moodAnxiety: moodAnxietyCorr,
        energyAnxiety: energyAnxietyCorr
      },
      profileType,
      data: {
        sampleSize: entries.length,
        averages: {
          mood: moods.reduce((a, b) => a + b, 0) / moods.length,
          energy: energies.reduce((a, b) => a + b, 0) / energies.length,
          anxiety: anxieties.reduce((a, b) => a + b, 0) / anxieties.length
        }
      }
    };

    patterns.push(pattern);
    return patterns;
  }

  // =============================================================================
  // WEEKLY CYCLE ANALYSIS
  // =============================================================================

  private async analyzeWeeklyCycles(entries: MoodEntry[]): Promise<WeeklyCyclePattern[]> {
    const patterns: WeeklyCyclePattern[] = [];
    
    // Group by day of week
    const dayMoods: Record<string, number[]> = {};
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    
    entries.forEach(entry => {
      // ✅ FIXED: Handle both timestamp and created_at fields, with fallback
      const dateValue = (entry as any).timestamp || (entry as any).created_at || Date.now();
      const dayOfWeek = new Date(dateValue).getDay();
      
      // Validate dayOfWeek is a valid number
      if (!isNaN(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6) {
        const dayName = dayNames[dayOfWeek];
        if (dayName) {
          if (!dayMoods[dayName]) dayMoods[dayName] = [];
          dayMoods[dayName].push(entry.mood_score);
        }
      }
    });

    // Calculate day averages
    const dayAverages: Record<string, number> = {};
    Object.entries(dayMoods).forEach(([day, moods]) => {
      if (moods.length > 0) {
        dayAverages[day] = moods.reduce((a, b) => a + b, 0) / moods.length;
      }
    });

    // Detect cycle patterns
    const mondayAvg = dayAverages['Pazartesi'];
    const weekendAvg = (dayAverages['Cumartesi'] + dayAverages['Pazar']) / 2;
    const midweekAvg = (dayAverages['Salı'] + dayAverages['Çarşamba'] + dayAverages['Perşembe']) / 3;

    let cycleType: WeeklyCyclePattern['cycleType'] = 'stable_week';
    let title = '';
    let description = '';

    if (mondayAvg && mondayAvg < 40 && mondayAvg < (weekendAvg - 15)) {
      cycleType = 'monday_blues';
      title = 'Pazartesi Sendromu';
      description = `Pazartesi günleri zorlu geçiyor (${mondayAvg.toFixed(1)} vs hafta sonu ${weekendAvg.toFixed(1)})`;
    } else if (weekendAvg && weekendAvg > 65 && weekendAvg > (midweekAvg + 10)) {
      cycleType = 'weekend_boost';
      title = 'Hafta Sonu Yükselişi';
      description = `Hafta sonları canlanıyorsunuz (${weekendAvg.toFixed(1)} vs hafta içi ${midweekAvg.toFixed(1)})`;
    } else if (midweekAvg && midweekAvg < 45 && midweekAvg < ((mondayAvg + weekendAvg) / 2 - 10)) {
      cycleType = 'midweek_dip';
      title = 'Çarşamba Çöküşü';
      description = `Hafta ortası düşüş yaşıyorsunuz (${midweekAvg.toFixed(1)})`;
    }

    if (cycleType !== 'stable_week') {
      patterns.push({
        type: 'weekly_cycle',
        cycleType,
        title,
        description,
        confidence: 0.75,
        severity: cycleType === 'monday_blues' ? 'medium' : 'low',
        actionable: cycleType === 'monday_blues' || cycleType === 'midweek_dip',
        suggestion: this.getWeeklyCycleSuggestion(cycleType),
        dayAverages,
        data: {
          mondayAvg,
          weekendAvg,
          midweekAvg,
          totalDataPoints: Object.values(dayMoods).reduce((sum, arr) => sum + arr.length, 0)
        }
      });
    }

    return patterns;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      denomX += deltaX * deltaX;
      denomY += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(denomX * denomY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((variance, value) => variance + Math.pow(value - mean, 2), 0) / values.length;
  }

  private determineEmotionalProfile(correlations: {
    moodEnergy: number;
    moodAnxiety: number;
    energyAnxiety: number;
  }): MEACorrelationPattern['profileType'] {
    const { moodEnergy, moodAnxiety, energyAnxiety } = correlations;

    // Strong positive mood-energy correlation + negative mood-anxiety = optimal
    if (moodEnergy > 0.5 && moodAnxiety < -0.3) return 'optimal';
    
    // Strong negative mood-energy + positive mood-anxiety = depression risk
    if (moodEnergy < -0.3 && moodAnxiety > 0.3) return 'depression_risk';
    
    // High energy-anxiety correlation = manic tendency
    if (energyAnxiety > 0.6) return 'manic_tendency';
    
    // Moderate correlations = balanced
    if (Math.abs(moodEnergy) < 0.4 && Math.abs(moodAnxiety) < 0.4) return 'balanced';
    
    return 'unstable';
  }

  private getProfileTitle(profileType: MEACorrelationPattern['profileType']): string {
    const titles = {
      optimal: 'Optimal Duygusal Denge',
      depression_risk: 'Depresif Eğilim Riski',
      manic_tendency: 'Yüksek Enerji Dalgalanması',
      balanced: 'Dengeli Duygusal Profil',
      unstable: 'Değişken Duygusal Durum'
    };
    return titles[profileType];
  }

  private getProfileDescription(profileType: MEACorrelationPattern['profileType'], correlations: any): string {
    switch (profileType) {
      case 'optimal':
        return 'Mood yüksek olduğunda enerji artıyor, anksiyete azalıyor - ideal durum';
      case 'depression_risk':
        return 'Düşük mood, düşük enerji ve yüksek anksiyete birlikte - dikkat gerekli';
      case 'manic_tendency':
        return 'Yüksek enerji ve anksiyete birlikte - dengeye odaklanın';
      case 'balanced':
        return 'Mood, enerji ve anksiyete bağımsız değişiyor - stabil durum';
      default:
        return 'Duygusal durumlar arasında tutarsız ilişkiler';
    }
  }

  private getProfileSeverity(profileType: MEACorrelationPattern['profileType']): MoodPattern['severity'] {
    switch (profileType) {
      case 'depression_risk': return 'high';
      case 'manic_tendency': return 'medium';
      case 'unstable': return 'medium';
      default: return 'low';
    }
  }

  private getProfileSuggestion(profileType: MEACorrelationPattern['profileType']): string {
    switch (profileType) {
      case 'depression_risk':
        return 'Enerji artırıcı aktiviteler (egzersiz, güneş ışığı) ve anksiyete azaltıcı teknikler uygulayın';
      case 'manic_tendency':
        return 'Sakinleştirici aktiviteler (meditasyon, yavaş nefes) ile dengeyi koruyun';
      case 'unstable':
        return 'Günlük rutinler oluşturup duygusal düzenlilik sağlayın';
      case 'balanced':
        return 'Mevcut dengenizi koruyun, güçlü yanlarınızı destekleyin';
      default:
        return 'Düzenli mood takibi ile pattern\'lerinizi keşfetmeye devam edin';
    }
  }

  private getWeeklyCycleSuggestion(cycleType: WeeklyCyclePattern['cycleType']): string {
    switch (cycleType) {
      case 'monday_blues':
        return 'Pazar akşamı hazırlık yapın: erken uyuyun, Pazartesi planını hazırlayın, motivasyon müziği dinleyin';
      case 'midweek_dip':
        return 'Çarşamba günleri için özel destek: arkadaş buluşması, favori aktivite, ödül sistemi';
      case 'weekend_boost':
        return 'Hafta sonu enerjinizi hafta içine taşıyın: keyifli aktiviteleri hafta içine yayın';
      default:
        return 'Haftalık dengenizi korumaya devam edin';
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const moodPatternAnalysisService = MoodPatternAnalysisService.getInstance();
export default moodPatternAnalysisService;
