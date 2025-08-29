/**
 * SimpleVoiceRecorder - iPhone Voice Memos tarzı minimalist check-in
 * 
 * Özellikler:
 * - Büyük kırmızı yuvarlak kayıt butonu  
 * - Ding/dong ses efektleri
 * - Minimalist timer display
 * - Wave animasyonu (opsiyonel)
 * - Native speech-to-text
 * - Heuristik mood analizi
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// Hooks & Services
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Toast } from '@/components/ui/Toast';
import audioService, { useVoiceCheckInAudio } from '@/services/audioService';
import speechToTextService, { type TranscriptionResult } from '@/services/speechToTextService';
import voiceCheckInHeuristicService, { type MoodAnalysisResult } from '@/services/voiceCheckInHeuristicService';
import moodTracker from '@/services/moodTrackingService';

const { width, height } = Dimensions.get('window');

interface SimpleVoiceRecorderProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface RecordingState {
  isRecording: boolean;
  duration: number;  // seconds
  hasRecording: boolean;
}

export default function SimpleVoiceRecorder({
  isVisible,
  onClose,
  onComplete,
}: SimpleVoiceRecorderProps) {
  const { user } = useAuth();
  const { playStartSound, playStopSound, preload } = useVoiceCheckInAudio();
  
  // Recording State
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    hasRecording: false,
  });

  // UI State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Animations
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Refs
  const recording = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎵 Preload sounds on mount
  useEffect(() => {
    if (isVisible) {
      preload().catch(error => {
        console.warn('Sound preload failed:', error);
      });
    }
  }, [isVisible, preload]);

  // ⏱️ Timer Effect
  useEffect(() => {
    if (recordingState.isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.duration + 1
        }));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState.isRecording]);

  // 🎵 Audio Effects (using AudioService)
  const playDingSound = async () => {
    try {
      await playStartSound();
    } catch (error) {
      console.warn('Could not play ding sound:', error);
    }
  };

  const playDongSound = async () => {
    try {
      await playStopSound();
    } catch (error) {
      console.warn('Could not play dong sound:', error);
    }
  };

  // 🎙️ Recording Controls
  const startRecording = async () => {
    try {
      console.log('🎙️ Starting recording...');
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni gerekli.');
        return;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
      });

      recording.current = newRecording;
      
      setRecordingState({
        isRecording: true,
        duration: 0,
        hasRecording: false,
      });

      // Play start sound & animation
      await playDingSound();
      startPulseAnimation();

    } catch (error) {
      console.error('Recording start failed:', error);
      showToastMessage('Kayıt başlatılamadı ⚠️');
    }
  };

  const stopRecording = async () => {
    try {
      console.log('🛑 Stopping recording...');
      
      if (!recording.current) return;

      // Stop recording
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;

      setRecordingState({
        isRecording: false,
        duration: recordingState.duration,
        hasRecording: true,
      });

      // Play stop sound & stop animation
      await playDongSound();
      stopPulseAnimation();

      // Process recording
      if (uri) {
        await processRecording(uri, recordingState.duration);
      }

    } catch (error) {
      console.error('Recording stop failed:', error);
      showToastMessage('Kayıt durdurulamadı ⚠️');
    }
  };

  // 📝 Process Recording - Complete Pipeline
  const processRecording = async (uri: string, duration: number) => {
    console.log('📝 Starting voice check-in processing pipeline...', { uri, duration });
    
    setIsProcessing(true);
    
    try {
      // STEP 1: Speech-to-Text
      showToastMessage('Konuşmanız metne dönüştürülüyor... 🎤');
      console.log('🎤 Step 1: Speech-to-Text');
      
      const transcription: TranscriptionResult = await speechToTextService.transcribeAudio(uri, {
        language: 'tr-TR',
        maxDuration: duration,
      });

      if (!transcription.success || !transcription.text.trim()) {
        throw new Error(`Ses metne çevrilemedi: ${transcription.error || 'Bilinmeyen hata'}`);
      }

      console.log('✅ Transcription successful:', {
        text: transcription.text.substring(0, 100),
        confidence: transcription.confidence,
      });

      // STEP 2: Heuristic Mood Analysis  
      showToastMessage('Duygu durumunuz analiz ediliyor... 🧠');
      console.log('🧠 Step 2: Heuristic Mood Analysis');
      
      const moodAnalysis: MoodAnalysisResult = await voiceCheckInHeuristicService.analyzeMoodFromVoice(transcription);

      console.log('✅ Mood analysis complete:', {
        mood: moodAnalysis.moodScore,
        energy: moodAnalysis.energyLevel,
        anxiety: moodAnalysis.anxietyLevel,
        emotion: moodAnalysis.dominantEmotion,
        confidence: moodAnalysis.confidence,
      });

      // STEP 3: Auto Mood Entry Creation
      showToastMessage('Mood kaydınız oluşturuluyor... 💾');
      console.log('💾 Step 3: Auto Mood Entry Creation');

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const moodEntry = await moodTracker.saveMoodEntry({
        mood_score: moodAnalysis.moodScore,
        energy_level: moodAnalysis.energyLevel,
        anxiety_level: moodAnalysis.anxietyLevel,
        notes: `[Sesli Check-in] ${moodAnalysis.notes}`,
        triggers: moodAnalysis.triggers.length > 0 ? moodAnalysis.triggers : ['sesli_checkin'],
        activities: moodAnalysis.activities,
        user_id: user.id,
        // Additional metadata
        source: 'voice_checkin',
        analysis_confidence: moodAnalysis.confidence,
        dominant_emotion: moodAnalysis.dominantEmotion,
        voice_duration: duration,
      } as any);

      console.log('✅ Mood entry created:', {
        id: moodEntry.id,
        mood: moodEntry.mood_score,
        source: 'voice_checkin'
      });

      // STEP 4: Success
      showToastMessage(`Check-in tamamlandı! Mood: ${moodAnalysis.moodScore}/10 ✅`);
      
      // Show detailed result briefly
      setTimeout(() => {
        showToastMessage(
          `🎭 ${moodAnalysis.dominantEmotion} | ⚡ Enerji: ${moodAnalysis.energyLevel} | 😰 Anksiyete: ${moodAnalysis.anxietyLevel}`
        );
      }, 2000);
      
      // Close after showing results
      setTimeout(() => {
        onComplete?.();
        onClose();
      }, 4000);

    } catch (error) {
      console.error('❌ Voice check-in processing failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      showToastMessage(`İşleme hatası: ${errorMessage} ⚠️`);
      
      // Auto-close on error after delay
      setTimeout(() => {
        onClose();
      }, 3000);

    } finally {
      setIsProcessing(false);
    }
  };

  // 🎬 Animations
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Wave animation
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      })
    ).start();
  };

  const stopPulseAnimation = () => {
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    waveAnim.stopAnimation();
    waveAnim.setValue(0);
  };

  // 🎯 Main Button Press Handler
  const handleRecordPress = async () => {
    if (isProcessing) return;

    if (recordingState.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // ⏱️ Format Duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🌊 Wave Components (Minimalist)
  const renderWaveAnimation = () => {
    if (!recordingState.isRecording) return null;

    return (
      <View style={styles.waveContainer}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveLine,
              {
                opacity: waveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                transform: [{
                  scaleY: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, Math.random() * 2 + 0.5],
                  }),
                }],
              }
            ]}
          />
        ))}
      </View>
    );
  };

  // 🎯 Toast Helper
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      <View style={styles.container}>
        {/* Minimal Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Check-in</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#666" />
          </Pressable>
        </View>

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>
            {formatDuration(recordingState.duration)}
          </Text>
          <Text style={styles.statusText}>
            {isProcessing 
              ? 'İşleniyor...' 
              : recordingState.isRecording 
              ? 'Kaydediliyor' 
              : recordingState.hasRecording 
              ? 'Kayıt tamamlandı'
              : 'Konuşmaya hazır'
            }
          </Text>
        </View>

        {/* Wave Animation */}
        {renderWaveAnimation()}

        {/* Main Record Button - iPhone Style */}
        <View style={styles.recordButtonContainer}>
          <Animated.View
            style={[
              styles.recordButtonWrapper,
              {
                transform: [{ scale: pulseAnim }]
              }
            ]}
          >
            <Pressable
              onPress={handleRecordPress}
              disabled={isProcessing}
              style={({ pressed }) => [
                styles.recordButton,
                {
                  backgroundColor: recordingState.isRecording ? '#FF3B3F' : '#FF4E50',
                  opacity: isProcessing ? 0.6 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={recordingState.isRecording ? "stop" : "microphone"}
                size={48}
                color="#FFFFFF"
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Simple Instructions */}
        <Text style={styles.instructionText}>
          {recordingState.isRecording 
            ? 'Konuşun, dinliyoruz...' 
            : 'Nasıl hissettiğinizi anlatın'
          }
        </Text>

        {/* Toast */}
        <Toast
          visible={showToast}
          message={toastMessage}
          type={toastMessage.includes('✅') ? 'success' : 'info'}
          onHide={() => setShowToast(false)}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    minHeight: height * 0.3,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#1A1A1A',
    fontFamily: 'SF Mono',
    letterSpacing: 2,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    fontFamily: 'Inter',
  },

  // Wave Animation
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    marginBottom: 50,
    gap: 4,
  },
  waveLine: {
    width: 3,
    height: 30,
    backgroundColor: '#FF4E50',
    borderRadius: 1.5,
  },

  // Record Button - iPhone Style
  recordButtonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButtonWrapper: {
    shadowColor: '#FF4E50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },

  // Instructions
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 22,
    maxWidth: width * 0.8,
  },
});
