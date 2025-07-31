
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SegmentedButtonOption {
  value: string;
  label: string;
  icon?: string;
}

interface SegmentedButtonsProps {
  options: SegmentedButtonOption[];
  selectedValue: string;
  onSelectionChange: (value: string) => void;
}

export const SegmentedButtons: React.FC<SegmentedButtonsProps> = ({
  options,
  selectedValue,
  onSelectionChange,
}) => {
  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.button,
              isSelected && styles.selectedButton,
              isFirst && styles.firstButton,
              isLast && styles.lastButton,
            ]}
            onPress={() => onSelectionChange(option.value)}
          >
            {option.icon && (
              <MaterialCommunityIcons
                name={option.icon as any}
                size={20}
                color={isSelected ? '#FFFFFF' : '#6B7280'}
                style={styles.icon}
              />
            )}
            <Text style={[
              styles.buttonText,
              isSelected && styles.selectedButtonText,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  selectedButton: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  firstButton: {
    marginRight: 1,
  },
  lastButton: {
    marginLeft: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  selectedButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  icon: {
    marginRight: 6,
  },
});
