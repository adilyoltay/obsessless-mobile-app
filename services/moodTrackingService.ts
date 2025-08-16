import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import { dataStandardizer } from '@/utils/dataStandardization';
import { offlineSyncService } from './offlineSync';

export interface MoodEntry {
  id: string;
  user_id: string;
  mood_score: number; // 1-10
  energy_level: number; // 1-10
  anxiety_level: number; // 1-10
  notes?: string;
  triggers?: string[];
  activities?: string[];
  timestamp: string;
  synced: boolean;
}

interface MoodAnalysis {
  averageMood: number;
  averageEnergy: number;
  averageAnxiety: number;
  moodTrend: 'improving' | 'stable' | 'worsening';
  commonTriggers: string[];
  beneficialActivities: string[];
  dailyPatterns: {
    morning: { mood: number; energy: number; anxiety: number };
    afternoon: { mood: number; energy: number; anxiety: number };
    evening: { mood: number; energy: number; anxiety: number };
    night: { mood: number; energy: number; anxiety: number };
  };
  weeklyPattern: number[]; // 7 günlük mood ortalamaları
}

class MoodTrackingService {
  private static instance: MoodTrackingService;
  private readonly STORAGE_KEY = 'mood_entries';

  static getInstance(): MoodTrackingService {
    if (!MoodTrackingService.instance) {
      MoodTrackingService.instance = new MoodTrackingService();
    }
    return MoodTrackingService.instance;
  }

