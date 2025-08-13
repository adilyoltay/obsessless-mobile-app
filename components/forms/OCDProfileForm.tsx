
import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';
import Button from '@/components/ui/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface OCDProfileFormProps {
  onComplete?: () => void;
}

// KANONIK OKB/ERP kategori seti ile hizalı seçim listesi (6 kategori)
const SYMPTOM_TYPES = [
  { id: 'contamination', label: 'Bulaşma/Temizlik', icon: 'hand-wash' },
  { id: 'checking', label: 'Kontrol Etme', icon: 'lock-check' },
  { id: 'symmetry', label: 'Simetri/Düzen', icon: 'shape-outline' },
  { id: 'mental', label: 'Zihinsel Ritüeller', icon: 'head-cog' },
  { id: 'hoarding', label: 'Biriktirme', icon: 'package-variant' },
  { id: 'other', label: 'Diğer', icon: 'help-circle' },
];

export function OCDProfileForm({ onComplete }: OCDProfileFormProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const handleSymptomToggle = (symptomId: string) => {
    Haptics.selectionAsync();
    setSelectedSymptoms(prev => 
      prev.includes(symptomId) 
        ? prev.filter(id => id !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handleSubmit = async () => {
    if (selectedSymptoms.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Eksik Bilgi',
        text2: 'En az bir semptom seçin',
      });
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        userId: user?.id,
        selectedSymptoms,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`ocd_profile_${user?.id}`, JSON.stringify(profileData));
      await AsyncStorage.setItem('profileCompleted', 'true');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: '✅ Profile completed, navigating to main app',
        text2: 'Profil başarıyla oluşturuldu!'
      });

      if (onComplete) {
        onComplete();
      } else {
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1000);
      }

    } catch (error) {
      console.error('Profile save error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Profil kaydedilemedi',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Semptomlarınızı Seçin
        </Text>
        <Text style={styles.subtitle}>
          Yaşadığınız OKB semptomlarını seçin. Birden fazla seçim yapabilirsiniz.
        </Text>
      </View>

      {/* Symptom Grid - Mobile Optimized */}
      <View style={styles.symptomsContainer}>
        <View style={styles.symptomsGrid}>
          {SYMPTOM_TYPES.map((symptom) => {
            const isSelected = selectedSymptoms.includes(symptom.id);
            return (
              <Pressable
                key={symptom.id}
                style={[
                  styles.symptomChip,
                  isSelected && styles.symptomChipSelected
                ]}
                onPress={() => handleSymptomToggle(symptom.id)}
              >
                <MaterialCommunityIcons
                  name={symptom.icon as any}
                  size={20}
                  color={isSelected ? '#FFFFFF' : '#6B7280'}
                  style={styles.symptomIcon}
                />
                <Text style={[
                  styles.symptomLabel,
                  isSelected && styles.symptomLabelSelected
                ]}>
                  {t('categoriesCanonical.' + symptom.id, symptom.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Selected Count */}
      <View style={styles.selectedContainer}>
        <Text style={styles.selectedText}>
          {selectedSymptoms.length} semptom seçildi
        </Text>
      </View>

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={loading || selectedSymptoms.length === 0}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Kaydediliyor...' : 'Profili Tamamla'}
          </Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827', // Master Prompt Primary Text
    marginBottom: 8,
    fontFamily: 'Inter-Medium',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280', // Master Prompt Secondary Text
    lineHeight: 24,
    fontFamily: 'Inter',
  },
  symptomsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  symptomChip: {
    width: (width - 48 - 12) / 2, // 2 columns with padding and gap
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  symptomChipSelected: {
    backgroundColor: '#10B981', // Master Prompt Primary Color
    borderColor: '#10B981',
  },
  symptomIcon: {
    marginRight: 8,
  },
  symptomLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
    flex: 1,
  },
  symptomLabelSelected: {
    color: '#FFFFFF',
  },
  selectedContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  selectedText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  buttonContainer: {
    marginTop: 16,
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
});
