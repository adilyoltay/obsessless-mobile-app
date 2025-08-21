import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// import { LineChart, BarChart } from 'react-native-chart-kit'; // TODO: Add chart dependency
import { Dimensions } from 'react-native';

/**
 * 📊 CBT Progress Dashboard - Comprehensive Analytics
 * 
 * Kullanıcının CBT ilerlemesini detaylı şekilde analiz eder ve gösterir.
 * AI insights ile kişiselleştirilmiş geri bildirim sunar.
 */

const screenWidth = Dimensions.get('window').width;

interface CBTProgressMetrics {
  distortionAwareness: {
    detectionSpeed: number;
    accuracyRate: number;
    commonPatterns: string[];
  };
  reframingSkills: {
    independentReframes: number;
    reframeQuality: number;
    preferredTechniques: string[];
  };
  emotionalRegulation: {
    moodBeforeAfter: {
      before: number[];
      after: number[];
    };
    regulationSpeed: number;
    stabilityTrend: 'improving' | 'stable' | 'declining';
  };
  behavioralChanges: {
    thoughtRecordFrequency: number;
    qualityOfEntries: number;
    complianceRate: number;
  };
}

interface CBTProgressDashboardProps {
  userMetrics: CBTProgressMetrics;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    earnedAt: Date;
  }>;
  nextMilestones: Array<{
    id: string;
    name: string;
    progress: number;
    target: number;
  }>;
  strengthAreas: string[];
  improvementAreas: Array<{
    area: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  onCelebrateMilestone?: (milestoneId: string) => void;
}

