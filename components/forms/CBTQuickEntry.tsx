import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import * as Haptics from 'expo-haptics';

// UI Components removed - using Pressable instead

// Lindsay Braman Style Illustrations
import { 
  CBTIllustrations, 
  distortionInfo,
  OvergeneralizationIcon,
  MindReadingIcon,
  CatastrophizingIcon,
  BlackWhiteIcon,
  PersonalizationIcon,
  LabelingIcon,
  MentalFilterIcon
} from '@/components/illustrations/CBTIllustrations';

// Hooks & Services
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/gamificationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '@/utils/storage';
import supabaseService from '@/services/supabase';

// CBT Engine
import { cbtEngine } from '@/features/ai/engines/cbtEngine';

interface CBTQuickEntryProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: () => void;
  initialThought?: string;
}

// Bilişsel çarpıtmalar listesi - Lindsay Braman görselleriyle eşleştirilmiş
const COGNITIVE_DISTORTIONS = [
  { 
    id: 'blackWhite', 
    label: 'Siyah-Beyaz Düşünce', 
    description: 'Her şeyi uç noktalarda görme',
    icon: 'blackWhite',
    example: 'Ya mükemmelim ya da başarısızım'
  },
  { 
    id: 'overgeneralization', 
    label: 'Aşırı Genelleme', 
    description: 'Tek olaydan genel sonuç çıkarma',
    icon: 'overgeneralization',
    example: 'Bir kere başarısız oldum, her zaman başarısız olurum'
  },
  { 
    id: 'mentalFilter', 
    label: 'Zihinsel Filtre', 
    description: 'Sadece olumsuzlara odaklanma',
    icon: 'mentalFilter',
    example: 'Bir eleştiri aldım, gün mahvoldu'
  },
  { 
    id: 'mindReading', 
    label: 'Zihin Okuma', 
    description: 'Başkalarının ne düşündüğünü bildiğini sanma',
    icon: 'mindReading',
    example: 'Herkes beni yetersiz buluyor'
  },
  { 
    id: 'catastrophizing', 
    label: 'Felaketleştirme', 
    description: 'En kötü senaryoyu düşünme',
    icon: 'catastrophizing',
    example: 'Bu hata yüzünden hayatım mahvoldu'
  },
  { 
    id: 'personalization', 
    label: 'Kişiselleştirme', 
    description: 'Her şeyi üstüne alma',
    icon: 'personalization',
    example: 'Arkadaşım mutsuzsa, ben kötü bir dostum'
  },
  { 
    id: 'labeling', 
    label: 'Etiketleme', 
    description: 'Kendine veya başkalarına etiket yapıştırma',
    icon: 'labeling',
    example: 'Ben bir ezik/başarısızım'
  },
  { id: 'disqualifying_positive', label: 'Olumluyu Yok Sayma', description: 'İyi şeyleri görmezden gelme' },
  { id: 'jumping_conclusions', label: 'Sonuca Atlama', description: 'Kanıt olmadan varsayımda bulunma' },
  { id: 'magnification', label: 'Büyütme/Küçültme', description: 'Olayları abartma veya önemsizleştirme' },
  { id: 'emotional_reasoning', label: 'Duygusal Akıl Yürütme', description: 'Hislerini gerçek sanma' },
  { id: 'should_statements', label: '-Meli/-Malı İfadeleri', description: 'Kendine katı kurallar koyma' }
];

