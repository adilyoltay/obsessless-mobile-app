/**
 * 📊 Adaptive Suggestion Analytics Service
 * 
 * Tracks and analyzes the performance of JITAI/Adaptive Interventions:
 * - Success rates (click-through rates)  
 * - Dismissal patterns
 * - Category effectiveness
 * - Timing analytics
 * - User engagement trends
 * 
 * Privacy-compliant with data aggregation and retention policies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdaptiveSuggestion } from '../hooks/useAdaptiveSuggestion';

export interface SuggestionEvent {
  timestamp: number;
  userId: string; // Hashed for privacy
  category: string;
  confidence: number;
  eventType: 'shown' | 'clicked' | 'dismissed';
  timeOfDay: number; // Hour (0-23)
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  sessionDuration?: number; // How long user stayed after click
  targetScreen?: string;
  snoozeHours?: number;
}

export interface AnalyticsMetrics {
  // Overall metrics
  totalShown: number;
  totalClicked: number;
  totalDismissed: number;
  clickThroughRate: number;
  dismissalRate: number;
  
  // Category breakdown
  categoryMetrics: {
    [category: string]: {
      shown: number;
      clicked: number;
      dismissed: number;
      ctr: number; // Click-through rate
      avgConfidence: number;
    };
  };
  
  // Time-based insights
  timeMetrics: {
    bestHours: number[]; // Top 3 performing hours
    worstHours: number[]; // Bottom 3 performing hours
    bestDays: number[]; // Top performing days of week
  };
  
  // Engagement patterns
  engagementMetrics: {
    avgSessionDuration: number;
    returnUserRate: number; // Users who clicked multiple suggestions
    snoozedButReturned: number; // Users who snoozed then later clicked
  };
  
  // Trends (last 7 vs previous 7 days)
  trends: {
    ctrChange: number; // Percentage change in CTR
    dismissalChange: number;
    engagementChange: number;
  };
}

class AdaptiveSuggestionAnalytics {
  private static instance: AdaptiveSuggestionAnalytics;
  private readonly STORAGE_KEY = 'adaptive_suggestion_analytics';
  private readonly MAX_EVENTS = 1000; // Keep last 1000 events
  private readonly RETENTION_DAYS = 30; // 30 days retention

  private constructor() {}

  public static getInstance(): AdaptiveSuggestionAnalytics {
    if (!AdaptiveSuggestionAnalytics.instance) {
      AdaptiveSuggestionAnalytics.instance = new AdaptiveSuggestionAnalytics();
    }
    return AdaptiveSuggestionAnalytics.instance;
  }

  /**
   * 📝 Track suggestion event
   */
  async trackEvent(
    eventType: 'shown' | 'clicked' | 'dismissed',
    userId: string,
    suggestion: AdaptiveSuggestion,
    additionalData?: {
      sessionDuration?: number;
      snoozeHours?: number;
    }
  ): Promise<void> {
    try {
      const now = new Date();
      const event: SuggestionEvent = {
        timestamp: now.getTime(),
        userId: this.hashUserId(userId),
        category: suggestion.category || 'general',
        confidence: suggestion.confidence || 0.5,
        eventType,
        timeOfDay: now.getHours(),
        dayOfWeek: now.getDay(),
        targetScreen: suggestion.cta?.screen,
        sessionDuration: additionalData?.sessionDuration,
        snoozeHours: additionalData?.snoozeHours
      };

      const events = await this.getEvents();
      events.push(event);

      // Keep only recent events and within retention
      const filteredEvents = events
        .filter(e => e.timestamp > (Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000)))
        .slice(-this.MAX_EVENTS);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredEvents));
      
      console.log(`📊 Tracked adaptive suggestion event: ${eventType} for ${suggestion.category}`);
    } catch (error) {
      console.error('❌ Failed to track adaptive suggestion event:', error);
    }
  }

  /**
   * 📊 Get comprehensive analytics metrics
   */
  async getMetrics(days: number = 7): Promise<AnalyticsMetrics> {
    try {
      const events = await this.getEvents();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentEvents = events.filter(e => e.timestamp >= cutoffTime);

      return this.calculateMetrics(recentEvents, events);
    } catch (error) {
      console.error('❌ Failed to get analytics metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * 📈 Get category performance ranking
   */
  async getCategoryRanking(days: number = 7): Promise<Array<{
    category: string;
    ctr: number;
    shown: number;
    clicked: number;
    avgConfidence: number;
    rank: number;
  }>> {
    const metrics = await this.getMetrics(days);
    
    return Object.entries(metrics.categoryMetrics)
      .map(([category, data]) => ({
        category,
        ctr: data.ctr,
        shown: data.shown,
        clicked: data.clicked,
        avgConfidence: data.avgConfidence,
        rank: 0
      }))
      .sort((a, b) => b.ctr - a.ctr)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  /**
   * 🕐 Get optimal timing recommendations
   */
  async getOptimalTimingRecommendations(): Promise<{
    bestHours: Array<{ hour: number; ctr: number; label: string }>;
    bestDays: Array<{ day: number; ctr: number; label: string }>;
    quietHours: number[];
  }> {
    const events = await this.getEvents();
    
    // Hour-based analysis
    const hourMetrics: { [hour: number]: { shown: number; clicked: number } } = {};
    const dayMetrics: { [day: number]: { shown: number; clicked: number } } = {};

    events.forEach(event => {
      // Hour metrics
      if (!hourMetrics[event.timeOfDay]) {
        hourMetrics[event.timeOfDay] = { shown: 0, clicked: 0 };
      }
      if (event.eventType === 'shown') hourMetrics[event.timeOfDay].shown++;
      if (event.eventType === 'clicked') hourMetrics[event.timeOfDay].clicked++;

      // Day metrics
      if (!dayMetrics[event.dayOfWeek]) {
        dayMetrics[event.dayOfWeek] = { shown: 0, clicked: 0 };
      }
      if (event.eventType === 'shown') dayMetrics[event.dayOfWeek].shown++;
      if (event.eventType === 'clicked') dayMetrics[event.dayOfWeek].clicked++;
    });

    const getDayLabel = (day: number): string => {
      const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      return days[day];
    };

    const getHourLabel = (hour: number): string => {
      if (hour >= 6 && hour < 12) return 'Sabah';
      if (hour >= 12 && hour < 17) return 'Öğleden Sonra';
      if (hour >= 17 && hour < 21) return 'Akşam';
      return 'Gece';
    };

    const bestHours = Object.entries(hourMetrics)
      .map(([hour, metrics]) => ({
        hour: parseInt(hour),
        ctr: metrics.shown > 0 ? metrics.clicked / metrics.shown : 0,
        label: getHourLabel(parseInt(hour))
      }))
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 6);

    const bestDays = Object.entries(dayMetrics)
      .map(([day, metrics]) => ({
        day: parseInt(day),
        ctr: metrics.shown > 0 ? metrics.clicked / metrics.shown : 0,
        label: getDayLabel(parseInt(day))
      }))
      .sort((a, b) => b.ctr - a.ctr);

    // Identify quiet hours (very low CTR)
    const quietHours = Object.entries(hourMetrics)
      .filter(([_, metrics]) => {
        const ctr = metrics.shown > 0 ? metrics.clicked / metrics.shown : 0;
        return ctr < 0.1 && metrics.shown > 5; // Less than 10% CTR with enough data
      })
      .map(([hour]) => parseInt(hour));

    return { bestHours, bestDays, quietHours };
  }

  /**
   * 🧮 Calculate comprehensive metrics
   */
  private calculateMetrics(recentEvents: SuggestionEvent[], allEvents: SuggestionEvent[]): AnalyticsMetrics {
    const shown = recentEvents.filter(e => e.eventType === 'shown');
    const clicked = recentEvents.filter(e => e.eventType === 'clicked');
    const dismissed = recentEvents.filter(e => e.eventType === 'dismissed');

    const ctr = shown.length > 0 ? clicked.length / shown.length : 0;
    const dismissalRate = shown.length > 0 ? dismissed.length / shown.length : 0;

    // Category metrics
    const categories = [...new Set(recentEvents.map(e => e.category))];
    const categoryMetrics: AnalyticsMetrics['categoryMetrics'] = {};

    categories.forEach(category => {
      const catShown = shown.filter(e => e.category === category);
      const catClicked = clicked.filter(e => e.category === category);
      const catDismissed = dismissed.filter(e => e.category === category);
      
      categoryMetrics[category] = {
        shown: catShown.length,
        clicked: catClicked.length,
        dismissed: catDismissed.length,
        ctr: catShown.length > 0 ? catClicked.length / catShown.length : 0,
        avgConfidence: catShown.length > 0 
          ? catShown.reduce((sum, e) => sum + e.confidence, 0) / catShown.length 
          : 0
      };
    });

    // Time metrics
    const hourCTRs: { [hour: number]: number } = {};
    for (let hour = 0; hour < 24; hour++) {
      const hourShown = shown.filter(e => e.timeOfDay === hour);
      const hourClicked = clicked.filter(e => e.timeOfDay === hour);
      hourCTRs[hour] = hourShown.length > 0 ? hourClicked.length / hourShown.length : 0;
    }

    const sortedHours = Object.entries(hourCTRs).sort((a, b) => b[1] - a[1]);
    const bestHours = sortedHours.slice(0, 3).map(([hour]) => parseInt(hour));
    const worstHours = sortedHours.slice(-3).map(([hour]) => parseInt(hour));

    // Day metrics
    const dayCTRs: { [day: number]: number } = {};
    for (let day = 0; day < 7; day++) {
      const dayShown = shown.filter(e => e.dayOfWeek === day);
      const dayClicked = clicked.filter(e => e.dayOfWeek === day);
      dayCTRs[day] = dayShown.length > 0 ? dayClicked.length / dayShown.length : 0;
    }
    const bestDays = Object.entries(dayCTRs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    // Engagement metrics
    const sessionsWithDuration = clicked.filter(e => e.sessionDuration);
    const avgSessionDuration = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, e) => sum + (e.sessionDuration || 0), 0) / sessionsWithDuration.length
      : 0;

    const uniqueUsers = [...new Set(recentEvents.map(e => e.userId))];
    const returnUsers = uniqueUsers.filter(userId => 
      clicked.filter(e => e.userId === userId).length > 1
    );
    const returnUserRate = uniqueUsers.length > 0 ? returnUsers.length / uniqueUsers.length : 0;

    const snoozedUsers = [...new Set(dismissed.filter(e => e.snoozeHours).map(e => e.userId))];
    const snoozedButReturned = snoozedUsers.filter(userId =>
      clicked.some(e => e.userId === userId && e.timestamp > 
        Math.max(...dismissed.filter(d => d.userId === userId).map(d => d.timestamp))
      )
    ).length;

    // Trends (compare with previous period)
    const previousPeriodStart = Date.now() - (14 * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const previousEvents = allEvents.filter(e => 
      e.timestamp >= previousPeriodStart && e.timestamp < previousPeriodEnd
    );

    const prevShown = previousEvents.filter(e => e.eventType === 'shown').length;
    const prevClicked = previousEvents.filter(e => e.eventType === 'clicked').length;
    const prevDismissed = previousEvents.filter(e => e.eventType === 'dismissed').length;

    const prevCTR = prevShown > 0 ? prevClicked / prevShown : 0;
    const prevDismissalRate = prevShown > 0 ? prevDismissed / prevShown : 0;

    const ctrChange = prevCTR > 0 ? ((ctr - prevCTR) / prevCTR) * 100 : 0;
    const dismissalChange = prevDismissalRate > 0 ? ((dismissalRate - prevDismissalRate) / prevDismissalRate) * 100 : 0;

    // Calculate previous period engagement metrics
    const prevClickedEvents = previousEvents.filter(e => e.eventType === 'clicked');
    const prevSessionsWithDuration = prevClickedEvents.filter(e => e.sessionDuration);
    const prevAvgSessionDuration = prevSessionsWithDuration.length > 0
      ? prevSessionsWithDuration.reduce((sum, e) => sum + (e.sessionDuration || 0), 0) / prevSessionsWithDuration.length
      : 0;

    const prevUniqueUsers = [...new Set(previousEvents.map(e => e.userId))];
    const prevReturnUsers = prevUniqueUsers.filter(userId => 
      prevClickedEvents.filter(e => e.userId === userId).length > 1
    );
    const prevReturnUserRate = prevUniqueUsers.length > 0 ? prevReturnUsers.length / prevUniqueUsers.length : 0;

    const prevDismissedEvents = previousEvents.filter(e => e.eventType === 'dismissed');
    const prevSnoozedUsers = [...new Set(prevDismissedEvents.filter(e => e.snoozeHours).map(e => e.userId))];
    const prevSnoozedButReturned = prevSnoozedUsers.filter(userId =>
      prevClickedEvents.some(e => e.userId === userId && e.timestamp > 
        Math.max(...prevDismissedEvents.filter(d => d.userId === userId).map(d => d.timestamp))
      )
    ).length;

    // Calculate engagement change as weighted average of multiple factors
    let engagementChange = 0;
    let weightSum = 0;

    // 1. Session duration change (weight: 0.4)
    if (prevAvgSessionDuration > 0 && avgSessionDuration > 0) {
      const sessionDurationChange = ((avgSessionDuration - prevAvgSessionDuration) / prevAvgSessionDuration) * 100;
      engagementChange += sessionDurationChange * 0.4;
      weightSum += 0.4;
    }

    // 2. Return user rate change (weight: 0.35)
    if (prevReturnUserRate > 0 && returnUserRate > 0) {
      const returnRateChange = ((returnUserRate - prevReturnUserRate) / prevReturnUserRate) * 100;
      engagementChange += returnRateChange * 0.35;
      weightSum += 0.35;
    }

    // 3. Snoozed but returned change (weight: 0.25)
    if (prevSnoozedButReturned > 0 && snoozedButReturned > 0) {
      const snoozeReturnChange = ((snoozedButReturned - prevSnoozedButReturned) / prevSnoozedButReturned) * 100;
      engagementChange += snoozeReturnChange * 0.25;
      weightSum += 0.25;
    }

    // Normalize by actual weights used
    engagementChange = weightSum > 0 ? engagementChange / weightSum : 0;

    return {
      totalShown: shown.length,
      totalClicked: clicked.length,
      totalDismissed: dismissed.length,
      clickThroughRate: ctr,
      dismissalRate,
      categoryMetrics,
      timeMetrics: {
        bestHours,
        worstHours,
        bestDays
      },
      engagementMetrics: {
        avgSessionDuration,
        returnUserRate,
        snoozedButReturned
      },
      trends: {
        ctrChange,
        dismissalChange,
        engagementChange // Calculated above as weighted average of engagement metrics
      }
    };
  }

  /**
   * 🗄️ Get stored events
   */
  private async getEvents(): Promise<SuggestionEvent[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored analytics events:', error);
      return [];
    }
  }

  /**
   * 🔐 Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    // Simple hash function for privacy (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 📊 Get empty metrics structure
   */
  private getEmptyMetrics(): AnalyticsMetrics {
    return {
      totalShown: 0,
      totalClicked: 0,
      totalDismissed: 0,
      clickThroughRate: 0,
      dismissalRate: 0,
      categoryMetrics: {},
      timeMetrics: {
        bestHours: [],
        worstHours: [],
        bestDays: []
      },
      engagementMetrics: {
        avgSessionDuration: 0,
        returnUserRate: 0,
        snoozedButReturned: 0
      },
      trends: {
        ctrChange: 0,
        dismissalChange: 0,
        engagementChange: 0
      }
    };
  }

  /**
   * 🧹 Clear old analytics data
   */
  async clearOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const events = await this.getEvents();
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const filteredEvents = events.filter(e => e.timestamp > cutoffTime);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredEvents));
      console.log(`🧹 Cleared analytics data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('❌ Failed to clear old analytics data:', error);
    }
  }
}

export const adaptiveSuggestionAnalytics = AdaptiveSuggestionAnalytics.getInstance();
export default adaptiveSuggestionAnalytics;
