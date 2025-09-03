import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { MoodJourneyData } from '@/services/todayService';
import { getVAColorFromScores, getGradientFromBase } from '@/utils/colorUtils';
import { AppleHealthTimeSelectorV2 } from '@/components/mood/AppleHealthTimeSelectorV2';
import AppleHealthStyleChartV2 from '@/components/mood/AppleHealthStyleChartV2';
import AppleHealthDetailSheet from '@/components/mood/AppleHealthDetailSheet';
import { moodDataLoader } from '@/services/moodDataLoader';
import type { TimeRange, MoodJourneyExtended } from '@/types/mood';
import { useAuth } from '@/contexts/SupabaseAuthContext';

type Props = {
  data: MoodJourneyData;
};

// Color mapping centralized in utils/colorUtils.ts

export default function MoodJourneyCard({ data }: Props) {
  const { user } = useAuth();
  const [range, setRange] = React.useState<TimeRange>('week');
  const [extended, setExtended] = React.useState<MoodJourneyExtended | null>(null);
  const [detailDate, setDetailDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user?.id) return;
      const res = await moodDataLoader.loadTimeRange(user.id, range);
      if (mounted) setExtended(res);
    })();
    return () => { mounted = false; };
  }, [user?.id, range]);
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
    const energyFor = (emotion: string) => (
      emotion === 'Heyecanlı' ? 9 :
      emotion === 'Enerjik'  ? 8 :
      emotion === 'Mutlu'    ? 7 :
      emotion === 'Sakin'    ? 5 :
      emotion === 'Normal'   ? 6 :
      emotion === 'Endişeli' ? 7 :
      emotion === 'Sinirli'  ? 8 :
      /* Üzgün/Kızgın */  emotion === 'Üzgün' ? 3 : 9
    );
    const scoreFor = (emotion: string) => (
      emotion === 'Heyecanlı' ? 95 :
      emotion === 'Enerjik'  ? 85 :
      emotion === 'Mutlu'    ? 75 :
      emotion === 'Sakin'    ? 65 :
      emotion === 'Normal'   ? 55 :
      emotion === 'Endişeli' ? 45 :
      emotion === 'Sinirli'  ? 35 :
      /* Üzgün/Kızgın */       emotion === 'Üzgün' ? 25 : 15
    );
    return Object.entries(counts)
      .filter(([_, c]) => c > 0)
      .map(([emotion, c]) => ({
        emotion,
        percentage: Math.round((c / total) * 100),
        color: getVAColorFromScores(scoreFor(emotion), energyFor(emotion))
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [entries]);

  const dominant = distribution[0]?.emotion || 'Henüz Yok';
  const trend = extended?.weeklyTrend || null;

  const days = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
  const today = new Date().getDay();
  
  // Horizontal spectrum bar aligned to VA palette (constant energy)
  const paletteColors = React.useMemo(() => {
    const paletteEnergy = Math.round((data.weeklyEnergyAvg || 6)); // Kişiselleştirilmiş enerji
    const stops = [15, 25, 35, 45, 55, 65, 75, 85, 95];
    return stops.map(s => getVAColorFromScores(s, paletteEnergy));
  }, [data.weeklyEnergyAvg]);

  return (
    <View style={styles.container}>
      {/* Time range selector row */}
      <View style={styles.selectorWrapper}>
        <AppleHealthTimeSelectorV2 selected={range} onChange={setRange} />
      </View>

      {/* Interactive chart - Apple Health Style V2 */}
      {extended && (
        <AppleHealthStyleChartV2
          data={extended}
          timeRange={range}
          onDayPress={(date) => setDetailDate(date)}
        />
      )}

      {/* Top-3 emotion distribution kaldırıldı */}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.stat}>M: {data.todayAverage > 0 ? data.todayAverage.toFixed(1) : '—'}</Text>
        <Text style={styles.stat}>E: {data.weeklyEnergyAvg > 0 ? data.weeklyEnergyAvg.toFixed(1) : '—'}</Text>
        <Text style={styles.stat}>A: {data.weeklyAnxietyAvg > 0 ? data.weeklyAnxietyAvg.toFixed(1) : '—'}</Text>
      </View>

      {/* Detail modal - Apple Health Style */}
      {detailDate && extended && (
        <AppleHealthDetailSheet
          visible={!!detailDate}
          date={detailDate}
          entries={extended.rawDataPoints[detailDate]?.entries || []}
          onClose={() => setDetailDate(null)}
        />
      )}
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
    height: 6,
    borderRadius: 4,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  selectorBadgeRow: {
    position: 'absolute',
    right: 8,
    bottom: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 4,
    fontWeight: '600',
  },
  chipValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
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
  trend: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  trendUp: { color: '#10B981' },
  trendDown: { color: '#EF4444' },
  trendStable: { color: '#6B7280' },
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  stat: {
    fontSize: 12,
    color: '#111827',
  },
});
