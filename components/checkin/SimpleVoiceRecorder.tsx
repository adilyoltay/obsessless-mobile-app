/**
 * SimpleVoiceRecorder - Real-time STT Voice Check-in
 * 
 * Özellikler:
 * - 🎙️ Real-time STT (Canlı ses tanıma)
 * - 📝 Live transcript display
 * - 🟢 Yeşil theme (iPhone-style)
 * - 🧠 Heuristik mood analizi
 * - ✅ TranscriptConfirmationModal fallback
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
  ScrollView,
  ActivityIndicator,
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
import nativeSpeechToText from '@/services/nativeSpeechToText';

const { width, height } = Dimensions.get('window');

interface SimpleVoiceRecorderProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

// Removed RecordingState interface - using simple duration state

export default function SimpleVoiceRecorder({
  isVisible,
  onClose,
  onComplete,
}: SimpleVoiceRecorderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { playStartSound, playStopSound, preload } = useVoiceCheckInAudio();
  
  // 🎯 REAL-TIME STT STATE (ONLY)
  const [liveTranscript, setLiveTranscript] = useState(''); // Live transcript display
  const [isListening, setIsListening] = useState(false); // Real-time listening state
  const [partialResultsInterval, setPartialResultsInterval] = useState<number | null>(null);
  const [errorCount, setErrorCount] = useState(0); // Track consecutive errors
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);
  
  // Timer State (for real-time listening)
  const [duration, setDuration] = useState(0);

  // UI State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<MoodAnalysisResult | null>(null);

  // Animations
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Refs
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
    if (isListening) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000) as any;
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Reset duration when not listening
      if (!isProcessing) {
        setDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isListening, isProcessing]);

  // 🧹 CLEANUP on unmount or modal close
  useEffect(() => {
    if (!isVisible && (isListening || partialResultsInterval)) {
      console.log('🚫 Modal closed while listening - force cleanup');
      cleanupListening();
    }
  }, [isVisible]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isListening || partialResultsInterval) {
        console.log('🚫 Component unmounting - force cleanup');
        cleanupListening();
      }
    };
  }, []);

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

  // 🎤 REAL-TIME STT METHODS
  const startRealtimeListening = async () => {
    try {
      console.log('🎤 Starting real-time STT...');
      
      // ⚡ ERROR RATE LIMITING
      const now = Date.now();
      if (errorCount >= 3 && now - lastErrorTime < 30000) { // 3 errors in 30 seconds
        showToastMessage('Çok fazla hata oluştu. 30 saniye bekleyin. ⏳');
        Alert.alert('Bekleyin', 'Çok fazla hata oluştu. Lütfen 30 saniye bekleyip tekrar deneyin.');
        return;
      }
      
      // Check availability with fallback
      const isAvailable = await nativeSpeechToText.checkAvailability();
      if (!isAvailable) {
        console.log('🔄 Speech Recognition not available, opening empty mood form');
        showToastMessage('Mood kaydı açılıyor... 📝');
        
        // Direct fallback to empty mood form (NO MODAL)
        await openEmptyMoodForm();
        return;
      }
      
      // 🎵 AUDIO SESSION CONFIGURATION 
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ses tanıma için mikrofon izni gerekli.');
        return;
      }
      
      // Start listening
      setIsListening(true);
      setLiveTranscript('');
      setDuration(0);
      
      // Setup partial results callback with error handling
      const interval = setInterval(async () => {
        try {
          const partialText = nativeSpeechToText.getPartialResults();
          if (partialText) {
            console.log('📝 Partial transcript:', partialText);
            setLiveTranscript(partialText);
          }
        } catch (partialError) {
          console.warn('⚠️ Partial results error:', partialError);
          // Don't spam errors, just log
        }
      }, 500);
      setPartialResultsInterval(interval as any);
      
      // Start native listening with timeout
      await Promise.race([
        nativeSpeechToText.startListening('tr-TR'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Speech Recognition timeout')), 5000)
        )
      ]);
      
      // Play start sound & animation
      await playDingSound();
      startPulseAnimation();
      
      // Reset error count on successful start
      setErrorCount(0);
      console.log('✅ Real-time listening started');
      
      // 🕐 AUTO-STOP after 60 seconds (prevent hanging)
      setTimeout(async () => {
        if (isListening) {
          console.log('⏰ Auto-stopping listening after 60 seconds');
          await stopRealtimeListening();
        }
      }, 60000);
      
    } catch (error) {
      console.error('❌ Real-time STT failed:', error);
      
      // 📊 ERROR TRACKING
      setErrorCount(prev => prev + 1);
      setLastErrorTime(Date.now());
      
      // 🧹 CLEANUP on error
      await cleanupListening();
      
      console.log('🔄 Speech Recognition failed, opening empty mood form');
      showToastMessage('Mood kaydı açılıyor... 📝');
      
      // 🎯 INTELLIGENT FALLBACK - Direct to empty mood form
      setTimeout(async () => {
        await openEmptyMoodForm();
      }, 1000);
    }
  };
  
  // 🧹 CLEANUP LISTENING (Shared method)
  const cleanupListening = async () => {
    console.log('🧹 Cleaning up listening resources...');
    
    // Clear interval
    if (partialResultsInterval) {
      clearInterval(partialResultsInterval as any);
      setPartialResultsInterval(null);
    }
    
    // Reset states
    setIsListening(false);
    setLiveTranscript('');
    
    // Stop animations
    stopPulseAnimation();
    
    try {
      // Force stop native listening
      await nativeSpeechToText.stopListening();
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup error (expected):', cleanupError);
    }
    
    console.log('✅ Cleanup completed');
  };

  const stopRealtimeListening = async () => {
    try {
      console.log('🛑 Stopping real-time STT...');
      
      // Get final transcript before cleanup
      const result = await nativeSpeechToText.stopListening();
      
      // Cleanup resources
      await cleanupListening();
      
      // Play stop sound
      await playDongSound();
      
      // Process result
      if (result.success && result.text) {
        console.log('✅ Final transcript:', result.text);
        setLiveTranscript(result.text);
        
        // Process directly with heuristic analysis
        await processTranscript(result.text, duration);
      } else {
        console.log('⚠️ No transcript received, opening empty mood form');
        // Open empty mood form
        await openEmptyMoodForm();
      }
      
    } catch (error) {
      console.error('❌ Stop listening failed:', error);
      
      // Force cleanup on error
      await cleanupListening();
      
      // Fallback to empty mood form
      await openEmptyMoodForm();
    }
  };
  
  // 📝 Process transcript (common for both modes)
  const processTranscript = async (text: string, duration: number) => {
    console.log('📝 Processing transcript:', { text, duration });
    
    if (!text.trim()) {
      // Empty transcript - open empty mood form
      await openEmptyMoodForm();
      return;
    }
    
    try {
      setIsProcessing(true);
      showToastMessage('Metniniz analiz ediliyor... 🧠');
      
      // Analyze with heuristic service
      const transcription: TranscriptionResult = {
        text: text.trim(),
        confidence: 0.95,
        duration,
        language: 'tr-TR',
        success: true,
      };
      
      const moodAnalysis = await voiceCheckInHeuristicService.analyzeMoodFromVoice(transcription);
      
      console.log('✅ Analysis complete:', {
        mood: moodAnalysis.moodScore,
        emotion: moodAnalysis.dominantEmotion,
        confidence: moodAnalysis.confidence
      });
      
      // Navigate to mood page with analyzed data
      navigateToMoodPage(text, moodAnalysis, duration);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      // Fallback to empty mood form
      await openEmptyMoodForm();
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Open empty mood form (NO MODAL)
  const openEmptyMoodForm = async () => {
    console.log('📝 Opening empty mood form - no transcript confirmation needed');
    
    onClose(); // Close voice modal
    
    setTimeout(() => {
      console.log('🗺️ Navigating to empty mood page');
      
      // Navigate to mood page WITHOUT any voice-specific parameters
      // This will open normal mood entry form
      router.push('/(tabs)/mood');
      
      onComplete?.();
    }, 200);
  };
  
  // Navigate directly to mood page with pre-filled data
  const navigateToMoodPage = (text: string, analysis: MoodAnalysisResult, duration: number) => {
    console.log('🗺️ Navigating to mood page with analysis...');
    
    onClose(); // Close voice modal
    
    const moodScore100 = (analysis.moodScore - 1) * 11.11;
    
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/mood',
        params: {
          prefill: 'true',
          source: 'voice_checkin_analyzed',
          mood: Math.round(moodScore100).toString(),
          energy: analysis.energyLevel.toString(),
          anxiety: analysis.anxietyLevel.toString(),
          notes: text,
          trigger: mapTriggerToMoodPage(analysis.triggers[0]),
          emotion: mapEmotionToPrimary(analysis.dominantEmotion),
          confidence: analysis.confidence.toFixed(2),
          voice_duration: duration.toString(),
        }
      });
      onComplete?.();
    }, 200);
  };

  // Recording functions removed - using real-time STT only

  // 📝 Transcript Confirmation Handlers - REMOVED (handled by mood page now)

  // 🔄 Reset State (Enhanced)
  const resetState = () => {
    setAnalysisResult(null);
    setDuration(0);
    setLiveTranscript('');
    setIsListening(false);
    setErrorCount(0);
    setLastErrorTime(0);
    
    // Clear intervals
    if (partialResultsInterval) {
      clearInterval(partialResultsInterval as any);
      setPartialResultsInterval(null);
    }
  };

  // 🧹 Clear errors and reset (for user)
  const clearErrorsAndReset = async () => {
    console.log('🧹 User requested error reset');
    showToastMessage('Hatalar temizlendi, tekrar deneyin ✨');
    
    resetState();
    
    // Force cleanup native service
    try {
      await nativeSpeechToText.stopListening();
    } catch (error) {
      console.warn('⚠️ Cleanup during reset:', error);
    }
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

  // 🎯 Main Button Press Handler (REAL-TIME ONLY)
  const handleRecordPress = async () => {
    if (isProcessing) return;

    // If errors occurred, directly open empty mood form
    if (errorCount > 0 && !isListening) {
      console.log('🔄 Error count > 0, opening empty mood form instead of STT');
      await openEmptyMoodForm();
      return;
    }

    if (isListening) {
      await stopRealtimeListening();
    } else {
      await startRealtimeListening();
    }
  };

  // ⏱️ Format Duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🌊 Wave Components (Live Mode)
  const renderWaveAnimation = () => {
    if (!isListening) return null;

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
    <>
      <BottomSheet isVisible={isVisible} onClose={onClose}>
        <View style={styles.container}>
          {/* Header - Live Mode Only */}
          <View style={styles.header}>
            <Text style={styles.title}>🎙️ Canlı Ses Tanıma</Text>
            
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </Pressable>
          </View>

          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {formatDuration(duration)}
            </Text>
            <Text style={styles.statusText}>
              {isProcessing 
                ? '🧠 Analiz ediliyor...' 
                : isListening 
                ? '🎙️ Dinleniyor ve yazıyor...' 
                : errorCount > 0
                ? '📝 Mood kaydı açılacak (ses tanıma sorunlu)'
                : '🎙️ Konuşmaya hazır'
              }
            </Text>
          </View>

          {/* LIVE TRANSCRIPT DISPLAY */}
          {(liveTranscript || isListening) && (
            <View style={styles.liveTranscriptContainer}>
              <View style={styles.liveTranscriptHeader}>
                <Text style={styles.liveTranscriptLabel}>Canlı Metin</Text>
                {isListening && (
                  <ActivityIndicator size="small" color="#10B981" />
                )}
              </View>
              <ScrollView 
                style={styles.liveTranscriptScroll}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.liveTranscriptText}>
                  {liveTranscript || (isListening ? 'Konuşmaya başlayın...' : '')}
                </Text>
              </ScrollView>
            </View>
          )}

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
                  backgroundColor: isListening ? '#047857' : '#10B981', // Green for real-time
                  opacity: isProcessing ? 0.6 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isListening ? "stop" : "microphone-variant"}
                size={48}
                color="#FFFFFF"
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Simple Instructions */}
        <Text style={styles.instructionText}>
          {isProcessing 
            ? '🧠 Analiz ediliyor...'
            : isListening 
            ? '🎙️ Konuşun, metniniz canlı yazılıyor...' 
            : errorCount > 0
            ? '📝 Butona basın, mood kaydı açılacak'
            : '🎙️ Butona basın ve konuşmaya başlayın'
          }
        </Text>
        
        {/* Help Text */}
        <Text style={styles.helpText}>
          {errorCount > 0 
            ? 'Mood kaydı formu direkt açılacak 📝'
            : 'Konuşurken metninizi anlık göreceksiniz ✨'
          }
        </Text>

        {/* Error Reset Button */}
        {errorCount > 0 && (
          <View style={styles.errorResetContainer}>
            <Pressable 
              onPress={clearErrorsAndReset}
              style={styles.errorResetButton}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#10B981" />
              <Text style={styles.errorResetText}>Ses tanımayı tekrar dene</Text>
            </Pressable>
          </View>
        )}

        {/* Toast */}
        <Toast
          visible={showToast}
          message={toastMessage}
          type={toastMessage.includes('✅') ? 'success' : 'info'}
          onHide={() => setShowToast(false)}
        />
      </View>
    </BottomSheet>


    </>
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
    backgroundColor: '#10B981', // Green for live mode
    borderRadius: 1.5,
  },

  // Live Voice Button - iPhone Style
  recordButtonContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButtonWrapper: {
    shadowColor: '#10B981', // Green shadow for live mode
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
  
  // Live STT Mode Styles
  liveTranscriptContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginVertical: 20,
    maxHeight: 150,
    minHeight: 80,
    width: '100%',
  },
  liveTranscriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveTranscriptLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveTranscriptScroll: {
    maxHeight: 100,
  },
  liveTranscriptText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  helpText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  
  // Error Reset Button Styles
  errorResetContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  errorResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  errorResetText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
});
