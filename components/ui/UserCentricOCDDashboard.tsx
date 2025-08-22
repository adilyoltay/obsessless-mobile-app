/**
 * 📊 User-Centric OCD Dashboard
 * 
 * CBT ve Mood dashboard'larına benzer yaklaşımla, kullanıcı odaklı
 * OCD recovery journey, pattern analysis ve assessment history sunar.
 * 
 * Master Prompt Principles:
 * - Sakinlik: Yumuşak renkler, anxiety-friendly design
 * - Güç Kullanıcıda: Kullanıcı kontrollü insights, şeffaflık
 * - Zahmetsizlik: Tek tıkla navigation, otomatik data processing
 * 
 * v2.1 - Ocak 2025 Implementation
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { turkishOCDCulturalService } from '@/features/ai/services/turkishOcdCulturalService';

// Types
interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  timestamp: Date;
  duration?: number;
  trigger?: string;
  notes?: string;
}

interface OCDJourney {
  recoveryStory: {
    daysInRecovery: number;
    compulsionsTracked: number;
    resistanceGrowth: 'başlangıç' | 'gelişiyor' | 'güçlü' | 'uzman';
    currentStreak: number;
    ybocsImprovement: number;
  };
  personalInsights: {
    dominantCategory: string;
    strongestPattern: string;
    biggestTrigger: string;
    resistanceProgress: string;
    nextMilestone: string;
  };
  achievements: Achievement[];
  encouragement: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  date: Date;
}

interface UserCentricOCDDashboardProps {
  visible: boolean;
  onClose: () => void;
  compulsions: CompulsionEntry[];
  ybocsHistory: any[];
  userId: string;
  onStartAction?: (actionId: string) => void;
}

const { width } = Dimensions.get('window');

// Master Prompt Compliant Color Palette (Ultra Anxiety-Friendly & Calming)
const COLORS = {
  // Sakinlik: Extremely soft, therapeutic colors
  background: '#FEFEFE',        // Pure, calming white
  cardBackground: '#FBFCFD',    // Barely-there off-white
  softEmerald: '#10B981',       // Gentle progress green (less intense)
  softAmber: '#F59E0B',         // Warm, non-alarming amber
  softRose: '#F87171',          // Gentle coral (not harsh red)
  gentleBlue: '#60A5FA',        // Calm sky blue (less intense)
  whisperGray: '#9CA3AF',       // Softer gray for secondary text
  cloudGray: '#F3F4F6',         // Ultra-light borders
  warmBeige: '#FFFBEB',         // Cream achievement backgrounds
  mintGreen: '#F0FDF4',         // Whisper-soft success backgrounds
  lavenderMist: '#FAF5FF',      // Ultra-gentle lavender
  therapeuticBlue: '#EFF6FF',   // Calming therapy blue
};

export default function UserCentricOCDDashboard({
  visible,
  onClose,
  compulsions,
  ybocsHistory,
  userId,
  onStartAction
}: UserCentricOCDDashboardProps) {
  const [selectedTab, setSelectedTab] = useState<'journey' | 'patterns' | 'assessment' | 'triggers'>('journey');
  const [ocdJourney, setOCDJourney] = useState<OCDJourney | null>(null);

  // DEBUG: Log incoming props
  useEffect(() => {
    console.log('🔍 UserCentricOCDDashboard Props Debug:');
    console.log('- compulsions:', compulsions?.length || 0, 'entries');
    console.log('- ybocsHistory:', ybocsHistory?.length || 0, 'assessments');
    console.log('- userId:', userId || 'NO USER ID');
    console.log('- First compulsion sample:', compulsions?.[0]);
  }, [compulsions, ybocsHistory, userId]);

  // Generate dynamic OCD journey data
  const generateOCDJourneyData = useMemo(() => {
    // Always return some data, even with empty compulsions
    if (!compulsions.length) {
      return {
        recoveryStory: {
          daysInRecovery: 0,
          compulsionsTracked: 0,
          resistanceGrowth: 'başlangıç' as const,
          currentStreak: 0,
          ybocsImprovement: 0,
        },
        personalInsights: {
          dominantCategory: 'Henüz veri yok',
          resistanceProgress: 'Takibe başlamak için ilk kaydınızı girin',
          nextMilestone: 'İlk kaydınızı oluşturun'
        },
        achievements: [],
        encouragement: 'Hoş geldiniz! OKB recovery journey\'nize başlamak için harika bir adım attınız. 💪'
      };
    }

    // Calculate recovery metrics
    const firstEntry = compulsions[0];
    const daysInRecovery = Math.floor(
      (new Date().getTime() - new Date(firstEntry.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate current streak (consecutive days with resistance > 5)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    });

    let currentStreak = 0;
    for (const dayString of last7Days) {
      const dayEntries = compulsions.filter(c => 
        new Date(c.timestamp).toDateString() === dayString
      );
      const avgResistance = dayEntries.length > 0 
        ? dayEntries.reduce((sum, c) => sum + c.resistanceLevel, 0) / dayEntries.length 
        : 0;
      
      if (avgResistance >= 5) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Average resistance improvement calculation
    const recentEntries = compulsions.slice(-10);
    const olderEntries = compulsions.slice(-20, -10);
    const recentAvg = recentEntries.reduce((sum, c) => sum + c.resistanceLevel, 0) / recentEntries.length;
    const olderAvg = olderEntries.length > 0 
      ? olderEntries.reduce((sum, c) => sum + c.resistanceLevel, 0) / olderEntries.length 
      : recentAvg;

    // Resistance growth assessment
    let resistanceGrowth: 'başlangıç' | 'gelişiyor' | 'güçlü' | 'uzman' = 'başlangıç';
    if (recentAvg >= 8) resistanceGrowth = 'uzman';
    else if (recentAvg >= 6.5) resistanceGrowth = 'güçlü';
    else if (recentAvg > olderAvg) resistanceGrowth = 'gelişiyor';

    // Y-BOCS improvement calculation
    const ybocsImprovement = ybocsHistory.length > 1 
      ? ybocsHistory[0].totalScore - ybocsHistory[ybocsHistory.length - 1].totalScore
      : 0;

    // Dynamic pattern analysis
    const categoryCount = compulsions.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'genel';

    // Trigger analysis
    const triggerCount = compulsions
      .filter(c => c.trigger)
      .reduce((acc, c) => {
        acc[c.trigger!] = (acc[c.trigger!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const biggestTrigger = Object.entries(triggerCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'belirlenmedi';

    // Generate achievements based on real progress
    const achievements: Achievement[] = [];
    
    if (compulsions.length >= 1) {
      achievements.push({
        id: 'first_tracking',
        title: 'OKB Takip Yolculuğu Başladı',
        description: 'İlk kompülsiyon kaydını oluşturdun',
        icon: 'flag',
        color: COLORS.gentleBlue,
        date: new Date(firstEntry.timestamp)
      });
    }

    if (compulsions.length >= 10) {
      achievements.push({
        id: 'tracking_master',
        title: 'Takip Uzmanı',
        description: '10+ kompülsiyon kaydı oluşturdun',
        icon: 'chart-line',
        color: COLORS.softEmerald,
        date: new Date(compulsions[9].timestamp)
      });
    }

    if (currentStreak >= 3) {
      achievements.push({
        id: 'resistance_streak',
        title: 'Direnç Serisi',
        description: `${currentStreak} gün üst üste yüksek direnç`,
        icon: 'fire',
        color: COLORS.softAmber,
        date: new Date()
      });
    }

    if (ybocsImprovement > 0) {
      achievements.push({
        id: 'ybocs_improvement',
        title: 'Y-BOCS İyileşmesi',
        description: `${ybocsImprovement} puan iyileşme`,
        icon: 'trophy',
        color: COLORS.softEmerald,
        date: ybocsHistory[ybocsHistory.length - 1]?.timestamp 
          ? new Date(ybocsHistory[ybocsHistory.length - 1].timestamp) 
          : new Date()
      });
    }

    // Dynamic encouragement based on progress with Turkish cultural sensitivity
    let encouragement = 'OKB ile mücadelende güçlü adımlar atıyorsun.';
    
    // Apply Turkish cultural adaptations for encouragement
    const culturallyAdaptedEncouragement = async () => {
      try {
        const culturalAnalysis = await turkishOCDCulturalService.analyzeTurkishCulturalFactors(
          userId,
          compulsions
        );
        
        // Adapt encouragement based on cultural context
        if (culturalAnalysis.religiousAnalysis.isPresent) {
          if (resistanceGrowth === 'uzman') {
            return 'Mükemmel! Allah\'ın izniyle direnç becerilerin gelişiyor. Bu sabır ve azmin meyveleri.';
          } else if (resistanceGrowth === 'güçlü') {
            return 'İnşallah, güçlü direnç göstermen harika. Bu süreçte sabırlı olmaya devam et.';
          }
        } else {
          // Secular cultural adaptations
          if (resistanceGrowth === 'uzman') {
            encouragement = 'Harika! Direnç seviyendeki uzman seviye ilerleme göz kamaştırıyor. Bu motivasyonu koru!';
          } else if (resistanceGrowth === 'güçlü') {
            encouragement = 'Mükemmel gelişim gösteriyorsun! Direnç becerilerin güçleniyor.';
          }
        }
        
        return encouragement;
      } catch (error) {
        console.warn('Cultural adaptation for encouragement failed:', error);
        return encouragement;
      }
    };

    if (resistanceGrowth === 'uzman') {
      encouragement = 'Harika! Direnç seviyendeki uzman seviye ilerleme göz kamaştırıyor. Bu motivasyonu koru!';
    } else if (resistanceGrowth === 'güçlü') {
      encouragement = 'Mükemmel gelişim gösteriyorsun! Direnç becerilerin güçleniyor.';
    } else if (resistanceGrowth === 'gelişiyor') {
      encouragement = 'İlerleme kaydediyorsun! Her gün biraz daha güçleniyorsun.';
    } else if (currentStreak > 0) {
      encouragement = `${currentStreak} günlük direnç serien harika! Böyle devam et.`;
    } else if (compulsions.length > 0) {
      encouragement = 'Takip etmek önemli bir adım. Her kayıt seni iyileşmeye yaklaştırıyor.';
    }

    return {
      recoveryStory: {
        daysInRecovery,
        compulsionsTracked: compulsions.length,
        resistanceGrowth,
        currentStreak,
        ybocsImprovement
      },
      personalInsights: {
        dominantCategory,
        strongestPattern: `${dominantCategory} kategorisinde ${categoryCount[dominantCategory]} kayıt`,
        biggestTrigger,
        resistanceProgress: `Son kayıtlarda ortalama ${recentAvg.toFixed(1)} direnç`,
        nextMilestone: achievements.length < 2 
          ? '10 kayıt hedefine odaklan' 
          : currentStreak < 7 
          ? '7 günlük direnç serisi oluştur'
          : 'Uzman seviye direnci koru'
      },
      achievements: achievements.slice(-3), // Show last 3 achievements
      encouragement
    };
  }, [compulsions, ybocsHistory]);

  useEffect(() => {
    const journeyData = generateOCDJourneyData;
    console.log('🎯 Setting OCD Journey Data:', {
      hasData: !!journeyData,
      recoveryDays: journeyData?.recoveryStory?.daysInRecovery,
      compulsionsTracked: journeyData?.recoveryStory?.compulsionsTracked,
      resistanceGrowth: journeyData?.recoveryStory?.resistanceGrowth
    });
    setOCDJourney(journeyData);
  }, [generateOCDJourneyData]);

  const renderTabButton = (tab: typeof selectedTab, label: string, icon: string) => (
    <Pressable
      style={[
        styles.tabButton,
        selectedTab === tab && styles.tabButtonActive
      ]}
      onPress={() => {
        setSelectedTab(tab);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <MaterialCommunityIcons 
        name={icon as any} 
        size={20} 
        color={selectedTab === tab ? COLORS.softEmerald : COLORS.whisperGray} 
      />
      <Text style={[
        styles.tabButtonText,
        selectedTab === tab && styles.tabButtonTextActive
      ]}>
        {label}
      </Text>
    </Pressable>
  );

  const renderJourneyTab = () => {
    console.log('🎨 Rendering Journey Tab:', {
      hasOcdJourney: !!ocdJourney,
      selectedTab,
      recoveryDays: ocdJourney?.recoveryStory?.daysInRecovery
    });
    
    // Show loading or empty state if no data
    if (!ocdJourney) {
      console.log('⚠️ No OCD Journey data - showing loading state');
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={styles.comingSoonCard}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={48} color={COLORS.whisperGray} />
            <Text style={styles.comingSoonTitle}>Recovery Journey Yükleniyor...</Text>
            <Text style={styles.comingSoonText}>
              Verileriniz analiz ediliyor, lütfen bekleyin...
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.tabContent}>
        {/* Hero Card - Recovery Progress */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[COLORS.mintGreen, COLORS.softEmerald + '20']}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <MaterialCommunityIcons name="heart-pulse" size={32} color={COLORS.softEmerald} />
              <Text style={styles.heroTitle}>Recovery Journey</Text>
              <Text style={styles.heroSubtitle}>
                {ocdJourney.recoveryStory.daysInRecovery} gün • {ocdJourney.recoveryStory.compulsionsTracked} takip
              </Text>
              <View style={styles.resistanceBadge}>
                <Text style={styles.resistanceBadgeText}>
                  {ocdJourney.recoveryStory.resistanceGrowth.toUpperCase()}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Personal Insights */}
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>💭 Kişisel İçgörüler</Text>
          <Text style={styles.insightText}>
            <Text style={styles.insightBold}>Dominant pattern:</Text> {ocdJourney.personalInsights.strongestPattern}
          </Text>
          <Text style={styles.insightText}>
            <Text style={styles.insightBold}>Direnç gelişimi:</Text> {ocdJourney.personalInsights.resistanceProgress}
          </Text>
          <Text style={styles.insightText}>
            <Text style={styles.insightBold}>Sıradaki hedef:</Text> {ocdJourney.personalInsights.nextMilestone}
          </Text>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsCard}>
          <Text style={styles.achievementsTitle}>🏆 Son Başarılar</Text>
          {ocdJourney.achievements.map((achievement) => (
            <View key={achievement.id} style={styles.achievementRow}>
              <View style={[styles.achievementIcon, { backgroundColor: achievement.color + '20' }]}>
                <MaterialCommunityIcons 
                  name={achievement.icon as any} 
                  size={16} 
                  color={achievement.color} 
                />
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Encouragement Message */}
        <View style={styles.encouragementCard}>
          <LinearGradient
            colors={[COLORS.warmBeige, COLORS.softAmber + '10']}
            style={styles.encouragementGradient}
          >
            <MaterialCommunityIcons name="heart" size={24} color={COLORS.softAmber} />
            <Text style={styles.encouragementText}>{ocdJourney.encouragement}</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    );
  };

  const renderPatternsTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.comingSoonCard}>
        <MaterialCommunityIcons name="chart-line" size={48} color={COLORS.whisperGray} />
        <Text style={styles.comingSoonTitle}>Pattern Analysis</Text>
        <Text style={styles.comingSoonText}>
          Gelişmiş pattern analizi yakında geliyor...
        </Text>
      </View>
    </ScrollView>
  );

  const renderAssessmentTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.assessmentCard}>
        <Text style={styles.assessmentTitle}>📋 Y-BOCS Geçmişi</Text>
        {ybocsHistory.length > 0 ? (
          ybocsHistory.slice(-3).map((assessment, index) => (
            <View key={assessment.id} style={styles.assessmentRow}>
              <View style={styles.assessmentDate}>
                <Text style={styles.assessmentDateText}>
                  {new Date(assessment.timestamp).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              <View style={styles.assessmentScore}>
                <Text style={styles.assessmentScoreText}>{assessment.totalScore}</Text>
                <Text style={styles.assessmentSeverityText}>
                  {assessment.severityLevel}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noAssessmentText}>
            Henüz Y-BOCS değerlendirmesi yapılmamış
          </Text>
        )}
      </View>
    </ScrollView>
  );

  const renderTriggersTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.comingSoonCard}>
        <MaterialCommunityIcons name="target" size={48} color={COLORS.whisperGray} />
        <Text style={styles.comingSoonTitle}>Trigger Management</Text>
        <Text style={styles.comingSoonText}>
          Trigger analizi ve yönetimi yakında geliyor...
        </Text>
      </View>
    </ScrollView>
  );

  console.log('🏗️ UserCentricOCDDashboard Render:', {
    selectedTab,
    hasOcdJourney: !!ocdJourney,
    compulsionsCount: compulsions?.length,
    currentTab: selectedTab
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header - Master Prompt Compliant */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>🌿 Recovery Dashboard</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.whisperGray} />
            </Pressable>
          </View>
          <Text style={styles.headerSubtitle}>Huzurlu iyileşme yolculuğunuz</Text>
        </View>

        {/* Tab Navigation - Calmer Design */}
        <View style={styles.tabNavigation}>
          {renderTabButton('journey', 'Yolculuk', 'map-marker-path')}
          {renderTabButton('patterns', 'Desenler', 'chart-line-variant')}
          {renderTabButton('assessment', 'Değerlendirme', 'clipboard-text-outline')}
          {renderTabButton('triggers', 'Tetikleyiciler', 'target-variant')}
        </View>

        {/* Tab Content with Gentle Animation */}
        <View style={styles.tabContentContainer}>
          {selectedTab === 'journey' && renderJourneyTab()}
          {selectedTab === 'patterns' && renderPatternsTab()}
          {selectedTab === 'assessment' && renderAssessmentTab()}
          {selectedTab === 'triggers' && renderTriggersTab()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Modal Header - Master Prompt Compliant
  header: {
    backgroundColor: COLORS.cardBackground,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cloudGray,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.softEmerald,
    fontFamily: 'Inter',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.whisperGray,
    fontFamily: 'Inter',
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cloudGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  tabContentContainer: {
    flex: 1,
  },
  
  // Tab Navigation - Calmer, More Therapeutic
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: COLORS.therapeuticBlue,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: COLORS.gentleBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.mintGreen,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.whisperGray,
    marginLeft: 4,
    fontFamily: 'Inter',
  },
  tabButtonTextActive: {
    color: COLORS.softEmerald,
    fontWeight: '600',
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Hero Card (Journey Tab)
  heroCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroGradient: {
    padding: 20,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.softEmerald,
    marginTop: 8,
    fontFamily: 'Inter',
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.whisperGray,
    marginTop: 4,
    fontFamily: 'Inter',
  },
  resistanceBadge: {
    backgroundColor: COLORS.softEmerald,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  resistanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },

  // Insight Card
  insightCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  insightText: {
    fontSize: 14,
    color: COLORS.whisperGray,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  insightBold: {
    fontWeight: '600',
    color: '#374151',
  },

  // Achievements Card
  achievementsCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  achievementDescription: {
    fontSize: 12,
    color: COLORS.whisperGray,
    marginTop: 2,
    fontFamily: 'Inter',
  },

  // Encouragement Card
  encouragementCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  encouragementGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  encouragementText: {
    fontSize: 14,
    color: COLORS.softAmber,
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Inter',
  },

  // Assessment Tab
  assessmentCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  assessmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  assessmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cloudGray,
  },
  assessmentDate: {
    flex: 1,
  },
  assessmentDateText: {
    fontSize: 14,
    color: COLORS.whisperGray,
    fontFamily: 'Inter',
  },
  assessmentScore: {
    alignItems: 'flex-end',
  },
  assessmentScoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  assessmentSeverityText: {
    fontSize: 12,
    color: COLORS.whisperGray,
    fontFamily: 'Inter',
  },
  noAssessmentText: {
    fontSize: 14,
    color: COLORS.whisperGray,
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: 'Inter',
  },

  // Coming Soon Cards
  comingSoonCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  comingSoonText: {
    fontSize: 14,
    color: COLORS.whisperGray,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  },
});