export default function CBTProgressDashboard({
  userMetrics,
  achievements,
  nextMilestones,
  strengthAreas,
  improvementAreas,
  onCelebrateMilestone
}: CBTProgressDashboardProps) {
  
  const [selectedTab, setSelectedTab] = useState<'overview' | 'insights' | 'achievements'>('overview');
  const [showDetailed, setShowDetailed] = useState(false);

  // Calculate overall CBT progress score
  const calculateOverallScore = (): number => {
    const scores = [
      userMetrics.distortionAwareness.accuracyRate * 100,
      userMetrics.reframingSkills.reframeQuality * 10,
      userMetrics.emotionalRegulation.regulationSpeed,
      userMetrics.behavioralChanges.complianceRate * 100,
    ];
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  // Generate mood improvement chart data
  const generateMoodChartData = () => {
    const { before, after } = userMetrics.emotionalRegulation.moodBeforeAfter;
    if (before.length === 0 || after.length === 0) return null;

    return {
      labels: Array.from({ length: Math.min(7, before.length) }, (_, i) => `D${i + 1}`),
      datasets: [
        {
          data: before.slice(-7),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: after.slice(-7),
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Öncesi', 'Sonrası'],
    };
  };

  // Generate distortion patterns chart
  const generateDistortionChart = () => {
    const patterns = userMetrics.distortionAwareness.commonPatterns;
    if (patterns.length === 0) return null;

    const labels = patterns.slice(0, 5).map(p => p.substring(0, 8));
    const data = patterns.slice(0, 5).map((_, index) => 
      Math.max(1, 10 - (index * 2)) // Mock data based on frequency
    );

    return {
      labels,
      datasets: [{
        data
      }]
    };
  };

  const overallScore = calculateOverallScore();
  const moodChartData = generateMoodChartData();
  const distortionChartData = generateDistortionChart();

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Overall Progress Score */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <MaterialCommunityIcons name="brain" size={32} color="#6366F1" />
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>CBT İlerleme Skoru</Text>
            <Text style={styles.scoreValue}>{overallScore}/100</Text>
          </View>
          <View style={[styles.scoreIndicator, { 
            backgroundColor: overallScore >= 80 ? '#10B981' : 
                            overallScore >= 60 ? '#F59E0B' : '#EF4444' 
          }]}>
            <Text style={styles.scoreLevel}>
              {overallScore >= 80 ? 'İleri' : 
               overallScore >= 60 ? 'Orta' : 'Başlangıç'}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressBar}>
          <View 
            style={[styles.progressFill, { 
              width: `${overallScore}%`,
              backgroundColor: overallScore >= 80 ? '#10B981' : 
                              overallScore >= 60 ? '#F59E0B' : '#6366F1'
            }]} 
          />
        </View>
      </View>

      {/* Mood Improvement Chart */}
      {moodChartData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>🎯 Ruh Hali İyileşmesi</Text>
          <View style={styles.chartPlaceholder}>
            <MaterialCommunityIcons name="chart-line" size={48} color="#E5E7EB" />
            <Text style={styles.chartPlaceholderText}>
              Grafik görüntülenmesi için react-native-chart-kit kütüphanesi gerekli
            </Text>
          </View>
        </View>
      )}

      {/* Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="target" size={24} color="#EF4444" />
          <Text style={styles.metricValue}>
            {Math.round(userMetrics.distortionAwareness.accuracyRate * 100)}%
          </Text>
          <Text style={styles.metricLabel}>Çarpıtma Tespiti</Text>
        </View>
        
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="lightbulb" size={24} color="#F59E0B" />
          <Text style={styles.metricValue}>
            {userMetrics.reframingSkills.independentReframes}
          </Text>
          <Text style={styles.metricLabel}>Bağımsız Reframe</Text>
        </View>
        
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="speedometer" size={24} color="#10B981" />
          <Text style={styles.metricValue}>
            {Math.round(userMetrics.emotionalRegulation.regulationSpeed)}s
          </Text>
          <Text style={styles.metricLabel}>Düzenlenme Hızı</Text>
        </View>
        
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="chart-line" size={24} color="#6366F1" />
          <Text style={styles.metricValue}>
            {Math.round(userMetrics.behavioralChanges.complianceRate * 100)}%
          </Text>
          <Text style={styles.metricLabel}>Tutarlılık</Text>
        </View>
      </View>

      {/* Distortion Patterns */}
      {distortionChartData && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>🔍 En Sık Çarpıtmalar</Text>
          <View style={styles.chartPlaceholder}>
            <MaterialCommunityIcons name="chart-bar" size={48} color="#E5E7EB" />
            <Text style={styles.chartPlaceholderText}>
              Bar grafik görüntülenmesi için react-native-chart-kit kütüphanesi gerekli
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderInsightsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Strength Areas */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <MaterialCommunityIcons name="star" size={24} color="#10B981" />
          <Text style={styles.insightTitle}>💪 Güçlü Yönlerin</Text>
        </View>
        {strengthAreas.map((area, index) => (
          <View key={index} style={styles.strengthItem}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
            <Text style={styles.strengthText}>{area}</Text>
          </View>
        ))}
      </View>

      {/* Improvement Areas */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <MaterialCommunityIcons name="trending-up" size={24} color="#F59E0B" />
          <Text style={styles.insightTitle}>🎯 Gelişim Alanları</Text>
        </View>
        {improvementAreas.map((item, index) => (
          <View key={index} style={styles.improvementItem}>
            <View style={[styles.priorityIndicator, { 
              backgroundColor: item.priority === 'high' ? '#EF4444' : 
                              item.priority === 'medium' ? '#F59E0B' : '#84CC16' 
            }]} />
            <View style={styles.improvementContent}>
              <Text style={styles.improvementArea}>{item.area}</Text>
              <Text style={styles.improvementSuggestion}>{item.suggestion}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Stability Trend */}
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <MaterialCommunityIcons 
            name={userMetrics.emotionalRegulation.stabilityTrend === 'improving' ? 'trending-up' :
                  userMetrics.emotionalRegulation.stabilityTrend === 'stable' ? 'trending-neutral' : 'trending-down'} 
            size={24} 
            color={userMetrics.emotionalRegulation.stabilityTrend === 'improving' ? '#10B981' :
                   userMetrics.emotionalRegulation.stabilityTrend === 'stable' ? '#6B7280' : '#EF4444'} 
          />
          <Text style={styles.insightTitle}>📈 Duygusal Stabilite</Text>
        </View>
        
        <Text style={styles.stabilityText}>
          {userMetrics.emotionalRegulation.stabilityTrend === 'improving' && 
            "Harika! Duygusal düzenleme becerilerin sürekli gelişiyor. Bu pozitif trend devam ediyor."}
          {userMetrics.emotionalRegulation.stabilityTrend === 'stable' && 
            "Duygusal durumun stabil. Bu da iyi bir gelişme. Şimdi daha ileri tekniklere geçme zamanı."}
          {userMetrics.emotionalRegulation.stabilityTrend === 'declining' && 
            "Son dönemde duygusal düzenleme konusunda zorlanıyorsun. Bu normal bir süreç, odaklan ve devam et."}
        </Text>
      </View>
    </ScrollView>
  );

  const renderAchievementsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Recent Achievements */}
      <View style={styles.achievementsSection}>
        <Text style={styles.sectionTitle}>🏆 Son Başarılar</Text>
        {achievements.slice(0, 3).map((achievement) => (
          <View key={achievement.id} style={styles.achievementCard}>
            <Text style={styles.achievementIcon}>{achievement.icon}</Text>
            <View style={styles.achievementContent}>
              <Text style={styles.achievementName}>{achievement.name}</Text>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
              <Text style={styles.achievementPoints}>+{achievement.points} puan</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Next Milestones */}
      <View style={styles.milestonesSection}>
        <Text style={styles.sectionTitle}>🎯 Yaklaşan Hedefler</Text>
        {nextMilestones.map((milestone) => (
          <View key={milestone.id} style={styles.milestoneCard}>
            <View style={styles.milestoneInfo}>
              <Text style={styles.milestoneName}>{milestone.name}</Text>
              <Text style={styles.milestoneProgress}>
                {milestone.progress}/{milestone.target}
              </Text>
            </View>
            <View style={styles.milestoneProgressBar}>
              <View 
                style={[styles.milestoneProgressFill, { 
                  width: `${(milestone.progress / milestone.target) * 100}%` 
                }]} 
              />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CBT İlerleme Analizi</Text>
        <Pressable
          onPress={() => setShowDetailed(!showDetailed)}
          style={styles.detailToggle}
        >
          <MaterialCommunityIcons 
            name={showDetailed ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color="#6B7280" 
          />
          <Text style={styles.detailToggleText}>
            {showDetailed ? 'Basit' : 'Detaylı'}
          </Text>
        </Pressable>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        <Pressable
          style={[styles.tabButton, selectedTab === 'overview' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.tabTextActive]}>
            Genel Bakış
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.tabButton, selectedTab === 'insights' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('insights')}
        >
          <Text style={[styles.tabText, selectedTab === 'insights' && styles.tabTextActive]}>
            Öngörüler
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.tabButton, selectedTab === 'achievements' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('achievements')}
        >
          <Text style={[styles.tabText, selectedTab === 'achievements' && styles.tabTextActive]}>
            Başarılar
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      {selectedTab === 'overview' && renderOverviewTab()}
      {selectedTab === 'insights' && renderInsightsTab()}
      {selectedTab === 'achievements' && renderAchievementsTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailToggleText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    margin: 16,
    borderRadius: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scoreCard: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreInfo: {
    flex: 1,
    marginLeft: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: 'Inter',
  },
  scoreIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scoreLevel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  chart: {
    borderRadius: 8,
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  chartPlaceholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    fontFamily: 'Inter',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  strengthText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  improvementItem: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  priorityIndicator: {
    width: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  improvementContent: {
    flex: 1,
  },
  improvementArea: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  improvementSuggestion: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  stabilityText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  achievementsSection: {
    marginBottom: 24,
  },
  milestonesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  achievementPoints: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  milestoneCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  milestoneInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  milestoneName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  milestoneProgress: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  milestoneProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
});
