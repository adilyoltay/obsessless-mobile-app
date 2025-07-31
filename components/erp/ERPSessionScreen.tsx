import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Card } from 'react-native-paper';
import Animated, { 
  FadeIn, 
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import LottieView from 'lottie-react-native';

// UI Components
import { Slider } from '@/components/ui/Slider';
import Button from '@/components/ui/Button';

// Stores
import { useERPSessionStore } from '@/store/erpSessionStore';
import { useGamificationStore } from '@/store/gamificationStore';

// Auth
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.7;
const STROKE_WIDTH = 12;

// Sakinleştirici mikro-kopyalar
const CALMING_MESSAGES = [
  "Bu his geçici. Sadece bir duygu, sen o duygu değilsin.",
  "Nefesine odaklan. İçeri... Dışarı...",
  "Güvendesin. Bu sadece bir egzersiz.",
  "Her saniye seni güçlendiriyor.",
  "Korkuyla yüzleşmek cesaret ister. Sen cesursun.",
  "Bedenindeki gerginliği fark et ve bırak.",
  "Bu anı kabul et. Direnmeden, yargılamadan.",
  "Anksiyete sadece bir yanlış alarm. Tehlike yok.",
];

interface ERPSessionScreenProps {
  exerciseId: string;
  exerciseName: string;
  targetDuration: number; // seconds
  onComplete?: (sessionLog: any) => void;
  onAbandon?: () => void;
}

export default function ERPSessionScreen({
  exerciseId,
  exerciseName,
  targetDuration,
  onComplete,
  onAbandon,
}: ERPSessionScreenProps) {
  const { user } = useAuth();
  const {
    isActive,
    elapsedTime,
    currentAnxiety,
    anxietyDataPoints,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    abandonSession,
    updateAnxiety,
  } = useERPSessionStore();

  const [isPaused, setIsPaused] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(0);

  // Animation values
  const pulseScale = useSharedValue(1);
  const messageOpacity = useSharedValue(1);

  useEffect(() => {
    // Start session on mount
    startSession(exerciseId, exerciseName, targetDuration);

    // Cleanup on unmount
    return () => {
      if (isActive) {
        abandonSession();
      }
    };
  }, []);

  useEffect(() => {
    // Rotate calming messages
    const messageInterval = setInterval(() => {
      messageOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 })
      );
      setCurrentMessage((prev) => (prev + 1) % CALMING_MESSAGES.length);
    }, 10000); // Every 10 seconds

    return () => clearInterval(messageInterval);
  }, []);

  useEffect(() => {
    // Pulse animation for anxiety reminder
    const pulseInterval = setInterval(() => {
      if (!isPaused) {
        pulseScale.value = withSequence(
          withTiming(1.1, { duration: 300 }),
          withTiming(1, { duration: 300 })
        );
      }
    }, 120000); // Every 2 minutes

    return () => clearInterval(pulseInterval);
  }, [isPaused]);

  const handlePauseResume = () => {
    if (isPaused) {
      resumeSession();
      setIsPaused(false);
    } else {
      pauseSession();
      setIsPaused(true);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleComplete = async () => {
    const sessionLog = await completeSession(user?.uid);
    setShowCompletion(true);
    
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Gamification integration
    const { awardMicroReward, checkAchievements, updateStreak } = useGamificationStore.getState();
    
    // Award micro-reward for ERP completion
    await awardMicroReward('erp_completed');
    
    // Calculate anxiety reduction percentage
    const anxietyReduction = ((anxietyDataPoints[0]?.level || 5) - currentAnxiety) / (anxietyDataPoints[0]?.level || 5) * 100;
    
    // Extra reward for significant anxiety reduction
    if (anxietyReduction >= 30) {
      await awardMicroReward('anxiety_reduced');
    }
    
    // Check for achievements
    await checkAchievements('erp', {
      anxietyReduction,
      duration: elapsedTime,
    });
    
    // Update streak
    await updateStreak();
    
    if (onComplete) {
      setTimeout(() => onComplete(sessionLog), 3000);
    }
  };

  const handleAbandon = () => {
    abandonSession();
    if (onAbandon) {
      onAbandon();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = elapsedTime / targetDuration;
  const circumference = 2 * Math.PI * ((CIRCLE_SIZE - STROKE_WIDTH) / 2);
  const strokeDashoffset = circumference * (1 - progress);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  // Calculate anxiety reduction
  const initialAnxiety = anxietyDataPoints[0]?.level || 5;
  const anxietyReduction = ((initialAnxiety - currentAnxiety) / initialAnxiety) * 100;

  if (showCompletion) {
    return (
      <Animated.View 
        entering={FadeIn.duration(600)}
        style={styles.completionContainer}
      >
        {/* Confetti Animation */}
        <View style={styles.confettiContainer}>
          <LottieView
            source={require('@/assets/confetti.json')}
            autoPlay
            loop={false}
            style={styles.confetti}
          />
        </View>

        <MaterialCommunityIcons name="check-circle" size={100} color="#10B981" />
        
        <Text style={styles.completionTitle}>Başardın! 🎉</Text>
        
        <Text style={styles.completionExercise}>
          {exerciseName} egzersizini tamamladın
        </Text>
        
        <Card style={styles.completionStats}>
          <Card.Content>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Süre:</Text>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Anksiyete Azalması:</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                %{Math.abs(anxietyReduction).toFixed(0)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Başlangıç → Bitiş:</Text>
              <Text style={styles.statValue}>
                {anxietyDataPoints[0]?.level || 5} → {currentAnxiety}
              </Text>
            </View>
          </Card.Content>
        </Card>
        
        <Text style={styles.completionMessage}>
          Her egzersiz seni daha da güçlendiriyor. Kendini kutla! 💪
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleAbandon} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={28} color="#6B7280" />
        </Pressable>
        <Text style={styles.exerciseTitle}>{exerciseName}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Circular Timer */}
      <View style={styles.timerContainer}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          {/* Background circle */}
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={(CIRCLE_SIZE - STROKE_WIDTH) / 2}
            stroke="#E5E7EB"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={CIRCLE_SIZE / 2}
            cy={CIRCLE_SIZE / 2}
            r={(CIRCLE_SIZE - STROKE_WIDTH) / 2}
            stroke="#10B981"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
          />
        </Svg>
        
        <View style={styles.timerContent}>
          <Text style={styles.timeRemaining}>
            {formatTime(targetDuration - elapsedTime)}
          </Text>
          <Text style={styles.timeLabel}>kalan</Text>
          
          <Pressable onPress={handlePauseResume} style={styles.pauseButton}>
            <MaterialCommunityIcons 
              name={isPaused ? "play" : "pause"} 
              size={40} 
              color="#6B7280" 
            />
          </Pressable>
        </View>
      </View>

      {/* Anxiety Slider */}
      <Animated.View style={[styles.anxietySection, pulseAnimatedStyle]}>
        <Text style={styles.anxietyTitle}>Şu anki anksiyete seviyesi</Text>
        <View style={styles.anxietySliderContainer}>
          <Text style={styles.anxietyValue}>{currentAnxiety}</Text>
          <Slider
            value={currentAnxiety}
            onValueChange={updateAnxiety}
            minimumValue={1}
            maximumValue={10}
            step={1}
            style={styles.anxietySlider}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#10B981"
          />
          <View style={styles.anxietyLabels}>
            <Text style={styles.anxietyLabel}>Düşük</Text>
            <Text style={styles.anxietyLabel}>Yüksek</Text>
          </View>
        </View>
      </Animated.View>

      {/* Calming Message */}
      <Animated.View style={[styles.messageContainer, messageAnimatedStyle]}>
        <Text style={styles.calmingMessage}>
          {CALMING_MESSAGES[currentMessage]}
        </Text>
      </Animated.View>

      {/* Complete Button (shown when time is up) */}
      {elapsedTime >= targetDuration && (
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={styles.completeButtonContainer}
        >
          <Button
            onPress={handleComplete}
            style={styles.completeButton}
          >
            Tamamla
          </Button>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  timerContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  timeRemaining: {
    fontSize: 48,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  timeLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 4,
  },
  pauseButton: {
    marginTop: 20,
    padding: 8,
  },
  anxietySection: {
    marginTop: 40,
    paddingHorizontal: 40,
  },
  anxietyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  anxietySliderContainer: {
    alignItems: 'center',
  },
  anxietyValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: 'Inter-Medium',
    marginBottom: 16,
  },
  anxietySlider: {
    width: '100%',
    height: 40,
  },
  anxietyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  anxietyLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  messageContainer: {
    marginTop: 32,
    paddingHorizontal: 40,
  },
  calmingMessage: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  completeButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  completeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  completionContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  confetti: {
    width: width,
    height: width,
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -width / 2,
    marginLeft: -width / 2,
  },
  completionTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginTop: 20,
    zIndex: 1,
  },
  completionExercise: {
    fontSize: 18,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 8,
    textAlign: 'center',
    zIndex: 1,
  },
  completionStats: {
    marginTop: 32,
    width: '100%',
    backgroundColor: '#F0FDF4',
    zIndex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  completionMessage: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 24,
    zIndex: 1,
  },
}); 