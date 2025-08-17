
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function CompulsionStats() {
  const [timeframe, setTimeframe] = useState('week');
  const [stats, setStats] = useState({
    totalCompulsions: 0,
    avgSeverity: 0,
    avgResistance: 0,
    mostCommonType: '',
    improvementRate: 0,
    weeklyTrend: []
  });

  useEffect(() => {
    loadStats();
  }, [timeframe]);

  const loadStats = async () => {
    try {
      const compulsionsData = await AsyncStorage.getItem('compulsions');
      if (!compulsionsData) return;

      const compulsions = JSON.parse(compulsionsData);
      const filteredData = filterByTimeframe(compulsions, timeframe);
      
      const calculatedStats = calculateStats(filteredData);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const filterByTimeframe = (data: any[], timeframe: string) => {
    const now = new Date();
    const filterDate = new Date();

    switch (timeframe) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return data;
    }

    return data.filter(item => new Date(item.timestamp) >= filterDate);
  };

  const calculateStats = (data: any[]) => {
    if (data.length === 0) {
      return {
        totalCompulsions: 0,
        avgSeverity: 0,
        avgResistance: 0,
        mostCommonType: 'Veri yok',
        improvementRate: 0,
        weeklyTrend: []
      };
    }

    const total = data.length;
    const avgSeverity = data.reduce((sum, item) => sum + item.severity, 0) / total;
    const avgResistance = data.reduce((sum, item) => sum + item.resistanceLevel, 0) / total;

    // Most common type
    const typeCounts = data.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    const mostCommonType = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b, 'Bilinmiyor'
    );

    // Weekly trend for improvement rate
    const weeklyData = generateWeeklyTrend(data);
    const improvementRate = calculateImprovementRate(weeklyData);

    return {
      totalCompulsions: total,
      avgSeverity: Number(avgSeverity.toFixed(1)),
      avgResistance: Number(avgResistance.toFixed(1)),
      mostCommonType: getTypeLabel(mostCommonType),
      improvementRate,
      weeklyTrend: weeklyData
    };
  };

  const generateWeeklyTrend = (data: any[]) => {
    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const dayData = data.filter(item => 
        new Date(item.timestamp).toDateString() === dateStr
      );
      
      weekly.push({
        date: date.getDate(),
        count: dayData.length,
        avgSeverity: dayData.length > 0 ? 
          dayData.reduce((sum, item) => sum + item.severity, 0) / dayData.length : 0
      });
    }
    return weekly;
  };

  const calculateImprovementRate = (weeklyData: any[]) => {
    if (weeklyData.length < 2) return 0;
    
    const firstHalf = weeklyData.slice(0, 3);
    const secondHalf = weeklyData.slice(4, 7);
    
    const firstAvg = firstHalf.reduce((sum, day) => sum + day.count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.count, 0) / secondHalf.length;
    
    if (firstAvg === 0) return 0;
    return Math.round(((firstAvg - secondAvg) / firstAvg) * 100);
  };

  const getTypeLabel = (type: string) => {
    try {
      const { useTranslation } = require('@/hooks/useTranslation');
      const { t } = useTranslation();
      // Önce kanonik etiketlere bak (washing→contamination gibi map gerekecek)
      const mapLegacy: Record<string, string> = {
        washing: 'contamination',
        cleaning: 'contamination',
        checking: 'checking',
        counting: 'symmetry',
        ordering: 'symmetry',
        arranging: 'symmetry',
        touching: 'symmetry',
        mental: 'mental',
        reassurance: 'other',
        avoidance: 'other',
        other: 'other'
      };
      const canonical = mapLegacy[type] || type;
      return t('categoriesCanonical.' + canonical, canonical);
    } catch (e) {
      return type;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Time Period Selector */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Zaman Aralığı
          </Text>
          <SegmentedButtons
            value={timeframe}
            onValueChange={setTimeframe}
            buttons={[
              { value: 'week', label: '7 Gün' },
              { value: 'month', label: '30 Gün' },
              { value: 'year', label: '1 Yıl' }
            ]}
            style={styles.segmentedButtons}
          />
        </Card.Content>
      </Card>

      {/* Key Metrics */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Temel Metrikler
          </Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text variant="headlineMedium" style={styles.metricNumber}>
                {stats.totalCompulsions}
              </Text>
              <Text variant="bodySmall" style={styles.metricLabel}>
                Toplam Kompulsiyon
              </Text>
            </View>
            
            <View style={styles.metricItem}>
              <Text variant="headlineMedium" style={[styles.metricNumber, { color: '#EF4444' }]}>
                {stats.avgSeverity}
              </Text>
              <Text variant="bodySmall" style={styles.metricLabel}>
                Ortalama Şiddet
              </Text>
            </View>
            
            <View style={styles.metricItem}>
              <Text variant="headlineMedium" style={[styles.metricNumber, { color: '#10B981' }]}>
                {stats.avgResistance}
              </Text>
              <Text variant="bodySmall" style={styles.metricLabel}>
                Ortalama Direnç
              </Text>
            </View>
            
            <View style={styles.metricItem}>
              <Text variant="headlineMedium" style={[styles.metricNumber, { color: '#3B82F6' }]}>
                {stats.improvementRate > 0 ? '+' : ''}{stats.improvementRate}%
              </Text>
              <Text variant="bodySmall" style={styles.metricLabel}>
                İyileşme Oranı
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Most Common Type */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            En Sık Görülen Kompulsiyon
          </Text>
          <Text variant="headlineSmall" style={styles.commonType}>
            {stats.mostCommonType}
          </Text>
        </Card.Content>
      </Card>

      {/* Weekly Trend Chart */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Haftalık Trend
          </Text>
          
          <View style={styles.chartContainer}>
            {stats.weeklyTrend.map((day, index) => (
              <View key={index} style={styles.chartBar}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      height: Math.max(day.count * 15, 10),
                      backgroundColor: day.count > 5 ? '#EF4444' : '#10B981'
                    }
                  ]} 
                />
                <Text variant="bodySmall" style={styles.chartLabel}>
                  {day.date}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Insights */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            💡 Öngörüler
          </Text>
          
          {stats.improvementRate > 0 && (
            <Text variant="bodyMedium" style={styles.insight}>
              ✅ Harika! %{stats.improvementRate} iyileşme gösteriyorsunuz.
            </Text>
          )}
          
          {stats.avgResistance > 7 && (
            <Text variant="bodyMedium" style={styles.insight}>
              💪 Dirençiniz yüksek, bu çok olumlu bir gelişme!
            </Text>
          )}
          
          {stats.avgSeverity < 5 && (
            <Text variant="bodyMedium" style={styles.insight}>
              🎯 Semptomlarınızın şiddeti kontrol altında görünüyor.
            </Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  segmentedButtons: {
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },
  metricNumber: {
    fontWeight: 'bold',
    color: '#1F2937',
  },
  metricLabel: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 4,
  },
  commonType: {
    textAlign: 'center',
    color: '#1F2937',
    fontWeight: 'bold',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginTop: 16,
  },
  chartBar: {
    alignItems: 'center',
  },
  bar: {
    width: 20,
    backgroundColor: '#10B981',
    borderRadius: 4,
    marginBottom: 4,
  },
  chartLabel: {
    color: '#6B7280',
  },
  insight: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    color: '#2E7D32',
  },
});
