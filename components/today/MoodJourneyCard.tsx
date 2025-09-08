import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { formatIQRText } from '@/utils/format';
import type { MoodJourneyData } from '@/services/todayService';
import { getVAColorFromScores, getGradientFromBase, getBramanMoodColor, getAppleMoodColor } from '@/utils/colorUtils';
import { useThemeColors } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { AppleHealthTimeSelectorV2 } from '@/components/mood/AppleHealthTimeSelectorV2';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { getUserDateString, toUserLocalDate } from '@/utils/timezoneUtils';
import { useTranslation } from '@/contexts/LanguageContext';
import { quantiles, deriveAnxietySeries } from '@/utils/statistics';
import { weightedScore } from '@/utils/mindScore';
import AppleHealthStyleChartV2 from '@/components/mood/AppleHealthStyleChartV2';
import AppleHealthDetailSheet from '@/components/mood/AppleHealthDetailSheet';
import { moodDataLoader } from '@/services/moodDataLoader';
import type { TimeRange, MoodJourneyExtended } from '@/types/mood';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/utils/storage';

type Props = {
  data: MoodJourneyData;
  initialOpenDate?: string;
  initialRange?: TimeRange;
  // Notify parent with active MindScore override based on current selection/range
  onSelectedScoreChange?: (score: number | null) => void;
  // Also notify parent with meta for stats card (score, trend, label, M/E/A p50)
  onSelectedMetaChange?: (meta: { score: number | null; trendPct: number | null; periodLabel: string; dominant?: string | null; moodP50?: number | null; energyP50?: number | null; anxietyP50?: number | null }) => void;
};

// Color mapping centralized in utils/colorUtils.ts