export default function CBTQuickEntry({ 
  visible, 
  onDismiss, 
  onSubmit,
  initialThought = '' 
}: CBTQuickEntryProps) {
  console.log('🔵 CBTQuickEntry rendered, visible:', visible);
  const { user } = useAuth();
  const { t } = useTranslation();
  const { awardMicroReward, updateStreak } = useGamificationStore();

  // Form states
  const [step, setStep] = useState<'thought' | 'distortions' | 'evidence' | 'reframe'>('thought');
  const [thought, setThought] = useState(initialThought);
  const [selectedDistortions, setSelectedDistortions] = useState<string[]>([]);
  const [evidenceFor, setEvidenceFor] = useState('');
  const [evidenceAgainst, setEvidenceAgainst] = useState('');
  const [reframe, setReframe] = useState('');
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(7);
  const [trigger, setTrigger] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setStep('thought');
      if (!initialThought) {
        setThought('');
        setSelectedDistortions([]);
        setEvidenceFor('');
        setEvidenceAgainst('');
        setReframe('');
        setMoodBefore(5);
        setMoodAfter(7);
        setTrigger('');
      }
    }
  }, [visible]);

  // Analyze thought for distortions
  const analyzeThought = async () => {
    if (!thought.trim()) return;
    
    try {
      // Basit bir analiz yapalım - gerçek AI analizi için CBT Engine'in güncellenmesi gerekir
      // Şimdilik bazı anahtar kelimelere bakarak çarpıtmaları tespit edebiliriz
      const lowerThought = thought.toLowerCase();
      const detectedDistortions: string[] = [];
      
      if (lowerThought.includes('her zaman') || lowerThought.includes('hiçbir zaman')) {
        detectedDistortions.push('overgeneralization');
      }
      if (lowerThought.includes('herkes') || lowerThought.includes('kimse')) {
        detectedDistortions.push('overgeneralization');
      }
      if (lowerThought.includes('kesin') || lowerThought.includes('mutlaka')) {
        detectedDistortions.push('mindReading');
      }
      if (lowerThought.includes('felaket') || lowerThought.includes('mahvoldum')) {
        detectedDistortions.push('catastrophizing');
      }
      if (lowerThought.includes('ya hep ya hiç') || lowerThought.includes('tamamen')) {
        detectedDistortions.push('blackWhite');
      }
      if (lowerThought.includes('benim yüzümden') || lowerThought.includes('suçluyum')) {
        detectedDistortions.push('personalization');
      }
      
      if (detectedDistortions.length > 0) {
        setSelectedDistortions(detectedDistortions);
      }
    } catch (error) {
      console.warn('CBT analysis failed:', error);
    }
  };

  // Generate reframe suggestions
  const generateReframeSuggestions = async () => {
    if (!thought.trim()) return;
    
    try {
      // Basit reframe önerileri
      const suggestions = [
        'Bu duruma başka bir açıdan bakmaya ne dersin?',
        'Kanıtlar gerçekten bu düşünceyi destekliyor mu?',
        'Bir arkadaşın bu durumda olsaydı ona ne söylerdin?',
        'Bu düşünce sana yardımcı mı oluyor yoksa engelliyor mu?',
        'Daha dengeli bir bakış açısı geliştirebilir misin?'
      ];
      
      // Çarpıtmalara özel öneriler
      if (selectedDistortions.includes('overgeneralization')) {
        suggestions.push('Bu gerçekten HER ZAMAN böyle mi? İstisnaları düşün.');
      }
      if (selectedDistortions.includes('catastrophizing')) {
        suggestions.push('En kötü senaryo gerçekleşme olasılığı nedir?');
      }
      if (selectedDistortions.includes('personalization')) {
        suggestions.push('Bu durumda başka faktörler de rol oynuyor olabilir mi?');
      }
      
      setAiSuggestions(suggestions.slice(0, 3));
    } catch (error) {
      console.warn('Reframe generation failed:', error);
    }
  };

  const toggleDistortion = (id: string) => {
    setSelectedDistortions(prev => 
      prev.includes(id) 
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!user?.id || !thought.trim() || !reframe.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const record = {
        user_id: user.id,
        thought: thought.trim(),
        distortions: selectedDistortions.map(id => 
          COGNITIVE_DISTORTIONS.find(d => d.id === id)?.label || id
        ),
        evidence_for: evidenceFor.trim(),
        evidence_against: evidenceAgainst.trim(),
        reframe: reframe.trim(),
        mood_before: moodBefore,
        mood_after: moodAfter,
        trigger: trigger.trim(),
        notes: ''
      };

      // Save to Supabase
      try {
        const result = await supabaseService.saveCBTRecord(record);
        console.log('✅ CBT record saved to Supabase:', result?.id);
      } catch (error) {
        console.warn('⚠️ Supabase save failed, adding to offline queue:', error);
        
        // Add to offline sync queue
        try {
          const { offlineSyncService } = await import('@/services/offlineSync');
          await offlineSyncService.addToSyncQueue({
            type: 'CREATE',
            entity: 'thought_record',
            data: record
          });
          console.log('✅ CBT record added to offline sync queue');
        } catch (syncError) {
          console.error('❌ Failed to add to offline queue:', syncError);
        }
      }

      // Also save to local storage for offline access
      const localRecord = {
        id: `cbt_${Date.now()}`,
        ...record,
        created_at: new Date().toISOString(),
        timestamp: new Date()
      };

      const key = StorageKeys.THOUGHT_RECORDS?.(user.id) || `thought_records_${user.id}`;
      const existing = await AsyncStorage.getItem(key);
      const records = existing ? JSON.parse(existing) : [];
      records.unshift(localRecord);
      await AsyncStorage.setItem(key, JSON.stringify(records));

      // Award gamification points
      await awardMicroReward('cbt_completed', 15);
      await updateStreak();

      // Success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Callback and close
      onSubmit();
      onDismiss();
      
    } catch (error) {
      console.error('Error saving CBT record:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['thought', 'distortions', 'evidence', 'reframe'].map((s, index) => (
        <View key={s} style={styles.stepItem}>
          <View style={[
            styles.stepDot,
            step === s && styles.stepDotActive,
            ['thought', 'distortions', 'evidence', 'reframe'].indexOf(step) > index && styles.stepDotCompleted
          ]}>
            {['thought', 'distortions', 'evidence', 'reframe'].indexOf(step) > index ? (
              <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
            ) : (
              <Text style={styles.stepNumber}>{index + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
            {s === 'thought' ? 'Düşünce' :
             s === 'distortions' ? 'Çarpıtmalar' :
             s === 'evidence' ? 'Kanıtlar' : 'Yeniden Çerçeve'}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderMoodSlider = (value: number, onChange: (val: number) => void, label: string) => (
    <View style={styles.moodContainer}>
      <Text style={styles.moodLabel}>{label}</Text>
      <View style={styles.moodSlider}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <Pressable
            key={num}
            onPress={() => {
              onChange(num);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.moodDot,
              value === num && styles.moodDotActive
            ]}
          >
            <Text style={[
              styles.moodNumber,
              value === num && styles.moodNumberActive
            ]}>{num}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

    return (
    <BottomSheet
      isVisible={visible}
      onClose={onDismiss}
      edgeToEdge={true}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Düşünce Kaydı</Text>
            <Pressable onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color="#9CA3AF" />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Olumsuz düşüncelerinizi yeniden çerçeveleyin</Text>
        </View>

        {renderStepIndicator()}

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Thought */}
          {step === 'thought' && (
            <View style={styles.stepContent}>
              <View style={styles.stepMain}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="thought-bubble-outline" size={24} color="#6366F1" />
                  <Text style={styles.stepTitle}>Ne düşünüyorsunuz?</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Aklınızdan geçen düşünceyi olduğu gibi, yargılamadan yazın
                </Text>
                
                <TextInput
                  style={styles.textArea}
                  placeholder="Aklınızdan geçen düşünceyi yazın..."
                  placeholderTextColor="#9CA3AF"
                  value={thought}
                  onChangeText={setThought}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={styles.fieldLabel}>Ne oldu? (İsteğe bağlı)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Bu düşünce nasıl başladı?"
                  placeholderTextColor="#9CA3AF"
                  value={trigger}
                  onChangeText={setTrigger}
                />

                <View style={styles.moodSection}>
                  <Text style={styles.fieldLabel}>Şu an nasıl hissediyorsunuz?</Text>
                  {renderMoodSlider(moodBefore, setMoodBefore, '')}
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={async () => {
                    if (thought.trim()) {
                      await analyzeThought();
                      setStep('distortions');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  disabled={!thought.trim()}
                  style={[styles.primaryButton, !thought.trim() && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>Devam Et</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 2: Distortions */}
          {step === 'distortions' && (
            <View style={styles.stepContent}>
              <View style={styles.stepMain}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#F59E0B" />
                  <Text style={styles.stepTitle}>Düşünce tuzakları</Text>
                </View>
                <Text style={styles.stepDescription}>
                  Hangi düşünce kalıplarını fark ediyorsunuz?
                </Text>
                


                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={true}>
                  <View style={styles.distortionGrid}>
                    {COGNITIVE_DISTORTIONS.map(distortion => {
                      const IllustrationComponent = distortion.icon ? CBTIllustrations[distortion.icon] : null;
                      const isSelected = selectedDistortions.includes(distortion.id);
                      console.log('🎨 Rendering distortion:', distortion.label, 'has icon:', !!distortion.icon);
                      
                      return (
                      <Pressable
                        key={distortion.id}
                        style={[
                          styles.distortionCard,
                          isSelected && styles.distortionCardActive
                        ]}
                        onPress={() => toggleDistortion(distortion.id)}
                        accessible={true}
                        accessibilityLabel={`${distortion.label} çarpıtması`}
                        accessibilityHint={distortion.description}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        {/* Lindsay Braman tarzı görsel */}
                        {IllustrationComponent && (
                          <View style={styles.distortionIllustration}>
                            <IllustrationComponent 
                              size={70} 
                              color={isSelected ? '#7C9885' : undefined}
                            />
                          </View>
                        )}
                        
                        <View style={styles.distortionContent}>
                          <View style={styles.distortionHeader}>
                            <Text style={[
                              styles.distortionLabel,
                              isSelected && styles.distortionLabelActive
                            ]}>
                              {distortion.label}
                            </Text>
                            {isSelected && (
                              <MaterialCommunityIcons name="check-circle" size={20} color="#7C9885" />
                            )}
                          </View>
                          <Text style={styles.distortionDescription}>
                            {distortion.description}
                          </Text>
                          {distortion.example && (
                            <Text style={styles.distortionExample}>
                              Örnek: "{distortion.example}"
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.actions}>
                <Pressable 
                  onPress={() => {
                    setStep('thought');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Geri</Text>
                </Pressable>
                <Pressable 
                  onPress={() => {
                    setStep('evidence');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Devam Et</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 3: Evidence */}
          {step === 'evidence' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Kanıtları Değerlendirin</Text>
              <Text style={styles.stepDescription}>
                Bu düşünceyi destekleyen ve çürüten kanıtlar neler?
              </Text>

              <Text style={styles.fieldLabel}>Lehine Kanıtlar</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Bu düşünceyi destekleyen gerçekler..."
                value={evidenceFor}
                onChangeText={setEvidenceFor}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Aleyhine Kanıtlar</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Bu düşünceye karşı olan gerçekler..."
                value={evidenceAgainst}
                onChangeText={setEvidenceAgainst}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.actions}>
                <Pressable 
                  onPress={() => {
                    setStep('distortions');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Geri</Text>
                </Pressable>
                <Pressable 
                  onPress={async () => {
                    await generateReframeSuggestions();
                    setStep('reframe');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Devam Et</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Step 4: Reframe */}
          {step === 'reframe' && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Yeniden Çerçeveleme</Text>
              <Text style={styles.stepDescription}>
                Daha dengeli ve gerçekçi bir düşünce oluşturun
              </Text>

              {aiSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>🤖 AI Önerileri:</Text>
                  {aiSuggestions.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      style={styles.suggestionCard}
                      onPress={() => {
                        setReframe(suggestion);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Yeni Düşünce</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Daha dengeli ve gerçekçi düşünceniz..."
                value={reframe}
                onChangeText={setReframe}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {renderMoodSlider(moodAfter, setMoodAfter, 'Yeni Ruh Haliniz (1-10)')}

              <View style={styles.actions}>
                <Pressable 
                  onPress={() => {
                    setStep('evidence');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Geri</Text>
                </Pressable>
                <Pressable 
                  onPress={handleSubmit}
                  disabled={!reframe.trim() || isSubmitting}
                  style={[styles.primaryButton, (!reframe.trim() || isSubmitting) && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  header: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: '#3B82F6',
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  stepLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  stepContent: {
    padding: 20,
    minHeight: 500,
    justifyContent: 'space-between',
  },
  stepMain: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 10,
    marginTop: 16,
  },
  moodSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  distortionGrid: {
    flexDirection: 'column',
    paddingHorizontal: 8,
  },
  distortionCard: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  distortionCardActive: {
    borderColor: '#7C9885',
    backgroundColor: '#F0FDF4',
    shadowOpacity: 0.1,
    elevation: 3,
  },
  distortionIllustration: {
    alignItems: 'center',
    marginBottom: 12,
  },
  distortionContent: {
    flex: 1,
  },
  distortionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  distortionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  distortionLabelActive: {
    color: '#7C9885',
    fontWeight: '800',
  },
  distortionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  distortionExample: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    lineHeight: 16,
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
  },
  moodContainer: {
    marginTop: 20,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  moodSlider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  moodDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodDotActive: {
    backgroundColor: '#3B82F6',
  },
  moodNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  moodNumberActive: {
    color: '#FFFFFF',
  },
  suggestionsContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  suggestionCard: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  suggestionText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
