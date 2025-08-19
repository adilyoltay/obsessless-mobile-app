
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  style?: any;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
}

export const CustomSlider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  style,
  minimumTrackTintColor = '#10B981',
  maximumTrackTintColor = '#E5E7EB',
  thumbTintColor = '#10B981',
  ...props
}) => {
  return (
    <View style={[styles.container, style]}>
      <Slider
        value={value}
        onValueChange={onValueChange}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        minimumTrackTintColor={minimumTrackTintColor}
        maximumTrackTintColor={maximumTrackTintColor}
        thumbTintColor={thumbTintColor}
        {...props}
      />
    </View>
  );
};

export { CustomSlider as Slider };

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
  },
  track: {
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
