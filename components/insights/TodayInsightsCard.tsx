/**
 * Today Insights Card
 * 
 * AI-free rule-based insights for Today screen.
 * Uses offline mood analytics, no external calls.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import offlineMoodInsights from '@/services/offlineMoodInsights';

interface MoodInsight {
  id: string;
  type: 'trend' | 'achievement' | 'suggestion' | 'pattern';
  title: string;
  description: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  actionable?: boolean;
}

interface TodayInsightsCardProps {
  onActionPress?: (insight: MoodInsight) => void;
}

export default function TodayInsightsCard({ onActionPress }: TodayInsightsCardProps) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<MoodInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any>(null);

  const loadInsights = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      const [todayInsights, weeklySummary] = await Promise.all([
        offlineMoodInsights.generateTodayInsights(user.id),
        offlineMoodInsights.getWeeklySummary(user.id)
      ]);

      setInsights(todayInsights);
      setWeeklyData(weeklySummary);
    } catch (error) {
      console.error('Failed to load today insights:', error);
      // Fallback insight
      setInsights([{
        id: 'fallback',
        type: 'suggestion',
        title: 'Bugün Nasılsın? 😊',
        description: 'Mood\'unu kaydetmeye hazır mısın? Küçük adımlar büyük değişimler yaratır.',
        icon: 'heart',
        priority: 'medium',
        actionable: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, [user?.id]);

  const getInsightIcon = (icon: string) => {
    switch (icon) {
      case 'fire': return 'fire';
      case 'trending-up': return 'trending-up';
      case 'heart': return 'heart';
      case 'clipboard-check': return 'clipboard-check-outline';
      case 'chart-line': return 'chart-line';
      case 'trophy': return 'trophy';
      case 'battery-low': return 'battery-30';
      case 'restart': return 'restart';
      case 'lightning-bolt': return 'lightning-bolt';
      case 'flower': return 'flower';
      case 'plus-circle': return 'plus-circle';
      default: return 'lightbulb-on';
    }
  };

  const getInsightColor = (type: string, priority: string) => {
    if (type === 'achievement') return '#10B981'; // Green
    if (type === 'trend' && priority === 'high') return '#3B82F6'; // Blue
    if (type === 'suggestion') return '#F59E0B'; // Orange
    if (type === 'pattern') return '#8B5CF6'; // Purple
    return '#6B7280'; // Gray default
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return { text: '⭐', color: '#DC2626' };
      case 'medium': return { text: '💡', color: '#F59E0B' };
      case 'low': return { text: 'ℹ️', color: '#6B7280' };
      default: return { text: '', color: '#6B7280' };
    }
  };

  if (!user || loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="loading" size={24} color="#6B7280" />
          <Text style={styles.loadingText}>Insights yükleniyor...</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="lightbulb-on" size={20} color="#F59E0B" />
          <Text style={styles.headerTitle}>Bugün İçin İnsan Dostu İpuçları</Text>
        </View>
        
        <Pressable onPress={loadInsights}>
          <MaterialCommunityIcons name="refresh" size={16} color="#6B7280" />
        </Pressable>
      </View>

      {/* Weekly Summary */}
      {weeklyData && weeklyData.entriesCount > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Bu Hafta</Text>
          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{weeklyData.entriesCount}</Text>
              <Text style={styles.statLabel}>kayıt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{weeklyData.avgScores.mood}/100</Text>
              <Text style={styles.statLabel}>ortalama mood</Text>
            </View>
            {weeklyData.bestDay && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>🎯</Text>
                <Text style={styles.statLabel}>{weeklyData.bestDay}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Insights List */}
      <ScrollView style={styles.insightsList} showsVerticalScrollIndicator={false}>
        {insights.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-line" size={32} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              Henüz yeterli veri yok.{'\n'}Düzenli kayıt yapmaya devam et!
            </Text>
          </View>
        ) : (
          insights.map((insight, index) => {
            const iconName = getInsightIcon(insight.icon);
            const color = getInsightColor(insight.type, insight.priority);
            const priorityBadge = getPriorityBadge(insight.priority);
            
            return (
              <Pressable
                key={insight.id}
                style={[
                  styles.insightCard,
                  insight.actionable && styles.actionableInsight
                ]}
                onPress={() => insight.actionable && onActionPress?.(insight)}
                disabled={!insight.actionable}
              >
                <View style={styles.insightHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
                    <MaterialCommunityIcons 
                      name={iconName as any} 
                      size={20} 
                      color={color} 
                    />
                  </View>
                  
                  <View style={styles.insightContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      {priorityBadge.text && (
                        <Text style={styles.priorityBadge}>{priorityBadge.text}</Text>
                      )}
                    </View>
                    <Text style={styles.insightDescription}>{insight.description}</Text>
                  </View>
                  
                  {insight.actionable && (
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={16} 
                      color="#9CA3AF" 
                    />
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <MaterialCommunityIcons name="information-outline" size={12} color="#9CA3AF" />
        <Text style={styles.footerText}>
          Bu öneriler son mood kayıtlarına dayanıyor. AI kullanılmıyor.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  insightsList: {
    maxHeight: 300,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  insightCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionableInsight: {
    backgroundColor: '#FEFEFE',
    borderColor: '#D1D5DB',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 20,
  },
  insightContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
    flex: 1,
  },
  priorityBadge: {
    fontSize: 12,
  },
  insightDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
});
