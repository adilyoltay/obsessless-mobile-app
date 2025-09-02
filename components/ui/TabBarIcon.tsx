
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { Animated } from 'react-native';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons as any);

export function TabBarIcon({ style, color, ...rest }: ComponentProps<typeof Ionicons>) {
  const anim = React.useRef(new Animated.Value(1)).current;
  const prevColorRef = React.useRef<string>(typeof color === 'string' ? (color as string) : '#9CA3AF');
  const [fromColor, setFromColor] = React.useState<string>(prevColorRef.current);
  const [toColor, setToColor] = React.useState<string>(prevColorRef.current);

  React.useEffect(() => {
    const next = typeof color === 'string' ? (color as string) : prevColorRef.current;
    if (next === prevColorRef.current) return;
    setFromColor(prevColorRef.current);
    setToColor(next);
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false }).start(() => {
      prevColorRef.current = next;
      setFromColor(next);
      setToColor(next);
      anim.setValue(1);
    });
  }, [color]);

  const animatedColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [fromColor, toColor],
  });

  return (
    <AnimatedIonicons
      size={24}
      style={[{ marginBottom: -3, pointerEvents: 'none' }, style]}
      color={animatedColor as unknown as string}
      {...rest}
    />
  );
}
