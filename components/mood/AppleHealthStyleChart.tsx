import React, { useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity,
  ScrollView 
} from 'react-native';
import Svg, { 
  Line, 
  Circle, 
  Text as SvgText, 
  G, 
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Path
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { MoodJourneyExtended, TimeRange } from '@/types/mood';
import { getVAColorFromScores } from '@/utils/colorUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  data: MoodJourneyExtended;
  timeRange: TimeRange;
  onDayPress?: (date: string) => void;
};

const CHART_HEIGHT = 200;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 40;
const CHART_PADDING_H = 16;
const AXIS_WIDTH = 40;
const CHART_CONTENT_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

// Apple Health renk paleti
const APPLE_COLORS = {
  primary: '#007AFF',      // iOS Blue
  secondary: '#34C759',    // iOS Green  
  tertiary: '#5AC8FA',     // Light Blue
  negative: '#FF3B30',    // iOS Red
  neutral: '#8E8E93',     // iOS Gray
  gridLine: '#E5E5EA',    // Light Gray
  background: '#F2F2F7',  // System Background
  text: '#000000',
  textSecondary: '#8E8E93'
};

// Mood skorunu Apple Health valans değerine dönüştür (-1 to +1)
const moodToValence = (mood: number): number => {
  return ((mood - 50) / 50); // 0-100 -> -1 to +1
};

// Opsiyonel geliştirme: VA renkleri kullan
const USE_VA_POINT_COLORS = true;

const getColorForMood = (mood: number, energy: number) => {
  if (USE_VA_POINT_COLORS) {
    return getVAColorFromScores(mood, energy);
  }
  // Apple paleti eşiği (fallback)
  if (mood >= 70) return energy > 6 ? APPLE_COLORS.secondary : APPLE_COLORS.tertiary;
  if (mood >= 40) return APPLE_COLORS.primary;
  return APPLE_COLORS.negative;
};

// Enerjiyi opaklığa yansıt (1..10 -> min..max)
const mapEnergyToOpacity = (energy?: number, min: number = 0.5, max: number = 1) => {
  const e = typeof energy === 'number' && energy > 0 ? Math.max(1, Math.min(10, energy)) : 6;
  return min + (max - min) * ((e - 1) / 9);
};

// Mood'u nokta yarıçapına yansıt (0..100 -> min..max)
const mapMoodToRadius = (mood?: number, min: number = 3, max: number = 6) => {
  const m = typeof mood === 'number' && isFinite(mood) ? Math.max(0, Math.min(100, mood)) : 50;
  return min + (max - min) * (m / 100);
};

