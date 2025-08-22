import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/**
 * 🌟 User-Centric CBT Progress Dashboard
 * 
 * Kullanıcının CBT yolculuğunu motivasyonel, anlaşılır ve eylem odaklı şekilde sunar.
 * Technical jargon yerine empatik dil kullanır.
 */

interface UserCBTJourney {
  // User-friendly progress metrics
  progressStory: {
    daysOnJourney: number;
    thoughtsProcessed: number;
    emotionalGrowth: 'başlangıç' | 'gelişiyor' | 'güçlü' | 'uzman';
    currentStreak: number;
    biggestWin: string;
  };
  
  // Motivational insights
  personalInsights: {
    strongestSkill: string;
    growthArea: string;
    nextMilestone: string;
    encouragement: string;
    actionableStep: string;
  };
  
  // Visual progress
  emotionalWellbeing: {
    beforeCBT: number; // 1-10 scale
    currentLevel: number; // 1-10 scale
    weeklyTrend: 'yükseliyor' | 'stabil' | 'düşüyor';
    recentMood: Array<{
      day: string;
      mood: number;
      highlight?: string;
    }>;
  };
  
  // Success stories
  achievements: Array<{
    title: string;
    description: string;
    date: Date;
    celebration: string;
    impact: string;
  }>;
  
  // Next steps
  recommendations: Array<{
    title: string;
    description: string;
    difficulty: 'kolay' | 'orta' | 'ileri';
    timeToComplete: string;
    benefits: string;
  }>;
}

interface UserCentricCBTDashboardProps {
  visible: boolean;
  onClose: () => void;
  userJourney: UserCBTJourney;
  onStartAction?: (actionId: string) => void;
}

