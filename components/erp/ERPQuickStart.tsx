import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Slider } from '@/components/ui/Slider';
import { useGamificationStore } from '@/store/gamificationStore';
import { ERPExercise, ERP_CATEGORIES, ERPCategory } from '@/constants/erpCategories';

interface ERPQuickStartProps {
  visible: boolean;
  onDismiss: () => void;
  onExerciseSelect: (exerciseConfig: ERPExerciseConfig) => void;
  exercises: ERPExercise[];
}

interface ERPExerciseConfig {
  exerciseId: string;
  exerciseType: 'real_life' | 'imagination' | 'interoceptive' | 'response_prevention';
  duration: number; // minutes
  targetAnxiety: number; // 1-10
  personalGoal: string;
  selectedExercise: ERPExercise;
}

// Simplified to 2-step flow: Category → Exercise + Settings

export function ERPQuickStart({
  visible,
  onDismiss,
  onExerciseSelect,
  exercises,
}: ERPQuickStartProps) {
  // Simplified to single step - directly show categories
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<ERPExercise | null>(null);
  const [duration, setDuration] = useState<number>(10); // minutes
  const [targetAnxiety, setTargetAnxiety] = useState<number>(5); // Default to middle
  const [personalGoal, setPersonalGoal] = useState<string>('');
  
  const { awardMicroReward } = useGamificationStore();

  useEffect(() => {
    if (visible) {
      awardMicroReward('erp_wizard_start');
      resetWizard();
    }
  }, [visible]);

  const resetWizard = () => {
    setSelectedCategory('');
    setSelectedExercise(null);
    setDuration(10);
    setTargetAnxiety(5); // Default to middle
    setPersonalGoal('');
  };

  const handleStartExercise = () => {
    if (!selectedExercise) return;

    const config: ERPExerciseConfig = {
      exerciseId: selectedExercise.id,
      exerciseType: 'real_life', // Default type since we removed type selection
      duration: duration,
      targetAnxiety: targetAnxiety,
      personalGoal: personalGoal,
      selectedExercise: selectedExercise,
    };

    // Save last exercise preferences
    AsyncStorage.setItem('lastERPExercise', selectedExercise.id);
    AsyncStorage.setItem('lastERPType', 'real_life');
    AsyncStorage.setItem('lastERPDuration', duration.toString());

    onExerciseSelect(config);
    onDismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getStepTitle = () => {
    if (selectedCategory && !selectedExercise) {
      const categoryName = getCategoriesByPopularity().find(c => c.id === selectedCategory)?.title;
      return `${categoryName} Egzersizleri`;
    }
    if (selectedExercise) {
      return 'Egzersiz Ayarları';
    }
    return 'Egzersizini Seç ve Başla';
  };

  const getStepSubtitle = () => {
    if (selectedCategory && !selectedExercise) {
      return 'Hangi egzersizi yapmak istiyorsun?';
    }
    if (selectedExercise) {
      return 'Süre ve hedef anksiyete seviyeni ayarla.';
    }
    return 'Kategori seç, egzersizini belirle ve hemen başla.';
  };

  // Filter exercises by selected type logic
  const getFilteredCategories = (): ERPCategory[] => {
    // For now, return all categories - can be enhanced based on exercise type
    return ERP_CATEGORIES;
  };

  // Get categories sorted by popularity (most used first)
  const getCategoriesByPopularity = (): ERPCategory[] => {
    // Define popularity order (can be enhanced with real usage data later)
    const popularityOrder = [
      'contamination',   // En sık kullanılan
      'checking',        // 2. sık kullanılan
      'ordering',        // 3. sık kullanılan
      'harm',           // 4. sık kullanılan  
      'morality',       // 5. sık kullanılan
      'sexual',         // 6. sık kullanılan
    ];
    
    return ERP_CATEGORIES.sort((a, b) => {
      const aIndex = popularityOrder.indexOf(a.id);
      const bIndex = popularityOrder.indexOf(b.id);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  };

  const getSmartDefaults = (exerciseType: string) => {
    const goalTemplates = {
      'real_life': 'Bugün kendime nazik davranarak küçük bir adım atmak istiyorum',
      'imagination': 'Duygularımı güvenli bir şekilde keşfetmek ve anlamak istiyorum', 
      'interoceptive': 'Bedenimle bağlantı kurarak huzur bulmak istiyorum',
      'response_prevention': 'Farklı seçimler yaparak kendimi güçlü hissetmek istiyorum'
    };
    
    return {
      goal: goalTemplates[exerciseType as keyof typeof goalTemplates] || goalTemplates['real_life'],
      anxiety: 5, // Ortadan başla
      duration: 8  // Daha kısa varsayılan
    };
  };

  const renderContent = () => {
    return renderCategoryGrid();
  };

  const renderCategoryGrid = () => (
    <ScrollView style={styles.wizardContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instructionText}>
        {getStepSubtitle()}
      </Text>
      
      {/* Category Grid - Only show when no category is selected */}
      {!selectedCategory && (
        <View style={styles.categoryGridSection}>
          <Text style={styles.sectionTitle}>Kategorini Seç</Text>
          <View style={styles.categoryGrid}>
            {getCategoriesByPopularity().map((category) => (
              <Pressable
                key={category.id}
                style={[
                  styles.categoryGridCard,
                  selectedCategory === category.id && { borderColor: category.color, backgroundColor: `${category.color}08` }
                ]}
                onPress={() => {
                  setSelectedCategory(category.id);
                  // Don't auto-select exercise, let user choose from grid
                  setSelectedExercise(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={[styles.categoryIconContainer, { backgroundColor: `${category.color}15` }]}>
                  <MaterialCommunityIcons 
                    name={category.icon as any} 
                    size={24} 
                    color={category.color} 
                  />
                </View>
                <Text style={styles.categoryGridTitle}>{category.title}</Text>
                <Text style={styles.categoryExerciseCount}>
                  {category.exercises.length} egzersiz
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Exercise Selection - Show when category is selected */}
      {selectedCategory && (
        <View style={styles.exerciseSelectionSection}>
          <Text style={styles.sectionTitle}>
            {getCategoriesByPopularity().find(c => c.id === selectedCategory)?.title} Egzersizleri
          </Text>
          
          {/* Exercise Grid */}
          <View style={styles.exerciseGrid}>
            {getCategoriesByPopularity()
              .find(c => c.id === selectedCategory)
              ?.exercises.map((exercise: ERPExercise) => (
                <Pressable
                  key={exercise.id}
                  style={[
                    styles.exerciseGridCard,
                    selectedExercise?.id === exercise.id && styles.exerciseGridCardSelected
                  ]}
                  onPress={() => {
                    setSelectedExercise(exercise);
                    setDuration(exercise.duration);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.exerciseCardContent}>
                    <Text style={styles.exerciseCardTitle} numberOfLines={2}>
                      {exercise.name}
                    </Text>
                    <View style={styles.exerciseCardFooter}>
                      <Text style={styles.exerciseCardDuration}>{exercise.duration}dk</Text>
                      <View style={styles.exerciseCardDifficulty}>
                        {Array.from({ length: exercise.difficulty }).map((_, i) => (
                          <MaterialCommunityIcons key={i} name="star" size={10} color="#F59E0B" />
                        ))}
                      </View>
                    </View>
                  </View>
                  {selectedExercise?.id === exercise.id && (
                    <View style={styles.selectedIndicator}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                    </View>
                  )}
                </Pressable>
              ))}
          </View>

          {/* Settings Section - Show when exercise is selected */}
          {selectedExercise && (
            <View style={styles.inlineSettingsSection}>
              <Text style={styles.settingsTitle}>Egzersiz Ayarları</Text>
              
              {/* Duration Setting */}
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Süre: {duration} dakika</Text>
                <Slider
                  value={duration}
                  onValueChange={setDuration}
                  minimumValue={3}
                  maximumValue={30}
                  step={1}
                  style={styles.settingSlider}
                  minimumTrackTintColor="#10B981"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#10B981"
                />
              </View>

              {/* Anxiety Setting */}
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Hedef Anksiyete: {targetAnxiety}/10</Text>
                <Slider
                  value={targetAnxiety}
                  onValueChange={setTargetAnxiety}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  style={styles.settingSlider}
                  minimumTrackTintColor="#F59E0B"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#F59E0B"
                />
              </View>

              {/* Start Button */}
              <Pressable style={styles.inlineStartButton} onPress={handleStartExercise}>
                <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
                <Text style={styles.inlineStartButtonText}>🌟 Yolculuğumu Başlat</Text>
              </Pressable>
            </View>
          )}
          
          <Pressable 
            style={styles.backToCategoriesButton}
            onPress={() => {
              setSelectedCategory('');
              setSelectedExercise(null);
            }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#6B7280" />
            <Text style={styles.backToCategoriesText}>Kategorilere Geri Dön</Text>
          </Pressable>
        </View>
      )}

      {/* Gentle Comfort Reminder - Always at bottom */}
      {!selectedCategory && (
        <View style={styles.comfortSection}>
          <Text style={styles.comfortTitle}>🌸 Nazik Hatırlatma</Text>
          <Text style={styles.comfortText}>
            • Sen her zaman kontroldesin{'\n'}
            • İstediğin her an duraklayabilir ve nefes alabilirsin{'\n'}
            • Bu senin güvenli alanın, burası sadece keşif için{'\n'}
            • Hissettiğin her şey doğal ve geçici
          </Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <BottomSheet isVisible={visible} onClose={onDismiss}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* No back button needed in single step */}
          </View>
          
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{getStepTitle()}</Text>
          </View>
          
          <View style={styles.headerRight}>
            <Pressable style={styles.closeButton} onPress={onDismiss}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        {/* No progress indicators needed for single step */}

        {/* Content */}
        {renderContent()}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#10B981',
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: '#D1FAE5',
  },
  wizardContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: 'Inter',
  },
  typeGrid: {
    gap: 24,  // Increased spacing for calmness
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,  // More rounded for softness
    borderWidth: 1,    // Thinner border for gentleness
    borderColor: '#F3F4F6',  // Very light border
    padding: 24,       // More padding for breathing room
    alignItems: 'center',
    shadowColor: '#10B981',  // Gentle green shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,     // Very subtle shadow
    shadowRadius: 8,
    elevation: 2,
  },
  typeIconContainer: {
    width: 56,         // Larger for better visual impact
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,  // More space below icon
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,   // Slightly more space
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  typeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 20,
  },
  typeDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exerciseItemSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseDuration: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  settingSection: {
    marginBottom: 24,
  },
  sliderContainer: {
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter',
  },
  goalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 15,
    color: '#111827',
    fontFamily: 'Inter',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  nextButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  confirmationCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  confirmationLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    fontFamily: 'Inter',
  },
  confirmationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
    fontFamily: 'Inter-Medium',
  },
  comfortSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  comfortTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  comfortText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  startButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  exerciseSelectionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter-Medium',
  },
  selectedExerciseCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  selectedExerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  selectedExerciseName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Inter-Medium',
  },
  changeExerciseButton: {
    alignSelf: 'flex-end',
  },
  changeExerciseText: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter',
  },
  helpSection: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  categoryGridSection: {
    marginBottom: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryGridCard: {
    width: '48%', // Two columns
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryGridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  categoryExerciseCount: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  exerciseQuickSection: {
    marginBottom: 24,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedExerciseCategory: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  compactSetting: {
    flex: 1,
    marginHorizontal: 4,
  },
  compactSettingLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  compactSliderContainer: {
    alignItems: 'center',
  },
  compactSlider: {
    width: '100%',
    height: 40,
  },
  compactSliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
    fontFamily: 'Inter-Medium',
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  exerciseGridCard: {
    width: '48%', // Two columns
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  exerciseGridCardSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  exerciseCardContent: {
    flex: 1,
  },
  exerciseCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  exerciseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  exerciseCardDuration: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  exerciseCardDifficulty: {
    flexDirection: 'row',
    gap: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 4,
  },
  inlineSettingsSection: {
    marginTop: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter-Medium',
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  settingSlider: {
    width: '100%',
    height: 40,
  },
  inlineStartButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  inlineStartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  backToCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backToCategoriesText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginLeft: 8,
  },
}); 