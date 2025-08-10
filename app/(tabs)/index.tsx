import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  View, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Dimensions,
  Pressable,
  Animated
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

// Custom UI Components
import { Toast } from '@/components/ui/Toast';
import { ProgressBar } from '@/components/ui/ProgressBar';

// Gamification Components
import { StreakCounter } from '@/components/gamification/StreakCounter';
import { AchievementBadge } from '@/components/gamification/AchievementBadge';
import { MicroRewardAnimation } from '@/components/gamification/MicroRewardAnimation';

// Hooks & Utils
import { useTranslation } from '@/hooks/useTranslation';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Stores
import { useGamificationStore } from '@/store/gamificationStore';
// Storage utility
import { StorageKeys } from '@/utils/storage';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// AI Integration - Sprint 7 via Context
import { useAI, useAIUserData, useAIActions } from '@/contexts/AIContext';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Art Therapy Integration - temporarily disabled
// Risk assessment UI removed

const { width } = Dimensions.get('window');

export default function TodayScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // AI Integration via Context
  const { isInitialized: aiInitialized, availableFeatures } = useAI();
  const { hasCompletedOnboarding } = useAIUserData();
  const { generateInsights } = useAIActions();
  
  // Local AI State
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Gamification store
  const { 
    profile, 
    lastMicroReward,
    achievements
  } = useGamificationStore();

  // Today's stats
  const [todayStats, setTodayStats] = useState({
    compulsions: 0,
    erpSessions: 0,
    healingPoints: 0,
    resistanceWins: 0
  });



  // Load data on mount
  useEffect(() => {
    if (user?.id) {
      onRefresh();
    }
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [user?.id]);

  // Refresh stats when screen is focused (after returning from ERP session or other screens)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 Today screen focused, refreshing stats...');
        onRefresh();
      }
    }, [user?.id])
  );

  /**
   * 🎨 Render Art Therapy Widget
   */
  const renderArtTherapyWidget = () => {
    if (!FEATURE_FLAGS.isEnabled('AI_ART_THERAPY') || !user?.id) {
      return null;
    }

    return (
      <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="palette" size={24} color="#8b5cf6" />
          <Text style={styles.sectionTitle}>Sanat Terapisi</Text>
        </View>

        <Pressable 
          style={styles.artTherapyCard}
          onPress={() => {
            router.push('/(auth)/art-therapy');
          }}
        >
          <View style={styles.artTherapyContent}>
            <MaterialCommunityIcons name="brush" size={32} color="#8b5cf6" />
            <View style={styles.artTherapyInfo}>
              <Text style={styles.artTherapyTitle}>Duygu Resmi Çiz</Text>
              <Text style={styles.artTherapyDescription}>
                Bugünkü hislerinizi renkler ve şekillerle ifade edin
              </Text>
              <View style={styles.artTherapyTags}>
                <Text style={styles.artTag}>Rahatlatıcı</Text>
                <Text style={styles.artTag}>Yaratıcı</Text>
                <Text style={styles.artTag}>Terapötik</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#8b5cf6" />
          </View>
        </Pressable>
      </View>
    );
  };

  /**
   * 🛡️ Render Risk Assessment Section
   */
  // Risk section removed

  /**
   * 🤖 Load AI Insights via Context
   */
  const loadAIInsights = async () => {
    if (!user?.id || !aiInitialized || !availableFeatures.includes('AI_INSIGHTS')) {
      return;
    }

    try {
      setAiInsightsLoading(true);

      // Track insights request
      await trackAIInteraction(AIEventType.INSIGHTS_REQUESTED, {
        userId: user.id,
        source: 'home_screen',
        timestamp: new Date().toISOString()
      });

      // Generate insights using AI context
      const insights = await generateInsights();
      setAiInsights(insights || []);

      // Track insights delivered
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId: user.id,
        insightsCount: insights?.length || 0,
        source: 'home_screen'
      });

    } catch (error) {
      console.error('❌ Error loading AI insights:', error);
      // Fail silently, don't impact main app functionality
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    try {
      if (!user?.id) {
        setRefreshing(false);
        return;
      }

      // Load today's compulsions
      const compulsionsKey = StorageKeys.COMPULSIONS(user.id);
      const compulsionsData = await AsyncStorage.getItem(compulsionsKey);
      const allCompulsions = compulsionsData ? JSON.parse(compulsionsData) : [];
      const today = new Date().toDateString();
      const todayCompulsions = allCompulsions.filter((c: any) => 
        new Date(c.timestamp).toDateString() === today
      );
      
      // Calculate resistance wins
      const resistanceWins = todayCompulsions.filter((c: any) => c.resistanceLevel >= 3).length;
      
      // Load today's ERP sessions
      const erpKey = StorageKeys.ERP_SESSIONS(user.id, today);
      console.log('🔑 Today page loading ERP with key:', erpKey);
      
      const erpData = await AsyncStorage.getItem(erpKey);
      const todayErpSessions = erpData ? JSON.parse(erpData) : [];
      
      console.log('📊 Today page ERP sessions:', todayErpSessions);
      console.log('📊 Today page ERP count:', todayErpSessions.length);
      
      setTodayStats({
        compulsions: todayCompulsions.length,
        erpSessions: todayErpSessions.length,
        healingPoints: profile.healingPointsToday,
        resistanceWins
      });

      // Load AI Insights if enabled
      await loadAIInsights();
      
      console.log('📊 Today stats updated:', {
        compulsions: todayCompulsions.length,
        erpSessions: todayErpSessions.length,
        healingPoints: profile.healingPointsToday,
        resistanceWins
      });
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeroSection = () => {
    // Simple milestone calculation
    const milestones = [
      { points: 100, name: 'Başlangıç' },
      { points: 500, name: 'Öğrenci' },
      { points: 1000, name: 'Usta' },
      { points: 2500, name: 'Uzman' },
      { points: 5000, name: 'Kahraman' }
    ];
    
    const currentMilestone = milestones.reduce((prev, curr) => 
      profile.healingPointsTotal >= curr.points ? curr : prev,
      milestones[0]
    );
    const nextMilestone = milestones.find(m => m.points > profile.healingPointsTotal) || milestones[milestones.length - 1];
    const progressToNext = nextMilestone 
      ? ((profile.healingPointsTotal - (currentMilestone.points === nextMilestone.points ? 0 : currentMilestone.points)) / 
         (nextMilestone.points - (currentMilestone.points === nextMilestone.points ? 0 : currentMilestone.points))) * 100
      : 100;

    return (
      <Animated.View 
        style={[
          styles.heroSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Main Points Display */}
        <View style={styles.mainPointsContainer}>
          <MaterialCommunityIcons name="star-outline" size={50} color="white" />
          <Text style={styles.mainPointsValue}>{profile.healingPointsTotal}</Text>
          <Text style={styles.mainPointsLabel}>Healing Points</Text>
        </View>

        {/* Progress to Next Level */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Sonraki Seviye: {nextMilestone.name}</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${Math.min(progressToNext, 100)}%` }]} />
          </View>
          <Text style={styles.progressValue}>
            {profile.healingPointsTotal} / {nextMilestone.points}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderDailyMissions = () => (
    <View style={styles.missionsSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="heart-outline" size={20} color="#10B981" />
        <Text style={styles.sectionTitle}>Bugün için öneriler</Text>
      </View>

      <View style={styles.missionsList}>
        {/* Mission 1: Compulsion Tracking */}
        <Pressable 
          style={styles.missionCard}
          onPress={() => router.push('/(tabs)/tracking')}
        >
          <View style={styles.missionIcon}>
            <MaterialCommunityIcons 
              name={todayStats.compulsions >= 3 ? "heart" : "heart-outline"} 
              size={30} 
              color={todayStats.compulsions >= 3 ? "#10B981" : "#D1D5DB"} 
            />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>Bugünkü Yolculuğun</Text>
            <View style={styles.missionProgress}>
              <View style={styles.missionProgressBar}>
                <View style={[styles.missionProgressFill, { width: `${Math.min((todayStats.compulsions / 3) * 100, 100)}%` }]} />
              </View>
              <Text style={styles.missionProgressText}>{todayStats.compulsions}/3 kayıt</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+50</Text>
          </View>
        </Pressable>

        {/* Mission 2: ERP Session */}
        <Pressable 
          style={styles.missionCard}
          onPress={() => router.push('/(tabs)/erp')}
        >
          <View style={styles.missionIcon}>
            <MaterialCommunityIcons 
              name={todayStats.erpSessions >= 1 ? "heart" : "heart-outline"} 
              size={30} 
              color={todayStats.erpSessions >= 1 ? "#10B981" : "#D1D5DB"} 
            />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>İyileşme Adımın</Text>
            <View style={styles.missionProgress}>
              <View style={styles.missionProgressBar}>
                <View style={[styles.missionProgressFill, { width: `${Math.min((todayStats.erpSessions / 1) * 100, 100)}%` }]} />
              </View>
              <Text style={styles.missionProgressText}>{todayStats.erpSessions}/1 oturum</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+100</Text>
          </View>
        </Pressable>

        {/* Mission 3: Resistance */}
        <Pressable 
          style={styles.missionCard}
          onPress={() => router.push('/(tabs)/tracking')}
        >
          <View style={styles.missionIconCircle}>
            <View style={[styles.missionCircle, todayStats.resistanceWins >= 2 && styles.missionCircleCompleted]} />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>Direnç Zaferi</Text>
            <Text style={styles.missionDescription}>2 kez yüksek direnç göster</Text>
            <View style={styles.missionProgress}>
              <View style={styles.missionProgressBar}>
                <View style={[styles.missionProgressFill, { width: `${Math.min((todayStats.resistanceWins / 2) * 100, 100)}%` }]} />
              </View>
              <Text style={styles.missionProgressText}>{todayStats.resistanceWins}/2</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+75</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  /**
   * 🤖 Render AI Insights Widget
   */
  const renderAIInsights = () => {
    if (!FEATURE_FLAGS.isEnabled('AI_INSIGHTS') || !user?.id) {
      return null;
    }

    return (
      <View style={styles.aiInsightsSection}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="brain" size={24} color="#3b82f6" />
          <Text style={styles.sectionTitle}>AI İçgörüleri</Text>
          {aiInsightsLoading && (
            <MaterialCommunityIcons name="loading" size={16} color="#6b7280" />
          )}
        </View>

        {/* AI Onboarding CTA */}
        {!hasCompletedOnboarding && (
          <Pressable 
            style={styles.aiOnboardingCTA}
            onPress={() => router.push({
              pathname: '/(auth)/ai-onboarding',
              params: { fromSettings: 'false', resume: 'true' }
            })}
          >
            <View style={styles.aiOnboardingCTAContent}>
              <MaterialCommunityIcons name="rocket-launch" size={32} color="#3b82f6" />
              <View style={styles.aiOnboardingCTAText}>
                <Text style={styles.aiOnboardingCTATitle}>AI Destekli Değerlendirme</Text>
                <Text style={styles.aiOnboardingCTASubtitle}>
                  Size özel tedavi planı ve içgörüler için AI onboarding'i tamamlayın. Kaldığın yerden devam edebilirsin.
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#3b82f6" />
            </View>
          </Pressable>
        )}

        {/* AI Insights Cards */}
        {hasCompletedOnboarding && aiInsights.length > 0 && (
          <View style={styles.aiInsightsContainer}>
            {aiInsights.slice(0, 2).map((insight, index) => (
              <View key={index} style={styles.aiInsightCard}>
                <View style={styles.aiInsightHeader}>
                  <MaterialCommunityIcons 
                    name={insight.type === 'pattern' ? 'chart-line' : 'lightbulb'} 
                    size={20} 
                    color="#10b981" 
                  />
                  <Text style={styles.aiInsightType}>{insight.category || 'İçgörü'}</Text>
                </View>
                <Text style={styles.aiInsightText}>{insight.message}</Text>
                {insight.confidence && (
                  <View style={styles.aiInsightMeta}>
                    <Text style={styles.aiInsightConfidence}>
                      Güvenilirlik: {Math.round(insight.confidence * 100)}%
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* No Insights State */}
        {FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2') && aiInsights.length === 0 && !aiInsightsLoading && (
          <View style={styles.noInsightsCard}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={32} color="#9ca3af" />
            <Text style={styles.noInsightsText}>
              Daha fazla veri toplandıkça kişisel içgörüler burada görünecek
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderQuickStats = () => (
    <View style={styles.quickStatsSection}>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="calendar-today" size={30} color="#10B981" />
        <Text style={styles.quickStatValue}>{todayStats.compulsions}</Text>
        <Text style={styles.quickStatLabel}>Today</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="fire" size={30} color="#F59E0B" />
        <Text style={styles.quickStatValue}>{profile.streakCurrent}</Text>
        <Text style={styles.quickStatLabel}>Streak</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="check-circle" size={30} color="#3B82F6" />
        <Text style={styles.quickStatValue}>{todayStats.erpSessions}</Text>
        <Text style={styles.quickStatLabel}>ERP</Text>
      </View>
    </View>
  );

  const renderAchievements = () => {
    // Merge achievements with unlocked status from profile
    const achievementsWithStatus = achievements.map(achievement => ({
      ...achievement,
      unlockedAt: profile.unlockedAchievements.includes(achievement.id) ? new Date() : undefined
    }));

    // Sort: unlocked first, then by rarity
    const sortedAchievements = achievementsWithStatus.sort((a, b) => {
      if (a.unlockedAt && !b.unlockedAt) return -1;
      if (!a.unlockedAt && b.unlockedAt) return 1;
      if (a.rarity === 'Epic' && b.rarity !== 'Epic') return -1;
      if (a.rarity !== 'Epic' && b.rarity === 'Epic') return 1;
      return 0;
    });

    const displayAchievements = sortedAchievements.slice(0, 6); // Show max 6
    const unlockedCount = profile.unlockedAchievements.length;

    return (
      <View style={styles.achievementsSection}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="trophy" size={24} color="#F59E0B" />
          <Text style={styles.sectionTitle}>Başarımlarım ({unlockedCount}/{achievements.length})</Text>
        </View>
        
        <View style={styles.achievementGrid}>
          {displayAchievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              isUnlocked={!!achievement.unlockedAt}
              onPress={() => {
                setToastMessage(
                  achievement.unlockedAt 
                    ? `🏆 ${achievement.title} - ${achievement.description}` 
                    : `🔒 ${achievement.title} - Henüz açılmadı`
                );
                setShowToast(true);
              }}
            />
          ))}
        </View>
        
        {unlockedCount > 6 && (
          <Pressable 
            style={styles.seeAllButton}
            onPress={() => {
              setToastMessage('Yakında: Tüm başarımları görüntüleme');
              setShowToast(true);
            }}
          >
            <Text style={styles.seeAllText}>Tümünü Gör</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#6B7280" />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScreenLayout>


      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeroSection()}
        {renderQuickStats()}
        {/* Risk section removed */}
        {renderArtTherapyWidget()}
        {renderDailyMissions()}
        {renderAIInsights()}
        {renderAchievements()}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={showToast && toastMessage.includes('hata') ? 'error' : 'success'}
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
      
      {/* Micro Reward Animation */}
      {lastMicroReward && (
        <MicroRewardAnimation 
          reward={lastMicroReward}
          onComplete={() => {}}
        />
      )}


    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  heroSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  mainPointsContainer: {
    alignItems: 'center',
  },
  mainPointsValue: {
    fontSize: 50,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  mainPointsLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressContainer: {
    width: '100%',
    marginTop: 24,
  },
  progressLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginBottom: 4,
    opacity: 0.9,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'right',
    opacity: 0.9,
  },
  missionsSection: {
    marginTop: 4,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
  missionsList: {
    flexDirection: 'column',
    gap: 16,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  missionIcon: {
    marginRight: 16,
  },
  missionIconCircle: {
    marginRight: 16,
  },
  missionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  missionCircleCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  missionContent: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  missionDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  missionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  missionProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  missionProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  missionProgressText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    minWidth: 50,
  },
  missionReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  missionRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    fontFamily: 'Inter-Semibold',
    marginLeft: 4,
  },
  quickStatsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 24,
  },
  quickStatCard: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  achievementsSection: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
    marginRight: 4,
  },
  bottomSpacing: {
    height: 100,
  },
  
  // AI Insights Styles
  aiInsightsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  aiOnboardingCTA: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  aiOnboardingCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiOnboardingCTAText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  aiOnboardingCTATitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  aiOnboardingCTASubtitle: {
    fontSize: 14,
    color: '#3b82f6',
    lineHeight: 20,
  },
  aiInsightsContainer: {
    gap: 12,
  },
  aiInsightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiInsightType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  aiInsightText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  aiInsightMeta: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  aiInsightConfidence: {
    fontSize: 11,
    color: '#6b7280',
  },
  noInsightsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noInsightsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  
  // Art Therapy Styles
  artTherapyCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#c4b5fd',
  },
  artTherapyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  artTherapyInfo: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  artTherapyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6b21a8',
    marginBottom: 6,
  },
  artTherapyDescription: {
    fontSize: 14,
    color: '#7c3aed',
    lineHeight: 20,
    marginBottom: 12,
  },
  artTherapyTags: {
    flexDirection: 'row',
    gap: 8,
  },
  artTag: {
    fontSize: 12,
    color: '#8b5cf6',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});