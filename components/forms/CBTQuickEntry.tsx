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
import { useLocalSearchParams } from 'expo-router';

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

// CBT Engine & AI Services & UI Components
import { cbtEngine } from '@/features/ai/engines/cbtEngine';
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { turkishCBTService } from '@/features/ai/services/turkishCBTService';
import DistortionBadge, { MultiDistortionAnalysis } from '@/components/ui/DistortionBadge';
import SocraticQuestions, { InlineSocraticQuestions } from '@/components/ui/SocraticQuestions';

interface CBTQuickEntryProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: () => void;
  initialThought?: string;
  initialTrigger?: string;
  initialDistortions?: string[];
  voiceAnalysisData?: {
    confidence?: number;
    suggestedDistortions?: Array<{
      id: string;
      label: string;
      confidence: number;
    }>;
    autoThought?: string;
    analysisSource?: 'gemini' | 'heuristic';
  };
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
  initialThought = '',
  initialTrigger,
  initialDistortions,
  voiceAnalysisData
}: CBTQuickEntryProps) {
  console.log('🔵 CBTQuickEntry rendered, visible:', visible);
  const { user } = useAuth();
  const { t } = useTranslation();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  
  // ✅ FIXED: Get voice routing params for distortions
  const params = useLocalSearchParams();

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

  // Reset form when modal opens with voice analysis prefill
  useEffect(() => {
    if (visible) {
      setStep('thought');
      
      // Voice analysis prefill
      if (voiceAnalysisData) {
        console.log('🎤 CBT Quick Entry prefilling from voice analysis:', voiceAnalysisData);
        
        // Set auto-detected thought
        if (voiceAnalysisData.autoThought) {
          setThought(voiceAnalysisData.autoThought);
        } else if (initialThought) {
          setThought(initialThought);
        }
        
        // Set initial trigger
        if (initialTrigger) {
          setTrigger(initialTrigger);
        }
        
        // Auto-select suggested distortions with high confidence
        if (voiceAnalysisData.suggestedDistortions && voiceAnalysisData.suggestedDistortions.length > 0) {
          const highConfidenceDistortions = voiceAnalysisData.suggestedDistortions
            .filter(d => d.confidence >= 0.7)
            .map(d => d.id);
          
          if (highConfidenceDistortions.length > 0) {
            setSelectedDistortions(highConfidenceDistortions);
            console.log('🎯 Auto-selected distortions:', highConfidenceDistortions);
          }
        }
        // ✅ FIXED: Handle distortions from voice routing params
        else if (params.distortions) {
          try {
            const voiceDistortions = JSON.parse(params.distortions as string) as string[];
            console.log('🎤 Voice-detected distortions:', voiceDistortions);
            
            // Map Turkish distortion names to component IDs
            const mappedDistortions = voiceDistortions.map(distortionName => {
              const mapping: Record<string, string> = {
                'Felaketleştirme': 'catastrophizing',
                'Ya Hep Ya Hiç': 'blackWhite', 
                'Aşırı Genelleme': 'overgeneralization',
                'Zihin Okuma': 'mindReading',
                'Etiketleme': 'labeling',
                'Falcılık': 'fortune_telling',
                'Kişiselleştirme': 'personalization',
                'Zihinsel Filtre': 'mentalFilter',
                'Duygusal Akıl Yürütme': 'emotional_reasoning',
                '-Meli/-Malı İfadeleri': 'should_statements'
              };
              return mapping[distortionName] || distortionName.toLowerCase().replace(/\s+/g, '_');
            }).filter(id => COGNITIVE_DISTORTIONS.find(d => d.id === id));
            
            if (mappedDistortions.length > 0) {
              setSelectedDistortions(mappedDistortions);
              console.log('🎯 Auto-selected voice distortions:', mappedDistortions);
            }
          } catch (error) {
            console.warn('Failed to parse voice distortions:', error);
          }
        }
        
        // Set mood based on analysis confidence
        if (voiceAnalysisData.confidence) {
          const estimatedMoodBefore = Math.max(1, Math.round(5 - (voiceAnalysisData.confidence * 3)));
          setMoodBefore(estimatedMoodBefore);
        }
      } else if (!initialThought) {
        // Default reset when no prefill data
        setThought('');
        setSelectedDistortions([]);
        setEvidenceFor('');
        setEvidenceAgainst('');
        setReframe('');
        setMoodBefore(5);
        setMoodAfter(7);
        setTrigger('');
      } else {
        // Just initial thought
        setThought(initialThought);
      }
    }
  }, [visible, initialThought, initialTrigger, voiceAnalysisData]);

  // ✅ FIXED: Analyze thought using Turkish NLP + UnifiedAIPipeline
  const analyzeThought = async () => {
    if (!thought.trim() || !user?.id) return;
    
    try {
      console.log('🧠 Analyzing thought with Turkish NLP + UnifiedAIPipeline:', thought);
      
      // ✅ FIXED: Turkish NLP preprocessing for morphological analysis
      const turkishAnalysis = turkishCBTService.preprocessTurkishText(thought.trim());
      console.log('🇹🇷 Turkish NLP Analysis:', turkishAnalysis);
      
      // Use UnifiedAIPipeline for comprehensive CBT analysis with Turkish context
      const pipelineResult = await unifiedPipeline.process({
        userId: user.id,
        content: {
          originalText: thought.trim(),
          processedText: turkishAnalysis.processedText,
          turkishPatterns: turkishAnalysis.detectedPatterns,
          morphology: turkishAnalysis.morphologicalInfo,
          sentiment: turkishAnalysis.sentiment,
          intensity: turkishAnalysis.intensity
        },
        type: 'data' as const,
        context: {
          source: 'cbt' as const,
          timestamp: Date.now(),
          metadata: {
            analysisType: 'thought_analysis',
            sessionId: `cbt_thought_${Date.now()}`,
            language: 'tr',
            turkishNLP: true,
            morphologicalFeatures: turkishAnalysis.morphologicalInfo
          }
        }
      });
      
      console.log('🎯 CBT Pipeline Analysis Result:', pipelineResult);
      
      // Extract distortions from pipeline result
      if (pipelineResult.cbt?.distortions && pipelineResult.cbt.distortions.length > 0) {
        const detectedDistortions = pipelineResult.cbt.distortions;
        console.log('✅ AI-detected distortions:', detectedDistortions);
        
        // Map pipeline distortions to component IDs (similar to voice mapping)
        const mappedDistortions = detectedDistortions.map(distortionName => {
          const mapping: Record<string, string> = {
            'Felaketleştirme': 'catastrophizing',
            'catastrophizing': 'catastrophizing',
            'Ya Hep Ya Hiç': 'blackWhite',
            'all_or_nothing': 'blackWhite', 
            'Aşırı Genelleme': 'overgeneralization',
            'overgeneralization': 'overgeneralization',
            'Zihin Okuma': 'mindReading',
            'mind_reading': 'mindReading',
            'Etiketleme': 'labeling',
            'labeling': 'labeling',
            'Falcılık': 'fortune_telling',
            'fortune_telling': 'jumping_conclusions',
            'Kişiselleştirme': 'personalization',
            'personalization': 'personalization',
            'Zihinsel Filtre': 'mentalFilter',
            'mental_filter': 'mentalFilter',
            'Duygusal Akıl Yürütme': 'emotional_reasoning',
            'emotional_reasoning': 'emotional_reasoning',
            '-Meli/-Malı İfadeleri': 'should_statements',
            'should_statements': 'should_statements'
          };
          return mapping[distortionName] || distortionName.toLowerCase().replace(/\s+/g, '_');
        }).filter(id => COGNITIVE_DISTORTIONS.find(d => d.id === id));
        
        if (mappedDistortions.length > 0) {
          setSelectedDistortions(mappedDistortions);
          console.log('🎯 Auto-selected AI distortions:', mappedDistortions);
        }
      } else {
        console.log('❌ No distortions detected by AI, keeping current selection');
        // Don't clear existing selections if AI doesn't detect anything
      }
      
    } catch (error) {
      console.error('❌ UnifiedAIPipeline CBT analysis failed:', error);
      
      // ✅ FIXED: Enhanced Turkish NLP fallback instead of basic heuristic
      console.log('🔄 Falling back to Turkish NLP-enhanced analysis');
      
      let detectedDistortions: string[] = [];
      
      try {
        // Use Turkish NLP preprocessing even in fallback
        const turkishAnalysis = turkishCBTService.preprocessTurkishText(thought.trim());
        console.log('🇹🇷 Turkish NLP Fallback Analysis:', turkishAnalysis);
        
        // Map Turkish pattern names to component IDs
        detectedDistortions = turkishAnalysis.detectedPatterns.map(pattern => {
          const mapping: Record<string, string> = {
            'catastrophizing': 'catastrophizing',
            'allOrNothing': 'blackWhite',
            'shouldStatements': 'should_statements',
            'overgeneralization': 'overgeneralization',
            'personalization': 'personalization',
            'mindReading': 'mindReading',
            'labeling': 'labeling',
            'mentalFilter': 'mentalFilter',
            'emotionalReasoning': 'emotional_reasoning'
          };
          return mapping[pattern] || pattern;
        }).filter(id => COGNITIVE_DISTORTIONS.find(d => d.id === id));
        
        // If Turkish NLP detected patterns, use them
        if (detectedDistortions.length > 0) {
          console.log('✅ Turkish NLP detected patterns:', detectedDistortions);
        } else {
          // Ultimate fallback: basic keyword patterns with Turkish morphology awareness
          const lowerThought = turkishAnalysis.processedText;
          
          // Enhanced patterns considering Turkish morphology
          const morphologyInfo = turkishAnalysis.morphologicalInfo;
          
          // Check for negation patterns (Turkish-specific)
          const hasNegation = morphologyInfo.negationFound || 
            ['değil', 'yok', 'olmaz'].some(neg => lowerThought.includes(neg));
          
          // Catastrophizing with Turkish intensity
          if ((lowerThought.includes('felaket') || lowerThought.includes('mahvoldum') || 
               lowerThought.includes('korkunç') || lowerThought.includes('berbat')) ||
              (hasNegation && turkishAnalysis.intensity > 0.7)) {
            detectedDistortions.push('catastrophizing');
          }
          
          // All-or-nothing with Turkish absolute terms
          if (lowerThought.includes('her zaman') || lowerThought.includes('hiçbir zaman') ||
              lowerThought.includes('hep') || lowerThought.includes('hiç') ||
              lowerThought.includes('asla') || lowerThought.includes('mutlaka')) {
            detectedDistortions.push('overgeneralization');
            detectedDistortions.push('blackWhite');
          }
          
          // Personalization with Turkish self-blame patterns
          if (lowerThought.includes('benim yüzümden') || lowerThought.includes('suçluyum') ||
              lowerThought.includes('kabahat bende') || 
              (morphologyInfo.selfReferential && hasNegation)) {
            detectedDistortions.push('personalization');
          }
          
          // Should statements with Turkish modal suffixes
          if (morphologyInfo.modalSuffixes.length > 0 ||
              lowerThought.includes('malıyım') || lowerThought.includes('meliyim') ||
              lowerThought.includes('gerek') || lowerThought.includes('lazım')) {
            detectedDistortions.push('should_statements');
          }
          
          console.log('🎯 Enhanced Turkish heuristic patterns:', detectedDistortions);
        }
        
      } catch (turkishError) {
        console.warn('Turkish NLP fallback failed, using basic patterns:', turkishError);
        
        // Basic fallback if Turkish NLP also fails
        const lowerThought = thought.toLowerCase();
        if (lowerThought.includes('felaket')) detectedDistortions.push('catastrophizing');
        if (lowerThought.includes('her zaman')) detectedDistortions.push('overgeneralization');
        if (lowerThought.includes('benim yüzümden')) detectedDistortions.push('personalization');
      }
      
      // Apply detected distortions
      if (detectedDistortions.length > 0) {
        // Remove duplicates
        const uniqueDistortions = [...new Set(detectedDistortions)];
        setSelectedDistortions(uniqueDistortions);
        console.log('🎯 Final fallback distortions:', uniqueDistortions);
      }
    }
  };

  // ✅ FIXED: Generate AI-powered reframe suggestions instead of static ones
  const generateReframeSuggestions = async () => {
    if (!thought.trim() || !user?.id) return;
    
    try {
      console.log('🎯 Generating AI reframes for thought:', thought);
      
      let reframeSuggestions: string[] = [];
      
      // 1. Try to get reframes from UnifiedAIPipeline (if CBT analysis was done)
      try {
        const pipelineResult = await unifiedPipeline.process({
          userId: user.id,
          content: {
            originalThought: thought.trim(),
            detectedDistortions: selectedDistortions,
            evidenceFor: evidenceFor.trim(),
            evidenceAgainst: evidenceAgainst.trim()
          },
          type: 'data' as const,
          context: {
            source: 'cbt' as const,
            timestamp: Date.now(),
            metadata: {
              analysisType: 'reframe_generation',
              sessionId: `cbt_reframe_${Date.now()}`,
              distortionCount: selectedDistortions.length
            }
          }
        });
        
        console.log('🎯 Pipeline Reframe Result:', pipelineResult);
        
        if (pipelineResult.cbt?.reframes && pipelineResult.cbt.reframes.length > 0) {
          reframeSuggestions = pipelineResult.cbt.reframes;
          console.log('✅ AI-generated reframes from pipeline:', reframeSuggestions);
        }
      } catch (pipelineError) {
        console.warn('Pipeline reframe generation failed, trying reframeService:', pipelineError);
      }
      
      // 2. Fallback to dedicated reframe service
      if (reframeSuggestions.length === 0) {
        try {
          const { generateReframes } = await import('@/features/ai/services/reframeService');
          const reframeResults = await generateReframes({ 
            text: `${thought.trim()}. Çarpıtmalar: ${selectedDistortions.join(', ')}`, 
            lang: 'tr' 
          });
          
          reframeSuggestions = reframeResults.map(r => r.text);
          console.log('✅ AI-generated reframes from reframeService:', reframeSuggestions);
        } catch (serviceError) {
          console.warn('ReframeService failed, using enhanced heuristic:', serviceError);
        }
      }
      
      // 3. Enhanced heuristic fallback with distortion-specific reframes
      if (reframeSuggestions.length === 0) {
        console.log('🔄 Using enhanced heuristic reframes');
        
        const baseReframes = [
          'Bu düşünceyi destekleyen somut kanıtlar neler?',
          'Bu durumu başka nasıl yorumlayabilirim?',
          'En yakın arkadaşım bu durumda ne derdi?'
        ];
        
        // Add distortion-specific reframes
        const distortionReframes: Record<string, string[]> = {
          'catastrophizing': [
            'En kötü senaryo gerçekten bu kadar olası mı?',
            'Daha az dramatik bir sonuç ne olabilir?'
          ],
          'overgeneralization': [
            'Bu gerçekten HER ZAMAN böyle mi? İstisnaları var mı?',
            'Geçmişte farklı sonuçlar da yaşadım mı?'
          ],
          'blackWhite': [
            'Bu konuda ara tonlar, gri alanlar olabilir mi?',
            'Tam karşıtı yerine orta yol ne olabilir?'
          ],
          'personalization': [
            'Bu durumda benden bağımsız faktörler neler?',
            'Tüm sorumluluk gerçekten bende mi?'
          ],
          'mindReading': [
            'Bu düşünceyi gerçekten bildiğime dair kanıtım var mı?',
            'Başka açıklamalar da mümkün mü?'
          ]
        };
        
        selectedDistortions.forEach(distortion => {
          const specificReframes = distortionReframes[distortion];
          if (specificReframes) {
            baseReframes.push(...specificReframes);
          }
        });
        
        reframeSuggestions = baseReframes.slice(0, 3);
      }
      
      // Ensure we have suggestions and they're properly formatted
      if (reframeSuggestions.length > 0) {
        // Limit to 140 characters and ensure Turkish compatibility
        const formattedSuggestions = reframeSuggestions
          .slice(0, 3)
          .map(suggestion => suggestion.length > 140 
            ? suggestion.substring(0, 137) + '...' 
            : suggestion)
          .filter(Boolean);
        
        setAiSuggestions(formattedSuggestions);
        console.log('🎯 Final AI suggestions set:', formattedSuggestions);
      }
      
    } catch (error) {
      console.error('❌ All reframe generation methods failed:', error);
      
      // Ultimate fallback
      setAiSuggestions([
        'Bu düşüncemi daha dengeli nasıl ifade edebilirim?',
        'Bu durumda objektif kanıtlar neler?',
        'Kendime nasıl şefkatle yaklaşabilirim?'
      ]);
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
        
        // ✅ FIXED: Trigger cache invalidation for CBT insights
        if (result?.id) {
          unifiedPipeline.triggerInvalidation('cbt_record_added', user.id);
          console.log('🔄 CBT cache invalidation triggered');
        }
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
                


                {/* AI-Suggested Distortions (if available) */}
                {voiceAnalysisData?.suggestedDistortions && voiceAnalysisData.suggestedDistortions.length > 0 && (
                  <View style={styles.aiSuggestionsSection}>
                    <View style={styles.aiSuggestionHeader}>
                      <MaterialCommunityIcons name="robot" size={18} color="#6366F1" />
                      <Text style={styles.aiSuggestionTitle}>
                        AI Önerileri ({voiceAnalysisData.analysisSource === 'gemini' ? 'Gemini' : 'Heuristik'})
                      </Text>
                    </View>
                    
                    <MultiDistortionAnalysis
                      distortions={voiceAnalysisData.suggestedDistortions.map(d => ({
                        id: d.id,
                        confidence: d.confidence,
                        selected: selectedDistortions.includes(d.id)
                      }))}
                      onDistortionPress={(distortionId) => toggleDistortion(distortionId)}
                      maxDisplay={6}
                    />
                  </View>
                )}

                {/* Manual Selection */}
                <View style={styles.manualSelectionSection}>
                  <Text style={styles.manualSelectionTitle}>Elle Seç</Text>
                  <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
                    <View style={styles.distortionBadgeGrid}>
                      {COGNITIVE_DISTORTIONS.map(distortion => {
                        const isSelected = selectedDistortions.includes(distortion.id);
                        const suggestedMatch = voiceAnalysisData?.suggestedDistortions?.find(s => s.id === distortion.id);
                        const confidence = suggestedMatch?.confidence || 0.5;
                        
                        return (
                          <Pressable
                            key={distortion.id}
                            onPress={() => toggleDistortion(distortion.id)}
                            accessible={true}
                            accessibilityLabel={`${distortion.label} çarpıtması`}
                            accessibilityHint={distortion.description}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                          >
                            <DistortionBadge
                              distortion={distortion.id}
                              confidence={confidence}
                              selected={isSelected}
                              showPercentage={!!suggestedMatch}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
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

              {/* Socratic Questions for Evidence Step */}
              <InlineSocraticQuestions
                questions={[
                  "Bu düşünceyi destekleyen somut kanıtlar neler?",
                  "Bu durumu farklı yorumlayabilir misin?",
                  "En yakın arkadaşın bu durumda ne derdi?",
                  "Bu olayı 10 yıl sonra nasıl değerlendirirsin?",
                  "Bu düşüncenin alternatif açıklamaları var mı?",
                  "Geçmişte benzer durumlar nasıl sonuçlandı?"
                ]}
                onQuestionSelect={(question) => {
                  // Add question as placeholder or hint
                  if (!evidenceFor.trim() && !evidenceAgainst.trim()) {
                    // Use as thinking prompt
                    console.log('Selected question for evidence thinking:', question);
                  }
                }}
                maxDisplay={3}
              />

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
              
              {/* Socratic Questions for Reframe Step */}
              <InlineSocraticQuestions
                questions={[
                  "Bu düşünceyi daha dengeli nasıl ifade edebilirsin?",
                  "Kendine nasıl şefkatle yaklaşabilirsin?",
                  "Bu durumdan ne öğrenebilirsin?",
                  "İlerleme için hangi küçük adımları atabilirsin?",
                  "Bu konuda ne yapabileceğin var?",
                  "Kontrolünde olan şeyler neler?"
                ]}
                onQuestionSelect={(question) => {
                  console.log('Selected reframe question:', question);
                }}
                maxDisplay={3}
              />

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
  // AI Suggestions Styles
  aiSuggestionsSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  aiSuggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    fontFamily: 'Inter',
  },
  manualSelectionSection: {
    marginTop: 8,
  },
  manualSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  distortionBadgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
