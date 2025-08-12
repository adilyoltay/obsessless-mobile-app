/**
 * Voice Interface Component
 * 
 * Sesli etkileşim için UI komponenti
 * Accessibility-first tasarım
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  AccessibilityInfo,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  voiceRecognitionService,
  VoiceRecognitionState,
  TranscriptionResult
} from '@/features/ai/services/voiceRecognition';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

interface VoiceInterfaceProps {
  onTranscription: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  style?: any;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscription,
  onError,
  disabled = false,
  style
}) => {
  const [state, setState] = useState<VoiceRecognitionState>(VoiceRecognitionState.IDLE);
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Animasyonlar
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Feature flag kontrolü
  if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
    return null;
  }

  useEffect(() => {
    // Servisi başlat
    voiceRecognitionService.initialize().catch(err => {
      setError('Ses tanıma başlatılamadı');
      onError?.(err);
    });

    // Accessibility announcement
    AccessibilityInfo.announceForAccessibility(
      'Sesli asistan hazır. Konuşmak için mikrofon butonuna basın.'
    );

    return () => {
      // Cleanup
      if (isListening) {
        handleStopListening();
      }
    };
  }, []);

  useEffect(() => {
    // Listening animasyonları
    if (isListening) {
      // Pulse animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Wave animasyonları
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(waveAnim1, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(waveAnim1, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(waveAnim2, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(waveAnim2, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(waveAnim3, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(waveAnim3, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      // Animasyonları durdur
      pulseAnim.setValue(1);
      waveAnim1.setValue(0);
      waveAnim2.setValue(0);
      waveAnim3.setValue(0);
    }
  }, [isListening]);

  useEffect(() => {
    // Transcription fade animasyonu
    if (transcription) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [transcription]);

  const handleStartListening = async () => {
    if (disabled || isListening) return;

    try {
      setError(null);
      setTranscription('');
      setIsListening(true);
      setState(VoiceRecognitionState.LISTENING);

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Ses efekti çal
      await playSound('start');

      // Dinlemeyi başlat
      await voiceRecognitionService.startListening();

      // Accessibility
      AccessibilityInfo.announceForAccessibility('Dinleme başladı. Konuşabilirsiniz.');
    } catch (err) {
      console.error('Start listening error:', err);
      setError('Mikrofon başlatılamadı');
      setIsListening(false);
      setState(VoiceRecognitionState.ERROR);
      onError?.(err as Error);
    }
  };

  const handleStopListening = async () => {
    if (!isListening) return;

    try {
      setState(VoiceRecognitionState.PROCESSING);

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Ses efekti çal
      await playSound('stop');

      // Dinlemeyi durdur ve transkribe et
      const result = await voiceRecognitionService.stopListening();

      if (result) {
        setTranscription(result.text);
        setState(VoiceRecognitionState.COMPLETED);
        onTranscription(result);

        // Accessibility
        AccessibilityInfo.announceForAccessibility(
          `Transkripsiyon tamamlandı: ${result.text}`
        );
      } else {
        setError('Ses tanınamadı');
        setState(VoiceRecognitionState.ERROR);
      }
    } catch (err) {
      console.error('Stop listening error:', err);
      setError('Transkripsiyon hatası');
      setState(VoiceRecognitionState.ERROR);
      onError?.(err as Error);
    } finally {
      setIsListening(false);
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  const playSound = async (_type: 'start' | 'stop') => {
    // Ses dosyaları projeye eklenmediği için sessiz geç
    return;
  };

  const getStateIcon = () => {
    switch (state) {
      case VoiceRecognitionState.LISTENING:
        return 'microphone';
      case VoiceRecognitionState.PROCESSING:
      case VoiceRecognitionState.TRANSCRIBING:
        return 'dots-horizontal';
      case VoiceRecognitionState.COMPLETED:
        return 'check';
      case VoiceRecognitionState.ERROR:
        return 'alert-circle';
      default:
        return 'microphone-outline';
    }
  };

  const getStateColor = () => {
    switch (state) {
      case VoiceRecognitionState.LISTENING:
        return '#EF4444'; // Kırmızı - kayıt
      case VoiceRecognitionState.PROCESSING:
      case VoiceRecognitionState.TRANSCRIBING:
        return '#F59E0B'; // Turuncu - işleniyor
      case VoiceRecognitionState.COMPLETED:
        return '#10B981'; // Yeşil - tamamlandı
      case VoiceRecognitionState.ERROR:
        return '#EF4444'; // Kırmızı - hata
      default:
        return '#6B7280'; // Gri - boşta
    }
  };

  const getStateText = () => {
    switch (state) {
      case VoiceRecognitionState.LISTENING:
        return 'Dinleniyor...';
      case VoiceRecognitionState.PROCESSING:
        return 'İşleniyor...';
      case VoiceRecognitionState.TRANSCRIBING:
        return 'Yazıya dökülüyor...';
      case VoiceRecognitionState.COMPLETED:
        return 'Tamamlandı';
      case VoiceRecognitionState.ERROR:
        return error || 'Hata oluştu';
      default:
        return 'Konuşmak için dokun';
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Ana mikrofon butonu */}
      <View style={styles.microphoneContainer}>
        {/* Dalga animasyonları */}
        {isListening && (
          <>
            <Animated.View
              style={[
                styles.wave,
                styles.wave1,
                {
                  opacity: waveAnim1,
                  transform: [
                    {
                      scale: waveAnim1.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.5],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.wave,
                styles.wave2,
                {
                  opacity: waveAnim2,
                  transform: [
                    {
                      scale: waveAnim2.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.8],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.wave,
                styles.wave3,
                {
                  opacity: waveAnim3,
                  transform: [
                    {
                      scale: waveAnim3.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2.1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </>
        )}

        {/* Mikrofon butonu */}
        <Pressable
          onPress={handleToggleListening}
          disabled={disabled || state === VoiceRecognitionState.PROCESSING}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isListening ? "Dinlemeyi durdur" : "Konuşmaya başla"}
          accessibilityState={{ disabled }}
        >
          <Animated.View
            style={[
              styles.microphoneButton,
              {
                backgroundColor: getStateColor(),
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <MaterialCommunityIcons
              name={getStateIcon()}
              size={32}
              color="#FFFFFF"
            />
          </Animated.View>
        </Pressable>
      </View>

      {/* Durum metni */}
      <Text style={[styles.stateText, { color: getStateColor() }]}>
        {getStateText()}
      </Text>

      {/* Transkripsiyon sonucu */}
      {transcription && (
        <Animated.View style={[styles.transcriptionContainer, { opacity: fadeAnim }]}>
          <Card style={styles.transcriptionCard}>
            <Text style={styles.transcriptionLabel}>Transkripsiyon:</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </Card>
        </Animated.View>
      )}

      {/* İpuçları */}
      {state === VoiceRecognitionState.IDLE && !transcription && (
        <View style={styles.hintsContainer}>
          <Text style={styles.hintTitle}>Sesli komutlar:</Text>
          <View style={styles.hintsList}>
            <Text style={styles.hintItem}>• "Kayıt başlat"</Text>
            <Text style={styles.hintItem}>• "İçgörü ver"</Text>
            <Text style={styles.hintItem}>• "Oturumu bitir"</Text>
          </View>
        </View>
      )}

      {/* Ses seviyesi göstergesi */}
      {isListening && (
        <View style={styles.audioLevelContainer}>
          <View style={styles.audioLevelBar}>
            <Animated.View
              style={[
                styles.audioLevelFill,
                {
                  transform: [{
                    scaleX: waveAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1.0],
                    })
                  }],
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  microphoneContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  microphoneButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  wave: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  wave1: {
    borderColor: '#FCA5A5',
  },
  wave2: {
    borderColor: '#FBBF24',
  },
  wave3: {
    borderColor: '#FDE68A',
  },
  stateText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  transcriptionContainer: {
    width: '100%',
    marginTop: 20,
  },
  transcriptionCard: {
    padding: 16,
  },
  transcriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
  },
  hintsContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  hintsList: {
    alignItems: 'flex-start',
  },
  hintItem: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  audioLevelContainer: {
    width: '80%',
    marginTop: 20,
  },
  audioLevelBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioLevelFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
}); 