export default function MoodJourneyCard({ data, initialOpenDate, initialRange, onSelectedScoreChange, onSelectedMetaChange }: Props) {
  // CRITICAL: Wrap all date operations in try-catch to prevent crashes
  try {
    const { language } = useTranslation();
    const theme = useThemeColors();
    const { user } = useAuth();
  const { setVA, palette } = useAccentColor();
    
    // Early safety check for props
    if (!data) {
      console.warn('MoodJourneyCard: No data provided');
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 200 }]}>
          <Text style={{ color: theme.text, textAlign: 'center' }}>
            Veri yükleniyor...
          </Text>
        </View>
      );
    }
    
    // Validate initialOpenDate if provided
    if (initialOpenDate) {
      try {
        const testDate = new Date(initialOpenDate);
        if (!isFinite(testDate.getTime())) {
          console.warn('MoodJourneyCard: Invalid initialOpenDate, ignoring:', initialOpenDate);
        }
      } catch (dateError) {
        console.warn('MoodJourneyCard: Error parsing initialOpenDate:', dateError);
      }
    }
  const [range, setRange] = React.useState<TimeRange>('week');
  const [page, setPage] = React.useState<number>(0); // 0 = current window (ends today); >0 = older pages
  const [extended, setExtended] = React.useState<MoodJourneyExtended | null>(null);
  const [isLoadingRange, setIsLoadingRange] = React.useState(false); // Loading state for range changes
  const [detailDate, setDetailDate] = React.useState<string | null>(null);
  const [detailEntries, setDetailEntries] = React.useState<any[]>([]);
  const [chartSelection, setChartSelection] = React.useState<{ date: string; index: number; totalCount: number; label: string; x: number; chartWidth: number } | null>(null);
  const [externalSelectIndex, setExternalSelectIndex] = React.useState<number | null>(null);
  const [isDraggingTooltip, setIsDraggingTooltip] = React.useState(false);
  const [chartRegion, setChartRegion] = React.useState<{ top: number; height: number }>({ top: 0, height: 0 });
  const [clearSignal, setClearSignal] = React.useState(0);
  const tooltipOpacity = React.useRef(new Animated.Value(0)).current;
  const headerOpacity = React.useRef(new Animated.Value(1)).current;
  const tooltipTransY = React.useRef(new Animated.Value(-4)).current;
  const [tooltipWidth, setTooltipWidth] = React.useState<number>(0);
  // Toggles for weekly overlays
  const [showMoodLine, setShowMoodLine] = React.useState(true);
  const [showEnergyLine, setShowEnergyLine] = React.useState(false);
  const [showAnxietyLine, setShowAnxietyLine] = React.useState(false);
  const [moodLocked, setMoodLocked] = React.useState(false);
  const [energyLocked, setEnergyLocked] = React.useState(true);
  const [anxietyLocked, setAnxietyLocked] = React.useState(true);
  const [visibleRanges, setVisibleRanges] = React.useState<TimeRange[]>(['week','month','6months','year']);

  // Load overlay visibility preferences
  React.useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.showMoodTrendOverlay === 'boolean') {
            setShowMoodLine(parsed.showMoodTrendOverlay);
            setMoodLocked(parsed.showMoodTrendOverlay === false);
          }
          if (typeof parsed.showEnergyOverlay === 'boolean') {
            setShowEnergyLine(parsed.showEnergyOverlay);
            setEnergyLocked(parsed.showEnergyOverlay === false);
          }
          if (typeof parsed.showAnxietyOverlay === 'boolean') {
            setShowAnxietyLine(parsed.showAnxietyOverlay);
            setAnxietyLocked(parsed.showAnxietyOverlay === false);
          }
          if (Array.isArray(parsed.visibleTimeRanges) && parsed.visibleTimeRanges.length > 0) {
            setVisibleRanges(parsed.visibleTimeRanges as TimeRange[]);
          } else {
            setVisibleRanges(['day','week','month']);
          }
        }
      } catch {}
    })();
  }, []);

  // Re-apply preferences when screen regains focus (e.g., after returning from Settings)
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.showMoodTrendOverlay === 'boolean') {
              setShowMoodLine(parsed.showMoodTrendOverlay);
              setMoodLocked(parsed.showMoodTrendOverlay === false);
            }
            if (typeof parsed.showEnergyOverlay === 'boolean') {
              setShowEnergyLine(parsed.showEnergyOverlay);
              setEnergyLocked(parsed.showEnergyOverlay === false);
            }
            if (typeof parsed.showAnxietyOverlay === 'boolean') {
              setShowAnxietyLine(parsed.showAnxietyOverlay);
              setAnxietyLocked(parsed.showAnxietyOverlay === false);
            }
            if (Array.isArray(parsed.visibleTimeRanges) && parsed.visibleTimeRanges.length > 0) {
              const cleaned = (parsed.visibleTimeRanges as TimeRange[]).filter(r => r !== 'day');
              setVisibleRanges(cleaned.length ? cleaned : ['week','month','6months','year']);
            }
          }
        } catch {}
      })();
    }, [])
  );
  
  // Track if initialRange has been applied to prevent infinite loops
  const initialRangeApplied = React.useRef(false);

  // Range-level stats (p50 across selected time range)
  const rangeStats = React.useMemo(() => {
    if (!extended) return { moodP50: NaN, moodAvg: 0, energyP50: NaN, energyAvg: 0, anxietyP50: NaN, anxietyAvg: 0 };
    const avg = (arr: number[]) => arr.length ? (arr.reduce((s,n)=>s+n,0)/arr.length) : 0;
    if (range === 'week') {
      const days = extended.dailyAverages || [];
      const moodVals: number[] = [];
      const energyVals: number[] = [];
      days.forEach(d => {
        const rp = extended.rawDataPoints[d.date]?.entries || [];
        rp.forEach((e: any) => {
          if (Number.isFinite(e.mood_score)) moodVals.push(Number(e.mood_score));
          if (Number.isFinite(e.energy_level)) energyVals.push(Number(e.energy_level));
        });
      });
      // Do not coerce missing anxiety to 0; keep only real numeric values
      const anxDaily = days.map(d => Number(d.averageAnxiety)).filter(Number.isFinite);
      const mq = quantiles(moodVals);
      const eq = quantiles(energyVals);
      const aq = quantiles(anxDaily);
      return {
        moodP50: mq.p50, moodAvg: avg(moodVals),
        energyP50: eq.p50, energyAvg: avg(energyVals),
        anxietyP50: aq.p50, anxietyAvg: avg(anxDaily)
      };
    } else if (range === 'day') {
      const hours = (extended.hourlyAverages || []) as any[];
      const moodVals: number[] = [];
      const energyVals: number[] = [];
      const anxVals: number[] = [];
      hours.forEach(h => {
        const list = (extended.rawHourlyDataPoints as any)?.[h.dateKey]?.entries || [];
        list.forEach((e: any) => {
          if (Number.isFinite(e.mood_score)) moodVals.push(Number(e.mood_score));
          if (Number.isFinite(e.energy_level)) energyVals.push(Number(e.energy_level));
          if (Number.isFinite(e.anxiety_level)) anxVals.push(Number(e.anxiety_level));
        });
      });
      const mq = quantiles(moodVals);
      const eq = quantiles(energyVals);
      const aq = quantiles(anxVals);
      return {
        moodP50: mq.p50, moodAvg: avg(moodVals),
        energyP50: eq.p50, energyAvg: avg(energyVals),
        anxietyP50: aq.p50, anxietyAvg: avg(anxVals)
      };
    }
    // Aggregate modes: combine bucket entries
    const buckets = extended.aggregated?.data || [] as any[];
    const moodVals: number[] = [];
    const energyVals: number[] = [];
    const anxVals: number[] = [];
    buckets.forEach(b => {
      const arr = (b.entries || []) as any[];
      arr.forEach(e => {
        if (Number.isFinite(e.mood_score)) moodVals.push(Number(e.mood_score));
        if (Number.isFinite(e.energy_level)) energyVals.push(Number(e.energy_level));
        if (Number.isFinite(e.anxiety_level)) anxVals.push(Number(e.anxiety_level));
      });
    });
    const mq = quantiles(moodVals);
    const eq = quantiles(energyVals);
    const aq = quantiles(anxVals);
    return {
      moodP50: mq.p50, moodAvg: avg(moodVals),
      energyP50: eq.p50, energyAvg: avg(energyVals),
      anxietyP50: aq.p50, anxietyAvg: avg(anxVals)
    };
  }, [extended, range]);

  const openDetailForDate = React.useCallback((date: string) => {
    if (!extended) return;
    if (range === 'week') {
      const e = extended.rawDataPoints[date]?.entries || [];
      setDetailEntries(e);
    } else if (range === 'day') {
      // Day mode: date is an hourly key YYYY-MM-DD#HH
      const list = (extended.rawHourlyDataPoints as any)?.[date]?.entries || [];
      setDetailEntries(list);
      // Pass only the YYYY-MM-DD part to detail sheet for proper date formatting
      const dayOnly = String(date).split('#')[0];
      setDetailDate(dayOnly);
      return;
    } else {
      const agg = extended.aggregated?.data || [];
      let bucket = agg.find(b => b.date === date) as any;
      if (!bucket && range === 'year') {
        const monthKey = String(date).slice(0, 7); // YYYY-MM
        bucket = agg.find(b => (b as any).date?.startsWith(monthKey));
      }
      const e = (bucket?.entries || []) as any[];
      setDetailEntries(e);
    }
    setDetailDate(date);
  }, [extended, range]);

  // Animate tooltip show/hide
  React.useEffect(() => {
    const toVisible = !!chartSelection;
    Animated.parallel([
      Animated.timing(tooltipOpacity, { toValue: toVisible ? 1 : 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(tooltipTransY, { toValue: toVisible ? 0 : -4, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [chartSelection, tooltipOpacity, tooltipTransY]);

  // Helper: compute weighted score from entry list
  const computeScoreFromEntries = React.useCallback((entries: any[]): number | null => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const moods = entries.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
    const energies = entries.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
    const rawAnx = entries.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
    if (moods.length === 0 && energies.length === 0 && rawAnx.length === 0) return null;
    const mq = quantiles(moods);
    const eq = quantiles(energies);
    const anxSeries = deriveAnxietySeries(moods, energies, rawAnx);
    const aq = quantiles(anxSeries);
    return weightedScore(mq.p50, eq.p50, aq.p50);
  }, []);

  const computeP50sFromEntries = React.useCallback((entries: any[]): { mood: number | null; energy: number | null; anxiety: number | null } => {
    if (!Array.isArray(entries) || entries.length === 0) return { mood: null, energy: null, anxiety: null };
    const moods = entries.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
    const energies = entries.map((e: any) => Number(e.energy_level)).filter(Number.isFinite);
    const rawAnx = entries.map((e: any) => Number(e.anxiety_level)).filter(Number.isFinite);
    const mq = quantiles(moods);
    const eq = quantiles(energies);
    const anxSeries = deriveAnxietySeries(moods, energies, rawAnx);
    const aq = quantiles(anxSeries);
    return {
      mood: Number.isFinite(mq.p50 as any) ? Number(mq.p50) : null,
      energy: Number.isFinite(eq.p50 as any) ? Number(eq.p50) : null,
      anxiety: Number.isFinite(aq.p50 as any) ? Number(aq.p50) : null,
    };
  }, []);

  // Helper: compute weighted score from aggregated bucket
  const computeScoreFromBucket = React.useCallback((bucket: any): number | null => {
    if (!bucket) return null;
    const m = Number(bucket?.mood?.p50 ?? bucket?.p50 ?? bucket?.averageMood ?? NaN);
    const e = Number(bucket?.energy?.p50 ?? bucket?.averageEnergy ?? NaN);
    let a: number | null = null;
    const aP50 = Number(bucket?.anxiety?.p50 ?? bucket?.averageAnxiety ?? NaN);
    if (Number.isFinite(aP50)) {
      a = aP50;
      if (a === 50) {
        // derive when fallback-neutral
        const mUse = Number.isFinite(m) ? m : 50;
        const eUse = Number.isFinite(e) ? (e <= 10 ? e * 10 : e) : 60;
        const m10 = Math.max(1, Math.min(10, Math.round(mUse / 10)));
        const e10 = Math.max(1, Math.min(10, Math.round(eUse / 10)));
        if (m10 <= 3) a = 70; else if (m10 >= 8 && e10 <= 4) a = 60; else if (m10 <= 5 && e10 >= 7) a = 80; else a = Math.max(20, Math.min(80, 60 - (m10 - 5) * 10));
      }
    }
    return weightedScore(m, e, a);
  }, []);

  // Emit active MindScore override based on current range + selection
  React.useEffect(() => {
    try {
      if (typeof onSelectedScoreChange !== 'function') return;
      if (!extended) { onSelectedScoreChange(null); return; }
      // Weekly: follow day selection; no selection → let card use weekly score
      if (range === 'week') {
        if (chartSelection) {
          const list = extended.rawDataPoints?.[chartSelection.date]?.entries || [];
          const s = computeScoreFromEntries(list);
          onSelectedScoreChange(typeof s === 'number' ? s : null);
        } else {
          // No selection: use whole-week aggregated score (all entries in 7-day window)
          const allEntries: any[] = [];
          (extended.dailyAverages || []).forEach((d: any) => {
            const list = extended.rawDataPoints?.[d.date]?.entries || [];
            if (Array.isArray(list) && list.length) allEntries.push(...list);
          });
          const sWeek = computeScoreFromEntries(allEntries);
          onSelectedScoreChange(typeof sWeek === 'number' ? sWeek : null);
        }
        return;
      }
      // Aggregate ranges: selection → bucket score; no selection → whole-period score
      if (range === 'month' || range === '6months' || range === 'year') {
        if (chartSelection) {
          const agg = (extended.aggregated?.data || []) as any[];
          let bucket: any = agg.find(b => b.date === chartSelection.date);
          if (!bucket && range === 'year') {
            const monthKey = String(chartSelection.date).slice(0, 7);
            bucket = agg.find(b => (b as any)?.date?.startsWith(monthKey));
          }
          const s = bucket?.entries && bucket.entries.length ? computeScoreFromEntries(bucket.entries) : computeScoreFromBucket(bucket);
          onSelectedScoreChange(typeof s === 'number' ? s : null);
          return;
        }
        // No selection: compute across whole period
        const allEntries: any[] = [];
        const agg = (extended.aggregated?.data || []) as any[];
        agg.forEach((b: any) => { if (Array.isArray(b.entries)) allEntries.push(...b.entries); });
        const s = computeScoreFromEntries(allEntries);
        onSelectedScoreChange(typeof s === 'number' ? s : null);
        return;
      }
      onSelectedScoreChange(null);
    } catch {
      try { if (typeof onSelectedScoreChange === 'function') onSelectedScoreChange(null); } catch {}
    }
  }, [chartSelection, range, extended, onSelectedScoreChange, computeScoreFromEntries, computeScoreFromBucket]);

  // Emit meta (score + trend + label) for stats card
  React.useEffect(() => {
    try {
      if (typeof onSelectedMetaChange !== 'function') return;
      if (!extended) { onSelectedMetaChange({ score: null, trendPct: null, periodLabel: '—' }); return; }

      const computeSeriesForWeek = () => {
        const days = extended.dailyAverages || [];
        const series: number[] = [];
        days.forEach((d: any) => {
          const list = extended.rawDataPoints?.[d.date]?.entries || [];
          const s = computeScoreFromEntries(list);
          if (typeof s === 'number') series.push(s);
        });
        return series;
      };
      const computeSeriesForAgg = () => {
        const buckets = (extended.aggregated?.data || []) as any[];
        const series: number[] = [];
        buckets.forEach(b => {
          const s = (Array.isArray(b.entries) && b.entries.length)
            ? computeScoreFromEntries(b.entries)
            : computeScoreFromBucket(b);
          if (typeof s === 'number') series.push(s);
        });
        return series;
      };
      const pct = (a: number, b: number) => {
        if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
        return Math.round(((a - b) / Math.max(1, b)) * 100);
      };

      const labelFromScore = (s: number) => (
        s >= 90 ? 'Heyecanlı' :
        s >= 80 ? 'Enerjik'  :
        s >= 70 ? 'Mutlu'    :
        s >= 60 ? 'Sakin'    :
        s >= 50 ? 'Normal'   :
        s >= 40 ? 'Endişeli' :
        s >= 30 ? 'Sinirli'  :
        s >= 20 ? 'Üzgün'    : 'Kızgın'
      );

      if (range === 'week') {
        const series = computeSeriesForWeek();
        const base = series.length ? series[0] : null;
        if (chartSelection) {
          const list = extended.rawDataPoints?.[chartSelection.date]?.entries || [];
          const curr = computeScoreFromEntries(list);
          const trendPct = (typeof curr === 'number' && typeof base === 'number') ? pct(curr, base) : null;
          const p50s = computeP50sFromEntries(list);
          onSelectedMetaChange({ score: (typeof curr === 'number' ? Math.round(curr) : null), trendPct, periodLabel: '1g', dominant: (typeof curr === 'number' ? labelFromScore(Math.round(curr)) : null), moodP50: p50s.mood, energyP50: p50s.energy, anxietyP50: p50s.anxiety });
        } else {
          // No selection → aggregate whole week for score/dominant; trend still vs first of series
          const allEntries: any[] = [];
          (extended.dailyAverages || []).forEach((d: any) => {
            const list = extended.rawDataPoints?.[d.date]?.entries || [];
            if (Array.isArray(list) && list.length) allEntries.push(...list);
          });
          const sWeek = computeScoreFromEntries(allEntries);
          const p50s = computeP50sFromEntries(allEntries);
          const curr = series.length ? series[series.length - 1] : null;
          const trendPct = (typeof curr === 'number' && typeof base === 'number') ? pct(curr, base) : null;
          onSelectedMetaChange({ score: (typeof sWeek === 'number' ? Math.round(sWeek) : null), trendPct, periodLabel: '7g', dominant: (typeof sWeek === 'number' ? labelFromScore(Math.round(sWeek)) : null), moodP50: p50s.mood, energyP50: p50s.energy, anxietyP50: p50s.anxiety });
        }
        return;
      }

      if (range === 'month' || range === '6months' || range === 'year') {
        const series = computeSeriesForAgg();
        const base = series.length ? series[0] : null;
        if (chartSelection) {
          const agg = (extended.aggregated?.data || []) as any[];
          let bucket: any = agg.find(b => b.date === chartSelection.date);
          if (!bucket && range === 'year') {
            const monthKey = String(chartSelection.date).slice(0, 7);
            bucket = agg.find(b => (b as any)?.date?.startsWith(monthKey));
          }
          const curr = (bucket?.entries && bucket.entries.length)
            ? computeScoreFromEntries(bucket.entries)
            : computeScoreFromBucket(bucket);
          const trendPct = (typeof curr === 'number' && typeof base === 'number') ? pct(curr, base) : null;
          // Period label for single bucket selection
          const label = range === 'year' ? '1y' : (range === '6months' ? '6a' : '1a');
          const p50sSel = (bucket?.entries && bucket.entries.length)
            ? computeP50sFromEntries(bucket.entries)
            : { mood: Number(bucket?.mood?.p50 ?? bucket?.p50 ?? null), energy: Number(bucket?.energy?.p50 ?? null), anxiety: Number(bucket?.anxiety?.p50 ?? null) };
          onSelectedMetaChange({ score: (typeof curr === 'number' ? Math.round(curr) : null), trendPct, periodLabel: label, dominant: (typeof curr === 'number' ? labelFromScore(Math.round(curr)) : null), moodP50: p50sSel.mood, energyP50: p50sSel.energy, anxietyP50: p50sSel.anxiety });
        } else {
          // No selection → aggregate whole period for score/dominant; trend remains series-based (last vs first)
          const agg = (extended.aggregated?.data || []) as any[];
          const allEntries: any[] = [];
          agg.forEach((b: any) => { if (Array.isArray(b.entries)) allEntries.push(...b.entries); });
          const sPeriod = computeScoreFromEntries(allEntries);
          const p50s = computeP50sFromEntries(allEntries);
          const lastOfSeries = series.length ? series[series.length - 1] : null;
          const trendPctV = (typeof lastOfSeries === 'number' && typeof base === 'number') ? pct(lastOfSeries, base) : null;
          const label = range === 'year' ? '1y' : (range === '6months' ? '6a' : '1a');
          onSelectedMetaChange({ score: (typeof sPeriod === 'number' ? Math.round(sPeriod) : null), trendPct: trendPctV, periodLabel: label, dominant: (typeof sPeriod === 'number' ? labelFromScore(Math.round(sPeriod)) : null), moodP50: p50s.mood, energyP50: p50s.energy, anxietyP50: p50s.anxiety });
        }
        return;
      }

      onSelectedMetaChange({ score: null, trendPct: null, periodLabel: '—', dominant: null });
    } catch {
      try { if (typeof onSelectedMetaChange === 'function') onSelectedMetaChange({ score: null, trendPct: null, periodLabel: '—', dominant: null }); } catch {}
    }
  }, [chartSelection, range, extended, onSelectedMetaChange, computeScoreFromEntries, computeScoreFromBucket]);

  // Helper: refresh current extended dataset for active range/page
  const refreshExtended = React.useCallback(async () => {
    if (!user?.id) return;
    const daysForRange = (r: TimeRange) => (r === 'week' ? 7 : r === 'month' ? 30 : r === '6months' ? 183 : 365);
    const end = new Date();
    end.setDate(end.getDate() - page * daysForRange(range));
    end.setHours(0, 0, 0, 0);
    const res = await moodDataLoader.loadTimeRangeAt(user.id, range, end);
    setExtended(res);
  }, [user?.id, range, page]);

  // Handle initialRange only once at mount (do not react to later range changes)
  React.useEffect(() => {
    if (!initialRange || initialRangeApplied.current) return;
    initialRangeApplied.current = true; // mark applied before any state updates to avoid race on first toggle
    console.log(`MoodJourneyCard: Applying initial range: ${initialRange}`);
    if (initialRange !== range) {
      setRange(initialRange);
      setPage(0);
    }
  }, [initialRange]);

  // Load data when range or page changes
  React.useEffect(() => {
    console.log(`MoodJourneyCard: ===== USEEFFECT TRIGGERED =====`);
    console.log(`MoodJourneyCard: useEffect - range=${range}, page=${page}, user=${user?.id ? 'exists' : 'null'}`);
    
    let mounted = true;
    if (!user?.id) {
      console.log(`MoodJourneyCard: No user, returning early`);
      return () => { mounted = false; };
    }
    
    console.log(`MoodJourneyCard: Loading data for range=${range}, page=${page}`);
    (async () => {
      try {
        // Compute end date for this page with safety checks
        const daysForRange = (r: TimeRange) => {
          switch (r) {
            case 'week': return 7;
            case 'month': return 30;
            case '6months': return 183;
            case 'year': return 365;
            default: return 7; // Fallback to week
          }
        };
        
        // Safe page calculation - prevent negative dates
        const safePage = Math.max(0, Math.min(page || 0, 100)); // Max 100 pages back
        const daysBack = safePage * daysForRange(range);
        
        // Create end date safely using getTime() instead of setDate()
        const now = new Date();
        const endTime = now.getTime() - (daysBack * 24 * 60 * 60 * 1000);
        const end = new Date(endTime);
        
        // Validate end date
        if (!isFinite(end.getTime())) {
          console.warn('Invalid end date calculated, using today');
          end.setTime(Date.now());
        }
        
        end.setHours(0, 0, 0, 0);
        console.log(`MoodJourneyCard: Loading data for ${user.id}, ${range}, end=${end.toISOString()}`);
        const res = await moodDataLoader.loadTimeRangeAt(user.id, range, end);
        console.log(`MoodJourneyCard: Data loaded, setting extended... mounted=${mounted}`);
        if (mounted) {
          setExtended(res);
          setIsLoadingRange(false); // Clear loading state after data is set
          console.log(`MoodJourneyCard: Extended data set successfully`);
        }
        
        // Prefetch neighbors (older and newer if exists) with safety
        try {
          // Older date - go back one more range period
          const olderTime = end.getTime() - (daysForRange(range) * 24 * 60 * 60 * 1000);
          const older = new Date(olderTime);
          if (isFinite(older.getTime())) {
            void moodDataLoader.loadTimeRangeAt(user.id, range, older);
          }
          
          // Newer date - only if we're not on the current page
          if (safePage > 0) {
            const newerTime = end.getTime() + (daysForRange(range) * 24 * 60 * 60 * 1000);
            const newer = new Date(newerTime);
            if (isFinite(newer.getTime()) && newer.getTime() <= Date.now()) {
              void moodDataLoader.loadTimeRangeAt(user.id, range, newer);
            }
          }
        } catch (prefetchError) {
          console.warn('Prefetch error:', prefetchError);
        }
      } catch (mainError) {
        console.error('MoodJourneyCard date calculation error:', mainError);
        // Fallback: use today's date
        if (mounted) {
          const fallbackEnd = new Date();
          fallbackEnd.setHours(0, 0, 0, 0);
          try {
            const res = await moodDataLoader.loadTimeRangeAt(user.id, range, fallbackEnd);
            if (mounted) {
              setExtended(res);
              setIsLoadingRange(false);
            }
          } catch (fallbackError) {
            console.error('Fallback load also failed:', fallbackError);
            if (mounted) {
              setExtended(null);
              setIsLoadingRange(false);
            }
          }
        }
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, range, page]);

  // Ensure current range remains within allowed visible ranges
  React.useEffect(() => {
    if (!visibleRanges.includes(range)) {
      const fallback = (visibleRanges.includes('week') ? 'week' : visibleRanges[0]) as TimeRange;
      setRange(fallback);
      setPage(0);
    }
  }, [visibleRanges]);

  // Auto open detail for an initial date (only once)
  const appliedInitialRef = React.useRef(false);
  React.useEffect(() => {
    if (appliedInitialRef.current) return;
    if (!extended) return;
    if (!initialOpenDate) return;
    
    try {
      // Validate initialOpenDate is a valid date string
      const testDate = new Date(initialOpenDate);
      if (!isFinite(testDate.getTime())) {
        console.warn('Invalid initialOpenDate:', initialOpenDate);
        return;
      }
      
      // Try to open detail for the provided date
      const rawDataPoints = extended.rawDataPoints || {};
      const list = rawDataPoints[initialOpenDate]?.entries || [];
      if (list.length > 0) {
        setDetailEntries(list as any[]);
        setDetailDate(initialOpenDate);
        appliedInitialRef.current = true;
      }
    } catch (dateError) {
      console.error('Error processing initialOpenDate:', dateError);
      // Don't crash, just skip the auto-open
    }
  }, [extended, initialOpenDate]);

  // Sync hero color with current chart bar color
  React.useEffect(() => {
    if (!extended) return;
    try {
      const toCoord = (v10: number) => Math.max(-1, Math.min(1, (v10 - 5.5) / 4.5));
      let mood = 0;
      let energy = 6;
      if (range === 'week') {
        // Use today's daily average
        const days = extended.dailyAverages || [];
        if (days.length) {
          const todayKey = getUserDateString(new Date());
          const last = days[days.length - 1];
          const target = days.find(d => d.date === todayKey) || last;
          mood = Math.max(0, Math.min(100, Math.round(target.averageMood || 0)));
          energy = Math.max(1, Math.min(10, Math.round(target.averageEnergy || extended.weeklyEnergyAvg || 6)));
        }
      } else {
        // Use last aggregate bucket
        const agg = extended.aggregated?.data || [];
        if (agg.length) {
          const b = agg[agg.length - 1] as any;
          const useMedian = range === 'year';
          const center = useMedian && typeof b.p50 === 'number' ? b.p50 : (b.averageMood || 0);
          mood = Math.max(0, Math.min(100, Math.round(center)));
          energy = Math.max(1, Math.min(10, Math.round(b.averageEnergy || extended.weeklyEnergyAvg || 6)));
        }
      }
      if (mood > 0) {
        const m10 = Math.max(1, Math.min(10, Math.round(mood / 10)));
        const e10 = Math.max(1, Math.min(10, Math.round(energy)));
        setVA({ x: toCoord(m10), y: toCoord(e10) });
      }
    } catch {}
  }, [extended, range, setVA]);
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
    const paletteEnergy = Math.round((data.weeklyEnergyAvg || 6));
    const stops = [15, 25, 35, 45, 55, 65, 75, 85, 95];
    return stops.map(s => {
      if (palette === 'braman') return getBramanMoodColor(s);
      if (palette === 'apple') return getAppleMoodColor(s);
      return getVAColorFromScores(s, paletteEnergy);
    });
  }, [data.weeklyEnergyAvg, palette]);

  return (
    <View style={styles.container}>
      {/* Time range selector row */}
      <View style={styles.selectorWrapper}>
        <AppleHealthTimeSelectorV2 
          selected={range} 
          onChange={React.useCallback((newRange: TimeRange) => { 
            console.log(`MoodJourneyCard: Range changing to ${newRange}`);
            
            // Start loading state immediately
            setIsLoadingRange(true);
            
            // Force immediate state update by using callback form
            setRange(currentRange => {
              if (currentRange === newRange) {
                setIsLoadingRange(false);
                return currentRange;
              }
              return newRange;
            });
            
            setPage(0);
            setChartSelection(null);
            setClearSignal(prev => prev + 1);
          }, [])} 
          visible={visibleRanges}
        />
        {/* Chip row aligned to selector (right) */}
        <View style={styles.selectorBadgeRow} pointerEvents="box-none" />
      </View>

      {/* Chart container with header/tooltip overlay area */}
      <View style={{ position: 'relative', paddingTop: 68 }} onLayout={(e) => {
        try {
          const { y, height } = e.nativeEvent.layout;
          setChartRegion({ top: y, height });
        } catch {}
      }}>
        {/* Fixed overlay area above chart: shows summary or tooltip */}
        {!chartSelection && extended && (
          <Animated.View style={[styles.chartTopOverlay, { opacity: headerOpacity }]} pointerEvents="none" onLayout={() => {
            try {
              Animated.sequence([
                Animated.timing(headerOpacity, { toValue: 0.92, duration: 80, useNativeDriver: true }),
                Animated.timing(headerOpacity, { toValue: 1, duration: 140, useNativeDriver: true })
              ]).start();
            } catch {}
          }}>
            <View style={styles.chartHeaderRow}>
              {/* Left: Total entries + date range */}
              <View>
                <Text style={styles.chartHeaderCount}>
                  TOPLAM{'\n'}
                  <Text style={styles.chartHeaderCountValue}>{extended?.statistics?.totalEntries || 0} <Text style={styles.chartHeaderCountUnit}>giriş</Text></Text>
                </Text>
                <Text style={styles.chartHeaderDateRange}>{(() => {
                  const days = extended?.dailyAverages || [];
                  if (!days.length) return '';
                  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                  if (range === 'day') {
                    const firstKey = String(days[0].date);
                    const ymd = firstKey.split('#')[0];
                    const d = new Date(`${ymd}T00:00:00.000Z`);
                    if (!isFinite(d.getTime())) return '';
                    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                  }
                  const start = new Date(days[0].date);
                  const end = new Date(days[days.length - 1].date);
                  if (range === 'week') return `${start.getDate()} ${months[start.getMonth()]}–${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
                  if (range === 'month') return `${months[start.getMonth()]} ${start.getFullYear()}`;
                  if (range === '6months') return `${months[start.getMonth()]}–${months[end.getMonth()]} ${end.getFullYear()}`;
                  return `${start.getFullYear()}`;
                })()}</Text>
              </View>
              {/* Right header extras removed (Baskın chip moved to MindScoreCard) */}
            </View>
          </Animated.View>
        )}
        {/* Interactive chart - Apple Health Style V2 with loading state */}
        {isLoadingRange ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#9CA3AF" />
            <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
          </View>
        ) : extended ? (
          <AppleHealthStyleChartV2
            data={extended}
            timeRange={range}
            embedHeader={false}
            showMoodTrend={!moodLocked && showMoodLine}
            showEnergy={showEnergyLine}
            showAnxiety={showAnxietyLine}
            onSelectionChange={(sel) => setChartSelection(sel)}
            clearSelectionSignal={clearSignal}
            selectIndex={isDraggingTooltip ? externalSelectIndex : undefined}
            onRequestPage={(dir) => {
              // dir: 'prev' (older) => page+1, 'next' (newer) => page-1 but not < 0
              setChartSelection(null);
              setClearSignal(s => s + 1);
              setPage((p) => dir === 'prev' ? p + 1 : Math.max(0, p - 1));
            }}
            onDayPress={(date) => {
              // no-op: detail opens from tooltip tap only
              // Sync hero VA color with the tapped bar
              try {
                const toCoord = (v10: number) => Math.max(-1, Math.min(1, (v10 - 5.5) / 4.5));
                let mood = 0;
                let energy = 6;
                if (range === 'week') {
                  const day = extended.dailyAverages.find(d => d.date === date);
                  if (day) {
                    mood = Math.max(0, Math.min(100, Math.round(day.averageMood || 0)));
                    energy = Math.max(1, Math.min(10, Math.round(day.averageEnergy || extended.weeklyEnergyAvg || 6)));
                  }
                } else {
                  const agg = extended.aggregated?.data || [];
                  let bucket = agg.find(b => b.date === date) as any;
                  if (!bucket && range === 'year') {
                    const monthKey = String(date).slice(0, 7);
                    bucket = agg.find(b => (b as any).date?.startsWith(monthKey));
                  }
                  if (bucket) {
                    const useMedian = range === 'year';
                    const center = useMedian && typeof bucket.p50 === 'number' ? bucket.p50 : (bucket.averageMood || 0);
                    mood = Math.max(0, Math.min(100, Math.round(center)));
                    energy = Math.max(1, Math.min(10, Math.round(bucket.averageEnergy || extended.weeklyEnergyAvg || 6)));
                  }
                }
                if (mood > 0) {
                  const m10 = Math.max(1, Math.min(10, Math.round(mood / 10)));
                  const e10 = Math.max(1, Math.min(10, Math.round(energy)));
                  setVA({ x: toCoord(m10), y: toCoord(e10) });
                }
              } catch {}
            }}
          />
        ) : null}

        {/* Tooltip overlay (on top of chart) */}
        {chartSelection && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="box-none">
            {(() => {
              // Dynamic close zones: whole card except chart region
              const topH = Math.max(0, chartRegion.top);
              const botTop = Math.max(0, chartRegion.top + chartRegion.height);
              const useDynamic = chartRegion.height > 0;
              return (
                <>
                  <TouchableOpacity 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: useDynamic ? topH : 68 }} 
                    activeOpacity={1} 
                    onPress={() => {
                      setChartSelection(null);
                      setClearSignal(s => s + 1);
                    }}
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: useDynamic ? botTop : (68 + 252), left: 0, right: 0, bottom: 0 }}
                    activeOpacity={1}
                    onPress={() => {
                      setChartSelection(null);
                      setClearSignal(s => s + 1);
                    }}
                  />
                </>
              );
            })()}
            
            {/* Tooltip content (confined to top overlay area) */}
            {(() => {
              const fallbackW = 220;
              const w = tooltipWidth > 0 ? tooltipWidth : fallbackW;
              const left = Math.max(4, Math.min((chartSelection.chartWidth || 0) - w - 4, chartSelection.x - w / 2));
              const innerX = (chartSelection.x - left);
              const pointerX = Math.max(8, Math.min((w - 8 - 8), innerX - 4));
              const AXIS_WIDTH = 8; // keep in sync with chart
              const RIGHT_LABEL_PAD = 40; // keep in sync with chart
              // Helpers
              const nfmt = (n: number | undefined) => (Number.isFinite(n as any) ? Math.round((n as number) * 10) / 10 : '—');
              const fmtIQR = formatIQRText;
              // Compute dominant emotion based on weightedScore for selection/period
              const selectedDominant = (() => {
                if (!extended) return '—';
                const labelFromScore = (s: number) => (
                  s >= 90 ? 'Heyecanlı' :
                  s >= 80 ? 'Enerjik'  :
                  s >= 70 ? 'Mutlu'    :
                  s >= 60 ? 'Sakin'    :
                  s >= 50 ? 'Normal'   :
                  s >= 40 ? 'Endişeli' :
                  s >= 30 ? 'Sinirli'  :
                  s >= 20 ? 'Üzgün'    : 'Kızgın'
                );
                // Week/day: compute from entries
                if (range === 'week') {
                  const list = extended.rawDataPoints[chartSelection.date]?.entries || [];
                  const s = computeScoreFromEntries(list);
                  return (typeof s === 'number') ? labelFromScore(Math.round(s)) : '—';
                } else if (range === 'day') {
                  const list = (extended.rawHourlyDataPoints as any)?.[chartSelection.date]?.entries || [];
                  const s = computeScoreFromEntries(list);
                  return (typeof s === 'number') ? labelFromScore(Math.round(s)) : '—';
                }
                // Aggregate: from bucket (entries preferred), else aggregated p50
                const agg = extended.aggregated?.data || [] as any[];
                let bucket = agg.find((b: any) => b.date === chartSelection.date) as any;
                if (!bucket && range === 'year') {
                  const monthKey = String(chartSelection.date).slice(0, 7);
                  bucket = agg.find((b: any) => (b as any).date?.startsWith(monthKey));
                }
                if (!bucket) return '—';
                const s = (Array.isArray(bucket.entries) && bucket.entries.length)
                  ? computeScoreFromEntries(bucket.entries)
                  : computeScoreFromBucket(bucket);
                return (typeof s === 'number') ? labelFromScore(Math.round(s)) : '—';
              })();
              // Quantiles for tooltip rows
              const qData = (() => {
                if (!extended) return null as any;
                if (range === 'week') {
                  const list = extended.rawDataPoints[chartSelection.date]?.entries || [];
                  const moods = list.map((p: any) => p.mood_score);
                  const energies = list.map((p: any) => p.energy_level);
                  const anx = list.map((p: any) => (typeof p.anxiety_level === 'number' ? p.anxiety_level : 0));
                  const q = (arr: number[]) => {
                    const a = arr.map(Number).filter(n => Number.isFinite(n)).sort((x,y)=>x-y);
                    if (!a.length) return { p25: NaN, p50: NaN, p75: NaN };
                    const interp = (p: number) => {
                      const idx = (a.length - 1) * p;
                      const lo = Math.floor(idx), hi = Math.ceil(idx);
                      if (lo === hi) return a[lo];
                      const t = idx - lo; return a[lo]*(1-t)+a[hi]*t;
                    };
                    return { p25: interp(0.25), p50: interp(0.5), p75: interp(0.75) };
                  };
                  return {
                    count: list.length,
                    mood: q(moods),
                    energy: q(energies),
                    anxiety: q(anx),
                  };
                } else if (range === 'day') {
                  const list = (extended.rawHourlyDataPoints as any)?.[chartSelection.date]?.entries || [];
                  const moods = list.map((p: any) => p.mood_score);
                  const energies = list.map((p: any) => p.energy_level);
                  const anx = list.map((p: any) => (typeof p.anxiety_level === 'number' ? p.anxiety_level : 0));
                  const q = (arr: number[]) => {
                    const a = arr.map(Number).filter(n => Number.isFinite(n)).sort((x,y)=>x-y);
                    if (!a.length) return { p25: NaN, p50: NaN, p75: NaN };
                    const interp = (p: number) => {
                      const idx = (a.length - 1) * p;
                      const lo = Math.floor(idx), hi = Math.ceil(idx);
                      if (lo === hi) return a[lo];
                      const t = idx - lo; return a[lo]*(1-t)+a[hi]*t;
                    };
                    return { p25: interp(0.25), p50: interp(0.5), p75: interp(0.75) };
                  };
                  return {
                    count: list.length,
                    mood: q(moods),
                    energy: q(energies),
                    anxiety: q(anx),
                  };
                }
                const agg = extended.aggregated?.data || [] as any[];
                let bucket = agg.find((b: any) => b.date === chartSelection.date) as any;
                if (!bucket && range === 'year') {
                  const monthKey = String(chartSelection.date).slice(0, 7);
                  bucket = agg.find((b: any) => (b as any).date?.startsWith(monthKey));
                }
                return {
                  count: bucket?.count || 0,
                  countReal: bucket?.countReal || undefined,
                  mood: bucket?.mood || null,
                  energy: bucket?.energy || null,
                  anxiety: bucket?.anxiety || null,
                };
              })();
              return (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 68, overflow: 'visible' }} pointerEvents="box-none">
                  <PanGestureHandler
                    onHandlerStateChange={(e) => {
                      const state: any = (e.nativeEvent as any).state;
                      if (state === 4 /* ACTIVE */) {
                        setIsDraggingTooltip(true);
                      } else if (state === 5 /* END */ || state === 3 /* CANCELLED */) {
                        setIsDraggingTooltip(false);
                        setExternalSelectIndex(null);
                      }
                    }}
                    onGestureEvent={(e) => {
                      try {
                        const bucketCount = (chartSelection as any).bucketCount || 0;
                        if (!bucketCount) return;
                        const chartW = chartSelection.chartWidth || 0;
                        const contentW = Math.max(0, chartW - AXIS_WIDTH - RIGHT_LABEL_PAD);
                        const localX = (e.nativeEvent as any).x || 0; // within tooltip box
                        const absoluteX = left + localX; // relative to overlay/chart
                        let xPlot = absoluteX - AXIS_WIDTH;
                        xPlot = Math.max(0, Math.min(contentW - 1, xPlot));
                        const dw = contentW / Math.max(1, bucketCount);
                        let idx = Math.floor(xPlot / Math.max(1, dw));
                        idx = Math.max(0, Math.min(bucketCount - 1, idx));
                        setExternalSelectIndex(idx);
                        setIsDraggingTooltip(true);
                      } catch {}
                    }}
                  >
                    <Animated.View style={{ position: 'absolute', left, bottom: 0, opacity: tooltipOpacity, transform: [{ translateY: tooltipTransY }], zIndex: 1001 }}>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => openDetailForDate(chartSelection.date)}>
                      <View>
                        <View style={[
                          styles.tooltipBox,
                          { 
                            backgroundColor: theme.card,
                            minWidth: Math.min(280, Math.max(220, (chartSelection.chartWidth || 0) - 32)),
                            maxWidth: Math.max(220, (chartSelection.chartWidth || 0) - 16)
                          }
                        ]} onLayout={(e) => setTooltipWidth(e.nativeEvent.layout.width)}>
                          {/* Simplified tooltip content: mirror chart header (top-left) */}
                          <View>
                            <Text style={styles.entryCount}>
                              TOPLAM{'\n'}
                              <Text style={styles.entryCountValue}>{extended?.statistics?.totalEntries || 0} <Text style={styles.entryCountUnit}>giriş</Text></Text>
                            </Text>
                            <Text style={styles.dateRange}>{(() => {
                              const days = extended?.dailyAverages || [];
                              if (!days.length) return '';
                              const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                              if (range === 'day') {
                                const firstKey = String(days[0].date);
                                const ymd = firstKey.split('#')[0];
                                const d = new Date(`${ymd}T00:00:00.000Z`);
                                if (!isFinite(d.getTime())) return '';
                                return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
                              }
                              const start = new Date(days[0].date);
                              const end = new Date(days[days.length - 1].date);
                              if (range === 'week') return `${start.getDate()} ${months[start.getMonth()]}–${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
                              if (range === 'month') return `${months[start.getMonth()]} ${start.getFullYear()}`;
                              if (range === '6months') return `${months[start.getMonth()]}–${months[end.getMonth()]} ${end.getFullYear()}`;
                              return `${start.getFullYear()}`;
                            })()}</Text>
                          {/* Legacy tooltip content removed */}
                        </View>
                        </View>
                        {/* Arrow pointing down to bar */}
                        <View style={[styles.tooltipArrow, { backgroundColor: theme.card, left: pointerX }]} />
                      </View>
                    </TouchableOpacity>
                    </Animated.View>
                  </PanGestureHandler>
                </View>
              );
            })()}
          </View>
        )}
      </View>



      {/* Dominant emotion moved back to header (hidden while tooltip is open) */}

      {/* Top-3 emotion distribution kaldırıldı */}



      {/* M/E/A stats row removed; overlay visibility controlled via Settings */}

      {/* Detail modal - Apple Health Style */}
      {detailDate && (
        <AppleHealthDetailSheet
          visible={!!detailDate}
          date={detailDate}
          entries={detailEntries}
          range={range}
          onClose={() => setDetailDate(null)}
          onDeleted={(entryId) => {
            // Remove from local sheet state immediately
            setDetailEntries(prev => prev.filter(e => e.id !== entryId));
            // Refresh extended dataset so chart reflects deletion
            refreshExtended();
          }}
        />
      )}
    </View>
  );
  } catch (error) {
    console.error('MoodJourneyCard: Critical error caught:', error);
    // Return safe fallback UI instead of crashing
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', minHeight: 200 }]}>
        <Text style={{ color: '#EF4444', textAlign: 'center', fontSize: 14, fontWeight: '600' }}>
          Grafik yüklenirken hata
        </Text>
        <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 12, marginTop: 4 }}>
          Lütfen sayfayı yenileyin
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    marginBottom: 8,
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
  loadingContainer: {
    height: 252, // Same height as chart
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 8,
  },
  tooltipBox: {
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 200,
    maxWidth: 280,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 10,
  },
  tooltipStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  tooltipStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  tooltipArrow: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: Colors.ui.card,
    transform: [{ rotate: '45deg' }],
    bottom: -4,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  tooltipTitle: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
    marginBottom: 4,
  },
  tooltipTitleEmo: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  tooltipTitleParen: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
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
  dominantRowBelow: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  chipSmallLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginRight: 2,
  },
  chipSmallValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  // Header-like styles for tooltip content (mirrors chart header)
  entryCount: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  entryCountValue: {
    fontSize: 24,
    color: '#111827',
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'left',
  },
  entryCountUnit: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 4,
  },
  dateRange: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'left',
  },
  tapHint: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
  stat: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  // Removed legacy M/E/A stats styles
  // statValue duplicate removed
  // Fixed overlay area above chart for summary text (when no tooltip)
  chartTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 68,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartHeaderCount: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  chartHeaderCountValue: {
    fontSize: 24,
    color: '#000',
    fontWeight: '800',
    lineHeight: 28,
  },
  chartHeaderCountUnit: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 6,
  },
  chartHeaderDateRange: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
    marginTop: 2,
  },
  chartHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'left',
  },
  tooltipMetaValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  tooltipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
