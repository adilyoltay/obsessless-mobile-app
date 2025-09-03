import React, { useMemo, useCallback, useState } from 'react';
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
  Path,
  Ellipse
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import type { MoodJourneyExtended, TimeRange, AggregatedData, DailyAverage } from '@/types/mood';
import { getVAColorFromScores } from '@/utils/colorUtils';
import { getUserDateString } from '@/utils/timezoneUtils';
import { monthsLongShort, monthsShort as monthsVeryShort, daysShort } from '@/utils/dateAggregation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  data: MoodJourneyExtended;
  timeRange: TimeRange;
  onDayPress?: (date: string) => void;
};

const CHART_HEIGHT = 280; // taller plotting area
const CHART_PADDING_TOP = 16; // reduce top whitespace ~half
const CHART_PADDING_BOTTOM = 28; // reduce bottom whitespace ~half
const CHART_PADDING_H = 0; // no extra horizontal padding; fit full width
const AXIS_WIDTH = 8; // tighter left gutter (we only need a little)
const RIGHT_LABEL_PAD = 40; // right label pad per design
const CHART_CONTENT_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

// Apple Health renk paleti - tam eşleşme
const APPLE_COLORS = {
  veryPleasant: '#34C759',    // Yeşil - Çok Keyifli
  pleasant: '#5AC8FA',        // Açık Mavi - Keyifli  
  neutral: '#007AFF',         // iOS Blue - Nötr
  unpleasant: '#FF9500',      // Turuncu - Keyifsiz
  veryUnpleasant: '#FF3B30',  // Kırmızı - Çok Keyifsiz
  gridLine: '#E5E5EA',        // Çok açık gri
  gridLineDark: '#C7C7CC',    // Orta gri (0 çizgisi için)
  background: '#FFFFFF',      // Beyaz arka plan
  axisText: '#6B7280',        // Biraz daha koyu gri metin (daha okunur)
  dateText: '#000000',        // Siyah tarih metni
  dotBorder: '#FFFFFF',       // Nokta kenar rengi
  placeholder: '#D1D5DB',     // Gri placeholder
};

// Mood skorunu Apple Health valans değerine dönüştür (-1 to +1)
const moodToValence = (mood: number): number => {
  return ((mood - 50) / 50); // 0-100 -> -1 to +1
};

// VA renkleri veya Apple paleti seçimi
const USE_VA_COLORS = true; // Bizim güçlü VA renk sistemimizi koru

const getColorForMood = (mood: number, energy: number) => {
  if (USE_VA_COLORS) {
    return getVAColorFromScores(mood, energy);
  }
  // Apple paleti eşiği (fallback)
  if (mood >= 80) return APPLE_COLORS.veryPleasant;
  if (mood >= 60) return APPLE_COLORS.pleasant;
  if (mood >= 40) return APPLE_COLORS.neutral;
  if (mood >= 20) return APPLE_COLORS.unpleasant;
  return APPLE_COLORS.veryUnpleasant;
};

// Enerjiyi opaklığa yansıt (1..10 → min..max)
const mapEnergyToOpacity = (energy?: number, min: number = 0.55, max: number = 1) => {
  const e = typeof energy === 'number' && energy > 0 ? Math.max(1, Math.min(10, energy)) : 6;
  return min + (max - min) * ((e - 1) / 9);
};

// Mood'u nokta yarıçapına yansıt (0..100 → min..max)
const mapMoodToRadius = (mood?: number, min: number = 3, max: number = 5) => {
  const m = typeof mood === 'number' && isFinite(mood) ? Math.max(0, Math.min(100, mood)) : 50;
  return min + (max - min) * (m / 100);
};

// Enerjiyi bant kalınlığına yansıt (1..10 → px)
const mapEnergyToWidth = (energy?: number, min: number = 2, max: number = 6) => {
  const e = typeof energy === 'number' && energy > 0 ? Math.max(1, Math.min(10, energy)) : 6;
  return min + (max - min) * ((e - 1) / 9);
};

