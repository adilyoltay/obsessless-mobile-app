import React, { useMemo, useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity,
  ScrollView,
  Pressable,
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
import { getUserDateString, formatDateInUserTimezone } from '@/utils/timezoneUtils';
import { monthsLongShort, monthsShort as monthsVeryShort, daysShort, getWeekStart } from '@/utils/dateAggregation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  data: MoodJourneyExtended;
  timeRange: TimeRange;
  onDayPress?: (date: string) => void;
  onSelectionChange?: (sel: { date: string; index: number; totalCount: number; label: string; x: number; chartWidth: number } | null) => void;
  clearSelectionSignal?: number;
  embedHeader?: boolean; // render internal header (summary) inside card
  onRequestPage?: (direction: 'prev' | 'next') => void; // request paginate when scrubbing beyond edges
};

const CHART_HEIGHT = 280; // taller plotting area
const CHART_PADDING_TOP = 10; // reduce top whitespace further
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
  onDayPress,
  onSelectionChange,
  clearSelectionSignal,
  embedHeader = true,
  onRequestPage,
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Use the measured container width (card inner width). Fallback to screen - 40.
  const chartWidth = containerWidth > 0 ? containerWidth : (SCREEN_WIDTH - 40);
  const contentWidth = Math.max(0, chartWidth - AXIS_WIDTH - RIGHT_LABEL_PAD);
  
  // Clear selection from parent
  React.useEffect(() => {
    if (typeof clearSelectionSignal === 'number') {
      setSelectedIndex(null);
      onSelectionChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal]);

  const emitSelection = useCallback((index: number | null) => {
    const items = (timeRange !== 'week') ? (data.aggregated?.data || []) : data.dailyAverages;
    const n = items.length;
    if (index === null || index < 0 || index > n - 1) {
      onSelectionChange?.(null);
      return;
    }
    
    // Check if there's actual data for this day/period
    let totalCount = 0;
    let hasData = false;
    
    if (timeRange === 'week') {
      const day = items[index] as any;
      totalCount = Number(day.count || 0);
      hasData = totalCount > 0;
    } else {
      const b = items[index] as AggregatedData;
      totalCount = Number(b.count || 0);
      hasData = totalCount > 0;
    }
    
    // Don't show tooltip if no data
    if (!hasData || totalCount === 0) {
      onSelectionChange?.(null);
      return;
    }
    
    const dw = contentWidth / Math.max(1, n);
    const x = AXIS_WIDTH + (index * dw) + (dw / 2);
    let labelText = '';
    let dateSel = '';
    
    if (timeRange === 'week') {
      // Weekly view: show the selected day's date
      const day = items[index] as any;
      const d = new Date(`${day.date}T00:00:00.000Z`);
      labelText = `${d.getDate()} ${monthsLongShort[d.getMonth()]} ${d.getFullYear()}`;
      dateSel = day.date;
    } else {
      const b = items[index] as AggregatedData;
      labelText = (b as any).label || '';
      dateSel = b.date;
    }
    
    onSelectionChange?.({ date: dateSel, index, totalCount, label: labelText, x, chartWidth });
  }, [data, timeRange, contentWidth, chartWidth, onSelectionChange]);
  
  // Y ekseni değerleri - Apple Health tarzı
  const yAxisValues = [1, 0.5, 0, -0.5, -1];

  // Helpers for band sizing
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const varianceOf = (nums: number[]) => {
    if (!nums || nums.length <= 1) return 0;
    const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
    return nums.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / (nums.length - 1);
  };
  
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

    // Aggregated modda nokta göstermiyoruz (sadece bantlar)
    return points; // empty
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
      const lowMood = (typeof b.p10 === 'number' ? b.p10 : b.min) || 0;
      const highMood = (typeof b.p90 === 'number' ? b.p90 : b.max) || 0;
      const minVal = moodToValence(lowMood);
      const maxVal = moodToValence(highMood);
      const centerMood = timeRange === 'year'
        ? ((typeof (b as any).p50 === 'number') ? (b as any).p50 as number : (b.averageMood || 0))
        : (b.averageMood || 0);
      const avgVal = moodToValence(centerMood);
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
        color: getColorForMood(centerMood, b.averageEnergy || 6),
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
      {/* Üst bilgi alanı (isteğe bağlı) */}
      {embedHeader && (
        <View style={styles.header}>
          <View style={styles.summaryInfo}>
            {selectedIndex === null && (
              <View>
                <Text style={styles.entryCount}>
                  TOPLAM{'\n'}
                  <Text style={styles.entryCountValue}>{data.statistics.totalEntries} <Text style={styles.entryCountUnit}>giriş</Text></Text>
                </Text>
                <Text style={styles.dateRange}>
                  {formatDateRange(data.dailyAverages, timeRange)}
                </Text>
              </View>
            )}
            {/* Baskın duygu ve trend ikonu kart altına taşındı */}
          </View>
        </View>
      )}

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
                    strokeWidth={isZeroLine ? 1.2 : 1}
                    strokeDasharray={isZeroLine ? "0" : "3,2"}
                    strokeOpacity={isZeroLine ? 1 : 0.95}
                  />
                </G>
              );
            })}

            {/* Grid çizgileri (dikey) */}
            {(() => {
              const n = isAggregateMode ? (data.aggregated?.data?.length || 0) : data.dailyAverages.length;
              const dayWidth = contentWidth / Math.max(1, n);
              const todayKey = getUserDateString(new Date());
              // Only highlight today's boundaries in weekly (daily) mode
              const todayIdx = isAggregateMode ? Number.NaN : data.dailyAverages.findIndex(d => d.date === todayKey);
              const lines: any[] = [];
              for (let i = 0; i <= n; i++) {
                const x = AXIS_WIDTH + i * dayWidth;
                const isTodayBoundary = Number.isFinite(todayIdx) && (i === todayIdx || i === todayIdx + 1);
                lines.push(
                  <Line
                    key={`vgrid-boundary-${i}`}
                    x1={x}
                    y1={CHART_PADDING_TOP}
                    x2={x}
                    y2={CHART_PADDING_TOP + CHART_CONTENT_HEIGHT}
                    stroke={APPLE_COLORS.gridLineDark}
                    strokeWidth={isTodayBoundary ? 1.4 : 1}
                    strokeDasharray={isTodayBoundary ? '0' : '3,2'}
                    strokeOpacity={isTodayBoundary ? 1 : 0.95}
                  />
                );
              }
              // Selected guide line - prominent and solid
              if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex <= n - 1) {
                const xSel = AXIS_WIDTH + selectedIndex * dayWidth + dayWidth / 2;
                lines.push(
                  <Line
                    key={`vgrid-selected`}
                    x1={xSel}
                    y1={CHART_PADDING_TOP - 10}
                    x2={xSel}
                    y2={CHART_PADDING_TOP + CHART_CONTENT_HEIGHT + 10}
                    stroke={APPLE_COLORS.gridLineDark}
                    strokeWidth={2}
                    strokeOpacity={0.9}
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

            {/* Nokta-temelli görünüm: bar/bant çizgileri olmadan */}
            {verticalBands.map((band, index) => (
              <G key={`band-${index}`}>
                {isAggregateMode ? (
                  (() => {
                    // 3 özet nokta: p10/min, p50/avg, p90/max
                    const spreadPx = Math.abs(band.maxY - band.minY);
                    const s = Math.max(0, Math.min(1, spreadPx / CHART_CONTENT_HEIGHT));
                    const rCenter = 3.2 - 0.8 * s; // 2.4..3.2
                    const rSide = Math.max(1.8, rCenter - 0.6);
                    const opCenter = 0.95 - 0.25 * s; // 0.7..0.95
                    const opSide = 0.6 - 0.2 * s;     // 0.4..0.6
                    return (
                      <>
                        <Circle cx={band.x} cy={band.minY} r={rSide} fill={band.color} opacity={opSide} />
                        <Circle cx={band.x} cy={band.avgY} r={rCenter} fill={band.color} opacity={opCenter} />
                        <Circle cx={band.x} cy={band.maxY} r={rSide} fill={band.color} opacity={opSide} />
                      </>
                    );
                  })()
                ) : null}
              </G>
            ))}

            {/* Aggregate modda outlier noktaları devre dışı */}

            {/* Veri noktaları - Apple Health tarzı (aggregate modda çizme) */}
            {!isAggregateMode && dataPoints.map((point, index) => {
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
                      // Only select bar; do NOT open details here
                      setSelectedIndex(prev => {
                        const next = prev === index ? null : index;
                        emitSelection(next);
                        return next;
                      });
                    }}
                    testID={`mood-bar-${index}`}
                  />
                );
              });
            })()}
            {/* Scrub overlay: press and drag horizontally to move selection and request paging at edges */}
            <View
              style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const items = isAggregateMode ? (data.aggregated?.data || []) : data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const x = e.nativeEvent.locationX; // 0..contentWidth
                let idx = Math.floor(x / Math.max(1, dw));
                idx = Math.max(0, Math.min(n - 1, idx));
                setSelectedIndex(idx);
                emitSelection(idx);
              }}
              onResponderMove={(e) => {
                const items = isAggregateMode ? (data.aggregated?.data || []) : data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const x = e.nativeEvent.locationX; // may go slightly <0 or >contentWidth if finger outside
                let idx = Math.floor(x / Math.max(1, dw));
                idx = Math.max(0, Math.min(n - 1, idx));
                if (idx !== selectedIndex) {
                  setSelectedIndex(idx);
                  emitSelection(idx);
                }
                // Edge pagination requests
                const threshold = Math.max(12, 0.3 * dw);
                if (typeof onRequestPage === 'function') {
                  if (x < -threshold && idx === 0) {
                    onRequestPage('prev');
                  } else if (x > contentWidth + threshold && idx === n - 1) {
                    onRequestPage('next');
                  }
                }
              }}
              onResponderRelease={() => {}}
            />
          </View>
          {/* External tooltip rendered by parent */}
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
    marginTop: 0,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
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
    alignItems: 'flex-start', // align "Baskın" top with "Toplam"
  },
  entryCount: {
    fontSize: 13,
    color: APPLE_COLORS.axisText,
    fontWeight: '400',
    letterSpacing: 0.2,
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
    fontSize: 14,
    fontWeight: '800',
  },
  trendUp: { color: '#10B981' },
  trendDown: { color: '#EF4444' },
  trendStable: { color: '#6B7280' },
  tooltipBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APPLE_COLORS.gridLine,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tooltipText: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '600',
  },
  tooltipEmo: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 2,
  },
  tooltipSub: {
    marginTop: 2,
    fontSize: 11,
    color: APPLE_COLORS.axisText,
  },
});

export default AppleHealthStyleChartV2;
