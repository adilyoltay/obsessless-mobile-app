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

// Exercise Type Definitions with category previews
const EXERCISE_TYPES = [
  {
    id: 'real_life',
    title: '🌱 Nazik Adımlar',
    subtitle: 'Kendi hızında ilerle',
    description: 'Günlük yaşamda küçük cesaret adımları at',
    preview: 'Temizlik, Kontrol, Düzenleme kategorileri',
    icon: 'sprout',
    color: '#10B981',
  },
  {
    id: 'imagination',
    title: '🦋 İç Yolculuk',
    subtitle: 'Güvenli bir alanda keşfet',
    description: 'Hayal gücünle nazikçe duygularını tanı',
    preview: 'Zihinsel senaryolar ve düşünce egzersizleri',
    icon: 'meditation',
    color: '#8B5CF6',
  },
  {
    id: 'interoceptive',
    title: '💙 Beden Farkındalığı',
    subtitle: 'Nefesine odaklan',
    description: 'Bedenindeki hisleri gözlemle ve kabul et',
    preview: 'Nefes, kalp atışı ve bedensel his egzersizleri',
    icon: 'heart-outline',
    color: '#3B82F6',
  },
  {
    id: 'response_prevention',
    title: '🌟 Seçim Özgürlüğü',
    subtitle: 'Yeni tepkiler dene',
    description: 'Alışkanlıklarından farklı seçimler yapma fırsatı',
    preview: 'Kompulsiyonlara alternatif davranış geliştirme',
    icon: 'star-outline',
    color: '#F59E0B',
  },
];

