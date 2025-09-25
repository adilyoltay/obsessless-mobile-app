import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getGradientFromBase } from '@/utils/colorUtils';

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
  accentColor?: string; // ignored for now (CTA fixed static green)
  gradientColors?: [string, string]; // ignored for now
};

export default function BottomCheckinCTA({ isVisible, onOpen, onClose, onComplete }: Props) {
  // Fixed static green CTA per request
  const STATIC_GREEN = '#10B981';
  const baseGrad: [string, string] = getGradientFromBase(STATIC_GREEN);
  const currentColor = baseGrad[0];
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Background layers (gradient) behind the button */}
      <LinearGradient
        colors={baseGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject as any, { borderRadius: 12 }]}
      />

      <Button
        variant="primary"
        onPress={() => {
          try { onOpen?.(); } catch {}
          try { router.push('/measure-hrv' as any); } catch {}
        }}
        accessibilityLabel="Mood Check‑in"
        style={[styles.button, { backgroundColor: 'transparent' }, { shadowColor: currentColor }]}
        leftIcon={<MaterialCommunityIcons name="microphone-outline" size={20} color="#FFFFFF" />}
      >
        Mood Check‑in
      </Button>
      {/* Legacy bottom sheet removed: direct to measurement screen */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
