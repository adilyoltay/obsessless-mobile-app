import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  Pressable, 
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Components
import VAPad from './VAPad';
import MoodDetailsStep from './MoodDetailsStep';

// Services
import voiceCheckInHeuristicService, { RealtimeState } from '@/services/voiceCheckInHeuristicService';
import moodTracker from '@/services/moodTrackingService';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useRouter } from 'expo-router';

// Import gerçek STT service - iOS crash sorununu çözelim
import speechToTextService from '@/services/speechToTextService';

const { width: W } = Dimensions.get('window');
const PAD = Math.min(W - 48, 340);

// Utility functions
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const to01 = (t: number) => (t + 1) / 2;
const to1_10 = (t01: number) => {
  const rounded = Math.round(1 + 9 * t01);
  return Math.max(1, Math.min(10, rounded));
};
const from1_10 = (v: number) => {
  const result = ((v - 1) / 9) * 2 - 1;
  return Math.max(-1, Math.min(1, result));
};

// Enhanced coordinate mapping with gain/gamma curve for better dot movement  
const toCoord = (score: number, gain = 1.5, gamma = 0.85): number => {
  // 5.0 → 0 merkezlenmiş normalizasyon (1..10 → [-1..1])  
  const n = Math.max(-1, Math.min(1, (score - 5.0) / 5.0)); // CENTER=5.0 (drift fix!)
  const curved = Math.sign(n) * Math.pow(Math.abs(n), gamma);
  return Math.max(-1, Math.min(1, curved * gain));
};

