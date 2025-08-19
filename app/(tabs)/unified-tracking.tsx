import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Pressable,
  Alert,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  interpolate,
  useSharedValue 
} from 'react-native-reanimated';

// Custom UI Components
import FAB from '@/components/ui/FAB';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CompulsionQuickEntry from '@/components/forms/CompulsionQuickEntry';
import { ERPQuickStart } from '@/components/erp/ERPQuickStart';
import { Toast } from '@/components/ui/Toast';

// Hooks & Services
import { useStandardizedCompulsion } from '@/hooks/useStandardizedData';
import { useGamificationStore } from '@/store/gamificationStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAI, useAIUserData, useAIActions } from '@/contexts/AIContext';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import { patternRecognitionV2 } from '@/features/ai/services/patternRecognitionV2';
import { erpRecommendationService } from '@/features/ai/services/erpRecommendationService';
import supabaseService from '@/services/supabase';
import { StorageKeys } from '@/utils/storage';
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';
import { getAllExercises, getExerciseById } from '@/constants/erpCategories';
import { mapToCanonicalCategory } from '@/utils/categoryMapping';
import enhancedAchievements from '@/services/enhancedAchievementService';

const { width: screenWidth } = Dimensions.get('window');

type TrackingMode = 'okb' | 'erp';

interface UnifiedStats {
  // OKB İstatistikleri
  totalCompulsions: number;
  avgResistance: number;
  todayCompulsions: number;
  weekCompulsions: number;
  
  // ERP İstatistikleri
  todayERPSessions: number;
  weekERPSessions: number;
  avgAnxietyReduction: number;
  totalERPTime: number;
  
  // Birleşik İstatistikler
  overallProgress: number;
  streak: number;
  lastActivity: Date | null;
}

interface ActivityItem {
  id: string;
  type: 'compulsion' | 'erp' | 'thought' | 'insight';
  title: string;
  subtitle?: string;
  timestamp: Date;
  icon: string;
  color: string;
  data?: any;
}

/**
 * Birleştirilmiş OKB ve ERP Takip Sayfası
 * Kullanıcının tüm terapi aktivitelerini tek bir yerden yönetmesini sağlar
 */
