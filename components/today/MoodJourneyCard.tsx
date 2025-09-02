import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { MoodJourneyData } from '@/services/todayService';

type Props = {
  data: MoodJourneyData;
};

// Same color mapping used in Today screen
const getAdvancedMoodColor = (score: number): string => {
  if (score >= 90) return '#C2185B'; // 90-100: Heyecanlı
  if (score >= 80) return '#7E57C2'; // 80-89: Enerjik
  if (score >= 70) return '#4CAF50'; // 70-79: Mutlu
  if (score >= 60) return '#26A69A'; // 60-69: Sakin
  if (score >= 50) return '#66BB6A'; // 50-59: Normal
  if (score >= 40) return '#FFA726'; // 40-49: Endişeli
  if (score >= 30) return '#FF7043'; // 30-39: Sinirli
  if (score >= 20) return '#5C6BC0'; // 20-29: Üzgün
  return '#F06292'; // 0-19: Kızgın
};

export default function MoodJourneyCard({ data }: Props) {
  // Build emotion distribution (top-3)
  const entries = data.weeklyEntries.filter(e => (e as any).mood_score > 0);
  const distribution = React.useMemo(() => {
    if (entries.length === 0) return [] as { emotion: string; percentage: number; color: string }[];
    const counts = {
      // Mood is stored 0–100 scale in entries
      'Heyecanlı': entries.filter(e => (e as any).mood_score >= 90).length,
      'Enerjik':  entries.filter(e => (e as any).mood_score >= 80 && (e as any).mood_score < 90).length,
      'Mutlu':    entries.filter(e => (e as any).mood_score >= 70 && (e as any).mood_score < 80).length,
      'Sakin':    entries.filter(e => (e as any).mood_score >= 60 && (e as any).mood_score < 70).length,
      'Normal':   entries.filter(e => (e as any).mood_score >= 50 && (e as any).mood_score < 60).length,
      'Endişeli': entries.filter(e => (e as any).mood_score >= 40 && (e as any).mood_score < 50).length,
      'Sinirli':  entries.filter(e => (e as any).mood_score >= 30 && (e as any).mood_score < 40).length,
      'Üzgün':    entries.filter(e => (e as any).mood_score >= 20 && (e as any).mood_score < 30).length,
      'Kızgın':   entries.filter(e => (e as any).mood_score < 20).length,
    } as Record<string, number>;
    const total = entries.length;
    return Object.entries(counts)
      .filter(([_, c]) => c > 0)
      .map(([emotion, c]) => ({
        emotion,
        percentage: Math.round((c / total) * 100),
        color: getAdvancedMoodColor(
          emotion === 'Heyecanlı' ? 95 :
          emotion === 'Enerjik' ? 85 :
          emotion === 'Mutlu' ? 75 :
          emotion === 'Sakin' ? 65 :
          emotion === 'Normal' ? 55 :
          emotion === 'Endişeli' ? 45 :
          emotion === 'Sinirli' ? 35 :
          emotion === 'Üzgün' ? 25 : 15
        )
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [entries]);

  const dominant = distribution[0]?.emotion || 'Henüz Yok';

  const days = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
  const today = new Date().getDay();

  return (
    <View style={styles.container}>
      {/* Spectrum bar */}
      <LinearGradient
        colors={['#F06292', '#5C6BC0', '#FF7043', '#FFA726', '#66BB6A', '#26A69A', '#4CAF50', '#7E57C2', '#C2185B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.miniSpectrumBar}
      />

      {/* Header with Dominant emotion */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mood Yolculuğun</Text>
        <View style={styles.dominantRow}>
          <Text style={styles.dominantLabel}>Baskın:</Text>
          <Text style={styles.dominantEmotion}>{dominant}</Text>
        </View>
      </View>

      {/* Weekly bars */}
      <View style={styles.barsRow}>
        {[...data.weeklyEntries].reverse().map((entry, index) => {
          // mood_score in 0–100 scale → map to 8..88 px (0 treated as empty day)
          const score = (entry as any).mood_score || 0;
          const barHeight = Math.min(Math.max((score / 100) * 88, 8), 88);
          const isToday = index === 6;
          const dayIndex = (today - (6 - index) + 7) % 7;
          const emotionColor = score > 0 ? getAdvancedMoodColor(score) : '#E5E7EB';
          return (
            <View key={`${entry.id || 'unknown'}_${index}`} style={styles.barContainer}>
              <View style={[
                styles.emotionBar,
                { 
                  height: barHeight, 
                  backgroundColor: emotionColor, 
                  opacity: isToday ? 1 : (score > 0 ? 0.85 : 0.6)
                }
              ]} />
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{days[dayIndex]}</Text>
            </View>
          );
        })}
      </View>

      {/* Top-3 emotion distribution */}
      <View style={styles.emotionDots}>
        {distribution.map((e, i) => (
          <View key={i} style={styles.emotionDot}>
            <View style={[styles.dot, { backgroundColor: e.color }]} />
            <Text style={styles.dotLabel}>{e.emotion}</Text>
            <Text style={styles.dotPercentage}>{e.percentage}%</Text>
          </View>
        ))}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>M: {data.todayAverage > 0 ? data.todayAverage.toFixed(1) : '—'}</Text>
        <Text style={styles.stat}>E: {data.weeklyEnergyAvg > 0 ? data.weeklyEnergyAvg.toFixed(1) : '—'}</Text>
        <Text style={styles.stat}>A: {data.weeklyAnxietyAvg > 0 ? data.weeklyAnxietyAvg.toFixed(1) : '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  miniSpectrumBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
  },
  dominantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dominantLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  dominantEmotion: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  barContainer: {
    alignItems: 'center',
    width: 20,
  },
  emotionBar: {
    width: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 9,
    color: '#6B7280',
  },
  dayLabelToday: {
    fontWeight: '700',
    color: '#111827',
  },
  emotionDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  emotionDot: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  dotLabel: {
    fontSize: 12,
    color: '#374151',
  },
  dotPercentage: {
    fontSize: 12,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  stat: {
    fontSize: 12,
    color: '#111827',
  },
});