  /**
   * Mood entry kaydet - standardizasyon ve offline sync ile
   */
  async saveMoodEntry(entry: Omit<MoodEntry, 'id' | 'timestamp' | 'synced'>): Promise<MoodEntry> {
    try {
      // Veriyi standardize et
      const standardizedData = dataStandardizer.standardizeMoodData({
        ...entry,
        timestamp: new Date().toISOString()
      });

      const moodEntry: MoodEntry = {
        ...standardizedData,
        id: `mood_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        synced: false,
      };

      // 1. Local storage'a kaydet
      await this.saveToLocalStorage(moodEntry);

      // 2. Sync kuyruğuna ekle
      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity: 'mood_entry' as any, // Type genişletilmeli
        data: moodEntry
      });

      // 3. Analytics event
      await this.trackMoodEntry(moodEntry);

      return moodEntry;
    } catch (error) {
      console.error('Mood entry kaydetme hatası:', error);
      throw error;
    }
  }

  /**
   * Local storage'a kaydet
   */
  private async saveToLocalStorage(entry: MoodEntry): Promise<void> {
    const key = `${this.STORAGE_KEY}_${entry.user_id}_${entry.timestamp.split('T')[0]}`;
    const existing = await AsyncStorage.getItem(key);
    const entries = existing ? JSON.parse(existing) : [];
    entries.push(entry);
    await AsyncStorage.setItem(key, JSON.stringify(entries));
  }

  /**
   * Mood geçmişini getir
   */
  async getMoodHistory(userId: string, days: number = 7): Promise<MoodEntry[]> {
    const entries: MoodEntry[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const key = `${this.STORAGE_KEY}_${userId}_${dateKey}`;
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        const dayEntries = JSON.parse(stored);
        entries.push(...dayEntries);
      }
    }
    
    // Tarihe göre sırala (yeniden eskiye)
    return entries.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Mood patterns analizi
   */
  async analyzeMoodPatterns(userId: string, days: number = 7): Promise<MoodAnalysis | null> {
    const entries = await this.getMoodHistory(userId, days);
    
    if (entries.length === 0) {
      return null;
    }

    const analysis: MoodAnalysis = {
      averageMood: this.calculateAverage(entries, 'mood_score'),
      averageEnergy: this.calculateAverage(entries, 'energy_level'),
      averageAnxiety: this.calculateAverage(entries, 'anxiety_level'),
      moodTrend: this.calculateTrend(entries, 'mood_score'),
      commonTriggers: this.extractCommonItems(entries, 'triggers'),
      beneficialActivities: this.identifyBeneficialActivities(entries),
      dailyPatterns: this.analyzeDailyPatterns(entries),
      weeklyPattern: await this.getWeeklyPattern(userId)
    };

    return analysis;
  }

  /**
   * Ortalama hesapla
   */
  private calculateAverage(entries: MoodEntry[], field: keyof MoodEntry): number {
    const values = entries
      .map(e => e[field])
      .filter(v => typeof v === 'number') as number[];
    
    if (values.length === 0) return 0;
    
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 10) / 10;
  }

  /**
   * Trend hesapla
   */
  private calculateTrend(entries: MoodEntry[], field: keyof MoodEntry): 'improving' | 'stable' | 'worsening' {
    if (entries.length < 3) return 'stable';
    
    // Son 3 gün vs önceki 3 gün
    const sorted = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const midPoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midPoint);
    const secondHalf = sorted.slice(midPoint);
    
    const firstAvg = this.calculateAverage(firstHalf, field);
    const secondAvg = this.calculateAverage(secondHalf, field);
    
    const difference = secondAvg - firstAvg;
    
    if (Math.abs(difference) < 0.5) return 'stable';
    return difference > 0 ? 'improving' : 'worsening';
  }

  /**
   * Ortak öğeleri çıkar
   */
  private extractCommonItems(entries: MoodEntry[], field: 'triggers' | 'activities'): string[] {
    const itemCounts: Map<string, number> = new Map();
    
    entries.forEach(entry => {
      const items = entry[field] || [];
      items.forEach(item => {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
      });
    });
    
    // En yaygın 5 öğe
    return Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item]) => item);
  }

  /**
   * Faydalı aktiviteleri belirle
   */
  private identifyBeneficialActivities(entries: MoodEntry[]): string[] {
    const activityImpact: Map<string, number[]> = new Map();
    
    entries.forEach(entry => {
      if (entry.activities && entry.activities.length > 0) {
        entry.activities.forEach(activity => {
          if (!activityImpact.has(activity)) {
            activityImpact.set(activity, []);
          }
          activityImpact.get(activity)!.push(entry.mood_score);
        });
      }
    });
    
    // Mood'u en çok artıran aktiviteler
    const beneficial = Array.from(activityImpact.entries())
      .map(([activity, scores]) => ({
        activity,
        avgImpact: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .filter(item => item.avgImpact >= 6) // Ortalama 6+ mood score
      .sort((a, b) => b.avgImpact - a.avgImpact)
      .slice(0, 5)
      .map(item => item.activity);
    
    return beneficial;
  }

  /**
   * Günlük pattern analizi
   */
  private analyzeDailyPatterns(entries: MoodEntry[]): MoodAnalysis['dailyPatterns'] {
    const timeSlots = {
      morning: { mood: [], energy: [], anxiety: [] },    // 06-12
      afternoon: { mood: [], energy: [], anxiety: [] },  // 12-18
      evening: { mood: [], energy: [], anxiety: [] },    // 18-24
      night: { mood: [], energy: [], anxiety: [] }       // 00-06
    };
    
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      let slot: keyof typeof timeSlots;
      
      if (hour >= 6 && hour < 12) slot = 'morning';
      else if (hour >= 12 && hour < 18) slot = 'afternoon';
      else if (hour >= 18 && hour < 24) slot = 'evening';
      else slot = 'night';
      
      timeSlots[slot].mood.push(entry.mood_score);
      timeSlots[slot].energy.push(entry.energy_level);
      timeSlots[slot].anxiety.push(entry.anxiety_level);
    });
    
    // Ortalamaları hesapla
    const patterns: MoodAnalysis['dailyPatterns'] = {} as any;
    
    Object.keys(timeSlots).forEach(slot => {
      const data = timeSlots[slot as keyof typeof timeSlots];
      patterns[slot as keyof typeof patterns] = {
        mood: data.mood.length > 0 
          ? Math.round(data.mood.reduce((a, b) => a + b, 0) / data.mood.length * 10) / 10 
          : 0,
        energy: data.energy.length > 0 
          ? Math.round(data.energy.reduce((a, b) => a + b, 0) / data.energy.length * 10) / 10 
          : 0,
        anxiety: data.anxiety.length > 0 
          ? Math.round(data.anxiety.reduce((a, b) => a + b, 0) / data.anxiety.length * 10) / 10 
          : 0
      };
    });
    
    return patterns;
  }

  /**
   * Haftalık pattern
   */
  private async getWeeklyPattern(userId: string): Promise<number[]> {
    const pattern: number[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const key = `${this.STORAGE_KEY}_${userId}_${dateKey}`;
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        const dayEntries = JSON.parse(stored) as MoodEntry[];
        const dayAvg = this.calculateAverage(dayEntries, 'mood_score');
        pattern.push(dayAvg);
      } else {
        pattern.push(0);
      }
    }
    
    return pattern;
  }

  /**
   * Analytics tracking
   */
  private async trackMoodEntry(entry: MoodEntry): Promise<void> {
    // Analytics implementation
    try {
      const analyticsData = {
        event: 'mood_entry_saved',
        userId: entry.user_id,
        properties: {
          mood_score: entry.mood_score,
          energy_level: entry.energy_level,
          anxiety_level: entry.anxiety_level,
          has_notes: !!entry.notes,
          trigger_count: entry.triggers?.length || 0,
          activity_count: entry.activities?.length || 0,
          timestamp: entry.timestamp
        }
      };
      
      // Analytics servisine gönder (varsa)
      console.log('📊 Mood analytics:', analyticsData);
    } catch (error) {
      console.error('Analytics tracking hatası:', error);
    }
  }

  /**
   * Mood önerileri oluştur
   */
  async generateMoodRecommendations(userId: string): Promise<string[]> {
    const analysis = await this.analyzeMoodPatterns(userId);
    if (!analysis) return [];
    
    const recommendations: string[] = [];
    
    // Anksiyete yüksekse
    if (analysis.averageAnxiety > 7) {
      recommendations.push('Nefes egzersizleri anksiyetenizi azaltmaya yardımcı olabilir');
    }
    
    // Enerji düşükse
    if (analysis.averageEnergy < 4) {
      recommendations.push('Hafif fiziksel aktiviteler enerji seviyenizi artırabilir');
    }
    
    // Mood düşüşte ise
    if (analysis.moodTrend === 'worsening') {
      recommendations.push('Ruh halinizde bir düşüş gözlemleniyor. Destek almayı düşünebilirsiniz');
    }
    
    // Faydalı aktiviteler varsa
    if (analysis.beneficialActivities.length > 0) {
      recommendations.push(
        `"${analysis.beneficialActivities[0]}" aktivitesi ruh halinizi olumlu etkiliyor`
      );
    }
    
    return recommendations;
  }

  /**
   * Supabase'e sync et
   */
  async syncToSupabase(entry: MoodEntry): Promise<void> {
    try {
      const { error } = await supabaseService.client
        .from('mood_tracking')
        .upsert({
          id: entry.id,
          user_id: entry.user_id,
          mood_score: entry.mood_score,
          energy_level: entry.energy_level,
          anxiety_level: entry.anxiety_level,
          notes: entry.notes,
          triggers: entry.triggers,
          activities: entry.activities,
          created_at: entry.timestamp,
        });

      if (error) throw error;
      
      await this.markAsSynced(entry.id);
    } catch (error) {
      console.error('Supabase sync hatası:', error);
      throw error;
    }
  }

  /**
   * Sync durumunu güncelle
   */
  private async markAsSynced(entryId: string): Promise<void> {
    // Tüm local entries'leri tara ve güncelle
    const keys = await AsyncStorage.getAllKeys();
    const moodKeys = keys.filter(k => k.startsWith(this.STORAGE_KEY));
    
    for (const key of moodKeys) {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const entries = JSON.parse(stored) as MoodEntry[];
        const updated = entries.map(e => 
          e.id === entryId ? { ...e, synced: true } : e
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    }
  }
}

export const moodTracker = MoodTrackingService.getInstance();
export default moodTracker;


