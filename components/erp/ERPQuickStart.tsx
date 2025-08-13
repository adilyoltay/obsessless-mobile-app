import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useGamificationStore } from '@/store/gamificationStore';
import { ERPExercise, ERP_CATEGORIES, ERPCategory } from '@/constants/erpCategories';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { StorageKeys } from '@/utils/storage';
import { mapToCanonicalCategory } from '@/utils/categoryMapping';
import { useTranslation } from '@/hooks/useTranslation';

const { width } = Dimensions.get('window');

interface ERPQuickStartProps {
  visible: boolean;
  onDismiss: () => void;
  onExerciseSelect: (exerciseConfig: ERPExerciseConfig) => void;
  exercises: ERPExercise[];
}

interface ERPExerciseConfig {
  exerciseId: string;
  exerciseType: 'in_vivo' | 'imaginal' | 'interoceptive' | 'response_prevention';
  duration: number; // minutes
  targetAnxiety: number; // 1-10
  personalGoal: string;
  selectedExercise: ERPExercise;
  // Add category info for better tracking
  category: string;
  categoryName: string;
}

// Simplified to 2-step flow: Category → Exercise + Settings

export function ERPQuickStart({
  visible,
  onDismiss,
  onExerciseSelect,
  exercises,
}: ERPQuickStartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedExercise, setSelectedExercise] = useState<ERPExercise | null>(null);
  const [duration, setDuration] = useState<number>(10);
  const [targetAnxiety, setTargetAnxiety] = useState<number>(5);
  
  const { awardMicroReward } = useGamificationStore();
  const { user } = useAuth();
  const { t } = useTranslation();

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
    setTargetAnxiety(5);
  };

  const handleStartExercise = () => {
    console.log('🚀 handleStartExercise called');
    console.log('👤 Current user:', user);
    console.log('📋 Selected exercise:', selectedExercise);
    
    if (!selectedExercise) {
      console.error('❌ No exercise selected');
      return;
    }

    if (!user?.id) {
      console.error('❌ No user logged in');
      Alert.alert(
        'Giriş Yapın',
        'ERP egzersizi başlatmak için lütfen giriş yapın.',
        [{ text: 'Tamam' }]
      );
      return;
    }

    const categoryInfo = getCategoriesByPopularity().find(c => c.id === selectedCategory);
    const canonical = mapToCanonicalCategory(selectedCategory);

    const config: ERPExerciseConfig = {
      exerciseId: selectedExercise.id,
      exerciseType: 'in_vivo',
      duration: duration,
      targetAnxiety: targetAnxiety,
      personalGoal: `${selectedExercise.name} egzersizi ile kendimi güçlendirmek istiyorum`,
      selectedExercise: selectedExercise,
      category: canonical,
      categoryName: t('categoriesCanonical.' + canonical, categoryInfo?.title ?? 'Kategori'),
    };

    console.log('📦 Exercise config:', config);

    // Save last exercise preferences
    AsyncStorage.setItem(StorageKeys.LAST_ERP_EXERCISE(user.id), selectedExercise.id);
    AsyncStorage.setItem(`lastERPDuration_${user.id}`, duration.toString());
    AsyncStorage.setItem(`lastERPCategory_${user.id}`, selectedCategory);
    AsyncStorage.setItem(`lastERPTargetAnxiety_${user.id}`, targetAnxiety.toString());

    console.log('✅ Calling onExerciseSelect with config');
    onExerciseSelect(config);
    onDismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getPageTitle = () => {
    if (selectedCategory) {
      return getCategoriesByPopularity().find(c => c.id === selectedCategory)?.title || 'ERP Egzersizi';
    }
    return 'ERP Egzersizi';
  };

  const getPageSubtitle = () => {
    if (selectedCategory) {
      return 'Egzersiz seç ve ayarlarını belirle';
    }
    return 'Hangi alanda çalışmak istiyorsun?';
  };

  // Get categories sorted by popularity (most used first)
  const getCategoriesByPopularity = (): ERPCategory[] => {
    // Canonical order only
    const popularityOrder = [
      'contamination',
      'checking',
      'symmetry',
      'mental',
      'hoarding',
      'other',
    ];
    return ERP_CATEGORIES.sort((a, b) => {
      const aIndex = popularityOrder.indexOf(a.id);
      const bIndex = popularityOrder.indexOf(b.id);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  };

  // Duration slider için progress hesaplama
  const getDurationProgress = (duration: number) => {
    return ((duration - 3) / (30 - 3)) * 100;
  };

  // Anxiety slider için progress hesaplama  
  const getAnxietyProgress = (anxiety: number) => {
    return ((anxiety - 1) / (10 - 1)) * 100;
  };

  // Duration slider tıklama ile değiştirme
  const handleDurationSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const sliderWidth = width - 64; // padding hesaba katılarak
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = Math.round(3 + percentage * (30 - 3));
    setDuration(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Anxiety slider tıklama ile değiştirme
  const handleAnxietySliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const sliderWidth = width - 64; // padding hesaba katılarak
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = Math.round(1 + percentage * (10 - 1));
    setTargetAnxiety(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getDurationColor = (duration: number) => {
    if (duration <= 10) return '#10B981'; // Yeşil - Kısa
    if (duration <= 20) return '#F59E0B'; // Turuncu - Orta
    return '#EF4444'; // Kırmızı - Uzun
  };

  const getAnxietyColor = (anxiety: number) => {
    if (anxiety <= 3) return '#10B981'; // Yeşil - Düşük
    if (anxiety <= 6) return '#F59E0B'; // Turuncu - Orta
    return '#EF4444'; // Kırmızı - Yüksek
  };

  return (
    <BottomSheet isVisible={visible} onClose={onDismiss}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{getPageTitle()}</Text>
            <Text style={styles.headerSubtitle}>{getPageSubtitle()}</Text>
          </View>

          {/* Categories Grid - Show when no category selected */}
          {!selectedCategory && (
            <View style={styles.categoriesGrid}>
              {getCategoriesByPopularity().map((category) => (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    selectedCategory === category.id && styles.categoryCardSelected
                  ]}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setSelectedExercise(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={[
                    styles.categoryIcon,
                    { backgroundColor: `${category.color}15` }
                  ]}>
                    <MaterialCommunityIcons
                      name={category.icon as any}
                      size={20}
                      color={category.color}
                    />
                  </View>
                  <Text style={styles.categoryName}>{category.title}</Text>
                  <Text style={styles.categoryCount}>{category.exercises.length} egzersiz</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Exercises Grid + Settings - Show when category selected */}
          {selectedCategory && (
            <View style={styles.combinedSection}>
              {/* Exercises Grid */}
              <View style={styles.exercisesGrid}>
                {(() => {
                  const category = getCategoriesByPopularity().find(c => c.id === selectedCategory);
                  if (!category) return null;
                  
                  return category.exercises.map((exercise: any) => (
                    <Pressable
                      key={exercise.id}
                      style={[
                        styles.exerciseCard,
                        selectedExercise && (selectedExercise as any).id === exercise.id && styles.exerciseCardSelected
                      ]}
                      onPress={() => {
                        setSelectedExercise(exercise);
                        setDuration(exercise.duration);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={styles.exerciseName} numberOfLines={2}>
                        {exercise.name}
                      </Text>
                      <View style={styles.exerciseFooter}>
                        <Text style={styles.exerciseDuration}>{exercise.duration}dk</Text>
                        <View style={styles.exerciseDifficulty}>
                                                  {Array.from({ length: exercise.difficulty }).map((_, i) => (
                          <MaterialCommunityIcons key={i} name="star" size={8} color="#F59E0B" />
                        ))}
                        </View>
                      </View>
                    </Pressable>
                  ));
                })()}
              </View>

              {/* Settings Section - Show always when category is selected */}

              {/* Duration Setting */}
              <View style={styles.settingCard}>
                <View style={styles.settingHeader}>
                  <Text style={styles.settingTitle}>Egzersiz Süresi</Text>
                  <Text style={styles.settingValue}>{duration} dakika</Text>
                </View>
                
                <View style={styles.settingControls}>
                  <Pressable
                    style={[styles.settingButton, duration <= 3 && styles.settingButtonDisabled]}
                    onPress={() => {
                      if (duration > 3) {
                        setDuration(duration - 1);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    disabled={duration <= 3}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={duration <= 3 ? '#D1D5DB' : '#6B7280'} />
                  </Pressable>
                  
                  <View style={styles.settingButtonSpacer} />
                  
                  <Pressable
                    style={[styles.settingButton, duration >= 30 && styles.settingButtonDisabled]}
                    onPress={() => {
                      if (duration < 30) {
                        setDuration(duration + 1);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    disabled={duration >= 30}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={duration >= 30 ? '#D1D5DB' : '#6B7280'} />
                  </Pressable>
                </View>
                
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.sliderTrack}
                    onPress={handleDurationSliderPress}
                  >
                    <View 
                      style={[
                        styles.sliderProgress,
                        { 
                          width: `${getDurationProgress(duration)}%`,
                          backgroundColor: getDurationColor(duration)
                        }
                      ]} 
                    />
                    <View
                      style={[
                        styles.sliderThumb,
                        { 
                          left: `${getDurationProgress(duration) - 3}%`,
                          backgroundColor: getDurationColor(duration)
                        }
                      ]}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Anxiety Setting */}
              <View style={styles.settingCard}>
                <View style={styles.settingHeader}>
                  <Text style={styles.settingTitle}>Hedef Anksiyete</Text>
                  <Text style={styles.settingValue}>{targetAnxiety}/10</Text>
                </View>
                
                <View style={styles.settingControls}>
                  <Pressable
                    style={[styles.settingButton, targetAnxiety <= 1 && styles.settingButtonDisabled]}
                    onPress={() => {
                      if (targetAnxiety > 1) {
                        setTargetAnxiety(targetAnxiety - 1);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    disabled={targetAnxiety <= 1}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={targetAnxiety <= 1 ? '#D1D5DB' : '#6B7280'} />
                  </Pressable>
                  
                  <View style={styles.settingButtonSpacer} />
                  
                  <Pressable
                    style={[styles.settingButton, targetAnxiety >= 10 && styles.settingButtonDisabled]}
                    onPress={() => {
                      if (targetAnxiety < 10) {
                        setTargetAnxiety(targetAnxiety + 1);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    disabled={targetAnxiety >= 10}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={targetAnxiety >= 10 ? '#D1D5DB' : '#6B7280'} />
                  </Pressable>
                </View>
                
                <View style={styles.sliderContainer}>
                  <Pressable
                    style={styles.sliderTrack}
                    onPress={handleAnxietySliderPress}
                  >
                    <View 
                      style={[
                        styles.sliderProgress,
                        { 
                          width: `${getAnxietyProgress(targetAnxiety)}%`,
                          backgroundColor: getAnxietyColor(targetAnxiety)
                        }
                      ]} 
                    />
                    <View
                      style={[
                        styles.sliderThumb,
                        { 
                          left: `${getAnxietyProgress(targetAnxiety) - 3}%`,
                          backgroundColor: getAnxietyColor(targetAnxiety)
                        }
                      ]}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable 
                style={styles.backButton}
                onPress={() => setSelectedCategory('')}
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color="#6B7280" />
                <Text style={styles.backButtonText}>Kategorilere Dön</Text>
              </Pressable>
            </View>
          )}

          {/* Comfort Note - Show only on main category screen */}
          {!selectedCategory && (
            <View style={styles.comfortNote}>
              <Text style={styles.comfortTitle}>🌸 Nazik Hatırlatma</Text>
              <Text style={styles.comfortText}>
                • Sen her zaman kontroldesin{'\n'}
                • İstediğin her an duraklatabilirsin{'\n'}
                • Bu senin güvenli alanın{'\n'}
                • Hissettiğin her şey doğal ve geçici
              </Text>
            </View>
          )}
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
              styles.startButton,
              !selectedExercise && styles.startButtonDisabled
            ]}
            onPress={selectedExercise ? handleStartExercise : undefined}
            disabled={!selectedExercise}
          >
            <MaterialCommunityIcons 
              name="play" 
              size={20} 
              color={selectedExercise ? "#FFFFFF" : "#9CA3AF"} 
            />
            <Text style={[
              styles.startButtonText,
              !selectedExercise && styles.startButtonTextDisabled
            ]}>
              {selectedExercise ? "Başlat" : "Egzersiz Seç"}
            </Text>
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
  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 75,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
    lineHeight: 12,
    flexWrap: 'wrap',
  },
  categoryCount: {
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Inter',
    marginTop: 1,
  },
  // Exercises Grid
  exercisesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  exerciseCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 70,
  },
  exerciseCardSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  exerciseName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 6,
    lineHeight: 14,
  },
  exerciseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseDuration: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  exerciseDifficulty: {
    flexDirection: 'row',
    gap: 1,
  },
  // Combined Section (Exercises + Settings)
  combinedSection: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  selectedExerciseCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  selectedExerciseCategory: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  selectedExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  changeExerciseButton: {
    alignSelf: 'flex-end',
  },
  changeExerciseText: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  settingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: 'Inter',
  },
  settingControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingButtonDisabled: {
    opacity: 0.3,
  },
  settingButtonSpacer: {
    flex: 1,
  },
  // Custom Slider Styles
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
  // Back Button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginLeft: 8,
  },

  // Comfort Note
  comfortNote: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  comfortTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  comfortText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
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
  startButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  startButtonTextDisabled: {
    color: '#9CA3AF',
  },
}); 