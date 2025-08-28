/**
 * 🎯 Daily Missions Card Component
 * 
 * AI-generated dynamic daily missions display with:
 * - Progress tracking with animated progress bars
 * - Contextual mission descriptions and reasoning
 * - Difficulty-based visual styling
 * - Real-time progress updates and completion celebrations
 * 
 * v2.1 - Week 2 Implementation
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGamificationStore } from '@/store/gamificationStore';
import { UnifiedMission } from '@/features/ai-fallbacks/gamification';

interface DailyMissionsCardProps {
  onMissionComplete?: (mission: UnifiedMission) => void;
  showGenerateButton?: boolean;
}

const getDifficultyConfig = (difficulty: UnifiedMission['difficulty']) => {
  const configs = {
    easy: {
      color: '#4CAF50',
      gradient: ['#E8F5E8', '#D4F4D4'],
      icon: 'leaf',
      label: 'Kolay',
      textColor: '#2E7D32'
    },
    medium: {
      color: '#2196F3',
      gradient: ['#E3F2FD', '#BBDEFB'],
      icon: 'target',
      label: 'Orta',
      textColor: '#1565C0'
    },
    hard: {
      color: '#FF9800',
      gradient: ['#FFF3E0', '#FFE0B2'],
      icon: 'fire',
      label: 'Zor',
      textColor: '#E65100'
    },
    expert: {
      color: '#9C27B0',
      gradient: ['#F3E5F5', '#E1BEE7'],
      icon: 'diamond-stone',
      label: 'Uzman',
      textColor: '#6A1B9A'
    }
  };
  
  return configs[difficulty];
};

const getCategoryIcon = (category: UnifiedMission['category']) => {
  const icons = {
    mood: 'weather-cloudy',
    breathwork: 'meditation',
    consistency: 'calendar-check',
    challenge: 'lightning-bolt'
  } as Record<string, any>;
  
  return icons[category] || 'target';
};

export default function DailyMissionsCard({ 
  onMissionComplete,
  showGenerateButton = true 
}: DailyMissionsCardProps) {
  const { 
    currentMissions, 
    generateUnifiedMissions, 
    updateMissionProgress, 
    getMissionsForToday,
    currentUserId 
  } = useGamificationStore();
  
  const [todayMissions, setTodayMissions] = useState<UnifiedMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Load today's missions
  useEffect(() => {
    const missions = getMissionsForToday();
    setTodayMissions(missions);
    
    if (missions.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [currentMissions]);

  const handleGenerateMissions = async () => {
    if (!currentUserId || loading) return;
    
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const newMissions = await generateUnifiedMissions();
      if (newMissions.length > 0) {
        setTodayMissions(newMissions);
        
        // Success animation
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true })
        ]).start();
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Mission generation failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleMissionAction = async (mission: UnifiedMission) => {
    if (mission.currentProgress >= mission.targetValue) return; // Already completed
    
    const success = await updateMissionProgress(mission.id, 1);
    
    if (success) {
      // Check if mission was completed
      if (mission.currentProgress + 1 >= mission.targetValue) {
        onMissionComplete?.(mission);
        
        // Celebration animation
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Remove completed mission from display after a delay
        setTimeout(() => {
          setTodayMissions(prev => prev.filter(m => m.id !== mission.id));
        }, 2000);
      }
    }
  };

  const toggleMissionDetails = (missionId: string) => {
    setExpandedMission(expandedMission === missionId ? null : missionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (todayMissions.length === 0 && !loading) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyContent}>
          <MaterialCommunityIcons name="target" size={48} color="#DDD" />
          <Text style={styles.emptyTitle}>Günlük Görevler</Text>
          <Text style={styles.emptyDescription}>
            Kişiselleştirilmiş günlük görevlerinizi AI ile oluşturun
          </Text>
          {showGenerateButton && (
            <Pressable 
              style={styles.generateButton} 
              onPress={handleGenerateMissions}
              disabled={loading}
            >
              <MaterialCommunityIcons name="robot" size={20} color="white" />
              <Text style={styles.generateButtonText}>
                {loading ? 'Oluşturuluyor...' : 'AI ile Görev Oluştur'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="target" size={24} color="#333" />
          <Text style={styles.title}>Bugünün Görevleri</Text>
          <View style={styles.missionCount}>
            <Text style={styles.missionCountText}>{todayMissions.length}</Text>
          </View>
        </View>
        {showGenerateButton && todayMissions.length === 0 && (
          <Pressable 
            style={styles.refreshButton} 
            onPress={handleGenerateMissions}
            disabled={loading}
          >
            <MaterialCommunityIcons 
              name={loading ? "loading" : "refresh"} 
              size={20} 
              color="#666" 
            />
          </Pressable>
        )}
      </View>

      <ScrollView 
        style={styles.missionsScroll}
        showsVerticalScrollIndicator={false}
      >
        {todayMissions.map((mission, index) => {
          const difficultyConfig = getDifficultyConfig(mission.difficulty);
          const categoryIcon = getCategoryIcon(mission.category);
          const progressPercentage = (mission.currentProgress / mission.targetValue) * 100;
          const isCompleted = mission.currentProgress >= mission.targetValue;
          const isExpanded = expandedMission === mission.id;
          
          return (
            <View key={mission.id} style={styles.missionContainer}>
              <LinearGradient
                colors={isCompleted ? ['#E8F5E8', '#C8E6C9'] : (difficultyConfig.gradient as [string, string])}
                style={[styles.missionCard, isCompleted && styles.completedCard]}
              >
                {/* Mission Header */}
                <Pressable 
                  style={styles.missionHeader}
                  onPress={() => toggleMissionDetails(mission.id)}
                >
                  <View style={styles.missionHeaderLeft}>
                    <MaterialCommunityIcons 
                      name={categoryIcon as any} 
                      size={24} 
                      color={isCompleted ? '#4CAF50' : difficultyConfig.color} 
                    />
                    <View style={styles.missionInfo}>
                      <Text style={[styles.missionTitle, isCompleted && styles.completedText]}>
                        {mission.title}
                      </Text>
                      <View style={styles.missionMeta}>
                        <View style={[styles.difficultyBadge, { backgroundColor: difficultyConfig.color }]}>
                          <MaterialCommunityIcons name={difficultyConfig.icon as any} size={12} color="white" />
                          <Text style={styles.difficultyText}>{difficultyConfig.label}</Text>
                        </View>
                        <Text style={styles.pointsText}>+{mission.healingPoints}✨</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.missionHeaderRight}>
                    <MaterialCommunityIcons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#666" 
                    />
                  </View>
                </Pressable>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${progressPercentage}%`,
                          backgroundColor: isCompleted ? '#4CAF50' : difficultyConfig.color
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {mission.currentProgress}/{mission.targetValue}
                    {isCompleted && " ✅"}
                  </Text>
                </View>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <Text style={styles.missionDescription}>{mission.description}</Text>
                    
                    {mission.personalizedMessage && (
                      <View style={styles.personalizedMessage}>
                        <MaterialCommunityIcons name="heart" size={16} color="#E91E63" />
                        <Text style={styles.personalizedMessageText}>
                          {mission.personalizedMessage}
                        </Text>
                      </View>
                    )}
                    
                    {mission.aiGenerated && (
                      <View style={styles.aiGenerated}>
                        <MaterialCommunityIcons name="robot" size={14} color="#9C27B0" />
                        <Text style={styles.aiGeneratedText}>
                          AI tarafından oluşturuldu • Güven: %{Math.round(mission.metadata.aiConfidence * 100)}
                        </Text>
                      </View>
                    )}

                    {/* Action Button */}
                    {!isCompleted && (
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: difficultyConfig.color }]}
                        onPress={() => handleMissionAction(mission)}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color="white" />
                        <Text style={styles.actionButtonText}>İlerleme Kaydet</Text>
                      </Pressable>
                    )}
                    
                    {isCompleted && (
                      <View style={styles.completedBadge}>
                        <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                        <Text style={styles.completedBadgeText}>Tamamlandı! 🎉</Text>
                      </View>
                    )}
                  </View>
                )}
              </LinearGradient>
            </View>
          );
        })}
      </ScrollView>

      {/* Summary Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {todayMissions.filter(m => m.currentProgress >= m.targetValue).length} / {todayMissions.length} görev tamamlandı
        </Text>
        {todayMissions.every(m => m.currentProgress >= m.targetValue) && todayMissions.length > 0 && (
          <Text style={styles.allCompleteText}>🎉 Tüm günlük görevler tamamlandı!</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyContent: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9C27B0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  generateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  missionCount: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  missionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  refreshButton: {
    padding: 8,
  },
  missionsScroll: {
    maxHeight: 400,
  },
  missionContainer: {
    marginBottom: 12,
  },
  missionCard: {
    borderRadius: 12,
    padding: 16,
  },
  completedCard: {
    opacity: 0.8,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  missionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#4CAF50',
  },
  missionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
  },
  missionHeaderRight: {
    padding: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.5)',
    paddingTop: 16,
    gap: 12,
  },
  missionDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  personalizedMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  personalizedMessageText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    flex: 1,
  },
  aiGenerated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiGeneratedText: {
    fontSize: 11,
    color: '#9C27B0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E8',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  completedBadgeText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
  allCompleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
});
