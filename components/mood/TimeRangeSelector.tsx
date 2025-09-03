import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TimeRange } from '@/types/mood';

type Props = {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
};

export const TimeRangeSelector: React.FC<Props> = ({ selected, onChange }) => {
  const ranges: { id: TimeRange; label: string; fullLabel: string }[] = [
    { id: 'week', label: 'H', fullLabel: 'Hafta' },
    { id: 'month', label: 'A', fullLabel: 'Ay' },
    { id: '6months', label: '6A', fullLabel: '6 Ay' },
    { id: 'year', label: 'Y', fullLabel: 'Yıl' },
  ];

  return (
    <View style={styles.container}>
      {ranges.map((range) => (
        <TouchableOpacity
          key={range.id}
          testID={`time-range-${range.id}`}
          style={[styles.tab, selected === range.id && styles.tabActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(range.id);
          }}
        >
          <Text style={[styles.tabText, selected === range.id && styles.tabTextActive]}>
            {range.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
});

export default TimeRangeSelector;

