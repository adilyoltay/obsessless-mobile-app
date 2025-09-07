import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Animated, Easing, ActivityIndicator } from 'react-native';
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
import { quantiles } from '@/utils/statistics';
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
};

// Color mapping centralized in utils/colorUtils.ts

export default function MoodJourneyCard({ data, initialOpenDate, initialRange }: Props) {
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
  const [visibleRanges, setVisibleRanges] = React.useState<TimeRange[]>(['day','week','month']);

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
              setVisibleRanges(parsed.visibleTimeRanges as TimeRange[]);
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
              {/* Right: Dominant emotion + trend (moved back to header) */}
              <View style={styles.chartHeaderRight}>
                <View style={styles.chip}>
                  <Text style={styles.chipLabel}>Baskın</Text>
                  <Text style={styles.chipValue}>{extended.statistics?.dominantEmotions?.[0]?.emotion || '—'}</Text>
                </View>
                {extended.weeklyTrend && (
                  <View>
                    {extended.weeklyTrend === 'up' && (
                      <Svg width={14} height={14} viewBox="0 0 14 14">
                        <Path d="M7 2 L12 10 L2 10 Z" fill="#10B981" />
                      </Svg>
                    )}
                    {extended.weeklyTrend === 'down' && (
                      <Svg width={14} height={14} viewBox="0 0 14 14">
                        <Path d="M7 12 L12 4 L2 4 Z" fill="#EF4444" />
                      </Svg>
                    )}
                    {extended.weeklyTrend === 'stable' && (
                      <Svg width={14} height={14} viewBox="0 0 14 14">
                        <Rect x="2" y="6" width="10" height="2" rx="1" fill="#6B7280" />
                      </Svg>
                    )}
                  </View>
                )}
              </View>
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
              // Compute dominant emotion for selected day/period
              const selectedDominant = (() => {
                if (!extended) return '—';
                let list: any[] = [];
                if (range === 'week') {
                  list = extended.rawDataPoints[chartSelection.date]?.entries || [];
                } else if (range === 'day') {
                  list = (extended.rawHourlyDataPoints as any)?.[chartSelection.date]?.entries || [];
                } else {
                  // Approximate from p50 mood
                  const agg = extended.aggregated?.data || [] as any[];
                  let bucket = agg.find((b: any) => b.date === chartSelection.date) as any;
                  if (!bucket && range === 'year') {
                    const monthKey = String(chartSelection.date).slice(0, 7);
                    bucket = agg.find((b: any) => (b as any).date?.startsWith(monthKey));
                  }
                  const m = Number(bucket?.mood?.p50 ?? bucket?.avg ?? 0);
                  if (!m) return '—';
                  return (
                    m >= 90 ? 'Heyecanlı' :
                    m >= 80 ? 'Enerjik'  :
                    m >= 70 ? 'Mutlu'    :
                    m >= 60 ? 'Sakin'    :
                    m >= 50 ? 'Normal'   :
                    m >= 40 ? 'Endişeli' :
                    m >= 30 ? 'Sinirli'  :
                    m >= 20 ? 'Üzgün'    : 'Kızgın'
                  );
                }
                if (!Array.isArray(list) || list.length === 0) return '—';
                const counts: Record<string, number> = {
                  'Heyecanlı': 0, 'Enerjik': 0, 'Mutlu': 0, 'Sakin': 0, 'Normal': 0,
                  'Endişeli': 0, 'Sinirli': 0, 'Üzgün': 0, 'Kızgın': 0,
                };
                list.forEach((e: any) => {
                  const m = Number(e?.mood_score || 0);
                  if (m >= 90) counts['Heyecanlı']++;
                  else if (m >= 80) counts['Enerjik']++;
                  else if (m >= 70) counts['Mutlu']++;
                  else if (m >= 60) counts['Sakin']++;
                  else if (m >= 50) counts['Normal']++;
                  else if (m >= 40) counts['Endişeli']++;
                  else if (m >= 30) counts['Sinirli']++;
                  else if (m >= 20) counts['Üzgün']++;
                  else counts['Kızgın']++;
                });
                const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).find(([,c]) => c>0)?.[0];
                return top || '—';
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
                          {/* Title: For day view show only dominant emotion centered; others show date + dominant */}
                          {(() => {
                            const dateKey = String(chartSelection.date);
                            const ymd = dateKey.includes('#') ? dateKey.split('#')[0] : dateKey;
                            const d = toUserLocalDate(`${ymd}T00:00:00.000Z`);
                            const locale = language === 'tr' ? 'tr-TR' : 'en-US';
                            const day = d.getDate();
                            const mon = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
                            const year = d.getFullYear();
                            const dow = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
                            const dateStr = `${day} ${mon} ${year}, ${dow}`;
                            const emo = selectedDominant || '';
                            const scoreFor = (emotion: string) => (
                              emotion === 'Heyecanlı' ? 95 :
                              emotion === 'Enerjik'  ? 85 :
                              emotion === 'Mutlu'    ? 75 :
                              emotion === 'Sakin'    ? 65 :
                              emotion === 'Normal'   ? 55 :
                              emotion === 'Endişeli' ? 45 :
                              emotion === 'Sinirli'  ? 35 :
                              emotion === 'Üzgün'    ? 25 : 55
                            );
                            const energyFor = (emotion: string) => (
                              emotion === 'Heyecanlı' ? 9 :
                              emotion === 'Enerjik'  ? 8 :
                              emotion === 'Mutlu'    ? 7 :
                              emotion === 'Sakin'    ? 5 :
                              emotion === 'Normal'   ? 6 :
                              emotion === 'Endişeli' ? 7 :
                              emotion === 'Sinirli'  ? 8 :
                              emotion === 'Üzgün' ? 3 : 9
                            );
                            const faceColor = (() => {
                              const ms = scoreFor(emo);
                              if (palette === 'braman') return getBramanMoodColor(ms);
                              if (palette === 'apple') return getAppleMoodColor(ms);
                              return getVAColorFromScores(ms, energyFor(emo));
                            })();
                            if (range === 'day' || range === 'week') {
                              return (
                                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <Svg width={13} height={13} viewBox="0 0 16 16" style={{ marginTop: 1 }}>
                                      <Circle cx={8} cy={8} r={6.2} stroke={faceColor} strokeWidth={1.3} fill="none" />
                                      <Circle cx={5.6} cy={6.3} r={0.75} fill={faceColor} />
                                      <Circle cx={10.4} cy={6.3} r={0.75} fill={faceColor} />
                                      <Path d="M5.2 9.2 C6.2 10.8, 9.8 10.8, 10.8 9.2" stroke={faceColor} strokeWidth={1.3} fill="none" strokeLinecap="round" />
                                    </Svg>
                                    <Text style={[styles.tooltipTitleEmo]}>{selectedDominant || '—'}</Text>
                                  </View>
                                </View>
                              );
                            }
                            return (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.tooltipTitle}>{dateStr}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={styles.tooltipTitleParen}>(</Text>
                                  <Svg width={14} height={14} viewBox="0 0 16 16" style={{ marginHorizontal: 2 }}>
                                    <Circle cx={8} cy={8} r={6.4} stroke={faceColor} strokeWidth={1.4} fill="none" />
                                    <Circle cx={5.6} cy={6.3} r={0.8} fill={faceColor} />
                                    <Circle cx={10.4} cy={6.3} r={0.8} fill={faceColor} />
                                    <Path d="M5.2 9.2 C6.2 10.8, 9.8 10.8, 10.8 9.2" stroke={faceColor} strokeWidth={1.4} fill="none" strokeLinecap="round" />
                                  </Svg>
                                  <Text style={styles.tooltipTitleParen}>{selectedDominant || '—'}</Text>
                                  <Text style={styles.tooltipTitleParen}>)</Text>
                                </View>
                              </View>
                            );
                          })()}
                          {/* Mini stats row with icons + values only */}
                          {(() => {
                            const mv = Number(((qData as any)?.mood?.p50 ?? NaN) as number);
                            const ev = Number(((qData as any)?.energy?.p50 ?? NaN) as number);
                            const av = Number(((qData as any)?.anxiety?.p50 ?? NaN) as number);
                            const moodColor = (() => {
                              const mvr = Number.isFinite(mv) ? Math.round(mv) : 55;
                              if (palette === 'braman') return getBramanMoodColor(mvr);
                              if (palette === 'apple') return getAppleMoodColor(mvr);
                              const evr = Number.isFinite(ev) ? Math.round(ev) : 6;
                              return getVAColorFromScores(mvr, evr);
                            })();
                            return (
                              <View style={styles.tooltipStatsRow}>
                                {/* Mood */}
                                <View style={styles.tooltipStatItem}>
                                  <Svg width={14} height={14} viewBox="0 0 16 16">
                                    <Circle cx={8} cy={8} r={6.6} stroke={moodColor} strokeWidth={1.4} fill="none" />
                                    <Circle cx={5.6} cy={6.3} r={0.8} fill={moodColor} />
                                    <Circle cx={10.4} cy={6.3} r={0.8} fill={moodColor} />
                                    <Path d="M5.2 9.2 C6.2 10.8, 9.8 10.8, 10.8 9.2" stroke={moodColor} strokeWidth={1.4} fill="none" strokeLinecap="round" />
                                  </Svg>
                                  <Text style={styles.tooltipStatValue}>{Number.isFinite(mv) ? `${Math.round(mv)}/100` : '—'}</Text>
                                </View>
                                {/* Energy */}
                                <View style={styles.tooltipStatItem}>
                                  <Svg width={14} height={14} viewBox="0 0 16 16">
                                    <Defs>
                                      <SvgLinearGradient id="batteryGradTip" x1="0" y1="0" x2="1" y2="0">
                                        {(() => {
                                          const stops = palette === 'braman'
                                            ? [
                                                { offset: '0%', color: '#F4A09C' },
                                                { offset: '50%', color: '#F5D99C' },
                                                { offset: '100%', color: '#94B49F' },
                                              ]
                                            : [
                                                { offset: '0%', color: '#EF4444' },
                                                { offset: '50%', color: '#F59E0B' },
                                                { offset: '100%', color: '#10B981' },
                                              ];
                                          return stops.map((s, i) => (
                                            <Stop key={i} offset={s.offset} stopColor={s.color} />
                                          ));
                                        })()}
                                      </SvgLinearGradient>
                                    </Defs>
                                    {(() => {
                                      const ratio = Number.isFinite(ev) ? Math.max(0, Math.min(1, ev / 10)) : 0;
                                      const levelColor = (() => {
                                        if (palette === 'braman') return ratio < 0.33 ? '#F4A09C' : ratio < 0.66 ? '#F5D99C' : '#94B49F';
                                        return ratio < 0.33 ? '#EF4444' : ratio < 0.66 ? '#F59E0B' : '#10B981';
                                      })();
                                      const maxW = 11 - 2; // inner padding eşleşmesi
                                      const w = Math.max(0.8, maxW * ratio);
                                      return (
                                        <>
                                          <Rect x={1.2} y={4} width={11} height={8} rx={2} ry={2} stroke={levelColor} strokeWidth={1.4} fill="none" />
                                          <Rect x={12.8} y={6} width={2} height={4} rx={0.8} ry={0.8} fill={levelColor} />
                                          <Rect x={2} y={5} width={w} height={6} rx={1} ry={1} fill={'url(#batteryGradTip)'} opacity={0.95} />
                                        </>
                                      );
                                    })()}
                                  </Svg>
                                  <Text style={styles.tooltipStatValue}>{Number.isFinite(ev) ? `${Math.round(ev)}/10` : '—'}</Text>
                                </View>
                                {/* Anxiety */}
                                <View style={styles.tooltipStatItem}>
                                  <Svg width={14} height={14} viewBox="0 0 16 16">
                                    {(() => {
                                      const ratio = Number.isFinite(av) ? Math.max(0, Math.min(1, av / 10)) : 0;
                                      const base = 10;
                                      const amp = 2 + (5.5 - 2) * ratio;
                                      const up = (base - amp).toFixed(2);
                                      const down = (base + amp).toFixed(2);
                                      const d = `M1.5 ${base} C3 ${up}, 5 ${down}, 7 ${base} C9 ${up}, 11 ${down}, 13 ${base}`;
                                      const strokeW = 1.2 + 0.6 * ratio;
                                      const anxColor = palette === 'braman' ? '#F4A09C' : '#EF4444';
                                      return <Path d={d} stroke={anxColor} strokeWidth={strokeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                                    })()}
                                  </Svg>
                                  <Text style={styles.tooltipStatValue}>{Number.isFinite(av) ? `${Math.round(av)}/10` : '—'}</Text>
                                </View>
                              </View>
                            );
                          })()}
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



      {/* Stats row (tap outside chart closes tooltip) */}
      <Pressable
        style={styles.statsRow}
        onPress={() => {
          if (chartSelection) {
            setChartSelection(null);
            setClearSignal(s => s + 1);
          }
        }}
      >
        {/* Mood (smile) */}
        <TouchableOpacity style={styles.statItem} disabled={moodLocked} onPress={() => { if (!moodLocked) setShowMoodLine(v => !v); }}>
          {(() => {
            const active = showMoodLine && !moodLocked;
            const mv = Number.isFinite(rangeStats.moodP50 as any) ? Math.round(rangeStats.moodP50 as number) : 55;
            const ev = Number.isFinite(rangeStats.energyP50 as any) ? Math.round(rangeStats.energyP50 as number) : 6;
            const c = active ? (palette === 'braman' ? getBramanMoodColor(mv) : palette === 'apple' ? getAppleMoodColor(mv) : getVAColorFromScores(mv, ev)) : '#9CA3AF';
            return (
              <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityLabel="Mood">
                <Circle cx={8} cy={8} r={6.6} stroke={c} strokeWidth={1.6} fill="none" />
                <Circle cx={5.6} cy={6.3} r={0.9} fill={c} />
                <Circle cx={10.4} cy={6.3} r={0.9} fill={c} />
                <Path d="M5.2 9.2 C6.2 10.8, 9.8 10.8, 10.8 9.2" stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" />
              </Svg>
            );
          })()}
          <Text style={[styles.statValue, (!showMoodLine || moodLocked) && { color: '#9CA3AF' }]}>
            {Number.isFinite(rangeStats.moodP50 as any) && (rangeStats.moodP50 as number) > 0 ? `${Math.round(rangeStats.moodP50 as number)}/100` : '—'}
          </Text>
        </TouchableOpacity>

        {/* Energy (battery) */}
        <TouchableOpacity style={styles.statItem} disabled={energyLocked} onPress={() => { if (!energyLocked) setShowEnergyLine(v => !v); }}>
          <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityLabel="Energy">
            <Defs>
              <SvgLinearGradient id="batteryGrad" x1="0" y1="0" x2="1" y2="0">
                {(() => {
                  const stops = palette === 'braman'
                    ? [
                        { offset: '0%', color: '#F4A09C' },
                        { offset: '50%', color: '#F5D99C' },
                        { offset: '100%', color: '#94B49F' },
                      ]
                    : [
                        { offset: '0%', color: '#EF4444' },
                        { offset: '50%', color: '#F59E0B' },
                        { offset: '100%', color: '#10B981' },
                      ];
                  return stops.map((s, i) => (
                    <Stop key={i} offset={s.offset} stopColor={s.color} />
                  ));
                })()}
              </SvgLinearGradient>
            </Defs>
            {(() => {
              const avg = Number(data.weeklyEnergyAvg || 0);
              const ratio = Math.max(0, Math.min(1, avg / 10));
              const levelColor = (() => {
                if (palette === 'braman') return ratio < 0.33 ? '#F4A09C' : ratio < 0.66 ? '#F5D99C' : '#94B49F';
                return ratio < 0.33 ? '#EF4444' : ratio < 0.66 ? '#F59E0B' : '#10B981';
              })();
              const maxW = 11 - 2; // inner padding
              const w = Math.max(0.8, maxW * ratio);
              const off = (!showEnergyLine || energyLocked);
              const strokeC = off ? '#9CA3AF' : levelColor;
              const capC = off ? '#9CA3AF' : levelColor;
              return (
                <>
                  {/* Battery body with dynamic stroke */}
                  <Rect x={1.2} y={4} width={11} height={8} rx={2} ry={2} stroke={strokeC} strokeWidth={1.4} fill="none" />
                  {/* Battery cap with dynamic fill */}
                  <Rect x={12.8} y={6} width={2} height={4} rx={0.8} ry={0.8} fill={capC} />
                  {/* Fill proportional to energy (1..10) */}
                  <Rect x={2} y={5} width={w} height={6} rx={1} ry={1} fill={off ? '#9CA3AF' : 'url(#batteryGrad)'} opacity={off ? 0.35 : 0.95} />
                </>
              );
            })()}
          </Svg>
          <Text style={[styles.statValue, (!showEnergyLine || energyLocked) && { color: '#9CA3AF' }]}>
            {Number.isFinite(rangeStats.energyP50 as any) && (rangeStats.energyP50 as number) > 0 ? `${Math.round(rangeStats.energyP50 as number)}/10` : '—'}
          </Text>
        </TouchableOpacity>

        {/* Anxiety (wavy line) */}
        <TouchableOpacity style={styles.statItem} disabled={anxietyLocked} onPress={() => { if (!anxietyLocked) setShowAnxietyLine(v => !v); }}>
          <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityLabel="Anxiety">
            {(() => {
              const raw = data.weeklyAnxietyAvg as any;
              const avg = (typeof raw === 'number' && raw > 0) ? Number(raw) : null;
              if (avg === null) return null; // veri yoksa ikon çizme
              const ratio = Math.max(0, Math.min(1, avg / 10));
              const base = 10;
              const ampMin = 2;
              const ampMax = 5.5;
              const amp = ampMin + (ampMax - ampMin) * ratio;
              const up = (base - amp).toFixed(2);
              const down = (base + amp).toFixed(2);
              const d = `M1.5 ${base} C3 ${up}, 5 ${down}, 7 ${base} C9 ${up}, 11 ${down}, 13 ${base}`;
              const strokeW = 1.4 + 0.8 * ratio; // 1.4..2.2
              return <Path d={d} stroke={showAnxietyLine && !anxietyLocked ? '#EF4444' : '#9CA3AF'} strokeWidth={strokeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
            })()}
          </Svg>
          <Text style={[styles.statValue, (!showAnxietyLine || anxietyLocked) && { color: '#9CA3AF' }]}>
            {Number.isFinite(rangeStats.anxietyP50 as any) && (rangeStats.anxietyP50 as number) > 0 ? `${Math.round(rangeStats.anxietyP50 as number)}/10` : '—'}
          </Text>
        </TouchableOpacity>
        {/* Dots toggle removed: unified visualization makes it redundant */}
      </Pressable>

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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
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
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontWeight: '800',
    letterSpacing: -0.2,
    marginRight: 2,
  },
  statLabelMood: { color: '#007AFF' },
  statLabelEnergy: { color: '#10B981' },
  statLabelAnxiety: { color: '#EF4444' },
  statSep: { color: '#6B7280', fontWeight: '400' },
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
