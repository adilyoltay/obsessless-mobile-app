import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Line, Text as SvgText, G } from 'react-native-svg';
import MoodFace from './mood/MoodFace';
import MoodEnergyGaugeArc from '@/components/mind/MoodEnergyGaugeArc';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getVAColorFromScores, getGradientFromBase, mixHex } from '@/utils/colorUtils';
import { to0100, weightedScore } from '@/utils/mindScore';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { BramanColors } from '@/constants/Colors';

export type DayMetrics = {
  date: string; // YYYY-MM-DD
  mood?: number | null; // 0–100
  energy?: number | null; // 0–100 (if 1–10 provided, auto-scales)
  anxiety?: number | null; // 0–100 (if 1–10 provided, auto-scales)
};

type Props = {
  week: DayMetrics[];
  title?: string;
  showSparkline?: boolean;
  gradientColors?: [string, string];
  loading?: boolean;
  emptyHint?: string;
  onQuickStart?: () => void;
  sparkStyle?: 'line' | 'bar';
  // Optional quality inputs from MoodJourneyExtended for 1:1 alignment
  moodVariance?: number; // if provided, overrides sd calc
  variant?: 'hero' | 'white';
  // Streak data
  streakCurrent?: number;
  streakBest?: number;
  streakLevel?: 'seedling' | 'warrior' | 'master';
  // UI: allow white variant to use status-colored background
  coloredBackground?: boolean;
  // Whether to colorize hero background; if false uses plain white
  colorized?: boolean;
  // Selected-day override for active face (0-100 weighted score)
  selectedDayScoreOverride?: number | null;
  // Dominant emotion label from active selection/range
  dominantLabel?: string | null;
  // Series-based trend percentage override (e.g., from selection/range)
  trendPctOverride?: number | null;
  // Period label for micro trend badge (e.g., '7g', '1a', '6a', '1y')
  periodLabelOverride?: string | null;
};

// ---- math helpers ----
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const roundInt = (n: number) => Math.round(n);

// to0100 and weightedScore moved to utils/mindScore

const stddev = (arr: number[]) => {
  if (arr.length <= 1) return 0;
  const mean = arr.reduce((s, n) => s + n, 0) / arr.length;
  const v = arr.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(v);
};

// ---- color helpers ---- (mixHex now imported from utils)

const ewma = (series: Array<number | null | undefined>) => {
  const vals = series.map(v => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const n = vals.length;
  if (n === 0) return [] as number[];
  const alpha = 2 / (n + 1); // default
  const out: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    const x = vals[i] != null ? (vals[i] as number) : prev;
    if (x == null) {
      // If nothing yet, assume neutral center 50
      prev = 50;
    } else if (prev == null) {
      prev = x; // seed
    } else {
      prev = alpha * x + (1 - alpha) * prev;
    }
    out.push(clamp(prev, 0, 100));
  }
  return out;
};

