import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
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
import { MoodChart } from '@/components/mood/MoodChart';
import { MoodList } from '@/components/mood/MoodList';

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';

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
                {selectedTimeRange === 'today' ? "Bugünün Özeti" : 
                 selectedTimeRange === 'week' ? "Bu Haftanın Özeti" : 
                 "Bu Ayın Özeti"}
              </Text>
              <Text style={styles.weekStatsSubtitle}>
                {selectedTimeRange === 'today' ? 'Günlük ruh hali durumunuz' : 
                 selectedTimeRange === 'week' ? 'Haftalık ruh hali durumunuz' : 
                 'Aylık ruh hali durumunuz'}
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

        {/* Mood Chart - Simplified */}
        {moodEntries.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Mood Grafiği</Text>
            <Card style={styles.chartCard}>
              <MoodChart entries={moodEntries} period={selectedTimeRange === 'today' ? 1 : 
                                                       selectedTimeRange === 'week' ? 7 : 30} />
            </Card>
          </View>
        )}

        {/* Mood Entries List - Matching OCD/ERP Design */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {selectedTimeRange === 'today' ? "Bugünün Kayıtları" : 
             selectedTimeRange === 'week' ? "Bu Haftanın Kayıtları" : 
             "Bu Ayın Kayıtları"}
          </Text>

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
  chartCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
  
  bottomSpacing: {
    height: 100,
  },
});
