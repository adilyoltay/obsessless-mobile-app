import React from 'react';
import { Animated, View, TextStyle } from 'react-native';

type Props = {
  text: string;
  color?: string;
  style?: TextStyle;
};

export default function TabBarLabel({ text, color, style }: Props) {
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const prevColorRef = React.useRef<string>(typeof color === 'string' ? (color as string) : '#9CA3AF');
  const [overlayColor, setOverlayColor] = React.useState<string>(prevColorRef.current);

  React.useEffect(() => {
    const next = typeof color === 'string' ? (color as string) : prevColorRef.current;
    if (next === prevColorRef.current) return;
    setOverlayColor(prevColorRef.current);
    overlayOpacity.setValue(1);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      prevColorRef.current = next;
      setOverlayColor(next);
    });
  }, [color]);

  const currentColor = typeof color === 'string' ? (color as string) : prevColorRef.current;

  // Default tab label style (matches _layout.tsx)
  const baseStyle: TextStyle = {
    fontSize: 11,
    fontWeight: '600' as any,
  };

  return (
    <View style={{ position: 'relative' }} pointerEvents="none">
      <Animated.Text style={[baseStyle, style, { color: currentColor }]}>{text}</Animated.Text>
      <Animated.Text style={[baseStyle, style, { color: overlayColor, position: 'absolute', left: 0, top: 0, opacity: overlayOpacity }]}>
        {text}
      </Animated.Text>
    </View>
  );
}