export const AppleHealthStyleChart: React.FC<Props> = ({ 
  data, 
  timeRange, 
  onDayPress 
}) => {
  const theme = useThemeColors();
  const chartWidth = SCREEN_WIDTH - CHART_PADDING_H * 2;
  const contentWidth = chartWidth - AXIS_WIDTH;
  
  // Y ekseni değerleri (Apple Health tarzı)
  const yAxisValues = [1, 0.5, 0, -0.5, -1];
  
  // Yardımcılar: Yerel tarihe güvenli parse ve hafta başlangıcı kontrolü (Pazartesi)
  const toLocalDate = useCallback((s: string) => {
    return s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s);
  }, []);

  const isStartOfWeek = useCallback((ymd: string) => {
    const d = toLocalDate(ymd);
    const MONDAY = 1; // TR ve çoğu Avrupa için hafta başlangıcı Pazartesi
    return d.getDay() === MONDAY;
  }, [toLocalDate]);

  // Tarih formatı
  const formatDate = useCallback((date: string) => {
    const d = toLocalDate(date);
    if (timeRange === 'week') {
      const days = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
      return days[d.getDay()];
    } else if (timeRange === 'month') {
      return d.getDate().toString();
    } else if (timeRange === '6months') {
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
                     'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      return months[d.getMonth()].substring(0, 3);
    } else {
      return (d.getMonth() + 1).toString();
    }
  }, [timeRange, toLocalDate]);

  // Veri noktalarını hazırla
  const dataPoints = useMemo(() => {
    const points: Array<{
      x: number;
      y: number;
      date: string;
      mood: number;
      energy: number;
      hasMultiple: boolean;
      entries: any[];
      color: string;
    }> = [];

    const dayWidth = contentWidth / Math.max(1, data.dailyAverages.length);
    
    data.dailyAverages.forEach((day, index) => {
      const rawPoints = data.rawDataPoints[day.date];
      const x = AXIS_WIDTH + (index * dayWidth) + (dayWidth / 2);
      
      if (rawPoints && rawPoints.entries.length > 0) {
        // Birden fazla giriş varsa dikey bant oluştur
        if (rawPoints.entries.length > 1) {
          // Min ve max değerleri bul
          const moods = rawPoints.entries.map(e => e.mood_score);
          const minMood = Math.min(...moods);
          const maxMood = Math.max(...moods);
          
          // Her giriş için nokta ekle
          rawPoints.entries.forEach(entry => {
            const valence = moodToValence(entry.mood_score);
            const y = CHART_PADDING_TOP + (1 - ((valence + 1) / 2)) * CHART_CONTENT_HEIGHT;
            
            points.push({
              x,
              y,
              date: day.date,
              mood: entry.mood_score,
              energy: entry.energy_level,
              hasMultiple: true,
              entries: rawPoints.entries,
              color: getColorForMood(entry.mood_score, entry.energy_level)
            });
          });
        } else {
          // Tek giriş
          const entry = rawPoints.entries[0];
          const valence = moodToValence(entry.mood_score);
          const y = CHART_PADDING_TOP + (1 - ((valence + 1) / 2)) * CHART_CONTENT_HEIGHT;
          
          points.push({
            x,
            y,
            date: day.date,
            mood: entry.mood_score,
            energy: entry.energy_level,
            hasMultiple: false,
            entries: [entry],
            color: getColorForMood(entry.mood_score, entry.energy_level)
          });
        }
      }
    });
    
    return points;
  }, [data, contentWidth]);

  // Günlük ortalama barları (opsiyonel geliştirme)
  const dailyBars = useMemo(() => {
    const bars: Array<{ x: number; y: number; w: number; h: number; color: string; key: string; opacity: number }> = [];
    const dayWidth = contentWidth / Math.max(1, data.dailyAverages.length);
    data.dailyAverages.forEach((day, index) => {
      const hasData = (day.count || 0) > 0;
      if (!hasData) return; // Veri yoksa bar göstermeyelim
      const avg = Math.max(0, Math.min(100, day.averageMood));
      const h = Math.max(8, (avg / 100) * CHART_CONTENT_HEIGHT);
      const y = CHART_PADDING_TOP + (CHART_CONTENT_HEIGHT - h);
      const w = Math.max(8, dayWidth * 0.65); // Biraz daha kalın
      const xCenter = AXIS_WIDTH + index * dayWidth + (dayWidth / 2);
      const x = xCenter - w / 2;
      // Renk: VA veya Apple birincil, düşük opaklık
      const color = USE_VA_POINT_COLORS ? getVAColorFromScores(day.averageMood, day.averageEnergy) : APPLE_COLORS.primary;
      const opacity = mapEnergyToOpacity(day.averageEnergy, 0.14, 0.34);
      bars.push({ x, y, w, h, color, key: `bar-${index}` , opacity});
    });
    return bars;
  }, [data.dailyAverages, contentWidth]);

  // Dikey bantları grupla
  const verticalBands = useMemo(() => {
    const bands: Array<{
      x: number;
      minY: number;
      maxY: number;
      date: string;
      entries: any[];
      energyAvg: number;
    }> = [];
    
    const grouped = new Map<string, any[]>();
    dataPoints.forEach(point => {
      if (!grouped.has(point.date)) {
        grouped.set(point.date, []);
      }
      grouped.get(point.date)?.push(point);
    });
    
    grouped.forEach((points, date) => {
      if (points.length > 1) {
        const ys = points.map(p => p.y);
        const energyAvg = Math.round(points.reduce((s, p) => s + (p.energy || 6), 0) / points.length);
        bands.push({
          x: points[0].x,
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          date,
          entries: points[0].entries,
          energyAvg,
        });
      }
    });
    
    return bands;
  }, [dataPoints]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <ScrollView 
        horizontal={data.dailyAverages.length > 30}
        showsHorizontalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ width: Math.max(SCREEN_WIDTH - CHART_PADDING_H * 2, contentWidth + AXIS_WIDTH) }}>
          <Svg 
            height={CHART_HEIGHT} 
            width={Math.max(SCREEN_WIDTH - CHART_PADDING_H * 2, contentWidth + AXIS_WIDTH)}
          >
            <Defs>
              <LinearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={APPLE_COLORS.secondary} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={APPLE_COLORS.secondary} stopOpacity={0.05} />
              </LinearGradient>
              <LinearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={APPLE_COLORS.negative} stopOpacity={0.05} />
                <Stop offset="100%" stopColor={APPLE_COLORS.negative} stopOpacity={0.3} />
              </LinearGradient>
            </Defs>

            {/* Grid çizgileri */}
            {yAxisValues.map((value, index) => {
              const y = CHART_PADDING_TOP + (1 - ((value + 1) / 2)) * CHART_CONTENT_HEIGHT;
              return (
                <G key={`grid-${index}`}>
                  <Line
                    x1={AXIS_WIDTH}
                    y1={y}
                    x2={AXIS_WIDTH + contentWidth}
                    y2={y}
                    stroke={APPLE_COLORS.gridLine}
                    strokeWidth={1}
                    strokeDasharray={value === 0 ? "0" : "2,2"}
                  />
                </G>
              );
            })}

            {/* Y ekseni etiketleri (sadece 3 adet) */}
            {(() => {
              const labels: Array<{ y: number; text: string }> = [
                { y: CHART_PADDING_TOP + 4, text: 'Çok Keyifli' },
                { y: CHART_PADDING_TOP + CHART_CONTENT_HEIGHT / 2 + 4, text: 'Nötr' },
                { y: CHART_PADDING_TOP + CHART_CONTENT_HEIGHT + 4, text: 'Çok Keyifsiz' },
              ];
              return labels.map((l, i) => (
                <SvgText
                  key={`ylab-${i}`}
                  x={AXIS_WIDTH - 8}
                  y={l.y}
                  fontSize={9}
                  fill={APPLE_COLORS.textSecondary}
                  textAnchor="end"
                >
                  {l.text}
                </SvgText>
              ));
            })()}

            {/* Pozitif/Negatif alan dolgusu */}
            <Rect
              x={AXIS_WIDTH}
              y={CHART_PADDING_TOP}
              width={contentWidth}
              height={CHART_CONTENT_HEIGHT / 2}
              fill="url(#positiveGradient)"
            />
            <Rect
              x={AXIS_WIDTH}
              y={CHART_PADDING_TOP + CHART_CONTENT_HEIGHT / 2}
              width={contentWidth}
              height={CHART_CONTENT_HEIGHT / 2}
              fill="url(#negativeGradient)"
            />

            {/* Günlük ortalama barları */}
            {dailyBars.map((b) => (
              <Rect
                key={b.key}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={4}
                fill={b.color}
                opacity={b.opacity}
              />
            ))}

            {/* Dikey bantlar (birden fazla giriş için) */}
            {verticalBands.map((band, index) => (
              <G key={`band-${index}`}>
                <Rect
                  x={band.x - 3}
                  y={band.minY}
                  width={6}
                  height={band.maxY - band.minY}
                  fill={APPLE_COLORS.primary}
                  opacity={mapEnergyToOpacity(band.energyAvg, 0.15, 0.4)}
                  rx={2}
                />
                <Line
                  x1={band.x}
                  y1={band.minY}
                  x2={band.x}
                  y2={band.maxY}
                  stroke={APPLE_COLORS.primary}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </G>
            ))}

            {/* Veri noktaları */}
            {dataPoints.map((point, index) => {
              const baseOpacity = mapEnergyToOpacity(point.energy, 0.55, 1);
              const finalOpacity = (point.hasMultiple ? 0.9 : 1) * baseOpacity;
              const baseRadius = mapMoodToRadius(point.mood, 3, 6);
              const r = Math.max(3, Math.min(6, point.hasMultiple ? baseRadius - 0.4 : baseRadius));
              return (
                <Circle
                  key={`point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={r}
                  fill={point.color}
                  opacity={Math.max(0.45, Math.min(1, finalOpacity))}
                />
              );
            })}

            {/* X ekseni etiketleri */}
            {data.dailyAverages.map((day, index) => {
              const dayWidth = contentWidth / Math.max(1, data.dailyAverages.length);
              const x = AXIS_WIDTH + (index * dayWidth) + (dayWidth / 2);
              const showLabel = timeRange === 'week' || 
                               (timeRange === 'month' && (isStartOfWeek(day.date) || index === 0)) ||
                               (timeRange === '6months' && index % 7 === 0) ||
                               (timeRange === 'year' && index % 30 === 0);
              
              if (!showLabel) return null;
              
              return (
                <SvgText
                  key={`x-label-${index}`}
                  x={x}
                  y={CHART_HEIGHT - CHART_PADDING_BOTTOM + 15}
                  fontSize={10}
                  fill={APPLE_COLORS.textSecondary}
                  textAnchor="middle"
                >
                  {formatDate(day.date)}
                </SvgText>
              );
            })}
          </Svg>

          {/* Dokunmatik alanlar */}
          <View 
            style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]} 
            pointerEvents="box-none"
          >
            {data.dailyAverages.map((day, index) => {
              const dayWidth = contentWidth / Math.max(1, data.dailyAverages.length);
              return (
                <TouchableOpacity
                  key={`touch-${day.date}`}
                  style={{
                    position: 'absolute',
                    left: index * dayWidth,
                    top: 0,
                    width: dayWidth,
                    height: CHART_HEIGHT - CHART_PADDING_BOTTOM
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onDayPress?.(day.date);
                  }}
                  testID={`mood-bar-${index}`}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Alt bilgi alanı */}
      <View style={styles.footer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: APPLE_COLORS.secondary }]} />
          <Text style={styles.legendText}>Pozitif</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: APPLE_COLORS.primary }]} />
          <Text style={styles.legendText}>Nötr</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: APPLE_COLORS.negative }]} />
          <Text style={styles.legendText}>Negatif</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APPLE_COLORS.gridLine,
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
  legendText: {
    fontSize: 11,
    color: APPLE_COLORS.textSecondary,
  },
});

export default AppleHealthStyleChart;