export const AppleHealthStyleChartV2: React.FC<Props> = ({ 
  data, 
  timeRange, 
  onDayPress 
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  // Use the measured container width (card inner width). Fallback to screen - 40.
  const chartWidth = containerWidth > 0 ? containerWidth : (SCREEN_WIDTH - 40);
  const contentWidth = Math.max(0, chartWidth - AXIS_WIDTH - RIGHT_LABEL_PAD);
  
  // Y ekseni değerleri - Apple Health tarzı
  const yAxisValues = [1, 0.5, 0, -0.5, -1];
  
  // X ekseni etiketleri (Apple Health tarzı) - item tabanlı
  const formatXLabel = useCallback((item: DailyAverage | AggregatedData) => {
    if (timeRange === 'week') {
      const d = new Date((item as DailyAverage).date);
      return daysShort[d.getDay()];
    }
    if (timeRange === 'month') {
      // Haftalık aggregate: label'daki ilk günü göster ("1–7 Oca" -> "1")
      const label = (item as AggregatedData).label || '';
      const match = label.match(/^(\d+)/);
      if (match) return match[1];
      const d = new Date((item as AggregatedData).date);
      return d.getDate().toString();
    }
    if (timeRange === '6months') {
      // Aylık aggregate: kısa ay adı
      const label = (item as AggregatedData).label || '';
      return label.substring(0, 3);
    }
    // year: çok kısa ay
    const d = new Date((item as AggregatedData).date);
    return monthsVeryShort[d.getMonth()];
  }, [timeRange]);

  const isAggregateMode = timeRange !== 'week';

  // Veri noktalarını hazırla (haftalık: ham girişleri; aggregate: bucket ortalaması)
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

    if (!isAggregateMode) {
      const dayWidth = contentWidth / Math.max(1, data.dailyAverages.length);
      data.dailyAverages.forEach((day, index) => {
        const rawPoints = data.rawDataPoints[day.date];
        const x = AXIS_WIDTH + (index * dayWidth) + (dayWidth / 2);
        if (rawPoints && rawPoints.entries.length > 0) {
          rawPoints.entries.forEach(entry => {
            const valence = moodToValence(entry.mood_score);
            const y = CHART_PADDING_TOP + (1 - ((valence + 1) / 2)) * CHART_CONTENT_HEIGHT;
            points.push({
              x,
              y,
              date: day.date,
              mood: entry.mood_score,
              energy: entry.energy_level,
              hasMultiple: rawPoints.entries.length > 1,
              entries: rawPoints.entries,
              color: getColorForMood(entry.mood_score, entry.energy_level)
            });
          });
        }
      });
      return points;
    }

    const buckets: AggregatedData[] = data.aggregated?.data || [];
    const bw = contentWidth / Math.max(1, buckets.length);
    buckets.forEach((b, index) => {
      const valence = moodToValence(b.averageMood || 0);
      const y = CHART_PADDING_TOP + (1 - ((valence + 1) / 2)) * CHART_CONTENT_HEIGHT;
      const x = AXIS_WIDTH + (index * bw) + (bw / 2);
      points.push({
        x,
        y,
        date: b.date,
        mood: b.averageMood || 0,
        energy: b.averageEnergy || 6,
        hasMultiple: (b.count || 0) > 1,
        entries: b.entries || [],
        color: getColorForMood(b.averageMood || 0, b.averageEnergy || 6)
      });
    });
    
    return points;
  }, [data, contentWidth, isAggregateMode, timeRange]);

  // Dikey bantlar (Apple Health tarzı): haftalıkta gün içi çoklu; aggregate modda bucket min-max
  const verticalBands = useMemo(() => {
    const bands: Array<{
      x: number;
      minY: number;
      maxY: number;
      avgY: number;
      date: string;
      entries: any[];
      color: string;
      energyAvg: number;
    }> = [];

    if (!isAggregateMode) {
      const grouped = new Map<string, any[]>();
      dataPoints.forEach(point => {
        if (!grouped.has(point.date)) grouped.set(point.date, []);
        grouped.get(point.date)!.push(point);
      });
      grouped.forEach((points, date) => {
        if (points.length > 1) {
          const ys = points.map(p => p.y);
          const moods = points.map(p => p.mood);
          const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
          const avgEnergy = points.reduce((a, b) => a + b.energy, 0) / points.length;
          const avgY = CHART_PADDING_TOP + (1 - ((moodToValence(avgMood) + 1) / 2)) * CHART_CONTENT_HEIGHT;
          bands.push({
            x: points[0].x,
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            avgY,
            date,
            entries: points[0].entries,
            color: getColorForMood(avgMood, avgEnergy),
            energyAvg: avgEnergy,
          });
        }
      });
      return bands;
    }

    // Aggregate mod: derive from aggregated buckets (min/max/avg)
    const buckets: AggregatedData[] = data.aggregated?.data || [];
    const bw = contentWidth / Math.max(1, buckets.length);
    buckets.forEach((b, index) => {
      const x = AXIS_WIDTH + (index * bw) + (bw / 2);
      const minVal = moodToValence(b.min || 0);
      const maxVal = moodToValence(b.max || 0);
      const avgVal = moodToValence(b.averageMood || 0);
      const minY = CHART_PADDING_TOP + (1 - ((minVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      const maxY = CHART_PADDING_TOP + (1 - ((maxVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      const avgY = CHART_PADDING_TOP + (1 - ((avgVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      bands.push({
        x,
        minY: Math.min(minY, maxY),
        maxY: Math.max(minY, maxY),
        avgY,
        date: b.date,
        entries: b.entries || [],
        color: getColorForMood(b.averageMood || 0, b.averageEnergy || 6),
        energyAvg: b.averageEnergy || 6,
      });
    });
    return bands;
  }, [dataPoints, data.aggregated, contentWidth, isAggregateMode]);

  // X ekseni etiket gösterim mantığı
  const getXLabelVisibility = useCallback((index: number, total: number) => {
    // Basit virtualization: etiketler arası min piksel mesafesi
    const minLabelPx = timeRange === 'week' ? 18 : timeRange === 'month' ? 22 : 28;
    const step = Math.max(1, Math.ceil((total * minLabelPx) / Math.max(1, contentWidth)));
    if (index === 0 || index === total - 1) return true;
    return index % step === 0;
  }, [timeRange, contentWidth]);

  // Dominant emotion and simple trend (first vs last non-zero)
  const dominantEmotion = data.statistics?.dominantEmotions?.[0]?.emotion || '—';
  const firstNonZero = data.dailyAverages.find(d => (d.averageMood || 0) > 0);
  const lastNonZero = [...data.dailyAverages].reverse().find(d => (d.averageMood || 0) > 0);
  const trend: 'up' | 'down' | 'stable' | null = (firstNonZero && lastNonZero)
    ? (firstNonZero.averageMood < lastNonZero.averageMood ? 'up' : firstNonZero.averageMood > lastNonZero.averageMood ? 'down' : 'stable')
    : null;

  return (
    <View style={styles.container}>
      {/* Üst bilgi alanı */}
      <View style={styles.header}>
        <View style={styles.summaryInfo}>
          <View>
            <Text style={styles.entryCount}>
              TOPLAM{'\n'}
              <Text style={styles.entryCountValue}>{data.statistics.totalEntries} <Text style={styles.entryCountUnit}>giriş</Text></Text>
            </Text>
            <Text style={styles.dateRange}>
              {formatDateRange(data.dailyAverages, timeRange)}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>Baskın</Text>
              <Text style={styles.chipValue}>{dominantEmotion}</Text>
              {trend && (
                <Text style={[styles.trend, trend === 'up' ? styles.trendUp : trend === 'down' ? styles.trendDown : styles.trendStable]}>
                  {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Ölçüm sarmalayıcı: gerçek kart genişliğini al */}
      <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ScrollView 
        horizontal={(timeRange === 'week' ? data.dailyAverages.length : (data.aggregated?.data?.length || 0)) > 30}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.hScrollContent}
      >
        <View style={{ width: chartWidth, alignSelf: 'flex-start' }}>
          <Svg 
            height={CHART_HEIGHT} 
            width={chartWidth}
          >
            {/* Arka plan kaldırıldı (kullanıcı isteği) */}

            {/* Grid çizgileri (yatay) */}
            {yAxisValues.map((value, index) => {
              const y = CHART_PADDING_TOP + (1 - ((value + 1) / 2)) * CHART_CONTENT_HEIGHT;
              const isZeroLine = value === 0;
              return (
                <G key={`grid-${index}`}>
                  <Line
                    x1={AXIS_WIDTH}
                    y1={y}
                    x2={AXIS_WIDTH + contentWidth}
                    y2={y}
                    stroke={isZeroLine ? APPLE_COLORS.gridLineDark : APPLE_COLORS.gridLine}
                    strokeWidth={isZeroLine ? 1 : 0.7}
                    strokeDasharray={isZeroLine ? "0" : "2,2"}
                    strokeOpacity={isZeroLine ? 0.9 : 0.8}
                  />
                </G>
              );
            })}

            {/* Grid çizgileri (dikey) */}
            {(() => {
              const n = isAggregateMode ? (data.aggregated?.data?.length || 0) : data.dailyAverages.length;
              const dayWidth = contentWidth / Math.max(1, n);
              const todayKey = getUserDateString(new Date());
              const todayIdx = isAggregateMode ? -1 : data.dailyAverages.findIndex(d => d.date === todayKey);
              const lines: any[] = [];
              for (let i = 0; i <= n; i++) {
                const x = AXIS_WIDTH + i * dayWidth;
                const isTodayBoundary = i === todayIdx || i === todayIdx + 1;
                lines.push(
                  <Line
                    key={`vgrid-boundary-${i}`}
                    x1={x}
                    y1={CHART_PADDING_TOP}
                    x2={x}
                    y2={CHART_PADDING_TOP + CHART_CONTENT_HEIGHT}
                    stroke={APPLE_COLORS.gridLineDark}
                    strokeWidth={isTodayBoundary ? 1.2 : 0.9}
                    strokeDasharray={isTodayBoundary ? '0' : '2,2'}
                    strokeOpacity={isTodayBoundary ? 1 : 0.85}
                  />
                );
              }
              return lines;
            })()}

            {/* Sağ sınır çizgisi */}
            <Line
              x1={AXIS_WIDTH + contentWidth}
              y1={CHART_PADDING_TOP}
              x2={AXIS_WIDTH + contentWidth}
              y2={CHART_PADDING_TOP + CHART_CONTENT_HEIGHT}
              stroke={APPLE_COLORS.gridLineDark}
              strokeWidth={1}
              opacity={0.9}
            />

            {/* Y ekseni etiketleri (sağda, uzun kelimeler alt alta) */}
            {(() => {
              const rightX = AXIS_WIDTH + contentWidth + 6; // closer to right axis, more plotting width
              const lines = [
                { y: CHART_PADDING_TOP + 4, rows: ['Çok', 'Keyifli'] },
                { y: CHART_PADDING_TOP + CHART_CONTENT_HEIGHT / 2 + 4, rows: ['Nötr'] },
                { y: CHART_PADDING_TOP + CHART_CONTENT_HEIGHT + 4, rows: ['Çok', 'Keyifsiz'] },
              ];
              return lines.map((l, i) => (
                <G key={`yr-${i}`}>
                  {l.rows.map((row, idx) => (
                    <SvgText
                      key={`yr-${i}-${idx}`}
                      x={rightX}
                      y={l.y + idx * 12}
                      fontSize={10}
                      fill={APPLE_COLORS.axisText}
                      textAnchor="start"
                      fontWeight={i === 0 || i === 2 ? '700' as any : '400' as any}
                    >
                      {row}
                    </SvgText>
                  ))}
                </G>
              ));
            })()}

            {/* Dikey bantlar (birden fazla giriş için) - Apple Health tarzı */}
            {verticalBands.map((band, index) => (
              <G key={`band-${index}`}>
                {/* Arka plan çizgisi */}
                <Line
                  x1={band.x}
                  y1={band.minY}
                  x2={band.x}
                  y2={band.maxY}
                  stroke={band.color}
                  strokeWidth={mapEnergyToWidth(band.energyAvg, 2, 6) * (isAggregateMode ? (timeRange === 'month' ? 1.1 : 1.25) : 1)}
                  strokeLinecap="round"
                  opacity={mapEnergyToOpacity(band.energyAvg, 0.25, 0.6)}
                />
                {/* Ortalama noktası */}
                <Circle
                  cx={band.x}
                  cy={band.avgY}
                  r={3}
                  fill={band.color}
                  opacity={mapEnergyToOpacity(band.energyAvg, 0.75, 1)}
                />
              </G>
            ))}

            {/* Veri noktaları - Apple Health tarzı */}
            {dataPoints.map((point, index) => {
              const innerRBase = mapMoodToRadius(point.mood, 2.8, 4.8);
              const sizeFactor = isAggregateMode ? (timeRange === 'month' ? 1.2 : 1.5) : 1;
              const innerRBaseAdj = innerRBase * sizeFactor;
              const innerR = Math.max(2.4, Math.min(6.5, point.hasMultiple && !isAggregateMode ? innerRBaseAdj - 0.4 : innerRBaseAdj));
              const outerR = innerR + 1.2;
              const innerOpacity = mapEnergyToOpacity(point.energy, 0.65, 1);
              return (
                <G key={`point-${index}`}>
                  {/* Dış beyaz halka */}
                  <Circle cx={point.x} cy={point.y} r={outerR} fill={APPLE_COLORS.dotBorder} opacity={1} />
                  {/* İç renkli nokta */}
                  <Circle cx={point.x} cy={point.y} r={innerR} fill={point.color} opacity={innerOpacity} />
                </G>
              );
            })}

            {/* X ekseni etiketleri */}
            {(() => {
              const items = isAggregateMode ? (data.aggregated?.data || []) : data.dailyAverages;
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              const todayKeyLbl = getUserDateString(new Date());
              return items.map((it: any, index: number) => {
                const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                const showLabel = getXLabelVisibility(index, n);
                const isTodayLbl = !isAggregateMode && (it as any).date === todayKeyLbl;
                if (!showLabel) return null;
                return (
                  <SvgText
                    key={`x-label-${index}`}
                    x={x}
                    y={CHART_HEIGHT - CHART_PADDING_BOTTOM + 20}
                    fontSize={11}
                    fill={isTodayLbl ? '#374151' : APPLE_COLORS.axisText}
                    textAnchor="middle"
                    fontWeight={isTodayLbl ? '600' : '400'}
                  >
                    {formatXLabel(it)}
                  </SvgText>
                );
              });
            })()}
          </Svg>

          {/* Dokunmatik alanlar */}
          <View 
            style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]} 
            pointerEvents="box-none"
          >
            {(() => {
              const items = isAggregateMode ? (data.aggregated?.data || []) : data.dailyAverages;
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              return items.map((it: any, index: number) => {
                const dateStr = isAggregateMode ? (it as AggregatedData).date : (it as any).date;
                return (
                  <TouchableOpacity
                    key={`touch-${dateStr}-${index}`}
                    style={{
                      position: 'absolute',
                      left: index * dw,
                      top: 0,
                      width: dw,
                      height: CHART_HEIGHT - CHART_PADDING_BOTTOM
                    }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDayPress?.(dateStr);
                    }}
                    testID={`mood-bar-${index}`}
                  />
                );
              });
            })()}
          </View>
          {/* Placeholder'lar: veri olmayan gün/hafta/ay için gri nokta/çizgi */}
          <Svg 
            height={CHART_HEIGHT} 
            width={chartWidth}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          >
            {(() => {
              if (!isAggregateMode) {
                const n = data.dailyAverages.length;
                const dw = contentWidth / Math.max(1, n);
                return data.dailyAverages.map((day, index) => {
                  if (day.count > 0) return null;
                  const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                  const neutralY = CHART_PADDING_TOP + (1 - ((0 + 1) / 2)) * CHART_CONTENT_HEIGHT; // valence 0
                  return (
                    <G key={`ph-day-${index}`}>
                      <Circle cx={x} cy={neutralY} r={3} fill={APPLE_COLORS.placeholder} opacity={0.9} />
                    </G>
                  );
                });
              }
              // Aggregate mode
              const buckets: AggregatedData[] = data.aggregated?.data || [];
              const n = buckets.length;
              const dw = contentWidth / Math.max(1, n);
              return buckets.map((b, index) => {
                if ((b.count || 0) > 0) return null;
                const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                const neutralY = CHART_PADDING_TOP + (1 - ((0 + 1) / 2)) * CHART_CONTENT_HEIGHT; // valence 0
                return (
                  <G key={`ph-bucket-${index}`}>
                    <Line
                      x1={x - 10}
                      y1={neutralY}
                      x2={x + 10}
                      y2={neutralY}
                      stroke={APPLE_COLORS.placeholder}
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      strokeLinecap="round"
                      opacity={0.75}
                    />
                    <Circle cx={x} cy={neutralY} r={3} fill={APPLE_COLORS.placeholder} opacity={0.8} />
                  </G>
                );
              });
            })()}
          </Svg>
        </View>
      </ScrollView>
      </View>
    </View>
  );
};

// Tarih aralığı formatla
const formatDateRange = (dailyAverages: any[], timeRange: TimeRange) => {
  if (dailyAverages.length === 0) return '';
  
  const start = new Date(dailyAverages[0].date);
  const end = new Date(dailyAverages[dailyAverages.length - 1].date);
  
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
                  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  
  if (timeRange === 'week') {
    return `${start.getDate()} ${months[start.getMonth()]}–${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  } else if (timeRange === 'month') {
    return `${months[start.getMonth()]} ${start.getFullYear()}`;
  } else if (timeRange === '6months') {
    return `${months[start.getMonth()]}–${months[end.getMonth()]} ${end.getFullYear()}`;
  } else {
    return `${start.getFullYear()}`;
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: APPLE_COLORS.background,
    borderRadius: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APPLE_COLORS.gridLine,
  },
  hScrollContent: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  summaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryCount: {
    fontSize: 11,
    color: APPLE_COLORS.axisText,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  entryCountValue: {
    fontSize: 30,
    color: '#000',
    fontWeight: '800',
    lineHeight: 34,
  },
  entryCountUnit: {
    fontSize: 16,
    color: APPLE_COLORS.axisText,
    fontWeight: '600',
    marginLeft: 6,
  },
  dateRange: {
    fontSize: 14,
    color: APPLE_COLORS.axisText,
    fontWeight: '400',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  trend: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  trendUp: { color: '#10B981' },
  trendDown: { color: '#EF4444' },
  trendStable: { color: '#6B7280' },
});

export default AppleHealthStyleChartV2;
