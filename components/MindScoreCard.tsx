import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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

const Arrow = ({ delta }: { delta: number }) => {
  const threshold = 1.5;
  const up = delta > threshold;
  const down = delta < -threshold;
  const color = up ? '#10B981' : down ? '#EF4444' : '#6B7280';
  const arrow = up ? '↑' : down ? '↓' : '→';
  const abs = Math.abs(Math.round(delta));
  const signed = up ? `+${abs}` : down ? `-${abs}` : `${abs}`;
  return <Text style={{ color }}>{arrow} {signed}</Text>;
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

export default function MindScoreCard({ week, title = 'Zihin Skoru', showSparkline = true, gradientColors = ['#34d399', '#059669'], loading, emptyHint, onQuickStart, sparkStyle = 'line', moodVariance, variant = 'hero', streakCurrent = 0, streakBest = 0, streakLevel = 'seedling', coloredBackground = false }: Props) {
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
  const size = 64;
  const r = 28;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const [heroSparkWidth, setHeroSparkWidth] = React.useState(0);
  const [whiteFooterW, setWhiteFooterW] = React.useState(0);

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
    const wSize = 80;
    const wR = 36;
    const wC = 2 * Math.PI * wR;
    const wProgress = typeof scoreNow === 'number' ? scoreNow / 100 : 0;
    return (
      <View style={[styles.whiteCard, coloredBackground && { backgroundColor: statusBg }]}> 
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

  // Use provided gradientColors when supplied (e.g., settings off → static green)
  const cardGrad = gradientColors || getGradientFromBase(stab.color, 0.1);
  return (
    <View style={styles.heroCard}>
      <LinearGradient colors={cardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientBg} />
      <View style={styles.contentRow}>
        <View style={styles.left}>
          <Svg width={size} height={size}>
            <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={6} fill="none" />
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              stroke={baseColor}
              strokeWidth={6}
              fill="none"
              strokeDasharray={`${C * progress} ${C * (1 - progress)}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          </Svg>
          <View style={styles.centerOverlay}>
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
    borderColor: 'rgba(0,0,0,0.06)',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject as any,
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
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
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
});
