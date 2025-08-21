import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/**
 * 🏆 CBT Achievements System
 * 
 * CBT özelliklerine özel başarı sistemi.
 * Kullanıcının therapeutic engagement'ını artırmak için tasarlanmıştır.
 */

interface CBTAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: 'distortion' | 'reframe' | 'mood' | 'consistency' | 'insight';
  criteria: (progress: CBTProgressData) => boolean;
  earnedAt?: Date;
  isEarned: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface CBTProgressData {
  uniqueDistortionsDetected: number;
  independentReframes: number;
  bestMoodImprovement: number;
  consecutiveDays: number;
  totalThoughtRecords: number;
  averageReframeQuality: number;
  distortionAccuracy: number;
  recentStreak: number;
  averageMoodImprovement: number;
}

interface CBTAchievementsProps {
  userProgress: CBTProgressData;
  onAchievementEarned?: (achievement: CBTAchievement) => void;
}

// CBT-Specific Achievements
const CBT_ACHIEVEMENTS: CBTAchievement[] = [
  {
    id: 'distortion_detective',
    name: 'Çarpıtma Dedektifi',
    description: '10 farklı bilişsel çarpıtma türünü başarıyla tespit et',
    icon: '🔍',
    points: 200,
    category: 'distortion',
    rarity: 'common',
    criteria: (progress) => progress.uniqueDistortionsDetected >= 10,
    isEarned: false,
  },
  {
    id: 'reframe_master',
    name: 'Yeniden Çerçeveleme Ustası',
    description: '50 kez bağımsız reframe oluştur',
    icon: '🎨',
    points: 300,
    category: 'reframe',
    rarity: 'rare',
    criteria: (progress) => progress.independentReframes >= 50,
    isEarned: false,
  },
  {
    id: 'mood_transformer',
    name: 'Ruh Hali Dönüştürücüsü',
    description: 'CBT sonrası mood 30+ puan artışı elde et',
    icon: '✨',
    points: 250,
    category: 'mood',
    rarity: 'rare',
    criteria: (progress) => progress.bestMoodImprovement >= 30,
    isEarned: false,
  },
  {
    id: 'consistent_tracker',
    name: 'Tutarlı Takipçi',
    description: '30 gün boyunca her gün thought record tut',
    icon: '📅',
    points: 500,
    category: 'consistency',
    rarity: 'epic',
    criteria: (progress) => progress.consecutiveDays >= 30,
    isEarned: false,
  },
  {
    id: 'cognitive_scholar',
    name: 'Bilişsel Akademisyen',
    description: '100 thought record tamamla',
    icon: '🎓',
    points: 400,
    category: 'insight',
    rarity: 'rare',
    criteria: (progress) => progress.totalThoughtRecords >= 100,
    isEarned: false,
  },
  {
    id: 'perfectionist_cure',
    name: 'Mükemmeliyetçilik Tedavisi',
    description: '"Hep-hiç düşünce" çarpıtmasını 20 kez tespit et',
    icon: '🌈',
    points: 180,
    category: 'distortion',
    rarity: 'common',
    criteria: (progress) => progress.uniqueDistortionsDetected >= 5, // Simplified
    isEarned: false,
  },
  {
    id: 'mindfulness_master',
    name: 'Farkındalık Ustası',
    description: 'Düşüncelerini %90+ doğrulukla analiz et',
    icon: '🧘',
    points: 350,
    category: 'insight',
    rarity: 'epic',
    criteria: (progress) => progress.distortionAccuracy >= 0.9,
    isEarned: false,
  },
  {
    id: 'streak_champion',
    name: 'Süreklilik Şampiyonu',
    description: '7 gün üst üste CBT çalışması yap',
    icon: '🔥',
    points: 150,
    category: 'consistency',
    rarity: 'common',
    criteria: (progress) => progress.recentStreak >= 7,
    isEarned: false,
  },
  {
    id: 'reframe_quality',
    name: 'Kalite Reframe Uzmanı',
    description: 'Reframe kalitende ortalama 8+ puan yakala',
    icon: '💎',
    points: 280,
    category: 'reframe',
    rarity: 'rare',
    criteria: (progress) => progress.averageReframeQuality >= 8,
    isEarned: false,
  },
  {
    id: 'mood_stability',
    name: 'Duygusal Stabilite Uzmanı',
    description: 'Ortalama mood iyileşmende +15 puan sürdür',
    icon: '⚖️',
    points: 320,
    category: 'mood',
    rarity: 'epic',
    criteria: (progress) => progress.averageMoodImprovement >= 15,
    isEarned: false,
  }
];