export default function UnifiedTrackingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  const { submitCompulsion } = useStandardizedCompulsion(user?.id);
  const { isInitialized: aiInitialized, availableFeatures } = useAI();
  const { generateInsights } = useAIActions();
  const { treatmentPlan, userProfile } = useAIUserData();
  
  // Ana state'ler
  const [mode, setMode] = useState<TrackingMode>('okb');
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showERPQuickStart, setShowERPQuickStart] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Animasyon değerleri
  const modeAnimation = useSharedValue(0);
  
  // Birleşik istatistikler
  const [stats, setStats] = useState<UnifiedStats>({
    totalCompulsions: 0,
    avgResistance: 0,
    todayCompulsions: 0,
    weekCompulsions: 0,
    todayERPSessions: 0,
    weekERPSessions: 0,
    avgAnxietyReduction: 0,
    totalERPTime: 0,
    overallProgress: 0,
    streak: 0,
    lastActivity: null,
  });
  
  // Birleşik aktivite listesi
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  
  // AI Öneriler
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  
  // Mod değişim animasyonu
  useEffect(() => {
    modeAnimation.value = withSpring(mode === 'okb' ? 0 : 1, {
      damping: 15,
      stiffness: 100,
    });
  }, [mode]);
  
  // Veri yükleme
  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      setRefreshing(true);
      
      // Paralel veri yükleme
      const [compulsionData, erpData, aiPatterns] = await Promise.all([
        loadCompulsionData(),
        loadERPData(),
        loadAIInsights(),
      ]);
      
      // İstatistikleri birleştir
      const unifiedStats = mergeStatistics(compulsionData, erpData);
      setStats(unifiedStats);
      
      // Aktiviteleri birleştir ve sırala
      const activities = mergeActivities(compulsionData.activities, erpData.activities);
      setRecentActivities(activities);
      
      // AI önerilerini güncelle
      if (aiPatterns) {
        setAiSuggestions(aiPatterns);
      }
      
      // Başarımları kontrol et
      await checkAchievements(unifiedStats);
      
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      showMessage('Veriler yüklenirken bir hata oluştu');
    } finally {
      setRefreshing(false);
    }
  };
  
  // OKB verilerini yükle
  const loadCompulsionData = async () => {
    const dateKey = new Date().toDateString();
    const storageKey = StorageKeys.COMPULSIONS(user?.id || '', dateKey);
    const data = await AsyncStorage.getItem(storageKey);
    
    if (data) {
      const compulsions = JSON.parse(data);
      // İstatistikleri hesapla
      return {
        total: compulsions.length,
        avgResistance: calculateAvgResistance(compulsions),
        activities: compulsions.map((c: any) => ({
          id: c.id,
          type: 'compulsion' as const,
          title: c.type,
          subtitle: `Direnç: ${c.resistanceLevel}/10`,
          timestamp: new Date(c.timestamp),
          icon: 'brain',
          color: '#6B46C1',
          data: c,
        })),
      };
    }
    
    return { total: 0, avgResistance: 0, activities: [] };
  };
  
  // ERP verilerini yükle
  const loadERPData = async () => {
    const dateKey = new Date().toDateString();
    const storageKey = StorageKeys.ERP_SESSIONS(user?.id || '', dateKey);
    const data = await AsyncStorage.getItem(storageKey);
    
    if (data) {
      const sessions = JSON.parse(data);
      // İstatistikleri hesapla
      return {
        total: sessions.length,
        avgAnxietyReduction: calculateAvgAnxietyReduction(sessions),
        totalTime: sessions.reduce((acc: number, s: any) => acc + s.durationSeconds, 0),
        activities: sessions.map((s: any) => ({
          id: s.id,
          type: 'erp' as const,
          title: s.exerciseName,
          subtitle: `${Math.floor(s.durationSeconds / 60)} dakika`,
          timestamp: new Date(s.completedAt),
          icon: 'heart-pulse',
          color: '#059669',
          data: s,
        })),
      };
    }
    
    return { total: 0, avgAnxietyReduction: 0, totalTime: 0, activities: [] };
  };
  
  // AI içgörülerini yükle
  const loadAIInsights = async () => {
    if (!aiInitialized || !availableFeatures?.patternRecognition) return null;
    
    try {
      const patterns = await patternRecognitionV2.analyzePatterns(user?.id || '');
      return patterns;
    } catch (error) {
      console.error('AI pattern analizi hatası:', error);
      return null;
    }
  };
  
  // İstatistikleri birleştir
  const mergeStatistics = (compulsionData: any, erpData: any): UnifiedStats => {
    const overallProgress = calculateOverallProgress(compulsionData, erpData);
    
    return {
      totalCompulsions: compulsionData.total,
      avgResistance: compulsionData.avgResistance,
      todayCompulsions: compulsionData.total,
      weekCompulsions: compulsionData.total * 7, // Basitleştirilmiş
      todayERPSessions: erpData.total,
      weekERPSessions: erpData.total * 7, // Basitleştirilmiş
      avgAnxietyReduction: erpData.avgAnxietyReduction,
      totalERPTime: erpData.totalTime,
      overallProgress,
      streak: calculateStreak(),
      lastActivity: getLastActivityTime([...compulsionData.activities, ...erpData.activities]),
    };
  };
  
  // Aktiviteleri birleştir ve sırala
  const mergeActivities = (compulsions: ActivityItem[], erpSessions: ActivityItem[]): ActivityItem[] => {
    const allActivities = [...compulsions, ...erpSessions];
    return allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
  };
  
  // Yardımcı fonksiyonlar
  const calculateAvgResistance = (compulsions: any[]) => {
    if (compulsions.length === 0) return 0;
    const sum = compulsions.reduce((acc, c) => acc + c.resistanceLevel, 0);
    return Math.round((sum / compulsions.length) * 10) / 10;
  };
  
  const calculateAvgAnxietyReduction = (sessions: any[]) => {
    if (sessions.length === 0) return 0;
    const reductions = sessions.map((s: any) => s.anxietyInitial - s.anxietyFinal);
    const avg = reductions.reduce((acc, r) => acc + r, 0) / sessions.length;
    return Math.round(avg * 10) / 10;
  };
  
  const calculateOverallProgress = (compulsionData: any, erpData: any) => {
    // Basit bir ilerleme hesaplaması
    const compulsionProgress = Math.min(compulsionData.avgResistance * 10, 100);
    const erpProgress = Math.min(erpData.avgAnxietyReduction * 20, 100);
    return Math.round((compulsionProgress + erpProgress) / 2);
  };
  
  const calculateStreak = () => {
    // TODO: Gerçek streak hesaplaması
    return 3;
  };
  
  const getLastActivityTime = (activities: ActivityItem[]) => {
    if (activities.length === 0) return null;
    return activities[0].timestamp;
  };
  
  const checkAchievements = async (stats: UnifiedStats) => {
    // Başarım kontrolü
    if (stats.todayCompulsions >= 5 && stats.todayERPSessions >= 2) {
      await enhancedAchievements.unlockAchievement('daily_warrior');
    }
  };
  
  const showMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };
  
  // Mod değiştirme
  const handleModeChange = (newMode: TrackingMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(newMode);
  };
  
  // FAB tıklama
  const handleFABPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (mode === 'okb') {
      setShowQuickEntry(true);
    } else {
      setShowERPQuickStart(true);
    }
  };
  
  // İlk yükleme
  useEffect(() => {
    loadData();
  }, [user?.id]);
  
  // Segmented Control animasyon stili
  const segmentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          modeAnimation.value,
          [0, 1],
          [0, screenWidth / 2 - 40]
        ),
      },
    ],
  }));
  
  // AI Öneriler Bileşeni
  const AIRecommendations = () => {
    if (!aiSuggestions.length) return null;
    
    const currentModeSuggestions = aiSuggestions.filter(s => 
      mode === 'okb' ? s.type === 'compulsion' : s.type === 'erp'
    );
    
    if (!currentModeSuggestions.length) return null;
    
    return (
      <Card style={styles.aiCard}>
        <View style={styles.aiHeader}>
          <MaterialCommunityIcons name="brain" size={20} color="#6B46C1" />
          <Text style={styles.aiTitle}>AI Destekli Öneriler</Text>
        </View>
        {currentModeSuggestions.slice(0, 2).map((suggestion, index) => (
          <Pressable
            key={index}
            style={styles.suggestionItem}
            onPress={() => {
              // Öneriyi uygula
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.suggestionText}>{suggestion.text}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </Pressable>
        ))}
      </Card>
    );
  };
  
  // İstatistik Kartı
  const StatsCard = () => {
    const displayStats = mode === 'okb' ? [
      { label: 'Bugün', value: stats.todayCompulsions, icon: 'counter' },
      { label: 'Ortalama Direnç', value: `${stats.avgResistance}/10`, icon: 'shield' },
      { label: 'Seri', value: `${stats.streak} gün`, icon: 'fire' },
    ] : [
      { label: 'Bugün', value: stats.todayERPSessions, icon: 'play-circle' },
      { label: 'Anksiyete Azalması', value: `${stats.avgAnxietyReduction}`, icon: 'trending-down' },
      { label: 'Toplam Süre', value: `${Math.floor(stats.totalERPTime / 60)}dk`, icon: 'timer' },
    ];
    
    return (
      <Card style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>📊 İstatistikler</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Günlük İlerleme</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stats.overallProgress}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{stats.overallProgress}%</Text>
          </View>
        </View>
        <View style={styles.statsGrid}>
          {displayStats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <MaterialCommunityIcons name={stat.icon as any} size={24} color="#6B46C1" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </Card>
    );
  };
  
  // Aktivite Listesi
  const ActivityList = () => {
    if (recentActivities.length === 0) {
      return (
        <Card style={styles.emptyCard}>
          <MaterialCommunityIcons name="calendar-blank" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Henüz aktivite kaydı yok</Text>
          <Text style={styles.emptySubtext}>
            {mode === 'okb' ? 'İlk kompulsiyon kaydınızı ekleyin' : 'İlk ERP egzersizinizi başlatın'}
          </Text>
        </Card>
      );
    }
    
    return (
      <Card style={styles.activityCard}>
        <Text style={styles.activityTitle}>📝 Son Aktiviteler</Text>
        {recentActivities.map((activity) => (
          <Pressable
            key={activity.id}
            style={styles.activityItem}
            onPress={() => {
              // Detay sayfasına git
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
              <MaterialCommunityIcons name={activity.icon as any} size={20} color={activity.color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityItemTitle}>{activity.title}</Text>
              {activity.subtitle && (
                <Text style={styles.activityItemSubtitle}>{activity.subtitle}</Text>
              )}
              <Text style={styles.activityTime}>
                {formatTime(activity.timestamp)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
          </Pressable>
        ))}
      </Card>
    );
  };
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    
    return date.toLocaleDateString('tr-TR');
  };
  
  return (
    <ScreenLayout>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık ve Mod Seçici */}
        <View style={styles.header}>
          <Text style={styles.title}>Terapi Takibi</Text>
          <Text style={styles.subtitle}>
            {stats.lastActivity 
              ? `Son aktivite: ${formatTime(stats.lastActivity)}`
              : 'Bugüne güçlü bir başlangıç yapın'}
          </Text>
          
          {/* Segmented Control */}
          <View style={styles.segmentedControl}>
            <Animated.View style={[styles.segmentIndicator, segmentAnimatedStyle]} />
            <Pressable
              style={styles.segmentButton}
              onPress={() => handleModeChange('okb')}
            >
              <MaterialCommunityIcons 
                name="brain" 
                size={20} 
                color={mode === 'okb' ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.segmentText,
                mode === 'okb' && styles.segmentTextActive
              ]}>
                OKB Takibi
              </Text>
            </Pressable>
            <Pressable
              style={styles.segmentButton}
              onPress={() => handleModeChange('erp')}
            >
              <MaterialCommunityIcons 
                name="heart-pulse" 
                size={20} 
                color={mode === 'erp' ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.segmentText,
                mode === 'erp' && styles.segmentTextActive
              ]}>
                ERP Takibi
              </Text>
            </Pressable>
          </View>
        </View>
        
        {/* AI Öneriler */}
        <AIRecommendations />
        
        {/* İstatistikler */}
        <StatsCard />
        
        {/* Aktivite Listesi */}
        <ActivityList />
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Floating Action Button */}
      <FAB
        icon={mode === 'okb' ? 'plus' : 'play'}
        onPress={handleFABPress}
        style={styles.fab}
      />
      
      {/* Quick Entry Modals */}
      {showQuickEntry && (
        <CompulsionQuickEntry
          visible={showQuickEntry}
          onClose={() => setShowQuickEntry(false)}
          onSubmit={async (data) => {
            await submitCompulsion(data);
            setShowQuickEntry(false);
            loadData();
            showMessage('Kompulsiyon kaydedildi');
          }}
        />
      )}
      
      {showERPQuickStart && (
        <ERPQuickStart
          visible={showERPQuickStart}
          onClose={() => setShowERPQuickStart(false)}
          onStart={(exercise) => {
            setShowERPQuickStart(false);
            // ERP oturumunu başlat
            showMessage('ERP egzersizi başlatıldı');
          }}
        />
      )}
      
      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onDismiss={() => setShowToast(false)}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: (screenWidth - 48) / 2,
    height: 40,
    backgroundColor: '#6B46C1',
    borderRadius: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    zIndex: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  aiCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
  },
  statsHeader: {
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  progressContainer: {
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B46C1',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: '#6B46C1',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  activityItemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
});