export default function UserCentricCBTDashboard({
  visible,
  onClose,
  userJourney,
  onStartAction
}: UserCentricCBTDashboardProps) {
  
  const [selectedSection, setSelectedSection] = useState<'journey' | 'growth' | 'next'>('journey');

  // ✅ FIXED: Generate calm, anxiety-friendly progress colors (Master Prompt: Sakinlik)
  const getProgressColor = (level: number): string => {
    if (level >= 8) return '#059669'; // Excellent - Soft Green
    if (level >= 6) return '#0369A1'; // Good - Soft Blue  
    if (level >= 4) return '#D97706'; // Improving - Soft Amber
    return '#7C3AED'; // Starting - Soft Purple
  };

  // ✅ FIXED: Generate calm emotional growth badges (Master Prompt: Sakinlik)
  const getGrowthBadge = (growth: string) => {
    const badges = {
      'başlangıç': { icon: '🌱', color: '#65A30D', message: 'CBT yolculuğun başladı, her adım değerli' },
      'gelişiyor': { icon: '🌿', color: '#059669', message: 'İyi bir ilerleme gösteriyorsun' },
      'güçlü': { icon: '🌳', color: '#047857', message: 'CBT becerilerinde istikrarlı bir güç kazandın' },
      'uzman': { icon: '✨', color: '#0369A1', message: 'CBT konusunda olgun bir anlayış geliştirdin' }
    };
    return badges[growth as keyof typeof badges] || badges.başlangıç;
  };

  const renderJourneySection = () => {
    const growthBadge = getGrowthBadge(userJourney.progressStory.emotionalGrowth);
    
    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        {/* Hero Story Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroIcon}>{growthBadge.icon}</Text>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>CBT Yolculuğun</Text>
              <Text style={styles.heroSubtitle}>{growthBadge.message}</Text>
            </View>
          </View>
          
          {/* Journey Stats */}
          <View style={styles.journeyStats}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userJourney.progressStory.daysOnJourney}</Text>
              <Text style={styles.statLabel}>Gün</Text>
              <Text style={styles.statNote}>CBT ile beraber</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userJourney.progressStory.thoughtsProcessed}</Text>
              <Text style={styles.statLabel}>Düşünce</Text>
              <Text style={styles.statNote}>Analiz ettin</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{userJourney.progressStory.currentStreak}</Text>
              <Text style={styles.statLabel}>Gün</Text>
              <Text style={styles.statNote}>Kesintisiz</Text>
            </View>
          </View>
        </View>

        {/* Biggest Win Celebration */}
        <View style={styles.celebrationCard}>
          <View style={styles.celebrationHeader}>
            <MaterialCommunityIcons name="trophy" size={24} color="#F59E0B" />
            <Text style={styles.celebrationTitle}>En Büyük Başarın!</Text>
          </View>
          <Text style={styles.celebrationText}>
            {userJourney.progressStory.biggestWin}
          </Text>
          {/* ✅ FIXED: Calm celebration note */}
          <Text style={styles.celebrationNote}>
            Bu anlamlı bir başarı. Kendini takdir etmeyi unutma.
          </Text>
        </View>

        {/* Emotional Wellbeing Progress */}
        <View style={styles.wellbeingCard}>
          <Text style={styles.cardTitle}>🧠 Duygusal İyilik Halin</Text>
          
          <View style={styles.progressComparison}>
            <View style={styles.progressBefore}>
              <Text style={styles.progressLabel}>CBT Öncesi</Text>
              <View style={[styles.progressCircle, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.progressNumber}>{userJourney.emotionalWellbeing.beforeCBT}</Text>
              </View>
            </View>
            
            <View style={styles.progressArrow}>
              <MaterialCommunityIcons name="arrow-right" size={24} color="#6B7280" />
            </View>
            
            <View style={styles.progressAfter}>
              <Text style={styles.progressLabel}>Şu An</Text>
              <View style={[styles.progressCircle, { 
                backgroundColor: getProgressColor(userJourney.emotionalWellbeing.currentLevel) 
              }]}>
                <Text style={styles.progressNumber}>{userJourney.emotionalWellbeing.currentLevel}</Text>
              </View>
            </View>
          </View>
          
          {/* ✅ FIXED: Calm progress improvement message */}
          <Text style={styles.progressImprovement}>
            +{userJourney.emotionalWellbeing.currentLevel - userJourney.emotionalWellbeing.beforeCBT} 
            puanlık bir iyileşme. İyi bir gelişim süreci yaşıyorsun.
          </Text>
        </View>

        {/* Weekly Mood Trend */}
        <View style={styles.trendCard}>
          <Text style={styles.cardTitle}>📈 Son Haftanın Hikayesi</Text>
          
          <View style={styles.moodTimeline}>
            {userJourney.emotionalWellbeing.recentMood.map((day, index) => (
              <View key={index} style={styles.moodDay}>
                <View style={[styles.moodDot, { 
                  backgroundColor: getProgressColor(day.mood),
                  transform: [{ scale: day.highlight ? 1.2 : 1 }]
                }]}>
                  <Text style={styles.moodValue}>{day.mood}</Text>
                </View>
                <Text style={styles.moodDayLabel}>{day.day}</Text>
                {day.highlight && (
                  <Text style={styles.moodHighlight}>⭐</Text>
                )}
              </View>
            ))}
          </View>
          
          {/* ✅ FIXED: Calm trend notes (Master Prompt: Sakinlik) */}
          <Text style={styles.trendNote}>
            {userJourney.emotionalWellbeing.weeklyTrend === 'yükseliyor' && 'Haftalık eğilimin pozitif yönde ilerliyor. Bu süreç devam ediyor.'}
            {userJourney.emotionalWellbeing.weeklyTrend === 'stabil' && 'İstikrarlı bir dönemdesin. Bu da önemli bir gelişme.'}
            {userJourney.emotionalWellbeing.weeklyTrend === 'düşüyor' && 'Zorlu bir hafta yaşadın, bu normal. Kendine sabırlı ol.'}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderGrowthSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Personal Insights */}
      <View style={styles.insightCard}>
        <Text style={styles.cardTitle}>💡 Sana Özel İçgörüler</Text>
        
        <View style={styles.insightRow}>
          <MaterialCommunityIcons name="star" size={20} color="#10B981" />
          <View style={styles.insightContent}>
            <Text style={styles.insightLabel}>En Güçlü Yönün:</Text>
            <Text style={styles.insightText}>{userJourney.personalInsights.strongestSkill}</Text>
          </View>
        </View>
        
        <View style={styles.insightRow}>
          <MaterialCommunityIcons name="trending-up" size={20} color="#3B82F6" />
          <View style={styles.insightContent}>
            <Text style={styles.insightLabel}>Gelişim Alanın:</Text>
            <Text style={styles.insightText}>{userJourney.personalInsights.growthArea}</Text>
          </View>
        </View>
        
        <View style={styles.insightRow}>
          <MaterialCommunityIcons name="target" size={20} color="#F59E0B" />
          <View style={styles.insightContent}>
            <Text style={styles.insightLabel}>Sıradaki Hedefin:</Text>
            <Text style={styles.insightText}>{userJourney.personalInsights.nextMilestone}</Text>
          </View>
        </View>
      </View>

      {/* Encouragement */}
      <View style={styles.encouragementCard}>
        <Text style={styles.encouragementIcon}>🌟</Text>
        <Text style={styles.encouragementTitle}>Sana Destek Mesajımız</Text>
        <Text style={styles.encouragementText}>
          {userJourney.personalInsights.encouragement}
        </Text>
      </View>

      {/* Achievements */}
      <View style={styles.achievementsCard}>
        <Text style={styles.cardTitle}>🏆 Başarı Hikayelerin</Text>
        {userJourney.achievements.map((achievement, index) => (
          <View key={index} style={styles.achievementRow}>
            <Text style={styles.achievementIcon}>{achievement.celebration}</Text>
            <View style={styles.achievementContent}>
              <Text style={styles.achievementTitle}>{achievement.title}</Text>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
              <Text style={styles.achievementImpact}>💫 {achievement.impact}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderNextStepsSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Next Action */}
      <View style={styles.actionCard}>
        <Text style={styles.cardTitle}>🎯 Bir Sonraki Adımın</Text>
        <Text style={styles.actionDescription}>
          {userJourney.personalInsights.actionableStep}
        </Text>
        
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStartAction?.('next_step');
          }}
        >
          <MaterialCommunityIcons name="rocket-launch" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Hemen Başla!</Text>
        </Pressable>
      </View>

      {/* Recommendations */}
      <View style={styles.recommendationsCard}>
        <Text style={styles.cardTitle}>💪 Senin İçin Öneriler</Text>
        
        {userJourney.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationRow}>
            <View style={[styles.difficultyBadge, { 
              backgroundColor: rec.difficulty === 'kolay' ? '#10B981' : 
                              rec.difficulty === 'orta' ? '#F59E0B' : '#EF4444'
            }]}>
              <Text style={styles.difficultyText}>{rec.difficulty.toUpperCase()}</Text>
            </View>
            
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>{rec.title}</Text>
              <Text style={styles.recommendationDescription}>{rec.description}</Text>
              
              <View style={styles.recommendationMeta}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>{rec.timeToComplete}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="gift-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>{rec.benefits}</Text>
                </View>
              </View>
              
              <Pressable
                style={styles.startButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStartAction?.(`recommendation_${index}`);
                }}
              >
                <Text style={styles.startButtonText}>Başla</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>CBT Yolculuğun</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <Pressable
            style={[styles.tabButton, selectedSection === 'journey' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('journey');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'journey' && styles.tabTextActive]}>
              🌟 Yolculuğun
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabButton, selectedSection === 'growth' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('growth');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'growth' && styles.tabTextActive]}>
              💪 Büyümen
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabButton, selectedSection === 'next' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('next');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'next' && styles.tabTextActive]}>
              🎯 Sırada
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        {selectedSection === 'journey' && renderJourneySection()}
        {selectedSection === 'growth' && renderGrowthSection()}
        {selectedSection === 'next' && renderNextStepsSection()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 4,
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    margin: 16,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#374151',
    fontWeight: '600',
  },
  sectionContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // ✅ FIXED: Calm Hero Card (Master Prompt: Sakinlik)
  heroCard: {
    backgroundColor: '#F8FAFC', // Soft neutral background
    padding: 24,
    borderRadius: 16, // Softer corners
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0', // Subtle border
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  heroContent: {
    flex: 1,
  },
  // ✅ FIXED: Calm hero text colors
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151', // Calm dark gray
    fontFamily: 'Inter',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6B7280', // Soft gray
    marginTop: 4,
    fontFamily: 'Inter',
  },
  journeyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  // ✅ FIXED: Calm stat boxes
  statBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Clean white
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB', // Subtle border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, // Very subtle shadow
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151', // Calm dark
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280', // Soft gray
    marginTop: 2,
    fontFamily: 'Inter',
  },
  statNote: {
    fontSize: 12,
    color: '#9CA3AF', // Light gray
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // ✅ FIXED: Calm celebration card
  celebrationCard: {
    backgroundColor: '#F9FAFB', // Soft neutral
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB', // Subtle border
  },
  celebrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  // ✅ FIXED: Calm celebration text colors
  celebrationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151', // Calm dark gray
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  celebrationText: {
    fontSize: 16,
    color: '#4B5563', // Medium gray
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  celebrationNote: {
    fontSize: 14,
    color: '#6B7280', // Soft gray
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
  
  // ✅ FIXED: Calm wellbeing card
  wellbeingCard: {
    backgroundColor: '#FAFAFA', // Very soft neutral
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  progressComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  progressBefore: {
    alignItems: 'center',
    flex: 1,
  },
  progressAfter: {
    alignItems: 'center',
    flex: 1,
  },
  progressArrow: {
    marginHorizontal: 20,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressImprovement: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Trend Card
  trendCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  moodTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  moodDay: {
    alignItems: 'center',
  },
  moodDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  moodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  moodDayLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  moodHighlight: {
    marginTop: 4,
    fontSize: 16,
  },
  trendNote: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    fontFamily: 'Inter',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  
  // Insight Card
  insightCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  insightText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
  },
  
  // Encouragement Card
  encouragementCard: {
    backgroundColor: '#FEF7FF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E879F9',
  },
  encouragementIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#86198F',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  encouragementText: {
    fontSize: 16,
    color: '#701A75',
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Achievements Card
  achievementsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    fontFamily: 'Inter',
  },
  achievementImpact: {
    fontSize: 14,
    color: '#059669',
    fontFamily: 'Inter',
  },
  
  // Action Card
  actionCard: {
    backgroundColor: '#DBEAFE',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  actionDescription: {
    fontSize: 16,
    color: '#1E40AF',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  // ✅ FIXED: Calm action button
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151', // Calm dark gray
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  
  // Recommendations Card
  recommendationsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recommendationRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
    alignSelf: 'flex-start',
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  recommendationMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  // ✅ FIXED: Calm start button
  startButton: {
    backgroundColor: '#6B7280', // Soft gray
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});
