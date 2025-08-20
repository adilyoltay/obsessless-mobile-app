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
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/gamificationStore';
import supabaseService from '@/services/supabase';

// Utils
import { sanitizePII } from '@/utils/privacy';
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
  const [autoRecordType, setAutoRecordType] = useState<'OCD' | 'CBT' | 'MOOD' | 'ERP'>('OCD');

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
      try {
        // unifiedVoiceAnalysis sadece text parametresi alıyor
        analysis = await unifiedVoiceAnalysis(res.text || '');
      } catch (analysisError) {
        console.error('🔴 unifiedVoiceAnalysis failed:', analysisError);
        throw analysisError;
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
          analysis_type: analysis.type,
          original_duration: res.duration,
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
              text: res.text || '',
              mood: analysis.mood || 0,
              trigger: analysis.trigger || '',
              confidence: analysis.confidence || res.confidence || 0,
              lang: res.language || 'tr-TR',
              analysis_type: analysis.type,
              original_duration: res.duration,
              timestamp: new Date().toISOString(),
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
      await awardMicroReward('voice_checkin');
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
  const handleAutoRecordConfirm = async (data: any) => {
    setShowAutoRecord(false);
    
    if (autoRecordType === 'ERP') {
      // Navigate to ERP
      onClose();
      router.push({
        pathname: '/(tabs)/erp',
        params: { 
          text: lastTranscript,
          category: data.category 
        },
      });
    } else {
      // Save the record
      const result = await saveAutoRecord(autoRecordType as 'OCD' | 'CBT' | 'MOOD', data);
      
      if (result.success) {
        // Award gamification rewards
        await awardMicroReward('auto_record' as any);
        await updateStreak();
        
        setToastMessage('Kayıt başarıyla oluşturuldu ✅');
        setShowToast(true);
        
        // Başarılı kayıttan sonra ilgili sayfaya git ve yenile
        setTimeout(() => {
          onClose();
          if (autoRecordType === 'OCD') {
            router.push({
              pathname: '/(tabs)/tracking',
              params: { highlight: 'latest', justSaved: 'true', refresh: String(Date.now()) },
            });
          } else if (autoRecordType === 'CBT') {
            router.push({
              pathname: '/(tabs)/cbt',
              params: { refresh: 'true', highlightId: result.recordId },
            });
          } else if (autoRecordType === 'MOOD') {
            router.push({
              pathname: '/(tabs)/mood',
              params: { refresh: 'true', highlightId: result.recordId },
            });
          }
          if (onComplete) onComplete();
        }, 800);
      } else {
        setToastMessage(result.error || 'Kayıt oluşturulamadı');
        setShowToast(true);
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
        case 'ERP':
          router.push({
            pathname: '/(tabs)/erp',
            params: { text: lastTranscript },
          });
          break;
      }
      onClose();
    }
  };

  const handleAnalysisResult = (analysis: any, text: string) => {
    console.log('🔄 handleAnalysisResult called with:', { analysis, text });
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // High confidence (>0.8) = Show modal for confirmation
    if (analysis.confidence >= 0.8 && user?.id) {
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
            : `ERP önerisi: ${autoRecord.data.category || 'genel'}\n\nDevam edelim mi?`;

        Alert.alert(
          autoRecord.type === 'OCD' ? 'OKB Kaydı' : autoRecord.type === 'CBT' ? 'CBT Kaydı' : autoRecord.type === 'MOOD' ? 'Mood Kaydı' : 'ERP Önerisi',
          message,
          [
            autoRecord.type !== 'ERP'
              ? { 
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
            autoRecord.type !== 'ERP'
              ? { 
                  text: 'Kaydet', 
                  style: 'default', 
                  onPress: () => {
                    // autoRecordType'ı doğru set et ve kaydet
                    setAutoRecordType(autoRecord.type);
                    handleAutoRecordConfirm(autoRecord.data);
                  }
                }
              : { text: 'Devam Et', style: 'default', onPress: () => handleAutoRecordConfirm(autoRecord.data) },
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
      switch (analysis.type) {
        case 'MOOD':
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

        case 'ERP':
          // Navigate to ERP with suggested exercise
          router.push({
            pathname: '/(tabs)/erp',
            params: { 
              text: text || '',
              category: analysis.category || '',
              prefill: 'true'
            },
          });
          break;

        case 'BREATHWORK':
          // Navigate to breathwork
          router.push({
            pathname: '/(tabs)/breathwork',
            params: { text: text || '' },
          });
          break;
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
              router.push('/(tabs)/erp');
            }}
          >
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#9C27B0" />
            <Text style={styles.quickButtonText}>ERP</Text>
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
