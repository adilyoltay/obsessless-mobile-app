import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { MoodJourneyExtended, TimeRange } from '@/types/mood';
import { normalizeValence, getEnergyGradient, getVAColor, getConfidenceOpacity } from '@/utils/chartUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  data: MoodJourneyExtended;
  timeRange: TimeRange;
  onDayPress?: (date: string) => void;
};

const CHART_HEIGHT = 160;
const PADDING_H = 12;

export const InteractiveMoodChart: React.FC<Props> = ({ data, timeRange, onDayPress }) => {
  const days = useMemo(() => data.dailyAverages.map((d) => d.date), [data]);
  const chartWidth = SCREEN_WIDTH - PADDING_H * 2;
  const dayWidth = Math.max(8, chartWidth / Math.max(1, days.length));

  const yForMood = useCallback((mood: number) => {
    const v = normalizeValence(mood); // -1..1
    // Map -1..1 to CHART_HEIGHT bottom..top (invert)
    const t = (v + 1) / 2; // 0..1
    return CHART_HEIGHT - t * CHART_HEIGHT;
  }, []);

  const gradients = useMemo(() => {
    return data.dailyAverages.map((d, idx) => ({
      id: `grad-${idx}`,
      stops: getEnergyGradient(d.averageEnergy),
    }));
  }, [data.dailyAverages]);

  const testIdSuffix = timeRange === 'week' ? 'week' : timeRange === 'month' ? 'month' : timeRange === '6months' ? '6months' : 'year';

  // Prepare scatter points (raw entries)
  const scatterPoints = useMemo(() => {
    const points: { x: number; y: number; r: number; color: string; opacity: number; key: string; date: string }[] = [];
    data.dailyAverages.forEach((day, i) => {
      const pts = data.rawDataPoints[day.date]?.entries || [];
      pts.forEach((p, j) => {
        const x = PADDING_H + i * dayWidth + dayWidth * 0.5; // center of bar
        const y = yForMood(p.mood_score);
        points.push({
          x,
          y,
          r: 3,
          color: getVAColor(p.mood_score, p.energy_level),
          opacity: getConfidenceOpacity((p as any).confidence),
          key: `${day.date}-${j}`,
          date: day.date,
        });
      });
    });
    return points;
  }, [data, dayWidth, yForMood]);

  return (
    <View style={styles.container} testID="mood-chart" accessibilityLabel="Mood chart">
      <Svg height={CHART_HEIGHT} width={SCREEN_WIDTH} testID={`mood-chart-${testIdSuffix}`}>
        <Defs>
          {gradients.map((g) => (
            <LinearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={g.stops[0]} stopOpacity={1} />
              <Stop offset="100%" stopColor={g.stops[1]} stopOpacity={1} />
            </LinearGradient>
          ))}
        </Defs>

        {/* Background scatter points */}
        {scatterPoints.map((pt) => (
          <Circle key={pt.key} cx={pt.x} cy={pt.y} r={pt.r} fill={pt.color} opacity={pt.opacity} />
        ))}

        {/* Foreground bars */}
        {data.dailyAverages.map((d, i) => {
          const h = Math.max(4, (d.averageMood / 100) * (CHART_HEIGHT - 12));
          const x = PADDING_H + i * dayWidth + dayWidth * 0.2;
          const y = CHART_HEIGHT - h;
          const w = dayWidth * 0.6;
          const gradId = gradients[i]?.id || gradients[0]?.id;
          return (
            <Rect key={`bar-${i}`} x={x} y={y} width={w} height={h} rx={4} fill={`url(#${gradId})`} />
          );
        })}
      </Svg>
      {/* Invisible tap overlays for per-day interaction */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.row, { paddingHorizontal: PADDING_H }]}> 
          {data.dailyAverages.map((d, i) => (
            <TouchableOpacity
              key={`touch-${d.date}`}
              style={{ width: dayWidth, height: CHART_HEIGHT }}
              onPress={() => onDayPress && onDayPress(d.date)}
              accessibilityLabel={`Gün ${d.date} detayını aç`}
              testID={`mood-bar-${i}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
});

export default InteractiveMoodChart;

