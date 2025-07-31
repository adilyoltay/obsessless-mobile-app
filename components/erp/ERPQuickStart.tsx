import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useGamificationStore } from '@/store/gamificationStore';
import { ERPExercise, ERP_CATEGORIES } from '@/constants/erpCategories';

interface ERPQuickStartProps {
  visible: boolean;
  onDismiss: () => void;
  onExerciseSelect: (exerciseId: string) => void;
  exercises: ERPExercise[];
}

export function ERPQuickStart({
  visible,
  onDismiss,
  onExerciseSelect,
  exercises,
}: ERPQuickStartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [lastExercise, setLastExercise] = useState<ERPExercise | null>(null);
  const { awardMicroReward } = useGamificationStore();

  useEffect(() => {
    if (visible) {
      loadLastExercise();
      awardMicroReward('erp_quick_start');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setSelectedCategory('');
    }
  }, [visible]);

  const loadLastExercise = async () => {
    try {
      const lastExerciseId = await AsyncStorage.getItem('lastERPExercise');
      if (lastExerciseId) {
        const exercise = exercises.find(ex => ex.id === lastExerciseId);
        if (exercise) {
          setLastExercise(exercise);
          // Pre-select last category
          setSelectedCategory(exercise.category);
        }
      }
    } catch (error) {
      console.log('Error loading last exercise:', error);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleExerciseSelect = (exerciseId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AsyncStorage.setItem('lastERPExercise', exerciseId);
    onExerciseSelect(exerciseId);
    onDismiss();
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return '#10B981';
    if (difficulty <= 3) return '#F59E0B';
    return '#EF4444';
  };

  const getDifficultyText = (difficulty: number) => {
    if (difficulty <= 2) return 'Kolay';
    if (difficulty <= 3) return 'Orta';
    return 'Zor';
  };

  // Group exercises by category
  const exercisesByCategory = exercises.reduce((acc, exercise) => {
    if (!acc[exercise.category]) {
      acc[exercise.category] = [];
    }
    acc[exercise.category].push(exercise);
    return acc;
  }, {} as Record<string, ERPExercise[]>);

  // Get exercises for selected category
  const categoryExercises = selectedCategory ? exercisesByCategory[selectedCategory] || [] : [];

  return (
    <BottomSheet
      isVisible={visible}
      onClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Egzersiz Seç</Text>
          <Text style={styles.subtitle}>
            {selectedCategory 
              ? 'Bir egzersiz seçerek başla'
              : 'Önce kategori seç'}
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Last Exercise (if exists and no category selected) */}
          {lastExercise && !selectedCategory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Son Egzersiz</Text>
              <Pressable
                style={styles.lastExerciseCard}
                onPress={() => handleExerciseSelect(lastExercise.id)}
              >
                <View style={styles.exerciseIcon}>
                  <MaterialCommunityIcons 
                    name="history" 
                    size={20} 
                    color="#10B981" 
                  />
                </View>
                <View style={styles.exerciseContent}>
                  <Text style={styles.exerciseName}>{lastExercise.name}</Text>
                  <View style={styles.exerciseMeta}>
                    <Text style={styles.exerciseCategory}>
                      {ERP_CATEGORIES.find(c => c.id === lastExercise.category)?.title || 'Diğer'}
                    </Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.exerciseDuration}>
                      {lastExercise.duration} dk
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons 
                  name="chevron-right" 
                  size={20} 
                  color="#6B7280" 
                />
              </Pressable>
            </View>
          )}

          {/* Categories Grid */}
          {!selectedCategory && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kategoriler</Text>
              <View style={styles.categoriesGrid}>
                {ERP_CATEGORIES.map((category) => {
                  const exerciseCount = exercisesByCategory[category.id]?.length || 0;
                  
                  return (
                    <Pressable
                      key={category.id}
                      style={styles.categoryCard}
                      onPress={() => handleCategorySelect(category.id)}
                    >
                      <View style={[
                        styles.categoryIconContainer,
                        { backgroundColor: category.color + '20' }
                      ]}>
                        <MaterialCommunityIcons
                          name={category.icon as any}
                          size={28}
                          color={category.color}
                        />
                      </View>
                      <Text style={styles.categoryName}>
                        {category.title}
                      </Text>
                      <Text style={styles.categoryCount}>
                        {exerciseCount} egzersiz
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Exercises for Selected Category */}
          {selectedCategory && (
            <View style={styles.section}>
              <View style={styles.exercisesHeader}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => setSelectedCategory('')}
                >
                  <MaterialCommunityIcons 
                    name="arrow-left" 
                    size={20} 
                    color="#6B7280" 
                  />
                  <Text style={styles.backText}>Kategoriler</Text>
                </Pressable>
                <Text style={styles.selectedCategoryName}>
                  {ERP_CATEGORIES.find(c => c.id === selectedCategory)?.title}
                </Text>
              </View>

              <View style={styles.exercisesList}>
                {categoryExercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    style={styles.exerciseItem}
                    onPress={() => handleExerciseSelect(exercise.id)}
                  >
                    <View style={styles.exerciseItemContent}>
                      <Text style={styles.exerciseItemName}>
                        {exercise.name}
                      </Text>
                      <View style={styles.exerciseItemMeta}>
                        <View style={[
                          styles.difficultyBadge,
                          { backgroundColor: getDifficultyColor(exercise.difficulty) + '20' }
                        ]}>
                          <Text style={[
                            styles.difficultyText,
                            { color: getDifficultyColor(exercise.difficulty) }
                          ]}>
                            {getDifficultyText(exercise.difficulty)}
                          </Text>
                        </View>
                        <Text style={styles.exerciseItemDuration}>
                          {exercise.duration} dk
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons 
                      name="chevron-right" 
                      size={20} 
                      color="#6B7280" 
                    />
                  </Pressable>
                ))}
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
  lastExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  exerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  exerciseCategory: {
    fontSize: 14,
    color: '#10B981',
    fontFamily: 'Inter',
  },
  dot: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 6,
  },
  exerciseDuration: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  exercisesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  selectedCategoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  exercisesList: {
    gap: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exerciseItemContent: {
    flex: 1,
  },
  exerciseItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'Inter',
    marginBottom: 6,
  },
  exerciseItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  exerciseItemDuration: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
}); 