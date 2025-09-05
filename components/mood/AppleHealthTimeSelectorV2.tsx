import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { TimeRange } from '@/types/mood';

type Props = {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
};

/**
 * Apple Health tarzı zaman aralığı seçici - V2
 * iOS 17 Health app'e tam uyumlu segmented control
 */
export const AppleHealthTimeSelectorV2: React.FC<Props> = ({ selected, onChange }) => {
  const ranges: { id: TimeRange; label: string; fullLabel: string }[] = [
    { id: 'day', label: 'G', fullLabel: 'Gün' },
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
                isFirst && styles.segmentFirst,
                isLast && styles.segmentLast,
                { zIndex: isSelected ? 10 : 1 }
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
              {isSelected && (
                <View style={[
                  styles.selectedBackground,
                  isFirst && styles.selectedBackgroundFirst,
                  isLast && styles.selectedBackgroundLast,
                ]} />
              )}
              <Text style={[
                styles.segmentText,
                isSelected && styles.segmentTextActive
              ]}>
                {range.label}
              </Text>
              {!isLast && <View pointerEvents="none" style={styles.separator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12, // widen control horizontally within the card
    paddingVertical: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7', // iOS System Gray 6
    borderRadius: 8,
    padding: 2,
    height: 28,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  segmentFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  segmentLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  selectedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedBackgroundFirst: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  selectedBackgroundLast: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  separator: {
    position: 'absolute',
    right: -0.5,
    top: 6,
    bottom: 6,
    width: 1,
    backgroundColor: '#D1D5DB',
    opacity: 0.8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    opacity: 0.4,
    letterSpacing: -0.08,
  },
  segmentTextActive: {
    opacity: 1,
    fontWeight: '600',
  },
});

export default AppleHealthTimeSelectorV2;
