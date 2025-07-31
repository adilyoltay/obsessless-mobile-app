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

// Exercise Type Definitions
const EXERCISE_TYPES = [
  {
    id: 'real_life',
    title: '🌱 Nazik Adımlar',
    subtitle: 'Kendi hızında ilerle',
    description: 'Günlük yaşamda küçük cesaret adımları at',
    icon: 'sprout',
    color: '#10B981',
  },
  {
    id: 'imagination',
    title: '🦋 İç Yolculuk',
    subtitle: 'Güvenli bir alanda keşfet',
    description: 'Hayal gücünle nazikçe duygularını tanı',
    icon: 'meditation',
    color: '#8B5CF6',
  },
  {
    id: 'interoceptive',
    title: '💙 Beden Farkındalığı',
    subtitle: 'Nefesine odaklan',
    description: 'Bedenindeki hisleri gözlemle ve kabul et',
    icon: 'heart-outline',
    color: '#3B82F6',
  },
  {
    id: 'response_prevention',
    title: '🌟 Seçim Özgürlüğü',
    subtitle: 'Yeni tepkiler dene',
    description: 'Alışkanlıklarından farklı seçimler yapma fırsatı',
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
              { borderColor: type.color },
              selectedType === type.id && { backgroundColor: `${type.color}10` }
            ]}
            onPress={() => handleTypeSelect(type.id)}
          >
            <View style={[styles.typeIconContainer, { backgroundColor: type.color }]}>
              <MaterialCommunityIcons name={type.icon as any} size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.typeTitle}>{type.title}</Text>
            <Text style={styles.typeSubtitle}>{type.subtitle}</Text>
            <Text style={styles.typeDescription}>{type.description}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderDurationSettings = () => (
    <ScrollView style={styles.wizardContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instructionText}>
        {getStepSubtitle()}
      </Text>
      
      {/* Exercise Selection - Only show exercises for selected type */}
      {!selectedExercise && (
        <View style={styles.exerciseSelectionSection}>
          <Text style={styles.sectionTitle}>Egzersizini Seç</Text>
          {getFilteredCategories().map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <MaterialCommunityIcons 
                  name={category.icon as any} 
                  size={20} 
                  color={category.color} 
                />
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>
              
              {category.exercises.map((exercise: ERPExercise) => (
                <Pressable
                  key={exercise.id}
                  style={[
                    styles.exerciseItem,
                    selectedExercise?.id === exercise.id && styles.exerciseItemSelected
                  ]}
                  onPress={() => handleThemeSelect(category.id, exercise)}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <View style={styles.exerciseMeta}>
                      <Text style={styles.exerciseDuration}>{exercise.duration} dk</Text>
                      <View style={styles.difficultyContainer}>
                        {Array.from({ length: exercise.difficulty }).map((_, i) => (
                          <MaterialCommunityIcons key={i} name="star" size={12} color="#F59E0B" />
                        ))}
                      </View>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Settings - Only show when exercise is selected */}
      {selectedExercise && (
        <>
          <View style={styles.selectedExerciseCard}>
            <Text style={styles.selectedExerciseTitle}>Seçilen Egzersiz</Text>
            <Text style={styles.selectedExerciseName}>{selectedExercise.name}</Text>
            <Pressable 
              style={styles.changeExerciseButton}
              onPress={() => setSelectedExercise(null)}
            >
              <Text style={styles.changeExerciseText}>Değiştir</Text>
            </Pressable>
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.settingLabel}>Süre</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{duration} dakika</Text>
              <Slider
                value={duration}
                onValueChange={setDuration}
                minimumValue={3}
                maximumValue={60}
                step={1}
                style={styles.slider}
                minimumTrackTintColor="#10B981"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#10B981"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>3 dk</Text>
                <Text style={styles.sliderLabel}>60 dk</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.settingLabel}>Başlangıç Anksiyeten</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{targetAnxiety}/10</Text>
              <Slider
                value={targetAnxiety}
                onValueChange={setTargetAnxiety}
                minimumValue={1}
                maximumValue={10}
                step={1}
                style={styles.slider}
                minimumTrackTintColor="#F59E0B"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#F59E0B"
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>Düşük</Text>
                <Text style={styles.sliderLabel}>Yoğun</Text>
              </View>
            </View>
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.settingLabel}>Bu egzersiz için hedefin ne?</Text>
            <TextInput
              style={styles.goalInput}
              value={personalGoal}
              onChangeText={setPersonalGoal}
              placeholder={getSmartDefaults(selectedType).goal}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable style={styles.nextButton} onPress={handleStartExercise}>
            <Text style={styles.nextButtonText}>🌟 Yolculuğumu Başlat</Text>
          </Pressable>
        </>
      )}
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

      {/* Safety Checklist */}
      <View style={styles.safetySection}>
        <Text style={styles.safetyTitle}>🛡️ Güvenlik Hatırlatması</Text>
        <Text style={styles.safetyText}>
          • Kendinizi güvende hissettiğiniz bir yerde olun{'\n'}
          • İstediğiniz zaman duraklatabilirsiniz{'\n'}
          • Bu sadece bir egzersiz, gerçek tehlike yok{'\n'}
          • Anksiyetenin yükselmesi normaldir
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
    gap: 16,
  },
  typeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter-Medium',
  },
  typeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
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
  safetySection: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  safetyText: {
    fontSize: 13,
    color: '#92400E',
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
}); 