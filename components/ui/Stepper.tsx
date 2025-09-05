import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface StepperProps {
  value: number;
  onValueChange: (value: number) => void;
  options: number[];
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  onValueChange,
  options,
  label,
  style,
  testID = 'stepper',
}) => {
  const theme = useThemeColors();
  const currentIndex = options.indexOf(value);
  const canDecrease = currentIndex > 0;
  const canIncrease = currentIndex < options.length - 1;

  const handleDecrease = async () => {
    if (canDecrease) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(options[currentIndex - 1]);
    }
  };

  const handleIncrease = async () => {
    if (canIncrease) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(options[currentIndex + 1]);
    }
  };

  const formatValue = (val: number) => {
    if (val < 60) {
      return `${val} dk`;
    } else {
      const hours = Math.floor(val / 60);
      const minutes = val % 60;
      return minutes > 0 ? `${hours}s ${minutes}dk` : `${hours} saat`;
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.stepperContainer, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.card }, !canDecrease && styles.disabledButton]}
          onPress={handleDecrease}
          disabled={!canDecrease}
          testID={`${testID}-decrease`}
          accessibilityRole="button"
          accessibilityLabel="Azalt"
        >
          <MaterialCommunityIcons
            name="minus"
            size={20}
            color={canDecrease ? '#10B981' : '#D1D5DB'}
          />
        </TouchableOpacity>

        <View style={styles.valueContainer}>
          <Text style={styles.value}>{formatValue(value)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.card }, !canIncrease && styles.disabledButton]}
          onPress={handleIncrease}
          disabled={!canIncrease}
          testID={`${testID}-increase`}
          accessibilityRole="button"
          accessibilityLabel="Artır"
        >
          <MaterialCommunityIcons
            name="plus"
            size={20}
            color={canIncrease ? '#10B981' : '#D1D5DB'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#F9FAFB',
    shadowOpacity: 0,
    elevation: 0,
  },
  valueContainer: {
    minWidth: 80,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});

export default Stepper; 
