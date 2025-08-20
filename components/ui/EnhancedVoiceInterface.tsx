import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';

const { width } = Dimensions.get('window');

interface EnhancedVoiceInterfaceProps {
  onTranscription: (result: any) => void;
  onError?: (error: any) => void;
  autoStart?: boolean;
  showVisualizer?: boolean;
  showTranscript?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
}

export default function EnhancedVoiceInterface({
  onTranscription,
  onError,
  autoStart = false,
  showVisualizer = true,
  showTranscript = true,
  primaryColor = '#4CAF50',
  secondaryColor = '#81C784',
}: EnhancedVoiceInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      startRecordingAnimations();
    } else {
      stopRecordingAnimations();
    }
  }, [isRecording]);

  const startRecordingAnimations = () => {
    // Pulse animation
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

    // Wave animations
    waveAnims.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 300 + index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300 + index * 100,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const stopRecordingAnimations = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    
    waveAnims.forEach(anim => {
      anim.stopAnimation();
      anim.setValue(0.3);
    });
    
    rotateAnim.stopAnimation();
    rotateAnim.setValue(0);
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleTranscription = (result: any) => {
    setTranscript(result.text || '');
    setIsProcessing(true);
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Process with delay for better UX
    setTimeout(() => {
      onTranscription(result);
      setIsProcessing(false);
    }, 500);
  };

  const handleStartListening = () => {
    setIsRecording(true);
    setTranscript('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleStopListening = () => {
    setIsRecording(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleError = (error: any) => {
    setIsRecording(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (onError) {
      onError(error);
    }
  };

  const renderWaveform = () => {
    if (!showVisualizer || !isRecording) return null;

    return (
      <Animated.View
        style={[
          styles.waveformContainer,
          {
            opacity: fadeAnim,
            transform: [
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.waveform}>
          {waveAnims.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.wave,
                {
                  backgroundColor: index % 2 === 0 ? primaryColor : secondaryColor,
                  transform: [{ scaleY: anim }],
                  marginHorizontal: 3,
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderTranscript = () => {
    if (!showTranscript || !transcript) return null;

    return (
      <Animated.View
        style={[
          styles.transcriptContainer,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={styles.transcriptLabel}>Söylediklerin:</Text>
        <Text style={styles.transcriptText}>{transcript}</Text>
      </Animated.View>
    );
  };

  const renderProcessingIndicator = () => {
    if (!isProcessing) return null;

    return (
      <View style={styles.processingContainer}>
        <MaterialCommunityIcons
          name="brain"
          size={24}
          color={primaryColor}
          style={styles.processingIcon}
        />
        <Text style={[styles.processingText, { color: primaryColor }]}>
          Analiz ediliyor...
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[`${primaryColor}10`, `${secondaryColor}05`, '#FFFFFF']}
        style={styles.backgroundGradient}
      />

      {/* Main Voice Button */}
      <View style={styles.voiceButtonContainer}>
        <Animated.View
          style={[
            styles.pulseContainer,
            {
              transform: [{ scale: isRecording ? pulseAnim : 1 }],
            },
          ]}
        >
          <LinearGradient
            colors={isRecording ? [primaryColor, secondaryColor] : ['#F5F5F5', '#EEEEEE']}
            style={styles.voiceButtonGradient}
          >
            <VoiceInterface
              onTranscription={handleTranscription}
              onError={handleError}
              autoStart={autoStart}
              enableCountdown={false}
              showStopButton={false}
              showHints={false}
              onStartListening={handleStartListening}
              onStopListening={handleStopListening}
            />
          </LinearGradient>
        </Animated.View>

        {/* Waveform Visualizer */}
        {renderWaveform()}
      </View>

      {/* Status Text */}
      <View style={styles.statusContainer}>
        {isRecording && (
          <Animated.Text
            style={[
              styles.statusText,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            Dinliyorum... Konuşmaya devam et
          </Animated.Text>
        )}
        {!isRecording && !transcript && (
          <Text style={styles.hintText}>
            Mikrofona dokun ve konuşmaya başla
          </Text>
        )}
      </View>

      {/* Transcript Display */}
      {renderTranscript()}

      {/* Processing Indicator */}
      {renderProcessingIndicator()}

      {/* Tips */}
      {!isRecording && !transcript && (
        <View style={styles.tipsContainer}>
          <View style={styles.tipRow}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#FFC107" />
            <Text style={styles.tipText}>
              Düşüncelerini, duygularını veya ihtiyaçlarını paylaşabilirsin
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: -width / 2,
    right: -width / 2,
    height: 300,
    borderRadius: 150,
    opacity: 0.3,
  },
  voiceButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  waveformContainer: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  wave: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  statusContainer: {
    marginTop: 20,
    minHeight: 30,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#424242',
    fontWeight: '500',
  },
  hintText: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  transcriptContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    padding: 15,
    maxWidth: width - 40,
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 5,
    fontWeight: '600',
  },
  transcriptText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
  },
  processingIcon: {
    marginRight: 8,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#757575',
    flex: 1,
  },
});
