import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';


// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import FAB from '@/components/ui/FAB';
import { MoodQuickEntry } from '@/components/mood/MoodQuickEntry';

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';
import { moodPatternAnalysisService } from '@/features/ai/services/moodPatternAnalysisService';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import type { MoodEntry as ServiceMoodEntry } from '@/services/moodTrackingService';

const { width } = Dimensions.get('window');

interface MoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes: string;
  trigger?: string;
  created_at: string;
  user_id: string;
}

export default function MoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();

  // State
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  // 🎭 Advanced Pattern Analysis State
  const [moodPatterns, setMoodPatterns] = useState<any[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  // Pre-fill from voice trigger if available
  useEffect(() => {
    if (params.prefill === 'true') {
      console.log('📝 Opening mood form with pre-filled data:', params);
      setShowQuickEntry(true);
    }
  }, [params]);

  // Load mood entries
  useEffect(() => {
    if (user?.id) {
      loadMoodEntries();
    }
  }, [user?.id, selectedTimeRange]);

  const loadMoodEntries = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Get period days based on selected range
      const periodDays = selectedTimeRange === 'today' ? 1 : 
                        selectedTimeRange === 'week' ? 7 : 30;
      
      const entries = await supabaseService.getMoodEntries(user.id, periodDays);
      setMoodEntries(entries || []);
    } catch (error) {
      console.error('Failed to load mood entries:', error);
      setToastMessage('Mood kayıtları yüklenemedi');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMoodEntries();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  /**
   * 🎭 Advanced Mood Pattern Analysis via UnifiedAIPipeline
   * Analyzes mood patterns for temporal, trigger, and MEA correlations
   */
  const analyzeMoodPatterns = async () => {
    if (!user?.id || moodEntries.length < 3) {
      setToastMessage('En az 3 mood kaydı gerekli');
      setShowToast(true);
      return;
    }

    try {
      setPatternsLoading(true);
      console.log('🎭 Starting mood pattern analysis via UnifiedAIPipeline...');

      // Convert local MoodEntry to service MoodEntry format
      const serviceMoodEntries: ServiceMoodEntry[] = moodEntries.map(entry => ({
        id: entry.id,
        user_id: entry.user_id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes,
        triggers: entry.trigger ? [entry.trigger] : [],
        activities: [], // Not available in current interface
        timestamp: entry.created_at,
        synced: true,
        sync_attempts: 0
      }));

      // Use UnifiedAIPipeline for comprehensive analysis
      const pipelineResult = await unifiedPipeline.process({
        userId: user.id,
        content: {
          moods: serviceMoodEntries,
          compulsions: [],
          erpSessions: []
        },
        type: 'data' as const,
        context: {
          source: 'mood' as const,
          timestamp: Date.now(),
          metadata: {
            analysisType: 'full'
          }
        }
      });

      console.log('🎯 UnifiedAIPipeline Pattern Result:', pipelineResult);

      // Extract patterns from pipeline result
      let patterns: any[] = [];
      
      if (pipelineResult.patterns && Array.isArray(pipelineResult.patterns)) {
        patterns = pipelineResult.patterns;
        console.log(`🎯 UnifiedAIPipeline found ${patterns.length} patterns`);
      } else {
        // Fallback to direct service call if pipeline doesn't have patterns
        console.log('📝 Fallback: Using direct moodPatternAnalysisService');
        patterns = await moodPatternAnalysisService.analyzeMoodPatterns(
          serviceMoodEntries,
          user.id,
          'full'
        );
      }

      setMoodPatterns(patterns);
      setShowPatterns(true);

      if (patterns.length === 0) {
        setToastMessage('Henüz belirgin pattern bulunamadı');
        setShowToast(true);
      } else {
        console.log(`✅ Found ${patterns.length} mood patterns via UnifiedAIPipeline`);
      }

    } catch (error) {
      console.error('❌ Mood pattern analysis failed:', error);
      setToastMessage('Pattern analizi başarısız oldu');
      setShowToast(true);
    } finally {
      setPatternsLoading(false);
    }
  };

  // Helper function to get week days
  const getWeekDays = () => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    return days.map((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        label: day,
        date: date
      };
    });
  };

  // Helper function to get today hours
  const getTodayHours = () => {
    const hours = [];
    for (let i = 6; i <= 23; i++) {
      hours.push({
        label: `${i.toString().padStart(2, '0')}:00`,
        hour: i
      });
    }
    return hours;
  };

  // Helper function to get month days
  const getMonthDays = () => {
    const days = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    // Pazartesi'den başlamak için boş günler ekle (0=Pazar, 1=Pazartesi)
    const emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < emptyDays; i++) {
      days.push({ label: '', date: null });
    }
    
    // Gerçek günleri ekle
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        label: i.toString(),
        date: date
      });
    }
    
    // Son haftayı tamamlamak için boş günler ekle
    while (days.length % 7 !== 0) {
      days.push({ label: '', date: null });
    }
    
    return days;
  };

  // Helper function to get mood color based on score
  const getMoodColor = (score: number): string => {
    if (score >= 90) return '#EC4899'; // Heyecanlı
    if (score >= 80) return '#8B5CF6'; // Enerjik
    if (score >= 70) return '#10B981'; // Mutlu
    if (score >= 60) return '#06B6D4'; // Sakin
    if (score >= 50) return '#84CC16'; // Normal
    if (score >= 40) return '#EAB308'; // Endişeli
    if (score >= 30) return '#F97316'; // Sinirli
    if (score >= 20) return '#3B82F6'; // Üzgün
    return '#EF4444'; // Kızgın
  };

  // Helper function to get mood label based on score
  const getMoodLabel = (score: number): string => {
    if (score >= 90) return 'Heyecanlı';
    if (score >= 80) return 'Enerjik';
    if (score >= 70) return 'Mutlu';
    if (score >= 60) return 'Sakin';
    if (score >= 50) return 'Normal';
    if (score >= 40) return 'Endişeli';
    if (score >= 30) return 'Sinirli';
    if (score >= 20) return 'Üzgün';
    return 'Kızgın';
  };

  const handleQuickEntry = async (data: {
    mood: number;
    energy: number;
    anxiety: number;
    notes: string;
    trigger?: string;
  }) => {
    if (!user?.id) return;

    try {
      const entry = {
        user_id: user.id,
        mood_score: data.mood,
        energy_level: data.energy,
        anxiety_level: data.anxiety,
        notes: data.notes,
        trigger: data.trigger,
      };

      await supabaseService.saveMoodEntry(entry);
      
      setToastMessage('Mood kaydı oluşturuldu ✅');
      setShowToast(true);
      setShowQuickEntry(false);
      
      // Reload entries
      await loadMoodEntries();
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save mood entry:', error);
      
      // Add to offline queue
      try {
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: user.id,
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            notes: data.notes,
            trigger: data.trigger,
            created_at: new Date().toISOString(),
          },
        });
        
        setToastMessage('Mood kaydı offline kaydedildi 📱');
        setShowToast(true);
        setShowQuickEntry(false);
      } catch (syncError) {
        setToastMessage('Kayıt oluşturulamadı');
        setShowToast(true);
      }
    }
  };

  const handleEditEntry = async (entry: MoodEntry) => {
    // TODO: Implement edit functionality
    console.log('Edit entry:', entry);
  };

  const handleDeleteEntry = async (entryId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete entry:', entryId);
  };

  // Calculate statistics
  const calculateStats = () => {
    if (moodEntries.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        avgAnxiety: 0,
        totalEntries: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      };
    }

    const avgMood = moodEntries.reduce((sum, e) => sum + e.mood_score, 0) / moodEntries.length;
    const avgEnergy = moodEntries.reduce((sum, e) => sum + e.energy_level, 0) / moodEntries.length;
    const avgAnxiety = moodEntries.reduce((sum, e) => sum + e.anxiety_level, 0) / moodEntries.length;

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (moodEntries.length >= 2) {
      const recent = moodEntries.slice(0, Math.ceil(moodEntries.length / 2));
      const older = moodEntries.slice(Math.ceil(moodEntries.length / 2));
      
      const recentAvg = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
      const olderAvg = older.reduce((sum, e) => sum + e.mood_score, 0) / older.length;
      
      trend = recentAvg > olderAvg + 5 ? 'up' : 
              recentAvg < olderAvg - 5 ? 'down' : 'stable';
    }

    return { 
      avgMood: Math.round(avgMood), 
      avgEnergy: Math.round(avgEnergy), 
      avgAnxiety: Math.round(avgAnxiety),
      totalEntries: moodEntries.length, 
      trend 
    };
  };

  const stats = calculateStats();

  // Calculate progress percentage
  const calculateProgress = () => {
    const goalCount = selectedTimeRange === 'today' ? 3 : 
                     selectedTimeRange === 'week' ? 10 : 30;
    const currentCount = stats.totalEntries;
    return Math.min(Math.round((currentCount / goalCount) * 100), 100);
  };

  // Calculate weekly change
  const calculateWeeklyChange = () => {
    if (stats.trend === 'up') return '+10%';
    if (stats.trend === 'down') return '-5%';
    return '0%';
  };

  const getFilteredEntries = () => {
    return moodEntries.slice(0, displayLimit);
  };

  const filteredEntries = getFilteredEntries();

  return (
    <ScreenLayout>
      {/* Header - Matching OCD/ERP Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Mood Takibi</Text>
          <Pressable 
            style={styles.headerRight}
            onPress={() => {
              // Graph/Stats action
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color="#EC4899" />
          </Pressable>
        </View>
        
        {/* Time Range Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('today');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'today' && styles.tabTextActive]}>
              Bugün
            </Text>
            {selectedTimeRange === 'today' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('week');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'week' && styles.tabTextActive]}>
              Hafta
            </Text>
            {selectedTimeRange === 'week' && <View style={styles.tabIndicator} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('month');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'month' && styles.tabTextActive]}>
              Ay
            </Text>
            {selectedTimeRange === 'month' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EC4899"
          />
        }
      >
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Summary Stats Card - Matching OCD/ERP Design */}
        <View style={styles.weekStatsCard}>
          <View style={styles.weekStatsHeader}>
            <View>
              <Text style={styles.weekStatsTitle}>
                Özet
              </Text>
            </View>
            {stats.trend !== 'stable' && (
              <View style={[styles.percentageBadge, 
                stats.trend === 'up' ? styles.trendUp : styles.trendDown]}>
                <Text style={styles.percentageText}>{calculateWeeklyChange()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="emoticon-outline" size={24} color="#EC4899" />
              <Text style={styles.statValue}>{stats.avgMood}/100</Text>
              <Text style={styles.statLabel}>Ort. Mood</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{stats.avgEnergy}/100</Text>
              <Text style={styles.statLabel}>Ort. Enerji</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.avgAnxiety}/100</Text>
              <Text style={styles.statLabel}>Ort. Anksiyete</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>İlerleme</Text>
              <Text style={styles.progressPercentage}>{calculateProgress()}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${calculateProgress()}%` }]} />
            </View>
          </View>
        </View>



        {/* Spectrum Mood Tracker - Lindsay Braman Style */}
        {moodEntries.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Duygu Spektrumu</Text>
            <View style={styles.spectrumContainer}>
                <View style={styles.spectrumHeader}>
                  <View>
                    <Text style={styles.spectrumTitle}>
                      {selectedTimeRange === 'today' ? 'Saatlik Görünüm' : 
                       selectedTimeRange === 'week' ? 'Haftalık Görünüm' : 
                       'Aylık Takvim'}
                    </Text>
                    <Text style={styles.spectrumSubtitle}>
                      {filteredEntries.length > 0 
                        ? `${filteredEntries.length} duygu kaydı`
                        : 'Henüz kayıt yok'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="palette" size={20} color="#EC4899" />
                </View>
                
                {/* Renk Spektrumu */}
                <LinearGradient
                  colors={['#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.spectrumBar}
                />
                
                {/* Spektrum Etiketleri */}
                <View style={styles.spectrumLabels}>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.spectrumLabel}>Kızgın</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#F97316' }]} />
                    <Text style={styles.spectrumLabel}>Sinirli</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#EAB308' }]} />
                    <Text style={styles.spectrumLabel}>Endişeli</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#84CC16' }]} />
                    <Text style={styles.spectrumLabel}>Normal</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.spectrumLabel}>Mutlu</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#06B6D4' }]} />
                    <Text style={styles.spectrumLabel}>Sakin</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.spectrumLabel}>Üzgün</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#8B5CF6' }]} />
                    <Text style={styles.spectrumLabel}>Enerjik</Text>
                  </View>
                  <View style={styles.spectrumLabelItem}>
                    <View style={[styles.spectrumDot, { backgroundColor: '#EC4899' }]} />
                    <Text style={styles.spectrumLabel}>Heyecanlı</Text>
                  </View>
                </View>
                
                {/* Dinamik İçerik - Günlük/Haftalık/Aylık */}
                {selectedTimeRange === 'today' && (
                  <>
                    {/* Günlük Saatler ve Duygular */}
                    {getTodayHours().map((hour) => {
                      const hourEntries = filteredEntries.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        return entryDate.getHours() === hour.hour;
                      });
                      
                      return (
                        <View key={hour.label} style={styles.dayRow}>
                          <Text style={[styles.dayLabel, { width: 50 }]}>{hour.label}</Text>
                          <View style={styles.dayMoods}>
                            {hourEntries.length > 0 ? (
                              hourEntries.map((entry, index) => {
                                const moodColor = getMoodColor(entry.mood_score);
                                const moodLabel = getMoodLabel(entry.mood_score);
                                const intensity = Math.round((entry.mood_score / 100) * 5);
                                const minute = new Date(entry.created_at).getMinutes();
                                const minuteStr = minute.toString().padStart(2, '0');
                                
                                return (
                                  <Pressable
                                    key={`${hour.label}-${index}`} 
                                    style={[styles.moodBubble, { backgroundColor: moodColor }]}
                                    onPress={() => {
                                      if (entry.notes) {
                                        Alert.alert(
                                          `${hour.hour}:${minuteStr} - ${moodLabel}`,
                                          entry.notes,
                                          [{ text: 'Tamam' }]
                                        );
                                      }
                                    }}
                                  >
                                    <Text style={styles.moodBubbleText}>:{minuteStr}</Text>
                                    <Text style={styles.moodIntensity}>●{intensity}</Text>
                                  </Pressable>
                                );
                              })
                            ) : (
                              <View style={{ height: 20 }} />
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {selectedTimeRange === 'week' && (
                  <>
                    {/* Haftalık Günler ve Duygular */}
                    {getWeekDays().map((day) => {
                      const dayEntries = filteredEntries.filter(entry => {
                        const entryDate = new Date(entry.created_at);
                        const dayDate = day.date;
                        return entryDate.getDate() === dayDate.getDate() && 
                               entryDate.getMonth() === dayDate.getMonth() &&
                               entryDate.getFullYear() === dayDate.getFullYear();
                      });
                      
                      return (
                        <View key={day.label} style={styles.dayRow}>
                          <Text style={styles.dayLabel}>{day.label}</Text>
                          <View style={styles.dayMoods}>
                            {dayEntries.length > 0 ? (
                              dayEntries.map((entry, index) => {
                                const moodColor = getMoodColor(entry.mood_score);
                                const moodLabel = getMoodLabel(entry.mood_score);
                                const intensity = Math.round((entry.mood_score / 100) * 5);
                                const time = new Date(entry.created_at).toLocaleTimeString('tr-TR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
                                
                                return (
                                  <Pressable
                                    key={`${day.label}-${index}`} 
                                    style={[styles.moodBubble, { backgroundColor: moodColor }]}
                                    onPress={() => {
                                      if (entry.notes) {
                                        Alert.alert(
                                          `${time} - ${moodLabel}`,
                                          entry.notes,
                                          [{ text: 'Tamam' }]
                                        );
                                      }
                                    }}
                                  >
                                    <Text style={styles.moodBubbleText}>{time}</Text>
                                    <Text style={styles.moodIntensity}>●{intensity}</Text>
                                  </Pressable>
                                );
                              })
                            ) : (
                              <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                                Kayıt yok
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {selectedTimeRange === 'month' && (
                  <View style={styles.monthContainer}>
                    {/* Aylık görünüm - Hafta başlıkları */}
                    <View style={styles.monthWeekHeaders}>
                      {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
                        <Text key={day} style={styles.monthWeekHeader}>{day}</Text>
                      ))}
                    </View>
                    {/* Aylık günler grid */}
                    <View style={styles.monthGrid}>
                      {[0, 1, 2, 3, 4, 5].map(weekIndex => {
                        const weekDays = getMonthDays().slice(weekIndex * 7, (weekIndex + 1) * 7);
                        if (weekDays.length === 0) return null;
                        
                        return (
                          <View key={weekIndex} style={styles.monthWeek}>
                            {weekDays.map((day, dayIndex) => {
                              // Boş günler için boş alan
                              if (!day.date) {
                                return (
                                  <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.monthDay} />
                                );
                              }
                              
                              const dayEntries = filteredEntries.filter(entry => {
                                const entryDate = new Date(entry.created_at);
                                const dayDate = day.date;
                                return entryDate.getDate() === dayDate.getDate() && 
                                       entryDate.getMonth() === dayDate.getMonth() &&
                                       entryDate.getFullYear() === dayDate.getFullYear();
                              });
                              
                              // Günün baskın duygu rengi
                              const dominantColor = dayEntries.length > 0 
                                ? getMoodColor(
                                    Math.round(dayEntries.reduce((sum, e) => sum + e.mood_score, 0) / dayEntries.length)
                                  )
                                : '#E5E7EB';
                              
                              return (
                                <Pressable
                                  key={`day-${day.label}`}
                                  style={[
                                    styles.monthDay,
                                    { 
                                      backgroundColor: dominantColor,
                                      opacity: dayEntries.length > 0 ? 1 : 0.3,
                                    }
                                  ]}
                                  onPress={() => {
                                    if (dayEntries.length > 0) {
                                      Alert.alert(
                                        `${day.label}. ${new Date(day.date).toLocaleDateString('tr-TR', { month: 'long' })}`,
                                        `${dayEntries.length} kayıt\nOrtalama ruh hali: ${Math.round(dayEntries.reduce((sum, e) => sum + e.mood_score, 0) / dayEntries.length)}%`,
                                        [{ text: 'Tamam' }]
                                      );
                                    }
                                  }}
                                >
                                  <Text style={styles.monthDayText}>
                                    {day.label}
                                  </Text>
                                  {dayEntries.length > 0 && (
                                    <Text style={styles.monthDayCount}>
                                      {dayEntries.length}
                                    </Text>
                                  )}
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
            </View>
          </View>
        )}

        {/* 🎭 Advanced Mood Pattern Analysis Section */}
        <View style={styles.patternAnalysisCard}>
          <View style={styles.patternAnalysisHeader}>
            <View style={styles.patternAnalysisHeaderLeft}>
              <MaterialCommunityIcons name="brain" size={24} color="#8B5CF6" />
              <Text style={styles.patternAnalysisTitle}>AI Pattern Analizi</Text>
            </View>
            <Pressable
              style={[styles.analysisButton, patternsLoading && styles.analysisButtonDisabled]}
              onPress={analyzeMoodPatterns}
              disabled={patternsLoading || moodEntries.length < 3}
            >
              <MaterialCommunityIcons 
                name={patternsLoading ? "loading" : "chart-timeline-variant"} 
                size={16} 
                color="white" 
              />
              <Text style={styles.analysisButtonText}>
                {patternsLoading ? 'Analiz Ediliyor...' : 'Analiz Et'}
              </Text>
            </Pressable>
          </View>
          
          <Text style={styles.patternAnalysisDescription}>
            Mood pattern'lerinizi keşfedin: saatlik/günlük döngüler, tetikleyici korelasyonları, MEA analizi
          </Text>

          {moodEntries.length < 3 && (
            <View style={styles.patternRequirement}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#F59E0B" />
              <Text style={styles.patternRequirementText}>
                En az 3 mood kaydı gerekli ({moodEntries.length}/3)
              </Text>
            </View>
          )}

          {/* Pattern Results */}
          {showPatterns && moodPatterns.length > 0 && (
            <View style={styles.patternsContainer}>
              <Text style={styles.patternsHeader}>
                🔍 {moodPatterns.length} Pattern Keşfedildi
              </Text>
              
              {moodPatterns.slice(0, 3).map((pattern, index) => (
                <View key={index} style={styles.patternCard}>
                  <View style={styles.patternHeader}>
                    <Text style={styles.patternTitle}>{pattern.title}</Text>
                    <View style={[
                      styles.patternSeverityBadge,
                      {
                        backgroundColor: 
                          pattern.severity === 'high' ? '#FEE2E2' :
                          pattern.severity === 'medium' ? '#FEF3C7' :
                          pattern.severity === 'critical' ? '#FECACA' : '#F0F9FF'
                      }
                    ]}>
                      <Text style={[
                        styles.patternSeverityText,
                        {
                          color:
                            pattern.severity === 'high' ? '#DC2626' :
                            pattern.severity === 'medium' ? '#D97706' :
                            pattern.severity === 'critical' ? '#B91C1C' : '#1E40AF'
                        }
                      ]}>
                        {Math.round(pattern.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.patternDescription}>
                    {pattern.description}
                  </Text>
                  
                  {pattern.actionable && pattern.suggestion && (
                    <View style={styles.patternSuggestion}>
                      <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color="#8B5CF6" />
                      <Text style={styles.patternSuggestionText}>
                        {pattern.suggestion}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {moodPatterns.length > 3 && (
                <Pressable 
                  style={styles.showMorePatternsButton}
                  onPress={() => {
                    Alert.alert(
                      'Tüm Pattern\'ler',
                      moodPatterns.map((p, i) => `${i+1}. ${p.title}: ${p.description}`).join('\n\n'),
                      [{ text: 'Tamam', style: 'default' }]
                    );
                  }}
                >
                  <Text style={styles.showMorePatternsText}>
                    +{moodPatterns.length - 3} pattern daha göster
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {showPatterns && moodPatterns.length === 0 && (
            <View style={styles.noPatternsFound}>
              <MaterialCommunityIcons name="chart-line-variant" size={24} color="#9CA3AF" />
              <Text style={styles.noPatternsText}>
                Henüz belirgin pattern bulunamadı.{'\n'}
                Daha fazla veri toplandıkça pattern'ler ortaya çıkacak.
              </Text>
            </View>
          )}
        </View>

        {/* Mood Entries List - Matching OCD/ERP Design */}
        <View style={styles.listSection}>

          {filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz mood kaydı yok</Text>
              <Text style={styles.emptySubtext}>
                Aşağıdaki + butonuna tıklayarak ilk kaydınızı oluşturun
              </Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredEntries.map((entry) => {
                const moodColor = entry.mood_score >= 70 ? '#10B981' : 
                                 entry.mood_score >= 40 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={entry.id} style={styles.recordingCard}>
                    <View style={styles.recordingContent}>
                      <View style={styles.recordingHeader}>
                        <View style={styles.recordingInfo}>
                          <MaterialCommunityIcons 
                            name="emoticon-outline" 
                            size={20} 
                            color={moodColor} 
                          />
                          <Text style={styles.recordingTime}>
                            {new Date(entry.created_at).toLocaleTimeString('tr-TR', { 
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </Text>
                        </View>
                        <View style={styles.recordingScores}>
                          <Text style={[styles.moodScore, { color: moodColor }]}>
                            {entry.mood_score}/100
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.recordingMetrics}>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="lightning-bolt" size={14} color="#F59E0B" />
                          <Text style={styles.metricValue}>Enerji: {entry.energy_level}</Text>
                        </View>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="heart-pulse" size={14} color="#3B82F6" />
                          <Text style={styles.metricValue}>Anksiyete: {entry.anxiety_level}</Text>
                        </View>
                      </View>
                      
                      {entry.notes && (
                        <Text style={styles.recordingNotes} numberOfLines={2}>
                          {entry.notes}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleDeleteEntry(entry.id);
                      }}
                      style={styles.deleteIcon}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#9CA3AF" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Show More Button */}
          {filteredEntries.length > 0 && moodEntries.length > displayLimit && (
            <View style={styles.showMoreContainer}>
              <Pressable
                style={styles.showMoreButton}
                onPress={() => {
                  setDisplayLimit(prev => prev + 5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.showMoreText}>Daha Fazla Göster</Text>
              </Pressable>
            </View>
          )}
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* FAB - Floating Action Button */}
      <FAB 
        icon="plus" 
        onPress={() => {
          setShowQuickEntry(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        position="fixed"
        backgroundColor="#EC4899"
      />

      {/* Quick Entry Modal */}
      <MoodQuickEntry
        visible={showQuickEntry}
        onClose={() => setShowQuickEntry(false)}
        onSubmit={handleQuickEntry}
        initialData={params.prefill === 'true' ? {
          mood: params.mood ? Number(params.mood) : 50,
          notes: params.text as string || '',
          trigger: params.trigger as string || ''
        } : undefined}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type={toastMessage.includes('✅') ? 'success' : 'info'}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  visualModeSelector: {
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeButtonActive: {
    backgroundColor: '#7C9885',
    borderColor: '#7C9885',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  wheelContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  wheelHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  wheelDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  wheelInfo: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  wheelInfoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  wheelLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
  },
  
  // Header Styles - Matching OCD/ERP
  headerContainer: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
    alignItems: 'center',
  },
  
  // Tab Styles - Matching OCD/ERP
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#EC4899',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EC4899',
  },
  
  // Date Display
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'Inter',
  },
  
  // Stats Card - Matching OCD/ERP Design
  weekStatsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  weekStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  weekStatsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  weekStatsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendUp: {
    backgroundColor: '#D1FAE5',
  },
  trendDown: {
    backgroundColor: '#FEE2E2',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#065F46',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  
  // Progress Bar
  progressContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EC4899',
    fontFamily: 'Inter',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EC4899',
    borderRadius: 4,
  },
  
  // Chart Section
  chartSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  
  // Spectrum Mood Tracker Styles
  spectrumContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  spectrumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  spectrumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  spectrumSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  spectrumBar: {
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
    flexDirection: 'row',
  },
  spectrumLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  spectrumLabelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '30%',
    marginBottom: 8,
  },
  spectrumDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  spectrumLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    width: 40,
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter',
  },
  dayMoods: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  moodBubble: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  moodBubbleText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  moodIntensity: {
    marginLeft: 4,
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter',
  },
  
  // Monthly View Styles
  monthContainer: {
    paddingTop: 8,
  },
  monthWeekHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monthWeekHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
    width: 40,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'column',
  },
  monthWeek: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monthDay: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  monthDayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  monthDayCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 8,
    fontFamily: 'Inter',
    marginTop: 1,
  },
  
  // List Section - Matching OCD/ERP
  listSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Recording Cards - Matching OCD/ERP
  recordingsContainer: {
    gap: 12,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recordingContent: {
    flex: 1,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  recordingScores: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodScore: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  recordingMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  recordingNotes: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
  },
  
  // Show More Button
  showMoreContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },

  // 🎭 Pattern Analysis Styles
  patternAnalysisCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  patternAnalysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  patternAnalysisHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  patternAnalysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  analysisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  analysisButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  analysisButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Inter',
  },
  patternAnalysisDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  patternRequirement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  patternRequirementText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 6,
    fontFamily: 'Inter',
  },
  patternsContainer: {
    marginTop: 12,
  },
  patternsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  patternCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
    fontFamily: 'Inter',
  },
  patternSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  patternSeverityText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  patternDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  patternSuggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  patternSuggestionText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 16,
    fontFamily: 'Inter',
  },
  showMorePatternsButton: {
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
  },
  showMorePatternsText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  noPatternsFound: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  noPatternsText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  
  bottomSpacing: {
    height: 100,
  },
});