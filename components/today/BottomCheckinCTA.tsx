import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Button } from '@/components/ui/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CheckinBottomSheet from '@/components/checkin/CheckinBottomSheet';

type RoutingResult = {
  type: 'MOOD' | 'BREATHWORK' | 'UNKNOWN';
  confidence: number;
  screen?: string;
  params?: any;
};

type Props = {
  isVisible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onComplete: (routingResult?: RoutingResult) => void;
  accentColor?: string;
};

export default function BottomCheckinCTA({ isVisible, onOpen, onClose, onComplete, accentColor }: Props) {
  const bgAnim = React.useRef(new Animated.Value(1)).current;
  const prevColorRef = React.useRef<string>(accentColor || '#10B981');
  const [fromColor, setFromColor] = React.useState<string>(prevColorRef.current);
  const [toColor, setToColor] = React.useState<string>(prevColorRef.current);

  React.useEffect(() => {
    const next = accentColor || '#10B981';
    if (next === prevColorRef.current) return;
    // schedule after paint to avoid insertion-effect warnings in dev
    requestAnimationFrame(() => {
      setFromColor(prevColorRef.current);
      setToColor(next);
      bgAnim.setValue(0);
      Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start(() => {
        prevColorRef.current = next;
        setFromColor(next);
        setToColor(next);
        bgAnim.setValue(1);
      });
    });
  }, [accentColor]);

  const animatedBg = bgAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor, toColor] });

  return (
    <View style={styles.container}>
      <Button
        variant="primary"
        onPress={onOpen}
        accessibilityLabel="Mood Check‑in"
        style={[styles.button, { backgroundColor: animatedBg }, accentColor ? { shadowColor: accentColor } : null]}
        leftIcon={<MaterialCommunityIcons name="microphone-outline" size={20} color="#FFFFFF" />}
      >
        Mood Check‑in
      </Button>
      <CheckinBottomSheet isVisible={isVisible} onClose={onClose} onComplete={onComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 16,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
