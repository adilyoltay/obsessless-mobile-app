import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { getVAColorFromScores, getBramanMoodColor, getAppleMoodColor } from '@/utils/colorUtils';

type Props = {
  mood?: number | null; // 0–100
  energy?: number | null; // 1–10
  anxiety?: number | null; // 1–10
};

const MindMEAStatsCard: React.FC<Props> = ({ mood, energy, anxiety }) => {
  const { palette } = useAccentColor();
  const mv = typeof mood === 'number' && Number.isFinite(mood) ? Math.round(mood) : NaN;
  const ev = typeof energy === 'number' && Number.isFinite(energy) ? Math.round(energy) : NaN;
  const av = typeof anxiety === 'number' && Number.isFinite(anxiety) ? Math.round(anxiety) : NaN;
  const moodColor = (() => {
    const mvr = Number.isFinite(mv) ? mv : 55;
    if (palette === 'braman') return getBramanMoodColor(mvr);
    if (palette === 'apple') return getAppleMoodColor(mvr);
    const e10 = Number.isFinite(ev) ? ev : 6;
    return getVAColorFromScores(mvr, e10);
  })();
  const energyColor = (() => {
    const ratio = Number.isFinite(ev) ? Math.max(0, Math.min(1, (ev as number) / 10)) : 0.6;
    if (palette === 'braman') return ratio < 0.33 ? '#F4A09C' : ratio < 0.66 ? '#F5D99C' : '#94B49F';
    return ratio < 0.33 ? '#EF4444' : ratio < 0.66 ? '#F59E0B' : '#10B981';
  })();
  const anxietyColor = palette === 'braman' ? '#F4A09C' : '#EF4444';

  return (
    <View style={styles.card}>
      {/* Mood */}
      <View style={styles.cell}>
        <View style={styles.row}>
          <Svg width={16} height={16} viewBox="0 0 16 16" style={{ marginRight: 6 }}>
            <Circle cx={8} cy={8} r={6.6} stroke={moodColor} strokeWidth={1.6} fill="none" />
            <Circle cx={5.6} cy={6.3} r={0.9} fill={moodColor} />
            <Circle cx={10.4} cy={6.3} r={0.9} fill={moodColor} />
            <Path d="M5 9.2 C6.1 11.1, 9.9 11.1, 11 9.2" stroke={moodColor} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          </Svg>
          <Text style={styles.value}>{Number.isFinite(mv) ? `${mv}/100` : '—'}</Text>
        </View>
        <Text style={styles.label}>Mood</Text>
      </View>

      <View style={styles.divider} />

      {/* Energy */}
      <View style={styles.cell}>
        <View style={styles.row}>
          <Svg width={16} height={16} viewBox="0 0 16 16" style={{ marginRight: 6 }}>
            <Defs>
              <SvgLinearGradient id="batteryGradMEA" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#EF4444" />
                <Stop offset="50%" stopColor="#F59E0B" />
                <Stop offset="100%" stopColor="#10B981" />
              </SvgLinearGradient>
            </Defs>
            {(() => {
              const ratio = Number.isFinite(ev) ? Math.max(0, Math.min(1, (ev as number) / 10)) : 0.6;
              const maxW = 11 - 2;
              const w = Math.max(0.8, maxW * ratio);
              return (
                <>
                  <Rect x={1.2} y={4} width={11} height={8} rx={2} ry={2} stroke={energyColor} strokeWidth={1.6} fill="none" />
                  <Rect x={12.8} y={6} width={2} height={4} rx={0.8} ry={0.8} fill={energyColor} />
                  <Rect x={2} y={5} width={w} height={6} rx={1} ry={1} fill={'url(#batteryGradMEA)'} opacity={0.95} />
                </>
              );
            })()}
          </Svg>
          <Text style={styles.value}>{Number.isFinite(ev) ? `${ev}/10` : '—'}</Text>
        </View>
        <Text style={styles.label}>Enerji</Text>
      </View>

      <View style={styles.divider} />

      {/* Anxiety */}
      <View style={styles.cell}>
        <View style={styles.row}>
          <Svg width={16} height={16} viewBox="0 0 16 16" style={{ marginRight: 6 }}>
            {(() => {
              const ratio = Number.isFinite(av) ? Math.max(0, Math.min(1, (av as number) / 10)) : 0.5;
              const base = 10;
              const amp = 2 + (5.5 - 2) * ratio;
              const up = (base - amp).toFixed(2);
              const down = (base + amp).toFixed(2);
              const d = `M1.5 ${base} C3 ${up}, 5 ${down}, 7 ${base} C9 ${up}, 11 ${down}, 13 ${base}`;
              const strokeW = 1.2 + 0.6 * ratio;
              return <Path d={d} stroke={anxietyColor} strokeWidth={strokeW} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
            })()}
          </Svg>
          <Text style={styles.value}>{Number.isFinite(av) ? `${av}/10` : '—'}</Text>
        </View>
        <Text style={styles.label}>Anksiyete</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cell: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 16, fontWeight: '800', color: '#111827' },
  label: { marginTop: 4, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  divider: { width: 1, height: 36, backgroundColor: '#E5E7EB' },
});

export default MindMEAStatsCard;

