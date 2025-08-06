
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Pressable,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Custom UI Components
import FAB from '@/components/ui/FAB';
import { CompulsionQuickEntry } from '@/components/forms/CompulsionQuickEntry';
import { Toast } from '@/components/ui/Toast';

// Gamification
import { useGamificationStore } from '@/store/gamificationStore';

// Constants
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';

// Storage utility
import { StorageKeys } from '@/utils/storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

// Map app categories to database categories
const mapCategoryToDatabase = (appCategory: string): string => {
  const categoryMap: { [key: string]: string } = {
    'washing': 'contamination',
    'checking': 'harm',
    'counting': 'symmetry',
    'ordering': 'symmetry',
    'hoarding': 'hoarding',
    'religious': 'religious',
    'sexual': 'sexual',
    'other': 'contamination', // Default fallback
  };
  
  return categoryMap[appCategory] || 'contamination';
};

interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  timestamp: Date;
  duration?: number;
  trigger?: string;
  notes?: string;
}

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [todayCompulsions, setTodayCompulsions] = useState<CompulsionEntry[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  const [stats, setStats] = useState({
    totalCompulsions: 0,
    avgResistance: 0,
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    typeDistribution: {} as Record<string, number>,
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user?.id]);

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  const loadAllData = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date();
      
      // Load all entries from user-specific storage key
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const allEntriesData = await AsyncStorage.getItem(storageKey);
      const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
      
      // Filter today's entries
      const todayKey = today.toDateString();
      const todayEntries = allEntries.filter(entry => 
        new Date(entry.timestamp).toDateString() === todayKey
      );
      setTodayCompulsions(todayEntries);
      
      // Calculate week entries (last 7 days)
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= weekAgo
      );
      
      // Calculate month entries (last 30 days)
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= monthAgo
      );
      
      // Calculate stats
      let allResistances: number[] = [];
      let typeDistribution: Record<string, number> = {};
      
      monthEntries.forEach((entry: CompulsionEntry) => {
        allResistances.push(entry.resistanceLevel || 0);
        
        if (entry.type) {
          typeDistribution[entry.type] = (typeDistribution[entry.type] || 0) + 1;
        }
      });
      
      const avgResistance = allResistances.length > 0 
        ? allResistances.reduce((sum, r) => sum + r, 0) / allResistances.length 
        : 0;
      
      setStats({
        totalCompulsions: monthEntries.length,
        avgResistance: Math.round(avgResistance * 10) / 10,
        todayCount: todayEntries.length,
        weekCount: weekEntries.length,
        monthCount: monthEntries.length,
        typeDistribution,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(5);
    await loadAllData();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  const handleCompulsionSubmit = async (compulsionData: Omit<CompulsionEntry, 'id' | 'timestamp'>) => {
    if (!user?.id) return;

    try {
      const newEntry: CompulsionEntry = {
        id: Date.now().toString(),
        ...compulsionData,
        timestamp: new Date(),
      };

      // Save to AsyncStorage (offline first)
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const existingEntries = await AsyncStorage.getItem(storageKey);
      const entries = existingEntries ? JSON.parse(existingEntries) : [];
      entries.push(newEntry);
      await AsyncStorage.setItem(storageKey, JSON.stringify(entries));

      // Save to Supabase database
      try {
        await supabaseService.saveCompulsion({
          user_id: user.id,
          category: mapCategoryToDatabase(compulsionData.type), // Use mapping function
          subcategory: compulsionData.type, // Store original type as subcategory
          resistance_level: compulsionData.resistanceLevel,
          trigger: compulsionData.trigger || '',
          notes: compulsionData.notes || '',
        });
        console.log('✅ Compulsion saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed (offline mode):', dbError);
        // Continue with offline mode - data is already in AsyncStorage
      }

      // Award gamification rewards
      awardMicroReward('compulsion_recorded');
      
      if (compulsionData.resistanceLevel >= 8) {
        awardMicroReward('high_resistance');
      }

      // Check for daily goal achievement
      const today = new Date().toDateString();
      const todayEntries = entries.filter((entry: CompulsionEntry) => 
        new Date(entry.timestamp).toDateString() === today
      );

      if (todayEntries.length >= 3) {
        awardMicroReward('daily_goal_met');
      }

      // Update streak
      updateStreak();

      // Show success toast
      setToastMessage('Kayıt eklendi');
      setShowToast(true);
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh data
      await loadAllData();
    } catch (error) {
      console.error('Error saving compulsion:', error);
    }
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Kaydı Sil',
      'Bu kaydı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;

            try {
              // Delete from AsyncStorage (offline first)
              const storageKey = StorageKeys.COMPULSIONS(user.id);
              const allEntriesData = await AsyncStorage.getItem(storageKey);
              const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
              const updatedEntries = allEntries.filter(entry => entry.id !== entryId);
              await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEntries));

              // Delete from Supabase database
              try {
                await supabaseService.deleteCompulsion(entryId);
                console.log('✅ Compulsion deleted from database');
              } catch (dbError) {
                console.error('❌ Database delete failed (offline mode):', dbError);
                // Continue with offline mode - data is already removed from AsyncStorage
              }

              await loadAllData();
              
              setToastMessage('Kayıt silindi');
              setShowToast(true);
            } catch (error) {
              console.error('Error deleting entry:', error);
              setToastMessage('Silme işleminde hata oluştu');
              setShowToast(true);
            }
          }
        }
      ]
    );
  };

  const getCompulsionIcon = (type: string) => {
    const category = COMPULSION_CATEGORIES.find(c => c.id === type);
    return category?.icon || 'help-circle';
  };

  const getCompulsionColor = (type: string) => {
    const colors: Record<string, string> = {
      cleaning: '#3B82F6',
      checking: '#10B981',
      counting: '#8B5CF6',
      symmetry: '#F59E0B',
      mental: '#EC4899',
      other: '#6B7280',
    };
    return colors[type] || '#6B7280';
  };

  const getResistanceColor = (level: number) => {
    if (level >= 7) return '#10B981';
    if (level >= 4) return '#F59E0B';
    return '#EF4444';
  };

  const getTimeRangeStats = () => {
    switch (selectedTimeRange) {
      case 'today':
        return { count: stats.todayCount, label: 'Today' };
      case 'week':
        return { count: stats.weekCount, label: 'This Week' };
      case 'month':
        return { count: stats.monthCount, label: 'This Month' };
    }
  };

  const timeRangeStats = getTimeRangeStats();
  
  // Calculate progress percentage
  const calculateProgress = () => {
    const goalCount = selectedTimeRange === 'today' ? 5 : selectedTimeRange === 'week' ? 30 : 100;
    const currentCount = timeRangeStats.count;
    return Math.min(Math.round((currentCount / goalCount) * 100), 100);
  };
  
  // Calculate weekly change percentage
  const calculateWeeklyChange = () => {
    // This is a simplified calculation, you might want to compare with previous week
    if (stats.weekCount > 0) {
      return '+5%'; // Placeholder for now
    }
    return '0%';
  };

  const getFilteredCompulsions = () => {
    const today = new Date();
    let entries: CompulsionEntry[] = [];

    switch (selectedTimeRange) {
      case 'today':
        entries = todayCompulsions;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= monthAgo
        );
        break;
    }

    return entries.slice(0, displayLimit);
  };

  const filteredCompulsions = getFilteredCompulsions();

  return (
    <ScreenLayout>
      {/* Header - New Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>OCD Tracking</Text>
          <Pressable 
            style={styles.headerRight}
            onPress={() => {
              // Graph/Stats action
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <MaterialCommunityIcons name="chart-line" size={24} color="#10B981" />
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
              Today
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
              Week
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
              Month
            </Text>
            {selectedTimeRange === 'month' && <View style={styles.tabIndicator} />}
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Summary Stats Card */}
        <View style={styles.weekStatsCard}>
          <View style={styles.weekStatsHeader}>
            <View>
              <Text style={styles.weekStatsTitle}>
                {selectedTimeRange === 'today' ? "Today's Stats" : 
                 selectedTimeRange === 'week' ? "This Week's Stats" : 
                 "This Month's Stats"}
              </Text>
              <Text style={styles.weekStatsSubtitle}>
                {selectedTimeRange === 'today' ? 'Your daily summary' : 
                 selectedTimeRange === 'week' ? 'Your weekly summary' : 
                 'Your monthly summary'}
              </Text>
            </View>
            {stats.weekCount > 0 && (
              <View style={styles.percentageBadge}>
                <Text style={styles.percentageText}>{calculateWeeklyChange()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRangeStats.count}</Text>
              <Text style={styles.statLabel}>Total Recordings</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.avgResistance > 0 ? `${stats.avgResistance}/10` : '0/10'}
              </Text>
              <Text style={styles.statLabel}>Avg. Resistance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{calculateProgress()}%</Text>
              <Text style={styles.statLabel}>Progress</Text>
            </View>
          </View>
        </View>

        {/* Today's Recordings - New Design */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {selectedTimeRange === 'today' ? "Today's Recordings" : 
             selectedTimeRange === 'week' ? "This Week's Recordings" : 
             "This Month's Recordings"}
          </Text>

          {filteredCompulsions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>No recordings yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button below to add your first recording
              </Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredCompulsions.map((compulsion) => {
                const category = COMPULSION_CATEGORIES.find(c => c.id === compulsion.type);
                const resistanceLevel = compulsion.resistanceLevel;
                const resistanceColor = resistanceLevel >= 8 ? '#10B981' : resistanceLevel >= 5 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={compulsion.id} style={styles.recordingCard}>
                    <View style={styles.recordingContent}>
                      <View style={styles.recordingHeader}>
                        <Text style={styles.recordingTime}>
                          {new Date(compulsion.timestamp).toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }).toUpperCase()} - {category?.name || 'Other'}
                        </Text>
                        <Text style={[styles.resistanceScore, { color: resistanceColor }]}>
                          {compulsion.resistanceLevel}/10
                        </Text>
                      </View>
                      {compulsion.notes && (
                        <Text style={styles.recordingNotes}>
                          Notes: {compulsion.notes}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        deleteEntry(compulsion.id);
                      }}
                      style={styles.deleteIcon}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#6B7280" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Show More Button */}
          {filteredCompulsions.length > 0 && todayCompulsions.length > displayLimit && (
            <View style={styles.showMoreContainer}>
              <Pressable
                style={styles.showMoreButton}
                onPress={() => {
                  setDisplayLimit(prev => prev + 5);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.showMoreText}>Show More</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FAB 
        icon="plus" 
        onPress={() => setShowQuickEntry(true)}
        style={[styles.fab, { backgroundColor: '#10B981' }]}
      />

      {/* Quick Entry Bottom Sheet */}
      <CompulsionQuickEntry
        visible={showQuickEntry}
        onDismiss={() => setShowQuickEntry(false)}
        onSubmit={handleCompulsionSubmit}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeRangeActive: {
    backgroundColor: '#10B981',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  // Tab Styles
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
    color: '#10B981',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#10B981',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 12,
    fontFamily: 'Inter',
  },
  // New Design Styles
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
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    fontFamily: 'Inter',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  // Old styles kept for compatibility
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
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
  // Recording Card Styles
  recordingsContainer: {
    gap: 12,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  resistanceScore: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  recordingNotes: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
  },
  // Old style kept for compatibility
  compulsionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compulsionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compulsionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compulsionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compulsionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  compulsionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  compulsionTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  compulsionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resistanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resistanceText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deleteButton: {
    padding: 8,
  },
  compulsionNotes: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Inter',
    lineHeight: 20,
  },
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
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  fab: {
    position: 'absolute',
    bottom: 90, // Tab bar yüksekliği dikkate alındı
    right: 16,
    zIndex: 999,
    elevation: 8,
  },
});

