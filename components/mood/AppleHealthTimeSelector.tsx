import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TimeRange } from '@/types/mood';

type Props = {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
};

/**
 * Apple Health tarzı zaman aralığı seçici
 * Segmented control görünümü ile H/A/6A/Y seçenekleri
 */
export const AppleHealthTimeSelector: React.FC<Props> = ({ selected, onChange }) => {
  const ranges: { id: TimeRange; label: string; fullLabel: string }[] = [
    { id: 'week', label: 'H', fullLabel: 'Hafta' },
    { id: 'month', label: 'A', fullLabel: 'Ay' },
    { id: '6months', label: '6A', fullLabel: '6 Ay' },
    { id: 'year', label: 'Y', fullLabel: 'Yıl' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.segmentedControl}>
        {ranges.map((range, index) => {
          const isSelected = selected === range.id;
          const isFirst = index === 0;
          const isLast = index === ranges.length - 1;
          
          return (
            <TouchableOpacity
              key={range.id}
              testID={`time-range-${range.id}`}
              style={[
                styles.segment,
                isSelected && styles.segmentActive,
                isFirst && styles.segmentFirst,
                isLast && styles.segmentLast,
              ]}
              onPress={() => {
                if (selected !== range.id) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onChange(range.id);
                }
              }}
              accessibilityLabel={`${range.fullLabel} görünümü`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[
                styles.segmentText,
                isSelected && styles.segmentTextActive
              ]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7', // iOS System Gray 6
    borderRadius: 9,
    padding: 2,
    height: 32,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
  },
  segmentFirst: {
    marginRight: 1,
  },
  segmentLast: {
    marginLeft: 1,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    opacity: 0.5,
  },
  segmentTextActive: {
    opacity: 1,
    color: '#000000',
  },
});

export default AppleHealthTimeSelector;
