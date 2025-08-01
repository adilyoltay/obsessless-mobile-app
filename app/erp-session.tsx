import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenLayout from '@/components/layout/ScreenLayout';
import ERPSessionScreen from '@/components/erp/ERPSessionScreen';
import { getExerciseById } from '@/constants/erpCategories';

export default function ERPSessionPage() {
  const params = useLocalSearchParams<{ 
    exerciseId: string;
    exerciseType?: string;
    duration?: string;
    targetAnxiety?: string;
    personalGoal?: string;
    category?: string;
    categoryName?: string;
  }>();

  const { exerciseId, exerciseType, duration, targetAnxiety, personalGoal, category, categoryName } = params;

  useEffect(() => {
    if (!exerciseId) {
      Alert.alert('Hata', 'Egzersiz bulunamadı', [
        { text: 'Geri Dön', onPress: () => router.back() }
      ]);
    }
  }, [exerciseId]);

  const exercise = getExerciseById(exerciseId);

  if (!exercise) {
    return (
      <ScreenLayout>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={64}
            color="#EF4444"
          />
          <Text style={styles.errorTitle}>Egzersiz Bulunamadı</Text>
          <Text style={styles.errorMessage}>
            Seçilen egzersiz mevcut değil. Lütfen geri dönüp tekrar deneyin.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  // Use wizard config if available, otherwise fall back to exercise defaults
  const sessionDuration = duration ? parseInt(duration) : exercise.duration * 60;
  const initialAnxiety = targetAnxiety ? parseInt(targetAnxiety) : 5;

  return (
    <ERPSessionScreen
      exerciseId={exercise.id}
      exerciseName={exercise.name}
      targetDuration={sessionDuration}
      exerciseType={exerciseType as any}
      initialAnxiety={initialAnxiety}
      personalGoal={personalGoal}
      category={category}
      categoryName={categoryName}
      onComplete={() => {
        router.replace('/(tabs)/erp');
      }}
      onAbandon={() => {
        router.replace('/(tabs)/erp');
      }}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter',
  },
}); 