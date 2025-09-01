import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Goal = {
  key: 'activeDays' | 'mood' | 'breathwork';
  label: string;
  icon: string;
  value: number;
  target: number;
};

type Props = {
  goals: Goal[];
};

export default function GoalTracker({ goals }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>Hedef İlerleme</Text>
      {goals.map((g) => {
        const pct = Math.max(0, Math.min(100, Math.round((g.value / Math.max(1, g.target)) * 100)));
        const done = g.value >= g.target;
        return (
          <View key={g.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <MaterialCommunityIcons name={g.icon as any} size={18} color={done ? '#10B981' : '#64748B'} />
              <Text style={[styles.rowLabel, done && { color: '#065F46' }]}>{g.label}</Text>
              <Text style={[styles.rowValue, done && { color: '#065F46' }]}>{g.value}/{g.target}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: done ? '#10B981' : '#60A5FA' }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8
  },
  row: {
    marginBottom: 10
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  rowLabel: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    fontWeight: '600'
  },
  rowValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700'
  },
  track: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden'
  },
  fill: {
    height: 8,
    borderRadius: 6
  }
});

