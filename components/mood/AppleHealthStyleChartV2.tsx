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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  showAnxiety?: boolean;
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

// Görsel gramer V2: Renk=Enerji, Opaklık=Zaman, Y=Mood, Boyut=Sabit
const DOT_RADIUS = 4;
const recencyAlpha = (ts: number, minTs: number, maxTs: number) => {
  if (maxTs === minTs) return 1;
  const t = (ts - minTs) / (maxTs - minTs);
  return 0.4 + 0.6 * Math.max(0, Math.min(1, t));
};
const energyToColor = (e: number, alpha: number = 1) => {
  // energy 1..10 → 0..100
  const clamped = Math.max(0, Math.min(100, (typeof e === 'number' ? e * 10 : 60)));
  const hue = 200 - (180 * clamped / 100); // 200° (düşük) → 20° (yüksek)
  return `hsla(${Math.round(hue)}, 65%, 50%, ${alpha})`;
};
const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const jitterXY = (seedKey: string, xMaxPx = 12, yMaxPx = 2.2) => {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) { h ^= seedKey.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = lcg(h >>> 0);
  return { jx: (rnd() - 0.5) * 2 * xMaxPx, jy: (rnd() - 0.5) * 2 * yMaxPx };
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

// Nokta/Jitter ve özet nokta (aggregate) ayarları — kolayca ince ayar için
const DOT_TUNING = {
  jitter: {
    xFactor: 0.28,     // gün genişliği ile çarpılan X jitter oranı (önceki ~0.22)
    xMaxPx: 12,        // X jitter üst sınırı (px) (önceki 10)
    yPx: 2.2,          // Y jitter (px) (önceki 1.8)
    clampPaddingPx: 4, // gün kenarlarından içeriye güvenlik payı
  },
  agg: {
    // Merkez nokta yarıçap aralığı: s=0 (belirsizlik az) → max, s=1 → min
    rCenterMax: 4.0,
    rCenterMin: 2.8,
    rSideFloor: 2.2,   // yan noktaların minimum yarıçapı
    rSideDelta: 0.9,   // yan = merkez - delta
    // Opaklık aralıkları
    opCenterMax: 1.0,
    opCenterMin: 0.88,
    opSideMax: 0.6,
    opSideMin: 0.4,
  },
} as const;

export const AppleHealthStyleChartV2: React.FC<Props> = ({ 
  data, 
  timeRange, 
  onDayPress,
  onSelectionChange,
  clearSelectionSignal,
  embedHeader = true,
  onRequestPage,
  showAnxiety = true,
}) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [legendSeen, setLegendSeen] = useState<boolean>(true);
  React.useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem('chart_v2_legend_seen');
        if (!flag) {
          setLegendSeen(false);
          await AsyncStorage.setItem('chart_v2_legend_seen', '1');
        }
      } catch {}
    })();
  }, []);
  // Deterministic jitter helper (-1..1)
  const jitter01 = useCallback((seed: string) => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const u = (h >>> 0) / 0xffffffff; // 0..1
    return u * 2 - 1; // -1..1
  }, []);
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
      ts?: number;
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
              ts: new Date(entry.timestamp).getTime(),
              color: '#000'
            });
          });
        }
      });
      return points;
    }

    // Aggregated modda nokta göstermiyoruz (sadece bantlar)
    return points; // empty
  }, [data, contentWidth, isAggregateMode, timeRange]);

  // Dikey bantlar: aggregate modda IQR (p25/p75) + median (p50)
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
            color: energyToColor(avgEnergy, 1),
            energyAvg: avgEnergy,
          });
        }
      });
      return bands;
    }

    // Aggregate mod: derive from aggregated buckets (IQR)
    const buckets: AggregatedData[] = data.aggregated?.data || [];
    const bw = contentWidth / Math.max(1, buckets.length);
    buckets.forEach((b, index) => {
      const x = AXIS_WIDTH + (index * bw) + (bw / 2);
      const lowMood = (b.mood?.p25 ?? b.mood?.min ?? 0);
      const highMood = (b.mood?.p75 ?? b.mood?.max ?? 0);
      const minVal = moodToValence(lowMood);
      const maxVal = moodToValence(highMood);
      const centerMood = (b.mood?.p50 ?? b.avg ?? 0);
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
        entries: [],
        color: energyToColor((b.energy?.p50 ?? 6) * 10, 1),
        energyAvg: b.energy?.p50 ?? 6,
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
                    strokeDasharray={isZeroLine ? "4,3" : "3,2"}
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
                    // Boyut: merkez 2.8..4.0, yan merkezden ~0.9 küçük, en az 2.2
                    const rCenter = DOT_TUNING.agg.rCenterMax - (DOT_TUNING.agg.rCenterMax - DOT_TUNING.agg.rCenterMin) * s;
                    const rSide = Math.max(DOT_TUNING.agg.rSideFloor, rCenter - DOT_TUNING.agg.rSideDelta);
                    // Opaklık: merkez 0.88..1.0, yan 0.4..0.6
                    const opCenter = DOT_TUNING.agg.opCenterMax - (DOT_TUNING.agg.opCenterMax - DOT_TUNING.agg.opCenterMin) * s;
                    const opSide = DOT_TUNING.agg.opSideMax - (DOT_TUNING.agg.opSideMax - DOT_TUNING.agg.opSideMin) * s;
                    return (
                      <>
                        <Circle cx={band.x} cy={band.minY} r={rSide} fill={band.color} opacity={opSide} />
                        <Circle cx={band.x} cy={band.avgY} r={rCenter} fill={band.color} opacity={opCenter} stroke={APPLE_COLORS.dotBorder} strokeWidth={0.8} />
                        <Circle cx={band.x} cy={band.maxY} r={rSide} fill={band.color} opacity={opSide} />
                      </>
                    );
                  })()
                ) : null}
              </G>
            ))}

            {/* Aggregate modda outlier noktaları devre dışı */}

            {/* Veri noktaları - Apple Health tarzı (aggregate modda çizme) */}
            {!isAggregateMode && (() => {
              const items = data.dailyAverages;
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              const times = dataPoints.map(p => (p as any).ts || new Date(`${p.date}T00:00:00.000Z`).getTime());
              const minTs = times.length ? Math.min(...times) : 0;
              const maxTs = times.length ? Math.max(...times) : 1;
              return dataPoints.map((point: any, index) => {
                const r = DOT_RADIUS;
                const outerR = r + 1.2;
                const alpha = recencyAlpha(point.ts || new Date(`${point.date}T00:00:00.000Z`).getTime(), minTs, maxTs);
                const fill = energyToColor(point.energy, alpha);
                // Jitter: Aynı gün içinde çakışmaları azaltmak için hafif X/Y sapma
                const dayIdx = Math.max(0, Math.min(n - 1, Math.floor((point.x - AXIS_WIDTH) / Math.max(1, dw))));
                const leftBound = AXIS_WIDTH + dayIdx * dw + DOT_TUNING.jitter.clampPaddingPx;
                const rightBound = AXIS_WIDTH + (dayIdx + 1) * dw - DOT_TUNING.jitter.clampPaddingPx;
                const ampX = Math.min(dw * DOT_TUNING.jitter.xFactor, DOT_TUNING.jitter.xMaxPx);
                const ampY = DOT_TUNING.jitter.yPx;
                const { jx, jy } = point.hasMultiple ? jitterXY(`${point.date}-${point.mood}-${point.energy}-${index}`) : { jx: 0, jy: 0 } as any;
                const px = Math.max(leftBound, Math.min(rightBound, point.x + jx * ampX));
                const py = Math.max(CHART_PADDING_TOP + 2, Math.min(CHART_PADDING_TOP + CHART_CONTENT_HEIGHT - 2, point.y + jy * ampY));
                return (
                  <G key={`point-${index}`}>
                    {/* Dış beyaz halka */}
                    <Circle cx={px} cy={py} r={outerR} fill={APPLE_COLORS.dotBorder} opacity={1} />
                    {/* İç renkli nokta */}
                    <Circle cx={px} cy={py} r={r} fill={fill} opacity={1} />
                  </G>
                );
              });
            })()}

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
          {/* Anxiety thin-line overlay */}
          {showAnxiety && timeRange === 'week' && data.dailyAverages.length > 1 && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const points = items.map((d, index) => {
                  const ax = AXIS_WIDTH + (index * dw) + (dw / 2);
                  const a = Number(d.averageAnxiety || 0);
                  const norm = Math.max(1, Math.min(10, a));
                  // Map 1..10 -> chart Y (top=low anxiety for readability)
                  const t = (norm - 1) / 9; // 0..1
                  const ay = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                  return `${ax},${ay}`;
                });
                return (
                  <>
                    <Path d={`M ${points[0]} L ${points.slice(1).join(' L ')}`} stroke="#8B5CF6" strokeWidth={1} strokeOpacity={0.5} fill="none" strokeDasharray="3,2" />
                  </>
                );
              })()}
            </Svg>
          )}

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
      {!legendSeen && (
        <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>Y = Mood • Renk = Enerji • Opaklık = Zaman</Text>
        </View>
      )}
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
