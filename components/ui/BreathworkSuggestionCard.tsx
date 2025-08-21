/**
 * 🌬️ Enhanced Breathwork Suggestion Card
 * 
 * v2.1 - Week 2 Implementation with:
 * - AI-generated contextual suggestions
 * - Delay/snooze management
 * - Protocol recommendations
 * - Urgency-based UI adaptation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { breathworkSuggestionService, BreathworkSuggestion } from '@/features/ai/services/breathworkSuggestionService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

interface BreathworkSuggestionCardProps {
  userId: string;
  suggestion?: BreathworkSuggestion;
  context?: {
    moodScore?: number;
    anxietyLevel?: number;
    recentCompulsions?: number;
    userInput?: string;
  };
  onDismiss?: () => void;
  onAccept?: (suggestion: BreathworkSuggestion) => void;
  onGenerate?: (suggestion: BreathworkSuggestion) => void;
}

// Dynamic trigger configurations based on AI suggestions
const getDynamicTriggerConfig = (suggestion: BreathworkSuggestion) => {
  const triggerType = suggestion.trigger.type;
  const urgency = suggestion.urgency;
  
  const configs = {
    anxiety: {
      title: urgency === 'critical' ? '🚨 Acil Sakinlik' : '💚 Biraz Mola',
      message: urgency === 'critical' ? 
        'Panik anında hızlı sakinleşme tekniği uygulayalım.' :
        `Anksiyeten ${suggestion.trigger.contextData.anxietyLevel}/10 seviyesinde. Nefes alalım mı?`,
      gradient: urgency === 'critical' ? ['#FF6B6B', '#FF8E8E'] : ['#FFE5E5', '#FFD0D0'],
      icon: urgency === 'critical' ? 'alert-circle' : 'heart-pulse',
    },
    low_mood: {
      title: '🌈 Ruh Hali Desteği',
      message: `Ruh halin ${suggestion.trigger.contextData.moodScore}/10. Yumuşak nefes egzersizi deneyelim mi?`,
      gradient: ['#E8F4FD', '#D1E7FA'],
      icon: 'weather-cloudy',
    },
    post_compulsion: {
      title: '🤗 Kendine Şefkat',
      message: 'Toparlanmak için birlikte nefes alalım. Sen harikasın.',
      gradient: ['#E5F5E5', '#D0EBD0'],
      icon: 'hand-heart',
    },
    stress: {
      title: '🧘‍♀️ Stres Giderme',
      message: 'Stres seviyende artış var. Rahatlatıcı nefes tekniği yapalım.',
      gradient: ['#F3E5F5', '#E8D5EA'],
      icon: 'meditation',
    },
    sleep_prep: {
      title: '🌙 Uyku Hazırlığı',
      message: 'Rahat uyku için 4-7-8 nefes egzersizi deneyelim mi?',
      gradient: ['#B4C6E7', '#9BA9D0'],
      icon: 'moon-waning-crescent',
    },
    morning_routine: {
      title: '🌅 Günaydın!',
      message: 'Güne sakin ve odaklı başlayalım.',
      gradient: ['#FFE5B4', '#FFD4A3'],
      icon: 'weather-sunny',
    },
    panic_episode: {
      title: '🆘 Acil Nefes',
      message: 'Panik sırasında hızlı sakinleşme. Beraber yapalım.',
      gradient: ['#FF4757', '#FF6348'],
      icon: 'heart-pulse',
    },
    maintenance: {
      title: '🌬️ Nefes Molası',
      message: 'Düzenli nefes pratiği için zaman. Kısa bir egzersiz yapalım.',
      gradient: ['#E5F3FF', '#D0E7FF'],
      icon: 'meditation',
    }
  };
  
  return configs[triggerType] || configs.maintenance;
};

export default function BreathworkSuggestionCard({
  userId,
  suggestion: propSuggestion,
  context,
  onDismiss,
  onAccept,
  onGenerate,
}: BreathworkSuggestionCardProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [suggestion, setSuggestion] = useState<BreathworkSuggestion | null>(propSuggestion || null);
  const [loading, setLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  // Generate suggestion if not provided
  useEffect(() => {
    if (!suggestion && context && userId) {
      generateSuggestion();
    }
  }, [context, userId]);

  // Entrance animation
  useEffect(() => {
    if (suggestion) {
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
    }
  }, [suggestion]);

  const generateSuggestion = async () => {
    if (!context || loading) return;
    
    setLoading(true);
    
    try {
      const newSuggestion = await breathworkSuggestionService.generateSuggestion({
        userId,
        moodScore: context.moodScore,
        anxietyLevel: context.anxietyLevel,
        recentCompulsions: context.recentCompulsions,
        userInput: context.userInput,
        currentTime: new Date(),
        lastSession: 0 // Could be loaded from storage
      });
      
      if (newSuggestion) {
        setSuggestion(newSuggestion);
        onGenerate?.(newSuggestion);
        
        await trackAIInteraction(AIEventType.BREATHWORK_SUGGESTION_GENERATED, {
          userId,
          suggestionId: newSuggestion.id,
          triggerType: newSuggestion.trigger.type,
          urgency: newSuggestion.urgency,
          protocol: newSuggestion.protocol.name
        });
      } else {
        // No suggestion needed
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Failed to generate breathwork suggestion:', error);
      setIsVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!suggestion) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Track acceptance
    await trackAIInteraction(AIEventType.BREATHWORK_SUGGESTION_ACCEPTED, {
      userId,
      suggestionId: suggestion.id,
      protocol: suggestion.protocol.name,
      urgency: suggestion.urgency
    });
    
    onAccept?.(suggestion);
    
    // Navigate with comprehensive params
    router.push({
      pathname: '/(tabs)/breathwork',
      params: {
        protocol: suggestion.protocol.name,
        duration: String(suggestion.protocol.duration),
        autoStart: 'true',
        source: 'ai_suggestion',
        suggestionId: suggestion.id,
        urgency: suggestion.urgency,
        customization: JSON.stringify(suggestion.customization),
        anxietyLevel: String(suggestion.trigger.contextData.anxietyLevel || 5),
      },
    });
    
    handleDismiss();
  };

  const handleSnooze = () => {
    if (!suggestion) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const delayOptions = suggestion.timing.delayOptions;
    const delayTexts = delayOptions.map(minutes => 
      minutes < 60 ? `${minutes} dakika` : `${minutes / 60} saat`
    );
    
    Alert.alert(
      'Nefes egzersizini ertele',
      'Ne kadar süre sonra hatırlatayım?',
      [
        { text: 'İptal', style: 'cancel' },
        ...delayOptions.map((minutes, index) => ({
          text: delayTexts[index],
          onPress: () => handleDelaySelection(minutes)
        }))
      ]
    );
  };

  const handleDelaySelection = async (delayMinutes: number) => {
    if (!suggestion) return;
    
    try {
      await breathworkSuggestionService.snoozeSuggestion(
        userId,
        suggestion.id,
        delayMinutes
      );
      
      await trackAIInteraction(AIEventType.BREATHWORK_SUGGESTION_SNOOZED, {
        userId,
        suggestionId: suggestion.id,
        delayMinutes,
        totalDelays: suggestion.timing.currentDelays + 1
      });
      
      handleDismiss();
    } catch (error) {
      console.error('Failed to snooze suggestion:', error);
      handleDismiss();
    }
  };

  const handleDismiss = async () => {
    if (!suggestion) {
      setIsVisible(false);
      onDismiss?.();
      return;
    }
    
    // Exit animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
    
    // Track dismissal
    await breathworkSuggestionService.dismissSuggestion(
      userId,
      suggestion.id,
      'user_dismissed'
    );
    
    await trackAIInteraction(AIEventType.BREATHWORK_SUGGESTION_DISMISSED, {
      userId,
      suggestionId: suggestion.id,
      reason: 'user_dismissed'
    });
  };

  // Don't render if not visible or no suggestion
  if (!isVisible || (!suggestion && !loading)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#F0F0F0', '#E0E0E0']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <MaterialCommunityIcons name="loading" size={24} color="#999" />
            <Text style={styles.loadingText}>Kişiselleştirilmiş öneri hazırlanıyor...</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  }

  if (!suggestion) return null;

  const config = getDynamicTriggerConfig(suggestion);
  const protocolName = suggestion.protocol.name;
  const expectedDuration = suggestion.metadata.expectedCompletion;
  const isUrgent = suggestion.urgency === 'high' || suggestion.urgency === 'critical';

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
      <LinearGradient colors={config.gradient} style={styles.gradient}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons 
                name={config.icon} 
                size={24} 
                color="#333" 
                style={styles.icon} 
              />
              <Text style={styles.title}>{config.title}</Text>
              {isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>ACİL</Text>
                </View>
              )}
            </View>
            <Pressable onPress={handleDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color="#666" />
            </Pressable>
          </View>

          {/* Message */}
          <Text style={styles.message}>{config.message}</Text>

          {/* Protocol Info */}
          <View style={styles.protocolInfo}>
            <MaterialCommunityIcons name="timer-outline" size={16} color="#666" />
            <Text style={styles.protocolText}>
              {protocolName.toUpperCase()} • ~{expectedDuration} dakika
            </Text>
            {suggestion.protocol.effectiveness && (
              <Text style={styles.effectivenessText}>
                Anksiyete için %{Math.round(suggestion.protocol.effectiveness.anxiety * 10)} etkili
              </Text>
            )}
          </View>

          {/* Confidence & Source */}
          <View style={styles.metadata}>
            <View style={styles.confidenceBar}>
              <View 
                style={[
                  styles.confidenceFill, 
                  { width: `${Math.round(suggestion.trigger.confidence * 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.confidenceText}>
              %{Math.round(suggestion.trigger.confidence * 100)} güven
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionButton,
                styles.startButton,
                isUrgent && styles.urgentButton
              ]}
              onPress={handleStart}
            >
              <MaterialCommunityIcons 
                name="play" 
                size={18} 
                color="white" 
                style={styles.buttonIcon} 
              />
              <Text style={styles.startButtonText}>
                {isUrgent ? 'Hemen Başla' : 'Başla'}
              </Text>
            </Pressable>

            {suggestion.timing.canDelay && (
              <Pressable
                style={[styles.actionButton, styles.snoozeButton]}
                onPress={handleSnooze}
              >
                <MaterialCommunityIcons 
                  name="clock-outline" 
                  size={16} 
                  color="#666" 
                  style={styles.buttonIcon} 
                />
                <Text style={styles.snoozeButtonText}>Ertele</Text>
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    borderRadius: 16,
    padding: 20,
  },
  content: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  urgentBadge: {
    backgroundColor: '#FF4757',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  urgentText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  message: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  protocolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protocolText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  effectivenessText: {
    fontSize: 11,
    color: '#888',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flex: 2,
  },
  urgentButton: {
    backgroundColor: '#FF4757',
  },
  snoozeButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  buttonIcon: {
    marginRight: 4,
  },
  startButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  snoozeButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
});