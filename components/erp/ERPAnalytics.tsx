import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import { useTranslation } from '@/hooks/useTranslation';

const { width } = Dimensions.get('window');

interface ERPAnalyticsProps {
  sessions: ERPSession[];
  timeRange: 'week' | 'month' | 'year';
}

interface ERPSession {
  id: string;
  exerciseName: string;
  date: Date;
  duration: number; // in seconds
  targetDuration: number; // in seconds
  completed: boolean;
  anxietyReadings: AnxietyReading[];
  initialAnxiety: number;
  peakAnxiety: number;
  finalAnxiety: number;
  notes: string;
}

interface AnxietyReading {
  timestamp: number;
  level: number;
}

interface ProgressMetrics {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  avgDuration: number;
  avgAnxietyReduction: number;
  consistencyStreak: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  challengingExercises: string[];
  successfulExercises: string[];
  therapeuticInsights: string[];
}

export function ERPAnalytics({ sessions, timeRange }: ERPAnalyticsProps) {
  const { t } = useTranslation();

  // Master Prompt: Kontrol + Empatik Analiz
  const progressMetrics = useMemo((): ProgressMetrics => {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        avgDuration: 0,
        avgAnxietyReduction: 0,
        consistencyStreak: 0,
        improvementTrend: 'stable',
        challengingExercises: [],
        successfulExercises: [],
        therapeuticInsights: ['ERP alıştırmalarına başlamak için cesaret gerektirir 💚'],
      };
    }

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.completed).length;
    const completionRate = (completedSessions / totalSessions) * 100;
    
    // Average duration calculation
    const completedSessionsData = sessions.filter(s => s.completed);
    const avgDuration = completedSessionsData.length > 0
      ? completedSessionsData.reduce((sum, s) => sum + s.duration, 0) / completedSessionsData.length
      : 0;

    // Anxiety reduction analysis
    const anxietyReductions = sessions
      .filter(s => s.anxietyReadings.length > 0)
      .map(s => s.initialAnxiety - s.finalAnxiety);
    
    const avgAnxietyReduction = anxietyReductions.length > 0
      ? anxietyReductions.reduce((sum, reduction) => sum + reduction, 0) / anxietyReductions.length
      : 0;

    // Consistency streak (consecutive days with sessions)
    const sortedSessions = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
    let consistencyStreak = 0;
    let currentStreak = 0;
    let lastDate: Date | null = null;

    sortedSessions.forEach(session => {
      if (lastDate) {
        const dayDiff = Math.floor((session.date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
          currentStreak++;
        } else if (dayDiff > 1) {
          consistencyStreak = Math.max(consistencyStreak, currentStreak);
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      lastDate = session.date;
    });
    consistencyStreak = Math.max(consistencyStreak, currentStreak);

    // Exercise analysis
    const exerciseStats: { [key: string]: { completed: number; total: number; avgAnxietyReduction: number } } = {};
    
    sessions.forEach(session => {
      if (!exerciseStats[session.exerciseName]) {
        exerciseStats[session.exerciseName] = { completed: 0, total: 0, avgAnxietyReduction: 0 };
      }
      exerciseStats[session.exerciseName].total++;
      if (session.completed) {
        exerciseStats[session.exerciseName].completed++;
      }
      const reduction = session.initialAnxiety - session.finalAnxiety;
      exerciseStats[session.exerciseName].avgAnxietyReduction += reduction;
    });

    // Calculate averages and find challenging/successful exercises
    Object.keys(exerciseStats).forEach(exercise => {
      const stats = exerciseStats[exercise];
      stats.avgAnxietyReduction = stats.avgAnxietyReduction / stats.total;
    });

    const challengingExercises = Object.keys(exerciseStats)
      .filter(exercise => {
        const stats = exerciseStats[exercise];
        return stats.total >= 2 && (stats.completed / stats.total) < 0.5;
      })
      .slice(0, 3);

    const successfulExercises = Object.keys(exerciseStats)
      .filter(exercise => {
        const stats = exerciseStats[exercise];
        return stats.total >= 2 && (stats.completed / stats.total) >= 0.8;
      })
      .slice(0, 3);

    // Improvement trend analysis
    const recentSessions = sessions.slice(-5);
    const olderSessions = sessions.slice(-10, -5);
    
    let improvementTrend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (recentSessions.length >= 3 && olderSessions.length >= 3) {
      const recentAvgReduction = recentSessions.reduce((sum, s) => sum + (s.initialAnxiety - s.finalAnxiety), 0) / recentSessions.length;
      const olderAvgReduction = olderSessions.reduce((sum, s) => sum + (s.initialAnxiety - s.finalAnxiety), 0) / olderSessions.length;
      
      if (recentAvgReduction > olderAvgReduction + 0.5) {
        improvementTrend = 'improving';
      } else if (recentAvgReduction < olderAvgReduction - 0.5) {
        improvementTrend = 'declining';
      }
    }

    // Master Prompt: Therapeutic insights with empathetic language
    const therapeuticInsights: string[] = [];
    
    if (completionRate >= 80) {
      therapeuticInsights.push('🌟 Oturum tamamlama oranın mükemmel - bu büyük bir başarı!');
    } else if (completionRate >= 60) {
      therapeuticInsights.push('💪 ERP alıştırmalarında güzel tutarlılık gösteriyorsun');
    } else if (completionRate >= 40) {
      therapeuticInsights.push('🌱 Her oturum deneyimle büyüyorsun - sabırlı ol');
    } else {
      therapeuticInsights.push('💚 ERP zorlu bir süreç - kendine karşı nazik ol');
    }

    if (avgAnxietyReduction > 2) {
      therapeuticInsights.push('🦋 Anksiyete yönetiminde harika ilerleme kaydediyorsun');
    } else if (avgAnxietyReduction > 1) {
      therapeuticInsights.push('🌿 Anksiyetenle başa çıkma becerilerin gelişiyor');
    }

    if (consistencyStreak >= 7) {
      therapeuticInsights.push(`🔥 ${consistencyStreak} günlük tutarlılık - bu inanılmaz bir disiplin!`);
    } else if (consistencyStreak >= 3) {
      therapeuticInsights.push(`⭐ ${consistencyStreak} günlük seri - güzel bir momentum`);
    }

    if (improvementTrend === 'improving') {
      therapeuticInsights.push('📈 Son oturumlarda gözle görülür iyileşme var');
    } else if (improvementTrend === 'stable') {
      therapeuticInsights.push('📊 İstikrarlı ilerleme gösteriyorsun - bu önemli');
    }

    if (therapeuticInsights.length === 0) {
      therapeuticInsights.push('🌻 Her ERP oturumu iyileşmeye doğru atılan bir adım');
    }

    return {
      totalSessions,
      completedSessions,
      completionRate,
      avgDuration,
      avgAnxietyReduction,
      consistencyStreak,
      improvementTrend,
      challengingExercises,
      successfulExercises,
      therapeuticInsights,
    };
  }, [sessions]);

  // Chart data for anxiety reduction over time
  const anxietyChartData = useMemo(() => {
    const recentSessions = sessions.slice(-7);
    return {
      labels: recentSessions.map((_, index) => `${index + 1}`),
      datasets: [
        {
          data: recentSessions.map(s => s.initialAnxiety),
          color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red for initial
          strokeWidth: 2,
        },
        {
          data: recentSessions.map(s => s.finalAnxiety),
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green for final
          strokeWidth: 2,
        },
      ],
      legend: ['Başlangıç', 'Bitiş'],
    };
  }, [sessions]);

  // Progress circle data
  const progressData = {
    labels: ['Tamamlanan', 'Kalan'],
    data: [progressMetrics.completionRate / 100, 1 - (progressMetrics.completionRate / 100)],
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return '#10B981';
      case 'declining': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return 'trending-up';
      case 'declining': return 'trending-down';
      default: return 'trending-neutral';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ERP Analizi</Text>
        <Text style={styles.headerSubtitle}>
          İlerlemenin derinlemesine analizi
        </Text>
      </View>

      {/* Progress Summary Cards */}
      <View style={styles.summaryContainer}>
        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <MaterialCommunityIcons name="counter" size={24} color="#3B82F6" />
            <Text style={styles.summaryValue}>{progressMetrics.totalSessions}</Text>
            <Text style={styles.summaryLabel}>Toplam Oturum</Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
            <Text style={styles.summaryValue}>{progressMetrics.completionRate.toFixed(0)}%</Text>
            <Text style={styles.summaryLabel}>Tamamlama</Text>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content style={styles.summaryContent}>
            <MaterialCommunityIcons name="fire" size={24} color="#F97316" />
            <Text style={styles.summaryValue}>{progressMetrics.consistencyStreak}</Text>
            <Text style={styles.summaryLabel}>Tutarlılık</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Therapeutic Insights */}
      <Card style={styles.insightsCard}>
        <Card.Content>
          <View style={styles.insightsHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#10B981" />
            <Text style={styles.insightsTitle}>Terapötik İçgörüler</Text>
          </View>
          {progressMetrics.therapeuticInsights.map((insight, index) => (
            <Text key={index} style={styles.insightText}>
              {insight}
            </Text>
          ))}
        </Card.Content>
      </Card>

      {/* Anxiety Reduction Chart */}
      {sessions.length > 0 && (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text style={styles.chartTitle}>Anksiyete Seviyesi Değişimi</Text>
            <Text style={styles.chartSubtitle}>Son 7 oturumdaki ilerleme</Text>
            <LineChart
              data={anxietyChartData}
              width={width - 64}
              height={200}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                color: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                strokeWidth: 2,
                propsForLabels: {
                  fontSize: 12,
                  fontFamily: 'Inter',
                },
              }}
              bezier
              style={styles.chart}
            />
          </Card.Content>
        </Card>
      )}

      {/* Progress Circle */}
      <Card style={styles.progressCard}>
        <Card.Content>
          <Text style={styles.progressTitle}>Tamamlama Oranı</Text>
          <ProgressChart
            data={progressData}
            width={width - 64}
            height={180}
            strokeWidth={16}
            radius={64}
            chartConfig={{
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
              strokeWidth: 2,
            }}
            hideLegend={false}
            style={styles.progressChart}
          />
          <View style={styles.progressStats}>
            <Text style={styles.progressValue}>
              {progressMetrics.completionRate.toFixed(1)}%
            </Text>
            <Text style={styles.progressLabel}>
              {progressMetrics.completedSessions}/{progressMetrics.totalSessions} oturum
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Exercise Analysis */}
      {(progressMetrics.successfulExercises.length > 0 || progressMetrics.challengingExercises.length > 0) && (
        <Card style={styles.exerciseCard}>
          <Card.Content>
            <Text style={styles.exerciseTitle}>Egzersiz Analizi</Text>
            
            {progressMetrics.successfulExercises.length > 0 && (
              <View style={styles.exerciseSection}>
                <View style={styles.exerciseSectionHeader}>
                  <MaterialCommunityIcons name="trophy" size={20} color="#10B981" />
                  <Text style={styles.exerciseSectionTitle}>Başarılı Egzersizler</Text>
                </View>
                {progressMetrics.successfulExercises.map((exercise, index) => (
                  <Text key={index} style={styles.exerciseItem}>
                    • {exercise}
                  </Text>
                ))}
              </View>
            )}

            {progressMetrics.challengingExercises.length > 0 && (
              <View style={styles.exerciseSection}>
                <View style={styles.exerciseSectionHeader}>
                  <MaterialCommunityIcons name="target" size={20} color="#F97316" />
                  <Text style={styles.exerciseSectionTitle}>Odak Alanları</Text>
                </View>
                {progressMetrics.challengingExercises.map((exercise, index) => (
                  <Text key={index} style={styles.exerciseItem}>
                    • {exercise}
                  </Text>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Improvement Trend */}
      <Card style={styles.trendCard}>
        <Card.Content>
          <View style={styles.trendHeader}>
            <MaterialCommunityIcons 
              name={getTrendIcon(progressMetrics.improvementTrend)} 
              size={24} 
              color={getTrendColor(progressMetrics.improvementTrend)} 
            />
            <Text style={styles.trendTitle}>İyileşme Trendi</Text>
          </View>
          <Text style={[
            styles.trendValue,
            { color: getTrendColor(progressMetrics.improvementTrend) }
          ]}>
            {progressMetrics.improvementTrend === 'improving' ? 'İyileşiyor' :
             progressMetrics.improvementTrend === 'declining' ? 'Dikkat Gerekli' : 'İstikrarlı'}
          </Text>
          <Text style={styles.trendDescription}>
            {progressMetrics.avgAnxietyReduction > 0 
              ? `Ortalama ${progressMetrics.avgAnxietyReduction.toFixed(1)} puan anksiyete azalması`
              : 'İyileşme sürecinde sabırlı olmak önemli'}
          </Text>
        </Card.Content>
      </Card>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
  },
  summaryContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'center',
  },
  insightsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  insightText: {
    fontSize: 15,
    color: '#059669',
    fontFamily: 'Inter',
    marginBottom: 6,
    lineHeight: 22,
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
  },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressChart: {
    alignSelf: 'center',
  },
  progressStats: {
    alignItems: 'center',
    marginTop: 16,
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: 'Inter-Medium',
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginBottom: 16,
  },
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  exerciseItem: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
    marginLeft: 16,
  },
  trendCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  trendDescription: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  bottomSpacing: {
    height: 32,
  },
}); 