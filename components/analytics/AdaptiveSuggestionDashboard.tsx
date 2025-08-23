/**
 * 📊 Adaptive Suggestion Analytics Dashboard
 * 
 * Displays comprehensive analytics for JITAI/Adaptive Interventions:
 * - Performance metrics (CTR, dismissal rate)
 * - Category effectiveness
 * - Timing insights
 * - User engagement patterns
 * - Trend analysis
 * 
 * Can be used as a debug overlay or settings screen component.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { adaptiveSuggestionAnalytics, AnalyticsMetrics } from '@/features/ai/analytics/adaptiveSuggestionAnalytics';

const { width } = Dimensions.get('window');

interface DashboardProps {
  style?: ViewStyle;
  onClose?: () => void;
  isOverlay?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, color, trend }) => (
  <View style={[styles.metricCard, { borderLeftColor: color }]}>
    <View style={styles.metricHeader}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
    
    <Text style={[styles.metricValue, { color }]}>
      {typeof value === 'number' ? Math.round(value * 100) / 100 : value}
    </Text>
    
    {subtitle && (
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    )}
    
    {trend && (
      <View style={[styles.trendIndicator, { backgroundColor: trend.isPositive ? '#D1FAE5' : '#FEE2E2' }]}>
        <MaterialCommunityIcons 
          name={trend.isPositive ? 'trending-up' : 'trending-down'} 
          size={14} 
          color={trend.isPositive ? '#059669' : '#DC2626'} 
        />
        <Text style={[styles.trendText, { color: trend.isPositive ? '#059669' : '#DC2626' }]}>
          {Math.abs(trend.value).toFixed(1)}%
        </Text>
      </View>
    )}
  </View>
);

const CategoryCard: React.FC<{
  category: string;
  data: {
    shown: number;
    clicked: number;
    dismissed: number;
    ctr: number;
    avgConfidence: number;
  };
  rank: number;
}> = ({ category, data, rank }) => {
  const getCategoryInfo = (cat: string) => {
    switch (cat) {
      case 'breathwork':
        return { name: 'Nefes Egzersizi', icon: 'meditation' as const, color: '#8B5CF6' };
      case 'cbt':
        return { name: 'Düşünce Kaydı', icon: 'brain' as const, color: '#3B82F6' };
      case 'mood':
        return { name: 'Mood Check-in', icon: 'emoticon-happy-outline' as const, color: '#F59E0B' };
      case 'tracking':
        return { name: 'Takip', icon: 'chart-line' as const, color: '#10B981' };
      default:
        return { name: 'Genel', icon: 'lightbulb-on-outline' as const, color: '#6B7280' };
    }
  };

  const categoryInfo = getCategoryInfo(category);
  
  return (
    <View style={[styles.categoryCard, { borderLeftColor: categoryInfo.color }]}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryTitleContainer}>
          <MaterialCommunityIcons 
            name={categoryInfo.icon} 
            size={20} 
            color={categoryInfo.color} 
          />
          <Text style={styles.categoryName}>{categoryInfo.name}</Text>
          <View style={[styles.rankBadge, { backgroundColor: rank <= 2 ? '#10B981' : '#6B7280' }]}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        </View>
        
        <Text style={[styles.ctrValue, { color: categoryInfo.color }]}>
          %{Math.round(data.ctr * 100)}
        </Text>
      </View>
      
      <View style={styles.categoryStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Gösterim</Text>
          <Text style={styles.statValue}>{data.shown}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Tıklama</Text>
          <Text style={styles.statValue}>{data.clicked}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Güven</Text>
          <Text style={styles.statValue}>%{Math.round(data.avgConfidence * 100)}</Text>
        </View>
      </View>
    </View>
  );
};

export const AdaptiveSuggestionDashboard: React.FC<DashboardProps> = ({ 
  style, 
  onClose, 
  isOverlay = false 
}) => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [categoryRanking, setCategoryRanking] = useState<any[]>([]);
  const [timingRecommendations, setTimingRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(7); // Days

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const [metricsData, categoryData, timingData] = await Promise.all([
        adaptiveSuggestionAnalytics.getMetrics(selectedPeriod),
        adaptiveSuggestionAnalytics.getCategoryRanking(selectedPeriod),
        adaptiveSuggestionAnalytics.getOptimalTimingRecommendations()
      ]);

      setMetrics(metricsData);
      setCategoryRanking(categoryData);
      setTimingRecommendations(timingData);
      
    } catch (error) {
      console.error('❌ Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour: number): string => {
    return hour.toString().padStart(2, '0') + ':00';
  };

  const getDayName = (day: number): string => {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[day];
  };

  if (loading || !metrics) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.loadingText}>📊 Analytics yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {isOverlay && (
        <LinearGradient
          colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.7)']}
          style={styles.overlayBackground}
        />
      )}
      
      <View style={[styles.dashboard, isOverlay && styles.overlayDashboard]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="chart-box" size={28} color="#3B82F6" />
            <Text style={styles.title}>Adaptif Öneri Analytics</Text>
          </View>
          
          {onClose && (
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          )}
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {[7, 14, 30].map(days => (
            <Pressable
              key={days}
              style={[
                styles.periodButton,
                selectedPeriod === days && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(days)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === days && styles.periodButtonTextActive
              ]}>
                Son {days} Gün
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Key Metrics */}
          <Text style={styles.sectionTitle}>📊 Ana Metrikler</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Toplam Gösterim"
              value={metrics.totalShown}
              icon="eye"
              color="#3B82F6"
              subtitle={`${selectedPeriod} günde`}
            />
            
            <MetricCard
              title="Tıklama Oranı"
              value={`%${Math.round(metrics.clickThroughRate * 100)}`}
              icon="cursor-pointer"
              color="#10B981"
              trend={{
                value: metrics.trends.ctrChange,
                isPositive: metrics.trends.ctrChange > 0
              }}
            />
            
            <MetricCard
              title="Erteleme Oranı"
              value={`%${Math.round(metrics.dismissalRate * 100)}`}
              icon="clock-outline"
              color="#F59E0B"
              trend={{
                value: metrics.trends.dismissalChange,
                isPositive: metrics.trends.dismissalChange < 0 // Lower dismissal is better
              }}
            />
            
            <MetricCard
              title="Geri Dönüş Oranı"
              value={`%${Math.round(metrics.engagementMetrics.returnUserRate * 100)}`}
              icon="repeat"
              color="#8B5CF6"
              subtitle="Tekrar tıklayan kullanıcılar"
            />
          </View>

          {/* Category Performance */}
          <Text style={styles.sectionTitle}>🎯 Kategori Performansı</Text>
          {categoryRanking.length > 0 ? (
            <View style={styles.categoryList}>
              {categoryRanking.map((category, index) => (
                <CategoryCard
                  key={category.category}
                  category={category.category}
                  data={{
                    shown: category.shown,
                    clicked: category.clicked,
                    dismissed: category.shown - category.clicked,
                    ctr: category.ctr,
                    avgConfidence: category.avgConfidence
                  }}
                  rank={category.rank}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>Henüz kategori verisi yok</Text>
          )}

          {/* Timing Insights */}
          {timingRecommendations && (
            <>
              <Text style={styles.sectionTitle}>⏰ Zamanlama İçgörüleri</Text>
              
              <View style={styles.timingSection}>
                <Text style={styles.timingSectionTitle}>En İyi Saatler</Text>
                <View style={styles.timingGrid}>
                  {timingRecommendations.bestHours.slice(0, 3).map((item: any, index: number) => (
                    <View key={item.hour} style={styles.timingCard}>
                      <Text style={styles.timingTime}>{formatTime(item.hour)}</Text>
                      <Text style={styles.timingLabel}>{item.label}</Text>
                      <Text style={styles.timingCTR}>%{Math.round(item.ctr * 100)} CTR</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.timingSection}>
                <Text style={styles.timingSectionTitle}>En İyi Günler</Text>
                <View style={styles.timingGrid}>
                  {timingRecommendations.bestDays.slice(0, 3).map((item: any, index: number) => (
                    <View key={item.day} style={styles.timingCard}>
                      <Text style={styles.timingDay}>{getDayName(item.day)}</Text>
                      <Text style={styles.timingCTR}>%{Math.round(item.ctr * 100)} CTR</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Engagement Metrics */}
          <Text style={styles.sectionTitle}>💡 Etkileşim Metrikleri</Text>
          <View style={styles.engagementCards}>
            <View style={styles.engagementCard}>
              <MaterialCommunityIcons name="clock-check" size={20} color="#10B981" />
              <Text style={styles.engagementTitle}>Ort. Oturum Süresi</Text>
              <Text style={styles.engagementValue}>
                {Math.round(metrics.engagementMetrics.avgSessionDuration / 1000)}s
              </Text>
            </View>
            
            <View style={styles.engagementCard}>
              <MaterialCommunityIcons name="undo" size={20} color="#8B5CF6" />
              <Text style={styles.engagementTitle}>Erteleyip Geri Dönme</Text>
              <Text style={styles.engagementValue}>
                {metrics.engagementMetrics.snoozedButReturned}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>📈 Özet</Text>
            <Text style={styles.summaryText}>
              Son {selectedPeriod} günde {metrics.totalShown} öneri gösterildi. 
              Kullanıcılar %{Math.round(metrics.clickThroughRate * 100)} oranında önerileri kabul etti.
            </Text>
            
            {categoryRanking.length > 0 && (
              <Text style={styles.summaryText}>
                En başarılı kategori: {categoryRanking[0]?.category === 'breathwork' ? 'Nefes Egzersizi' :
                                     categoryRanking[0]?.category === 'cbt' ? 'Düşünce Kaydı' :
                                     categoryRanking[0]?.category === 'mood' ? 'Mood Check-in' : 'Takip'} 
                (%{Math.round(categoryRanking[0]?.ctr * 100)} CTR)
              </Text>
            )}
          </View>
          
          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,

  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as ViewStyle,

  dashboard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  } as ViewStyle,

  overlayDashboard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    maxHeight: '90%',
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  } as ViewStyle,

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  } as ViewStyle,

  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    gap: 8,
  } as ViewStyle,

  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  } as ViewStyle,

  periodButtonActive: {
    backgroundColor: '#3B82F6',
  } as ViewStyle,

  periodButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  periodButtonTextActive: {
    color: 'white',
  } as TextStyle,

  content: {
    flex: 1,
    padding: 16,
  } as ViewStyle,

  loadingText: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  } as TextStyle,

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    marginTop: 24,
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  } as ViewStyle,

  metricCard: {
    width: (width - 60) / 2, // Two columns with gaps
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,

  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  } as ViewStyle,

  metricTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontFamily: 'Inter',
  } as TextStyle,

  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  } as TextStyle,

  metricSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  } as TextStyle,

  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  } as ViewStyle,

  trendText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  categoryList: {
    gap: 12,
  } as ViewStyle,

  categoryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  } as ViewStyle,

  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,

  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  } as ViewStyle,

  rankText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  ctrValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  } as ViewStyle,

  statItem: {
    alignItems: 'center',
  } as ViewStyle,

  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  } as TextStyle,

  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  timingSection: {
    marginBottom: 20,
  } as ViewStyle,

  timingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  timingGrid: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,

  timingCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  timingTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  timingDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  timingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  } as TextStyle,

  timingCTR: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  engagementCards: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,

  engagementCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,

  engagementTitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  } as TextStyle,

  engagementValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  summary: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  } as ViewStyle,

  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  summaryText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: 'Inter',
  } as TextStyle,

  noDataText: {
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    padding: 20,
    fontFamily: 'Inter',
  } as TextStyle,

  bottomSpacing: {
    height: 20,
  } as ViewStyle,
});

export default AdaptiveSuggestionDashboard;
