import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MoodFace from './mood/MoodFace';
import { weightedScore, to0100 } from '@/utils/mindScore';

export type DayMetrics = {
  date: string; // YYYY-MM-DD
  mood?: number | null; // 0–100
  energy?: number | null; // 0–100 or 1–10 (to0100 will normalize)
  anxiety?: number | null; // 0–100 or 1–10 (to0100 will normalize)
};

type Props = {
  week: DayMetrics[];
  title?: string;
  streakCurrent?: number;
  streakLevel?: 'seedling' | 'warrior' | 'master';
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// Simple EWMA smoother (same idea as MindScoreCard)
const ewma = (series: Array<number | null | undefined>) => {
  const vals = series.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const n = vals.length;
  if (n === 0) return [] as number[];
  const alpha = 2 / (n + 1);
  const out: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    const x = vals[i] != null ? (vals[i] as number) : prev;
    if (x == null) {
      prev = 50;
    } else if (prev == null) {
      prev = x;
    } else {
      prev = alpha * x + (1 - alpha) * prev;
    }
    out.push(clamp(prev, 0, 100));
  }
  return out;
};

export default function MoodFaceCard({ week, title = 'Zihin Skoru', streakCurrent = 0, streakLevel = 'seedling' }: Props) {
  const dailyScores = useMemo(
    () => week.map(d => weightedScore(d.mood, d.energy, d.anxiety)),
    [week]
  );
  const smoothed = useMemo(() => ewma(dailyScores), [dailyScores]);
  const scoreNow = useMemo(() => (smoothed.length ? smoothed[smoothed.length - 1] : null), [smoothed]);
  const scoreInt = typeof scoreNow === 'number' ? Math.round(scoreNow) : null;

  const nextLevelAt = useMemo(() => {
    if (streakLevel === 'master') return undefined; // already maxed
    return streakLevel === 'warrior' ? 21 : 7;
  }, [streakLevel]);
  const progressRatio = useMemo(() => {
    if (!nextLevelAt) return 1;
    return Math.max(0, Math.min(1, (streakCurrent || 0) / nextLevelAt));
  }, [streakCurrent, nextLevelAt]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.faceWrap}>
        <MoodFace score={scoreInt ?? 50} size={200} />
        <View style={styles.centerScore} pointerEvents="none">
          <Text style={styles.scoreText}>{scoreInt != null ? scoreInt : '—'}</Text>
          <Text style={styles.ofText}>/100</Text>
        </View>
      </View>
      <View style={styles.streakRow}>
        <Text style={styles.streakLabel}>Streak</Text>
        <Text style={styles.streakValue}>{streakCurrent ?? 0} gün</Text>
      </View>
      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { width: `${Math.round(progressRatio * 100)}%` }]} />
      </View>
      {nextLevelAt ? (
        <Text style={styles.progressHint}>{(streakCurrent || 0)}/{nextLevelAt} sonraki seviyeye</Text>
      ) : (
        <Text style={styles.progressHint}>Usta seviyedesin</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', alignSelf: 'center', marginBottom: 10 },
  faceWrap: { position: 'relative', width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  centerScore: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 36, fontWeight: '800', color: '#111827' },
  ofText: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 16 },
  streakLabel: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  streakValue: { fontSize: 16, color: '#111827', fontWeight: '700' },
  progressOuter: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: 8,
  },
  progressInner: { height: '100%', backgroundColor: '#10B981', borderRadius: 8 },
  progressHint: { marginTop: 6, alignSelf: 'flex-end', fontSize: 12, color: '#6B7280', fontWeight: '600' },
});
