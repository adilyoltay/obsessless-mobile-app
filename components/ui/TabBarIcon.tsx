
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { Animated, View } from 'react-native';

export function TabBarIcon({ style, color, ...rest }: ComponentProps<typeof Ionicons>) {
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const prevColorRef = React.useRef<string>(typeof color === 'string' ? (color as string) : '#9CA3AF');

  // On color change, fade out previous color overlay
  React.useEffect(() => {
    const next = typeof color === 'string' ? (color as string) : prevColorRef.current;
    if (next === prevColorRef.current) return;
    overlayOpacity.setValue(1);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      prevColorRef.current = next;
    });
  }, [color]);

  const currentColor = typeof color === 'string' ? (color as string) : prevColorRef.current;

  return (
    <View style={[{ marginBottom: -3, position: 'relative' }, style] as any} pointerEvents="none">
      {/* Base icon with current color */}
      <Ionicons size={24} color={currentColor} {...rest} />
      {/* Overlay icon fading out from previous color */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: overlayOpacity }}>
        <Ionicons size={24} color={prevColorRef.current} {...rest} />
      </Animated.View>
    </View>
  );
}
