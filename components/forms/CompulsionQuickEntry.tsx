import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Slider } from '@/components/ui/Slider';
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';
import { CompulsionEntry } from '@/types/compulsion';
import { useGamificationStore } from '@/store/gamificationStore';

interface CompulsionQuickEntryProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (entry: Omit<CompulsionEntry, 'id' | 'timestamp'>) => void;
}

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
  const { awardMicroReward } = useGamificationStore();

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

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const entry = {
      type: selectedType,
      resistanceLevel,
      duration: 0,
      intensity: resistanceLevel,
      triggers: [],
      notes: notes.trim(),
    };

    // Save as last compulsion
    await AsyncStorage.setItem('lastCompulsion', JSON.stringify(entry));
    
    // Add to recent compulsions
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
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getResistanceColor = (level: number) => {
    if (level <= 3) return '#EF4444';
    if (level <= 6) return '#F59E0B';
    return '#10B981';
  };

  const getResistanceEmoji = (level: number) => {
    if (level <= 3) return '😰';
    if (level <= 6) return '😐';
    return '💪';
  };

  return (
    <BottomSheet
      isVisible={visible}
      onClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hızlı Kayıt</Text>
          <Text style={styles.subtitle}>
            Kompulsiyonunu kaydet ve direnç gücünü belirle
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kompulsiyon Tipi</Text>
            
            {/* Frequent Types */}
            {frequentTypes.length > 0 && (
              <View style={styles.frequentSection}>
                <Text style={styles.frequentLabel}>Sık yaşadıkların:</Text>
                <View style={styles.frequentTypes}>
                  {frequentTypes.map((typeId) => {
                    const category = COMPULSION_CATEGORIES.find(c => c.id === typeId);
                    if (!category) return null;
                    
                    return (
                      <Pressable
                        key={typeId}
                        style={[
                          styles.frequentChip,
                          selectedType === typeId && styles.frequentChipSelected
                        ]}
                        onPress={() => handleTypeSelect(typeId)}
                      >
                        <MaterialCommunityIcons
                          name={category.icon as any}
                          size={16}
                          color={selectedType === typeId ? '#FFFFFF' : '#10B981'}
                        />
                        <Text style={[
                          styles.frequentChipText,
                          selectedType === typeId && styles.frequentChipTextSelected
                        ]}>
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* All Categories Grid */}
            <View style={styles.categoriesGrid}>
              {COMPULSION_CATEGORIES.map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    selectedType === category.id && styles.categoryCardSelected
                  ]}
                  onPress={() => handleTypeSelect(category.id)}
                >
                  <View style={[
                    styles.categoryIcon,
                    selectedType === category.id && styles.categoryIconSelected
                  ]}>
                    <MaterialCommunityIcons
                      name={category.icon as any}
                      size={24}
                      color={selectedType === category.id ? '#FFFFFF' : '#10B981'}
                    />
                  </View>
                  <Text style={[
                    styles.categoryName,
                    selectedType === category.id && styles.categoryNameSelected
                  ]}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Resistance Slider */}
          <View style={styles.section}>
            <View style={styles.resistanceHeader}>
              <Text style={styles.sectionTitle}>Direnç Gücü</Text>
              <View style={styles.resistanceIndicator}>
                <Text style={styles.resistanceEmoji}>
                  {getResistanceEmoji(resistanceLevel)}
                </Text>
                <Text style={[
                  styles.resistanceValue,
                  { color: getResistanceColor(resistanceLevel) }
                ]}>
                  {resistanceLevel}/10
                </Text>
              </View>
            </View>
            
            <Slider
              value={resistanceLevel}
              onValueChange={setResistanceLevel}
              minimumValue={1}
              maximumValue={10}
              step={1}
              minimumTrackTintColor={getResistanceColor(resistanceLevel)}
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor={getResistanceColor(resistanceLevel)}
            />
            
            <View style={styles.resistanceLabels}>
              <Text style={styles.resistanceLabel}>Düşük</Text>
              <Text style={styles.resistanceLabel}>Orta</Text>
              <Text style={styles.resistanceLabel}>Yüksek</Text>
            </View>
          </View>

          {/* Optional Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Not (İsteğe bağlı)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Tetikleyen durum veya düşünceler..."
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={styles.charCount}>{notes.length}/200</Text>
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
              !selectedType && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!selectedType}
          >
            <Text style={styles.submitButtonText}>Kaydet</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  frequentSection: {
    marginBottom: 16,
  },
  frequentLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  frequentTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    gap: 4,
  },
  frequentChipSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  frequentChipText: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter',
  },
  frequentChipTextSelected: {
    color: '#FFFFFF',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIconSelected: {
    backgroundColor: '#10B981',
  },
  categoryName: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  categoryNameSelected: {
    color: '#10B981',
    fontWeight: '600',
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
    fontSize: 24,
  },
  resistanceValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter',
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
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});