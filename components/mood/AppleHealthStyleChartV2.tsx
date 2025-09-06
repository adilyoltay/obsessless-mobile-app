import React, { useMemo, useCallback, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity,
  ScrollView,
  Pressable,
  PixelRatio,
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
import { PanGestureHandler, PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { recencyAlpha, jitterXY, energyToColor, quantiles } from '@/utils/statistics';
import { useAccentColor } from '@/contexts/AccentColorContext';
import type { MoodJourneyExtended, TimeRange, AggregatedData, DailyAverage } from '@/types/mood';
import { getVAColorFromScores } from '@/utils/colorUtils';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
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
  showMoodTrend?: boolean; // weekly p50 mood line
  showEnergy?: boolean;    // weekly energy line
  onVisibleRangeChange?: (stats: { date: string; startHour: number; endHour: number; count: number; moodP50: number; energyP50: number; anxietyP50: number; dominant?: string }) => void;
};

const CHART_HEIGHT = 252; // 10% shorter plotting area
const CHART_PADDING_TOP = 10; // reduce top whitespace further
const CHART_PADDING_BOTTOM = 28; // reduce bottom whitespace ~half
const CHART_PADDING_H = 0; // no extra horizontal padding; fit full width
const AXIS_WIDTH = 8; // tighter left gutter (we only need a little)
const RIGHT_LABEL_PAD = 40; // right label pad per design
const CHART_CONTENT_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
const LINE_WIDTH = 2.0; // unified line width for all overlays (thinner)
// Mini segment tuning (single-point emphasis)
const MINI_SEGMENT_MIN_PX = 10;
const MINI_SEGMENT_MAX_PX = 22;
const MINI_SEGMENT_RATIO_DAY = 0.42;
const MINI_SEGMENT_RATIO_WEEK = 0.34;
const MINI_SEGMENT_RATIO_AGG = 0.32;

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
const DOT_RADIUS = 2.6; // slightly smaller dots for day/week
// Color utilities for trend line fine-tuning
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hexToRgb = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};
const rgbToHex = (r: number, g: number, b: number) =>
  `#${clamp(Math.round(r),0,255).toString(16).padStart(2,'0')}${clamp(Math.round(g),0,255).toString(16).padStart(2,'0')}${clamp(Math.round(b),0,255).toString(16).padStart(2,'0')}`;
const mixHex = (base: string, mix: string, weight: number) => {
  const a = hexToRgb(base);
  const b = hexToRgb(mix);
  if (!a || !b) return base;
  const w = clamp(weight, 0, 1);
  const r = a.r * (1 - w) + b.r * w;
  const g = a.g * (1 - w) + b.g * w;
  const bl = a.b * (1 - w) + b.b * w;
  return rgbToHex(r, g, bl);
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
    xFactor: 0.36,     // daha yüksek X jitter — çakışmayı azalt
    xMaxPx: 14,        // üst sınırı biraz artır
    yPx: 2.6,          // hafif daha fazla Y jitter
    clampPaddingPx: 4, // gün kenarlarından içeriye güvenlik payı
  },
  agg: {
    // Merkez nokta yarıçap aralığı (aggregate mod): s=0 → max, s=1 → min
    // Daha belirgin: aggregate görünümde noktaları büyüt
    rCenterMax: 4.6,
    rCenterMin: 3.2,
    rSideFloor: 2.5,   // yan noktaların minimum yarıçapı
    rSideDelta: 1.0,   // yan = merkez - delta
    // Opaklık aralıkları
    opCenterMax: 1.0,
    opCenterMin: 0.92,
    opSideMax: 0.72,
    opSideMin: 0.5,
  },
} as const;

