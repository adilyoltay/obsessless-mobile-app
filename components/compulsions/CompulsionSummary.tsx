import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text, Card, Chip, Divider, SegmentedButtons } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CompulsionEntry, CompulsionStats, DailyCompulsionSummary } from '@/types/compulsion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { COMPULSION_CATEGORIES, getCompulsionCategory } from '@/constants/compulsions';

interface Props {
  period?: 'today' | 'week' | 'month';
  showChart?: boolean;
}

export function CompulsionSummary({ period = 'today', showChart = true }: Props) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [entries, setEntries] = useState<CompulsionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(period);

  // Load entries from AsyncStorage
  const loadEntries = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const compulsionListStr = await AsyncStorage.getItem(`compulsions_${user.id || 'anon'}`);
      if (!compulsionListStr) {
        setEntries([]);
        return;
      }

      const compulsionIds: string[] = JSON.parse(compulsionListStr);
      const loadedEntries: CompulsionEntry[] = [];

      for (const id of compulsionIds) {
        try {
          const entryStr = await AsyncStorage.getItem(id);
          if (entryStr) {
            const entry = JSON.parse(entryStr);
            entry.timestamp = new Date(entry.timestamp);
            entry.createdAt = new Date(entry.createdAt);
            entry.updatedAt = new Date(entry.updatedAt);
            loadedEntries.push(entry);
          }
        } catch (error) {
          console.error(`Error loading entry ${id}:`, error);
        }
      }

      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading compulsion entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [user?.id]);

  // Filter entries by period
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectedPeriod) {
      case 'today':
        return entries.filter(entry => {
          const entryDate = new Date(entry.timestamp.getFullYear(), entry.timestamp.getMonth(), entry.timestamp.getDate());
          return entryDate.getTime() === today.getTime();
        });
      
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return entries.filter(entry => entry.timestamp >= weekAgo);
      
      case 'month':
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return entries.filter(entry => entry.timestamp >= monthAgo);
      
      default:
        return entries;
    }
  }, [entries, selectedPeriod]);

  // Calculate statistics
  const stats = useMemo((): CompulsionStats => {
    if (filteredEntries.length === 0) {
      return {
        totalEntries: 0,
        todayEntries: 0,
        weeklyEntries: 0,
        monthlyEntries: 0,
        averageIntensity: 0,
        averageResistance: 0,
        mostCommonType: 'washing',
        longestDuration: 0,
        improvementPercentage: 0,
        streakDays: 0,
        totalCompulsions: 0,
        avgResistance: 0
      };
    }

    const totalIntensity = filteredEntries.reduce((sum, entry) => sum + entry.intensity, 0);
    const totalResistance = filteredEntries.reduce((sum, entry) => sum + entry.resistanceLevel, 0);
    const avgIntensity = totalIntensity / filteredEntries.length;
    const avgResistance = totalResistance / filteredEntries.length;

    // Find most common type
    const typeCounts: Record<string, number> = {};
    filteredEntries.forEach(entry => {
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
    });
    
    const mostCommonType = Object.keys(typeCounts).reduce((a, b) =>
      typeCounts[a] > typeCounts[b] ? a : b
    ) as any;

    // Find longest duration
    const longestDuration = Math.max(...filteredEntries.map(entry => entry.duration || 0));

    // Improvement percentage vs previous same-sized window
    const windowMillis = selectedPeriod === 'today' ? 24*60*60*1000 : selectedPeriod === 'week' ? 7*24*60*60*1000 : 30*24*60*60*1000;
    const end = new Date();
    const start = new Date(end.getTime() - windowMillis);
    const prevStart = new Date(start.getTime() - windowMillis);
    const prevEnd = new Date(start.getTime());
    const prevEntries = entries.filter(e => e.timestamp >= prevStart && e.timestamp < prevEnd);
    const currCount = filteredEntries.length;
    const prevCount = prevEntries.length;
    const improvementPercentage = prevCount > 0 ? Number((((prevCount - currCount) / prevCount) * 100).toFixed(1)) : 0;

    // Streak days: consecutive days with zero compulsions (improvement streak)
    let streakDays = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const startDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endDay = new Date(startDay.getTime() + 24*60*60*1000);
      const dayCount = entries.filter(e => e.timestamp >= startDay && e.timestamp < endDay).length;
      if (dayCount === 0) streakDays++; else break;
    }

    return {
      totalEntries: filteredEntries.length,
      todayEntries: filteredEntries.length,
      weeklyEntries: filteredEntries.length,
      monthlyEntries: filteredEntries.length,
      averageIntensity: Number(avgIntensity.toFixed(1)),
      averageResistance: Number(avgResistance.toFixed(1)),
      mostCommonType,
      longestDuration,
      improvementPercentage,
      streakDays,
      totalCompulsions: filteredEntries.length,
      avgResistance: Number(avgResistance.toFixed(1))
    };
  }, [filteredEntries]);

  // Group by type for breakdown
  const typeBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; avgIntensity: number; avgResistance: number; totalDuration: number }> = {};
    
    filteredEntries.forEach(entry => {
      if (!breakdown[entry.type]) {
        breakdown[entry.type] = {
          count: 0,
          avgIntensity: 0,
          avgResistance: 0,
          totalDuration: 0
        };
      }
      
      breakdown[entry.type].count++;
      breakdown[entry.type].avgIntensity += entry.intensity;
      breakdown[entry.type].avgResistance += entry.resistanceLevel;
      breakdown[entry.type].totalDuration += (entry.duration || 0);
    });

    // Calculate averages
    Object.keys(breakdown).forEach(type => {
      const data = breakdown[type];
      data.avgIntensity = Number((data.avgIntensity / data.count).toFixed(1));
      data.avgResistance = Number((data.avgResistance / data.count).toFixed(1));
    });

    return breakdown;
  }, [filteredEntries]);

  // Daily breakdown for charts (last 7 days)
  const dailyBreakdown = useMemo(() => {
    const days: DailyCompulsionSummary[] = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayEntries = entries.filter(entry => 
        entry.timestamp >= dayStart && entry.timestamp < dayEnd
      );

      const compulsionsByType: Record<string, number> = {};
      COMPULSION_CATEGORIES.forEach(cat => {
        compulsionsByType[cat.id] = dayEntries.filter(e => e.type === cat.id).length;
      });

      // Ortalama mood: var ise girişlerin mood ortalaması, yoksa neutral
      const moodAvg = dayEntries.length > 0 && (dayEntries as any[]).every(e => typeof e.mood === 'number')
        ? Number(((dayEntries as any[]).reduce((s, e) => s + (e.mood || 0), 0) / dayEntries.length).toFixed(1))
        : 0;

      days.push({
        date: dayStart,
        count: dayEntries.length,
        avgResistance: dayEntries.length > 0
          ? Number((dayEntries.reduce((sum, e) => sum + e.resistanceLevel, 0) / dayEntries.length).toFixed(1))
          : 0,
        types: Object.keys(compulsionsByType),
        totalCompulsions: dayEntries.length,
        averageIntensity: dayEntries.length > 0
          ? Number((dayEntries.reduce((sum, e) => sum + e.intensity, 0) / dayEntries.length).toFixed(1))
          : 0,
        averageResistance: dayEntries.length > 0
          ? Number((dayEntries.reduce((sum, e) => sum + e.resistanceLevel, 0) / dayEntries.length).toFixed(1))
          : 0,
        totalDuration: dayEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
        mood: moodAvg >= 0.7 ? 'positive' : moodAvg <= 0.3 ? 'negative' : 'neutral',
        compulsionsByType: compulsionsByType as any
      } as any);
    }
    
    return days;
  }, [entries]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}dk`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}s ${remainingMinutes}dk` : `${hours}s`;
  };

  const getIntensityColor = (intensity: number) => {
    if (intensity <= 3) return '#10B981';
    if (intensity <= 6) return '#F59E0B';
    return '#EF4444';
  };

  const getResistanceColor = (resistance: number) => {
    if (resistance >= 7) return '#10B981';
    if (resistance >= 4) return '#F59E0B';
    return '#EF4444';
  };

  const periodLabels = {
    today: 'Bugün',
    week: 'Bu Hafta',
    month: 'Bu Ay'
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="bodyMedium">Veriler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <SegmentedButtons
          value={selectedPeriod}
          onValueChange={(value) => setSelectedPeriod(value as any)}
          buttons={[
            { value: 'today', label: '📅 Bugün' },
            { value: 'week', label: '📊 Hafta' },
            { value: 'month', label: '📈 Ay' }
          ]}
        />
      </View>

      {/* Overview Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {periodLabels[selectedPeriod]} Özeti
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: '#1F2937' }]}>
                {stats.totalEntries}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>Toplam Kayıt</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: getIntensityColor(stats.averageIntensity) }]}>
                {stats.averageIntensity}/10
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>Ortalama Şiddet</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, { color: getResistanceColor(stats.averageResistance) }]}>
                {stats.averageResistance}/10
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>Ortalama Direnç</Text>
            </View>
          </View>

          {stats.longestDuration > 0 && (
            <View style={styles.additionalStats}>
              <Divider style={styles.divider} />
              <View style={styles.additionalStatsRow}>
                <Text variant="bodyMedium" style={styles.additionalStatLabel}>
                  ⏱️ En Uzun Süre: 
                </Text>
                <Text variant="bodyMedium" style={styles.additionalStatValue}>
                  {formatDuration(stats.longestDuration)}
                </Text>
              </View>
              
              <View style={styles.additionalStatsRow}>
                <Text variant="bodyMedium" style={styles.additionalStatLabel}>
                  🎯 En Yaygın Tür: 
                </Text>
                <Chip mode="outlined" compact style={styles.typeChip}>
                  {getCompulsionCategory(stats.mostCommonType).icon} {language === 'tr' 
                    ? getCompulsionCategory(stats.mostCommonType).name 
                    : getCompulsionCategory(stats.mostCommonType).nameEn}
                </Chip>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Type Breakdown */}
      {Object.keys(typeBreakdown).length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Türe Göre Dağılım
            </Text>
            
            {Object.entries(typeBreakdown).map(([type, data]) => {
              const category = getCompulsionCategory(type as any);
              return (
                <View key={type} style={styles.typeBreakdownItem}>
                  <View style={styles.typeHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: category.color }]}>
                      <Text style={styles.typeIconText}>{category.icon}</Text>
                    </View>
                    <View style={styles.typeInfo}>
                      <Text variant="titleSmall" style={styles.typeName}>
                        {language === 'tr' ? category.name : category.nameEn}
                      </Text>
                      <Text variant="bodySmall" style={styles.typeCount}>
                        {data.count} kayıt
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.typeMetrics}>
                    <View style={styles.typeMetric}>
                      <Text variant="bodySmall" style={styles.metricLabel}>Şiddet</Text>
                      <Text variant="bodyMedium" style={[styles.metricValue, { color: getIntensityColor(data.avgIntensity) }]}>
                        {data.avgIntensity}/10
                      </Text>
                    </View>
                    <View style={styles.typeMetric}>
                      <Text variant="bodySmall" style={styles.metricLabel}>Direnç</Text>
                      <Text variant="bodyMedium" style={[styles.metricValue, { color: getResistanceColor(data.avgResistance) }]}>
                        {data.avgResistance}/10
                      </Text>
                    </View>
                    {data.totalDuration > 0 && (
                      <View style={styles.typeMetric}>
                        <Text variant="bodySmall" style={styles.metricLabel}>Süre</Text>
                        <Text variant="bodyMedium" style={styles.metricValue}>
                          {formatDuration(data.totalDuration)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      )}

      {/* Daily Chart (for week/month view) */}
      {selectedPeriod !== 'today' && showChart && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Günlük Trend
            </Text>
            
            <View style={styles.chartContainer}>
              {dailyBreakdown.map((day, index) => (
                <View key={index} style={styles.chartBar}>
                  <View 
                    style={[
                      styles.barFill, 
                      { 
                        height: Math.max(4, (day.totalCompulsions / Math.max(...dailyBreakdown.map(d => d.totalCompulsions), 1)) * 100),
                        backgroundColor: day.totalCompulsions > 0 ? '#10B981' : '#E5E7EB'
                      }
                    ]} 
                  />
                  <Text variant="bodySmall" style={styles.chartLabel}>
                    {day.date.getDate()}
                  </Text>
                  <Text variant="bodySmall" style={styles.chartCount}>
                    {day.totalCompulsions}
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Empty State */}
      {stats.totalEntries === 0 && (
        <Card style={styles.card}>
          <Card.Content style={styles.emptyState}>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              📊 Henüz veri yok
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {periodLabels[selectedPeriod]} için henüz kompülsiyon kaydı bulunmuyor.
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  periodSelector: {
    padding: 16,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    borderRadius: 12,
  },
  cardTitle: {
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#6B7280',
    textAlign: 'center',
  },
  additionalStats: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 12,
  },
  additionalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  additionalStatLabel: {
    color: '#374151',
    marginRight: 8,
  },
  additionalStatValue: {
    color: '#1F2937',
    fontWeight: '600',
  },
  typeChip: {
    height: 28,
  },
  typeBreakdownItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIconText: {
    fontSize: 14,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  typeCount: {
    color: '#6B7280',
  },
  typeMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  typeMetric: {
    alignItems: 'center',
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 10,
    marginBottom: 2,
  },
  metricValue: {
    fontWeight: '600',
    fontSize: 13,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 20,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 40,
  },
  barFill: {
    width: 24,
    backgroundColor: '#10B981',
    borderRadius: 2,
    marginBottom: 8,
  },
  chartLabel: {
    color: '#6B7280',
    marginBottom: 2,
  },
  chartCount: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 