export default function CBTAchievements({ 
  userProgress, 
  onAchievementEarned 
}: CBTAchievementsProps) {
  
  const [selectedCategory, setSelectedCategory] = useState<'all' | CBTAchievement['category']>('all');
  
  // Calculate which achievements are earned
  const achievementsWithStatus = CBT_ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    isEarned: achievement.criteria(userProgress)
  }));

  const earnedAchievements = achievementsWithStatus.filter(a => a.isEarned);
  const totalPoints = earnedAchievements.reduce((sum, a) => sum + a.points, 0);
  
  // Filter achievements by category
  const filteredAchievements = selectedCategory === 'all' 
    ? achievementsWithStatus
    : achievementsWithStatus.filter(a => a.category === selectedCategory);

  const getRarityColor = (rarity: CBTAchievement['rarity']) => {
    switch (rarity) {
      case 'common': return '#84CC16';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getRarityLabel = (rarity: CBTAchievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'Yaygın';
      case 'rare': return 'Nadir';
      case 'epic': return 'Epik';
      case 'legendary': return 'Efsane';
      default: return '';
    }
  };

  const getCategoryIcon = (category: CBTAchievement['category']) => {
    switch (category) {
      case 'distortion': return 'alert-circle';
      case 'reframe': return 'lightbulb';
      case 'mood': return 'emoticon';
      case 'consistency': return 'calendar-check';
      case 'insight': return 'brain';
      default: return 'trophy';
    }
  };

  const getCategoryLabel = (category: CBTAchievement['category']) => {
    switch (category) {
      case 'distortion': return 'Çarpıtma';
      case 'reframe': return 'Reframe';
      case 'mood': return 'Ruh Hali';
      case 'consistency': return 'Tutarlılık';
      case 'insight': return 'İçgörü';
      default: return 'Genel';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.header}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{earnedAchievements.length}</Text>
            <Text style={styles.statLabel}>Başarı</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalPoints}</Text>
            <Text style={styles.statLabel}>Toplam Puan</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round((earnedAchievements.length / CBT_ACHIEVEMENTS.length) * 100)}%
            </Text>
            <Text style={styles.statLabel}>Tamamlanma</Text>
          </View>
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryFilter}>
        <Pressable
          style={[
            styles.categoryButton,
            selectedCategory === 'all' && styles.categoryButtonActive
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <MaterialCommunityIcons name="trophy" size={16} color={
            selectedCategory === 'all' ? '#FFFFFF' : '#6B7280'
          } />
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === 'all' && styles.categoryButtonTextActive
          ]}>
            Tümü
          </Text>
        </Pressable>

        {(['distortion', 'reframe', 'mood', 'consistency', 'insight'] as const).map(category => (
          <Pressable
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <MaterialCommunityIcons 
              name={getCategoryIcon(category) as any} 
              size={16} 
              color={selectedCategory === category ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[
              styles.categoryButtonText,
              selectedCategory === category && styles.categoryButtonTextActive
            ]}>
              {getCategoryLabel(category)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Achievements List */}
      <View style={styles.achievementsList}>
        {filteredAchievements.map((achievement) => (
          <Pressable
            key={achievement.id}
            style={[
              styles.achievementCard,
              achievement.isEarned && styles.achievementCardEarned
            ]}
            onPress={() => {
              if (achievement.isEarned) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          >
            {/* Achievement Icon & Status */}
            <View style={styles.achievementIcon}>
              <Text style={[
                styles.achievementEmoji,
                !achievement.isEarned && styles.achievementEmojiLocked
              ]}>
                {achievement.isEarned ? achievement.icon : '🔒'}
              </Text>
              {achievement.isEarned && (
                <View style={styles.completeBadge}>
                  <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>

            {/* Achievement Content */}
            <View style={styles.achievementContent}>
              <View style={styles.achievementHeader}>
                <Text style={[
                  styles.achievementName,
                  !achievement.isEarned && styles.achievementNameLocked
                ]}>
                  {achievement.name}
                </Text>
                <View style={[
                  styles.rarityBadge,
                  { backgroundColor: getRarityColor(achievement.rarity) }
                ]}>
                  <Text style={styles.rarityText}>
                    {getRarityLabel(achievement.rarity)}
                  </Text>
                </View>
              </View>
              
              <Text style={[
                styles.achievementDescription,
                !achievement.isEarned && styles.achievementDescriptionLocked
              ]}>
                {achievement.description}
              </Text>
              
              <View style={styles.achievementFooter}>
                <View style={styles.pointsContainer}>
                  <MaterialCommunityIcons name="coin" size={16} color="#F59E0B" />
                  <Text style={styles.pointsText}>+{achievement.points} puan</Text>
                </View>
                
                {achievement.isEarned && achievement.earnedAt && (
                  <Text style={styles.earnedDate}>
                    {achievement.earnedAt.toLocaleDateString('tr-TR')}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
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
  categoryFilter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  categoryButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  achievementsList: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  achievementCardEarned: {
    opacity: 1,
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  achievementIcon: {
    position: 'relative',
    marginRight: 16,
  },
  achievementEmoji: {
    fontSize: 32,
  },
  achievementEmojiLocked: {
    opacity: 0.3,
  },
  completeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    fontFamily: 'Inter',
  },
  achievementNameLocked: {
    color: '#9CA3AF',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  rarityText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  achievementDescriptionLocked: {
    color: '#9CA3AF',
  },
  achievementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    fontFamily: 'Inter',
  },
  earnedDate: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
});

/**
 * Points Calculator for CBT Activities
 */
export const calculateCBTPoints = {
  thoughtRecord: (entry: any) => {
    let points = 20; // Base points
    
    // Quality bonuses
    if (entry.evidence_for && entry.evidence_against) points += 10;
    if (entry.reframe && entry.reframe.length > 50) points += 15;
    if (entry.distortions && entry.distortions.length >= 2) points += 5;
    
    // Mood improvement bonus
    const improvement = entry.mood_after - entry.mood_before;
    if (improvement > 10) points += 20;
    else if (improvement > 5) points += 10;
    
    return points;
  },
  
  distortionDetection: (detection: any) => {
    const accuracyBonus = Math.round(detection.accuracy * 10);
    const speedBonus = detection.timeInSeconds < 60 ? 15 : 5;
    const consistencyBonus = Math.min(detection.streak * 2, 30);
    
    return accuracyBonus + speedBonus + consistencyBonus;
  },
  
  reframingCreativity: (reframe: any) => {
    let points = 0;
    
    if (reframe.isIndependent) points += 25; // AI yardımı olmadan
    if (reframe.isOriginal) points += 15; // Benzersiz reframe
    points += reframe.helpfulness * 10; // Helpfulness rating (1-10)
    
    return points;
  }
};
