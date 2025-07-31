
import React, { useState, useEffect } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  RefreshControl,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Custom UI Components
import FAB from '@/components/ui/FAB';
import { ERPQuickStart } from '@/components/erp/ERPQuickStart';
import { getAllExercises, getExerciseById } from '@/constants/erpCategories';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { StorageKeys } from '@/utils/storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

interface ERPSession {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: string;
  durationSeconds: number;
  anxietyInitial: number;
  anxietyPeak: number;
  anxietyFinal: number;
  completedAt: Date;
  anxietyDataPoints: Array<{timestamp: number; level: number}>;
}

export default function ERPScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isQuickStartVisible, setIsQuickStartVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [todaySessions, setTodaySessions] = useState<ERPSession[]>([]);
  
  const [stats, setStats] = useState({
    todayCompleted: 0,
    weekCompleted: 0,
    monthCompleted: 0,
    todayTime: 0,
    weekTime: 0,
    monthTime: 0,
    avgAnxietyReduction: 0,
    streak: 0,
  });

  useEffect(() => {
    if (user?.id) {
      loadAllStats();
    }
  }, [user?.id]);

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  const loadAllStats = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date();
      const todayKey = today.toDateString();
      
      // Load today's sessions with user ID
      const todayStorageKey = StorageKeys.ERP_SESSIONS(user.id, todayKey);
      const todayData = await AsyncStorage.getItem(todayStorageKey);
      const todaySessionsData = todayData ? JSON.parse(todayData) : [];
      setTodaySessions(todaySessionsData);
      
      // Calculate stats
      let weekCompleted = 0;
      let monthCompleted = 0;
      let weekTime = 0;
      let monthTime = 0;
      let totalAnxietyReduction = 0;
      let sessionCount = 0;
      let consecutiveDays = 0;
      let lastActiveDate: Date | null = null;
      
      // Load data for the past 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toDateString();
        
        const dayStorageKey = StorageKeys.ERP_SESSIONS(user.id, dateKey);
        const dayData = await AsyncStorage.getItem(dayStorageKey);
        if (dayData) {
          const sessions = JSON.parse(dayData);
          
          // Check for streak
          if (!lastActiveDate || (lastActiveDate.getTime() - date.getTime()) === 86400000) {
            consecutiveDays++;
            lastActiveDate = date;
          } else if (i > 0) {
            break;
          }
          
          sessions.forEach((session: ERPSession) => {
            if (i < 7) {
              weekCompleted += 1;
              weekTime += session.durationSeconds;
            }
            monthCompleted += 1;
            monthTime += session.durationSeconds;
            
            // Calculate anxiety reduction
            const reduction = session.anxietyInitial - session.anxietyFinal;
            totalAnxietyReduction += reduction;
            sessionCount++;
          });
        }
      }
      
      const avgAnxietyReduction = sessionCount > 0 
        ? Math.round((totalAnxietyReduction / sessionCount) * 10) / 10 
        : 0;
      
      setStats({
        todayCompleted: todaySessionsData.length,
        weekCompleted,
        monthCompleted,
        todayTime: todaySessionsData.reduce((sum: number, s: ERPSession) => sum + s.durationSeconds, 0),
        weekTime,
        monthTime,
        avgAnxietyReduction,
        streak: consecutiveDays,
      });
    } catch (error) {
      console.error('Error loading ERP stats:', error);
    }
  };

  const handleExerciseSelect = async (exerciseConfig: any) => {
    if (!user?.id) return;
    
    setIsQuickStartVisible(false);
    await AsyncStorage.setItem(StorageKeys.LAST_ERP_EXERCISE(user.id), exerciseConfig.exerciseId);
    
    // Store wizard configuration for session
    const sessionConfig = {
      exerciseId: exerciseConfig.exerciseId,
      exerciseType: exerciseConfig.exerciseType,
      duration: exerciseConfig.duration * 60, // Convert minutes to seconds
      targetAnxiety: exerciseConfig.targetAnxiety,
      personalGoal: exerciseConfig.personalGoal,
    };
    
    router.push({
      pathname: '/erp-session',
      params: sessionConfig
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(5);
    await loadAllStats();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} dk`;
  };

  const getTimeRangeStats = () => {
    switch (selectedTimeRange) {
      case 'today':
        return { 
          count: stats.todayCompleted, 
          time: formatDuration(stats.todayTime),
          label: 'Bugün' 
        };
      case 'week':
        return { 
          count: stats.weekCompleted, 
          time: formatDuration(stats.weekTime),
          label: 'Bu Hafta' 
        };
      case 'month':
        return { 
          count: stats.monthCompleted, 
          time: formatDuration(stats.monthTime),
          label: 'Bu Ay' 
        };
    }
  };

  const timeRangeStats = getTimeRangeStats();

  const getFilteredSessions = () => {
    const today = new Date();
    let sessions: ERPSession[] = [];

    switch (selectedTimeRange) {
      case 'today':
        sessions = todaySessions;
        break;
      case 'week':
      case 'month':
        // For simplicity, showing today's sessions for all ranges
        // In a real app, you'd load and filter sessions accordingly
        sessions = todaySessions;
        break;
    }

    return sessions.slice(0, displayLimit);
  };

  const filteredSessions = getFilteredSessions();

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      'Oturumu Sil',
      'Bu oturumu silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;

            try {
              // Delete from AsyncStorage (offline first)
              const today = new Date();
              const todayKey = today.toDateString();
              const todayStorageKey = StorageKeys.ERP_SESSIONS(user.id, todayKey);
              
              const todayData = await AsyncStorage.getItem(todayStorageKey);
              const sessions: ERPSession[] = todayData ? JSON.parse(todayData) : [];
              const updatedSessions = sessions.filter(session => session.id !== sessionId);
              await AsyncStorage.setItem(todayStorageKey, JSON.stringify(updatedSessions));

              // Delete from Supabase database
              try {
                await supabaseService.deleteERPSession(sessionId);
                console.log('✅ ERP session deleted from database');
              } catch (dbError) {
                console.error('❌ Database delete failed (offline mode):', dbError);
                // Continue with offline mode - data is already removed from AsyncStorage
              }

              await loadAllStats();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting session:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <ScreenLayout>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ERP Takibi</Text>
          <Text style={styles.headerSubtitle}>
            Maruz kalma egzersizlerini takip et
          </Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'today' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('today')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'today' && styles.timeRangeTextActive]}>
              Bugün
            </Text>
          </Pressable>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'week' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('week')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'week' && styles.timeRangeTextActive]}>
              Bu Hafta
            </Text>
          </Pressable>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'month' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('month')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'month' && styles.timeRangeTextActive]}>
              Bu Ay
            </Text>
          </Pressable>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="play-circle" size={24} color="#10B981" />
            </View>
            <Text style={styles.statNumber}>{timeRangeStats.count}</Text>
            <Text style={styles.statLabel}>Oturum</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="timer-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statNumber}>{timeRangeStats.time}</Text>
            <Text style={styles.statLabel}>Süre</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="trending-down" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.statNumber}>{stats.avgAnxietyReduction}</Text>
            <Text style={styles.statLabel}>Ort. Azalma</Text>
          </View>
        </View>

        {/* Session List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {selectedTimeRange === 'today' ? 'Bugünün Oturumları' : 
             selectedTimeRange === 'week' ? 'Bu Haftanın Oturumları' : 
             'Bu Ayın Oturumları'}
          </Text>

          {filteredSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="heart-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Yolculuğun burada başlıyor</Text>
              <Text style={styles.emptySubtext}>
                Hazır olduğunda + butonuna dokunarak nazik adımlarını atmaya başla
              </Text>
            </View>
          ) : (
            <>
              {filteredSessions.map((session) => {
                const exercise = getExerciseById(session.exerciseId);
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionInfo}>
                        <View style={[styles.sessionIcon, { backgroundColor: '#10B981' + '20' }]}>
                          <MaterialCommunityIcons 
                            name="meditation" 
                            size={20} 
                            color="#10B981" 
                          />
                        </View>
                        <View style={styles.sessionDetails}>
                          <Text style={styles.sessionName}>{session.exerciseName}</Text>
                          <Text style={styles.sessionTime}>
                            {new Date(session.completedAt).toLocaleTimeString('tr-TR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.sessionStats}>
                        <View style={styles.anxietyBadge}>
                          <MaterialCommunityIcons name="arrow-down" size={16} color="#10B981" />
                          <Text style={styles.anxietyText}>
                            {session.anxietyInitial} → {session.anxietyFinal}
                          </Text>
                        </View>
                        <Text style={styles.durationText}>{formatDuration(session.durationSeconds)}</Text>
                        <Pressable
                          onPress={() => deleteSession(session.id)}
                          style={styles.deleteButton}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Show More Button */}
              {todaySessions.length > displayLimit && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => setDisplayLimit(prev => prev + 5)}
                >
                  <Text style={styles.showMoreText}>Daha Fazla Göster</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#4F46E5" />
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FAB 
        icon="plus" 
        onPress={() => setIsQuickStartVisible(true)}
        style={styles.fab}
      />

      {/* Quick Start Bottom Sheet */}
      <ERPQuickStart
        visible={isQuickStartVisible}
        onDismiss={() => setIsQuickStartVisible(false)}
        onExerciseSelect={handleExerciseSelect}
        exercises={getAllExercises()}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
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
    color: '#111827',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
    color: '#111827',
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
  sessionCard: {
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
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  sessionTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  sessionStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  anxietyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  anxietyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  durationText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  deleteButton: {
    marginTop: 8,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginRight: 4,
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
