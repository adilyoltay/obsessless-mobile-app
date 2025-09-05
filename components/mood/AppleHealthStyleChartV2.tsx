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
const DOT_RADIUS = 3; // requested smaller radius for tighter visuals
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
    // Küçültüldü: weekly dot boyutlarına daha yakın görsel tutarlılık
    rCenterMax: 3.4,
    rCenterMin: 2.4,
    rSideFloor: 1.9,   // yan noktaların minimum yarıçapı
    rSideDelta: 0.7,   // yan = merkez - delta
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
      const anxVals = entries.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
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
      const cnt = Number((b as any)?.count || 0);
      if (cnt <= 0) return; // Skip non-data buckets entirely (no dots/bands)
      const x = AXIS_WIDTH + (index * bw) + (bw / 2);
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
        date: b.date,
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
                    strokeDasharray={isTodayBoundary ? '0' : '3,2'}
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
                    const isSelectedBand = !!selectedAggDate && band.date === selectedAggDate;
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
                              {/* Halo behind median when selected */}
                              {isSelectedBand && (
                                <>
                                  <Circle cx={band.x} cy={band.avgY} r={rCenter + 4} fill={band.color} opacity={0.14} />
                                  <Circle cx={band.x} cy={band.avgY} r={rCenter + 7} fill={band.color} opacity={0.06} />
                                </>
                              )}
                              <Circle cx={band.x} cy={band.avgY} r={rCenter} fill={band.color} opacity={opCenter}
                                stroke={isDark ? '#0E1525' : '#E5E7EB'} strokeWidth={sw} />
                            </>
                          );
                        })()}
                        <Circle cx={band.x} cy={band.maxY} r={rSide} fill={band.color} opacity={opSide}
                          stroke={isDark ? '#111827' : '#9CA3AF'} strokeWidth={0.6} />
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
                return (
                  <G key={`point-${index}`}>
                    {/* Outer ring (light/dark theme aware) */}
                    <Circle cx={px} cy={py} r={outerR} fill={ringColor} opacity={1} />
                    {/* Inner colored dot with thin stroke for crisp edge */}
                    <Circle cx={px} cy={py} r={r} fill={fill} opacity={1} stroke={strokeColor} strokeWidth={0.7} />
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
          {showAnxiety && timeRange === 'week' && data.dailyAverages.length > 1 && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const segments: string[][] = [];
                let seg: string[] = [];
                for (let index = 0; index < n; index++) {
                  const d = items[index];
                  const has = Number(d.count || 0) > 0;
                  const ax = AXIS_WIDTH + (index * dw) + (dw / 2);
                  // Use per-entry p50 if available, else daily average
                  const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                  const anxArr = rp.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
                  const a = anxArr.length ? quantiles(anxArr).p50 : Number(d.averageAnxiety || 0);
                  const norm = Math.max(1, Math.min(10, Number(a || 0)));
                  const t = (norm - 1) / 9; // 0..1 -> top low anxiety
                  const ay = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                  if (has) {
                    seg.push(`${ax},${ay}`);
                  } else if (seg.length) {
                    segments.push(seg);
                    seg = [];
                  }
                }
                if (seg.length) segments.push(seg);
                // theme-aware color and density-aware dash
                const dashLen = clamp(Math.round(dw * 0.16), 2, 5);
                const gapLen = clamp(Math.round(dashLen * 0.55), 1, 4);
                const dash = `${dashLen},${gapLen}`;
                const anxColor = isDark ? mixHex('#7C3AED', '#FFFFFF', 0.10) : mixHex('#7C3AED', '#000000', 0.08);
                return segments.map((pts, i) => (
                  pts.length > 1 ? (
                    <Path
                      key={`anx-${i}`}
                      d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                      stroke={anxColor}
                      strokeWidth={1.2}
                      strokeOpacity={0.7}
                      fill="none"
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null
                ));
              })()}
            </Svg>
          )}

          {/* Weekly p50 mood trend (accent), gap-aware */}
          {showMoodTrend && timeRange === 'week' && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
              {(() => {
                const items = data.dailyAverages;
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const segments: string[][] = [];
                let seg: string[] = [];
                for (let index = 0; index < n; index++) {
                  const d = items[index] as any;
                  const has = Number(d.count || 0) > 0;
                  if (!has) {
                    if (seg.length) { segments.push(seg); seg = []; }
                    continue;
                  }
                  const raw = (data.rawDataPoints[d.date]?.entries || []).map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
                  if (!raw.length) {
                    if (seg.length) { segments.push(seg); seg = []; }
                    continue;
                  }
                  const q = quantiles(raw);
                  const m = Number.isFinite(q.p50 as any) ? Number(q.p50) : 0;
                  const v = moodToValence(m);
                  const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                  const x = AXIS_WIDTH + index * dw + dw / 2;
                  seg.push(`${x},${y}`);
                }
                if (seg.length) segments.push(seg);
                const dashLen = clamp(Math.round(dw * 0.18), 2, 6);
                const gapLen = clamp(Math.round(dashLen * 0.55), 1, 5);
                const dash = `${dashLen},${gapLen}`;
                const width = clamp((dw / 26) + 0.8, 1.0, 1.8);
                return (
                  <>
                    <Defs>
                      <LinearGradient id="weeklyTrendGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={0.6} />
                        <Stop offset="15%" stopColor={accentColor} stopOpacity={0.9} />
                        <Stop offset="85%" stopColor={accentColor} stopOpacity={0.9} />
                        <Stop offset="100%" stopColor={accentColor} stopOpacity={0.6} />
                      </LinearGradient>
                    </Defs>
                    {segments.map((pts, i) => (
                      pts.length > 1 ? (
                        <Path
                          key={`wtrend-${i}`}
                          d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                          stroke="url(#weeklyTrendGrad)"
                          strokeWidth={width}
                          fill="none"
                          strokeDasharray={dash}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : null
                    ))}
                  </>
                );
              })()}
            </Svg>
          )}

          {/* Weekly energy thin-line overlay (gap-aware) - weekly p50 */}
          {showEnergy && timeRange === 'week' && data.dailyAverages.length > 1 && (
            <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>{(() => {
              const items = data.dailyAverages;
              const n = items.length;
              const dw = contentWidth / Math.max(1, n);
              const segments: string[][] = [];
              let seg: string[] = [];
              for (let index = 0; index < n; index++) {
                const d = items[index] as any;
                const has = Number(d.count || 0) > 0;
                const x = AXIS_WIDTH + (index * dw) + (dw / 2);
                // Use per-entry p50 if available, else daily average
                const rp = (data.rawDataPoints[d.date]?.entries || []) as any[];
                const eArr = rp.map((en: any) => Number(en.energy_level)).filter(Number.isFinite);
                const e = eArr.length ? quantiles(eArr).p50 : Number(d.averageEnergy || 0);
                const norm = Math.max(1, Math.min(10, Number(e || 0)));
                const t = (norm - 1) / 9;
                const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                if (has) seg.push(`${x},${y}`); else if (seg.length) { segments.push(seg); seg = []; }
              }
              if (seg.length) segments.push(seg);
              const dashLen = clamp(Math.round(dw * 0.16), 2, 5);
              const gapLen = clamp(Math.round(dashLen * 0.55), 1, 4);
              const dash = `${dashLen},${gapLen}`;
              const energyColor = isDark ? mixHex('#F59E0B', '#FFFFFF', 0.10) : mixHex('#F59E0B', '#000000', 0.08);
              return segments.map((pts, i) => (
                pts.length > 1 ? (
                  <Path
                    key={`en-${i}`}
                    d={`M ${pts[0]} L ${pts.slice(1).join(' L ' )}`}
                    stroke={energyColor}
                    strokeWidth={1.2}
                    strokeOpacity={0.8}
                    fill="none"
                    strokeDasharray={dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null
              ));
            })()}</Svg>
          )}

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
                        .slice(dayWindowStart, dayWindowStart + DAY_WINDOW_SIZE)
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
            {/* Aggregate p50 trend (month / 6months / year) */}
            {showMoodTrend && (timeRange === 'month' || timeRange === '6months' || timeRange === 'year') && (
              <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                {(() => {
                  const items = (data.aggregated?.data || []) as any[];
                  if (!items.length) return null;
                  const n = items.length;
                  const dw = contentWidth / Math.max(1, n);
                  // Build gap-aware segments: only connect consecutive buckets with data
                  const segments: string[][] = [];
                  let seg: string[] = [];
                  for (let idx = 0; idx < n; idx++) {
                    const b = items[idx] as any;
                    const cnt = Number(b?.count || 0);
                    const x = AXIS_WIDTH + idx * dw + dw / 2;
                    if (cnt > 0) {
                      const raw = b?.mood?.p50 ?? b?.avg ?? 0;
                      const m = Number.isFinite(raw as any) ? Number(raw) : 0;
                      const v = moodToValence(m);
                      const y = CHART_PADDING_TOP + (1 - ((v + 1) / 2)) * CHART_CONTENT_HEIGHT;
                      seg.push(`${x},${y}`);
                    } else if (seg.length) {
                      segments.push(seg);
                      seg = [];
                    }
                  }
                  if (seg.length) segments.push(seg);
                  // Dash pattern and width adapt to density for better legibility
                  // Shorter dashes for Month/6Months so segments don't feel too long
                  const dashLen = timeRange === 'year' ? 0 : clamp(Math.round(dw * 0.22), 2, 8);
                  const gapLen = timeRange === 'year' ? 0 : clamp(Math.round(dashLen * 0.5), 1, 6);
                  const dash = timeRange === 'year' ? undefined : `${dashLen},${gapLen}`;
                  // Slightly slimmer range
                  const width = clamp(timeRange === 'year' ? (dw / 18) + 0.7 : (dw / 22) + 0.5, 0.9, 1.8);
                  // Accent-aware color: lighten in dark theme, darken in light theme
                  const trendColor = accentColor.startsWith('#')
                    ? (isDark ? mixHex(accentColor, '#FFFFFF', 0.15) : mixHex(accentColor, '#000000', 0.12))
                    : accentColor;
                  return (
                    <>
                      <Defs>
                        <LinearGradient id="trendGrad" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0%" stopColor={trendColor} stopOpacity={0.5} />
                          <Stop offset="15%" stopColor={trendColor} stopOpacity={0.9} />
                          <Stop offset="85%" stopColor={trendColor} stopOpacity={0.9} />
                          <Stop offset="100%" stopColor={trendColor} stopOpacity={0.5} />
                        </LinearGradient>
                      </Defs>
                      {segments.map((pts, i) => (
                        pts.length > 1 ? (
                          <Path key={`moodseg-${i}`}
                            d={`M ${pts[0]} L ${pts.slice(1).join(' L ')}`}
                            stroke="url(#trendGrad)"
                            strokeWidth={width}
                            fill="none"
                            strokeDasharray={dash as any}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null
                      ))}
                    </>
                  );
                })()}
              </Svg>
            )}
            {/* Aggregate p50 trend - energy */}
            {showEnergy && (timeRange === 'month' || timeRange === '6months' || timeRange === 'year') && (
              <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                {(() => {
                  const items = (data.aggregated?.data || []) as any[];
                  if (!items.length) return null;
                  const n = items.length;
                  const dw = contentWidth / Math.max(1, n);
                  const segments: string[][] = [];
                  let seg: string[] = [];
                  for (let idx = 0; idx < n; idx++) {
                    const b = items[idx] as any;
                    const cnt = Number(b?.count || 0);
                    const x = AXIS_WIDTH + idx * dw + dw / 2;
                    if (cnt > 0) {
                      const rawE = b?.energy?.p50;
                      const val = Number.isFinite(rawE as any) ? Number(rawE) : 0;
                      const t = (Math.max(1, Math.min(10, val)) - 1) / 9;
                      const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                      seg.push(`${x},${y}`);
                    } else if (seg.length) {
                      segments.push(seg);
                      seg = [];
                    }
                  }
                  if (seg.length) segments.push(seg);
                  const dashLen = timeRange === 'year' ? 0 : clamp(Math.round(dw * 0.22), 2, 8);
                  const gapLen = timeRange === 'year' ? 0 : clamp(Math.round(dashLen * 0.5), 1, 6);
                  const dash = timeRange === 'year' ? undefined : `${dashLen},${gapLen}`;
                  const width = clamp(timeRange === 'year' ? (dw / 18) + 0.7 : (dw / 22) + 0.5, 0.9, 1.8);
                  return segments.map((pts, i) => (
                    pts.length > 1 ? (
                      <Path key={`energyseg-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ' )}`} stroke="#F59E0B" strokeWidth={width} strokeOpacity={0.85} fill="none" strokeDasharray={dash as any} strokeLinecap="round" strokeLinejoin="round" />
                    ) : null
                  ));
                })()}
              </Svg>
            )}
            {/* Aggregate p50 trend - anxiety */}
            {showAnxiety && (timeRange === 'month' || timeRange === '6months' || timeRange === 'year') && (
              <Svg height={CHART_HEIGHT} width={chartWidth} style={{ position: 'absolute', left: 0, top: 0 }}>
                {(() => {
                  const items = (data.aggregated?.data || []) as any[];
                  if (!items.length) return null;
                  const n = items.length;
                  const dw = contentWidth / Math.max(1, n);
                  const segments: string[][] = [];
                  let seg: string[] = [];
                  for (let idx = 0; idx < n; idx++) {
                    const b = items[idx] as any;
                    const cnt = Number(b?.count || 0);
                    const x = AXIS_WIDTH + idx * dw + dw / 2;
                    if (cnt > 0) {
                      const rawA = b?.anxiety?.p50;
                      const val = Number.isFinite(rawA as any) ? Number(rawA) : 0;
                      const t = (Math.max(1, Math.min(10, val)) - 1) / 9;
                      const y = CHART_PADDING_TOP + (1 - t) * CHART_CONTENT_HEIGHT;
                      seg.push(`${x},${y}`);
                    } else if (seg.length) {
                      segments.push(seg);
                      seg = [];
                    }
                  }
                  if (seg.length) segments.push(seg);
                  const dashLen = timeRange === 'year' ? 0 : clamp(Math.round(dw * 0.22), 2, 8);
                  const gapLen = timeRange === 'year' ? 0 : clamp(Math.round(dashLen * 0.5), 1, 6);
                  const dash = timeRange === 'year' ? undefined : `${dashLen},${gapLen}`;
                  const width = clamp(timeRange === 'year' ? (dw / 18) + 0.7 : (dw / 22) + 0.5, 0.9, 1.8);
                  return segments.map((pts, i) => (
                    pts.length > 1 ? (
                      <Path key={`anxseg-${i}`} d={`M ${pts[0]} L ${pts.slice(1).join(' L ' )}`} stroke="#7C3AED" strokeWidth={width} strokeOpacity={0.8} fill="none" strokeDasharray={dash as any} strokeLinecap="round" strokeLinejoin="round" />
                    ) : null
                  ));
                })()}
              </Svg>
            )}
            {/* Scrub overlay: press and drag horizontally to move selection and request paging at edges */}
            <View
              style={[StyleSheet.absoluteFill, { marginLeft: AXIS_WIDTH }]}
              pointerEvents="auto"
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                const items = isAggregateMode
                  ? (data.aggregated?.data || [])
                  : (timeRange === 'day'
                      ? ((data.hourlyAverages || []).map((h: any) => ({ date: h.dateKey })) as any[])
                      : data.dailyAverages);
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const x = e.nativeEvent.locationX; // 0..contentWidth
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
                if (!valid) {
                  setSelectedIndex(null);
                  emitSelection(null as any);
                } else {
                  setSelectedIndex(idx);
                  emitSelection(idx);
                }
              }}
              onResponderMove={(e) => {
                const items = isAggregateMode
                  ? (data.aggregated?.data || [])
                  : (timeRange === 'day'
                      ? (((data.hourlyAverages || [])
                          .slice(dayWindowStart, dayWindowStart + dayWindowSize)
                          .map((h: any) => ({ date: h.dateKey })) ) as any[])
                      : data.dailyAverages);
                const n = items.length;
                const dw = contentWidth / Math.max(1, n);
                const touches: any[] = (e.nativeEvent as any).touches || [];
                if (timeRange === 'day' && touches.length >= 2) {
                  // Simple pinch detection
                  const dxy = (t1: any, t2: any) => {
                    const dx = (t1.pageX - t2.pageX); const dy = (t1.pageY - t2.pageY); return Math.hypot(dx, dy);
                  };
                  const dist = dxy(touches[0], touches[1]);
                  if (pinchInitDistRef.current == null) pinchInitDistRef.current = dist;
                  const scale = dist / (pinchInitDistRef.current || dist);
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
                  return; // don't scrub while pinching
                }
                const x = e.nativeEvent.locationX; // may go slightly <0 or >contentWidth if finger outside
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
                // Edge pagination requests
                const threshold = Math.max(12, 0.3 * dw);
                if (timeRange === 'day') {
                  const shift = 2; // hours per edge shift
                  if (x < -threshold && idx === 0) {
                    setDayWindowStart(prev => Math.max(0, prev - shift));
                  } else if (x > contentWidth + threshold && idx === n - 1) {
                    setDayWindowStart(prev => Math.min(24 - DAY_WINDOW_SIZE, prev + shift));
                  }
                } else if (typeof onRequestPage === 'function') {
                  if (x < -threshold && idx === 0) onRequestPage('prev');
                  else if (x > contentWidth + threshold && idx === n - 1) onRequestPage('next');
                }
              }}
              onResponderRelease={() => { pinchInitDistRef.current = null; pinchAppliedRef.current = false; }}
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
