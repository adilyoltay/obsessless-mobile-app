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
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const prevColorRef = React.useRef<string>(accentColor || '#10B981');

  React.useEffect(() => {
    const next = accentColor || '#10B981';
    if (next === prevColorRef.current) return;
    overlayOpacity.setValue(1);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      prevColorRef.current = next;
    });
  }, [accentColor]);

  const currentColor = accentColor || '#10B981';

  return (
    <View style={styles.container}>
      {/* Background layers behind the button */}
      <View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: currentColor, borderRadius: 16 }]} />
      <Animated.View style={[StyleSheet.absoluteFillObject as any, { backgroundColor: prevColorRef.current, borderRadius: 16, opacity: overlayOpacity }]} />

      <Button
        variant="primary"
        onPress={onOpen}
        accessibilityLabel="Mood Check‑in"
        style={[styles.button, { backgroundColor: 'transparent' }, { shadowColor: currentColor }]}
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
    position: 'relative',
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
