import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { CompulsionEntry } from '@/types/compulsion';
import { useTranslation } from '@/hooks/useTranslation';

const { width } = Dimensions.get('window');

interface CompulsionStatsAdvancedProps {
  compulsions: CompulsionEntry[];
  timeRange: 'week' | 'month' | 'year';
}

interface DailyStats {
  date: string;
  count: number;
  avgResistance: number;
  avgIntensity: number;
  totalDuration: number;
}

interface TrendAnalysis {
  resistanceImprovement: number;
  frequencyChange: number;
  bestDay: string;
  challengingDay: string;
  insights: string[];
}

export function CompulsionStatsAdvanced({ compulsions, timeRange }: CompulsionStatsAdvancedProps) {
  const { t } = useTranslation();

  // Master Prompt: Kontrol + Sakinlik - Kullanıcı veriyi kontrol eder, yargılamayan analiz
  const dailyStats = useMemo((): DailyStats[] => {
    const stats: { [key: string]: DailyStats } = {};
    
    compulsions.forEach(entry => {
      const date = entry.timestamp.toISOString().split('T')[0];
      
      if (!stats[date]) {
        stats[date] = {
          date,
          count: 0,
          avgResistance: 0,
          avgIntensity: 0,
          totalDuration: 0,
        };
      }
      
      stats[date].count += 1;
      stats[date].totalDuration += entry.duration || 0;
    });

    // Calculate averages
    Object.keys(stats).forEach(date => {
      const dayCompulsions = compulsions.filter(
        c => c.timestamp.toISOString().split('T')[0] === date
      );
      
      stats[date].avgResistance = dayCompulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / dayCompulsions.length;
      stats[date].avgIntensity = dayCompulsions.reduce((sum, c) => sum + c.intensity, 0) / dayCompulsions.length;
    });

    return Object.values(stats).sort((a, b) => a.date.localeCompare(b.date));
  }, [compulsions]);

  // Master Prompt: Empatik Dil - Pozitif ve destekleyici insights
  const trendAnalysis = useMemo((): TrendAnalysis => {
    if (dailyStats.length < 2) {
      return {
        resistanceImprovement: 0,
        frequencyChange: 0,
        bestDay: '',
        challengingDay: '',
        insights: ['Daha fazla veri için birkaç gün daha takip edin'],
      };
    }

    const recent = dailyStats.slice(-7);
    const previous = dailyStats.slice(-14, -7);
    
    const recentAvgResistance = recent.reduce((sum, d) => sum + d.avgResistance, 0) / recent.length;
    const previousAvgResistance = previous.length > 0 
      ? previous.reduce((sum, d) => sum + d.avgResistance, 0) / previous.length 
      : recentAvgResistance;
    
    const resistanceImprovement = ((recentAvgResistance - previousAvgResistance) / 10) * 100;
    
    const recentAvgCount = recent.reduce((sum, d) => sum + d.count, 0) / recent.length;
    const previousAvgCount = previous.length > 0
      ? previous.reduce((sum, d) => sum + d.count, 0) / previous.length
      : recentAvgCount;
    
    const frequencyChange = ((previousAvgCount - recentAvgCount) / previousAvgCount) * 100;

    const bestDay = dailyStats.reduce((best, current) => 
      current.avgResistance > best.avgResistance ? current : best
    );
    
    const challengingDay = dailyStats.reduce((challenging, current) => 
      current.count > challenging.count ? current : challenging
    );

    const insights: string[] = [];
    
    if (resistanceImprovement > 10) {
      insights.push('🌱 Direnç gücünde harika ilerleme var!');
    } else if (resistanceImprovement > 0) {
      insights.push('💚 Direnç becerilerin gelişiyor');
    }
    
    if (frequencyChange > 15) {
      insights.push('⭐ Kompulsiyon sıklığında anlamlı azalma');
    } else if (frequencyChange > 0) {
      insights.push('📈 Kompulsiyon yönetiminde ilerleme');
    }
    
    if (recentAvgResistance > 7) {
      insights.push('🦋 Güçlü direnç seviyen takdire değer');
    }
    
    if (insights.length === 0) {
      insights.push('🌿 Her gün bir adım, sabırla ilerliyorsun');
    }

    return {
      resistanceImprovement,
      frequencyChange,
      bestDay: bestDay.date,
      challengingDay: challengingDay.date,
      insights,
    };
  }, [dailyStats]);

  const chartData = {
    labels: dailyStats.slice(-7).map(d => 
      new Date(d.date).toLocaleDateString('tr-TR', { weekday: 'short' })
    ),
    datasets: [
      {
        data: dailyStats.slice(-7).map(d => d.avgResistance),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Master Prompt: Sakin Yeşil
        strokeWidth: 3,
      },
    ],
  };

  const frequencyData = {
    labels: dailyStats.slice(-7).map(d => 
      new Date(d.date).toLocaleDateString('tr-TR', { weekday: 'short' })
    ),
    datasets: [
      {
        data: dailyStats.slice(-7).map(d => d.count),
      },
    ],
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Detaylı İstatistikler</Text>
        <Text style={styles.headerSubtitle}>
          İlerlemenin hikayesini keşfet
        </Text>
      </View>

      {/* Quick Insights */}
      <Card style={styles.insightsCard}>
        <Card.Content>
          <View style={styles.insightsHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#10B981" />
            <Text style={styles.insightsTitle}>Bugünün İçgörüleri</Text>
          </View>
          {trendAnalysis.insights.map((insight, index) => (
            <Text key={index} style={styles.insightText}>
              {insight}
            </Text>
          ))}
        </Card.Content>
      </Card>

      {/* Resistance Trend Chart */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>Direnç Gücü Trendi</Text>
          <Text style={styles.chartSubtitle}>Son 7 günlük direnç seviyeniz</Text>
          {dailyStats.length > 0 ? (
            <LineChart
              data={chartData}
              width={width - 64}
              height={200}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
                propsForLabels: {
                  fontSize: 12,
                  fontFamily: 'Inter',
                },
                propsForVerticalLabels: {
                  fontSize: 10,
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                Veri analizi için birkaç gün daha takip edin
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Frequency Chart */}
      <Card style={styles.chartCard}>
        <Card.Content>
          <Text style={styles.chartTitle}>Günlük Sıklık</Text>
          <Text style={styles.chartSubtitle}>Kompulsiyon sayıları</Text>
          {dailyStats.length > 0 ? (
            <BarChart
              data={frequencyData}
              width={width - 64}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                propsForLabels: {
                  fontSize: 12,
                  fontFamily: 'Inter',
                },
              }}
              style={styles.chart}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                Günlük veriler yüklenecek...
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="trending-up" size={32} color="#10B981" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryValue}>
                  {trendAnalysis.resistanceImprovement > 0 ? '+' : ''}
                  {trendAnalysis.resistanceImprovement.toFixed(1)}%
                </Text>
                <Text style={styles.summaryLabel}>Direnç İyileşmesi</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryItem}>
              <MaterialCommunityIcons name="chart-line-variant" size={32} color="#3B82F6" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryValue}>
                  {trendAnalysis.frequencyChange > 0 ? '-' : '+'}
                  {Math.abs(trendAnalysis.frequencyChange).toFixed(1)}%
                </Text>
                <Text style={styles.summaryLabel}>Sıklık Değişimi</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </View>

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
  noDataContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    marginLeft: 12,
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  bottomSpacing: {
    height: 32,
  },
}); 