import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getCanonicalCategoryIconName, getCanonicalCategoryColor } from '@/constants/canonicalCategories';
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
import { router } from 'expo-router';

// UI Components
import { Slider } from '@/components/ui/Slider';
import { BottomSheet } from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import BreathworkPlayer from '@/components/breathwork/BreathworkPlayer';
import { Badge } from '@/components/ui/Badge';
import { mapToCanonicalCategory } from '@/utils/categoryMapping';
import { useTranslation } from '@/hooks/useTranslation';

// Stores
import { useERPSessionStore } from '@/store/erpSessionStore';
import { useGamificationStore } from '@/store/gamificationStore';

// Auth
import { useAuth } from '@/contexts/SupabaseAuthContext';
import awardMicroReward from '@/services/achievementService';
import enhancedAchievements from '@/services/enhancedAchievementService';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.7;
const STROKE_WIDTH = 12;

// Safe divide to prevent NaN/Infinity
const safeDivide = (a: number, b: number): number => (b === 0 ? 0 : a / b);

// Sakinleştirici ve şefkatli mikro-kopyalar
const CALMING_MESSAGES = [
  "Şu anda güvendesin. Her nefes alışın seni daha güçlü kılıyor.",
  "Bu hisler geçici. Sen onlardan çok daha büyüksün.",
  "Nefesine odaklan. İçeri... nazikçe. Dışarı... rahatla.",
  "Kendine şefkat göster. Bu yolculuk cesaret ister ve sen cesursun.",
  "Bedenindeki gerginliği fark et. Şimdi nazikçe bırak.",
  "Bu anı kabul etmek güç gerektirir. Sen güçlüsün.",
  "Endişeler sadece düşünceler. Gerçek değiller, sen gerçeksin.",
  "Her saniye seni iyileşme yolunda daha da ileriye taşıyor.",
  "Bugün kendin için burada olmaya karar verdin. Bu harika.",
  "Kalbindeki cesaretin sesini dinle. O senin rehberin.",
];

interface CompulsionUrge {
  timestamp: number;
  strength: number; // 1-10
  resisted: boolean;
}

interface ERPSessionScreenProps {
  exerciseId: string;
  exerciseName: string;
  targetDuration: number; // seconds
  exerciseType?: 'in_vivo' | 'imaginal' | 'interoceptive' | 'response_prevention';
  initialAnxiety?: number;
  personalGoal?: string;
  category?: string;
  categoryName?: string;
  onComplete?: (sessionLog: any) => void;
  onAbandon?: () => void;
}

