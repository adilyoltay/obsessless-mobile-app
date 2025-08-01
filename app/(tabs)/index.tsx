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
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

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
import { router } from 'expo-router';

// Storage utility
import { StorageKeys } from '@/utils/storage';

const { width } = Dimensions.get('window');

export default function TodayScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
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
      const erpData = await AsyncStorage.getItem(erpKey);
      const todayErpSessions = erpData ? JSON.parse(erpData) : [];
      
      setTodayStats({
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
    
    const nextMilestone = milestones.find(m => m.points > profile.healingPointsTotal);
    const progressToNext = nextMilestone 
      ? (profile.healingPointsTotal / nextMilestone.points) * 100
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
        <LinearGradient
          colors={['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          {/* Streak Display */}
          <View style={styles.streakContainer}>
            <StreakCounter />
          </View>

          {/* Main Points Display */}
          <View style={styles.mainPointsContainer}>
            <MaterialCommunityIcons name="star" size={48} color="#FEF3C7" />
            <Text style={styles.mainPointsValue}>{profile.healingPointsTotal}</Text>
            <Text style={styles.mainPointsLabel}>Healing Points</Text>
          </View>

          {/* Progress to Next Level */}
          {nextMilestone && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Sonraki Seviye: {nextMilestone.name}</Text>
                <Text style={styles.progressValue}>
                  {profile.healingPointsTotal} / {nextMilestone.points}
                </Text>
              </View>
              <ProgressBar 
                progress={progressToNext / 100} 
                style={styles.progressBar}
              />
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderDailyMissions = () => (
    <View style={styles.missionsSection}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="heart-outline" size={24} color="#10B981" />
        <Text style={styles.sectionTitle}>Bugün için öneriler</Text>
      </View>

      <View style={styles.missionsList}>
        {/* Mission 1: Compulsion Tracking */}
        <Pressable 
          style={[styles.missionCard, todayStats.compulsions >= 3 && styles.missionCompleted]}
          onPress={() => router.push('/(tabs)/tracking')}
        >
          <View style={styles.missionIcon}>
            <MaterialCommunityIcons 
              name={todayStats.compulsions >= 3 ? "check-circle" : "heart-outline"} 
              size={32} 
              color={todayStats.compulsions >= 3 ? "#10B981" : "#9CA3AF"} 
            />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>Bugünkü Yolculuğun</Text>
            <View style={styles.missionProgress}>
              <ProgressBar 
                progress={Math.min(todayStats.compulsions / 3, 1)} 
                style={styles.missionProgressBar}
              />
              <Text style={styles.missionProgressText}>{todayStats.compulsions}/3 kayıt</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star-outline" size={20} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+50</Text>
          </View>
        </Pressable>

        {/* Mission 2: ERP Session */}
        <Pressable 
          style={[styles.missionCard, todayStats.erpSessions >= 1 && styles.missionCompleted]}
          onPress={() => router.push('/(tabs)/erp')}
        >
          <View style={styles.missionIcon}>
            <MaterialCommunityIcons 
              name={todayStats.erpSessions >= 1 ? "check-circle" : "heart-outline"} 
              size={32} 
              color={todayStats.erpSessions >= 1 ? "#10B981" : "#9CA3AF"} 
            />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>İyileşme Adımın</Text>
            <View style={styles.missionProgress}>
              <ProgressBar 
                progress={Math.min(todayStats.erpSessions / 1, 1)} 
                style={styles.missionProgressBar}
              />
              <Text style={styles.missionProgressText}>{todayStats.erpSessions}/1 oturum</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star-outline" size={20} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+100</Text>
          </View>
        </Pressable>

        {/* Mission 3: Resistance */}
        <Pressable 
          style={[styles.missionCard, todayStats.resistanceWins >= 2 && styles.missionCompleted]}
          onPress={() => router.push('/(tabs)/tracking')}
        >
          <View style={styles.missionIcon}>
            <MaterialCommunityIcons 
              name={todayStats.resistanceWins >= 2 ? "check-circle" : "circle-outline"} 
              size={32} 
              color={todayStats.resistanceWins >= 2 ? "#10B981" : "#9CA3AF"} 
            />
          </View>
          <View style={styles.missionContent}>
            <Text style={styles.missionTitle}>Direnç Zaferi</Text>
            <Text style={styles.missionDescription}>2 kez yüksek direnç göster</Text>
            <View style={styles.missionProgress}>
              <ProgressBar 
                progress={Math.min(todayStats.resistanceWins / 2, 1)} 
                style={styles.missionProgressBar}
              />
              <Text style={styles.missionProgressText}>{todayStats.resistanceWins}/2</Text>
            </View>
          </View>
          <View style={styles.missionReward}>
            <MaterialCommunityIcons name="star" size={20} color="#F59E0B" />
            <Text style={styles.missionRewardText}>+75</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderQuickStats = () => (
    <View style={styles.quickStatsSection}>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="calendar-today" size={24} color="#10B981" />
        <Text style={styles.quickStatValue}>{profile.healingPointsToday}</Text>
        <Text style={styles.quickStatLabel}>Bugün</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="fire" size={24} color="#F59E0B" />
        <Text style={styles.quickStatValue}>{profile.streakCurrent}</Text>
        <Text style={styles.quickStatLabel}>Seri</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="shield-check" size={24} color="#3B82F6" />
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
        {renderDailyMissions()}
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
  },
  heroSection: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroGradient: {
    padding: 20,
    borderRadius: 12,
  },
  streakContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mainPointsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mainPointsValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FEF3C7',
    fontFamily: 'Inter-Bold',
    marginTop: 8,
  },
  mainPointsLabel: {
    fontSize: 18,
    color: '#FEF3C7',
    fontFamily: 'Inter-Medium',
  },
  progressContainer: {
    marginTop: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 16,
    color: '#FEF3C7',
    fontFamily: 'Inter-Medium',
  },
  progressValue: {
    fontSize: 16,
    color: '#FEF3C7',
    fontFamily: 'Inter-Medium',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
  },
  missionsSection: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  missionsList: {
    flexDirection: 'column',
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  missionCompleted: {
    backgroundColor: '#E0F2F7',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  missionIcon: {
    width: 50,
    alignItems: 'center',
    marginRight: 16,
  },
  missionContent: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  missionDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  missionProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  missionProgressText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  missionReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  missionRewardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  quickStatsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  quickStatCard: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  achievementsSection: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  seeAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
    fontFamily: 'Inter-Medium',
    marginRight: 8,
  },
  bottomSpacing: {
    height: 100,
  },
});