export const AppleHealthStyleChartV2: React.FC<Props> = ({ 
  data, 
  timeRange, 
  onDayPress,
  onSelectionChange,
  onVisibleRangeChange,
  clearSelectionSignal,
  embedHeader = true,
  onRequestPage,
  showAnxiety = true,
  showMoodTrend = true,
  showEnergy = true,
}) => {
  const theme = useThemeColors();
  const { language } = useTranslation();
  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Day view: sliding hourly window (±4 hours around now) with pinch-zoom
  const DAY_WINDOW_MIN = 4;
  const DAY_WINDOW_MAX = 24;
  const [dayWindowSize, setDayWindowSize] = useState<number>(8);
  const [dayWindowStart, setDayWindowStart] = useState<number>(0);
  const pinchInitDistRef = React.useRef<number | null>(null);
  const pinchAppliedRef = React.useRef<boolean>(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { color: accentColor } = useAccentColor();
  const [legendSeen, setLegendSeen] = useState<boolean>(true);
  const safePathD = React.useCallback((pts: string[]): string | null => {
    if (!pts || pts.length < 2) return null;
    for (const p of pts) {
      const parts = String(p).split(',');
      if (parts.length !== 2) return null;
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    }
    return `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
  }, []);

  // Memoized helpers to reduce recalculation during scrubbing/zooming
  const visibleHours = useMemo(() => {
    return (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);
  }, [data.hourlyAverages, dayWindowStart, dayWindowSize]);
  const nVisible = visibleHours.length;
  const aggregatedItems = useMemo(() => (data.aggregated?.data || []) as any[], [data.aggregated]);
  // dash removed: we render solid lines consistently using LINE_WIDTH
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
  const dwVisible = useMemo(() => contentWidth / Math.max(1, nVisible), [contentWidth, nVisible]);
  
  // Clear selection from parent
  React.useEffect(() => {
    if (typeof clearSelectionSignal === 'number') {
      setSelectedIndex(null);
      onSelectionChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal]);

  // Initialize/realign day window when switching to 'day'
  React.useEffect(() => {
    if (timeRange !== 'day') return;
    try {
      const hour = new Date().getHours();
      const start = Math.max(0, Math.min(24 - dayWindowSize, hour - Math.floor(dayWindowSize / 2)));
      setDayWindowStart(start);
      setSelectedIndex(null);
      onSelectionChange?.(null);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, dayWindowSize]);

  // Emit visible window stats to parent on change
  React.useEffect(() => {
    if (timeRange !== 'day' || typeof onVisibleRangeChange !== 'function') return;
    try {
      const hours = (data.hourlyAverages || []) as any[];
      const slice = hours.slice(dayWindowStart, dayWindowStart + dayWindowSize);
      const dateKey = (slice[0]?.dateKey || '').split('#')[0] || getUserDateString(new Date());
      const entries: any[] = [];
      slice.forEach((h: any) => {
        const list = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
        entries.push(...list);
      });
      const moodVals = entries.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
      const energyVals = entries.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
      
      // IMPROVED: Smart anxiety handling for day window stats
      const anxVals: number[] = [];
      entries.forEach((e: any) => {
        const anxVal = Number(e.anxiety_level);
        if (Number.isFinite(anxVal)) {
          if (anxVal === 5) {
            // Derive from this entry's mood/energy if fallback
            const m10 = Math.max(1, Math.min(10, Math.round(Number(e.mood_score || 50) / 10)));
            const e10 = Math.max(1, Math.min(10, Number(e.energy_level || 6)));
            
            let derivedA = 5;
            if (m10 <= 3) derivedA = 7;
            else if (m10 >= 8 && e10 <= 4) derivedA = 6;
            else if (m10 <= 5 && e10 >= 7) derivedA = 8;
            else if (m10 >= 7 && e10 >= 7) derivedA = 4;
            else derivedA = Math.max(2, Math.min(8, 6 - (m10 - 5)));
            
            anxVals.push(derivedA);
          } else {
            anxVals.push(anxVal);
          }
        }
      });
      const mq = quantiles(moodVals);
      const eq = quantiles(energyVals);
      const aq = quantiles(anxVals);
      const counts: Record<string, number> = { Heyecanlı:0, Enerjik:0, Mutlu:0, Sakin:0, Normal:0, Endişeli:0, Sinirli:0, Üzgün:0, Kızgın:0 };
      moodVals.forEach((m) => {
        if (m >= 90) counts.Heyecanlı++; else if (m >= 80) counts.Enerjik++; else if (m >= 70) counts.Mutlu++;
        else if (m >= 60) counts.Sakin++; else if (m >= 50) counts.Normal++; else if (m >= 40) counts.Endişeli++;
        else if (m >= 30) counts.Sinirli++; else if (m >= 20) counts.Üzgün++; else counts.Kızgın++;
      });
      const dominant = Object.entries(counts).sort((a,b)=>b[1]-a[1]).find(([,c])=>c>0)?.[0];
      onVisibleRangeChange({
        date: dateKey,
        startHour: dayWindowStart,
        endHour: Math.min(23, dayWindowStart + dayWindowSize - 1),
        count: entries.length,
        moodP50: mq.p50,
        energyP50: eq.p50,
        anxietyP50: aq.p50,
        dominant,
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, dayWindowStart, dayWindowSize, data]);


  const emitSelection = useCallback((index: number | null) => {
    const items = (timeRange === 'week')
      ? data.dailyAverages
      : (timeRange === 'day'
        ? (((data.hourlyAverages || [])
            .slice(dayWindowStart, dayWindowStart + dayWindowSize)
            .map((h: any) => ({ date: h.dateKey })) ) as any[])
        : (data.aggregated?.data || []));
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
    } else if (timeRange === 'day') {
      const hourItem = items[index] as any; // { date: YYYY-MM-DD#HH }
      const rp = (data as any).rawHourlyDataPoints?.[hourItem.date]?.entries || [];
      totalCount = rp.length;
      hasData = totalCount > 0;
    } else {
      const b = items[index] as AggregatedData;
      totalCount = Number(b.count || 0);
      hasData = totalCount > 0;
    }

    // Don't show tooltip if no data
    if (!hasData || totalCount === 0) {
      // UX: Select nearest neighbor with data to keep tooltip responsive
      let j = index;
      let found = -1;
      for (let step = 1; step < n; step++) {
        const left = index - step;
        const right = index + step;
        const check = (k: number) => {
          if (k < 0 || k >= n) return false;
          if (timeRange === 'week') {
            return Number((items[k] as any).count || 0) > 0;
          } else if (timeRange === 'day') {
            const it: any = items[k];
            const rp = (data as any).rawHourlyDataPoints?.[it.date]?.entries || [];
            return rp.length > 0;
          } else {
            return Number((items[k] as any).count || 0) > 0;
          }
        };
        if (check(left)) { found = left; break; }
        if (check(right)) { found = right; break; }
      }
      if (found === -1) { onSelectionChange?.(null); return; }
      // Recurse with found index
      emitSelection(found);
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
    } else if (timeRange === 'day') {
      const it = items[index] as any; // { date: YYYY-MM-DD#HH }
      const [dstr, hh] = String(it.date).split('#');
      const d = new Date(`${dstr}T00:00:00.000Z`);
      const h = parseInt(hh || '0', 10);
      const mon = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
      const day = d.getDate();
      const year = d.getFullYear();
      labelText = `${day} ${mon} ${year} • ${String(h).padStart(2, '0')}:00`;
      dateSel = it.date;
    } else {
      const b = items[index] as AggregatedData;
      labelText = (b as any).label || '';
      dateSel = b.date;
    }
    
    onSelectionChange?.({ date: dateSel, index, totalCount, label: labelText, x, chartWidth });
  }, [data, timeRange, contentWidth, chartWidth, onSelectionChange, dayWindowStart]);
  
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
    if (timeRange === 'day') {
      const key = ((item as any).date || '') as string; // YYYY-MM-DD#HH
      const hh = key.includes('#') ? key.split('#')[1] : '00';
      const h = parseInt(hh, 10) || 0;
      // Always 24h display for clarity (e.g., 00, 03, 16)
      return String(h).padStart(2, '0');
    }
    if (timeRange === 'week') {
      // Parse YYYY-MM-DD explicitly as local midnight to avoid engine-specific UTC parsing
      const d = new Date(`${(item as DailyAverage).date}T00:00:00`);
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
      // Kısa ay adı (locale)
      const d = new Date((item as AggregatedData).date);
      return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
    }
    // year: kısa ay adı (locale)
    const d = new Date((item as AggregatedData).date);
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  }, [timeRange, locale]);

  const isAggregateMode = timeRange !== 'week' && timeRange !== 'day';

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
      const baseItems: any[] = timeRange === 'day'
        ? ((data.hourlyAverages || [])
            .slice(dayWindowStart, dayWindowStart + dayWindowSize)
            .map((h: any) => ({ date: h.dateKey })))
        : (data.dailyAverages as any[]);
      const dayWidth = contentWidth / Math.max(1, baseItems.length);
      baseItems.forEach((day: any, index: number) => {
        const rawPoints = timeRange === 'day'
          ? (data as any).rawHourlyDataPoints?.[day.date]
          : data.rawDataPoints[day.date];
        const x = AXIS_WIDTH + (index * dayWidth) + (dayWidth / 2);
        if (rawPoints && rawPoints.entries.length > 0) {
          // Thinning for day: cap dots per hour for readability
          const entriesArr = (() => {
            if (timeRange !== 'day') return rawPoints.entries as any[];
            const MAX_PER_HOUR = 6; // adjustable cap
            const arr = rawPoints.entries as any[];
            if (arr.length <= MAX_PER_HOUR) return arr;
            const step = arr.length / MAX_PER_HOUR;
            const picked: any[] = [];
            for (let i = 0; i < MAX_PER_HOUR; i++) {
              picked.push(arr[Math.floor(i * step)]);
            }
            return picked;
          })();
          entriesArr.forEach(entry => {
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
  }, [data, contentWidth, isAggregateMode, timeRange, dayWindowStart, dayWindowSize]);

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
      isEmpty?: boolean;
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
            color: energyToColor(avgEnergy, 1, isDark),
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
      const cnt = Number((b as any)?.count || 0);
      if (cnt <= 0) {
        const centerY = CHART_PADDING_TOP + CHART_CONTENT_HEIGHT / 2;
        bands.push({
          x,
          minY: centerY,
          maxY: centerY,
          avgY: centerY,
          date: (b as any)?.date,
          entries: [],
          color: '#9CA3AF',
          energyAvg: 0,
          isEmpty: true,
        });
        return;
      }
      // Guard against NaN values in IQR (treat as missing)
      const lowMood = Number.isFinite((b as any)?.mood?.p25)
        ? Number((b as any).mood.p25)
        : (Number.isFinite((b as any)?.mood?.min) ? Number((b as any).mood.min) : 0);
      const highMood = Number.isFinite((b as any)?.mood?.p75)
        ? Number((b as any).mood.p75)
        : (Number.isFinite((b as any)?.mood?.max) ? Number((b as any).mood.max) : 0);
      const minVal = moodToValence(lowMood);
      const maxVal = moodToValence(highMood);
      const rawCenter = (b as any)?.mood?.p50 ?? (b as any)?.avg ?? 0;
      const centerMood = Number.isFinite(rawCenter as any) ? Number(rawCenter) : 0;
      const avgVal = moodToValence(centerMood);
      const minY = CHART_PADDING_TOP + (1 - ((minVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      const maxY = CHART_PADDING_TOP + (1 - ((maxVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      const avgY = CHART_PADDING_TOP + (1 - ((avgVal + 1) / 2)) * CHART_CONTENT_HEIGHT;
      bands.push({
        x,
        minY: Math.min(minY, maxY),
        maxY: Math.max(minY, maxY),
        avgY,
        date: (b as any)?.date,
        entries: [],
        color: energyToColor((Number.isFinite((b as any)?.energy?.p50) ? Number((b as any).energy.p50) : 6), 1, isDark),
        energyAvg: Number.isFinite((b as any)?.energy?.p50) ? Number((b as any).energy.p50) : 6,
      });
    });
    return bands;
  }, [dataPoints, data.aggregated, contentWidth, isAggregateMode]);

  // Selected aggregate bucket date (for halo effect)
  const selectedAggDate = React.useMemo(() => {
    if (!isAggregateMode) return null as string | null;
    const items = (data.aggregated?.data || []) as any[];
    if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= items.length) return null;
    const sel = items[selectedIndex];
    return Number(sel?.count || 0) > 0 ? (sel?.date as string) : null;
  }, [isAggregateMode, data.aggregated, selectedIndex]);

  // X ekseni etiket gösterim mantığı
  const getXLabelVisibility = useCallback((index: number, total: number) => {
    if (timeRange === 'day') {
      const dw = contentWidth / Math.max(1, total);
      let step = 1;
      if (dw < 12) step = 4; // 0,4,8,12,16,20
      else if (dw < 18) step = 3; // 0,3,6,9,12,15,18,21
      else if (dw < 28) step = 2; // 0,2,4...
      else step = 1; // her saat
      return index % step === 0;
    }
    // Basit virtualization: etiketler arası min piksel mesafesi
    const minLabelPx = (timeRange === 'week')
      ? 18
      : (timeRange === 'month')
        ? 22
        : (timeRange === '6months')
          ? 28
          : 36; // year: daha seyrek etiket
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
                    strokeOpacity={isZeroLine ? 1 : 0.95}
                  />
                </G>
              );
            })}

            {/* Grid çizgileri (dikey) */}
            {(() => {
              const n = isAggregateMode
                ? (data.aggregated?.data?.length || 0)
                : (timeRange === 'day'
                    ? Math.min(dayWindowSize, (data.hourlyAverages || []).length)
                    : data.dailyAverages.length);
              const dayWidth = contentWidth / Math.max(1, n);
              const todayKey = getUserDateString(new Date());
              // Only highlight today's boundaries in weekly (daily) mode
              const todayIdx = isAggregateMode
                ? Number.NaN
                : (timeRange === 'day'
                    ? Number.NaN
                    : data.dailyAverages.findIndex(d => d.date === todayKey));
              const lines: any[] = [];
              const dayStep = (timeRange === 'day') ? ( (Math.min(dayWindowSize, 24) <= 8) ? 2 : 4 ) : 1;
              for (let i = 0; i <= n; i++) {
                if (timeRange === 'day') {
                  const absHour = dayWindowStart + i;
                  if (absHour % dayStep !== 0 && i !== 0 && i !== n) continue;
                }
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
                    strokeOpacity={isTodayBoundary ? 1 : 0.95}
                  />
                );
              }
              // Selected guide line - only if selected bucket has data
              if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex <= n - 1) {
                const hasData = (() => {
                  if (isAggregateMode) {
                    const b: any = (data.aggregated?.data || [])[selectedIndex];
                    return Number(b?.count || 0) > 0;
                  } else if (timeRange === 'day') {
                    const win = (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);
                    const it: any = { date: win[selectedIndex]?.dateKey };
                    const rp = (data as any).rawHourlyDataPoints?.[it.date]?.entries || [];
                    return rp.length > 0;
                  } else {
                    const d: any = data.dailyAverages[selectedIndex];
                    const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                    return rp.length > 0;
                  }
                })();
                if (hasData) {
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
                  band.isEmpty ? (
                    (() => {
                      const hasSelection = selectedIndex != null;
                      const isSelectedBand = !!selectedAggDate && band.date === selectedAggDate;
                      const op = hasSelection ? (isSelectedBand ? 0.55 : 0.25) : 0.55;
                      return (
                        <Circle cx={band.x} cy={band.avgY} r={2.6} fill={'#9CA3AF'} opacity={op}
                          stroke={isDark ? '#1F2937' : '#D1D5DB'} strokeWidth={0.6} />
                      );
                    })()
                  ) : (
                    (() => {
                      // 3 özet nokta: p25, p50, p75
                      const spreadPx = Math.abs(band.maxY - band.minY);
                      const s = Math.max(0, Math.min(1, spreadPx / CHART_CONTENT_HEIGHT));
                      const rCenter = DOT_TUNING.agg.rCenterMax - (DOT_TUNING.agg.rCenterMax - DOT_TUNING.agg.rCenterMin) * s;
                      const rSide = Math.max(DOT_TUNING.agg.rSideFloor, rCenter - DOT_TUNING.agg.rSideDelta);
                      const opCenterBase = DOT_TUNING.agg.opCenterMax - (DOT_TUNING.agg.opCenterMax - DOT_TUNING.agg.opCenterMin) * s;
                      const opSideBase = DOT_TUNING.agg.opSideMax - (DOT_TUNING.agg.opSideMax - DOT_TUNING.agg.opSideMin) * s;
                      const hasSelection = selectedIndex != null;
                      const isSelectedBand = !!selectedAggDate && band.date === selectedAggDate;
                      const opCenter = hasSelection ? (isSelectedBand ? opCenterBase : Math.max(0.2, opCenterBase * 0.45)) : opCenterBase;
                      const opSide = hasSelection ? (isSelectedBand ? opSideBase : Math.max(0.18, opSideBase * 0.45)) : opSideBase;
                      return (
                        <>
                          <Circle cx={band.x} cy={band.minY} r={rSide} fill={band.color} opacity={opSide}
                            stroke={isDark ? '#111827' : '#9CA3AF'} strokeWidth={0.6} />
                          {(() => {
                            const counts = (data.aggregated?.data || []).map((bb: any) => Number(bb?.count || 0));
                            const cMax = Math.max(1, ...counts);
                            const cThis = (() => {
                              const b = (data.aggregated?.data || []).find((bb: any) => bb.date === band.date) as any;
                              return Number(b?.count || 0);
                            })();
                            const sw = 0.6 + 1.4 * Math.sqrt(cThis / cMax);
                            return (
                              <>
                                {/* Hafif halo: seçiliyse daha geniş, değilse hafif */}
                                {isSelectedBand ? (
                                  <>
                                    <Circle cx={band.x} cy={band.avgY} r={rCenter + 4} fill={band.color} opacity={0.14} />
                                    <Circle cx={band.x} cy={band.avgY} r={rCenter + 7} fill={band.color} opacity={0.06} />
                                  </>
                                ) : (
                                  <Circle cx={band.x} cy={band.avgY} r={rCenter + 2.5} fill={band.color} opacity={0.08} />
                                )}
                                <Circle cx={band.x} cy={band.avgY} r={rCenter} fill={band.color} opacity={opCenter}
                                  stroke={isDark ? '#0B1220' : '#E5E7EB'} strokeWidth={Math.max(0.9, sw)} />
                              </>
                            );
                          })()}
                          <Circle cx={band.x} cy={band.maxY} r={rSide} fill={band.color} opacity={opSide}
                            stroke={isDark ? '#111827' : '#9CA3AF'} strokeWidth={0.6} />
                        </>
                      );
                    })()
                  )
                ) : null}
              </G>
            ))}

            {/* Aggregate modda outlier noktaları devre dışı */}

            {/* Veri noktaları - Apple Health tarzı (aggregate modda çizme) */}
            {!isAggregateMode && (() => {
              const baseItems: any[] = (timeRange === 'day'
                ? (((data.hourlyAverages || [])
                    .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                    .map((h: any) => ({ date: h.dateKey })) ) as any[])
                : data.dailyAverages);
              const n = baseItems.length;
              const dw = contentWidth / Math.max(1, n);
              const times = dataPoints.map(p => (p as any).ts || new Date(`${p.date}T00:00:00.000Z`).getTime());
              const minTs = times.length ? Math.min(...times) : 0;
              const maxTs = times.length ? Math.max(...times) : 1;
              const singleBucketDay = (timeRange === 'day')
                ? ((data.hourlyAverages || []).filter((h: any) => Number(h?.count || 0) > 0).length === 1)
                : false;
              return dataPoints.map((point: any, index) => {
                const r = DOT_RADIUS + (singleBucketDay ? 1 : 0);
                const outerR = r + 1.3; // keep ring proportional with smaller dots
                const alphaRaw = recencyAlpha(point.ts || new Date(`${point.date}T00:00:00.000Z`).getTime(), minTs, maxTs);
                const alpha = Math.max(0.8, alphaRaw); // boost minimum opacity for visibility
                const fill = energyToColor(point.energy, alpha, isDark);
                // Theme-aware ring and stroke colors for sharper edges
                const ringColor = isDark ? '#0E1525' : '#E5E7EB'; // soften in dark theme
                const strokeColor = isDark ? '#111827' : '#9CA3AF';
                // Jitter: Aynı gün içinde çakışmaları azaltmak için hafif X/Y sapma
                const dayIdx = Math.max(0, Math.min(n - 1, Math.floor((point.x - AXIS_WIDTH) / Math.max(1, dw))));
                const leftBound = AXIS_WIDTH + dayIdx * dw + DOT_TUNING.jitter.clampPaddingPx;
                const rightBound = AXIS_WIDTH + (dayIdx + 1) * dw - DOT_TUNING.jitter.clampPaddingPx;
                // Conditional jitter boost for dense days (same day multiple entries)
                const entriesCount = Array.isArray(point.entries) ? point.entries.length : (point.hasMultiple ? 2 : 1);
                // Piecewise yoğunluk eğrisi: 2 giriş hafif, 3 belirgin, 4+ agresif
                const denseFactor = point.hasMultiple
                  ? (entriesCount >= 5 ? 1.8 : entriesCount === 4 ? 1.65 : entriesCount === 3 ? 1.5 : 1.25)
                  : 1;
                const ampX = Math.min(dw * DOT_TUNING.jitter.xFactor * denseFactor, DOT_TUNING.jitter.xMaxPx * denseFactor);
                // Y ekseninde okuma bozulmasın diye artışı sınırlı tut
                const ampY = DOT_TUNING.jitter.yPx * (point.hasMultiple ? Math.min(denseFactor, 1.35) : 1);
                const { jx, jy } = point.hasMultiple ? jitterXY(`${point.date}-${point.mood}-${point.energy}-${index}`) : { jx: 0, jy: 0 } as any;
                const px = Math.max(leftBound, Math.min(rightBound, point.x + jx * ampX));
                const py = Math.max(CHART_PADDING_TOP + 2, Math.min(CHART_PADDING_TOP + CHART_CONTENT_HEIGHT - 2, point.y + jy * ampY));
                const hasSelection = selectedIndex != null;
                const isSelectedBucket = hasSelection && (dayIdx === (selectedIndex as number));
                const innerR = r + (isSelectedBucket ? 0.8 : 0);
                const outerROpacity = hasSelection ? (isSelectedBucket ? 1 : 0.45) : 1;
                const innerOpacity = hasSelection ? (isSelectedBucket ? 1 : 0.38) : 1;
                const innerFill = hasSelection ? (isSelectedBucket ? fill : (isDark ? '#6B7280' : '#D1D5DB')) : fill;
                const innerStroke = hasSelection ? (isSelectedBucket ? strokeColor : (isDark ? '#374151' : '#E5E7EB')) : strokeColor;
                return (
                  <G key={`point-${index}`}>
                    {/* Highlight halo when selected */}
                    {hasSelection && isSelectedBucket && (
                      <>
                        <Circle cx={px} cy={py} r={innerR + 2.4} fill={fill} opacity={0.12} />
                        <Circle cx={px} cy={py} r={innerR + 4.8} fill={fill} opacity={0.06} />
                      </>
                    )}
                    {/* Outer ring (light/dark theme aware) */}
                    <Circle cx={px} cy={py} r={outerR} fill={ringColor} opacity={outerROpacity} />
                    {/* Inner colored dot with thin stroke for crisp edge */}
                    <Circle cx={px} cy={py} r={innerR} fill={innerFill} opacity={innerOpacity} stroke={innerStroke} strokeWidth={0.7} />
                  </G>
                );
              });
            })()}

            {/* X ekseni etiketleri */}
            {(() => {
              const items = isAggregateMode
                ? (data.aggregated?.data || [])
                : (timeRange === 'day'
                    ? (((data.hourlyAverages || [])
                        .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                        .map((h: any) => ({ date: h.dateKey })) ) as any[])
                    : data.dailyAverages);
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
                    fontSize={timeRange === 'day' ? 10 : 11}
                    fill={isTodayLbl ? '#374151' : APPLE_COLORS.axisText}
                    textAnchor="middle"
                    fontWeight={isTodayLbl ? '600' : '400'}
                    letterSpacing={timeRange === 'day' ? -0.2 : undefined}
                  >
                    {formatXLabel(it)}
                  </SvgText>
                );
              });
            })()}
          </Svg>
          {/* Anxiety thin-line overlay (gap-aware) - weekly p50 */}
          {showAnxiety && timeRange === 'week' && !isAggregateMode && data.dailyAverages.length > 0 && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const basePts: string[] = [];
                const realSegments: string[][] = [];
                let seg: string[] = [];
                let realCount = 0;
                let singlePt: { x: number; y: number } | null = null;
                for (let index = 0; index < n; index++) {
                  const d = items[index];
                  const has = Number(d.count || 0) > 0;
                  const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                  let finalA = 5;
                  if (has) {
                    const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                    const anxRaw = rp.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
                    if (anxRaw.length > 0) {
                      // IMPROVED: Don't just accept all 5s as valid - derive from mood/energy if needed
                      if (anxRaw.every(v => v === 5)) {
                        // All entries are default 5 - derive from mood/energy pattern
                        const moodVals = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                        const energyVals = rp.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
                        if (moodVals.length > 0 && energyVals.length > 0) {
                          const avgMood = moodVals.reduce((s, v) => s + v, 0) / moodVals.length;
                          const avgEnergy = energyVals.reduce((s, v) => s + v, 0) / energyVals.length;
                          // IMPROVED FORMULA: High mood + low energy might be anxious, very low mood = anxious
                          const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10))); 
                          const e10 = Math.max(1, Math.min(10, Math.round(avgEnergy)));
                          // More nuanced anxiety estimation
                          if (m10 <= 3) finalA = 7; // Low mood = anxious
                          else if (m10 >= 8 && e10 <= 4) finalA = 6; // High mood but low energy = underlying anxiety
                          else if (m10 <= 5 && e10 >= 7) finalA = 8; // Low mood + high energy = agitated/anxious
                          else finalA = Math.max(2, Math.min(8, 6 - (m10 - 5))); // Inverse relationship to mood
                        } else {
                          finalA = 5; // True fallback only if no mood/energy data
                        }
                      } else {
                        finalA = quantiles(anxRaw).p50;
                      }
                    } else {
                      finalA = Number(d.averageAnxiety || 5);
                    }
                  }
                  const norm = Math.max(1, Math.min(10, Number(finalA || 5)));
                  const t = (norm - 1) / 9;
                  const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    basePts.push(`${x},${y}`);
                    if (has) {
                      seg.push(`${x},${y}`);
                      realCount++;
                      singlePt = { x, y };
                    } else if (seg.length) {
                      realSegments.push(seg); seg = [];
                    }
                  }
                }
                if (seg.length) realSegments.push(seg);
                const anxColor = isDark ? mixHex('#7C3AED', '#FFFFFF', 0.10) : mixHex('#7C3AED', '#000000', 0.08);
                const els: React.ReactNode[] = [];
                const hasSelection = selectedIndex != null;
                if (basePts.length > 1) {
                  els.push(
                    <Path key="week-anx-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                      stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                      strokeDasharray="6,4"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                realSegments.forEach((pts, i) => {
                  if (pts.length > 1) {
                    els.push(
                      <Path key={`week-anx-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.8}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                });
                // Highlight selected segment around selectedIndex
                if (hasSelection && basePts.length > 0) {
                  const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                  const segPts: string[] = [];
                  if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                  if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                  segPts.push(basePts[i]);
                  if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                  if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                  if (segPts.length >= 2) {
                    const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                    const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                    els.push(
                      <Path key={`week-anx-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={anxColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                }
                if (realCount === 1 && singlePt) {
                  const r = LINE_WIDTH + 1.5;
                  const mini = clamp(dw * MINI_SEGMENT_RATIO_WEEK, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                  els.push(
                    <G key="week-anx-sp">
                      <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                        stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                      <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={anxColor} opacity={0.9} />
                    </G>
                  );
                }
                return els;
              })()}
            </Svg>
          )}

          {/* Weekly p50 mood trend (accent), gap-aware */}
          {showMoodTrend && timeRange === 'week' && !isAggregateMode && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const basePts: string[] = [];
                const realSegments: string[][] = [];
                let seg: string[] = [];
                let realCount = 0;
                let singlePt: { x: number; y: number } | null = null;
                for (let index = 0; index < n; index++) {
                  const d = items[index] as any;
                  const has = Number(d.count || 0) > 0;
                  let finalM = 50;
                  if (has) {
                    const raw = (data.rawDataPoints[d.date]?.entries || []).map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                    if (raw.length > 0) {
                      const q = quantiles(raw);
                      finalM = Number.isFinite(q.p50 as any) ? Number(q.p50) : 50;
                    }
                  }
                  const v = moodToValence(finalM);
                  const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                  const x = AXIS_WIDTH + index * dw + dw / 2;
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    basePts.push(`${x},${y}`);
                    if (has) {
                      seg.push(`${x},${y}`);
                      realCount++;
                      singlePt = { x, y };
                    } else if (seg.length) {
                      realSegments.push(seg); seg = [];
                    }
                  }
                }
                if (seg.length) realSegments.push(seg);
                const els: React.ReactNode[] = [];
                const hasSelection = selectedIndex != null;
                if (basePts.length > 1) {
                  els.push(
                    <Path key="week-mood-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                      stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                      strokeDasharray="6,4"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                realSegments.forEach((pts, i) => {
                  if (pts.length > 1) {
                    els.push(
                      <Path key={`week-mood-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.8}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                });
                // Highlight
                if (hasSelection && basePts.length > 0) {
                  const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                  const segPts: string[] = [];
                  if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                  if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                  segPts.push(basePts[i]);
                  if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                  if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                  if (segPts.length >= 2) {
                    const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                    const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                    els.push(
                      <Path key={`week-mood-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={accentColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                }
                if (realCount === 1 && singlePt) {
                  const r = LINE_WIDTH + 1.5;
                  const mini = clamp(dw * MINI_SEGMENT_RATIO_WEEK, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                  els.push(
                    <G key="week-mood-sp">
                      <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                        stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                      <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={accentColor} opacity={0.9} />
                    </G>
                  );
                }
                return els;
              })()}
            </Svg>
          )}

          {/* Weekly energy thin-line overlay (gap-aware) - weekly p50 */}
          {showEnergy && timeRange === 'week' && !isAggregateMode && data.dailyAverages.length > 0 && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>{(() => {
              const items = data.dailyAverages;
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              const basePts: string[] = [];
              const realSegments: string[][] = [];
              let seg: string[] = [];
              let realCount = 0;
              let singlePt: { x: number; y: number } | null = null;
              for (let index = 0; index < n; index++) {
                const d = items[index] as any;
                const has = Number(d.count || 0) > 0;
                const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                
                // NEW UNIFIED SYSTEM: Always include all days with neutral fallback
                let finalE = 6; // Default neutral energy
                if (has) {
                  const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                  const eArr = rp.map((en: any) => Number(en.energy_level)).filter(Number.isFinite);
                  if (eArr.length > 0) {
                    finalE = quantiles(eArr).p50;
                  } else {
                    finalE = Number(d.averageEnergy || 6);
                  }
                }
                
                const norm = Math.max(1, Math.min(10, Number(finalE || 6)));
                const t = (norm - 1) / 9;
                const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                
                if (Number.isFinite(x) && Number.isFinite(y)) {
                  basePts.push(`${x},${y}`);
                  if (has) { seg.push(`${x},${y}`); realCount++; singlePt = { x, y }; }
                  else if (seg.length) { realSegments.push(seg); seg = []; }
                }
              }
              if (seg.length) realSegments.push(seg);
              const energyColor = isDark ? mixHex('#F59E0B', '#FFFFFF', 0.10) : mixHex('#F59E0B', '#000000', 0.08);
              const els: React.ReactNode[] = [];
              const hasSelection = selectedIndex != null;
              if (basePts.length > 1) {
                els.push(
                  <Path key="week-en-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                    stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                    strokeDasharray="6,4"
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                );
              }
              realSegments.forEach((pts, i) => {
                if (pts.length > 1) {
                  els.push(
                    <Path key={`week-en-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                      stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.8}
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
              });
              if (hasSelection && basePts.length > 0) {
                const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                const segPts: string[] = [];
                if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                segPts.push(basePts[i]);
                if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                if (segPts.length >= 2) {
                  const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                  const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                  els.push(
                      <Path key={`week-en-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={energyColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
              }
              if (realCount === 1 && singlePt) {
                const r = LINE_WIDTH + 1.5;
                const mini = clamp(dw * MINI_SEGMENT_RATIO_WEEK, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                els.push(
                  <G key="week-en-sp">
                    <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                      stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                    <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={energyColor} opacity={0.9} />
                  </G>
                );
              }
              return els;
            })()}</Svg>
          )}

          {/* Day view - Mood trend line */}
          {showMoodTrend && timeRange === 'day' && !isAggregateMode && data.hourlyAverages && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const basePts: string[] = [];
                const realSegments: string[][] = [];
                let seg: string[] = [];
                let realCount = 0;
                let singlePt: { x: number; y: number } | null = null;
                
                for (let index = 0; index < n; index++) {
                  const h = items[index] as any;
                  const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                  const has = rp.length > 0;
                  
                  // NEW UNIFIED SYSTEM: Always include all hours with neutral fallback
                  let finalM = 50; // Default neutral mood
                  if (has) {
                    const moodVals = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                    if (moodVals.length > 0) {
                      const q = quantiles(moodVals);
                      finalM = Number.isFinite(q.p50) ? Number(q.p50) : 50;
                    }
                  }
                  
                  const v = moodToValence(finalM);
                  const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                  const x = AXIS_WIDTH + index * dw + dw / 2;
                  
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    basePts.push(`${x},${y}`);
                    if (has) {
                      seg.push(`${x},${y}`);
                      realCount++;
                      singlePt = { x, y };
                    } else if (seg.length) {
                      realSegments.push(seg);
                      seg = [];
                    }
                  }
                }
                
                if (seg.length) realSegments.push(seg);
                const els: React.ReactNode[] = [];
                const hasSelection = selectedIndex != null;
                // Base line (all points including neutral) - dashed
                if (basePts.length > 1) {
                  els.push(
                    <Path key="day-mood-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                      stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                      strokeDasharray="6,4"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                
                // Real data segments - solid
                realSegments.forEach((pts, i) => {
                  if (pts.length > 1) {
                    els.push(
                      <Path key={`day-mood-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                });
                // Highlight selected
                if (hasSelection && basePts.length > 0) {
                  const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                  const segPts: string[] = [];
                  if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                  if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                  segPts.push(basePts[i]);
                  if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                  if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                  if (segPts.length >= 2) {
                    const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                    const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                    els.push(
                      <Path key={`day-mood-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={accentColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                }
                
                // Single point emphasis
                if (realCount === 1 && singlePt) {
                  const r = LINE_WIDTH + 1.5;
                  const mini = clamp(dw * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                  els.push(
                    <G key="day-mood-sp">
                      <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                        stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.9} strokeLinecap="round" />
                      <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={accentColor} opacity={0.9} />
                    </G>
                  );
                }
                
                return els;
              })()}
            </Svg>
          )}

          {/* Day view - Energy line */}
          {showEnergy && timeRange === 'day' && !isAggregateMode && data.hourlyAverages && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const basePts: string[] = [];
                const realSegments: string[][] = [];
                let seg: string[] = [];
                let realCount = 0;
                let singlePt: { x: number; y: number } | null = null;
                
                for (let index = 0; index < n; index++) {
                  const h = items[index] as any;
                  const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                  const has = rp.length > 0;
                  
                  // NEW UNIFIED SYSTEM: Always include all hours with neutral fallback
                  let finalE = 6; // Default neutral energy
                  if (has) {
                    const energyVals = rp.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
                    if (energyVals.length > 0) {
                      finalE = quantiles(energyVals).p50;
                    }
                  }
                  
                  const norm = Math.max(1, Math.min(10, Number(finalE || 6)));
                  const t = (norm - 1) / 9;
                  const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                  const x = AXIS_WIDTH + index * dw + dw / 2;
                  
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    basePts.push(`${x},${y}`);
                    if (has) {
                      seg.push(`${x},${y}`);
                      realCount++;
                      singlePt = { x, y };
                    } else if (seg.length) {
                      realSegments.push(seg);
                      seg = [];
                    }
                  }
                }
                
                if (seg.length) realSegments.push(seg);
                const energyColor = isDark ? mixHex('#F59E0B', '#FFFFFF', 0.10) : mixHex('#F59E0B', '#000000', 0.08);
                const els: React.ReactNode[] = [];
                const hasSelection = selectedIndex != null;
                // Base line (all points including neutral) - dashed
                if (basePts.length > 1) {
                  els.push(
                    <Path key="day-energy-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                      stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                      strokeDasharray="6,4"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                
                // Real data segments - solid
                realSegments.forEach((pts, i) => {
                  if (pts.length > 1) {
                    els.push(
                      <Path key={`day-energy-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                });
                // Highlight selected
                if (hasSelection && basePts.length > 0) {
                  const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                  const segPts: string[] = [];
                  if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                  if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                  segPts.push(basePts[i]);
                  if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                  if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                  if (segPts.length >= 2) {
                    const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                    const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                    els.push(
                      <Path key={`day-energy-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={energyColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                }
                
                // Single point emphasis
                if (realCount === 1 && singlePt) {
                  const r = LINE_WIDTH + 1.5;
                  const mini = clamp(dw * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                  els.push(
                    <G key="day-energy-sp">
                      <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                        stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.9} strokeLinecap="round" />
                      <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={energyColor} opacity={0.9} />
                    </G>
                  );
                }
                
                return els;
              })()}
            </Svg>
          )}

          {/* Day view - Anxiety line - RESTORED: New unified system with base/real separation */}
          {showAnxiety && timeRange === 'day' && !isAggregateMode && data.hourlyAverages && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const basePts: string[] = [];
                const realSegments: string[][] = [];
                let seg: string[] = [];
                let realCount = 0;
                let singlePt: { x: number; y: number } | null = null;
                
                for (let index = 0; index < n; index++) {
                  const h = items[index] as any;
                  const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                  const has = rp.length > 0;
                  
                  // IMPROVED: Smart anxiety calculation with mood/energy derivation
                  let finalA = 5; // Default neutral anxiety
                  if (has) {
                    const anxVals = rp.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
                    if (anxVals.length > 0) {
                      // Check if all anxiety values are default 5 (fallback values)
                      if (anxVals.every(v => v === 5)) {
                        // Derive from mood/energy if available
                        const moodVals = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                        const energyVals = rp.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
                        if (moodVals.length > 0 && energyVals.length > 0) {
                          const avgMood = moodVals.reduce((s, v) => s + v, 0) / moodVals.length;
                          const avgEnergy = energyVals.reduce((s, v) => s + v, 0) / energyVals.length;
                          const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10))); 
                          const e10 = Math.max(1, Math.min(10, Math.round(avgEnergy)));
                          // Smart anxiety derivation
                          if (m10 <= 3) finalA = 7; // Low mood = anxious
                          else if (m10 >= 8 && e10 <= 4) finalA = 6; // High mood + low energy = underlying anxiety
                          else if (m10 <= 5 && e10 >= 7) finalA = 8; // Low mood + high energy = agitated
                          else finalA = Math.max(2, Math.min(8, 6 - (m10 - 5))); // Inverse mood relationship
                        } else {
                          finalA = 5; // True fallback
                        }
                      } else {
                        finalA = quantiles(anxVals).p50;
                      }
                    }
                  }
                  
                  const norm = Math.max(1, Math.min(10, Number(finalA || 5)));
                  const t = (norm - 1) / 9; // 0..1 -> top low anxiety
                  const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                  const x = AXIS_WIDTH + index * dw + dw / 2;
                  
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    basePts.push(`${x},${y}`);
                    if (has) {
                      seg.push(`${x},${y}`);
                      realCount++;
                      singlePt = { x, y };
                    } else if (seg.length) {
                      realSegments.push(seg);
                      seg = [];
                    }
                  }
                }
                
                if (seg.length) realSegments.push(seg);
                const anxColor = isDark ? mixHex('#7C3AED', '#FFFFFF', 0.10) : mixHex('#7C3AED', '#000000', 0.08);
                const els: React.ReactNode[] = [];
                const hasSelection = selectedIndex != null;
                // Base line (all points including neutral) - dashed
                if (basePts.length > 1) {
                  els.push(
                    <Path key="day-anxiety-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                      stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.3}
                      strokeDasharray="6,4"
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                
                // Real data segments - solid
                realSegments.forEach((pts, i) => {
                  if (pts.length > 1) {
                    els.push(
                      <Path key={`day-anxiety-real-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                });
                // Highlight selected
                if (hasSelection && basePts.length > 0) {
                  const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                  const segPts: string[] = [];
                  if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                  if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                  segPts.push(basePts[i]);
                  if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                  if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                  if (segPts.length >= 2) {
                    const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                    const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                    els.push(
                      <Path key={`day-anx-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                        stroke={anxColor} strokeWidth={hiW} strokeOpacity={0.9}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    );
                  }
                }
                
                // Single point emphasis
                if (realCount === 1 && singlePt) {
                  const r = LINE_WIDTH + 1.5;
                  const mini = clamp(dw * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX);
                  els.push(
                    <G key="day-anxiety-sp">
                      <Line x1={singlePt.x - mini} y1={singlePt.y} x2={singlePt.x + mini} y2={singlePt.y}
                        stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.9} strokeLinecap="round" />
                      <Circle cx={singlePt.x} cy={singlePt.y} r={r} fill={anxColor} opacity={0.9} />
                    </G>
                  );
                }
                
                return els;
              })()}
            </Svg>
          )}

          {/* Aggregate overlays (month, 6months, year): p50 lines across buckets */}
          {(() => {
            // NUCLEAR FIX: Strict granularity filtering to eliminate ALL double lines
            const shouldRenderAggregateLines = (() => {
              if (!isAggregateMode || !data.aggregated || (data.aggregated.data?.length || 0) === 0) return false;
              
              const granularity = data.aggregated.granularity;
              
              // STRICT: Only exact matches to prevent any cross-contamination
              if (timeRange === 'month' && granularity === 'week') return true;
              if (timeRange === '6months' && granularity === 'month') return true; 
              if (timeRange === 'year' && granularity === 'month') return true;
              
              return false;
            })();
            
            return shouldRenderAggregateLines;
          })() && (
            <>
              {/* Mood (accent gradient) */}
              {showMoodTrend && (
                <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                  {(() => {
                    const items = (data.aggregated?.data || []) as any[];
                    const n = items.length;
                    const dw = contentWidth / Math.max(1, n);
                    const basePts: string[] = [];
                    const realSegs: string[][] = [];
                    let seg: string[] = [];
                    let realCount = 0;
                    let singlePt: { x: number; y: number } | null = null;
                    for (let i = 0; i < n; i++) {
                      const b: any = items[i];
                      const has = Number(b?.count || 0) > 0;
                      const mRaw = (b?.mood?.p50 ?? b?.avg ?? 0) as number;
                      let finalM = Number.isFinite(mRaw) ? Number(mRaw) : 50;
                      if (!has) finalM = 50;
                      const v = moodToValence(finalM);
                      const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                      const x = AXIS_WIDTH + i * dw + dw / 2;
                      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                      basePts.push(`${x},${y}`);
                      if (has) { seg.push(`${x},${y}`); realCount++; singlePt = { x, y }; }
                      else if (seg.length) { realSegs.push(seg); seg = []; }
                    }
                    if (seg.length) realSegs.push(seg);
                    // solid lines only; removed dash pattern and dynamic width
                    const hasSelection = selectedIndex != null;
                    return (
                      <>
                        <Defs>
                          <LinearGradient id="aggMoodGrad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0%" stopColor={accentColor} stopOpacity={0.6} />
                            <Stop offset="15%" stopColor={accentColor} stopOpacity={0.9} />
                            <Stop offset="85%" stopColor={accentColor} stopOpacity={0.9} />
                            <Stop offset="100%" stopColor={accentColor} stopOpacity={0.6} />
                          </LinearGradient>
                        </Defs>
                        {basePts.length > 1 && (
                          <Path key="agg-mood-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                            stroke={(timeRange === 'month' || timeRange === '6months' || timeRange === 'year') ? accentColor : "url(#aggMoodGrad)"}
                            strokeWidth={LINE_WIDTH} strokeOpacity={0.4}
                            fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {realSegs.map((pts, i) => {
                          const dPath = safePathD(pts);
                          return dPath ? (
                            <Path key={`am-real-${i}`} d={dPath}
                              stroke={(timeRange === 'month' || timeRange === '6months' || timeRange === 'year') ? accentColor : "url(#aggMoodGrad)"}
                              strokeWidth={LINE_WIDTH}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeOpacity={hasSelection ? 0.4 : 0.8} />
                          ) : null;
                        })}
                        {hasSelection && basePts.length > 0 && (() => {
                          const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                          const segPts: string[] = [];
                          if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                          if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                          if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                          if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                          segPts.push(basePts[i]);
                          if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                          if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                          if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                          if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                          if (segPts.length >= 2) {
                            const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                            const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                            return (
                              <Path key={`agg-mood-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                                stroke={(timeRange === 'month' || timeRange === '6months' || timeRange === 'year') ? accentColor : "url(#aggMoodGrad)"}
                                strokeWidth={hiW}
                                strokeOpacity={0.9}
                                fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            );
                          }
                          return null;
                        })()}
                        {realCount === 1 && singlePt && (
                          <G key="agg-mood-sp">
                            <Line x1={singlePt.x - clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={singlePt.y} x2={singlePt.x + clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={singlePt.y}
                              stroke={(timeRange === 'month' || timeRange === '6months' || timeRange === 'year') ? accentColor : mixHex(accentColor, isDark ? '#FFFFFF' : '#000000', isDark ? 0.15 : 0.12)}
                              strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                            <Circle cx={singlePt.x} cy={singlePt.y} r={LINE_WIDTH + 1.5}
                              fill={(timeRange === 'month' || timeRange === '6months' || timeRange === 'year') ? accentColor : mixHex(accentColor, isDark ? '#FFFFFF' : '#000000', isDark ? 0.15 : 0.12)} opacity={0.9} />
                          </G>
                        )}
                      </>
                    );
                  })()}
                </Svg>
              )}

              {/* Energy (orange) */}
              {showEnergy && (
                <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                  {(() => {
                    const items = (data.aggregated?.data || []) as any[];
                    const n = items.length;
                    const dw = contentWidth / Math.max(1, n);
                    const basePts: string[] = [];
                    const realSegs: string[][] = [];
                    let seg: string[] = [];
                    let realCount = 0;
                    let singlePt: { x: number; y: number } | null = null;
                    for (let i = 0; i < n; i++) {
                      const b: any = items[i];
                      const has = Number(b?.count || 0) > 0;
                      
                      let en = Number.isFinite(Number(b?.energy?.p50)) ? Number(b.energy.p50) : 6;
                      if (!has) en = 6;
                      const t = (Math.max(1, Math.min(10, en)) - 1) / 9;
                      const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                      const x = AXIS_WIDTH + i * dw + dw / 2;
                      if (!Number.isFinite(x) || !Number.isFinite(y)) { continue; }
                      basePts.push(`${x},${y}`);
                      if (has) { seg.push(`${x},${y}`); realCount++; singlePt = { x, y }; }
                      else if (seg.length) { realSegs.push(seg); seg = []; }
                    }
                    if (seg.length) realSegs.push(seg);
                    const energyColor = isDark ? mixHex('#F59E0B', '#FFFFFF', 0.10) : mixHex('#F59E0B', '#000000', 0.08);
                    const hasSelection = selectedIndex != null;
                    return (
                      <>
                        {basePts.length > 1 && (
                          <Path key="agg-en-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                            stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.4}
                            fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {realSegs.map((pts, i) => {
                          const dPath = safePathD(pts);
                          return dPath ? (
                            <Path key={`ae-real-${i}`} d={dPath} stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.8}
                              fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          ) : null;
                        })}
                        {hasSelection && basePts.length > 0 && (() => {
                          const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                          const segPts: string[] = [];
                          if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                          if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                          segPts.push(basePts[i]);
                          if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                          if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                          if (segPts.length >= 2) {
                            const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                            const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                            return (
                              <Path key={`agg-en-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                                stroke={energyColor} strokeWidth={hiW} strokeOpacity={0.9}
                                fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            );
                          }
                          return null;
                        })()}
                        {realCount === 1 && singlePt && (
                          <G key="agg-en-sp">
                            <Line x1={singlePt.x - clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={singlePt.y} x2={singlePt.x + clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={singlePt.y}
                              stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                            <Circle cx={singlePt.x} cy={singlePt.y} r={LINE_WIDTH + 1.5} fill={energyColor} opacity={0.9} />
                          </G>
                        )}
                      </>
                    );
                  })()}
                </Svg>
              )}

              {/* Anxiety (purple) with fallback when flat 5 */}
              {showAnxiety && (
                <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                  {(() => {
                    const items = (data.aggregated?.data || []) as any[];
                    const n = items.length;
                    const dw = contentWidth / Math.max(1, n);
                    const basePts: string[] = [];
                    const realSegs: string[][] = [];
                    let seg: string[] = [];
                    let realCount = 0;
                    let singlePt: { x: number; y: number } | null = null;
                    for (let i = 0; i < n; i++) {
                      const b: any = items[i];
                      const has = Number(b?.count || 0) > 0;
                                             let a = 5; // Default neutral
                       if (has) {
                         if (Number.isFinite(Number(b?.anxiety?.p50))) {
                           const anxP50 = Number(b.anxiety.p50);
                           // Check if this is likely a fallback value (exactly 5)
                           if (anxP50 === 5 && Number(b?.mood?.p50) !== 50) {
                             // Derive from mood/energy buckets
                             const moodP50 = Number(b?.mood?.p50 || 50);
                             const energyP50 = Number(b?.energy?.p50 || 60);
                             const m10 = Math.max(1, Math.min(10, Math.round(moodP50 / 10)));
                             const e10 = Math.max(1, Math.min(10, Math.round(energyP50 / 10)));
                             // Smart anxiety derivation from aggregated data
                             if (m10 <= 3) a = 7;
                             else if (m10 >= 8 && e10 <= 4) a = 6;
                             else if (m10 <= 5 && e10 >= 7) a = 8;
                             else a = Math.max(2, Math.min(8, 6 - (m10 - 5)));
                           } else {
                             a = anxP50; // Use actual p50
                           }
                         } else {
                           a = Number(b?.averageAnxiety || 5);
                         }
                       }
                      const norm = Math.max(1, Math.min(10, Number(a || 0)));
                      const t = (norm - 1) / 9;
                      const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                      const x = AXIS_WIDTH + i * dw + dw / 2;
                      if (!Number.isFinite(x) || !Number.isFinite(y)) { continue; }
                      basePts.push(`${x},${y}`);
                      if (has) { seg.push(`${x},${y}`); realCount++; singlePt = { x, y }; }
                      else if (seg.length) { realSegs.push(seg); seg = []; }
                    }
                    if (seg.length) realSegs.push(seg);
                    const anxColor = isDark ? mixHex('#7C3AED', '#FFFFFF', 0.10) : mixHex('#7C3AED', '#000000', 0.08);
                    const hasSelection = selectedIndex != null;
                    return (
                      <>
                        {basePts.length > 1 && (
                          <Path key="agg-anx-base" d={`M ${basePts[0]} L ${basePts.slice(1).join(' L ')}`}
                            stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.4}
                            fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                        {realSegs.map((pts, i) => {
                          const dPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
                          return pts.length > 1 ? (
                            <Path key={`aa-real-${i}`} d={dPath}
                              stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={hasSelection ? 0.4 : 0.8}
                              fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          ) : null;
                        })}
                        {hasSelection && basePts.length > 0 && (() => {
                          const i = Math.max(0, Math.min(basePts.length - 1, selectedIndex as number));
                          const segPts: string[] = [];
                          if (i - 2 >= 0) segPts.push(basePts[i - 2]);
                          if (i - 1 >= 0) segPts.push(basePts[i - 1]);
                          segPts.push(basePts[i]);
                          if (i + 1 < basePts.length) segPts.push(basePts[i + 1]);
                          if (i + 2 < basePts.length) segPts.push(basePts[i + 2]);
                          if (segPts.length >= 2) {
                            const pxR = (PixelRatio && typeof PixelRatio.get === 'function') ? PixelRatio.get() : 2;
                            const hiW = Math.min(LINE_WIDTH * 1.6, Math.max(LINE_WIDTH * 1.1, LINE_WIDTH + (dw * 0.06) * (pxR >= 3 ? 1.05 : 1)));
                            return (
                              <Path key={`agg-anx-hi-${i}`} d={`M ${segPts[0]} L ${segPts.slice(1).join(' L ')}`}
                                stroke={anxColor} strokeWidth={hiW} strokeOpacity={0.9}
                                fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            );
                          }
                          return null;
                        })()}
                        {realCount === 1 && singlePt && (
                          <G key="agg-anx-sp">
                            <Line x1={singlePt.x - clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={singlePt.y} x2={singlePt.x + clamp(dw * MINI_SEGMENT_RATIO_AGG, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={singlePt.y}
                              stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                            <Circle cx={singlePt.x} cy={singlePt.y} r={LINE_WIDTH + 1.5} fill={anxColor} opacity={0.9} />
                          </G>
                        )}
                      </>
                    );
                  })()}
                </Svg>
              )}
            </>
          )}

          {/* Day mode overlays: p50 per visible hour across the day */}
          {timeRange === 'day' && (() => {
            const n = nVisible;
            if (n <= 1) return null;
            const dw = dwVisible;
            const dwWindow = contentWidth / Math.max(1, dayWindowSize);
            const allHours = (data.hourlyAverages || []) as any[];
            // Mood p50 line (accent)
            const moodPath = (() => {
              const segs: string[][] = [];
              let seg: string[] = [];
              for (let i = 0; i < n; i++) {
                const h = visibleHours[i] as any; // { dateKey }
                const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                const moods = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                if (!rp.length || moods.length === 0) {
                  if (seg.length) { segs.push(seg); seg = []; }
                  continue;
                }
                const q = quantiles(moods);
                const m = Number.isFinite(q.p50 as any) ? Number(q.p50) : 0;
                const v = moodToValence(m);
                const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                const x = AXIS_WIDTH + i * dw + dw / 2;
                seg.push(`${x},${y}`);
              }
              if (seg.length) segs.push(seg);
              return segs;
            })();
            // Energy p50 line (orange)
            const energyPath = (() => {
              const segs: string[][] = [];
              let seg: string[] = [];
              for (let i = 0; i < n; i++) {
                const h = visibleHours[i] as any;
                const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                const arr = rp.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
                if (!arr.length) { if (seg.length) { segs.push(seg); seg = []; } continue; }
                const q = quantiles(arr);
                const val = Number.isFinite(q.p50 as any) ? Number(q.p50) : 0;
                const norm = Math.max(1, Math.min(10, Number(val || 0)));
                const t = (norm - 1) / 9;
                const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                const x = AXIS_WIDTH + i * dw + dw / 2;
                seg.push(`${x},${y}`);
              }
              if (seg.length) segs.push(seg);
              return segs;
            })();
            // Anxiety p50 line (purple) - IMPROVED with smart derivation
            const anxPath = (() => {
              const segs: string[][] = [];
              let seg: string[] = [];
              for (let i = 0; i < n; i++) {
                const h = visibleHours[i] as any;
                const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                
                // IMPROVED: Smart anxiety calculation with mood/energy derivation
                let finalA = 5; // Default neutral
                if (rp.length > 0) {
                  const anxVals = rp.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
                  if (anxVals.length > 0) {
                    if (anxVals.every(v => v === 5)) {
                      // Derive from mood/energy
                      const moodVals = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                      const energyVals = rp.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
                      if (moodVals.length > 0 && energyVals.length > 0) {
                        const avgMood = moodVals.reduce((s, v) => s + v, 0) / moodVals.length;
                        const avgEnergy = energyVals.reduce((s, v) => s + v, 0) / energyVals.length;
                        const m10 = Math.max(1, Math.min(10, Math.round(avgMood / 10))); 
                        const e10 = Math.max(1, Math.min(10, Math.round(avgEnergy)));
                        if (m10 <= 3) finalA = 7;
                        else if (m10 >= 8 && e10 <= 4) finalA = 6;
                        else if (m10 <= 5 && e10 >= 7) finalA = 8;
                        else if (m10 >= 7 && e10 >= 7) finalA = 4;
                        else finalA = Math.max(2, Math.min(8, 6 - (m10 - 5)));
                      }
                    } else {
                      finalA = quantiles(anxVals).p50;
                    }
                  }
                }
                
                const norm = Math.max(1, Math.min(10, Number(finalA || 5)));
                const t = (norm - 1) / 9;
                const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                const x = AXIS_WIDTH + i * dw + dw / 2;
                seg.push(`${x},${y}`);
              }
              if (seg.length) segs.push(seg);
              return segs;
            })();
            // solid lines only; removed dash pattern and dynamic width
            const energyColor = isDark ? mixHex('#F59E0B', '#FFFFFF', 0.10) : mixHex('#F59E0B', '#000000', 0.08);
            const anxColor = isDark ? mixHex('#7C3AED', '#FFFFFF', 0.10) : mixHex('#7C3AED', '#000000', 0.08);
            // Base full-day paths (faint), map hours 0..23 relative to current window
            const hasStrongMood = moodPath.some(seg => seg.length > 1);
            const hasStrongEn = energyPath.some(seg => seg.length > 1);
            const hasStrongAnx = anxPath.some(seg => seg.length > 1);
            const buildFullDaySegs = (kind: 'mood'|'energy'|'anxiety') => {
              const segs: string[][] = [];
              let seg: string[] = [];
              for (let i = 0; i < allHours.length; i++) {
                const h: any = allHours[i];
                const hk = String(h?.dateKey || '');
                const hh = hk.includes('#') ? parseInt(hk.split('#')[1] || '0', 10) : i;
                // Skip inside window only if we already have a strong line; otherwise include faint
                const skipInside = (kind === 'mood' ? hasStrongMood : kind === 'energy' ? hasStrongEn : hasStrongAnx);
                if (skipInside && hh >= dayWindowStart && hh < dayWindowStart + dayWindowSize) {
                  if (seg.length) { segs.push(seg); seg = []; }
                  continue;
                }
                const rp = (data as any).rawHourlyDataPoints?.[h.dateKey]?.entries || [];
                const arr = rp.map((e: any) => {
                  if (kind === 'mood') return Number(e.mood_score);
                  if (kind === 'energy') return Number(e.energy_level);
                  return Number(e.anxiety_level);
                }).filter(Number.isFinite);
                if (!arr.length) { if (seg.length) { segs.push(seg); seg = []; } continue; }
                const q = quantiles(arr);
                const val = Number.isFinite(q.p50 as any) ? Number(q.p50) : 0;
                let y: number;
                if (kind === 'mood') {
                  const v = moodToValence(val);
                  y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                } else {
                  const norm = Math.max(1, Math.min(10, Number(val || 0)));
                  const t = (norm - 1) / 9;
                  y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                }
                const x = AXIS_WIDTH + ((hh - dayWindowStart + 0.5) * dwWindow);
                seg.push(`${x},${y}`);
              }
              if (seg.length) segs.push(seg);
              return segs;
            };
            const baseMood = buildFullDaySegs('mood');
            const baseEn = buildFullDaySegs('energy');
            const baseAnx = buildFullDaySegs('anxiety');
            return (
              <>
                {/* Base full-day faint lines for context */}
                {showMoodTrend && (
                  <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {baseMood.map((pts, i) => (
                      pts.length > 1 ? (
                        <Path key={`fdm-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                          stroke={accentColor} strokeWidth={0.8} strokeOpacity={0.14}
                          fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      ) : null
                    ))}
                  </Svg>
                )}
                <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                  {baseEn.map((pts, i) => (
                    pts.length > 1 ? (
                      <Path key={`fde-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={energyColor} strokeWidth={0.8} strokeOpacity={0.14}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ) : null
                  ))}
                </Svg>
                <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                  {baseAnx.map((pts, i) => (
                    pts.length > 1 ? (
                      <Path key={`fda-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                        stroke={anxColor} strokeWidth={0.8} strokeOpacity={0.12}
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ) : null
                  ))}
                </Svg>
                {/* Mood (accent) */}
                {showMoodTrend && (
                  <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                    <Defs>
                      <LinearGradient id="dayTrendGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={0.6} />
                        <Stop offset="15%" stopColor={accentColor} stopOpacity={0.9} />
                        <Stop offset="85%" stopColor={accentColor} stopOpacity={0.9} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={0.6} />
                      </LinearGradient>
                    </Defs>
                    {moodPath.map((pts, i) => {
                      const dPath = safePathD(pts);
                      return dPath ? (
                        <Path key={`dm-${i}`} d={dPath}
                          stroke="url(#dayTrendGrad)" strokeWidth={LINE_WIDTH} strokeOpacity={0.8} fill="none"
                          strokeLinecap="round" strokeLinejoin="round" />
                      ) : null;
                    })}
                  </Svg>
                )}
                {showMoodTrend && (() => {
                  const totalPts = moodPath.reduce((s, seg) => s + seg.length, 0);
                  if (totalPts !== 1) return null;
                  const [only] = moodPath.find(seg => seg.length === 1) || [] as any;
                  if (!only) return null;
                  const [sx, sy] = String(only).split(',').map(Number);
                  const mini = Math.max(6, dwVisible * 0.3);
                  const r = LINE_WIDTH + 1.5;
                  return (
                    <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <Line x1={sx - clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={sy} x2={sx + clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={sy} stroke={accentColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                      <Circle cx={sx} cy={sy} r={r} fill={accentColor} opacity={0.9} />
                    </Svg>
                  );
                })()}
                {/* Energy (orange) */}
                {showEnergy && (
                  <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {energyPath.map((pts, i) => {
                      const dPath = safePathD(pts);
                      return dPath ? (
                        <Path key={`de-${i}`} d={dPath}
                          stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8}
                          fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      ) : null;
                    })}
                  </Svg>
                )}
                {showEnergy && (() => {
                  const totalPts = energyPath.reduce((s, seg) => s + seg.length, 0);
                  if (totalPts !== 1) return null;
                  const [only] = energyPath.find(seg => seg.length === 1) || [] as any;
                  if (!only) return null;
                  const [sx, sy] = String(only).split(',').map(Number);
                  const mini = Math.max(6, dwVisible * 0.3);
                  const r = LINE_WIDTH + 1.5;
                  return (
                    <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <Line x1={sx - clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={sy} x2={sx + clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={sy} stroke={energyColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                      <Circle cx={sx} cy={sy} r={r} fill={energyColor} opacity={0.9} />
                    </Svg>
                  );
                })()}
                {/* DISABLED: OLD Anxiety overlay - replaced by improved system above */}
                {false && showAnxiety && (
                  <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                    {anxPath.map((pts, i) => {
                      const dPath = safePathD(pts);
                      return dPath ? (
                        <Path key={`da-${i}`} d={dPath}
                          stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8}
                          fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      ) : null;
                    })}
                  </Svg>
                )}
                {/* DISABLED: OLD anxiety single point - replaced by improved system above */}
                {false && showAnxiety && (() => {
                  const totalPts = anxPath.reduce((s, seg) => s + seg.length, 0);
                  if (totalPts !== 1) return null;
                  const [only] = anxPath.find(seg => seg.length === 1) || [] as any;
                  if (!only) return null;
                  const [sx, sy] = String(only).split(',').map(Number);
                  const mini = Math.max(6, dwVisible * 0.3);
                  const r = LINE_WIDTH + 1.5;
                  return (
                    <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <Line x1={sx - clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y1={sy} x2={sx + clamp(dwVisible * MINI_SEGMENT_RATIO_DAY, MINI_SEGMENT_MIN_PX, MINI_SEGMENT_MAX_PX)} y2={sy} stroke={anxColor} strokeWidth={LINE_WIDTH} strokeOpacity={0.8} strokeLinecap="round" />
                      <Circle cx={sx} cy={sy} r={r} fill={anxColor} opacity={0.9} />
                    </Svg>
                  );
                })()}
              </>
            );
          })()}

          {/* Dokunmatik alanlar */}
          <View 
            style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]} 
            pointerEvents="box-none"
          >
            {(() => {
              const items = isAggregateMode
                ? (data.aggregated?.data || [])
                : (timeRange === 'day'
                    ? (((data.hourlyAverages || [])
                        .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                        .map((h: any) => ({ date: h.dateKey })) ) as any[])
                    : data.dailyAverages);
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              const hasDataAt = (idx: number) => {
                if (idx < 0 || idx >= n) return false;
                if (isAggregateMode) {
                  const b: any = items[idx];
                  return Number(b?.count || 0) > 0;
                } else if (timeRange === 'day') {
                  const it: any = items[idx];
                  const rp = (data as any).rawHourlyDataPoints?.[it.date]?.entries || [];
                  return rp.length > 0;
                } else {
                  const d: any = items[idx];
                  const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                  return rp.length > 0;
                }
              };
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
                      const valid = hasDataAt(index);
                      if (!valid) {
                        // Clicking an empty bucket closes any open tooltip and removes guide
                        setSelectedIndex(null);
                        emitSelection(null as any);
                        return;
                      }
                      // Toggle if same index; switch directly if different
                      setSelectedIndex(prev => {
                        const next = prev === index ? null : index;
                        emitSelection(next as any);
                        return next as any;
                      });
                    }}
                    testID={`mood-bar-${index}`}
                  />
                );
              });
            })()}
            {/* Removed deprecated dashed aggregate trend blocks */}
            {/* Scrub overlay (gesture-handler): pan to scrub, pinch to zoom (Day) */}
            <PinchGestureHandler
              onGestureEvent={(e) => {
                if (timeRange !== 'day') return;
                const scale = (e.nativeEvent as any).scale || 1;
                if (!pinchAppliedRef.current && (scale > 1.08 || scale < 0.92)) {
                  const zoomOut = scale > 1.08;
                  const center = dayWindowStart + dayWindowSize / 2;
                  const step = 2;
                  const nextSize = Math.max(DAY_WINDOW_MIN, Math.min(DAY_WINDOW_MAX, dayWindowSize + (zoomOut ? step : -step)));
                  const nextStart = Math.max(0, Math.min(24 - nextSize, Math.round(center - nextSize / 2)));
                  setDayWindowSize(nextSize);
                  setDayWindowStart(nextStart);
                  setSelectedIndex(null);
                  emitSelection(null);
                  pinchAppliedRef.current = true;
                }
              }}
              onEnded={() => { pinchInitDistRef.current = null; pinchAppliedRef.current = false; }}
            >
              <PanGestureHandler
                onHandlerStateChange={(e) => {
                  const state: any = (e.nativeEvent as any).state;
                  if (state !== 4 /* ACTIVE */ && state !== 5 /* END */) return;
                  const x = (e.nativeEvent as any).x ?? ((e.nativeEvent as any).absoluteX ?? 0);
                  const items = isAggregateMode
                    ? (data.aggregated?.data || [])
                    : (timeRange === 'day'
                        ? (((data.hourlyAverages || [])
                            .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                            .map((h: any) => ({ date: h.dateKey })) ) as any[])
                        : data.dailyAverages);
                  const n = items.length;
                  if (n === 0) return;
                  const dw = contentWidth / Math.max(1, n);
                  let idx = Math.floor(x / Math.max(1, dw));
                  idx = Math.max(0, Math.min(n - 1, idx));
                  emitSelection(idx);
                }}
                onGestureEvent={(e) => {
                  const items = isAggregateMode
                    ? (data.aggregated?.data || [])
                    : (timeRange === 'day'
                        ? (((data.hourlyAverages || [])
                            .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                            .map((h: any) => ({ date: h.dateKey })) ) as any[])
                        : data.dailyAverages);
                  const n = items.length;
                  const dw = contentWidth / Math.max(1, n);
                  const x = (e.nativeEvent as any).x;
                  let idx = Math.floor(x / Math.max(1, dw));
                  idx = Math.max(0, Math.min(n - 1, idx));
                  const valid = (() => {
                    if (isAggregateMode) {
                      const b: any = items[idx];
                      return Number(b?.count || 0) > 0;
                    } else if (timeRange === 'day') {
                      const it: any = items[idx];
                      const rp = (data as any).rawHourlyDataPoints?.[it.date]?.entries || [];
                      return rp.length > 0;
                    } else {
                      const d: any = items[idx];
                      const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                      return rp.length > 0;
                    }
                  })();
                  if (valid) {
                    if (idx !== selectedIndex) {
                      setSelectedIndex(idx);
                      emitSelection(idx);
                    }
                  } else {
                    if (selectedIndex !== null) {
                      setSelectedIndex(null);
                      emitSelection(null as any);
                    }
                  }
                }}
              >
                <View style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]} pointerEvents="none" />
              </PanGestureHandler>
            </PinchGestureHandler>
              {/* Legacy responder block removed in favor of gesture-handler */}
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
