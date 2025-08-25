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
  Platform,
  Alert
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
// Audio import avoided in tests; voiceRecognitionService handles audio under the hood
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/utils/storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';

interface VoiceInterfaceProps {
  onTranscription: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  style?: any;
  onStartListening?: () => void;
  onStopListening?: () => void;
  autoStart?: boolean; // Yeni: render edilince otomatik başlat
  enableCountdown?: boolean; // Opsiyonel: başlatmadan önce 3-1 geri sayım
  showStopButton?: boolean; // Opsiyonel: ayrı durdur butonu göster
  showHints?: boolean; // Opsiyonel: alt ipucu metinleri
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscription,
  onError,
  disabled = false,
  style,
  onStartListening,
  onStopListening,
  autoStart = false,
  enableCountdown = false,
  showStopButton = false,
  showHints = true,
}) => {
  const { user } = useAuth();
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
  // Geri sayım ve kalp atışı animasyonu
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const [countdown, setCountdown] = useState<number | null>(null);

  // Feature flag kontrolü (hooks her zaman çağrılır; render safhasında koşullandırılır)
  const isVoiceEnabled = FEATURE_FLAGS.isEnabled('AI_VOICE');

  const hasSTTConsent = async (): Promise<boolean> => {
    try {
      const key = StorageKeys.VOICE_CONSENT_STT(user?.id || 'anon');
      const saved = await AsyncStorage.getItem(key);
      return saved === 'true';
    } catch {
      return false;
    }
  };

  const ensureSTTConsent = async (): Promise<boolean> => {
    const consent = await hasSTTConsent();
    if (consent) return true;
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Sesli İzin',
        'Konuşmaların yazıya dökülmesi için mikrofon kullanımına izin veriyor musun? Bu işlem cihaz üzerinde yapılır.',
        [
          { text: 'Hayır', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Evet', style: 'default', onPress: async () => {
            try { await AsyncStorage.setItem(StorageKeys.VOICE_CONSENT_STT(user?.id || 'anon'), 'true'); } catch {}
            resolve(true);
          }}
        ]
      );
    });
  };

  useEffect(() => {
    if (!isVoiceEnabled) return;
    // Servisi başlat
    voiceRecognitionService.initialize().catch(err => {
      setError('Ses tanıma başlatılamadı');
      onError?.(err);
    });

    // Accessibility announcement (autoStart ise göstermeyelim)
    if (!autoStart) {
      AccessibilityInfo.announceForAccessibility(
        'Sesli asistan hazır. Konuşmak için mikrofon butonuna basın.'
      );
    }

    return () => {
      // Cleanup
      if (isListening) {
        handleStopListening();
      }
    };
  }, [isVoiceEnabled]);

  // Auto-start dinleme
  useEffect(() => {
    if (!isVoiceEnabled) return;
    if (autoStart && !isListening) {
      const id = setTimeout(() => {
        handleStartListening();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [autoStart, isVoiceEnabled]);

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
      const ok = await ensureSTTConsent();
      if (!ok) return;

      if (enableCountdown) {
        // 3→1 geri sayım (kalp atışı)
        setCountdown(3);
        for (let i = 3; i >= 1; i--) {
          setCountdown(i);
          await new Promise((r) => setTimeout(r, 250));
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await new Promise<void>((resolve) => {
            Animated.sequence([
              Animated.timing(countdownAnim, { toValue: 1.2, duration: 120, useNativeDriver: true }),
              Animated.timing(countdownAnim, { toValue: 1.0, duration: 120, useNativeDriver: true })
            ]).start(() => resolve());
          });
        }
        setCountdown(null);
      }

      setError(null);
      setTranscription('');
      setIsListening(true);
      setState(VoiceRecognitionState.LISTENING);

      // Notify start
      try { onStartListening?.(); } catch {}

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Ses efekti çal
      await playSound('start');

      // Dinlemeyi başlat
      await voiceRecognitionService.startListening();

      // ⏰ Otomatik timeout - 3 saniye sonra durdur (optimal boyut için)
      setTimeout(async () => {
        if (isListening) {
          console.log('⏰ Auto-stopping recording after 3 seconds');
          await handleStopListening();
        }
      }, 3000); // 3 seconds - optimal for 16kHz mono WAV

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
        console.log('🔥 VoiceInterface calling onTranscription with:', result);
        onTranscription(result);

        // Accessibility
        AccessibilityInfo.announceForAccessibility(
          `Transkripsiyon tamamlandı: ${result.text}`
        );
      } else {
        setError('Ses tanınamadı');
        setState(VoiceRecognitionState.ERROR);
        try { onError?.(new Error('stt_no_result')); } catch {}
      }
    } catch (err) {
      console.error('Stop listening error:', err);
      setError('Transkripsiyon hatası');
      setState(VoiceRecognitionState.ERROR);
      onError?.(err as Error);
    } finally {
      setIsListening(false);
      try { onStopListening?.(); } catch {}
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  const playSound = async (type: 'start' | 'stop' | 'error') => {
    try {
      // 🔊 Kayıt başlama/bitiş bildirimleri - Speech API ile tonlar
      if (type === 'start') {
        console.log('🔊 Kayıt başlangıç sesi çalınıyor...');
        
        // Ses efekti yerine sadece haptic kullan (daha güvenilir)
        
        // Haptic feedback de ekle
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
      } else if (type === 'stop') {
        console.log('🔊 Kayıt bitiş bildirimi');
        
        // Ses efekti yerine sadece haptic kullan (daha güvenilir)
        
        // Haptic feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
      } else if (type === 'error') {
        console.log('❌ Hata bildirimi');
        
        // Ses efekti yerine sadece haptic kullan (daha güvenilir)
        
        // Haptic feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.log('🔇 Ses/Haptic feedback hatası:', error);
      // En azından basit haptic feedback dene
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (hapticError) {
        console.log('🔇 Haptic feedback de başarısız:', hapticError);
      }
    }
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

  if (!isVoiceEnabled) return null;

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

        {/* Geri sayım overlay */}
        {enableCountdown && countdown !== null && (
          <Animated.View style={[styles.countdownOverlay, { transform: [{ scale: countdownAnim }] }]}> 
            <Text style={styles.countdownText}>{countdown}</Text>
          </Animated.View>
        )}
      </View>

      {/* Durum metni ve Durdur butonu */}
      <Text style={[styles.stateText, { color: getStateColor() }]}>
        {getStateText()}
      </Text>
      {showStopButton && isListening && (
        <Button variant="secondary" onPress={handleStopListening} accessibilityLabel="Durdur" style={styles.stopButton}>
          Durdur
        </Button>
      )}

      {/* Transkripsiyon sonucu */}
      {transcription && (
        <Animated.View style={[styles.transcriptionContainer, { opacity: fadeAnim }]}>
          <Card style={styles.transcriptionCard}>
            <Text style={styles.transcriptionLabel}>Transkripsiyon:</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </Card>
        </Animated.View>
      )}

      {/* İpuçları (opsiyonel) */}
      {showHints && state === VoiceRecognitionState.IDLE && !transcription && (
        <View style={styles.hintsContainer}>
          <Text style={styles.hintTitle}>Sesli komutlar:</Text>
          <View style={styles.hintsList}>
            <Text style={styles.hintItem}>• &quot;Kayıt başlat&quot;</Text>
            <Text style={styles.hintItem}>• &quot;İçgörü ver&quot;</Text>
            <Text style={styles.hintItem}>• &quot;Oturumu bitir&quot;</Text>
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
  countdownOverlay: {
    position: 'absolute',
    top: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#EF4444',
  },
  stopButton: {
    marginTop: -8,
    marginBottom: 8,
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