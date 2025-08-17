
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
import { useFocusEffect } from '@react-navigation/native';

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
import { useAIUserData, useAIActions } from '@/contexts/AIContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { TreatmentPlanPreview } from '@/features/ai/components/onboarding/TreatmentPlanPreview';
// ✅ PRODUCTION: AI ERP Recommendations
import { erpRecommendationService } from '@/features/ai/services/erpRecommendationService';
import { mapToCanonicalCategory } from '@/utils/categoryMapping';

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
  const { treatmentPlan, userProfile } = useAIUserData();
  const [localPlan, setLocalPlan] = useState<any | null>(null);
  const [localProfile, setLocalProfile] = useState<any | null>(null);
  const { generateInsights } = useAIActions();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [isQuickStartVisible, setIsQuickStartVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [todaySessions, setTodaySessions] = useState<ERPSession[]>([]);
  
  // ✅ PRODUCTION: AI ERP Recommendations State
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  
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

  // Migrate test data to user data if needed (one-time migration)
  const migrateTestData = async () => {
    if (!user?.id) return;
    
    try {
      const testUserId = 'test-user';
      const dateKey = new Date().toDateString();
      const testStorageKey = StorageKeys.ERP_SESSIONS(testUserId, dateKey);
      const userStorageKey = StorageKeys.ERP_SESSIONS(user.id, dateKey);
      
      // Check if test data exists
      const testData = await AsyncStorage.getItem(testStorageKey);
      if (testData) {
        console.log('🔄 Migrating test data to user account...');
        
        // Get existing user data
        const userData = await AsyncStorage.getItem(userStorageKey);
        const userSessions = userData ? JSON.parse(userData) : [];
        const testSessions = JSON.parse(testData);
        
        // Merge sessions
        const mergedSessions = [...userSessions, ...testSessions];
        
        // Save to user storage
        await AsyncStorage.setItem(userStorageKey, JSON.stringify(mergedSessions));
        
        // Remove test data
        await AsyncStorage.removeItem(testStorageKey);
        
        console.log('✅ Test data migrated successfully');
      }
    } catch (error) {
      console.error('❌ Error migrating test data:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      migrateTestData().then(() => {
        loadAllStats();
        // ✅ PRODUCTION: Load AI recommendations when user profile is ready
        loadAIRecommendations();
      });
    }
  }, [user, userProfile, treatmentPlan]);
  // Local fallback for plan/profile if AI context not yet populated
  useEffect(() => {
    const loadLocalAI = async () => {
      if (!user?.id) return;
      try {
        if (!treatmentPlan) {
          const tp = await AsyncStorage.getItem(`ai_treatment_plan_${user.id}`);
          if (tp) setLocalPlan(JSON.parse(tp));
        }
        if (!userProfile) {
          const up = await AsyncStorage.getItem(`ai_user_profile_${user.id}`);
          if (up) setLocalProfile(JSON.parse(up));
        }
      } catch {}
    };
    loadLocalAI();
  }, [user?.id, treatmentPlan, userProfile]);


  // Refresh stats when screen is focused (after returning from ERP session)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 ERP screen focused, refreshing stats...');
        loadAllStats();
      }
    }, [user?.id])
  );

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  // ✅ PRODUCTION: AI ERP Recommendations loader
  const loadAIRecommendations = async () => {
    if (!user?.id || !FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING')) {
      return;
    }

    try {
      setIsLoadingRecommendations(true);
      console.log('🤖 Loading AI ERP recommendations...');

      // Get personalized recommendations
      const recommendationResult = await erpRecommendationService.getPersonalizedRecommendations(
        user.id,
        (userProfile && treatmentPlan) ? { userProfile, treatmentPlan } : undefined
      );

      setAiRecommendations(recommendationResult.recommendedExercises || []);
      setShowAIRecommendations((recommendationResult.recommendedExercises || []).length > 0);
      
      console.log('✅ AI ERP recommendations loaded:', recommendationResult.recommendedExercises?.length || 0);

    } catch (error) {
      console.warn('⚠️ AI ERP recommendations failed, using fallback:', error);
      setAiRecommendations([]);
      setShowAIRecommendations(false);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const loadAllStats = async () => {
    if (!user?.id) return;
    
    console.log('📈 Loading ERP stats for user:', user.id);
    
    try {
      const today = new Date();
      const todayKey = today.toDateString();
      
      console.log('📅 Today key:', todayKey);
      
      // Load today's sessions with user ID
      const todayStorageKey = StorageKeys.ERP_SESSIONS(user.id, todayKey);
      console.log('🔑 Today storage key:', todayStorageKey);
      
      const todayData = await AsyncStorage.getItem(todayStorageKey);
      const todaySessionsData = todayData ? JSON.parse(todayData) : [];
      
      console.log('📊 Today sessions data:', todaySessionsData);
      console.log('📊 Today sessions count:', todaySessionsData.length);
      
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
      
      const newStats = {
        todayCompleted: todaySessionsData.length,
        weekCompleted,
        monthCompleted,
        todayTime: todaySessionsData.reduce((total: number, session: ERPSession) => total + session.durationSeconds, 0),
        weekTime,
        monthTime,
        avgAnxietyReduction,
        streak: consecutiveDays,
      };
      
      console.log('📊 Calculated stats:', newStats);
      
      setStats(newStats);
      
    } catch (error) {
      console.error('❌ Error loading ERP stats:', error);
    }
  };

  const handleExerciseSelect = async (exerciseConfig: any) => {
    console.log('🎯 handleExerciseSelect called in ERP page');
    console.log('👤 Current user:', user);
    
    if (!user?.id) {
      console.error('❌ No user ID in handleExerciseSelect');
      Alert.alert(
        'Giriş Yapın',
        'ERP egzersizi başlatmak için lütfen giriş yapın.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    
    console.log('🎯 Exercise selected:', exerciseConfig);
    
    setIsQuickStartVisible(false);
    await AsyncStorage.setItem(StorageKeys.LAST_ERP_EXERCISE(user.id), exerciseConfig.exerciseId);
    
    // Store wizard configuration for session
    const canonical = mapToCanonicalCategory(exerciseConfig.category);

    const sessionConfig = {
      exerciseId: exerciseConfig.exerciseId,
      exerciseType: exerciseConfig.exerciseType,
      duration: exerciseConfig.duration * 60, // Convert minutes to seconds
      targetAnxiety: exerciseConfig.targetAnxiety,
      personalGoal: exerciseConfig.personalGoal,
      category: canonical,
      categoryName: t('categoriesCanonical.' + canonical, exerciseConfig.categoryName),
    };
    
    console.log('🚀 Navigating to ERP session with config:', sessionConfig);
    
    try {
      router.push({
        pathname: '/erp-session',
        params: sessionConfig
      });
      console.log('✅ Navigation completed');
    } catch (error) {
      console.error('❌ Navigation error:', error);
      Alert.alert('Hata', 'Egzersiz başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(5);
    await loadAllStats();
    // ✅ PRODUCTION: Refresh AI recommendations
    if (userProfile && treatmentPlan) {
      await loadAIRecommendations();
    }
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
      {/* Header - New Design */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>ERP Takibi</Text>
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
          {new Date().toLocaleDateString('tr-TR', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Summary Stats Card - New Design */}
        <View style={styles.weekStatsCard}>
          <View style={styles.weekStatsHeader}>
            <View>
              <Text style={styles.weekStatsTitle}>
                {selectedTimeRange === 'today' ? 'Bugünün Özeti' : 
                 selectedTimeRange === 'week' ? 'Bu Haftanın Özeti' : 
                 'Bu Ayın Özeti'}
              </Text>
              <Text style={styles.weekStatsSubtitle}>
                {selectedTimeRange === 'today' ? 'Günlük özetiniz' : 
                 selectedTimeRange === 'week' ? 'Haftalık özetiniz' : 
                 'Aylık özetiniz'}
              </Text>
            </View>
            {stats.streak > 0 && (
              <View style={styles.percentageBadge}>
                <Text style={styles.percentageText}>🔥 {stats.streak}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRangeStats.count}</Text>
              <Text style={styles.statLabel}>Oturum</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRangeStats.time}</Text>
              <Text style={styles.statLabel}>Toplam Süre</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stats.avgAnxietyReduction > 0 ? `-${stats.avgAnxietyReduction}` : '0'}
              </Text>
              <Text style={styles.statLabel}>Ort. Azalma</Text>
            </View>
          </View>
        </View>

        {/* AI Treatment Plan (Sprint 7 Integration) */}
        {FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING') && (treatmentPlan || localPlan) && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Önerilen Tedavi Planı</Text>
            <TreatmentPlanPreview userProfile={userProfile || localProfile} treatmentPlan={treatmentPlan || localPlan} userId={user?.id} />
          </View>
        )}

        {/* ✅ PRODUCTION: AI ERP Recommendations */}
        {showAIRecommendations && aiRecommendations.length > 0 && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={styles.aiRecommendationsHeader}>
              <Text style={styles.sectionTitle}>🤖 AI Önerileri</Text>
              <Text style={styles.aiRecommendationsSubtitle}>
                Size özel seçilmiş egzersizler
              </Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.aiRecommendationsScroll}
              contentContainerStyle={styles.aiRecommendationsContent}
            >
              {aiRecommendations.slice(0, 3).map((recommendation, index) => (
                <Pressable
                  key={recommendation.exerciseId || index}
                  style={styles.aiRecommendationCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Auto-select this AI recommended exercise
                    const exerciseConfig = {
                      exerciseId: recommendation.exerciseId,
                      // Use exercise type from recommendation (in_vivo/imaginal/interoceptive/response_prevention)
                      exerciseType: recommendation.category,
                      duration: recommendation.estimatedDuration || 30,
                      targetAnxiety: 5,
                      personalGoal: `AI önerisi: ${recommendation.title}`,
                      // category: domain kategorisi kanonik basamakta tutulmalı; öneriden yoksa "other"
                      category: mapToCanonicalCategory(recommendation.targetSymptoms?.[0] || 'other'),
                      categoryName: mapToCanonicalCategory(recommendation.targetSymptoms?.[0] || 'other'),
                    };
                    handleExerciseSelect(exerciseConfig);
                  }}
                >
                  <View style={styles.aiRecommendationHeader}>
                    <Text style={styles.aiRecommendationTitle}>
                      {recommendation.title}
                    </Text>
                    <View style={[styles.difficultyBadge, {
                      backgroundColor: recommendation.difficulty <= 2 ? '#D1FAE5' : 
                                     recommendation.difficulty <= 3 ? '#FEF3C7' : '#FEE2E2'
                    }]}>
                      <Text style={[styles.difficultyText, {
                        color: recommendation.difficulty <= 2 ? '#065F46' : 
                               recommendation.difficulty <= 3 ? '#92400E' : '#991B1B'
                      }]}>
                        {recommendation.difficulty}/5
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.aiRecommendationDescription} numberOfLines={2}>
                    {recommendation.description}
                  </Text>
                  
                    <View style={styles.aiRecommendationFooter}>
                      <Text style={styles.aiRecommendationDuration}>
                        ⏱️ {recommendation.estimatedDuration || 30} dk
                      </Text>
                      <Text style={styles.aiRecommendationCategory}>
                        🧩 Tür: {recommendation.category} • 📋 Kategori: {t('categoriesCanonical.' + mapToCanonicalCategory(recommendation.targetSymptoms?.[0] || 'other'), 'Kategori')}
                      </Text>
                    </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Recommendations Loading */}
        {isLoadingRecommendations && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={styles.aiLoadingCard}>
              <MaterialCommunityIcons 
                name="robot" 
                size={24} 
                color="#10B981" 
              />
              <Text style={styles.aiLoadingText}>
                AI size özel egzersizler hazırlıyor...
              </Text>
            </View>
          </View>
        )}

        {/* Today's Sessions - New Design */}
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
                İlk maruz kalma egzersizine başlamak için alttaki + butonuna dokun
              </Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredSessions.map((session) => {
                const anxietyReduction = session.anxietyInitial - session.anxietyFinal;
                const reductionColor = anxietyReduction >= 3 ? '#10B981' : anxietyReduction >= 1 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={session.id} style={styles.recordingCard}>
                    <View style={styles.recordingContent}>
                      <View style={styles.recordingHeader}>
                        <Text style={styles.recordingTime}>
                          {new Date(session.completedAt).toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }).toUpperCase()} - {session.exerciseName}
                        </Text>
                        <Text style={[styles.resistanceScore, { color: reductionColor }]}>
                          -{anxietyReduction}
                        </Text>
                      </View>
                      <Text style={styles.recordingNotes}>
                        Anxiety: {session.anxietyInitial} → {session.anxietyFinal} • Duration: {formatDuration(session.durationSeconds)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        deleteSession(session.id);
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

        {/* AI Recommendations Loading */}
        {isLoadingRecommendations && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={styles.aiLoadingCard}>
              <MaterialCommunityIcons 
                name="robot" 
                size={24} 
                color="#10B981" 
              />
              <Text style={styles.aiLoadingText}>
                AI size özel egzersizler hazırlıyor...
              </Text>
            </View>
          </View>
        )}

        {/* AI Recommendations Failed Fallback */}
        {!isLoadingRecommendations && !showAIRecommendations && userProfile && treatmentPlan && (
          <View style={{ marginHorizontal: 16, marginTop: 12 }}>
            <View style={styles.aiLoadingCard}>
              <MaterialCommunityIcons 
                name="alert-circle-outline" 
                size={24} 
                color="#F59E0B" 
              />
              <Text style={styles.aiLoadingText}>
                AI önerileri geçici olarak kapalı. Lütfen daha sonra tekrar deneyin.
              </Text>
            </View>
          </View>
        )}

          {/* Show More Button */}
          {filteredSessions.length > 0 && todaySessions.length > displayLimit && (
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
      </ScrollView>

      {/* FAB */}
      <FAB 
        icon="plus" 
        onPress={() => setIsQuickStartVisible(true)}
        position="fixed"
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
  // New Stats Card Styles
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

  // ✅ PRODUCTION: AI Recommendations Styles
  aiRecommendationsHeader: {
    marginBottom: 12,
  },
  aiRecommendationsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  aiRecommendationsScroll: {
    marginTop: 8,
  },
  aiRecommendationsContent: {
    paddingHorizontal: 4,
  },
  aiRecommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 280,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiRecommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  aiRecommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
    flex: 1,
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  aiRecommendationDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  aiRecommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiRecommendationDuration: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  aiRecommendationCategory: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  aiLoadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginLeft: 12,
    flex: 1,
  },

});
