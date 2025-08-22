import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Components
import { BottomSheet } from '@/components/ui/BottomSheet';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';

// Services
import { unifiedVoiceAnalysis } from '@/features/ai/services/checkinService';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/gamificationStore';
import supabaseService from '@/services/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Utils
import { sanitizePII } from '@/utils/privacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/utils/storage';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// Auto Record – yalnızca servis; modal kaldırıldı (hafif Alert ile onay)
import { prepareAutoRecord, saveAutoRecord, shouldShowAutoRecord } from '@/services/autoRecordService';

const { width } = Dimensions.get('window');

interface CheckinBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function CheckinBottomSheet({
  isVisible,
  onClose,
  onComplete,
}: CheckinBottomSheetProps) {
  console.log('🚀 CheckinBottomSheet rendered, isVisible:', isVisible);
  
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { awardMicroReward, updateStreak } = useGamificationStore();

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Auto Record Modal State
  const [showAutoRecord, setShowAutoRecord] = useState(false);
  const [autoRecordData, setAutoRecordData] = useState<any>(null);
  const [autoRecordType, setAutoRecordType] = useState<'OCD' | 'CBT' | 'MOOD'>('OCD');
  const [isSavingAutoRecord, setIsSavingAutoRecord] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isVisible) {
      setLastTranscript('');
      setAnalysisResult(null);
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
            toValue: 1.15,
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
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handleVoiceTranscription = async (res: {
    text: string;
    confidence?: number;
    language?: string;
    duration?: number;
  }) => {
    console.log('🎤 CheckinBottomSheet handleVoiceTranscription called with:', res);
    
    if (!user?.id || isProcessing) {
      console.log('🎤 Skipping - user?.id:', user?.id, 'isProcessing:', isProcessing);
      return;
    }

    // Duration kontrolü - eğer metin varsa devam et
    const durationSec = Math.round((res.duration || 0) / 1000);
    console.log('🎤 Duration check - duration:', res.duration, 'durationSec:', durationSec, 'text length:', res.text?.length);
    
    // Eğer metin 10 karakterden kısaysa uyar
    if (!res.text || res.text.length < 10) {
      console.log('🎤 Text too short, skipping analysis');
      setToastMessage('Biraz daha konuş, seni dinliyorum...');
      setShowToast(true);
      return;
    }

    setIsProcessing(true);
    setLastTranscript(res.text);

    try {
      console.log('🎤 Starting voice analysis for text:', res.text);
      
      // Analyze voice input
      let analysis;
      
      // Use UnifiedAIPipeline for voice analysis
      try {
        console.log('🚀 Using UnifiedAIPipeline for voice analysis');
        
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
        
        console.log('🎯 UnifiedAIPipeline Result:', JSON.stringify(pipelineResult, null, 2));
        
        // Map UnifiedAIPipeline result to expected format
        if (pipelineResult.voice) {
          const voiceResult = pipelineResult.voice as any; // Type assertion for now
          analysis = {
            type: voiceResult.category?.toUpperCase() || 'OTHER',
            confidence: voiceResult.confidence || 0.5,
            mood: voiceResult.extractedData?.mood || voiceResult.extractedData?.moodScore || 50,
            trigger: voiceResult.extractedData?.trigger || voiceResult.extractedData?.triggers?.[0] || '',
            suggestion: voiceResult.summary || voiceResult.suggestion || 'Analiz tamamlandı',
            originalText: res.text,
            route: 'AUTO_SAVE',
            screen: voiceResult.category?.toLowerCase(),
            params: voiceResult.extractedData || {},
          };
        } else {
          // Fallback to legacy analysis if no voice result
          throw new Error('No voice analysis result from UnifiedAIPipeline');
        }
      } catch (error) {
        console.warn('🚨 UnifiedAIPipeline failed, using legacy analysis:', error);
        console.log('📝 Using legacy unifiedVoiceAnalysis');
        try {
          // unifiedVoiceAnalysis sadece text parametresi alıyor
          analysis = await unifiedVoiceAnalysis(res.text || '');
        } catch (analysisError) {
          console.error('🔴 unifiedVoiceAnalysis failed:', analysisError);
          throw analysisError;
        }
      }
      
      console.log('🎯 Voice Analysis Result:', JSON.stringify(analysis, null, 2));
      console.log('🎯 Analysis Type:', analysis.type);
      console.log('🎯 Analysis Confidence:', analysis.confidence);
      console.log('🎯 Original Text:', res.text);
      
      if (!analysis) {
        throw new Error('Analysis returned null or undefined');
      }
      
      setAnalysisResult(analysis);

      // Save to database
      try {
        await supabaseService.saveVoiceCheckin({
          user_id: user.id,
          text: sanitizePII(res.text || ''),
          mood: analysis.mood || 0,
          trigger: analysis.trigger || '',
          confidence: analysis.confidence || res.confidence || 0,
          lang: res.language || 'tr-TR',
          // created_at will be filled by service if omitted
        });
        console.log('✅ Voice checkin saved');
      } catch (error) {
        console.warn('⚠️ Failed to save voice checkin:', error);
        // Add to offline queue
        try {
          const { offlineSyncService } = await import('@/services/offlineSync');
          await offlineSyncService.addToSyncQueue({
            type: 'CREATE',
            entity: 'voice_checkin',
            data: {
              user_id: user.id,
              text: sanitizePII(res.text || ''),
              mood: analysis.mood || 0,
              trigger: analysis.trigger || '',
              confidence: analysis.confidence || res.confidence || 0,
              lang: res.language || 'tr-TR',
              created_at: new Date().toISOString(),
              synced: false,
            },
          });
        } catch (syncError) {
          console.error('❌ Failed to add to offline queue:', syncError);
        }
      }

      // Track AI interaction
      await trackAIInteraction(AIEventType.CHECKIN_COMPLETED, {
        type: analysis.type,
        mood: analysis.mood || 0,
        trigger: analysis.trigger || '',
      });

      // Award gamification reward
      await awardMicroReward('voice_mood_checkin');
      await updateStreak();

      // Show result and prepare for navigation
      console.log('🎤 About to call handleAnalysisResult with analysis:', analysis);
      
      setTimeout(() => {
        console.log('🎤 Timeout fired, calling handleAnalysisResult');
        handleAnalysisResult(analysis, res.text);
      }, 1000);
    } catch (error) {
      console.error('Error processing voice input:', error);
      setToastMessage('Bir hata oluştu, lütfen tekrar dene');
      setShowToast(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to estimate resistance level from text
  const estimateResistanceFromText = (text: string): number => {
    const lower = text.toLowerCase();
    if (/başardım|dirençli|güçlü|kontrol.*ettim/i.test(lower)) {
      return 7; // High resistance
    }
    if (/zorlandım|biraz|kısmen/i.test(lower)) {
      return 5; // Medium resistance
    }
    if (/yapamadım|mecbur|zorunda|duramadım/i.test(lower)) {
      return 3; // Low resistance
    }
    return 5; // Default
  };

  // Auto Record Handlers
  const handleAutoRecordConfirm = async (type: 'OCD' | 'CBT' | 'MOOD', data: any) => {
    setShowAutoRecord(false);
    if (isSavingAutoRecord) return;
    setIsSavingAutoRecord(true);
    
    {
      // Save the record
      const result = await saveAutoRecord(type as 'OCD' | 'CBT' | 'MOOD', data);
      
      if (result.success) {
        // Award gamification rewards
        await awardMicroReward('auto_record' as any);
        await updateStreak();
        
        setToastMessage('Kayıt başarıyla oluşturuldu ✅');
        setShowToast(true);
        
        // Başarılı kayıttan sonra ilgili sayfaya git ve yenile
        setTimeout(() => {
          onClose();
          if (type === 'OCD') {
            router.push({
              pathname: '/(tabs)/tracking',
              params: { highlight: 'latest', justSaved: 'true', refresh: String(Date.now()) },
            });
          } else if (type === 'CBT') {
            router.push({
              pathname: '/(tabs)/cbt',
              params: { refresh: 'true', highlightId: result.recordId },
            });
          } else if (type === 'MOOD') {
            router.push({
              pathname: '/(tabs)/mood',
              params: { refresh: 'true', highlightId: result.recordId },
            });
          }
          if (onComplete) onComplete();
          setIsSavingAutoRecord(false);
        }, 800);
      } else {
        setToastMessage(result.error || 'Kayıt oluşturulamadı');
        setShowToast(true);
        setIsSavingAutoRecord(false);
      }
    }
  };

  const handleAutoRecordEdit = (data: any) => {
    setAutoRecordData(data);
  };

  const handleAutoRecordClose = () => {
    setShowAutoRecord(false);
    // Continue with default navigation
    if (analysisResult) {
      const analysis = analysisResult;
      switch (analysis.type) {
        case 'OCD':
          router.push({
            pathname: '/(tabs)/tracking',
            params: {
              text: lastTranscript,
              category: analysis.category || 'genel',
            },
          });
          break;
        case 'CBT':
          router.push({
            pathname: '/(tabs)/cbt',
            params: { text: lastTranscript, trigger: 'voice' },
          });
          break;

      }
      onClose();
    }
  };

  /**
   * 🗂️ Smart Routing Handler - Uses AI to determine best navigation path
   */
  const handleSmartRouting = async (
    analysis: any, 
    text: string, 
    smartRoutingService: any
  ): Promise<boolean> => {
    if (!user?.id) {
      console.warn('❌ Smart routing requires user ID');
      return false;
    }
    
    try {
      // Convert analysis to expected format for smart routing
      const analysisResult = {
        type: analysis.type as any,
        confidence: analysis.confidence || 0.5,
        extractedData: analysis.extractedData || analysis,
        urgency: analysis.urgency || 'medium',
        context: analysis,
        userInput: text
      };
      
      // Generate smart route suggestion
      const routeConfig = await smartRoutingService.generateSmartRoute(
        analysisResult,
        user.id,
        `checkin_${Date.now()}`
      );
      
      if (!routeConfig) {
        console.log('🚫 No smart route generated, continuing to fallback');
        return false;
      }
      
      console.log('🗂️ Smart route generated:', {
        screen: routeConfig.screen,
        confidence: routeConfig.confidence,
        reasoning: routeConfig.reasoning
      });
      
      // Show confirmation for lower confidence routes
      if (routeConfig.confidence < 0.8) {
        return new Promise((resolve) => {
          Alert.alert(
            'Akıllı Yönlendirme',
            `${routeConfig.screen} sayfasına yönlendirilmek istiyor musun?\n\nSebep: ${routeConfig.reasoning.slice(0, 2).join(', ')}`,
            [
              { 
                text: 'İptal', 
                style: 'cancel',
                onPress: () => resolve(false)
              },
              {
                text: 'Evet',
                onPress: async () => {
                  const success = await smartRoutingService.navigateWithPrefill(routeConfig);
                  if (success) {
                    onClose();
                    setToastMessage(`${routeConfig.screen} sayfasına yönlendiriliyor...`);
                    setShowToast(true);
                  }
                  resolve(success);
                }
              }
            ]
          );
        });
      } else {
        // High confidence - navigate directly
        const success = await smartRoutingService.navigateWithPrefill(routeConfig);
        if (success) {
          onClose();
          setToastMessage(`Akıllı yönlendirme: ${routeConfig.screen} sayfası`);
          setShowToast(true);
        }
        return success;
      }
    } catch (error) {
      console.error('🚨 Smart routing error:', error);
      return false;
    }
  };

  const handleAnalysisResult = async (analysis: any, text: string) => {
    console.log('🔄 handleAnalysisResult called with:', { 
      analysis: {
        type: analysis.type,
        confidence: analysis.confidence,
        route: analysis.route,
        params: analysis.params
      }, 
      text: text?.substring(0, 50) + '...' 
    });
    
    // 🚨 DEBUG: Feature flags check
    console.log('🚩 Feature flags status:', {
      AI_SMART_ROUTING: FEATURE_FLAGS.isEnabled('AI_SMART_ROUTING'),
      AI_CORE_ANALYSIS: FEATURE_FLAGS.isEnabled('AI_CORE_ANALYSIS'),
      AI_BREATHWORK_SUGGESTIONS: FEATURE_FLAGS.isEnabled('AI_BREATHWORK_SUGGESTIONS')
    });
    
    // 🚨 DEBUG: Special logging for BREATHWORK
    if (analysis.type === 'BREATHWORK') {
      console.log('🌬️ BREATHWORK DETECTED! Analysis details:', analysis);
    }
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // 🗂️ TRY SMART ROUTING FIRST (if enabled and user available)
    if (FEATURE_FLAGS.isEnabled('AI_SMART_ROUTING') && user?.id) {
      console.log('🗂️ Smart routing enabled, trying smart routing...');
      try {
        const { smartRoutingService } = await import('@/features/ai/services/smartRoutingService');
        const success = await handleSmartRouting(analysis, text, smartRoutingService);
        console.log('🗂️ Smart routing result:', success);
        if (success) return; // Smart routing succeeded, exit early
      } catch (error) {
        console.warn('🚨 Smart routing failed, falling back to legacy:', error);
        // Continue to legacy routing below
      }
    } else {
      console.log('🗂️ Smart routing disabled or no user, using legacy routing');
    }
    
    // 🚀 FALLBACK: CoreAnalysisService route actions
    if (FEATURE_FLAGS.isEnabled('AI_CORE_ANALYSIS') && analysis.route) {
      console.log('🚀 Using CoreAnalysisService route:', analysis.route);
      
      switch (analysis.route) {
        case 'OPEN_SCREEN':
          if (analysis.screen) {
            onClose();
            router.push({
              pathname: `/(tabs)/${analysis.screen}`,
              params: analysis.params || {}
            });
            return;
          }
          break;
          
        case 'AUTO_SAVE':
          // Continue with auto-save flow below
          break;
          
        case 'SUGGEST_BREATHWORK':
          onClose();
          router.push({
            pathname: '/(tabs)/breathwork',
            params: analysis.params || {}
          });
          return;
          
        default:
          console.log('Unknown route action:', analysis.route);
      }
    }

    // High confidence (>0.8) = Show modal for confirmation (respect user prefs via shouldShowAutoRecord)
    // Kullanıcı tercihlerini store'dan çek (opsiyonel). Eğer store yoksa varsayılana bırakılır
    // Kullanıcı tercihini AsyncStorage'dan oku (opsiyonel). Hata halinde varsayılan: enabled.
    let prefs: { autoRecordEnabled?: boolean } | undefined = undefined;
    try {
      const raw = await AsyncStorage.getItem(StorageKeys.USER_SETTINGS(user?.id || 'anon'));
      if (raw) {
        const parsed = JSON.parse(raw);
        prefs = { autoRecordEnabled: parsed?.autoRecordEnabled !== false };
      }
    } catch {}

    if (analysis.confidence >= 0.8 && user?.id && shouldShowAutoRecord(analysis, prefs)) {
      const autoRecord = prepareAutoRecord(analysis, user.id);
      console.log('🔄 High confidence - prepareAutoRecord result:', autoRecord);
      
      if (autoRecord) {
        console.log('🔄 Showing lightweight confirm dialog (no bottom sheet)');
        setAutoRecordType(autoRecord.type);
        setAutoRecordData(autoRecord.data);
        setLastTranscript(text);

        // Sadece onay penceresi göster: detayları içinde yaz
        const message =
          autoRecord.type === 'OCD'
            ? `Kategori: ${autoRecord.data.category}\nDirenç: ${autoRecord.data.resistanceLevel}/10\nNot: ${autoRecord.data.notes || '-'}\n\nOnaylıyor musun?`
            : autoRecord.type === 'CBT'
            ? `Düşünce: ${autoRecord.data.thought || text}\nÇarpıtma: ${autoRecord.data.distortionType || '-'}\n\nOnaylıyor musun?`
            : autoRecord.type === 'MOOD'
            ? `Mood: ${autoRecord.data.mood || 50}/100\nEnerji: ${autoRecord.data.energy || 5}/10\nAnksiyete: ${autoRecord.data.anxiety || 5}/10\n\nOnaylıyor musun?`
            : `Önerisi: ${autoRecord.data.category || 'genel'}\n\nDevam edelim mi?`;

        Alert.alert(
          autoRecord.type === 'OCD' ? 'OKB Kaydı' : autoRecord.type === 'CBT' ? 'CBT Kaydı' : autoRecord.type === 'MOOD' ? 'Mood Kaydı' : 'Önerisi',
          message,
          [
            { 
              text: 'Düzenle', 
              onPress: () => {
                // Düzenle'ye basıldığında ilgili form sayfasına git
                    onClose();
                    if (autoRecord.type === 'OCD') {
                      router.push({
                        pathname: '/(tabs)/tracking',
                        params: {
                          prefill: 'true',
                          text: text,
                          category: autoRecord.data.category || 'other',
                          resistanceLevel: autoRecord.data.resistanceLevel || 5,
                          trigger: autoRecord.data.trigger || ''
                        }
                      });
                    } else if (autoRecord.type === 'CBT') {
                      router.push({
                        pathname: '/(tabs)/cbt',
                        params: {
                          prefill: 'true',
                          text: autoRecord.data.thought || text,
                          trigger: 'voice'
                        }
                      });
                    } else if (autoRecord.type === 'MOOD') {
                      router.push({
                        pathname: '/(tabs)/mood',
                        params: {
                          prefill: 'true',
                          mood: autoRecord.data.mood || 50,
                          text: autoRecord.data.notes || text,
                          trigger: autoRecord.data.trigger || ''
                        }
                      });
                    }
                  }
                }
              : { text: 'İptal', style: 'cancel' },
            { text: 'Kaydet', style: 'default', onPress: () => handleAutoRecordConfirm(autoRecord.type as any, autoRecord.data) },
          ],
        );

        // BottomSheet açma — artık gereksiz, açmıyoruz
        return;
      }
    }
    
    // Low-medium confidence (<0.8) = Navigate to form with pre-filled data
    console.log('🔄 Medium/Low confidence - navigating to form with pre-filled data');
    setToastMessage('Form sayfasına yönlendiriliyorsun...');
    setShowToast(true);

    // Navigate based on type with pre-filled data
    setTimeout(() => {
      onClose();
      console.log('🗂️ LEGACY ROUTING: Navigating based on analysis type:', analysis.type);
      
      switch (analysis.type) {
        case 'MOOD':
          console.log('🌟 LEGACY ROUTING: MOOD case triggered');
          // Navigate to mood page with pre-filled data
          router.push({
            pathname: '/(tabs)/mood',
            params: {
              prefill: 'true',
              mood: analysis.mood || 50,
              text: text || '',
              trigger: analysis.trigger || ''
            },
          });
          break;

        case 'CBT':
          // Navigate to CBT with pre-filled thought
          router.push({
            pathname: '/(tabs)/cbt',
            params: { 
              text: text || '', 
              trigger: 'voice',
              confidence: analysis.confidence,
              prefill: 'true'
            },
          });
          break;

        case 'OCD':
          // Navigate to tracking with category pre-selected
          router.push({
            pathname: '/(tabs)/tracking',
            params: {
              text: text || '',
              category: analysis.category || 'other',
              trigger: analysis.trigger || '',
              confidence: analysis.confidence,
              prefill: 'true',
              resistanceLevel: estimateResistanceFromText(text) || 5
            },
          });
          break;



        case 'BREATHWORK': {
          console.log('🌬️ LEGACY ROUTING: BREATHWORK case triggered!');
          
          // Anksiyete seviyesine göre protokol seçimi
          const anxietyLevel = Number(analysis?.anxiety ?? analysis?.extractedData?.anxietyLevel ?? 5);
          const protocol = anxietyLevel >= 7 ? '478' : 'box'; // Yüksek anksiyetede 4-7-8, normalde box breathing
          
          console.log('🌬️ Breathwork navigation details:', { 
            anxietyLevel, 
            protocol, 
            analysis_type: analysis.type,
            analysis_confidence: analysis.confidence 
          });
          
          router.push({
            pathname: '/(tabs)/breathwork',
            params: { 
              text: text || '',
              protocol,
              autoStart: 'true',
              source: 'checkin',
              anxietyLevel: String(anxietyLevel)
            },
          });
          break;
        }
      }
    }, 1000);

    // Show suggestion if available
    if (analysis.suggestion) {
      setTimeout(() => {
        setToastMessage(analysis.suggestion);
        setShowToast(true);
      }, 2500);
    }
  };

  const renderVoiceStep = () => {
    console.log('🎨 renderVoiceStep called');
    
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>Check-in</Text>
        <Text style={styles.subtitle}>
          Konuş, dinleyelim ve sana en uygun yardımı sunalım
        </Text>

        <View style={styles.voiceContainer}>
          <Animated.View
            style={[
              styles.voiceButton,
              {
                transform: [{ scale: isRecording ? pulseAnim : 1 }],
              },
            ]}
          >
            <VoiceInterface
              onTranscription={(res) => {
                console.log('🎯 VoiceInterface onTranscription callback triggered in CheckinBottomSheet:', res);
                handleVoiceTranscription(res);
              }}
              autoStart={false}
              showHints={false}
              enableCountdown={false}
              showStopButton={false}
              onStartListening={() => {
                console.log('🎙️ VoiceInterface onStartListening in CheckinBottomSheet');
                setIsRecording(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              onStopListening={() => {
                console.log('🛑 VoiceInterface onStopListening in CheckinBottomSheet');
                setIsRecording(false);
              }}
              onError={(error) => {
                console.error('Voice error:', error);
                setToastMessage('Ses tanıma başlatılamadı');
                setShowToast(true);
              }}
            />
        </Animated.View>

        {isRecording && (
          <Animated.Text style={[styles.recordingText, { opacity: fadeAnim }]}>
            Dinliyorum... Konuşmaya devam et
          </Animated.Text>
        )}

        {isProcessing && (
          <View style={styles.processingContainer}>
            <MaterialCommunityIcons name="brain" size={24} color="#4CAF50" />
            <Text style={styles.processingText}>Analiz ediliyor...</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickTitle}>Veya hızlı erişim:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[styles.quickButton, { backgroundColor: '#E8F5E9' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
              router.push('/(tabs)/cbt');
            }}
          >
            <MaterialCommunityIcons name="head-cog-outline" size={20} color="#4CAF50" />
            <Text style={styles.quickButtonText}>CBT</Text>
          </Pressable>

          <Pressable
            style={[styles.quickButton, { backgroundColor: '#FFF3E0' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
              router.push('/(tabs)/tracking');
            }}
          >
            <MaterialCommunityIcons name="pulse" size={20} color="#FF9800" />
            <Text style={styles.quickButtonText}>Takip</Text>
          </Pressable>

          <Pressable
            style={[styles.quickButton, { backgroundColor: '#F3E5F5' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
              // router.push('/(tabs)/erp'); // Removed ERP route
            }}
          >
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#9C27B0" />
            <Text style={styles.quickButtonText}>Terapi</Text>
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
    </Animated.View>
    );
  };



  return (
    <>
      <BottomSheet isVisible={isVisible} onClose={onClose}>
        <View style={styles.container}>
          {renderVoiceStep()}
        </View>
      </BottomSheet>

      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type={toastMessage?.toLowerCase().includes('hata') || toastMessage?.toLowerCase().includes('error') ? 'error' : 'info'}
      />
      
      {/* AutoRecordModal kaldırıldı */}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#558B2F',
    textAlign: 'center',
    marginBottom: 30,
  },
  voiceContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  voiceButton: {
    backgroundColor: 'white',
    borderRadius: 100,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  recordingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
  },
  processingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  quickActions: {
    marginTop: 40,
  },
  quickTitle: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 12,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  quickButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
  },
  resultContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  resultType: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#212121',
  },
  resultMood: {
    fontSize: 18,
    color: '#757575',
    marginTop: 8,
  },
  resultTrigger: {
    fontSize: 16,
    color: '#9E9E9E',
    marginTop: 4,
  },
  transcriptBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    width: '100%',
  },
  transcriptText: {
    fontSize: 14,
    color: '#424242',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
