import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import ScreenLayout from '@/components/layout/ScreenLayout';
import { AchievementBadge } from '@/components/gamification/AchievementBadge';
import { useGamificationStore } from '@/store/gamificationStore';
import { AchievementDefinition } from '@/types/gamification';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

export default function AchievementsScreen() {
  const { profile, achievements } = useGamificationStore();
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementDefinition | null>(null);

  const groupedAchievements = achievements.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {} as Record<string, AchievementDefinition[]>);

  const getCategoryInfo = (category: string) => {
    switch (category) {
      case 'ERP':
        return { title: 'ERP Kahramanı 🛡️', color: Colors.status.error };
      case 'Resistance':
        return { title: 'Direnç Ustası 💪', color: Colors.primary.green };
      case 'Mindfulness':
        return { title: 'Farkındalık Bilgesi 🧠', color: '#3B82F6' };
      default:
        return { title: category, color: Colors.text.secondary };
    }
  };

  const handleAchievementPress = async (achievement: AchievementDefinition) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAchievement(achievement);
  };

  const renderAchievementModal = () => (
    <Modal
      visible={!!selectedAchievement}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedAchievement(null)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setSelectedAchievement(null)}
      >
        <View style={styles.modalContent}>
          <View style={[
            styles.modalIcon,
            { backgroundColor: selectedAchievement?.unlockedAt ? getRarityColor(selectedAchievement.rarity) : Colors.text.tertiary }
          ]}>
            <MaterialCommunityIcons
              name={selectedAchievement?.icon as any || 'trophy'}
              size={48}
              color="#FFFFFF"
            />
          </View>
          
          <Text style={styles.modalTitle}>{selectedAchievement?.title}</Text>
          <Text style={styles.modalDescription}>{selectedAchievement?.description}</Text>
          
          {selectedAchievement?.unlockedAt && (
            <Text style={styles.modalUnlockedDate}>
              Kazanıldı: {new Date(selectedAchievement.unlockedAt).toLocaleDateString('tr-TR')}
            </Text>
          )}
          
          <Pressable
            style={styles.modalButton}
            onPress={() => setSelectedAchievement(null)}
          >
            <Text style={styles.modalButtonText}>Harika!</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'Epic':
        return '#8B5CF6';
      case 'Rare':
        return '#3B82F6';
      default:
        return Colors.primary.green;
    }
  };

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Başarımların</Text>
        <View style={styles.headerRight}>
          <Text style={styles.pointsText}>🏅 {profile.healingPointsTotal}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{profile.unlockedAchievements.length}</Text>
            <Text style={styles.statLabel}>Kazanılan</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{achievements.length}</Text>
            <Text style={styles.statLabel}>Toplam</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {Math.round((profile.unlockedAchievements.length / achievements.length) * 100)}%
            </Text>
            <Text style={styles.statLabel}>Tamamlama</Text>
          </View>
        </View>

        {/* Achievement Categories */}
        {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => {
          const categoryInfo = getCategoryInfo(category);
          
          return (
            <View key={category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: categoryInfo.color }]}>
                {categoryInfo.title}
              </Text>
              
              <View style={styles.achievementsGrid}>
                {categoryAchievements.map((achievement) => (
                  <AchievementBadge
                    key={achievement.id}
                    achievement={achievement}
                    isUnlocked={profile.unlockedAchievements.includes(achievement.id)}
                    onPress={() => handleAchievementPress(achievement)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {renderAchievementModal()}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.fontSize.headingM,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: Typography.fontSize.bodyM,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.primary.green,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.fontSize.headingL,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.fontSize.bodyS,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  categorySection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  categoryTitle: {
    fontSize: Typography.fontSize.headingS,
    fontWeight: Typography.fontWeight.semiBold,
    marginBottom: Spacing.lg,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.sm,
  },
  bottomSpacing: {
    height: Spacing.xxl,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.fontSize.headingS,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: Typography.fontSize.bodyM,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  modalUnlockedDate: {
    fontSize: Typography.fontSize.bodyS,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
  },
  modalButton: {
    backgroundColor: Colors.primary.green,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.bodyM,
    fontWeight: Typography.fontWeight.semiBold,
  },
}); 