export function ERPQuickStart({
  visible,
  onDismiss,
  onExerciseSelect,
  exercises,
}: ERPQuickStartProps) {
  const [wizardStep, setWizardStep] = useState<'selection' | 'settings'>('selection');
  const [selectedType, setSelectedType] = useState<string>('');
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
    setWizardStep('selection');
    setSelectedType('');
    setSelectedCategory('');
    setSelectedExercise(null);
    setDuration(10);
    setTargetAnxiety(5); // Default to middle
    setPersonalGoal('');
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    // Auto-advance to settings after type selection
    setWizardStep('settings');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleThemeSelect = (category: string, exercise: ERPExercise) => {
    setSelectedCategory(category);
    setSelectedExercise(exercise);
    setDuration(exercise.duration);
    // Stay in settings step to configure duration and goal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    // Not needed in 2-step flow, but keeping for compatibility
  };

  const handleStartExercise = () => {
    if (!selectedExercise) return;

    const config: ERPExerciseConfig = {
      exerciseId: selectedExercise.id,
      exerciseType: selectedType as any,
      duration: duration,
      targetAnxiety: targetAnxiety,
      personalGoal: personalGoal,
      selectedExercise: selectedExercise,
    };

    // Save last exercise preferences
    AsyncStorage.setItem('lastERPExercise', selectedExercise.id);
    AsyncStorage.setItem('lastERPType', selectedType);
    AsyncStorage.setItem('lastERPDuration', duration.toString());

    onExerciseSelect(config);
    onDismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleBack = () => {
    if (wizardStep === 'settings') {
      setWizardStep('selection');
    }
  };

  const getStepTitle = () => {
    switch (wizardStep) {
      case 'selection': return 'Hangi yolculuğu seçmek istiyorsun?';
      case 'settings': return 'Bugün için nasıl hissediyorsun?';
      default: return 'İyileşme Yolculuğun';
    }
  };

  const getStepSubtitle = () => {
    switch (wizardStep) {
      case 'selection': return 'Kendine en uygun olan yaklaşımı seç. Her seçim doğru seçimdir.';
      case 'settings': return 'Bu değerleri istediğin zaman değiştirebilirsin. Kendini zorlamana gerek yok.';
      default: return '';
    }
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

  const renderTypeSelection = () => (
    <ScrollView style={styles.wizardContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instructionText}>
        {getStepSubtitle()}
      </Text>
      
      <View style={styles.typeGrid}>
        {EXERCISE_TYPES.map((type) => (
          <Pressable
            key={type.id}
            style={[
              styles.typeCard,
              selectedType === type.id && { backgroundColor: `${type.color}08`, borderColor: type.color }
            ]}
            onPress={() => handleTypeSelect(type.id)}
          >
            <View style={[styles.typeIconContainer, { backgroundColor: `${type.color}15` }]}>
              <MaterialCommunityIcons name={type.icon as any} size={28} color={type.color} />
            </View>
            <Text style={styles.typeTitle}>{type.title}</Text>
            <Text style={styles.typeSubtitle}>{type.subtitle}</Text>
          </Pressable>
        ))}
      </View>
      
      <View style={styles.helpSection}>
        <Text style={styles.helpText}>
          💫 Hangi yolu seçersen seç, istediğin zaman değiştirebilirsin
        </Text>
      </View>
    </ScrollView>
  );

  const renderDurationSettings = () => (
    <ScrollView style={styles.wizardContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instructionText}>
        {getStepSubtitle()}
      </Text>
      
      {/* Compact Category Grid - Always visible */}
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
                // Auto-select first exercise in category
                const firstExercise = category.exercises[0];
                if (firstExercise) {
                  setSelectedExercise(firstExercise);
                  setDuration(firstExercise.duration);
                }
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

      {/* Exercise Selection - Only show when category is selected */}
      {selectedCategory && selectedExercise && (
        <View style={styles.exerciseQuickSection}>
          <Text style={styles.sectionTitle}>Seçili Egzersiz</Text>
          <View style={styles.selectedExerciseCard}>
            <View style={styles.exerciseHeader}>
              <View>
                <Text style={styles.selectedExerciseName}>{selectedExercise.name}</Text>
                <Text style={styles.selectedExerciseCategory}>
                  {getCategoriesByPopularity().find(c => c.id === selectedCategory)?.title}
                </Text>
              </View>
              <Pressable 
                style={styles.changeExerciseButton}
                onPress={() => {
                  setSelectedCategory('');
                  setSelectedExercise(null);
                }}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#10B981" />
              </Pressable>
            </View>
          </View>

          {/* Compact Settings Row */}
          <View style={styles.settingsRow}>
            <View style={styles.compactSetting}>
              <Text style={styles.compactSettingLabel}>Süre</Text>
              <View style={styles.compactSliderContainer}>
                <Slider
                  value={duration}
                  onValueChange={setDuration}
                  minimumValue={3}
                  maximumValue={30}
                  step={1}
                  style={styles.compactSlider}
                  minimumTrackTintColor="#10B981"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#10B981"
                />
                <Text style={styles.compactSliderValue}>{duration}dk</Text>
              </View>
            </View>

            <View style={styles.compactSetting}>
              <Text style={styles.compactSettingLabel}>Anksiyete</Text>
              <View style={styles.compactSliderContainer}>
                <Slider
                  value={targetAnxiety}
                  onValueChange={setTargetAnxiety}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  style={styles.compactSlider}
                  minimumTrackTintColor="#F59E0B"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#F59E0B"
                />
                <Text style={styles.compactSliderValue}>{targetAnxiety}/10</Text>
              </View>
            </View>
          </View>

          {/* Start Button */}
          <Pressable style={styles.startButton} onPress={handleStartExercise}>
            <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>🌟 Yolculuğumu Başlat</Text>
          </Pressable>
        </View>
      )}

      {/* Gentle Comfort Reminder - Always at bottom */}
      <View style={styles.comfortSection}>
        <Text style={styles.comfortTitle}>🌸 Nazik Hatırlatma</Text>
        <Text style={styles.comfortText}>
          • Sen her zaman kontroldesin{'\n'}
          • İstediğin her an duraklayabilir ve nefes alabilirsin{'\n'}
          • Bu senin güvenli alanın, burası sadece keşif için{'\n'}
          • Hissettiğin her şey doğal ve geçici
        </Text>
      </View>
    </ScrollView>
  );

  const renderConfirmation = () => (
    <ScrollView style={styles.wizardContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instructionText}>
        {getStepSubtitle()}
      </Text>
      
      <View style={styles.confirmationCard}>
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Egzersiz Tipi:</Text>
          <Text style={styles.confirmationValue}>
            {EXERCISE_TYPES.find(t => t.id === selectedType)?.title}
          </Text>
        </View>
        
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Egzersiz:</Text>
          <Text style={styles.confirmationValue}>{selectedExercise?.name}</Text>
        </View>
        
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Süre:</Text>
          <Text style={styles.confirmationValue}>{duration} dakika</Text>
        </View>
        
        <View style={styles.confirmationRow}>
          <Text style={styles.confirmationLabel}>Başlangıç Anksiyete:</Text>
          <Text style={styles.confirmationValue}>{targetAnxiety}/10</Text>
        </View>
        
        {personalGoal ? (
          <View style={styles.confirmationRow}>
            <Text style={styles.confirmationLabel}>Hedef:</Text>
            <Text style={styles.confirmationValue}>{personalGoal}</Text>
          </View>
        ) : null}
      </View>

      {/* Gentle Comfort Reminder */}
      <View style={styles.comfortSection}>
        <Text style={styles.comfortTitle}>🌸 Nazik Hatırlatma</Text>
        <Text style={styles.comfortText}>
          • Sen her zaman kontroldesin{'\n'}
          • İstediğin her an duraklayabilir ve nefes alabilirsin{'\n'}
          • Bu senin güvenli alanın, burası sadece keşif için{'\n'}
          • Hissettiğin her şey doğal ve geçici
        </Text>
      </View>

      <Pressable style={styles.startButton} onPress={handleStartExercise}>
        <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
        <Text style={styles.startButtonText}>Egzersizi Başlat</Text>
      </Pressable>
    </ScrollView>
  );

  const renderContent = () => {
    switch (wizardStep) {
      case 'selection': return renderTypeSelection();
      case 'settings': return renderDurationSettings();
      default: return null;
    }
  };

  return (
    <BottomSheet isVisible={visible} onClose={onDismiss}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {wizardStep !== 'selection' && (
              <Pressable style={styles.backButton} onPress={handleBack}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#6B7280" />
              </Pressable>
            )}
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

        {/* Progress Indicators */}
        <View style={styles.progressContainer}>
          {['selection', 'settings'].map((step, index) => (
            <View
              key={step}
              style={[
                styles.progressDot,
                step === wizardStep && styles.progressDotActive,
                ['selection', 'settings'].indexOf(wizardStep) > index && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>

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
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Inter-Medium',
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
}); 