// Color functions
const mixHex = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ra = (A >> 16) & 255, ga = (A >> 8) & 255, ba = A & 255;
  const rb = (B >> 16) & 255, gb = (B >> 8) & 255, bb = B & 255;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(m(ra, rb))}${hx(m(ga, gb))}${hx(m(ba, bb))}`;
};

const lighten = (hex: string, amt: number) => mixHex(hex, '#ffffff', clamp(amt, 0, 1));

const withA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
};

// Color scheme
const C_NEG_LOW = '#64748b';  // sad-calm
const C_POS_LOW = '#22d3ee';  // calm-positive
const C_NEG_HIGH = '#ef4444'; // anxiety/anger
const C_POS_HIGH = '#22c55e'; // excited-positive
const C_NEUTRAL = '#60a5fa';  // center

function colorFromVA(x: number, y: number) {
  const u = (x + 1) / 2, v = (y + 1) / 2;
  const bottom = mixHex(C_NEG_LOW, C_POS_LOW, u);
  const top = mixHex(C_NEG_HIGH, C_POS_HIGH, u);
  let base = mixHex(bottom, top, v);
  const d = Math.sqrt(x * x + y * y) / Math.SQRT2;
  const clampedD = Math.max(0, Math.min(1, d));
  const wCenter = Math.pow(1 - clampedD, 1.4) * 0.45;
  base = mixHex(base, C_NEUTRAL, wCenter);
  return lighten(base, v * 0.15);
}

// Label functions
const valenceLabel = (x: number) => {
  if (x <= -0.6) return 'Çok keyifsiz';
  if (x < -0.2) return 'Keyifsiz';
  if (Math.abs(x) <= 0.2) return 'Nötr';
  if (x < 0.6) return 'Keyifli';
  return 'Çok keyifli';
};

const energyLabel = (y: number) => {
  if (y <= -0.6) return 'Çok yorgun';
  if (y < -0.2) return 'Yorgun';
  if (Math.abs(y) <= 0.2) return 'Normal';
  if (y < 0.6) return 'Enerjik';
  return 'Çok enerjik';
};

interface VAMoodCheckinProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (result: any) => void;
}

export default function VAMoodCheckin({
  isVisible,
  onClose,
  onComplete,
}: VAMoodCheckinProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  
  // VA Pad state
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const [xy, setXY] = useState({ x: 0, y: 0 });
  
  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [detectedTriggers, setDetectedTriggers] = useState<string[]>([]);
  const [isNativeSTTAvailable, setIsNativeSTTAvailable] = useState(false);
  
  // Realtime analysis state
  const realtimeStateRef = useRef<RealtimeState | null>(null);
  
  // Recording animation
  const recordingScale = useSharedValue(1);
  const recordingOpacity = useSharedValue(1);
  
  // Slider haptic zones
  const lastZoneRef = useRef<number>(-1);
  const zoneOf = (v01: number) => (v01 < 0.2 ? 0 : v01 < 0.5 ? 1 : v01 < 0.8 ? 2 : 3);

  // Realtime analysis refs and guards
  const partialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRealtimeAnalyzingRef = useRef(false);
  const lastRealtimeTextRef = useRef('');
  const lastUpdateTimeRef = useRef(0);

  const updateXY = useCallback((nx: number, ny: number) => {
    setXY({ x: nx, y: ny });
  }, []);

  const recordButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingScale.value }],
    opacity: recordingOpacity.value,
  }));

  const color = useMemo(() => colorFromVA(xy.x, xy.y), [xy]);

  // Check STT availability on component mount
  useEffect(() => {
    const checkSTTAvailability = async () => {
      try {
        console.log('🔍 Checking native STT availability...');
        const available = await speechToTextService.checkAvailability();
        setIsNativeSTTAvailable(available);
        
        if (available) {
          console.log('✅ Native STT is available');
        } else {
          console.log('⚠️ Native STT not available - will throw error instead of fallback');
        }
      } catch (error) {
        console.error('❌ STT availability check failed:', error);
        setIsNativeSTTAvailable(false);
        // Re-throw error instead of silent fallback
        throw error;
      }
    };
    
    checkSTTAvailability();
  }, []);

  // Clean up realtime analysis when modal closes
  useEffect(() => {
    if (!isVisible) {
      // Modal closed - clean up realtime analysis
      if (partialTimerRef.current) {
        clearTimeout(partialTimerRef.current);
        partialTimerRef.current = null;
      }
      realtimeStateRef.current = null;
      isRealtimeAnalyzingRef.current = false;
      lastRealtimeTextRef.current = '';
      lastUpdateTimeRef.current = 0;
      console.log('🎧 Realtime v3.5: cleaned up on modal close');
    }
  }, [isVisible]);

  // Handle voice recording
  const handleVoiceToggle = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);
      
      // Cancel animations and reset
      cancelAnimation(recordingScale);
      cancelAnimation(recordingOpacity);
      recordingScale.value = withTiming(1, { duration: 180 });
      recordingOpacity.value = withTiming(1, { duration: 180 });
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Clean up realtime analysis
      if (partialTimerRef.current) {
        clearTimeout(partialTimerRef.current);
        partialTimerRef.current = null;
      }
      realtimeStateRef.current = null;
      isRealtimeAnalyzingRef.current = false;
      
      try {
        // 🛑 Stop real STT - no fallback, surface real errors
        console.log('🛑 Stopping native STT...');
        const result = await speechToTextService.stopRealtimeListening();
        console.log('✅ Native STT stopped, result:', { success: result.success, textLength: result.text?.length });
        
        if (result && result.success && result.text) {
          setTranscript(result.text);
          setShowTranscript(true);
          
          // Analyze with heuristic
          const analysis = await voiceCheckInHeuristicService.analyzeMoodFromVoice(result);
          
          // Store detected triggers for Step 2
          if (analysis.triggers && analysis.triggers.length > 0) {
            setDetectedTriggers(analysis.triggers);
            console.log('🎯 Detected triggers from voice:', analysis.triggers);
          }
          
          // Convert to VA coordinates (enhanced gain/gamma curve)
          const vx = toCoord(analysis.moodScore);
          const vy = toCoord(analysis.energyLevel);
          
          // Final position adjustment with accelerated timing (no snap, smooth convergence)
          console.log('🎧 Final: converging to precise position ->', { vx, vy, mood: analysis.moodScore, energy: analysis.energyLevel });
          x.value = withTiming(vx, { duration: 450 }); // Smooth convergence, not snap
          y.value = withTiming(vy, { duration: 450 });
          setXY({ x: vx, y: vy });
          
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          // If no result, show detailed error
          setTranscript('STT failed: No transcript received from native service');
          setShowTranscript(true);
        }
      } catch (error) {
        console.error('❌ Native STT processing failed:', error);
        // 🚨 Show real error details instead of generic message
        const errorMsg = error instanceof Error ? error.message : 'Unknown STT error';
        setTranscript(`Native STT Error: ${errorMsg}`);
        setShowTranscript(true);
        
        // Re-throw to surface the problem in console
        throw error;
      } finally {
        setIsProcessing(false);
        // Cancel animations again in case of error
        cancelAnimation(recordingScale);
        cancelAnimation(recordingOpacity);
        recordingScale.value = 1;
        recordingOpacity.value = 1;
      }
    } else {
      // 🚨 NO FALLBACK - Force real STT to surface the actual error
      console.log('🎤 Starting REAL native STT (no fallback)...');
      
      // Start recording
      setIsRecording(true);
      setTranscript('');
      setShowTranscript(false);
      
      // Initialize realtime analysis state
      realtimeStateRef.current = voiceCheckInHeuristicService.beginRealtime();
      lastRealtimeTextRef.current = '';
      console.log('🎧 Realtime v3.5: started with fresh state');
      
      // Start infinite pulsing animation
      recordingScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      recordingOpacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      try {
        // 🎤 Real STT - no fallback, let errors surface
        console.log('🎤 Starting real-time speech recognition with native STT...');
        await speechToTextService.startRealtimeListening(
          scheduleRealtimeAnalysis,
          'tr-TR'
        );
        console.log('✅ Native STT started successfully');
      } catch (error) {
        console.error('❌ Native STT failed to start:', error);
        setIsRecording(false);
        // Cancel animations
        cancelAnimation(recordingScale);
        cancelAnimation(recordingOpacity);
        recordingScale.value = 1;
        recordingOpacity.value = 1;
        
        // 🚨 Show real error instead of generic message
        const errorMsg = error instanceof Error ? error.message : 'Unknown STT error';
        setTranscript(`STT Error: ${errorMsg}`);
        setShowTranscript(true);
        
        // Re-throw to surface the actual problem
        throw error;
      }
    }
  };

  const handleNext = () => {
    // Clean up realtime analysis before moving to step 2
    if (partialTimerRef.current) {
      clearTimeout(partialTimerRef.current);
      partialTimerRef.current = null;
    }
          realtimeStateRef.current = null;
      isRealtimeAnalyzingRef.current = false;
      lastRealtimeTextRef.current = '';
      lastUpdateTimeRef.current = 0;
      
      console.log('🎧 Realtime v3.5: disabled for step 2');
    
    // Move to step 2 (details)
    setCurrentStep(2);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    // Go back to step 1
    setCurrentStep(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = async (details: { notes: string; trigger?: string }) => {
    try {
      if (!user?.id) {
        console.error('❌ No user ID available');
        return;
      }

      const mood01 = to01(xy.x);
      const energy01 = to01(xy.y);
      const mood10 = to1_10(mood01);
      const energy10 = to1_10(energy01);
      
      // Prepare mood entry data with VA coordinates and details
      const moodData = {
        mood_score: mood10 * 10, // Convert to 0-100 scale
        energy_level: energy10,
        anxiety_level: 5, // Default value, can be enhanced later
        notes: details.notes || `Duygu: ${valenceLabel(xy.x)}, Enerji: ${energyLabel(xy.y)}`,
        triggers: details.trigger ? [details.trigger] : [],
        activities: [],
        user_id: user.id,
        source: 'va_pad_voice',
        method: 'va_pad+slider+voice',
        // Store raw VA coordinates for analytics
        metadata: {
          va_point: { x: xy.x, y: xy.y },
          transcript: transcript
        } as any
      };

      console.log('💾 Saving mood entry:', moodData);
      
      // Save mood entry
      const savedEntry = await moodTracker.saveMoodEntry(moodData);
      
      if (savedEntry) {
        console.log('✅ Mood entry saved successfully');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Reset to step 1 for next use
        setCurrentStep(1);
        setTranscript('');
        setShowTranscript(false);
        setDetectedTriggers([]);
        
        // Clean up realtime analysis
        if (partialTimerRef.current) {
          clearTimeout(partialTimerRef.current);
          partialTimerRef.current = null;
        }
        realtimeStateRef.current = null;
        isRealtimeAnalyzingRef.current = false;
        lastRealtimeTextRef.current = '';
        lastUpdateTimeRef.current = 0;
        
        x.value = 0;
        y.value = 0;
        setXY({ x: 0, y: 0 });
        
        // Close modal and navigate to mood page
        onClose();
        
        // Optional: Call onComplete callback
        if (onComplete) {
          onComplete({
            type: 'MOOD',
            confidence: 0.95,
            data: moodData
          });
        }
        
        // Navigate to mood page after a short delay
        setTimeout(() => {
          router.push('/(tabs)/mood');
        }, 300);
      }
    } catch (error) {
      console.error('❌ Failed to save mood entry:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const mood01 = to01(xy.x);
  const valenceText = valenceLabel(xy.x);
  const energyText = energyLabel(xy.y);

  // Helper: Get recency window for more accurate realtime analysis
  const getRecencyWindow = useCallback((text: string, maxWords = 15): string => {
    const lower = text.toLowerCase();
    
    // Çelişki/akış kelimeleri: recency segment ayırıcılar
    const splitters = [' ama ', ' fakat ', ' ancak ', ' lakin ', ' sonra ', ' birden ', ' şimdi ', ' artık '];
    let seg = lower;
    
    // Son çelişki kelimesinden sonrasını al
    for (const s of splitters) {
      const idx = seg.lastIndexOf(s);
      if (idx !== -1) {
        seg = seg.slice(idx + s.length);
        break; // İlk bulunan (en son) splitter'dan sonrasını al
      }
    }
    
    // Son maxWords kelimeyi al
    const words = seg.trim().split(/\s+/).filter(Boolean);
    const tail = words.slice(-maxWords);
    return tail.join(' ');
  }, []);

  // Enhanced realtime analysis with incremental API
  const scheduleRealtimeAnalysis = useCallback((partial: string) => {
    // 1) UI transcript'ı göster
    setTranscript(partial);

    // 2) Sadece Step 1'de ve anlamlı uzunluktaysa çalış
    if (currentStep !== 1) return;
    const clean = partial.trim();
    if (clean.length < 8) return; // tek kelimelik parçalarda analiz yok

    // 3) Initialize realtime state if needed
    if (!realtimeStateRef.current) {
      realtimeStateRef.current = voiceCheckInHeuristicService.beginRealtime();
      console.log('🎧 Realtime: initialized state');
    }

    // 4) Get new chunk (difference from last analysis)
    const lastText = lastRealtimeTextRef.current;
    const newChunk = clean.length > lastText.length ? clean.slice(lastText.length).trim() : clean;
    
    // 5) Min-chunk gate: En az 2 kelime veya 8+ karakter
    const words = newChunk.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2 || newChunk.length < 8) return;
    
    lastRealtimeTextRef.current = clean;

    // 6) Debounce
    if (partialTimerRef.current) clearTimeout(partialTimerRef.current);
    partialTimerRef.current = setTimeout(async () => {
      // Re-entrancy guard
      if (isRealtimeAnalyzingRef.current) return;
      isRealtimeAnalyzingRef.current = true;
      
      try {
        console.log('🎧 Realtime v3.5: analyzing chunk ->', newChunk.slice(0, 50));
        
        // Incremental analysis (compiled patterns + EMA smoothing)
        const res = voiceCheckInHeuristicService.incrementalAnalyze(
          realtimeStateRef.current!,
          newChunk
        );

        // Crisis detection
        const crisis = voiceCheckInHeuristicService.detectCrisis(clean);
        if (crisis.flagged) {
          console.log('🚨 Crisis detected:', crisis.hits);
          // TODO: Crisis UI handling
        }

        // Enhanced adaptive gating based on signal strength and confidence
        const now = Date.now();
        const signal = res.signalStrength || 0;
        const confidence = res.confidence || 0;
        
        // Adaptive gate: Strong signals pass through, weak signals get filtered
        const gateOk = confidence >= 0.55 || signal >= 0.22;
        const isNeutralScores = (m: number, e: number) => Math.abs(m - 5) <= 0.5 && Math.abs(e - 5) <= 0.5;
        
        if (!gateOk || (isNeutralScores(res.moodScore, res.energyLevel) && (now - lastUpdateTimeRef.current) < 600)) {
          console.log('🎧 Realtime: gated ->', { 
            reason: !gateOk ? 'low signal' : 'neutral timeout',
            signal: signal.toFixed(2), 
            confidence: confidence.toFixed(2) 
          });
          return;
        }

        // VA koordinatlarına çevir (enhanced gain/gamma curve)
        const vx = toCoord(res.moodScore);
        const vy = toCoord(res.energyLevel);

        console.log('🎧 Realtime v3.5: applied ->', { 
          vx, vy, 
          mood: res.moodScore, 
          energy: res.energyLevel, 
          crisis: crisis.flagged,
          chunk: newChunk.slice(0, 30) 
        });

        // Update timestamp for successful movement
        lastUpdateTimeRef.current = now;

        // 🛡️ REMOVED: Micro-movement skip - let physics handle smoothing
        // Physics-based animation will handle jitter via deadband

        // Direct coordinate update (no EMA - let Reanimated handle smoothing)
        x.value = withTiming(vx, { duration: 200 });
        y.value = withTiming(vy, { duration: 200 });
        setXY({ x: vx, y: vy });
        
        // Haptic feedback for significant position changes
        if (Math.abs(vx - xy.x) > 0.15 || Math.abs(vy - xy.y) > 0.15) {
          Haptics.selectionAsync();
        }

        console.log('🎧 Realtime v3.5: dot updated ->', { 
          to: { x: vx.toFixed(3), y: vy.toFixed(3) },
          mood: res.moodScore, 
          energy: res.energyLevel,
          delta: { dx: (vx - xy.x).toFixed(3), dy: (vy - xy.y).toFixed(3) }
        });
      } catch (e) {
        // Sessiz fail: realtime'da gürültü olabilir
        if (__DEV__) console.warn('🎧 Realtime v3.5 analysis failed:', e);
      } finally {
        isRealtimeAnalyzingRef.current = false;
      }
    }, 350); // 350ms debounce - faster response
  }, [currentStep, x, y, xy]);

  // Slider value change handler - must be defined before render to avoid hook count mismatch
  const handleSliderChange = useCallback((v: number) => {
    // Inline clamp to avoid any issues
    const rawX = v * 2 - 1;
    const vx = Math.max(-1, Math.min(1, rawX));
    x.value = vx;
    setXY(prev => ({ x: vx, y: prev.y }));
    
    // Haptic feedback on zone transitions
    const z = zoneOf(v);
    if (z !== lastZoneRef.current) {
      lastZoneRef.current = z;
      Haptics.selectionAsync();
    }
  }, []);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      {currentStep === 1 ? (
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
            <Text style={styles.title}>Duygu Kontrolü</Text>
            <View style={styles.placeholder} />
          </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitle}>Şu anda nasıl hissettiğinizi seçin</Text>

          {/* VA Pad Component */}
          <VAPad
            x={x}
            y={y}
            onChangeXY={updateXY}
            color={color}
          />

          {/* Mood labels */}
          <View style={styles.moodDisplay}>
            <Text style={[styles.moodLabel, { color }]}>{valenceText}</Text>
            <Text style={styles.energyLabel}>{energyText}</Text>
          </View>

          {/* Valence Slider */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderWrap}>
              <Slider
                value={mood01}
                onValueChange={handleSliderChange}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor={color}
                style={styles.slider}
              />
              <View style={styles.barBg} />
              <View style={[styles.barFill, { width: `${mood01 * 100}%`, backgroundColor: color }]} />
            </View>
            
            {/* Slider labels */}
            <View style={styles.scale}>
              <Text style={styles.scaleText}>Çok keyifsiz</Text>
              <Text style={styles.scaleText}>Nötr</Text>
              <Text style={styles.scaleText}>Çok keyifli</Text>
            </View>
          </View>

          {/* Voice Check-in Button */}
          <Pressable
            style={styles.voiceButton}
            onPress={handleVoiceToggle}
            disabled={isProcessing}
            accessibilityLabel={isRecording ? "Kaydı durdur" : "Voice Check-in"}
          >
            <Animated.View style={[styles.voiceButtonInner, recordButtonStyle]}>
              {isProcessing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons 
                    name={isRecording ? "stop" : "microphone"} 
                    size={20} 
                    color="white" 
                  />
                  <Text style={styles.voiceButtonText}>
                    {isRecording ? 'Kaydı Durdur' : 'Voice Check-in'}
                  </Text>
                </>
              )}
            </Animated.View>
          </Pressable>

          {/* Transcript display */}
          {showTranscript && transcript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          )}

          {/* Action Button - Next */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.primary, { backgroundColor: color }]}
              onPress={handleNext}
            >
              <Text style={styles.btnTxt}>İleri</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
      ) : (
        <MoodDetailsStep
          transcript={transcript}
          detectedTriggers={detectedTriggers}
          onBack={handleBack}
          onSave={handleSave}
          moodColor={color}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 16,
    alignItems: 'center',
  },
  subtitle: {
    color: '#6B7280',
    marginBottom: 20,
    fontSize: 14,
  },

  moodDisplay: {
    marginTop: 20,
    alignItems: 'center',
  },
  moodLabel: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  energyLabel: {
    fontSize: 16,
    color: '#93a6b7',
  },
  sliderSection: {
    width: PAD,
    marginTop: 24,
  },
  sliderWrap: {
    width: PAD,
    height: 20,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
    position: 'absolute',
    zIndex: 2,
  },
  barBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 6,
    height: 8,
    borderRadius: 999,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  voiceButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#12202b',
  },
  voiceButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceButtonText: {
    color: '#e8f2ff',
    fontSize: 16,
    fontWeight: '600',
  },
  transcriptBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a2530',
    borderRadius: 12,
    width: PAD,
  },
  transcriptText: {
    fontSize: 14,
    color: '#93a6b7',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    marginBottom: 20,
  },
  btn: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: '#22C55E',
  },
  secondary: {
    backgroundColor: '#2a3540',
  },
  btnTxt: {
    color: '#e8f2ff',
    fontWeight: '700',
    fontSize: 16,
  },
});
