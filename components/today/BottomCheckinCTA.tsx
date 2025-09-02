import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  return (
    <View style={styles.container}>
      <Button
        variant="primary"
        onPress={onOpen}
        accessibilityLabel="Mood Check‑in"
        style={[styles.button, accentColor ? { backgroundColor: accentColor, shadowColor: accentColor } : null]}
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
