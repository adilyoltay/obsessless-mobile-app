/**
 * 🚨 Background Crisis Monitor - Real-time Pattern Analysis
 * 
 * Bu servis arka planda çalışarak kullanıcı davranışlarını analiz eder
 * ve potansiyel kriz durumlarını tespit eder.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  CrisisRiskLevel,
  AIEventType 
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_CRISIS_TASK = 'background-crisis-monitor';
const MONITORING_INTERVAL = 15 * 60; // 15 dakika

export interface CrisisPattern {
  id: string;
  userId: string;
  timestamp: Date;
  indicators: {
    compulsionFrequency: number;
    resistanceRate: number;
    moodScore: number;
    sleepQuality: number;
    socialIsolation: boolean;
    medicationAdherence: boolean;
  };
  riskScore: number;
  riskLevel: CrisisRiskLevel;
  interventionNeeded: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: 'therapist' | 'family' | 'friend' | 'emergency';
  autoAlert: boolean;
  priority: number;
}

class BackgroundCrisisMonitor {
  private static instance: BackgroundCrisisMonitor;
  private isMonitoring: boolean = false;
  private emergencyContacts: EmergencyContact[] = [];
  private lastCheckTime: Date | null = null;
  private riskHistory: CrisisPattern[] = [];

  private constructor() {}

  static getInstance(): BackgroundCrisisMonitor {
    if (!BackgroundCrisisMonitor.instance) {
      BackgroundCrisisMonitor.instance = new BackgroundCrisisMonitor();
    }
    return BackgroundCrisisMonitor.instance;
  }

  /**
   * 🚀 Background monitoring başlat
   */
  async startMonitoring(userId: string): Promise<void> {
    if (!FEATURE_FLAGS.isEnabled('AI_CRISIS_DETECTION')) return;

    if (this.isMonitoring) {
      if (__DEV__) console.log('📊 Background monitoring already active');
      return;
    }

    try {
      // Register background task
      await this.registerBackgroundTask();
      
      // Load emergency contacts
      await this.loadEmergencyContacts(userId);
      
      // Start monitoring
      this.isMonitoring = true;
      this.lastCheckTime = new Date();
      
      if (__DEV__) console.log('🚨 Background crisis monitoring started');
      
      // Legacy crisis monitoring event removed
      
    } catch (error) {
      if (__DEV__) console.error('❌ Failed to start background monitoring:', error);
      this.isMonitoring = false;
    }
  }

  /**
   * 🛑 Background monitoring durdur
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;
    
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_CRISIS_TASK);
      this.isMonitoring = false;
      if (__DEV__) console.log('🛑 Background crisis monitoring stopped');
    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error);
    }
  }

  /**
   * 📊 Analyze user patterns for crisis indicators
   */
  async analyzePatterns(userId: string): Promise<CrisisPattern> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get recent data
    const compulsions = await this.getRecentCompulsions(userId, dayAgo);
    const moods = await this.getRecentMoods(userId, dayAgo);
    const sleepData = await this.getSleepData(userId);
    const socialData = await this.getSocialInteractionData(userId);
    const medicationData = await this.getMedicationAdherence(userId);
    
    // Calculate indicators
    const indicators = {
      compulsionFrequency: this.calculateCompulsionFrequency(compulsions),
      resistanceRate: this.calculateResistanceRate(compulsions),
      moodScore: this.calculateAverageMood(moods),
      sleepQuality: sleepData.quality || 5,
      socialIsolation: socialData.isIsolated || false,
      medicationAdherence: medicationData.adherence || true
    };
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(indicators);
    const riskLevel = this.determineRiskLevel(riskScore);
    
    const pattern: CrisisPattern = {
      id: `pattern_${Date.now()}`,
      userId,
      timestamp: now,
      indicators,
      riskScore,
      riskLevel,
      interventionNeeded: riskLevel >= CrisisRiskLevel.HIGH
    };
    
    // Store pattern
    this.riskHistory.push(pattern);
    if (this.riskHistory.length > 100) {
      this.riskHistory.shift(); // Keep only last 100 patterns
    }
    
    // Check if intervention needed
    if (pattern.interventionNeeded) {
      await this.triggerIntervention(pattern);
    }
    
    return pattern;
  }

  /**
   * 🚨 Trigger crisis intervention
   */
  private async triggerIntervention(pattern: CrisisPattern): Promise<void> {
    console.log('🚨 Crisis intervention triggered:', pattern.riskLevel);
    
    // Track generic preventive intervention instead of crisis-specific event
    await trackAIInteraction(AIEventType.PREVENTIVE_INTERVENTION_TRIGGERED, {
      riskLevel: pattern.riskLevel,
      indicators: pattern.indicators
    });
    
    // Send notifications based on risk level
    switch (pattern.riskLevel) {
      case CrisisRiskLevel.CRITICAL:
        await this.handleCriticalRisk(pattern);
        break;
      case CrisisRiskLevel.HIGH:
        await this.handleHighRisk(pattern);
        break;
      case CrisisRiskLevel.MEDIUM:
        await this.handleMediumRisk(pattern);
        break;
      default:
        break;
    }
  }

  /**
   * 🆘 Handle critical risk situation
   */
  private async handleCriticalRisk(pattern: CrisisPattern): Promise<void> {
    // Notify emergency contacts immediately
    const emergencyContacts = this.emergencyContacts.filter(
      c => c.autoAlert && c.relationship === 'emergency'
    );
    
    for (const contact of emergencyContacts) {
      await this.notifyEmergencyContact(contact, pattern);
    }
    
    // Send urgent notification to user
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🆘 Acil Destek Gerekli',
        body: 'Lütfen hemen yardım alın. Acil durumlar için 112\'yi arayabilirsiniz.',
        data: { 
          type: 'crisis_alert',
          level: 'critical',
          patternId: pattern.id
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX
      },
      trigger: null // Immediate
    });
  }

  /**
   * ⚠️ Handle high risk situation
   */
  private async handleHighRisk(pattern: CrisisPattern): Promise<void> {
    // Notify therapist if available
    const therapist = this.emergencyContacts.find(
      c => c.relationship === 'therapist' && c.autoAlert
    );
    
    if (therapist) {
      await this.notifyEmergencyContact(therapist, pattern);
    }
    
    // Send supportive notification to user
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💙 Yanınızdayız',
        body: 'Zor bir dönemden geçiyor gibisiniz. Destek almak için uygulamayı açın.',
        data: { 
          type: 'crisis_alert',
          level: 'high',
          patternId: pattern.id
        },
        sound: true
      },
      trigger: null
    });
  }

  /**
   * 📱 Handle medium risk situation
   */
  private async handleMediumRisk(pattern: CrisisPattern): Promise<void> {
    // Send gentle reminder
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌟 Kendinize İyi Bakın',
        body: 'Bugün biraz egzersiz yapmaya ne dersiniz? Size iyi gelecektir.',
        data: { 
          type: 'crisis_alert',
          level: 'medium',
          patternId: pattern.id
        }
      },
      trigger: null
    });
  }

  /**
   * 📞 Notify emergency contact
   */
  private async notifyEmergencyContact(
    contact: EmergencyContact, 
    pattern: CrisisPattern
  ): Promise<void> {
    // In production, this would send SMS or make API call
    console.log(`📞 Notifying ${contact.name} about crisis level: ${pattern.riskLevel}`);
    
    // Store notification log
    await AsyncStorage.setItem(
      `emergency_notification_${Date.now()}`,
      JSON.stringify({
        contactId: contact.id,
        patternId: pattern.id,
        timestamp: new Date(),
        riskLevel: pattern.riskLevel
      })
    );
  }

  /**
   * 📊 Calculate risk score from indicators
   */
  private calculateRiskScore(indicators: CrisisPattern['indicators']): number {
    let score = 0;
    
    // Compulsion frequency (0-30 points)
    if (indicators.compulsionFrequency > 10) score += 30;
    else if (indicators.compulsionFrequency > 5) score += 20;
    else if (indicators.compulsionFrequency > 2) score += 10;
    
    // Resistance rate (0-20 points) - lower is worse
    if (indicators.resistanceRate < 0.2) score += 20;
    else if (indicators.resistanceRate < 0.5) score += 10;
    
    // Mood score (0-25 points) - lower is worse
    if (indicators.moodScore < 3) score += 25;
    else if (indicators.moodScore < 5) score += 15;
    else if (indicators.moodScore < 7) score += 5;
    
    // Sleep quality (0-10 points) - lower is worse
    if (indicators.sleepQuality < 3) score += 10;
    else if (indicators.sleepQuality < 5) score += 5;
    
    // Social isolation (0-10 points)
    if (indicators.socialIsolation) score += 10;
    
    // Medication non-adherence (0-5 points)
    if (!indicators.medicationAdherence) score += 5;
    
    return score;
  }

  /**
   * 🎯 Determine risk level from score
   */
  private determineRiskLevel(score: number): CrisisRiskLevel {
    if (score >= 70) return CrisisRiskLevel.CRITICAL;
    if (score >= 50) return CrisisRiskLevel.HIGH;
    if (score >= 30) return CrisisRiskLevel.MEDIUM;
    if (score >= 15) return CrisisRiskLevel.LOW;
    return CrisisRiskLevel.NONE;
  }

  /**
   * 📝 Register background task
   */
  private async registerBackgroundTask(): Promise<void> {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_CRISIS_TASK, {
      minimumInterval: MONITORING_INTERVAL,
      stopOnTerminate: false,
      startOnBoot: true
    });
  }

  /**
   * 👥 Load emergency contacts
   */
  private async loadEmergencyContacts(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`emergency_contacts_${userId}`);
      if (stored) {
        this.emergencyContacts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
    }
  }

  /**
   * 👥 Save emergency contacts
   */
  async saveEmergencyContacts(userId: string, contacts: EmergencyContact[]): Promise<void> {
    this.emergencyContacts = contacts;
    await AsyncStorage.setItem(
      `emergency_contacts_${userId}`,
      JSON.stringify(contacts)
    );
  }

  // Helper methods for data retrieval
  private async getRecentCompulsions(userId: string, since: Date): Promise<any[]> {
    const key = `compulsions_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];
    
    const compulsions = JSON.parse(stored);
    return compulsions.filter((c: any) => new Date(c.timestamp) > since);
  }

  private async getRecentMoods(userId: string, since: Date): Promise<any[]> {
    const key = `moods_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];
    
    const moods = JSON.parse(stored);
    return moods.filter((m: any) => new Date(m.timestamp) > since);
  }

  private async getSleepData(userId: string): Promise<{ quality: number }> {
    // Placeholder - would integrate with health tracking
    return { quality: 7 };
  }

  private async getSocialInteractionData(userId: string): Promise<{ isIsolated: boolean }> {
    // Placeholder - would analyze app usage patterns
    return { isIsolated: false };
  }

  private async getMedicationAdherence(userId: string): Promise<{ adherence: boolean }> {
    // Placeholder - would track medication logs
    return { adherence: true };
  }

  private calculateCompulsionFrequency(compulsions: any[]): number {
    return compulsions.length;
  }

  private calculateResistanceRate(compulsions: any[]): number {
    if (compulsions.length === 0) return 1;
    const resisted = compulsions.filter(c => c.resisted).length;
    return resisted / compulsions.length;
  }

  private calculateAverageMood(moods: any[]): number {
    if (moods.length === 0) return 5;
    const sum = moods.reduce((acc, m) => acc + (m.score || 5), 0);
    return sum / moods.length;
  }

  /**
   * 📊 Get risk trend
   */
  getRiskTrend(): 'improving' | 'stable' | 'worsening' {
    if (this.riskHistory.length < 3) return 'stable';
    
    const recent = this.riskHistory.slice(-3);
    const scores = recent.map(p => p.riskScore);
    
    const isIncreasing = scores[1] > scores[0] && scores[2] > scores[1];
    const isDecreasing = scores[1] < scores[0] && scores[2] < scores[1];
    
    if (isIncreasing) return 'worsening';
    if (isDecreasing) return 'improving';
    return 'stable';
  }
}

// Task definition for background monitoring
TaskManager.defineTask(BACKGROUND_CRISIS_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }

  try {
    const monitor = BackgroundCrisisMonitor.getInstance();
    // Get current user ID from AsyncStorage
    const userId = await AsyncStorage.getItem('current_user_id');
    
    if (userId) {
      await monitor.analyzePatterns(userId);
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background monitoring failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const backgroundCrisisMonitor = BackgroundCrisisMonitor.getInstance();
export default backgroundCrisisMonitor;
