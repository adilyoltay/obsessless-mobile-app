/**
 * Offline Mood Insights Service
 * 
 * Post-AI cleanup için Today screen'de gösterilecek basit insights.
 * Rule-based analysis, no external AI calls, offline-first.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry } from '@/services/moodTrackingService';

interface MoodInsight {
  id: string;
  type: 'trend' | 'achievement' | 'suggestion' | 'pattern';
  title: string;
  description: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  actionable?: boolean;
  data?: any;
}

interface MoodStats {
  totalEntries: number;
  avgMood: number;
  avgEnergy: number;
  avgAnxiety: number;
  streak: number;
  entriesThisWeek: number;
  lastEntryDate?: string;
  moodTrend: 'improving' | 'declining' | 'stable';
  energyTrend: 'improving' | 'declining' | 'stable';
  anxietyTrend: 'improving' | 'declining' | 'stable';
}

class OfflineMoodInsightsService {
  private static instance: OfflineMoodInsightsService;
  
  public static getInstance(): OfflineMoodInsightsService {
    if (!OfflineMoodInsightsService.instance) {
      OfflineMoodInsightsService.instance = new OfflineMoodInsightsService();
    }
    return OfflineMoodInsightsService.instance;
  }

  /**
   * Get recent mood entries from AsyncStorage
   */
  private async getRecentMoodEntries(userId: string, days: number = 30): Promise<MoodEntry[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const moodKeys = allKeys.filter(key => key.startsWith(`mood_entries_${userId}_`));
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const allEntries: MoodEntry[] = [];
      
      for (const key of moodKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const entries = JSON.parse(data);
            // Handle both encrypted and plain formats
            const plainEntries = Array.isArray(entries) ? 
              entries.map((e: any) => e.metadata || e).filter((e: any) => e.timestamp) : 
              [];
            
            // Filter by date
            const recentEntries = plainEntries.filter((entry: MoodEntry) => {
              const entryDate = new Date(entry.timestamp);
              return entryDate >= cutoffDate;
            });
            
            allEntries.push(...recentEntries);
          }
        } catch (error) {
          console.warn(`Failed to parse mood key ${key}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      console.log(`📊 Found ${allEntries.length} mood entries from last ${days} days`);
      return allEntries;
    } catch (error) {
      console.error('Failed to get recent mood entries:', error);
      return [];
    }
  }

  /**
   * Calculate mood statistics
   */
  private calculateMoodStats(entries: MoodEntry[]): MoodStats {
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        avgMood: 0,
        avgEnergy: 0,
        avgAnxiety: 0,
        streak: 0,
        entriesThisWeek: 0,
        moodTrend: 'stable',
        energyTrend: 'stable',
        anxietyTrend: 'stable'
      };
    }

    // Basic averages
    const avgMood = Math.round(entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length);
    const avgEnergy = Math.round(entries.reduce((sum, e) => sum + e.energy_level, 0) / entries.length);
    const avgAnxiety = Math.round(entries.reduce((sum, e) => sum + e.anxiety_level, 0) / entries.length);

    // Current streak calculation
    const streak = this.calculateCurrentStreak(entries);

    // Entries this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const entriesThisWeek = entries.filter(e => new Date(e.timestamp) >= oneWeekAgo).length;

    // Trend analysis (simple: first half vs second half)
    const trends = this.calculateTrends(entries);

    return {
      totalEntries: entries.length,
      avgMood,
      avgEnergy,
      avgAnxiety,
      streak,
      entriesThisWeek,
      lastEntryDate: entries[0]?.timestamp,
      moodTrend: trends.mood,
      energyTrend: trends.energy,
      anxietyTrend: trends.anxiety
    };
  }

  /**
   * Calculate current streak
   */
  private calculateCurrentStreak(entries: MoodEntry[]): number {
    if (entries.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    for (let i = 0; i < sortedEntries.length; i++) {
      const entryDate = new Date(sortedEntries[i].timestamp);
      const daysDiff = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === i || (i === 0 && daysDiff <= 1)) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate trends (improving/declining/stable)
   */
  private calculateTrends(entries: MoodEntry[]): {
    mood: 'improving' | 'declining' | 'stable';
    energy: 'improving' | 'declining' | 'stable';
    anxiety: 'improving' | 'declining' | 'stable';
  } {
    if (entries.length < 4) {
      return { mood: 'stable', energy: 'stable', anxiety: 'stable' };
    }

    const midpoint = Math.floor(entries.length / 2);
    const recent = entries.slice(0, midpoint); // More recent half
    const older = entries.slice(midpoint); // Older half

    const recentAvgMood = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
    const olderAvgMood = older.reduce((sum, e) => sum + e.mood_score, 0) / older.length;

    const recentAvgEnergy = recent.reduce((sum, e) => sum + e.energy_level, 0) / recent.length;
    const olderAvgEnergy = older.reduce((sum, e) => sum + e.energy_level, 0) / older.length;

    const recentAvgAnxiety = recent.reduce((sum, e) => sum + e.anxiety_level, 0) / recent.length;
    const olderAvgAnxiety = older.reduce((sum, e) => sum + e.anxiety_level, 0) / older.length;

    const getTrend = (recent: number, older: number) => {
      const diff = recent - older;
      if (Math.abs(diff) < 5) return 'stable';
      return diff > 0 ? 'improving' : 'declining';
    };

    return {
      mood: getTrend(recentAvgMood, olderAvgMood),
      energy: getTrend(recentAvgEnergy, olderAvgEnergy),
      anxiety: getTrend(olderAvgAnxiety, recentAvgAnxiety) // Inverted: lower anxiety = improving
    };
  }

  /**
   * Generate insights for Today screen
   */
  public async generateTodayInsights(userId: string): Promise<MoodInsight[]> {
    try {
      const entries = await this.getRecentMoodEntries(userId, 14); // Last 2 weeks
      const stats = this.calculateMoodStats(entries);
      const insights: MoodInsight[] = [];

      // 1. Streak insight
      if (stats.streak > 0) {
        insights.push({
          id: 'streak',
          type: 'achievement',
          title: `${stats.streak} Günlük Seri! 🔥`,
          description: stats.streak >= 7 
            ? 'Muhteşem! Bu tutarlılık gerçekten değerli.'
            : 'Harika başlangıç! Devam et.',
          icon: 'fire',
          priority: 'high',
          actionable: false,
          data: { streak: stats.streak }
        });
      }

      // 2. Mood trend insight  
      if (stats.totalEntries >= 5) {
        if (stats.moodTrend === 'improving') {
          insights.push({
            id: 'mood-improving',
            type: 'trend',
            title: 'Mood\'un Yükseliyor! 📈',
            description: `Son ${stats.totalEntries} kayıtta genel iyileşme görülüyor. Ortalama: ${stats.avgMood}/100`,
            icon: 'trending-up',
            priority: 'high',
            actionable: false
          });
        } else if (stats.moodTrend === 'declining') {
          insights.push({
            id: 'mood-support',
            type: 'suggestion',
            title: 'Destekleyici Aktiviteler 💙',
            description: 'Son günlerde mood biraz düşük. Nefes egzersizi veya kısa yürüyüş deneyebilirsin.',
            icon: 'heart',
            priority: 'medium',
            actionable: true
          });
        }
      }

      // 3. Activity suggestion
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find(e => e.timestamp.startsWith(today));
      
      if (!todayEntry && stats.streak > 0) {
        insights.push({
          id: 'daily-checkin',
          type: 'suggestion',
          title: 'Günlük Check-in Zamanı ⏰',
          description: `${stats.streak} günlük serini devam ettirmek için bugün nasıl hissettiğini kaydet.`,
          icon: 'clipboard-check',
          priority: 'medium',
          actionable: true
        });
      }

      // 4. Weekly summary
      if (stats.entriesThisWeek >= 3) {
        insights.push({
          id: 'weekly-summary',
          type: 'pattern',
          title: 'Bu Hafta: Aktif Takip! 📊',
          description: `${stats.entriesThisWeek} kayıt yaptın. Mood ortalaması: ${stats.avgMood}, Enerji: ${stats.avgEnergy}`,
          icon: 'chart-line',
          priority: 'low',
          actionable: false
        });
      }

      // 5. Energy pattern
      if (stats.avgEnergy < 3 && stats.totalEntries >= 3) {
        insights.push({
          id: 'energy-boost',
          type: 'suggestion', 
          title: 'Enerji Desteği Önerisi ⚡',
          description: 'Son kayıtlarda enerji seviyesi düşük. Düzenli uyku ve hafif egzersiz faydalı olabilir.',
          icon: 'battery-low',
          priority: 'medium',
          actionable: true
        });
      }

      // 6. Consistency recognition
      if (stats.entriesThisWeek >= 5) {
        insights.push({
          id: 'consistency',
          type: 'achievement',
          title: 'Tutarlılık Şampiyonu! 🏆',
          description: 'Bu hafta çok düzenli kayıt yaptın. Bu alışkanlık mood\'unu takip etmeni kolaylaştırıyor.',
          icon: 'trophy',
          priority: 'high',
          actionable: false
        });
      }

      // Sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
      
      // Return max 3 insights for clean UI
      return insights.slice(0, 3);

    } catch (error) {
      console.error('Failed to generate today insights:', error);
      return [
        {
          id: 'fallback',
          type: 'suggestion',
          title: 'Mood Takip Zamanı 📝',
          description: 'Bugün nasıl hissettiğini kaydetmeye hazır mısın?',
          icon: 'plus-circle',
          priority: 'medium',
          actionable: true
        }
      ];
    }
  }

  /**
   * Get mood summary for week
   */
  public async getWeeklySummary(userId: string): Promise<{
    entriesCount: number;
    avgScores: { mood: number; energy: number; anxiety: number };
    bestDay?: string;
    trends: {
      mood: 'improving' | 'declining' | 'stable';
      energy: 'improving' | 'declining' | 'stable';
      anxiety: 'improving' | 'declining' | 'stable';
    };
  }> {
    try {
      const entries = await this.getRecentMoodEntries(userId, 7);
      const stats = this.calculateMoodStats(entries);
      
      // Find best mood day
      let bestDay: string | undefined;
      if (entries.length > 0) {
        const bestEntry = entries.reduce((best, current) => 
          current.mood_score > best.mood_score ? current : best
        );
        bestDay = new Date(bestEntry.timestamp).toLocaleDateString('tr-TR', { 
          weekday: 'long' 
        });
      }

      return {
        entriesCount: stats.entriesThisWeek,
        avgScores: {
          mood: stats.avgMood,
          energy: stats.avgEnergy,
          anxiety: stats.avgAnxiety
        },
        bestDay,
        trends: {
          mood: stats.moodTrend,
          energy: stats.energyTrend,
          anxiety: stats.anxietyTrend
        }
      };
    } catch (error) {
      console.error('Failed to get weekly summary:', error);
      return {
        entriesCount: 0,
        avgScores: { mood: 0, energy: 0, anxiety: 0 },
        trends: { mood: 'stable', energy: 'stable', anxiety: 'stable' }
      };
    }
  }

  /**
   * Get simple mood patterns (no AI)
   */
  public async getMoodPatterns(userId: string): Promise<{
    timeOfDayPattern?: string;
    weekdayPattern?: string;
    commonTriggers: string[];
    insights: string[];
  }> {
    try {
      const entries = await this.getRecentMoodEntries(userId, 21); // 3 weeks
      
      if (entries.length < 5) {
        return {
          commonTriggers: [],
          insights: ['Daha fazla veri için düzenli kayıt yapmaya devam et']
        };
      }

      // Time of day analysis
      const morningEntries = entries.filter(e => {
        const hour = new Date(e.timestamp).getHours();
        return hour >= 6 && hour < 12;
      });
      
      const afternoonEntries = entries.filter(e => {
        const hour = new Date(e.timestamp).getHours();  
        return hour >= 12 && hour < 18;
      });

      const eveningEntries = entries.filter(e => {
        const hour = new Date(e.timestamp).getHours();
        return hour >= 18 || hour < 6;
      });

      let timeOfDayPattern: string | undefined;
      if (morningEntries.length > afternoonEntries.length && morningEntries.length > eveningEntries.length) {
        timeOfDayPattern = 'Sabah kayıtların daha yaygın - güne erken başlamayı seviyorsun!';
      } else if (eveningEntries.length > morningEntries.length) {
        timeOfDayPattern = 'Akşam kayıtların daha çok - günü değerlendirme alışkanlığın var.';
      }

      // Common triggers analysis
      const allTriggers = entries.flatMap(e => e.triggers || []);
      const triggerCounts: { [key: string]: number } = {};
      
      allTriggers.forEach(trigger => {
        triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      });

      const commonTriggers = Object.entries(triggerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([trigger]) => trigger);

      // Generate insights
      const insights: string[] = [];
      
      if (timeOfDayPattern) {
        insights.push(timeOfDayPattern);
      }
      
      if (commonTriggers.length > 0) {
        insights.push(`En sık karşılaştığın tetikleyici: ${commonTriggers[0]}`);
      }

      const avgMood = entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length;
      if (avgMood >= 70) {
        insights.push('Genel mood durumun oldukça iyi! Devam et.');
      } else if (avgMood <= 40) {
        insights.push('Zor bir dönemden geçiyor olabilirsin. Kendine nazik davran.');
      }

      return {
        timeOfDayPattern,
        commonTriggers,
        insights
      };
    } catch (error) {
      console.error('Failed to get mood patterns:', error);
      return {
        commonTriggers: [],
        insights: ['Pattern analizi için daha fazla veri gerekli']
      };
    }
  }

  /**
   * Get actionable suggestions based on recent data
   */
  public async getActionableSuggestions(userId: string): Promise<MoodInsight[]> {
    try {
      const entries = await this.getRecentMoodEntries(userId, 7);
      const stats = this.calculateMoodStats(entries);
      const suggestions: MoodInsight[] = [];

      // Streak recovery
      if (stats.streak === 0 && entries.length > 0) {
        const lastEntryDays = Math.floor((Date.now() - new Date(entries[0].timestamp).getTime()) / (1000 * 60 * 60 * 24));
        if (lastEntryDays >= 2) {
          suggestions.push({
            id: 'streak-recovery',
            type: 'suggestion',
            title: 'Mood Takibini Yeniden Başlat 🔄',
            description: `${lastEntryDays} gün önceki kaydından bu yana ara verdin. Küçük adımlarla tekrar başlayabilirsin.`,
            icon: 'restart',
            priority: 'high',
            actionable: true
          });
        }
      }

      // Low energy pattern
      if (stats.avgEnergy < 4 && entries.length >= 3) {
        suggestions.push({
          id: 'energy-tips',
          type: 'suggestion',
          title: 'Enerji Artırma Önerileri ⚡',
          description: 'Son kayıtlarda enerji düşük. 10 dk yürüyüş, su içmek veya müzik dinlemek yardımcı olabilir.',
          icon: 'lightning-bolt',
          priority: 'medium',
          actionable: true
        });
      }

      // High anxiety pattern
      if (stats.avgAnxiety > 7 && entries.length >= 3) {
        suggestions.push({
          id: 'anxiety-relief',
          type: 'suggestion',
          title: 'Sakinleştirici Teknikler 🌸',
          description: 'Kaygı seviyesi yüksek. Derin nefes alma, 5-4-3-2-1 tekniği veya kısa meditasyon deneyebilirsin.',
          icon: 'flower',
          priority: 'medium',
          actionable: true
        });
      }

      return suggestions.slice(0, 2); // Max 2 actionable suggestions
    } catch (error) {
      console.error('Failed to get actionable suggestions:', error);
      return [];
    }
  }
}

export const offlineMoodInsights = OfflineMoodInsightsService.getInstance();
export default offlineMoodInsights;
