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
import { useRouter } from 'expo-router';

// Hooks & Services
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Toast } from '@/components/ui/Toast';
import audioService, { useVoiceCheckInAudio } from '@/services/audioService';
import speechToTextService, { type TranscriptionResult } from '@/services/speechToTextService';
import voiceCheckInHeuristicService, { type MoodAnalysisResult } from '@/services/voiceCheckInHeuristicService';

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
  const router = useRouter();
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

  // Analysis State (no confirmation needed)
  const [analysisResult, setAnalysisResult] = useState<MoodAnalysisResult | null>(null);

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
      }, 1000) as any;
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

      // Start recording with simplified configuration
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

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

      console.log('✅ Transcription attempt complete:', {
        success: transcription.success,
        hasText: !!transcription.text.trim(),
        confidence: transcription.confidence,
      });

      // STEP 2: Process Based on Transcription Success
      if (transcription.success && transcription.text.trim()) {
        // ✅ TRANSCRIPT SUCCESS: Analyze and pre-fill
        showToastMessage('Duygu durumunuz analiz ediliyor... 🧠');
        console.log('🧠 Step 2A: Heuristic Analysis (transcript available)');
        
        const moodAnalysis: MoodAnalysisResult = await voiceCheckInHeuristicService.analyzeMoodFromVoice(transcription);

        console.log('✅ Mood analysis complete:', {
          mood: moodAnalysis.moodScore,
          energy: moodAnalysis.energyLevel,
          anxiety: moodAnalysis.anxietyLevel,
          emotion: moodAnalysis.dominantEmotion,
          confidence: moodAnalysis.confidence,
        });

        // Navigate with pre-filled data
        showToastMessage('Analiz tamamlandı! Mood formu açılıyor... 📊');
        
        const moodPageTrigger = mapTriggerToMoodPage(moodAnalysis.triggers[0]);
        const moodScore100 = (moodAnalysis.moodScore - 1) * 11.11;
        
        setTimeout(() => {
          onClose();
          router.push({
            pathname: '/(tabs)/mood',
            params: {
              prefill: 'true',
              source: 'voice_checkin_analyzed', 
              mood: Math.round(moodScore100).toString(),
              energy: moodAnalysis.energyLevel.toString(),
              anxiety: moodAnalysis.anxietyLevel.toString(),
              notes: transcription.text, // Clean transcript
              trigger: moodPageTrigger,
              emotion: mapEmotionToPrimary(moodAnalysis.dominantEmotion),
              confidence: moodAnalysis.confidence.toFixed(2),
              voice_duration: recordingState.duration.toString(),
            }
          });
          onComplete?.();
        }, 1000);

      } else {
        // ❌ TRANSCRIPT FAILED: Open empty mood form
        showToastMessage('Ses çevrilemedi. Mood formu açılıyor... ✏️');
        console.log('📝 Step 2B: Transcript failed, opening empty mood form');
        
        setTimeout(() => {
          onClose();
          router.push({
            pathname: '/(tabs)/mood',
            params: {
              prefill: 'true',
              source: 'voice_checkin_manual',
              notes: '', // Empty - user will fill manually
            }
          });
          onComplete?.();
        }, 1000);
      }

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

  // 🔄 Reset State
  const resetState = () => {
    setAnalysisResult(null);
    setRecordingState({
      isRecording: false,
      duration: 0,
      hasRecording: false,
    });
  };

  // 🗺️ Map heuristic triggers to mood page triggers
  const mapTriggerToMoodPage = (heuristicTrigger?: string): string => {
    if (!heuristicTrigger || heuristicTrigger === 'sesli_checkin') return 'Diğer';

    const triggerMap: { [key: string]: string } = {
      // Work related
      'iş_yoğun_stres': 'İş/Okul',
      'iş_stres': 'İş/Okul',
      'eğitim_stres': 'İş/Okul',
      
      // Relationships  
      'ilişki_krizi': 'İlişkiler',
      'aile_ilişki': 'Aile',
      'sosyal_kaygı': 'Sosyal',
      'sosyal_izolasyon': 'Sosyal',
      'yalnızlık_destek': 'Sosyal',
      
      // Health
      'ciddi_sağlık': 'Sağlık',
      'sağlık_endişe': 'Sağlık',
      
      // Financial
      'finansal_kriz': 'Finansal',
      'finansal_kaygı': 'Finansal',
      'ekonomik_durum': 'Finansal',
      
      // Other categories
      'teknoloji_arıza': 'Diğer',
      'dijital_bağlantı': 'Diğer',
      'ulaşım_sorunu': 'Diğer',
      'araç_problemi': 'Diğer',
      'konut_problemi': 'Diğer',
      'siyasi_gündem': 'Diğer',
      'haber_medya': 'Diğer',
      'afet_travma': 'Diğer',
    };

    return triggerMap[heuristicTrigger] || 'Diğer';
  };

  // 🎭 Map heuristic emotions to MoodQuickEntry primary emotions
  const mapEmotionToPrimary = (heuristicEmotion: string): string => {
    const emotionMap: { [key: string]: string } = {
      // Positive → mutlu or güvenli
      'çok_mutlu': 'mutlu',
      'mutlu': 'mutlu',
      'umutlu': 'mutlu',
      'enerjik': 'mutlu', 
      'kararlı': 'güvenli',
      'heyecanlı': 'mutlu',
      'gururlu': 'güvenli',
      'meraklı': 'mutlu',
      
      // Negative - specific mapping
      'kaygılı': 'korkmuş',
      'panik': 'korkmuş',
      'üzgün': 'üzgün',
      'depresif': 'üzgün',
      'sinirli': 'kızgın',
      'öfkeli': 'kızgın',
      
      // Neutral/Mixed
      'sakin': 'güvenli',
      'şaşkın': 'şaşkın',
      'yorgun': 'üzgün',
      'bitkin': 'üzgün', 
      'suçlu': 'üzgün',
      'utanmış': 'korkmuş',
      'kıskanç': 'kızgın',
      'boş': 'şaşkın',
      'nötr': 'şaşkın',
    };

    return emotionMap[heuristicEmotion] || 'şaşkın';
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
        {/* iPhone-Style Voice Recorder Interface */}
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