export default function ERPSessionScreen({
  exerciseId,
  exerciseName,
  targetDuration,
  exerciseType,
  initialAnxiety = 5,
  personalGoal,
  category,
  categoryName,
  onComplete,
  onAbandon,
}: ERPSessionScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
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
  const isCompletingRef = useRef(false);
  
  // Compulsion Urge Tracking State
  const [showUrgeBottomSheet, setShowUrgeBottomSheet] = useState(false);
  const [urgeStrength, setUrgeStrength] = useState(5);
  const [compulsionUrges, setCompulsionUrges] = useState<CompulsionUrge[]>([]);

  // Breathwork Inline Modal State
  const [showBreath, setShowBreath] = useState(false);

  // Animation values
  const pulseScale = useSharedValue(1);
  const messageOpacity = useSharedValue(1);
  const urgeButtonPulse = useSharedValue(1);

  // Check for session completion
  useEffect(() => {
    if (isActive && elapsedTime >= targetDuration && !showCompletion && user?.id) {
      console.log('⏰ Session duration reached, auto-completing...');
      handleComplete();
    }
  }, [elapsedTime, targetDuration, showCompletion, user?.id, isActive]);

  useEffect(() => {
    // Start session when component mounts
    if (exerciseId && exerciseName) {
      console.log('🎯 Starting ERP session with:', {
        exerciseId,
        exerciseName,
        exerciseType,
        initialAnxiety,
        targetDuration,
        category,
        categoryName,
      });
      
      startSession({
        exerciseId,
        exerciseName,
        exerciseType,
        targetDuration,
        initialAnxiety,
        category,
        categoryName,
      });
      
      // Update initial anxiety
      updateAnxiety(initialAnxiety);
    }
    
    // Cleanup on unmount
    return () => {
      if (!showCompletion) {
        abandonSession();
      }
    };
  }, []);

  // Check for session completion (single watcher)
  useEffect(() => {
    if (isActive && elapsedTime >= targetDuration && !showCompletion && user?.id && !isCompletingRef.current) {
      console.log('⏰ Session duration reached, auto-completing...');
      handleComplete();
    }
  }, [isActive, elapsedTime, targetDuration, showCompletion, user?.id]);

  // Anksiyete eşiğine göre nefes egzersizi önerisi
  const ANXIETY_THRESHOLD = 7; // Kişiselleştirilebilir eşik
  const hasShownBreathworkRef = useRef(false);
  
  useEffect(() => {
    // ERP aktifken ve anksiyete yüksekse nefes egzersizi öner
    if (isActive && currentAnxiety >= ANXIETY_THRESHOLD && !showBreath && !hasShownBreathworkRef.current) {
      console.log('🌬️ High anxiety detected during ERP, suggesting breathwork...');
      
      // Kullanıcıya öneriyi göster (3 saniye sonra otomatik aç)
      const timer = setTimeout(() => {
        if (isActive && currentAnxiety >= ANXIETY_THRESHOLD) {
          setShowBreath(true);
          hasShownBreathworkRef.current = true;
          
          // Haptic feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    // Anksiyete düştüğünde flag'i resetle
    if (currentAnxiety < ANXIETY_THRESHOLD - 2) {
      hasShownBreathworkRef.current = false;
    }
  }, [isActive, currentAnxiety, showBreath]);

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
    if (isCompletingRef.current) {
      return;
    }
    isCompletingRef.current = true;
    if (!user?.id) {
      console.error('❌ No user logged in');
      Alert.alert(
        'Hata',
        'Oturum tamamlanamadı. Lütfen giriş yapın.',
        [{ text: 'Tamam' }]
      );
      isCompletingRef.current = false;
      return;
    }
    
    console.log('🎯 handleComplete called for user:', user.id);
    
    const sessionLog = await completeSession(user.id);
    console.log('📊 Session log received:', sessionLog);
    
    if (!sessionLog) {
      console.error('❌ Session log is null');
      isCompletingRef.current = false;
      return;
    }
    
    // Add compulsion urges to session log
    const enhancedSessionLog = {
      ...sessionLog,
      compulsionUrges: compulsionUrges,
      exerciseType: exerciseType,
      personalGoal: personalGoal,
    };
    
    console.log('✨ Enhanced session log:', enhancedSessionLog);
    
    setShowCompletion(true);
    
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Gamification integration
    const { awardMicroReward, checkAchievements, updateStreak } = useGamificationStore.getState();
    
    // Award micro-reward for ERP completion
    await awardMicroReward('erp_completed');
    try {
      await enhancedAchievements.unlockAchievement(user!.id, 'erp_completed', 'erp_completed', { sessionId: sessionLog.id });
    } catch {}
    
    // Calculate anxiety reduction percentage
    const anxietyReduction = safeDivide((anxietyDataPoints[0]?.level || initialAnxiety) - currentAnxiety, (anxietyDataPoints[0]?.level || initialAnxiety)) * 100;
    
    // Extra reward for significant anxiety reduction
    if (anxietyReduction >= 30) {
      await awardMicroReward('anxiety_reduced');
      try {
        await enhancedAchievements.unlockAchievement(user!.id, 'anxiety_reduced', 'erp_completed', { sessionId: sessionLog.id });
      } catch {}
    }
    
    // Bonus for successful urge resistance
    const resistedUrges = compulsionUrges.filter(urge => urge.resisted).length;
    if (resistedUrges > 0) {
      await awardMicroReward('erp_completed');
    }
    
    // Check for achievements
    await checkAchievements('erp', {
      anxietyReduction,
      duration: elapsedTime,
      urgesResisted: resistedUrges,
    });
    
    // Update streak
    await updateStreak();
    
    console.log('🏆 Gamification updates completed');
    
    if (onComplete) {
      setTimeout(() => onComplete(enhancedSessionLog), 3000);
    }
    // Keep ref true after a successful completion to avoid re-entry
  };

  const handleAbandon = () => {
    abandonSession();
    if (onAbandon) {
      onAbandon();
    }
  };

  // 🆕 Compulsion Urge Tracking Functions
  const handleUrgeButtonPress = () => {
    setShowUrgeBottomSheet(true);
    setUrgeStrength(5); // Reset to default
    
    // Warning haptic to indicate importance
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // Pulse animation for urge button
    urgeButtonPulse.value = withSequence(
      withTiming(1.2, { duration: 200 }),
      withTiming(1, { duration: 200 })
    );
  };

  const handleUrgeResponse = async (resisted: boolean) => {
    const urge: CompulsionUrge = {
      timestamp: elapsedTime,
      strength: urgeStrength,
      resisted: resisted,
    };
    
    setCompulsionUrges(prev => [...prev, urge]);
    setShowUrgeBottomSheet(false);

    if (resisted) {
      // Success haptic and micro-reward
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { awardMicroReward } = useGamificationStore.getState();
      await awardMicroReward('erp_completed');
      
      // Show encouraging message temporarily
      Alert.alert(
        "🌱 Ne güzel!",
        "Bu hissi fark etmek ve onunla nazikçe olmak harika bir adım. Sen güçlüsün.",
        [{ text: "Devam Ediyorum", style: "default" }]
      );
    } else {
      // Gentle haptic, no punishment
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Show understanding message
      Alert.alert(
        "🤗 Seni anlıyorum",
        "Bu tamamen normal. Kendine karşı sabırlı ol. Her deneyim bir öğrenme fırsatı.",
        [{ text: "Devam Ediyorum", style: "default" }]
      );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = safeDivide(elapsedTime, targetDuration);
  const circumference = 2 * Math.PI * ((CIRCLE_SIZE - STROKE_WIDTH) / 2);
  const strokeDashoffset = circumference * (1 - progress);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  const urgeButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: urgeButtonPulse.value }],
  }));

  // Calculate anxiety reduction
  const initialAnxietyLevel = anxietyDataPoints[0]?.level || initialAnxiety;
  const anxietyReduction = safeDivide((initialAnxietyLevel - currentAnxiety), initialAnxietyLevel) * 100;

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
                {initialAnxietyLevel} → {currentAnxiety}
              </Text>
            </View>
            {compulsionUrges.length > 0 && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Dürtü Direnci:</Text>
                <Text style={styles.statValue}>
                  {compulsionUrges.filter(u => u.resisted).length}/{compulsionUrges.length}
                </Text>
              </View>
            )}
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
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.exerciseTitle}>{exerciseName}</Text>
          {category ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <MaterialCommunityIcons 
                name={getCanonicalCategoryIconName(mapToCanonicalCategory(category!)) as any}
                size={16}
                color={getCanonicalCategoryColor(mapToCanonicalCategory(category!))}
                style={{ marginRight: 6 }}
              />
              <Badge 
                text={((): string => {
                  const canonical = mapToCanonicalCategory(category!);
                  return t('categoriesCanonical.' + canonical, 'Kategori');
                })()}
                variant="info"
                size="small"
              />
            </View>
          ) : null}
        </View>
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
          
          <Pressable
            style={styles.pauseButton}
            onPress={handlePauseResume}
          >
            <MaterialCommunityIcons 
              name={isPaused ? "play" : "pause"} 
              size={20} 
              color="#6B7280" 
            />
            <Text style={styles.pauseButtonText}>
              {isPaused ? "Devam Et" : "Dur"}
            </Text>
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

      {/* 🆕 Compulsion Urge Tracking Button */}
      <Animated.View style={[styles.urgeSection, urgeButtonAnimatedStyle]}>
        <Pressable
          style={styles.urgeButton}
          onPress={handleUrgeButtonPress}
        >
          <MaterialCommunityIcons name="heart-pulse" size={20} color="#6366F1" />
          <Text style={styles.urgeButtonText}>Bir şey hissediyorum</Text>
        </Pressable>
      </Animated.View>

      {/* Calming Message */}
      <Animated.View style={[styles.messageContainer, messageAnimatedStyle]}>
        <Text style={styles.calmingMessage}>
          {CALMING_MESSAGES[currentMessage]}
        </Text>
      </Animated.View>

      {/* Breathwork Shortcut */}
      <View style={{ paddingHorizontal: 32, marginBottom: 12 }}>
        <Pressable onPress={() => setShowBreath(true)} style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Nefes egzersizi aç">
          <Text style={{ color: '#047857', fontWeight: '600' }}>Nefes Egzersizi</Text>
        </Pressable>
      </View>

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
            🌟 Yolculuğumu Tamamla
          </Button>
        </Animated.View>
      )}

      {/* 🆕 Urge Tracking BottomSheet */}
      <BottomSheet
        isVisible={showUrgeBottomSheet}
        onClose={() => setShowUrgeBottomSheet(false)}
      >
        <View style={styles.urgeBottomSheetContainer}>
          <Text style={styles.urgeBottomSheetTitle}>Bu hissin şiddetini nasıl tarif edersin?</Text>
          
          <View style={styles.urgeStrengthContainer}>
            <Text style={styles.urgeStrengthValue}>{urgeStrength}/10</Text>
            <Slider
              value={urgeStrength}
              onValueChange={setUrgeStrength}
              minimumValue={1}
              maximumValue={10}
              step={1}
              style={styles.urgeStrengthSlider}
              minimumTrackTintColor="#6366F1"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#6366F1"
            />
            <View style={styles.urgeStrengthLabels}>
              <Text style={styles.urgeStrengthLabel}>Hafif</Text>
              <Text style={styles.urgeStrengthLabel}>Yoğun</Text>
            </View>
          </View>

          <View style={styles.urgeResponseButtons}>
            <Pressable
              style={[styles.urgeResponseButton, styles.resistedButton]}
              onPress={() => handleUrgeResponse(true)}
            >
              <MaterialCommunityIcons name="heart" size={20} color="#FFFFFF" />
              <Text style={styles.urgeResponseButtonText}>💚 Fark ettim ve geçtim</Text>
            </Pressable>
            
            <Pressable
              style={[styles.urgeResponseButton, styles.notResistedButton]}
              onPress={() => handleUrgeResponse(false)}
            >
              <MaterialCommunityIcons name="hand-heart" size={20} color="#FFFFFF" />
              <Text style={styles.urgeResponseButtonText}>🤲 Kendime şefkat gösteriyorum</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      {/* 🆕 Breathwork Inline Modal */}
      <BottomSheet isVisible={showBreath} onClose={() => setShowBreath(false)}>
        <View style={{ padding: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Nefes Egzersizi</Text>
          <BreathworkPlayer hideHeader />
        </View>
      </BottomSheet>
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
    padding: 8,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    flex: 1,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  timerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRemaining: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
  },
  timeLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 20,
  },
  pauseButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 30,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pauseButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  anxietySection: {
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  anxietyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter-Medium',
  },
  anxietySliderContainer: {
    alignItems: 'center',
  },
  anxietyValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
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
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  // 🆕 Urge Tracking Styles
  urgeSection: {
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  urgeButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  urgeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4338CA',
    fontFamily: 'Inter-Medium',
  },
  urgeBottomSheetContainer: {
    padding: 24,
  },
  urgeBottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Medium',
  },
  urgeStrengthContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  urgeStrengthValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F59E0B',
    marginBottom: 12,
    fontFamily: 'Inter-Medium',
  },
  urgeStrengthSlider: {
    width: '100%',
    height: 40,
  },
  urgeStrengthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  urgeStrengthLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  urgeResponseButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  urgeResponseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  resistedButton: {
    backgroundColor: '#10B981',
  },
  notResistedButton: {
    backgroundColor: '#6B7280',
  },
  urgeResponseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  messageContainer: {
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  calmingMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  completeButtonContainer: {
    position: 'absolute',
    bottom: 34,
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