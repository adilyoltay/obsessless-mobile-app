import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

interface BreathworkSuggestionCardProps {
  trigger: 'morning' | 'evening' | 'high_anxiety' | 'post_compulsion' | 'general';
  anxietyLevel?: number;
  onDismiss?: () => void;
  onSnooze?: () => void;
}

const TRIGGER_CONFIGS = {
  morning: {
    title: '🌅 Günaydın!',
    message: 'Güne sakin bir başlangıç yapalım mı?',
    protocol: 'box',
    gradient: ['#FFE5B4', '#FFD4A3'],
    icon: 'weather-sunny',
  },
  evening: {
    title: '🌙 İyi Akşamlar',
    message: 'Uyku öncesi rahatlamak için 4-7-8 nefesi deneyelim mi?',
    protocol: '478',
    gradient: ['#B4C6E7', '#9BA9D0'],
    icon: 'moon-waning-crescent',
  },
  high_anxiety: {
    title: '💚 Biraz Mola',
    message: 'Anksiyeten yüksek görünüyor. 60 saniye nefes alalım mı?',
    protocol: '478',
    gradient: ['#FFE5E5', '#FFD0D0'],
    icon: 'heart-pulse',
  },
  post_compulsion: {
    title: '🤗 Kendine Şefkat',
    message: 'Toparlanmak için birlikte nefes alalım.',
    protocol: 'paced',
    gradient: ['#E5F5E5', '#D0EBD0'],
    icon: 'hand-heart',
  },
  general: {
    title: '🌬️ Nefes Molası',
    message: 'Kısa bir nefes egzersizi yapmaya ne dersin?',
    protocol: 'box',
    gradient: ['#E5F3FF', '#D0E7FF'],
    icon: 'meditation',
  },
};

export default function BreathworkSuggestionCard({
  trigger,
  anxietyLevel,
  onDismiss,
  onSnooze,
}: BreathworkSuggestionCardProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  const config = TRIGGER_CONFIGS[trigger];

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Navigate with auto-start
    router.push({
      pathname: '/(tabs)/breathwork',
      params: {
        protocol: config.protocol,
        autoStart: 'true',
        source: 'suggestion',
        trigger,
        anxietyLevel: String(anxietyLevel || 5),
      },
    });
    
    handleDismiss();
  };

  const handleSnooze = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Exit animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onSnooze?.();
    });
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Exit animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={config.gradient}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name={config.icon as any}
                size={24}
                color="#4A5568"
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.message}>{config.message}</Text>
            </View>
            <Pressable onPress={handleDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color="#718096" />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Başla</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
            </Pressable>

            <Pressable
              onPress={handleSnooze}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>15 dk sonra</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gradient: {
    padding: 16,
  },
  content: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  message: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4A5568',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#4A5568',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
