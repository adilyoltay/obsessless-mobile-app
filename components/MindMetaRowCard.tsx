import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  score?: number | null; // 0–100
  streak?: number | null;
  hp?: number | null; // Healing Points (today)
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export default function MindMetaRowCard({ score, streak, hp }: Props) {
  const s = typeof score === 'number' && Number.isFinite(score) ? clamp(Math.round(score), 0, 100) : null;
  const st = typeof streak === 'number' && Number.isFinite(streak) ? Math.max(0, Math.round(streak)) : 0;
  const healing = typeof hp === 'number' && Number.isFinite(hp) ? Math.max(0, Math.round(hp)) : 0;

  return (
    <View style={styles.card}>
      {/* Score */}
      <View style={styles.cell}>
        <View style={styles.cellRow}>
          <MaterialCommunityIcons name="star" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={styles.valueText}>{s != null ? s : '—'}</Text>
        </View>
        <Text style={styles.labelText}>Score</Text>
      </View>

      {/* Divider */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "#E5E7EB", "rgba(0,0,0,0)"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={styles.dividerGrad}
      />

      {/* Streak */}
      <View style={styles.cell}>
        <View style={styles.cellRow}>
          <MaterialCommunityIcons name={st > 0 ? 'fire' : 'fire-off'} size={18} color="#F97316" style={{ marginRight: 6 }} />
          <Text style={styles.valueText}>{st}</Text>
        </View>
        <Text style={styles.labelText}>Streak</Text>
      </View>

      {/* Divider */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "#E5E7EB", "rgba(0,0,0,0)"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={styles.dividerGrad}
      />

      {/* Healing Points */}
      <View style={styles.cell}>
        <View style={styles.cellRow}>
          <MaterialCommunityIcons name="hand-heart" size={18} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={[styles.valueText, { color: '#10B981' }]}>{healing}</Text>
          <View style={[styles.unitBadge, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10B981', marginLeft: 6 }]}> 
            <Text style={[styles.unitBadgeText, { color: '#10B981' }]}>HP</Text>
          </View>
        </View>
        <Text style={styles.labelText}>Healing Points</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cell: { flex: 1, alignItems: 'center' },
  cellRow: { flexDirection: 'row', alignItems: 'center' },
  valueText: { fontSize: 18, fontWeight: '800', color: '#111827' },
  unitText: { fontSize: 12, fontWeight: '700' },
  labelText: { marginTop: 4, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  dividerGrad: { width: 1, height: 28, borderRadius: 1 },
  unitBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  unitBadgeText: { fontSize: 11, fontWeight: '700' },
});
