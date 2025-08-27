import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Line, Circle, Path, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;
const CHART_HEIGHT = 200;
const PADDING = 20;

interface MoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  created_at: string;
}

interface MoodChartProps {
  entries: MoodEntry[];
  period: 7 | 30;
}

export function MoodChart({ entries, period }: MoodChartProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>Veri yok</Text>
      </View>
    );
  }

  // Sort entries by date
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Calculate chart points
  const maxMood = 100;
  const minMood = 0;
  const xStep = CHART_WIDTH / (sortedEntries.length - 1 || 1);
  const yScale = (CHART_HEIGHT - PADDING * 2) / (maxMood - minMood);

  const points = sortedEntries.map((entry, index) => ({
    x: index * xStep,
    y: CHART_HEIGHT - PADDING - (entry.mood_score - minMood) * yScale,
    mood: entry.mood_score,
    date: new Date(entry.created_at),
  }));

  // Create path for mood line
  const moodPath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    // Smooth curve using quadratic bezier
    const prevPoint = points[index - 1];
    const cpx = (prevPoint.x + point.x) / 2;
    const cpy = (prevPoint.y + point.y) / 2;
    return `${path} Q ${cpx} ${prevPoint.y} ${cpx} ${cpy} T ${point.x} ${point.y}`;
  }, '');

  // Create area path
  const areaPath = `${moodPath} L ${points[points.length - 1].x} ${CHART_HEIGHT - PADDING} L 0 ${CHART_HEIGHT - PADDING} Z`;

  // Calculate average mood
  const avgMood = sortedEntries.reduce((sum, e) => sum + e.mood_score, 0) / sortedEntries.length;
  const avgY = CHART_HEIGHT - PADDING - (avgMood - minMood) * yScale;

  // 🌍 TIMEZONE-AWARE: Format date labels in user's timezone  
  const getDateLabel = (date: Date) => {
    const { formatDateInUserTimezone } = require('@/utils/timezoneUtils');
    return formatDateInUserTimezone(date, 'short');
  };

  // Select labels to show (max 7 labels)
  const labelStep = Math.ceil(points.length / 7);
  const labels = points.filter((_, index) => index % labelStep === 0);

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 40}>
        <Defs>
          <LinearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#10B981" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#10B981" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = CHART_HEIGHT - PADDING - (value - minMood) * yScale;
          return (
            <Line
              key={value}
              x1={0}
              y1={y}
              x2={CHART_WIDTH}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Area under curve */}
        <Path
          d={areaPath}
          fill="url(#moodGradient)"
        />

        {/* Mood line */}
        <Path
          d={moodPath}
          stroke="#10B981"
          strokeWidth="2"
          fill="none"
        />

        {/* Average line */}
        <Line
          x1={0}
          y1={avgY}
          x2={CHART_WIDTH}
          y2={avgY}
          stroke="#F59E0B"
          strokeWidth="1"
          strokeDasharray="5 5"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#10B981"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        ))}

        {/* Date labels */}
        {labels.map((point, index) => (
          <SvgText
            key={index}
            x={point.x}
            y={CHART_HEIGHT + 15}
            fontSize="10"
            fill="#6B7280"
            textAnchor="middle"
          >
            {getDateLabel(point.date)}
          </SvgText>
        ))}

        {/* Y-axis labels */}
        {[0, 50, 100].map((value) => {
          const y = CHART_HEIGHT - PADDING - (value - minMood) * yScale;
          return (
            <SvgText
              key={value}
              x={CHART_WIDTH + 10}
              y={y + 4}
              fontSize="10"
              fill="#6B7280"
            >
              {value}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Mood</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Ortalama: {Math.round(avgMood)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLine: {
    width: 16,
    height: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
