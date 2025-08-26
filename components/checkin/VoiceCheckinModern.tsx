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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Components
import { BottomSheet } from '@/components/ui/BottomSheet';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';
import { Toast } from '@/components/ui/Toast';

// Services
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/gamificationStore';
import supabaseService from '@/services/supabase';
import { supabase } from '@/lib/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { moodTracker } from '@/services/moodTrackingService';
import { offlineSyncService } from '@/services/offlineSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AI Services
import { multiIntentVoiceAnalysis } from '@/features/ai/services/checkinService';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Types
// Compulsion types removed

// Utils
import { sanitizePII } from '@/utils/privacy';

const { width } = Dimensions.get('window');

interface VoiceCheckinModernProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function VoiceCheckinModern({
  isVisible,
  onClose,
  onComplete,
}: VoiceCheckinModernProps) {
  
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { awardMicroReward, updateStreak } = useGamificationStore();

  // Modern State Management
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isVisible) {
      setLastTranscript('');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Toast helper
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  // Main voice transcription handler with ALL original logic preserved
  const handleVoiceTranscription = async (res: {
    text: string;
    confidence?: number;
    language?: string;
    duration?: number;
  }) => {
    console.log('🎤 VoiceCheckinModern handleVoiceTranscription:', res);
    
    if (!user?.id || isProcessing) {
      console.log('🎤 Skipping - user?.id:', user?.id, 'isProcessing:', isProcessing);
      return;
    }

    // Text length validation
    if (!res.text || res.text.length < 10) {
      console.log('🎤 Text too short, skipping analysis');
      showToastMessage('Biraz daha konuş, seni dinliyorum...');
      return;
    }

    setIsProcessing(true);
    setLastTranscript(res.text);

    try {
      console.log('🎤 Starting voice analysis for text:', res.text);
      
      let analysis;
      
      // 🚀 MULTI-INTENT: Use multi-intent voice analysis
      if (FEATURE_FLAGS.isEnabled('MULTI_INTENT_VOICE')) {
        console.log('🎯 Using Multi-Intent Voice Analysis');
        
        try {
          analysis = await multiIntentVoiceAnalysis(res.text, user.id);
          console.log('🎯 Multi-Intent Result:', {
            modules: analysis.modules?.length,
            primary: analysis.type,
            confidence: analysis.confidence
          });
        } catch (error) {
          console.error('Multi-intent analysis failed:', error);
          // Continue with fallback
        }
      }
      
      // Fallback: Use UnifiedAIPipeline if multi-intent failed
      if (!analysis) {
        try {
          console.log('🚀 Using UnifiedAIPipeline fallback');
          
          const pipelineResult = await unifiedPipeline.process({
            userId: user.id,
            content: res.text || '',
            type: 'voice' as const,
            context: {
              source: 'mood' as const,
              timestamp: Date.now(),
              metadata: {
                sessionId: `checkin_${Date.now()}`,
                confidence: res.confidence,
                duration: res.duration,
                locale: res.language || 'tr-TR'
              }
            }
          });
          
          console.log('🎯 UnifiedAIPipeline Fallback Result:', pipelineResult);
          
          // Map to expected format
          if (pipelineResult.voice) {
            const voiceResult = pipelineResult.voice as any;
            analysis = {
              type: voiceResult.category?.toUpperCase() || 'MOOD',
              confidence: voiceResult.confidence || 0.5,
              mood: voiceResult.extractedData?.mood || 50,
              trigger: voiceResult.extractedData?.trigger || '',
              suggestion: voiceResult.summary || 'Analiz tamamlandı',
              originalText: res.text,
              params: voiceResult.extractedData || {},
            };
          }
        } catch (pipelineError) {
          console.error('🚨 Complete pipeline failure:', pipelineError);
          
          // Ultimate fallback
          analysis = {
            type: 'MOOD',
            confidence: 0.2,
            mood: 5,
            trigger: 'analysis_failed',
            originalText: res.text,
            suggestion: 'Analiz tamamlanamadı, manuel olarak devam edebilirsin'
          };
        }
      }
      
      console.log('🎯 Final Analysis Result:', analysis);
      
      if (!analysis) {
        throw new Error('Analysis returned null');
      }
      
      // Save voice checkin to database with offline fallback
      const voiceCheckinData = {
        user_id: user.id,
        text: sanitizePII(res.text || ''),
        mood: analysis.mood || 0,
        trigger: analysis.trigger || '',
        confidence: analysis.confidence || res.confidence || 0,
        lang: res.language || 'tr-TR',
      };
      
      try {
        await supabaseService.saveVoiceCheckin(voiceCheckinData);
        console.log('✅ Voice checkin saved');
      } catch (error) {
        console.warn('⚠️ Voice checkin save failed, adding to offline queue:', error);
        
        try {
          // Add to offline sync queue for retry when online
          await offlineSyncService.addToSyncQueue({
            type: 'CREATE',
            entity: 'voice_checkin',
            data: voiceCheckinData
          });
          
          // Add to local cache for cross-device sync
          const localVoiceKey = `voice_checkins_${user.id}`;
          const existing = await AsyncStorage.getItem(localVoiceKey);
          const voiceCheckins = existing ? JSON.parse(existing) : [];
          voiceCheckins.push({ 
            ...voiceCheckinData, 
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            synced: false,
            timestamp: new Date().toISOString() 
          });
          await AsyncStorage.setItem(localVoiceKey, JSON.stringify(voiceCheckins));
          
          console.log('✅ Voice checkin queued for offline sync');
        } catch (offlineError) {
          console.error('❌ Failed to queue voice checkin for offline sync:', offlineError);
        }
      }

      // Track AI interaction
      await trackAIInteraction(AIEventType.CHECKIN_COMPLETED, {
        type: analysis.type,
        mood: analysis.mood || 0,
        trigger: analysis.trigger || '',
      });

      // Award gamification rewards
      await awardMicroReward('voice_mood_checkin');
      await updateStreak();

      // Handle analysis result
      setTimeout(() => {
        handleAnalysisResult(analysis, res.text);
      }, 500);
      
    } catch (error) {
      console.error('Error processing voice input:', error);
      showToastMessage('Bir hata oluştu, lütfen tekrar dene');
    } finally {
      setIsProcessing(false);
    }
  };

  // Module processing with ALL critical fixes preserved
  const processSingleModule = async (analysis: any, text: string, silent: boolean = false) => {
    console.log(`🔄 Processing single module: ${analysis.type}`, { 
      silent, 
      fields: Object.keys(analysis),
    });
    
    try {
      if (analysis.type === 'MOOD') {
        console.log('💭 MOOD analysis fields:', analysis);
        
        if (!user?.id) {
          throw new Error('User not authenticated');
        }
        
        const moodData = {
          mood_score: Math.max(1, Math.min(10, analysis.mood_score || analysis.mood || 5)),
          energy_level: Math.max(1, Math.min(10, analysis.energy || 5)),
          anxiety_level: Math.max(1, Math.min(10, analysis.anxiety || 5)),
          notes: analysis.notes || text,
          timestamp: new Date().toISOString(),
          user_id: user.id
        };
        
        try {
          await moodTracker.saveMoodEntry(moodData as any);
          console.log('✅ MOOD record auto-saved:', moodData);
          
          // Trigger cache invalidation for single module MOOD
          if (!silent && user?.id) {
            try {
              await unifiedPipeline.triggerInvalidation('mood_added', user.id);
              console.log('🔄 Single MOOD cache invalidated');
            } catch (invalidationError) {
              console.warn('⚠️ Cache invalidation failed:', invalidationError);
            }
          }
          
          return { module: 'MOOD', success: true, data: moodData };
        } catch (moodError) {
          console.error('❌ MOOD moodTracker error:', moodError);
          throw moodError;
        }
        
      } else if (analysis.type === 'BREATHWORK') {
        console.log('🧘 BREATHWORK suggestion provided, no record needed');
        return { module: 'BREATHWORK', success: true, suggestion: true };
      }
      
      return { module: analysis.type, success: false, error: 'Unknown module type' };
    } catch (error) {
      console.error(`❌ Failed to process ${analysis.type}:`, error);
      return { module: analysis.type, success: false, error };
    }
  };

  // Multi-module handler with enhanced cache invalidation
  const handleMultipleModules = async (modules: any[], text: string) => {
    console.log(`📝 Processing ${modules.length} modules in transaction`);
    
    const results: Array<{module: string, success: boolean}> = [];
    const errors: Array<{module: string, error: any}> = [];
    
    for (const module of modules) {
      try {
        const singleAnalysis = {
          type: module.module,
          confidence: module.confidence,
          originalText: text,
          ...module.fields
        };
        
        const result = await processSingleModule(singleAnalysis, text, true);
        if (result && result.success) {
          results.push(result);
        } else if (result && !result.success) {
          errors.push({ 
            module: module.module, 
            error: new Error(typeof result.error === 'string' ? result.error : 'Module processing failed') 
          });
        }
      } catch (error) {
        console.error(`❌ Failed to process ${module.module}:`, error);
        errors.push({ module: module.module, error });
      }
    }
    
    console.log(`📊 Multi-module transaction completed: ${results.length} success, ${errors.length} errors`);
    
    if (results.length > 0 || errors.length > 0) {
      const successSummary = results.map(r => `✅ ${r.module}`).join('\n');
      const errorSummary = errors.map(e => `❌ ${e.module}: ${(e.error as any)?.message || 'Bilinmeyen hata'}`).join('\n');
      
      const fullSummary = [successSummary, errorSummary].filter(s => s.length > 0).join('\n');
      
      const title = errors.length > 0 ? '⚠️ Kayıt Sonuçları' : '🎉 Kayıtlar Oluşturuldu';
      const message = `${fullSummary}\n\n📊 Toplam: ${results.length} başarılı, ${errors.length} hata${errors.length > 0 ? '\n\n🔧 Hatalı kayıtlar manuel olarak denenebilir.' : ''}\n\n⚡ Başarılı kayıtlar ilgili sayfalarda en üstte görünecek.`;
      
      Alert.alert(title, message, [
        {
          text: 'Tamam',
          style: 'default',
          onPress: () => {
            console.log('🔄 Multi-intent records saved, triggering cache invalidation...');
            
            // Module-specific cache invalidation with fix
            setTimeout(async () => {
              try {
                if (user?.id && results.length > 0) {
                  for (const result of results) {
                    if (result.module === 'MOOD') {
                      await unifiedPipeline.triggerInvalidation('mood_added', user.id);
                      console.log('🔄 MOOD cache invalidated');
                    } else if (result.module === 'BREATHWORK') {
                      console.log('🧘 BREATHWORK - no cache invalidation needed');
                    }
                  }
                  console.log('✅ Module-specific cache invalidated');
                }
              } catch (error) {
                console.error('Cache invalidation failed:', error);
              }
            }, 100);
          }
        }
      ]);
    }
    
    onClose();
  };

  // Analysis result handler with multi-module support
  const handleAnalysisResult = async (analysis: any, text: string) => {
    console.log('🔄 handleAnalysisResult called with:', { 
      analysis: {
        type: analysis.type,
        confidence: analysis.confidence,
        modules: analysis.modules?.length,
      }, 
      text: text?.substring(0, 50) + '...' 
    });
    
    // Multi-module support
    if (analysis.modules && analysis.modules.length > 1) {
      console.log(`🎯 Multi-module detected: ${analysis.modules.map((m: any) => m.module).join(', ')}`);
      
      const moduleNames = analysis.modules.map((m: any) => {
        const moduleLabels: Record<string, string> = {
          'MOOD': '😊 Duygu Durumu',
          'BREATHWORK': '🧘 Nefes Egzersizi'
        };
        return moduleLabels[m.module] || m.module;
      });
      
      Alert.alert(
        '🎯 Birden Fazla Konu Tespit Edildi',
        `Şu konular bulundu: ${moduleNames.join(', ')}\n\nHangisiyle devam etmek istersin?`,
        [
          ...analysis.modules.map((m: any, idx: number) => ({
            text: moduleNames[idx],
            onPress: () => handleSingleModule(m, text)
          })),
          { 
            text: 'Hepsini Kaydet', 
            onPress: () => handleMultipleModules(analysis.modules, text), 
            style: 'default' 
          }
        ]
      );
      return;
    }
    
    // Single module processing
    if (analysis.type && ['MOOD', 'BREATHWORK'].includes(analysis.type)) {
      const singleModule = {
        module: analysis.type,
        confidence: analysis.confidence,
        fields: analysis
      };
      await handleSingleModule(singleModule, text);
    } else {
      // Default navigation fallback
      showToastMessage('Analiz tamamlandı, sayfaya yönlendiriliyorsun...');
      setTimeout(() => {
        onClose();
        router.push('/(tabs)/mood');
      }, 1000);
    }
  };

  const handleSingleModule = async (module: any, text: string) => {
    console.log(`📝 Processing single module: ${module.module}`);
    
    const singleAnalysis = {
      type: module.module,
      confidence: module.confidence,
      originalText: text,
      ...module.fields
    };
    
    await processSingleModule(singleAnalysis, text);
    onClose();
  };

  return (
    <>
      <BottomSheet isVisible={isVisible} onClose={onClose}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header with Gradient Background */}
          <LinearGradient
            colors={['#E8F5E9', '#F1F8E9']}
            style={styles.headerGradient}
          >
            <Text style={styles.title}>Check-in</Text>
            <Text style={styles.subtitle}>
              Bugün kendini nasıl hissediyorsun? Konuş, dinleyelim...
            </Text>
          </LinearGradient>
          
          {/* Transcript Display */}
          {lastTranscript ? (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>Sen dedin ki:</Text>
              <Text style={styles.transcriptText}>"{lastTranscript}"</Text>
            </View>
          ) : (
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleLabel}>Örnek:</Text>
              <Text style={styles.exampleText}>
                "Bugün biraz kaygılıyım, sürekli aynı düşüncelere takılıp kaldım..."
              </Text>
            </View>
          )}

          {/* Modern Voice Button - Bigger & Beautiful */}
          <View style={styles.voiceContainer}>
            <Animated.View
              style={[
                styles.voiceButtonWrapper,
                {
                  transform: [{ scale: isRecording ? pulseAnim : 1 }],
                }
              ]}
            >
              <LinearGradient
                colors={
                  isProcessing 
                    ? ['#FCD34D', '#F59E0B']  // Yellow gradient for processing
                    : isRecording 
                    ? ['#F87171', '#EF4444']  // Red gradient for recording
                    : ['#34D399', '#10B981']  // Green gradient for idle
                }
                style={styles.voiceButton}
              >
                <VoiceInterface
                  onTranscription={(res) => {
                    console.log('🎯 VoiceInterface onTranscription callback triggered:', res);
                    handleVoiceTranscription(res);
                  }}
                  autoStart={false}
                  showHints={false}
                  enableCountdown={false}
                  showStopButton={false}
                  onStartListening={() => {
                    console.log('🎙️ VoiceInterface onStartListening');
                    setIsRecording(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  onStopListening={() => {
                    console.log('🛑 VoiceInterface onStopListening');
                    setIsRecording(false);
                  }}
                  onError={(error) => {
                    console.error('Voice error:', error);
                    showToastMessage('Ses tanıma başlatılamadı');
                  }}
                />
              </LinearGradient>
            </Animated.View>

            {/* Status Text */}
            {isRecording && (
              <Animated.Text style={[styles.recordingText, { opacity: fadeAnim }]}>
                🎙️ Dinliyorum... Konuşmaya devam et
              </Animated.Text>
            )}

            {isProcessing && (
              <View style={styles.processingContainer}>
                <MaterialCommunityIcons name="brain" size={24} color="#f59e0b" />
                <Text style={styles.processingText}>Analiz ediliyor...</Text>
              </View>
            )}
          </View>

          {/* Simple Instructions */}
          {!isRecording && !isProcessing && (
            <Text style={styles.instructions}>
              🎤 Mikrofona dokunup kendini ifade et
            </Text>
          )}

          {/* Quick Actions - Beautiful horizontal buttons */}
          {!isRecording && !isProcessing && (
            <View style={styles.quickActions}>
              <Text style={styles.quickTitle}>Veya hızlı erişim:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                

                <Pressable
                  style={[styles.quickButton, { backgroundColor: '#F3E5F5' }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    router.push('/(tabs)/mood');
                  }}
                >
                  <MaterialCommunityIcons name="emoticon-happy-outline" size={20} color="#9C27B0" />
                  <Text style={styles.quickButtonText}>Mood</Text>
                </Pressable>

                <Pressable
                  style={[styles.quickButton, { backgroundColor: '#E0F7FA' }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    router.push('/(tabs)/breathwork');
                  }}
                >
                  <MaterialCommunityIcons name="meditation" size={20} color="#00BCD4" />
                  <Text style={styles.quickButtonText}>Nefes</Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </BottomSheet>

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type={toastMessage?.toLowerCase().includes('hata') || toastMessage?.toLowerCase().includes('error') ? 'error' : 'success'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    minHeight: 400,
  },
  headerGradient: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 10,
    borderRadius: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#388E3C',
    textAlign: 'center',
    lineHeight: 22,
  },
  exampleContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
    marginHorizontal: 20,
    width: width - 40,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  transcriptContainer: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
    marginHorizontal: 20,
    width: width - 40,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: '#1B5E20',
    fontWeight: '500',
    lineHeight: 20,
  },
  voiceContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  voiceButtonWrapper: {
    borderRadius: 60,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  voiceButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  recordingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
    textAlign: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#D97706',
    fontWeight: '500',
  },
  instructions: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
  },
  quickActions: {
    marginTop: 25,
    width: '100%',
    paddingHorizontal: 20,
  },
  quickTitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 15,
    textAlign: 'center',
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
});