const sparkPath = (vals: number[], w = 120, h = 36) => {
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
  const y = (v: number) => h - ((v - min) / span) * (h - 4) - 2; // small vertical padding
  let d = `M 0 ${y(vals[0])}`;
  for (let i = 1; i < vals.length; i++) d += ` L ${i * stepX} ${y(vals[i])}`;
  return d;
};
// Smooth sparkline using Catmull–Rom to Bezier conversion
const sparkPathSmooth = (vals: number[], w = 120, h = 36, tension = 0.5) => {
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
  const toY = (v: number) => h - ((v - min) / span) * (h - 4) - 2;
  const pts = vals.map((v, i) => [i * stepX, toY(v)] as [number, number]);
  if (pts.length < 3) {
    return `M ${pts[0][0]} ${pts[0][1]} ${pts.length === 2 ? `L ${pts[1][0]} ${pts[1][1]}` : ''}`;
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) * (tension / 6);
    const c1y = p1[1] + (p2[1] - p0[1]) * (tension / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) * (tension / 6);
    const c2y = p2[1] - (p3[1] - p1[1]) * (tension / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

// Area under smooth sparkline path (closed to baseline)
const sparkAreaPathSmooth = (vals: number[], w = 120, h = 36, tension = 0.5) => {
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const stepX = vals.length > 1 ? w / (vals.length - 1) : w;
  const toY = (v: number) => h - ((v - min) / span) * (h - 4) - 2;
  const pts = vals.map((v, i) => [i * stepX, toY(v)] as [number, number]);
  if (pts.length === 1) {
    const [x0, y0] = pts[0];
    return `M ${x0} ${y0} L ${x0} ${h} Z`;
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || pts[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) * (tension / 6);
    const c1y = p1[1] + (p2[1] - p0[1]) * (tension / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) * (tension / 6);
    const c2y = p2[1] - (p3[1] - p1[1]) * (tension / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  // Close to baseline
  const lastX = pts[pts.length - 1][0];
  d += ` L ${lastX} ${h} L 0 ${h} Z`;
  return d;
};

const energyLabel = (avg0100: number | null) => {
  if (avg0100 == null) return { label: '—', color: '#9CA3AF' };
  if (avg0100 < 40) return { label: 'Düşük', color: '#F59E0B' };
  if (avg0100 <= 70) return { label: 'Orta', color: '#10B981' };
  return { label: 'Yüksek', color: '#34C759' };
};

const stabilityLabel = (sd: number) => {
  if (sd < 6) return { label: 'Stabil', color: '#10B981' };
  if (sd < 12) return { label: 'Dalgalı', color: '#F59E0B' };
  return { label: 'Çok Dalgalı', color: '#EF4444' };
};

// Confidence chip removed for end-user simplicity

const Arrow = ({ delta, palette, mode = 'abs', prev }: { delta: number; palette?: 'apple' | 'braman' | string; mode?: 'abs' | 'pct'; prev?: number }) => {
  const threshold = 1.5;
  const up = delta > threshold;
  const down = delta < -threshold;
  const green = palette === 'apple' ? '#34C759' : (palette === 'braman' ? BramanColors.güvenli : '#10B981');
  const red = palette === 'apple' ? '#FF3B30' : (palette === 'braman' ? BramanColors.coral : '#EF4444');
  const neutral = palette === 'apple' ? '#AEAEB2' : (palette === 'braman' ? BramanColors.medium : '#6B7280');
  const color = up ? green : down ? red : neutral;
  const arrow = up ? '↑' : down ? '↓' : '→';
  let label = '';
  if (mode === 'pct' && typeof prev === 'number' && isFinite(prev) && prev !== 0) {
    const pct = Math.round((delta / Math.max(1, prev)) * 100);
    const absPct = Math.abs(pct);
    label = up ? `+${absPct}%` : down ? `-${absPct}%` : `${absPct}%`;
  } else {
    const abs = Math.abs(Math.round(delta));
    label = up ? `+${abs}` : down ? `-${abs}` : `${abs}`;
  }
  return <Text style={{ color }}>{arrow} {label}</Text>;
};

const Chip = ({ label, accentColor, onGradient, icon, style, textStyle }: { label: string; accentColor?: string; onGradient?: boolean; icon?: React.ReactNode; style?: any; textStyle?: any }) => (
  <View style={[onGradient ? styles.chipOnGradient : styles.chip, onGradient ? styles.chipOnGradientBorder : styles.chipBorder, style]}>
    {accentColor && (
      <View style={[styles.dot, { backgroundColor: accentColor, opacity: onGradient ? 0.95 : 1 }]} />
    )}
    {icon}
    <Text style={[onGradient ? styles.chipTextOnGradient : styles.chipText, textStyle]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

export default function MindScoreCard({ week, title = 'Zihin Skoru', showSparkline = true, gradientColors = ['#34d399', '#059669'], loading, emptyHint, onQuickStart, sparkStyle = 'line', moodVariance, variant = 'hero', streakCurrent = 0, streakBest = 0, streakLevel = 'seedling', coloredBackground = false, colorized = false, selectedDayScoreOverride = null, dominantLabel = null, trendPctOverride = null, periodLabelOverride = null }: Props) {
  const { palette } = useAccentColor();
  console.log('🚀 MindScoreCard props:', { streakCurrent, streakBest, streakLevel, variant, coloredBackground });
  // Normalize and sort by date ascending
  const days = useMemo(() => {
    const copy = [...(week || [])];
    copy.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return copy;
  }, [week]);

  const dailyScores = useMemo(() => days.map(d => weightedScore(d.mood, d.energy, d.anxiety)), [days]);
  const smoothed = useMemo(() => ewma(dailyScores), [dailyScores]);

  const scoreNow = useMemo(() => {
    if (!smoothed.length) return null;
    return clamp(smoothed[smoothed.length - 1], 0, 100);
  }, [smoothed]);

  const delta = useMemo(() => {
    if (smoothed.length < 2) return 0;
    return smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2];
  }, [smoothed]);
  const prevScore = useMemo(() => {
    if (smoothed.length < 2) return null;
    return clamp(smoothed[smoothed.length - 2], 0, 100);
  }, [smoothed]);

  const sdCalc = useMemo(() => {
    if (typeof moodVariance === 'number' && Number.isFinite(moodVariance)) return Math.sqrt(Math.max(0, moodVariance));
    return stddev(dailyScores.filter((v): v is number => typeof v === 'number'));
  }, [dailyScores, moodVariance]);
  const stab = stabilityLabel(sdCalc);

  const avgMood = useMemo(() => {
    const vals = days.map(d => to0100(d.mood)).filter((n): n is number => typeof n === 'number');
    if (!vals.length) return null;
    return vals.reduce((s, n) => s + n, 0) / vals.length;
  }, [days]);
  const avgEnergy0100 = useMemo(() => {
    const vals = days.map(d => to0100(d.energy)).filter((n): n is number => typeof n === 'number');
    if (!vals.length) return null;
    return vals.reduce((s, n) => s + n, 0) / vals.length;
  }, [days]);
  const avgEnergyLabel = energyLabel(avgEnergy0100);

  // Confidence removed

  const baseColor = useMemo(() => {
    const moodRef = (avgMood != null ? avgMood : (typeof scoreNow === 'number' ? scoreNow : 50));
    const e10 = avgEnergy0100 != null ? avgEnergy0100 / 10 : 6;
    const color = getVAColorFromScores(moodRef, e10);
    console.log('🎨 BaseColor calculation:', { moodRef, e10, resultColor: color, avgMood, avgEnergy0100, scoreNow });
    return color;
  }, [avgMood, avgEnergy0100, scoreNow]);

  const spark = useMemo(() => sparkPath((dailyScores.map(v => (typeof v === 'number' ? v : null))
    .map((v, i, arr) => v == null ? (i > 0 ? (arr[i - 1] as any) : 50) : v) as number[])), [dailyScores]);
  // Trend spark + progress colors harmonized with baseColor (even softer/pastel)
  const sparkStroke = useMemo(() => {
    const result = (palette === 'apple') ? '#007AFF' : mixHex(baseColor, '#FFFFFF', 0.3);
    console.log('🎨 MindScoreCard: baseColor =', baseColor, ', palette =', palette, ', sparkStroke =', result);
    return result;
  }, [baseColor, palette]);
  const areaTopColor = useMemo(() => mixHex(baseColor, '#FFFFFF', 0.35), [baseColor]);
  const areaTopOpacity = 0.22; // slightly stronger highlight

  // ---- UI ----
  const isLoading = !!loading;
  const isEmpty = !isLoading && (!days.length || dailyScores.filter((v): v is number => typeof v === 'number').length === 0);
  console.log('📊 MindScoreCard debug:', { 
    isLoading, 
    isEmpty, 
    daysLength: days.length, 
    validScores: dailyScores.filter((v): v is number => typeof v === 'number').length, 
    variant, 
    showSparkline,
    scoreNow,
    delta,
    stabLabel: stab.label,
    avgEnergyLabel: avgEnergyLabel.label,
    streakCurrent,
    coloredBackground,
    baseColor,
    sparkStroke
  });
  const progress = typeof scoreNow === 'number' ? scoreNow / 100 : 0;
  const size = 64; // legacy ring size (kept for spacing)
  const r = 28;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const [heroSparkWidth, setHeroSparkWidth] = React.useState(0);
  const [whiteFooterW, setWhiteFooterW] = React.useState(0);
  const todayLabel = useMemo(() => {
    try {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      const mon = months[d.getMonth()] || '';
      return `• ${day} ${mon}`;
    } catch { return '•'; }
  }, []);

  // Palette-aware score chip background/border
  const scoreChipPaletteStyle = useMemo(() => {
    if (palette === 'apple') {
      return {
        backgroundColor: 'rgba(10,132,255,0.22)', // iOS system blue (lighter)
        borderColor: 'rgba(10,132,255,0.85)',
      } as const;
    }
    if (palette === 'braman') {
      return {
        backgroundColor: 'rgba(58,58,58,0.35)', // charcoal tint
        borderColor: 'rgba(255,255,255,0.55)',
      } as const;
    }
    return {
      backgroundColor: 'rgba(0,0,0,0.28)',
      borderColor: 'rgba(255,255,255,0.65)'
    } as const;
  }, [palette]);

  if (variant === 'white') {
    // Dynamic status background derived from stability (stddev)
    const statusBase = (() => {
      if (palette === 'braman') {
        return stab.label === 'Stabil' ? BramanColors.güvenli : (stab.label === 'Dalgalı' ? BramanColors.yellow : BramanColors.coral);
      }
      if (palette === 'apple') {
        return stab.label === 'Stabil' ? '#34C759' : (stab.label === 'Dalgalı' ? '#FF9500' : '#FF3B30');
      }
      return stab.label === 'Stabil' ? '#10B981' : (stab.label === 'Dalgalı' ? '#F59E0B' : '#EF4444');
    })();
    const norm = (x: number, a: number, b: number) => {
      if (b <= a) return 0; return Math.max(0, Math.min(1, (x - a) / (b - a)));
    };
    // Weight controls how strong the tint is against white (lower = daha pastel)
    // Calmer palette: overall weights downscaled
    let w = 0.12; // base tint (more pastel)
    if (stab.label === 'Stabil') w = 0.10 + 0.05 * norm(sdCalc, 0, 6);
    else if (stab.label === 'Dalgalı') w = 0.11 + 0.06 * norm(sdCalc, 6, 12);
    else w = 0.12 + 0.08 * norm(sdCalc, 12, 24); // Çok Dalgalı
    w = Math.max(0.08, Math.min(0.20, w));
    const statusBg = mixHex('#FFFFFF', statusBase, w);
    // Fade between background tints when status changes
    const [currTint, setCurrTint] = React.useState<string>(statusBg);
    const [prevTint, setPrevTint] = React.useState<string | null>(null);
    const tintAV = React.useRef(new Animated.Value(1)).current;
    React.useEffect(() => {
      if (!coloredBackground) return;
      if (currTint === statusBg) return;
      setPrevTint(currTint);
      setCurrTint(statusBg);
      try {
        tintAV.stopAnimation();
        tintAV.setValue(0);
        Animated.timing(tintAV, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusBg, coloredBackground]);
    const wSize = 80;
    const wR = 36;
    const wC = 2 * Math.PI * wR;
    const wProgress = typeof scoreNow === 'number' ? scoreNow / 100 : 0;
    return (
      <View style={[styles.whiteCard, { backgroundColor: '#FFFFFF' }]}> 
        {coloredBackground && (
          <>
            <View style={[StyleSheet.absoluteFill as any, { backgroundColor: (prevTint || currTint), borderRadius: 24 }]} pointerEvents="none" />
            <Animated.View style={[StyleSheet.absoluteFill as any, { opacity: tintAV, backgroundColor: currTint, borderRadius: 24 }]} pointerEvents="none" />
          </>
        )}
        <View style={styles.whiteRow}>
          <Svg width={wSize} height={wSize} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={wSize/2} cy={wSize/2} r={wR} stroke="#F3F4F6" strokeWidth={4} fill="none" />
            <Circle
              cx={wSize/2}
              cy={wSize/2}
              r={wR}
              stroke={baseColor}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${wC}`}
              strokeDashoffset={wC - wC * wProgress}
            />
          </Svg>
          <View style={styles.whiteScoreCenter} pointerEvents="none">
            <Text style={styles.whiteScoreText}>{scoreNow != null ? roundInt(scoreNow) : (isLoading ? '…' : '—')}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
          <View style={styles.whiteHeaderRow}>
              <Text style={styles.whiteTitle} numberOfLines={1}>{title}</Text>
              <View style={styles.whiteTrendRow}>
                {(() => {
                  const threshold = 1.5;
                  const dir = delta > threshold ? 'up' : delta < -threshold ? 'down' : 'same';
                  const color = dir === 'up' ? '#10B981' : dir === 'down' ? '#EF4444' : '#6B7280';
                  return (
                    <Svg width={18} height={18} viewBox="0 0 18 18" style={{ marginRight: 4 }}>
                      {dir === 'up' && (
                        <>
                          <Path d="M2 12 L7.2 8 L10.8 10.6 L16 5.2" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <Path d="M15 6.8 L16 5.2 L14.4 4.2 Z" fill={color} />
                        </>
                      )}
                      {dir === 'down' && (
                        <>
                          <Path d="M2 6 L6.8 9.6 L10.4 7 L16 12.2" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <Path d="M15.2 10.6 L16 12.2 L14.4 13.2 Z" fill={color} />
                        </>
                      )}
                      {dir === 'same' && (
                        <Path d="M3 9 L15 9" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
                      )}
                    </Svg>
                  );
                })()}
                <Text style={[styles.whiteTrend, { color: (delta > 0.5 ? '#10B981' : delta < -0.5 ? '#EF4444' : '#6B7280') }]} numberOfLines={1}>
                  {(() => { const abs = Math.abs(Math.round(delta)); return delta > 0.5 ? `+${abs}` : delta < -0.5 ? `-${abs}` : `${abs}`; })()}
                </Text>
              </View>
            </View>
            {/* Alt alta bilgi: Sadece değerler (Durum/Enerji etiketleri olmadan) */}
            <View style={styles.chipsVertical}>
              {/* Üst: Durum (yalnızca değer) */}
              <View style={styles.chipOnWhite}>
                {(() => {
                  const getStatusIcon = () => {
                    switch (stab.label) {
                      case 'Stabil': return { name: 'check-circle', color: '#10B981' };
                      case 'Dalgalı': return { name: 'alert-triangle', color: '#F59E0B' };
                      case 'Çok Dalgalı': return { name: 'alert-circle', color: '#EF4444' };
                      default: return { name: 'information', color: '#6B7280' };
                    }
                  };
                  const statusIcon = getStatusIcon();
                  return (
                    <MaterialCommunityIcons name={statusIcon.name as any} size={18} color={statusIcon.color} style={{ marginRight: 10 }} />
                  );
                })()}
                <View style={styles.chipTextCol}>
                  <Text style={[styles.chipOnWhiteValue, { 
                    color: stab.label === 'Stabil' ? '#10B981' : stab.label === 'Dalgalı' ? '#F59E0B' : stab.label === 'Çok Dalgalı' ? '#EF4444' : '#6B7280',
                    fontWeight: '700' 
                  }]} numberOfLines={1}>
                    {stab.label}
                  </Text>
                </View>
              </View>
              
              {/* Alt: Enerji */}
              <View style={styles.chipOnWhite}>
                {/* Pil ikonu - enerji değerine göre renkli */}
                <View style={{ marginRight: 10 }}>
                  <Svg width={18} height={18} viewBox="0 0 16 16">
                    <Defs>
                      <SvgLinearGradient id="batteryGradient" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0%" stopColor="#EF4444" />
                        <Stop offset="50%" stopColor="#F59E0B" />
                        <Stop offset="100%" stopColor="#10B981" />
                      </SvgLinearGradient>
                    </Defs>
                    {(() => {
                      const avg = avgEnergy0100 || 50; // 0-100 skala
                      const ratio = Math.max(0, Math.min(1, avg / 100));
                      const levelColor = ratio < 0.33 ? '#EF4444' : ratio < 0.66 ? '#F59E0B' : '#10B981';
                      const maxW = 11 - 2; // inner padding
                      const w = Math.max(0.8, maxW * ratio);
                      const strokeC = levelColor;
                      const capC = levelColor;
                      return (
                        <>
                          {/* Battery body with dynamic stroke */}
                          <Rect x={1.2} y={4} width={11} height={8} rx={2} ry={2} stroke={strokeC} strokeWidth={1.4} fill="none" />
                          {/* Battery cap with dynamic fill */}
                          <Rect x={12.8} y={6} width={2} height={4} rx={0.8} ry={0.8} fill={capC} />
                          {/* Fill proportional to energy */}
                          <Rect x={2} y={5} width={w} height={6} rx={1} ry={1} fill="url(#batteryGradient)" opacity={0.95} />
                        </>
                      );
                    })()}
                  </Svg>
                </View>
                <View style={styles.chipTextCol}>
                  <Text style={[styles.chipOnWhiteValue, { color: '#111827', fontWeight: '700' }]} numberOfLines={1}>{avgEnergyLabel.label}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        {/* Sparkline veya dekoratif dalga */}
        <View style={{ marginTop: 12 }} onLayout={(e) => setWhiteFooterW(Math.round(e.nativeEvent.layout.width))}>
          {showSparkline && !isEmpty ? (
            sparkStyle === 'line' ? (
              // Trend çizgisi sparkline
              <Svg width="100%" height={24}>
                <Path 
                  d={sparkPath((dailyScores.map(v => (typeof v === 'number' ? v : null))
                    .map((v, i, arr) => v == null ? (i > 0 ? (arr[i - 1] as any) : 50) : v) as number[]), Math.max(120, whiteFooterW || 0), 24)} 
                  stroke={sparkStroke} 
                  strokeWidth={3.5} 
                  fill="none" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </Svg>
            ) : (
              // Progress bar sparkline
              <View style={styles.whiteProgressBarOuter}>
                <View style={[styles.whiteProgressBarInner, { width: `${Math.round(progress * 100)}%`, backgroundColor: sparkStroke }]} />
              </View>
            )
          ) : (
            // Dekoratif dalga (veri yoksa)
            <Svg width="100%" height={12}>
              {(() => {
                const W = Math.max(120, whiteFooterW || 0);
                const H = 10;
                const A = 2.8; // amplitude (Kontrastlı)
                const P = 24;  // period (px)
                let d = `M 0 ${H/2}`;
                for (let x = 0; x <= W + P; x += P) {
                  const c1x = x + P * 0.25; const c1y = H/2 - A;
                  const c2x = x + P * 0.75; const c2y = H/2 + A;
                  const ex = x + P; const ey = H/2;
                  d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
                }
                return <Path d={d} stroke="#E5E7EB" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
              })()}
            </Svg>
          )}
        </View>
        
        {/* Streak info - integrated below sparkline */}
        {!isEmpty && (
          <View style={[styles.streakIntegrated, { borderTopColor: (() => {
            // subtle border tint by palette/accent
            const accent = palette === 'apple' ? '#007AFF' : baseColor;
            return mixHex('#FFFFFF', accent, 0.90);
          })() }]}>
            {(() => {
              // color harmonized with background tint
              const statusBase = stab.label === 'Stabil' ? '#10B981' : (stab.label === 'Dalgalı' ? '#F59E0B' : '#EF4444');
              const tone = coloredBackground ? statusBase : '#374151';
              return (
                <>
                  <View style={styles.streakIconContainer}>
                    <MaterialCommunityIcons 
                      name={streakCurrent === 0 ? "fire-off" : "fire"}
                      size={24} 
                      color={palette === 'apple' ? '#007AFF' : baseColor}
                    />
                  </View>
                  <View style={[styles.streakTextContainer, { marginRight: 0 }]}>
                    <Text style={[styles.streakCountText, { color: (palette === 'apple' ? '#007AFF' : baseColor), fontSize: 20 }]}>
                      {streakCurrent}
                    </Text>
                  </View>
                  {streakLevel !== 'seedling' && (
                    <View style={styles.streakLevelBadge}>
                      <MaterialCommunityIcons 
                        name={
                          streakLevel === 'master' ? 'meditation' :
                          streakLevel === 'warrior' ? 'sword-cross' : 'sprout'
                        }
                        size={14} 
                        color="#6B7280"
                      />
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        )}
        
        {isEmpty && (
          <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <Text style={styles.emptyTextWhite}>{emptyHint || 'Skorunu görmek için veri ekle.'}</Text>
            {onQuickStart && (
              <Pressable onPress={onQuickStart} style={styles.quickStartBtnWhite} hitSlop={8}>
                <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#111827" />
                <Text style={styles.quickStartTextWhite}>Hızlı Başla</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  // Minimal Face Gauge mode for hero variant (temporary):
  // Title, chips, extended details HIDDEN. Shows only segmented arc + pointer + ring faces + center score + bottom progress + streak + micro trend.
  if (variant === 'hero') {
    const [gaugeW, setGaugeW] = React.useState(0);
    // Animate active face when override changes
    const activeFaceScale = React.useRef(new Animated.Value(1)).current;
    const lastActiveIdxRef = React.useRef<number | null>(null);
    // Score used for visual pointers/faces/gradient (selected day when present)
    const faceScore = typeof selectedDayScoreOverride === 'number' ? selectedDayScoreOverride : (typeof scoreNow === 'number' ? scoreNow : 50);
    // Smooth pointer angle animation (degrees)
    const initialAng = -180 + faceScore * 1.8;
    const pointerAV = React.useRef(new Animated.Value(initialAng)).current;
    const [pointerAngle, setPointerAngle] = React.useState<number>(initialAng);
    React.useEffect(() => {
      const id = pointerAV.addListener(({ value }) => setPointerAngle(value));
      return () => { try { pointerAV.removeListener(id); } catch {} };
    }, [pointerAV]);
    React.useEffect(() => {
      const target = -180 + faceScore * 1.8;
      try {
        Animated.spring(pointerAV, { toValue: target, friction: 7, tension: 60, useNativeDriver: false }).start();
      } catch {
        setPointerAngle(target);
      }
    }, [faceScore, pointerAV]);
    // Palette-based ring colors
    const ringColors = useMemo(() => {
      if (palette === 'apple') {
        return ['#FF3B30', '#FF9F0A', '#FFD60A', '#30D158', '#1D7F34'] as string[];
      }
      if (palette === 'braman') {
        const badDeep = mixHex(BramanColors.coral, '#000000', 0.18);
        const bad = BramanColors.coral;
        const mid = BramanColors.yellow;
        // Warm sage: güvenli (sage) biraz daha sıcak için sarıyla karıştır
        const goodWarm = mixHex(BramanColors.güvenli, BramanColors.yellow, 0.22);
        // Very good: teal'i bir miktar koyulaştır
        const vgoodCool = mixHex(BramanColors.teal, '#000000', 0.12);
        return [badDeep, bad, mid, goodWarm, vgoodCool] as string[];
      }
      // VA/classic more saturated
      return ['#D32F2F', '#F57C00', '#FBC02D', '#009688', '#1B5E20'] as string[];
    }, [palette]);
    // Align background with face/ring segment color derived from current score
    const segIdx = (() => {
      const s = faceScore;
      return s <= 20 ? 0 : s <= 40 ? 1 : s <= 60 ? 2 : s <= 80 ? 3 : 4;
    })();
    const segColor = (ringColors && ringColors[segIdx]) || (gradientColors?.[0] || '#34d399');
    // Softer gradient; add cross-fade between gradients when score changes
    const PASTEL_TOP = 0.40; // base pastel
    const PASTEL_BOTTOM = 0.24;
    const GRAD_FADE_MS = 300;
    const makeCardGrad = React.useCallback((base: string) => {
      let top = PASTEL_TOP;
      let bottom = PASTEL_BOTTOM;
      if (palette === 'apple') { top += 0.04; bottom += 0.04; }
      else if (palette === 'braman') { top += 0.02; bottom += 0.02; }
      return [
        mixHex(base, '#FFFFFF', top),
        mixHex(base, '#FFFFFF', bottom),
      ] as [string, string];
    }, [palette]);
    const [currGrad, setCurrGrad] = React.useState<[string, string]>(() => makeCardGrad(segColor));
    const [prevGrad, setPrevGrad] = React.useState<[string, string] | null>(null);
    const gradAV = React.useRef(new Animated.Value(1)).current;
    React.useEffect(() => {
      const ng = makeCardGrad(segColor);
      setPrevGrad(currGrad);
      setCurrGrad(ng);
      try {
        gradAV.stopAnimation();
        gradAV.setValue(0);
        Animated.timing(gradAV, { toValue: 1, duration: GRAD_FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segIdx]);
    
    return (
      <View style={styles.heroCard}>
        {/* Background coloring disabled: keep neutral white background */}
        <View style={styles.plainBg} />
        {/* Dominant emotion top-left (label only, no bg/border, colored as active segment) */}
        {dominantLabel && (() => {
          const activeColor = (ringColors && typeof segIdx === 'number' && ringColors[segIdx]) ? ringColors[segIdx] : '#111827';
          return (
            <View style={styles.dominantTopLeft}>
              <Text
                style={[
                  styles.dominantChipValue,
                  { 
                    color: activeColor,
                    textShadowColor: '#E5E7EB',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 2.5,
                  }
                ]}
                numberOfLines={1}
              >
                {dominantLabel}
              </Text>
            </View>
          );
        })()}
        {/* Micro trend top-right (percentage + tiny period badge) */}
        {(() => {
          // Prefer override from parent (selection/range); else compute from smoothed
          let pct: number | null = null;
          if (typeof trendPctOverride === 'number' && Number.isFinite(trendPctOverride)) {
            pct = Math.round(trendPctOverride as number);
          } else {
            const series = smoothed || [];
            if (series.length >= 2) {
              const base = series[0];
              const curr = series[series.length - 1];
              if (Number.isFinite(base) && base !== 0 && Number.isFinite(curr)) {
                pct = Math.round(((curr - base) / Math.max(1, base)) * 100);
              }
            }
          }
          const color = (pct ?? 0) < 0 ? '#EF4444' : (pct ?? 0) > 0 ? '#10B981' : '#6B7280';
          const arrow = (pct ?? 0) < 0 ? '▼' : (pct ?? 0) > 0 ? '▲' : '→';
          const label = pct != null ? (pct > 0 ? `+${pct}%` : `${pct}%`) : '—%';
          const current = periodLabelOverride || '7g';
          const compare = current === '1g' ? '7g' : current === '7g' ? '1a' : current === '1a' ? '6a' : current === '6a' ? '1y' : '—';
          return (
            <View style={styles.trendTopRight}>
              <Text style={[styles.microTrendText, { color }]} numberOfLines={1}>{arrow} {label}</Text>
              <View style={styles.microTrendBadge}>
                <Text style={styles.microTrendBadgeText}>{`${current}/${compare}`}</Text>
              </View>
            </View>
          );
        })()}
        <View style={styles.faceGaugeWrap}>
          <View style={styles.faceGaugeArea} onLayout={(e) => setGaugeW(Math.round(e.nativeEvent.layout.width))}>
          <Svg width="100%" height={224} viewBox="0 0 300 224">
            {(() => {
              const cx = 150, cy = 184, r = 108, seg = 36; // more vertical space, slightly smaller ring
              const colors = ringColors;
              const arc = (a0: number, a1: number) => {
                const to = (a: number) => {
                  const rad = Math.PI / 180 * a;
                  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as [number, number];
                };
                const p0 = to(a0), p1 = to(a1);
                const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
                return `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]}`;
              };
              return (
                <>
                  {colors.map((c, i) => {
                    const start = -180 + i * seg;
                    const end = start + seg;
                    const strokeC = colorized ? c : (i === segIdx ? c : '#D1D5DB');
                    return (
                      <G key={`seg-wrap-${i}`}>
                        <Path d={arc(start + 2, end - 2)} stroke={strokeC} strokeWidth={16} strokeLinecap="butt" fill="none" opacity={colorized ? (i === segIdx ? 0.95 : 0.45) : 1} />
                        {/* Removed extra black outline on active segment per request */}
                      </G>
                    );
                  })}
                  {(() => {
                    // Subtle outlines only at the far ends
                    const outlines = [] as any[];
                    const s0 = -180 + 0 * seg, e0 = s0 + seg;
                    outlines.push(
                      <Path key={`seg-outline-start`} d={arc(s0 + 2, e0 - 2)} stroke="#000" strokeOpacity={0.10} strokeWidth={1} strokeLinecap="butt" fill="none" />
                    );
                    const s4 = -180 + 4 * seg, e4 = s4 + seg;
                    outlines.push(
                      <Path key={`seg-outline-end`} d={arc(s4 + 2, e4 - 2)} stroke="#000" strokeOpacity={0.10} strokeWidth={1} strokeLinecap="butt" fill="none" />
                    );
                    // Divider lines between segments
                    const seps = [-144, -108, -72, -36];
                    seps.forEach((a, idx) => {
                      const rad = Math.PI / 180 * a;
                      const ri = r - 10; const ro = r + 10;
                      const x1 = cx + ri * Math.cos(rad); const y1 = cy + ri * Math.sin(rad);
                      const x2 = cx + ro * Math.cos(rad); const y2 = cy + ro * Math.sin(rad);
                      outlines.push(
                        <Line key={`sep-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.5} strokeLinecap="butt" />
                      );
                    });
                    return outlines;
                  })()}
                </>
              );
            })()}
            {/* subtle base arc */}
            <Path d={`M ${42} ${184} A ${108} ${108} 0 1 1 ${258} ${184}`} stroke="rgba(255,255,255,0.28)" strokeWidth={1} fill="none" />
            {/* pointer */}
            {(() => {
              const cx = 150, cy = 184, r = 108;
              const rad = Math.PI / 180 * (pointerAngle);
              const x2 = cx + (r - 22) * Math.cos(rad);
              const y2 = cy + (r - 22) * Math.sin(rad);
              return (
                <>
                  <Circle cx={cx} cy={cy} r={12} fill="rgba(17,24,39,0.9)" />
                  <Line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#0F172A" strokeWidth={3.8} strokeLinecap="round" />
                </>
              );
            })()}
          </Svg>
          {/* ring faces overlay */}
          {(() => {
            const faces = [10, 30, 50, 70, 90];
            const angles = [-162, -126, -90, -54, -18];
            const W = Math.max(1, gaugeW || 300);
            const scale = W / 300;
            const cx = 150 * scale, cy = 184 * scale, r = 146 * scale; // faces radius adjusted per request
            const baseSize = 32 * scale; // make all faces a bit smaller
            const activeIdx = (() => {
              const s = faceScore;
              if (s <= 20) return 0; if (s <= 40) return 1; if (s <= 60) return 2; if (s <= 80) return 3; return 4;
            })();
            // Kick a subtle bounce when active face changes
            React.useEffect(() => {
              if (lastActiveIdxRef.current === activeIdx) return;
              lastActiveIdxRef.current = activeIdx;
              try {
                activeFaceScale.stopAnimation();
                activeFaceScale.setValue(0.94);
                Animated.sequence([
                  Animated.timing(activeFaceScale, { toValue: 1.08, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                  Animated.timing(activeFaceScale, { toValue: 1.0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                ]).start();
              } catch {}
            }, [activeIdx]);
            return (
              <View style={styles.faceRingOverlay} pointerEvents="none">
                {faces.map((sc, i) => {
                  const ang = angles[i] * Math.PI / 180;
                  const size = i === activeIdx ? baseSize * 1.32 : baseSize; // enlarge active face a bit more
                  const x = cx + r * Math.cos(ang) - size / 2;
                  const y = cy + r * Math.sin(ang) - size / 2;
                  // Renksiz modda: aktif yüz tek vurgu (#4B5563), diğerleri açık gri (#D1D5DB)
                  const GREY_LIGHT: [string, string, string, string, string] = ['#D1D5DB', '#D1D5DB', '#D1D5DB', '#D1D5DB', '#D1D5DB'];
                  const facePalette = (!colorized) ? (i === activeIdx ? (ringColors as any) : GREY_LIGHT) : (ringColors as any);
                  const faceOpacity = colorized ? (i === activeIdx ? 1 : 0.5) : 1;
                  return (
                    <View key={`ringface-${i}`} style={{ position: 'absolute', left: x, top: y, alignItems: 'center', justifyContent: 'center' }}>
                      {/* Active face halo + highlight ring (no radial gradient dependency) */}
                      {i === activeIdx && (
                        <>
                          {(() => {
                            const sVal = faceScore;
                            const t = Math.max(0, Math.min(1, sVal / 100));
                            // Halo boyutu: düşük skor -> büyük; yüksek skor -> küçük
                            const haloExtra = 12 + (24 - 12) * (1 - t); // 12..24 px
                            const offset = -haloExtra / 2;
                            const haloW = size + haloExtra;
                            // Palette-balanced halo opacity (black halo)
                            const haloOpacity = colorized ? (palette === 'apple' ? 0.28 : (palette === 'braman' ? 0.22 : 0.20)) : 0.12;
                            const haloFill = colorized ? '#000000' : '#000000';
                            return (
                              <Svg width={haloW} height={haloW} style={{ position: 'absolute', left: offset, top: offset }}>
                                <Circle cx={haloW/2} cy={haloW/2} r={haloW/2} fill={haloFill} fillOpacity={haloOpacity} />
                              </Svg>
                            );
                          })()}
                          <Svg width={size + 8} height={size + 8} style={{ position: 'absolute', left: -4, top: -4 }}>
                            {(() => {
                              const stroke = palette === 'apple' ? 'rgba(255,255,255,0.92)'
                                : palette === 'braman' ? 'rgba(255,255,255,0.85)'
                                : 'rgba(255,255,255,0.90)';
                              return (
                                <Circle cx={(size + 8)/2} cy={(size + 8)/2} r={(size + 8)/2 - 1.5} stroke={stroke} strokeWidth={2} fill="none" />
                              );
                            })()}
                          </Svg>
                        </>
                      )}
                      <Animated.View style={{ opacity: faceOpacity, transform: [{ scale: i === activeIdx ? activeFaceScale : 1 }] }}>
                        <MoodFace
                          score={sc}
                          size={size}
                          colors={facePalette as any}
                          strokeOpacity={palette === 'braman' ? 0.35 : (palette === 'apple' ? 0.4 : 0.45)}
                          strokeColor="#4B5563"
                        />
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            );
          })()}
          {/* score chip moved to external meta card */}
          {/* (top badges removed; moved below progress bar) */}
          </View>
          {/* bottom progress bar */}
          <View style={styles.progressBarContainerThick}>
            {!colorized && (
              <LinearGradient
                colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0)", "rgba(0,0,0,0.10)"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={styles.progressInsetShadow}
                pointerEvents="none"
              />
            )}
            <View style={[styles.progressBarFill, { width: `${Math.round((progress || 0) * 100)}%`, backgroundColor: (colorized ? '#FFFFFF' : segColor) }]} />
          </View>
          {/* meta row moved to external MindMetaRowCard */}
        </View>
      </View>
    );
  }

  // Use provided gradientColors when supplied (e.g., settings off → static green)
  const cardGrad = gradientColors || getGradientFromBase(stab.color, 0.1);
  return (
    <View style={styles.heroCard}>
      <LinearGradient colors={cardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientBg} />
      {/* Pastel veil to further reduce saturation and increase face contrast */}
      <View style={styles.pastelVeil} pointerEvents="none" />
      <View style={styles.contentRow}>
        <View style={styles.left}>
          {(() => {
            const mood = typeof avgMood === 'number' ? Math.round(avgMood) : (scoreNow != null ? roundInt(scoreNow) : 55);
            const e10 = typeof avgEnergy0100 === 'number' ? Math.max(1, Math.min(10, Math.round(avgEnergy0100 / 10))) : 6;
            return <MoodEnergyGaugeArc width={150} height={96} mood={mood} energy={e10} />;
          })()}
          {/* Center overlay for score text (over the gauge) */}
          <View style={[styles.centerOverlay, { top: -8 }]}>
            <Text style={styles.scoreOnGrad}>{scoreNow != null ? roundInt(scoreNow) : (isLoading ? '…' : '—')}</Text>
            <Text style={styles.ofOnGrad}>/100</Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.titleOnGrad} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitleOnGrad} numberOfLines={1}>Son 7 gün • mikro trend <Text style={{ color: '#fff' }}><Arrow delta={delta} /></Text></Text>

          {/* Inline status: sadece değerler (Durum ve Enerji) */}
          <Text style={styles.statusInlineOnGrad} numberOfLines={1}>
            <Text style={styles.statusInlineValueOnGrad}>{stab.label}</Text>
            <Text style={styles.statusInlineLabelOnGrad}> • </Text>
            <Text style={styles.statusInlineValueOnGrad}>{avgEnergyLabel.label}</Text>
          </Text>
            <View style={styles.chipsVertical}>
            <View style={{ alignSelf: 'stretch' }}>
              <Chip 
                onGradient 
                label={`${stab.label}`} 
                accentColor={baseColor} 
                icon={
                  (() => {
                    // Durum ikonları (hero variant için beyaz renk)
                    const getStatusIconName = () => {
                      switch (stab.label) {
                        case 'Stabil':
                          return 'check-circle';
                        case 'Dalgalı':
                          return 'alert-triangle';
                        case 'Çok Dalgalı':
                          return 'alert-circle';
                        default:
                          return 'information';
                      }
                    };
                    const iconColor = (() => {
                      if (palette === 'braman') {
                        return stab.label === 'Stabil' ? BramanColors.güvenli : (stab.label === 'Dalgalı' ? BramanColors.yellow : BramanColors.coral);
                      }
                      if (palette === 'apple') {
                        return stab.label === 'Stabil' ? '#34C759' : (stab.label === 'Dalgalı' ? '#FF9500' : '#FF3B30');
                      }
                      // classic VA: baseColor on gradient
                      return baseColor;
                    })();
                    return (
                      <MaterialCommunityIcons 
                        name={getStatusIconName() as any} 
                        size={16} 
                        color={iconColor} 
                        style={{ marginRight: 6 }} 
                      />
                    );
                  })()
                } 
              />
            </View>
            <View style={{ alignSelf: 'stretch' }}>
              <Chip 
                onGradient 
                label={`${avgEnergyLabel.label}`} 
                style={{ backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.35)' }} 
                icon={
                  <View style={{ marginRight: 6 }}>
                    <Svg width={16} height={16} viewBox="0 0 16 16">
                      <Defs>
                        <SvgLinearGradient id="batteryGradientHero" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0%" stopColor="#EF4444" />
                          <Stop offset="50%" stopColor="#F59E0B" />
                          <Stop offset="100%" stopColor="#10B981" />
                        </SvgLinearGradient>
                      </Defs>
                      {(() => {
                        const avg = avgEnergy0100 || 50; // 0-100 skala
                        const ratio = Math.max(0, Math.min(1, avg / 100));
                        const levelColor = ratio < 0.33 ? '#EF4444' : ratio < 0.66 ? '#F59E0B' : '#10B981';
                        const maxW = 11 - 2; // inner padding
                        const w = Math.max(0.8, maxW * ratio);
                        const strokeC = '#ffffff';
                        const capC = '#ffffff';
                        return (
                          <>
                            {/* Battery body with white stroke for hero variant */}
                            <Rect x={1.2} y={4} width={11} height={8} rx={2} ry={2} stroke={strokeC} strokeWidth={1.2} fill="none" />
                            {/* Battery cap with white fill */}
                            <Rect x={12.8} y={6} width={2} height={4} rx={0.8} ry={0.8} fill={capC} />
                            {/* Fill proportional to energy */}
                            <Rect x={2} y={5} width={w} height={6} rx={1} ry={1} fill="url(#batteryGradientHero)" opacity={0.9} />
                          </>
                        );
                      })()}
                    </Svg>
                  </View>
                } 
              />
            </View>
            {/* Streak chip in hero variant */}
            <View style={{ alignSelf: 'center' }}>
              <Chip 
                onGradient 
                label={`${streakCurrent}`}
                style={{ backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.35)' }} 
                textStyle={{ fontSize: 14, fontWeight: '800' }}
                icon={
                  <MaterialCommunityIcons 
                    name={streakCurrent === 0 ? "fire-off" : "fire"}
                    size={18} 
                    color={palette === 'apple' ? '#007AFF' : baseColor} 
                    style={{ marginRight: 6 }} 
                  />
                } 
              />
            </View>
          </View>

          {showSparkline && !isEmpty && (
            sparkStyle === 'line' ? (
              <View style={styles.sparkWrapOnGrad} onLayout={(e) => setHeroSparkWidth(Math.round(e.nativeEvent.layout.width))}>
                <Svg width="100%" height={20}>
                  <Defs>
                    <SvgLinearGradient id="sparkAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0%" stopColor={areaTopColor} stopOpacity={areaTopOpacity} />
                      <Stop offset="90%" stopColor={areaTopColor} stopOpacity={0.0} />
                    </SvgLinearGradient>
                  </Defs>
                  {(() => {
                    const vals = (dailyScores.map(v => (typeof v === 'number' ? v : null))
                      .map((v, i, arr) => v == null ? (i > 0 ? (arr[i - 1] as any) : 50) : v) as number[]);
                    const w = Math.max(140, heroSparkWidth || 0);
                    const h = 20;
                    const areaD = sparkAreaPathSmooth(vals, w, h, 0.6);
                    const lineD = sparkPathSmooth(vals, w, h, 0.6);
                    return (
                      <>
                        <Path d={areaD} fill="url(#sparkAreaGrad)" />
                        <Path d={lineD} stroke={sparkStroke} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </>
                    );
                  })()}
                </Svg>
              </View>
            ) : (
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: sparkStroke }]} />
              </View>
            )
          )}

          {isEmpty && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.emptyText}>{emptyHint || 'Henüz yeterli veri yok. Birkaç gün check-in yaptıkça Zihin Skoru oluşur.'}</Text>
              {onQuickStart && (
                <Pressable onPress={onQuickStart} style={styles.quickStartBtn} hitSlop={8}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#fff" />
                  <Text style={styles.quickStartText}>Hızlı Başla</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// -------------------- Styles --------------------
const styles = StyleSheet.create({
  whiteCard: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  whiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whiteScoreCenter: {
    position: 'absolute',
    left: 0,
    right: undefined,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  whiteScoreText: { fontSize: 24, fontWeight: '700', color: '#111827' },
  whiteHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whiteTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  whiteTrendRow: { flexDirection: 'row', alignItems: 'center' },
  whiteTrend: { fontSize: 13, fontWeight: '700' },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipGridItem: { flexBasis: '47%', flexGrow: 1 },
  chipOnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 46,
  },
  chipTextCol: { flex: 1, minWidth: 0 },
  chipOnWhiteTransparent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  chipOnWhiteLabel: { fontSize: 13, color: '#4B5563', fontWeight: '600', marginBottom: 2, flexShrink: 1, minWidth: 0 },
  chipOnWhiteValue: { fontSize: 15, color: '#111827', fontWeight: '700', flexShrink: 1, minWidth: 0 },
  whiteProgressBarOuter: { height: 12, backgroundColor: '#F3F4F6', borderRadius: 8, overflow: 'hidden', marginTop: 12 },
  whiteProgressBarInner: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 8 },
  emptyTextWhite: { color: '#374151', fontSize: 12 },
  statusInline: { marginTop: 6, fontSize: 12, color: '#374151' },
  statusInlineLabel: { fontWeight: '600', color: '#6B7280' },
  statusInlineValue: { fontWeight: '700' },
  statusInlineOnGrad: { marginTop: 6, fontSize: 12, color: '#FFFFFF' },
  statusInlineLabelOnGrad: { fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  statusInlineValueOnGrad: { fontWeight: '700', color: '#FFFFFF' },
  statusPillRow: { marginTop: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  chipsGridTwo: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  chipsVertical: { flexDirection: 'column', gap: 10, marginTop: 10 },
  chipHalf: { width: '48%' },
  quickStartBtnWhite: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E5E7EB',
    borderWidth: 0,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quickStartTextWhite: { color: '#111827', fontWeight: '600', fontSize: 12 },
  
  // Streak styles integrated in white card
  streakIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  streakIconContainer: {
    marginRight: 8,
  },
  streakTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 8,
  },
  streakCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginRight: 4,
  },
  streakLabelText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  streakLevelBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginLeft: 4,
  },
  heroCard: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject as any,
  },
  pastelVeil: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  plainBg: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: '#FFFFFF',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  left: { position: 'relative' },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOnGrad: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  scoreCenter: { fontSize: 40, fontWeight: '800', color: '#FFFFFF', transform: [{ translateY: 10 }] },
  ofOnGrad: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  right: { flex: 1 },
  titleOnGrad: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  subtitleOnGrad: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  chipBorder: { borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  chipOnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipOnGradientBorder: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  chipTextOnGradient: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  dot: { width: 8, height: 8, borderRadius: 999, marginRight: 6 },
  sparkWrapOnGrad: { marginTop: 16, alignSelf: 'stretch' },
  emptyText: { marginTop: 10, color: 'rgba(255,255,255,0.92)', fontSize: 12 },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBarContainerThick: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 10,
    alignSelf: 'stretch',
    width: '92%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressInsetShadow: {
    ...StyleSheet.absoluteFillObject as any,
    borderRadius: 6,
  },
  quickStartBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quickStartText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  bottomMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '92%',
    alignSelf: 'center',
    marginTop: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)'
  },
  metaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  metaUnit: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  // Minimal face gauge layout
  faceGaugeWrap: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGaugeArea: {
    width: '100%',
    height: 224,
  },
  faceTop: {
    marginTop: 6,
    marginBottom: 2,
  },
  faceRingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  centerScoreHero: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendTopRight: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: 'transparent',
    borderRadius: 999,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dominantTopLeft: {
    position: 'absolute',
    top: 8,
    left: 12,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dominantChipLabel: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  dominantChipValue: { color: '#111827', fontSize: 17, fontWeight: '800' },
  trendTopRightWhite: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  trendValueText: { fontSize: 16, fontWeight: '800' },
  microTrendText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  microTrendBadge: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  microTrendBadgeText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '800',
  },
  trendRow: { flexDirection: 'row', alignItems: 'baseline' },
  trendUnitText: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '700', marginLeft: 6 },
  scoreBelowWrap: { alignItems: 'center', marginTop: 8 },
  scoreBelowText: { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  ofTextBelow: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginLeft: 6, fontWeight: '700' },
  scoreChip: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)'
  },
  scoreChipRow: { flexDirection: 'row', alignItems: 'center' },
  scoreChipText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  streakTopLeft: {
    position: 'absolute',
    top: 8,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakBadgeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
