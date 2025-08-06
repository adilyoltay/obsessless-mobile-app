import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CompulsionEntry } from '@/types/compulsion';
import { useTranslation } from '@/hooks/useTranslation';
import * as Haptics from 'expo-haptics';

interface WeeklyReportProps {
  compulsions: CompulsionEntry[];
  weekStart: Date;
}

interface WeeklyInsights {
  totalCompulsions: number;
  avgResistance: number;
  strengthDays: number;
  challengingDays: number;
  mostCommonType: string;
  mostCommonTime: string;
  improvementAreas: string[];
  celebrations: string[];
  therapeuticSuggestions: string[];
}

export function WeeklyReport({ compulsions, weekStart }: WeeklyReportProps) {
  const { t } = useTranslation();

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Master Prompt: Empatik analiz - Güçlü yönlere odaklanma
  const weeklyInsights = useMemo((): WeeklyInsights => {
    const weekCompulsions = compulsions.filter(c => 
      c.timestamp >= weekStart && c.timestamp <= weekEnd
    );

    if (weekCompulsions.length === 0) {
      return {
        totalCompulsions: 0,
        avgResistance: 0,
        strengthDays: 0,
        challengingDays: 0,
        mostCommonType: '',
        mostCommonTime: '',
        improvementAreas: ['Bu hafta veri girişi yapmadın - bu da tamamen normal!'],
        celebrations: ['Bazen ara vermek de iyileşmenin bir parçası 🌱'],
        therapeuticSuggestions: ['Yarın yeni bir başlangıç için mükemmel bir gün'],
      };
    }

    const totalCompulsions = weekCompulsions.length;
    const avgResistance = weekCompulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / totalCompulsions;

    // Günlük analizler
    const dailyData: { [key: string]: { count: number; avgResistance: number } } = {};
    weekCompulsions.forEach(c => {
      const date = c.timestamp.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { count: 0, avgResistance: 0 };
      }
      dailyData[date].count += 1;
    });

    // Günlük direnç ortalamalarını hesapla
    Object.keys(dailyData).forEach(date => {
      const dayCompulsions = weekCompulsions.filter(
        c => c.timestamp.toISOString().split('T')[0] === date
      );
      dailyData[date].avgResistance = 
        dayCompulsions.reduce((sum, c) => sum + c.resistanceLevel, 0) / dayCompulsions.length;
    });

    const strengthDays = Object.values(dailyData).filter(day => day.avgResistance >= 7).length;
    const challengingDays = Object.values(dailyData).filter(day => day.count > 3).length;

    // En yaygın tip
    const typeCount: { [key: string]: number } = {};
    weekCompulsions.forEach(c => {
      typeCount[c.type] = (typeCount[c.type] || 0) + 1;
    });
    const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b, ''
    );

    // En yaygın zaman dilimi
    const hourCount: { [key: number]: number } = {};
    weekCompulsions.forEach(c => {
      const hour = c.timestamp.getHours();
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    });
    const mostCommonHour = Object.keys(hourCount).reduce((a, b) => 
      hourCount[Number(a)] > hourCount[Number(b)] ? a : b, '0'
    );
    
    const getTimeLabel = (hour: number) => {
      if (hour < 6) return 'Gece Saatleri';
      if (hour < 12) return 'Sabah Saatleri';
      if (hour < 18) return 'Öğleden Sonra';
      return 'Akşam Saatleri';
    };

    // Master Prompt: Destekleyici İçgörüler
    const improvementAreas: string[] = [];
    const celebrations: string[] = [];
    const therapeuticSuggestions: string[] = [];

    // Kutlamalar (Pozitif odak)
    if (avgResistance >= 8) {
      celebrations.push('🌟 Direnç gücünde olağanüstü başarı gösterdin!');
    } else if (avgResistance >= 6) {
      celebrations.push('💪 Güçlü direnç becerilerin gelişmeye devam ediyor');
    } else if (avgResistance >= 4) {
      celebrations.push('🌱 Her direnç anında büyüyorsun');
    }

    if (strengthDays >= 3) {
      celebrations.push(`⭐ ${strengthDays} güçlü gün - bu harika bir ilerleme!`);
    }

    if (totalCompulsions < 10) {
      celebrations.push('🦋 Bu hafta kompulsiyon yönetiminde başarılısın');
    }

    // İyileştirme alanları (Nazik yaklaşım)
    if (challengingDays > 2) {
      improvementAreas.push('Bazı günler daha zorlu geçti - bu tamamen normal');
      therapeuticSuggestions.push('Zor günlerde kendine ekstra merhamet göster');
    }

    if (avgResistance < 4) {
      improvementAreas.push('Direnç becerilerini geliştirmek için zamana ihtiyacın var');
      therapeuticSuggestions.push('Küçük adımlarla başla - her direnç önemli');
    }

    // Zaman paterni önerileri
    if (mostCommonHour) {
      const timeLabel = getTimeLabel(Number(mostCommonHour));
      improvementAreas.push(`${timeLabel} daha hassas bir zaman dilimi olabilir`);
      therapeuticSuggestions.push(`${timeLabel} için özel başa çıkma stratejileri geliştirebiliriz`);
    }

    // Varsayılan pozitif mesajlar
    if (celebrations.length === 0) {
      celebrations.push('🌿 Bu hafta kendini takip ettin - bu cesaret gerektirir');
    }

    if (therapeuticSuggestions.length === 0) {
      therapeuticSuggestions.push('Gelecek hafta için küçük, ulaşılabilir hedefler koy');
    }

    return {
      totalCompulsions,
      avgResistance,
      strengthDays,
      challengingDays,
      mostCommonType,
      mostCommonTime: getTimeLabel(Number(mostCommonHour)),
      improvementAreas,
      celebrations,
      therapeuticSuggestions,
    };
  }, [compulsions, weekStart, weekEnd]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const shareReport = async () => {
    try {
      const reportText = `
ObsessLess Haftalık Rapor
${formatDate(weekStart)} - ${formatDate(weekEnd)}

📊 Bu Haftanın Özeti:
• Toplam Kayıt: ${weeklyInsights.totalCompulsions}
• Ortalama Direnç: ${weeklyInsights.avgResistance.toFixed(1)}/10
• Güçlü Günler: ${weeklyInsights.strengthDays}

🌟 Kutlamalar:
${weeklyInsights.celebrations.map(c => `• ${c}`).join('\n')}

🎯 İyileştirme Alanları:
${weeklyInsights.improvementAreas.map(a => `• ${a}`).join('\n')}

💡 Öneriler:
${weeklyInsights.therapeuticSuggestions.map(s => `• ${s}`).join('\n')}

ObsessLess ile oluşturuldu 💚
`;

      await Share.share({
        message: reportText,
        title: 'ObsessLess Haftalık Rapor',
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="chart-timeline-variant" size={32} color="#10B981" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Haftalık Rapor</Text>
            <Text style={styles.headerSubtitle}>
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </Text>
          </View>
        </View>
        <Button 
          mode="outlined" 
          onPress={shareReport}
          contentStyle={styles.shareButtonContent}
        >
          <MaterialCommunityIcons name="share-variant" size={16} color="#10B981" />
          <Text style={styles.shareButtonText}>Paylaş</Text>
        </Button>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="counter" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{weeklyInsights.totalCompulsions}</Text>
            <Text style={styles.statLabel}>Toplam Kayıt</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="shield-check" size={24} color="#10B981" />
            <Text style={styles.statValue}>{weeklyInsights.avgResistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Ort. Direnç</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="trophy" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{weeklyInsights.strengthDays}</Text>
            <Text style={styles.statLabel}>Güçlü Gün</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Celebrations Section */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="party-popper" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Bu Haftanın Kutlamaları</Text>
          </View>
          {weeklyInsights.celebrations.map((celebration, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.celebrationText}>{celebration}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Improvement Areas */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Fırsat Alanları</Text>
          </View>
          {weeklyInsights.improvementAreas.map((area, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.improvementText}>{area}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Therapeutic Suggestions */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="heart-plus" size={24} color="#EC4899" />
            <Text style={styles.sectionTitle}>Gelecek Hafta İçin Öneriler</Text>
          </View>
          {weeklyInsights.therapeuticSuggestions.map((suggestion, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Pattern Insights */}
      {weeklyInsights.mostCommonType && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="chart-donut" size={24} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Desen Analizi</Text>
            </View>
            <View style={styles.patternItem}>
              <Text style={styles.patternLabel}>En Sık Görülen:</Text>
              <Text style={styles.patternValue}>{weeklyInsights.mostCommonType}</Text>
            </View>
            <View style={styles.patternItem}>
              <Text style={styles.patternLabel}>Hassas Zaman:</Text>
              <Text style={styles.patternValue}>{weeklyInsights.mostCommonTime}</Text>
            </View>
          </Card.Content>
        </Card>
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
  shareButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  listItem: {
    marginBottom: 12,
  },
  celebrationText: {
    fontSize: 15,
    color: '#059669',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  improvementText: {
    fontSize: 15,
    color: '#3B82F6',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  suggestionText: {
    fontSize: 15,
    color: '#EC4899',
    fontFamily: 'Inter',
    lineHeight: 22,
  },
  patternItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  patternValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  bottomSpacing: {
    height: 32,
  },
}); 