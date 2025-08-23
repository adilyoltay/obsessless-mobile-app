import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useTranslation } from '@/hooks/useTranslation';
import { CANONICAL_CATEGORIES } from '@/utils/categoryMapping';
import { getCanonicalCategoryIconName, getCanonicalCategoryColor } from '@/constants/canonicalCategories';
import { Compulsion } from '@/types/compulsion';
import { useGamificationStore } from '@/store/gamificationStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService, { CompulsionRecord } from '@/services/supabase';
import { useStandardizedCompulsion } from '@/hooks/useStandardizedData';
import { sanitizePII } from '@/utils/privacy';

import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';
import { ocdTriggerDetectionService } from '@/features/ai/services/ocdTriggerDetectionService';
import { turkishOCDCulturalService } from '@/features/ai/services/turkishOcdCulturalService';

interface CompulsionQuickEntryProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (entry: any) => void;
  initialCategory?: string;
  initialText?: string;
  initialResistance?: number;
  initialTrigger?: string;
  initialSeverity?: number;
}

const { width } = Dimensions.get('window');

// Top featured categories removed - using only grid layout

export function CompulsionQuickEntry({
  visible,
  onDismiss,
  onSubmit,
  initialCategory,
  initialText,
  initialResistance,
  initialTrigger,
  initialSeverity,
}: CompulsionQuickEntryProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<string>('');
  const [resistanceLevel, setResistanceLevel] = useState<number>(5);
  const [severity, setSeverity] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [trigger, setTrigger] = useState<string>('');
  const [lastCompulsion, setLastCompulsion] = useState<any | null>(null);
  const [frequentTypes, setFrequentTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Auto-trigger detection state
  const [suggestedTriggers, setSuggestedTriggers] = useState<string[]>([]);
  const [isDetectingTriggers, setIsDetectingTriggers] = useState<boolean>(false);
  
  const { awardMicroReward } = useGamificationStore();
  const { user } = useAuth();
  const { submitCompulsion } = useStandardizedCompulsion(user?.id);

  useEffect(() => {
    if (visible) {
      // Pre-fill with initial values if provided
      if (initialCategory) {
        setSelectedType(initialCategory);
      }
      if (initialText) {
        const combinedNotes = initialTrigger 
          ? `${initialText}\n\nTetikleyici: ${initialTrigger}`
          : initialText;
        setNotes(combinedNotes);
      }
      if (initialTrigger) {
        setTrigger(initialTrigger);
      }
      if (initialResistance !== undefined) {
        setResistanceLevel(initialResistance);
      }
      if (initialSeverity !== undefined) {
        setSeverity(initialSeverity);
      }
      
      // Load smart data if no initial values
      if (!initialCategory) {
        loadSmartData();
      }
      awardMicroReward('compulsion_quick_entry');
    }
  }, [visible, initialCategory, initialText, initialResistance, initialTrigger, initialSeverity]);

  // Auto-detect triggers when notes change
  useEffect(() => {
    const detectTriggersFromNotes = async () => {
      if (!notes || notes.length < 10 || isDetectingTriggers) {
        return;
      }

      try {
        setIsDetectingTriggers(true);
        
        // Create a mock compulsion entry for trigger detection
        const mockEntry = {
          id: 'temp',
          type: selectedType || 'other',
          resistanceLevel,
          timestamp: new Date(),
          notes: notes
        };

        // Use existing service to detect triggers
        const triggerAnalysis = await ocdTriggerDetectionService.detectTriggersFromText([mockEntry]);
        
        if (triggerAnalysis.triggers && triggerAnalysis.triggers.length > 0) {
          // Extract top 3 trigger suggestions
          let suggestions = triggerAnalysis.triggers
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3)
            .map(t => t.trigger);

          // Apply Turkish cultural adaptations to triggers
          try {
            const culturalAnalysis = await turkishOCDCulturalService.analyzeTurkishCulturalFactors(
              user?.id || 'temp',
              [mockEntry]
            );
            
            // Filter and adapt triggers based on cultural context
            if (culturalAnalysis.religiousAnalysis.isPresent) {
              // Add culturally sensitive trigger options
              const religiousContext = culturalAnalysis.religiousAnalysis.themes.map(t => t.theme);
              suggestions = [...new Set([...suggestions, ...religiousContext])].slice(0, 3);
            }
          } catch (error) {
            console.warn('Cultural analysis failed for trigger suggestions:', error);
          }
            
          setSuggestedTriggers(suggestions);
          
          // Auto-fill first suggestion if no trigger is set
          if (!trigger && suggestions.length > 0) {
            setTrigger(suggestions[0]);
          }
        }
      } catch (error) {
        console.warn('Trigger detection failed:', error);
      } finally {
        setIsDetectingTriggers(false);
      }
    };

    // Debounce trigger detection
    const timeoutId = setTimeout(detectTriggersFromNotes, 1000);
    return () => clearTimeout(timeoutId);
  }, [notes, selectedType, resistanceLevel]);

  useEffect(() => {
    if (!visible) {
      // Reset form when closed
      setSelectedType('');
      setResistanceLevel(5);
      setSeverity(5);
      setNotes('');
      setTrigger('');
      setSuggestedTriggers([]);
    }
  }, [visible]);

  const loadSmartData = async () => {
    try {
      // Load last compulsion
      const lastCompulsionData = await AsyncStorage.getItem('lastCompulsion');
      if (lastCompulsionData) {
        const last = JSON.parse(lastCompulsionData);
        setLastCompulsion(last);
        // Pre-select last type for convenience
        setSelectedType(last.type);
      }

      // Load frequent types
      const recentCompulsions = await AsyncStorage.getItem('recentCompulsions');
      const compulsions = recentCompulsions ? JSON.parse(recentCompulsions) : [];
      
      if (compulsions.length > 0) {
        // Calculate frequency
        const typeFrequency = compulsions.reduce((acc: any, comp: any) => {
          acc[comp.type] = (acc[comp.type] || 0) + 1;
          return acc;
        }, {});

        // Get top 3 most frequent types
        const topTypes = Object.entries(typeFrequency)
          .sort(([,a]: any, [,b]: any) => b - a)
          .slice(0, 3)
          .map(([type]) => type);

        setFrequentTypes(topTypes);
      }
    } catch (error) {
      console.log('Error loading smart data:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Uyarı', 'Lütfen kompulsiyon tipini seçin');
      return;
    }

    if (!user?.id) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setIsSubmitting(true);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 🔐 PRIVACY-FIRST: Sanitize PII from user input before storage
      const compulsionData: Omit<CompulsionRecord, 'id' | 'timestamp'> = {
        user_id: user.id,
        category: selectedType,
        subcategory: selectedType, // koru: orijinal etiket
        resistance_level: resistanceLevel,
        notes: notes.trim() ? sanitizePII(notes.trim()) : undefined,
      };

      // Create entry for callbacks (privacy-sanitized)
      const entry = {
        type: selectedType,
        resistanceLevel,
        severity,
        trigger: trigger.trim() ? sanitizePII(trigger.trim()) : undefined,
        notes: notes.trim() ? sanitizePII(notes.trim()) : '',
      };

      // Save to Supabase first (standardized)
      const savedCompulsion = await (async () => {
        try {
          await submitCompulsion({
            type: selectedType,
            resistanceLevel,
            severity,
            trigger: trigger.trim() ? sanitizePII(trigger.trim()) : undefined,
            notes: notes.trim() ? sanitizePII(notes.trim()) : undefined,
          });
          return true;
        } catch (e) {
          return false;
        }
      })();
      
      if (savedCompulsion) {
        console.log('✅ Compulsion saved to Supabase:', savedCompulsion);
        
        // Save as last compulsion (local)
        await AsyncStorage.setItem('lastCompulsion', JSON.stringify(entry));
        
        // Add to recent compulsions (local)
        const recentCompulsions = await AsyncStorage.getItem('recentCompulsions');
        const compulsions = recentCompulsions ? JSON.parse(recentCompulsions) : [];
        compulsions.push({ ...entry, timestamp: new Date().toISOString() });
        
        // Keep only last 50 entries
        if (compulsions.length > 50) {
          compulsions.splice(0, compulsions.length - 50);
        }
        
        await AsyncStorage.setItem('recentCompulsions', JSON.stringify(compulsions));

        // Award high resistance bonus
        if (resistanceLevel >= 8) {
          awardMicroReward('high_resistance');
        }
        
        // 🗑️ Invalidate AI cache - new compulsion affects patterns
        unifiedPipeline.triggerInvalidation('compulsion_added', user.id);

        onSubmit(entry);
        onDismiss();
      } else {
        // Fallback to local-only storage if Supabase fails
        console.warn('⚠️ Supabase save failed, saving locally only');
        
        await AsyncStorage.setItem('lastCompulsion', JSON.stringify(entry));
        const recentCompulsions = await AsyncStorage.getItem('recentCompulsions');
        const compulsions = recentCompulsions ? JSON.parse(recentCompulsions) : [];
        compulsions.push({ ...entry, timestamp: new Date().toISOString(), needsSync: true });
        await AsyncStorage.setItem('recentCompulsions', JSON.stringify(compulsions));
        
        Alert.alert('Uyarı', 'Veri yerel olarak kaydedildi. İnternet bağlantısı kurulduğunda senkronize edilecek.');
        
        if (resistanceLevel >= 8) {
          awardMicroReward('high_resistance');
        }
        
        // 🗑️ Invalidate AI cache - new compulsion affects patterns (fallback)
        unifiedPipeline.triggerInvalidation('compulsion_added', user.id);

        onSubmit(entry);
        onDismiss();
      }
    } catch (error) {
      console.error('❌ Error submitting compulsion:', error);
      Alert.alert('Hata', 'Kaydetme sırasında bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getResistanceColor = (level: number) => {
    if (level <= 3) return '#EF4444'; // Kırmızı - Düşük direnç
    if (level <= 6) return '#F59E0B'; // Turuncu - Orta direnç  
    return '#10B981'; // Yeşil - Yüksek direnç
  };

  const getResistanceEmoji = (level: number) => {
    if (level <= 3) return '😰'; // Düşük direnç
    if (level <= 6) return '😐'; // Orta direnç
    return '😊'; // Yüksek direnç - HTML'deki gibi mutlu yüz
  };

  // Resistance slider için progress percentage hesaplama
  const getResistanceProgress = (level: number) => {
    return (level / 10) * 100;
  };

  // Slider'da tıklama ile değer değiştirme
  const handleSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const sliderWidth = width - 32; // padding hesaba katılarak
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = Math.round(percentage * 10);
    const clampedValue = Math.max(1, Math.min(10, newValue));
    
    setResistanceLevel(clampedValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Debug logging for visibility issues
  console.log('🔍 CompulsionQuickEntry render:', { 
    visible, 
    timestamp: new Date().toLocaleTimeString(),
    shouldRender: visible,
    initialCategory,
    hasInitialText: !!initialText
  });

  // Early return if not visible
  if (!visible) {
    console.log('❌ CompulsionQuickEntry: visible=false, not rendering');
    return null;
  }

  console.log('✅ CompulsionQuickEntry: Rendering with visible=true', {
    initialCategory,
    initialText: initialText?.substring(0, 30) + '...',
    initialResistance,
    initialSeverity
  });

  return (
    <BottomSheet
      isVisible={visible}
      onClose={onDismiss}
    >
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Kompulsiyon Ekle</Text>
            <Text style={styles.headerSubtitle}>Hangi tür kompulsiyon yaşadınız?</Text>
          </View>

          {/* Categories Grid - Optimized Mobile Layout (Canonical 6) */}
          <View style={styles.categoriesGrid}>
            {CANONICAL_CATEGORIES.map((id) => {
              const isSelected = selectedType === id;
              
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected
                  ]}
                  onPress={() => handleTypeSelect(id)}
                >
                  <View style={styles.categoryIconContainer}>
                    {(() => {
                      // Fallback to icon if no illustration
                      return (
                        <View style={[
                          styles.categoryIcon,
                          isSelected && styles.categoryIconSelected
                        ]}>
                          <MaterialCommunityIcons
                            name={getCanonicalCategoryIconName(id) as any}
                            size={24}
                            color={getCanonicalCategoryColor(id)}
                          />
                        </View>
                      );
                    })()}
                  </View>
                  <Text style={[
                    styles.categoryName,
                    isSelected && styles.categoryNameSelected
                  ]}>
                    {t('categoriesCanonical.' + id, id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Resistance Slider - New Design */}
          <View style={styles.resistanceSection}>
            <View style={styles.resistanceHeader}>
              <Text style={styles.resistanceTitle}>Direnç Gücü</Text>
              <View style={styles.resistanceIndicator}>
                <Text style={styles.resistanceEmoji}>
                  {getResistanceEmoji(resistanceLevel)}
                </Text>
                <Text style={styles.resistanceValue}>
                  {resistanceLevel}/10
                </Text>
              </View>
            </View>
            
            {/* Plus/Minus Controls */}
            <View style={styles.resistanceControls}>
              <Pressable
                style={[styles.resistanceButton, resistanceLevel <= 1 && styles.resistanceButtonDisabled]}
                onPress={() => {
                  if (resistanceLevel > 1) {
                    setResistanceLevel(resistanceLevel - 1);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                disabled={resistanceLevel <= 1}
              >
                <MaterialCommunityIcons name="minus" size={20} color={resistanceLevel <= 1 ? '#D1D5DB' : '#6B7280'} />
              </Pressable>
              
              <View style={styles.resistanceButtonSpacer} />
              
              <Pressable
                style={[styles.resistanceButton, resistanceLevel >= 10 && styles.resistanceButtonDisabled]}
                onPress={() => {
                  if (resistanceLevel < 10) {
                    setResistanceLevel(resistanceLevel + 1);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                disabled={resistanceLevel >= 10}
              >
                <MaterialCommunityIcons name="plus" size={20} color={resistanceLevel >= 10 ? '#D1D5DB' : '#6B7280'} />
              </Pressable>
            </View>
            
            {/* Custom Slider */}
            <View style={styles.sliderContainer}>
              <Pressable
                style={styles.sliderTrack}
                onPress={handleSliderPress}
              >
                <View 
                  style={[
                    styles.sliderProgress,
                    { 
                      width: `${getResistanceProgress(resistanceLevel)}%`,
                      backgroundColor: getResistanceColor(resistanceLevel)
                    }
                  ]} 
                />
                <View
                  style={[
                    styles.sliderThumb,
                    { 
                      left: `${getResistanceProgress(resistanceLevel) - 3}%`,
                      backgroundColor: getResistanceColor(resistanceLevel)
                    }
                  ]}
                />
              </Pressable>
            </View>
            
            <View style={styles.resistanceLabels}>
              <Text style={styles.resistanceLabel}>Düşük</Text>
              <Text style={styles.resistanceLabel}>Orta</Text>
              <Text style={styles.resistanceLabel}>Yüksek</Text>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Not (İsteğe bağlı)</Text>
            <View style={styles.notesInputContainer}>
              <TextInput
                style={styles.notesInput}
                placeholder="Tetikleyen durum veya düşünceler..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                maxLength={200}
              />
              <Text style={styles.charCount}>{notes.length}/200</Text>
            </View>
          </View>

          {/* Trigger Input with AI Auto-Detection */}
          <View style={styles.triggerSection}>
            <View style={styles.triggerHeader}>
              <Text style={styles.triggerTitle}>🎯 Tetikleyici</Text>
              {isDetectingTriggers && (
                <View style={styles.detectingIndicator}>
                  <MaterialCommunityIcons name="loading" size={16} color="#059669" />
                  <Text style={styles.detectingText}>Analiz ediliyor...</Text>
                </View>
              )}
            </View>
            
            <View style={styles.triggerInputContainer}>
              <TextInput
                style={styles.triggerInput}
                value={trigger}
                onChangeText={setTrigger}
                placeholder="Ne tetikledi bu kompülsiyonu?"
                placeholderTextColor="#9CA3AF"
                maxLength={200}
              />
            </View>

            {/* Suggested Triggers */}
            {suggestedTriggers.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>💡 AI Önerileri:</Text>
                <View style={styles.suggestionsList}>
                  {suggestedTriggers.map((suggestion, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.suggestionChip,
                        trigger === suggestion && styles.suggestionChipSelected
                      ]}
                      onPress={() => {
                        setTrigger(suggestion);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <MaterialCommunityIcons 
                        name={trigger === suggestion ? "check" : "plus"} 
                        size={12} 
                        color={trigger === suggestion ? "#FFFFFF" : "#059669"} 
                      />
                      <Text style={[
                        styles.suggestionText,
                        trigger === suggestion && styles.suggestionTextSelected
                      ]}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={styles.cancelButton}
            onPress={onDismiss}
          >
            <Text style={styles.cancelButtonText}>İptal</Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.submitButton,
              (!selectedType || isSubmitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!selectedType || isSubmitting}
          >
            {isSubmitting ? (
              <Text style={styles.submitButtonText}>Kaydediliyor...</Text>
            ) : (
              <Text style={styles.submitButtonText}>Kaydet</Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Header Section
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
  },

  // Categories Grid - Optimized Mobile Layout
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 90,
  },
  categoryCardSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  categoryIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryIconSelected: {
    backgroundColor: '#FFFFFF',
  },
  categoryNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  categoryName: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 14,
    flexWrap: 'wrap',
  },
  categoryNameSelected: {
    color: '#047857',
    fontWeight: '600',
  },

  // Resistance Section
  resistanceSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  resistanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  resistanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resistanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resistanceEmoji: {
    fontSize: 28,
  },
  resistanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  
  // Plus/Minus Controls
  resistanceControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resistanceButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resistanceButtonDisabled: {
    opacity: 0.3,
  },
  resistanceButtonSpacer: {
    flex: 1,
  },
  
  // Custom Slider
  sliderContainer: {
    marginBottom: 8,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    position: 'relative',
  },
  sliderProgress: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    top: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  resistanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  resistanceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },

  // Notes Section
  notesSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  notesInputContainer: {
    position: 'relative',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },

  // Trigger Detection Styles
  triggerSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  triggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  triggerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  detectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detectingText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 4,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  triggerInputContainer: {
    position: 'relative',
  },
  triggerInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
    minHeight: 44,
  },
  suggestionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginRight: 6,
    marginBottom: 4,
  },
  suggestionChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  suggestionText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 4,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  suggestionTextSelected: {
    color: '#FFFFFF',
  },

  // Severity Section Styles
  severitySection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  severityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  severityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  severityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityEmoji: {
    fontSize: 28,
  },
  severityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  severityControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  severityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityDisplayValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#EF4444',
    fontFamily: 'Inter',
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  severityLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },

  // Action Buttons
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});

export default CompulsionQuickEntry;