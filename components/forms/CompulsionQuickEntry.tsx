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
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';
import { Compulsion } from '@/types/compulsion';
import { useGamificationStore } from '@/store/gamificationStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService, { CompulsionRecord } from '@/services/supabase';

interface CompulsionQuickEntryProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (entry: any) => void;
}

const { width } = Dimensions.get('window');

// Top featured categories removed - using only grid layout

export function CompulsionQuickEntry({
  visible,
  onDismiss,
  onSubmit,
}: CompulsionQuickEntryProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [resistanceLevel, setResistanceLevel] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [lastCompulsion, setLastCompulsion] = useState<any | null>(null);
  const [frequentTypes, setFrequentTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const { awardMicroReward } = useGamificationStore();
  const { user } = useAuth();

  useEffect(() => {
    if (visible) {
      loadSmartData();
      awardMicroReward('compulsion_quick_entry');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      // Reset form when closed
      setSelectedType('');
      setResistanceLevel(5);
      setNotes('');
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

      const compulsionData: Omit<CompulsionRecord, 'id' | 'timestamp'> = {
        user_id: user.id,
        category: selectedType,
        subcategory: selectedType, // koru: orijinal etiket
        resistance_level: resistanceLevel,
        notes: notes.trim() || undefined,
      };

      // Create entry for callbacks
      const entry = {
        type: selectedType,
        resistanceLevel,
        notes: notes.trim(),
      };

      // Save to Supabase first
      const savedCompulsion = await supabaseService.createCompulsion(compulsionData);
      
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

          {/* Categories Grid - Optimized Mobile Layout */}
          <View style={styles.categoriesGrid}>
            {COMPULSION_CATEGORIES.map((category) => {
              const isSelected = selectedType === category.id;
              
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected
                  ]}
                  onPress={() => handleTypeSelect(category.id)}
                >
                  <View style={[
                    styles.categoryIcon,
                    isSelected && styles.categoryIconSelected
                  ]}>
                    {category.id === 'counting' ? (
                      <Text style={[
                        styles.categoryNumber,
                        { color: isSelected ? '#10B981' : '#10B981' }
                      ]}>
                        123
                      </Text>
                    ) : (
                      <MaterialCommunityIcons
                        name={category.icon as any}
                        size={24}
                        color={isSelected ? '#10B981' : '#10B981'}
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.categoryName,
                    isSelected && styles.categoryNameSelected
                  ]}>
                    {category.name}
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