
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Picker as RNPicker } from '@react-native-picker/picker';

interface PickerProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  style?: any;
  children: React.ReactNode;
}

interface PickerItemProps {
  label: string;
  value: string;
}

export const Picker: React.FC<PickerProps> & { Item: React.FC<PickerItemProps> } = ({
  selectedValue,
  onValueChange,
  style,
  children,
}) => {
  return (
    <View style={[styles.container, style]}>
      <RNPicker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={styles.picker}
      >
        {children}
      </RNPicker>
    </View>
  );
};

export const PickerItem: React.FC<PickerItemProps> = ({ label, value }) => {
  return <RNPicker.Item label={label} value={value} />;
};

Picker.Item = PickerItem;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: Colors.ui.card,
  },
  picker: {
    height: 50,
  },
});
