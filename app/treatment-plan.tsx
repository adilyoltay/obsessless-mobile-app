/**
 * 📋 Tedavi Planı Detay Sayfası
 * 
 * Kullanıcının kişiselleştirilmiş tedavi planının detaylı görünümü
 * Settings ekranından erişilebilir
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSecureStorage } from '@/hooks/useSecureStorage';

// AI Components
import { TreatmentPlanPreview } from '@/features/ai/components/onboarding/TreatmentPlanPreview';
import treatmentPlanningEngine from '@/features/ai/engines/treatmentPlanningEngine';

// Types
import {
  UserProfile,
  TreatmentPlan,
} from '@/features/ai/types';

// Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';

export default function TreatmentPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUpdates, setHasUpdates] = useState(false);
  const { getItem: secureGet, setItem: secureSet } = useSecureStorage();

  useEffect(() => {
    loadTreatmentData();
  }, []);

  const loadTreatmentData = async () => {
    try {
      setIsLoading(true);

      const uid = user?.id;

      // Profil: secure -> user-scoped legacy -> global
      let profile: UserProfile | null = null;
      if (uid) {
        profile = await secureGet<UserProfile>(`ai_user_profile_${uid}`, true);
        if (!profile) {
          const legacyPlain = await AsyncStorage.getItem(`ai_user_profile_${uid}`);
          profile = legacyPlain ? JSON.parse(legacyPlain) : null;
        }
      }
      if (!profile) {
        const plain = await AsyncStorage.getItem('ai_user_profile');
        profile = plain ? JSON.parse(plain) : null;
      }
      if (profile) setUserProfile(profile);

      // Plan: secure -> user-scoped legacy -> global
      let plan: TreatmentPlan | null = null;
      if (uid) {
        plan = await secureGet<TreatmentPlan>(`ai_treatment_plan_${uid}`, true);
        if (!plan) {
          const legacyPlanPlain = await AsyncStorage.getItem(`ai_treatment_plan_${uid}`);
          plan = legacyPlanPlain ? JSON.parse(legacyPlanPlain) : null;
        }
      }
      if (!plan) {
        const plainPlan = await AsyncStorage.getItem('ai_treatment_plan');
        plan = plainPlan ? JSON.parse(plainPlan) : null;
      }

      // Plan yoksa ama profil varsa otomatik oluştur
      if (!plan && profile) {
        const newPlan = await generateTreatmentPlan(profile);
        if (newPlan) {
          plan = newPlan;
          if (uid) {
            await secureSet(`ai_treatment_plan_${uid}`, newPlan, true);
            const summary = {
              id: newPlan.id || 'plan_1',
              currentPhase: newPlan.phases?.[0]?.type || 'assessment',
              phaseName: newPlan.phases?.[0]?.name || 'Değerlendirme',
              progress: 0.15,
              totalPhases: newPlan.phases?.length || 5,
              estimatedWeeks: Math.ceil(newPlan.estimatedDuration / 7) || 12,
              lastUpdated: newPlan.createdAt || new Date().toISOString()
            } as any;
            await AsyncStorage.setItem(`treatment_plan_summary_${uid}`, JSON.stringify(summary));
          } else {
            await AsyncStorage.setItem('ai_treatment_plan', JSON.stringify(newPlan));
          }
        }
      }

      if (plan) setTreatmentPlan(plan);
    } catch (error) {
      console.error('Error loading treatment data:', error);
      Alert.alert('Hata', 'Tedavi planı yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateTreatmentPlan = async (profile: UserProfile): Promise<TreatmentPlan | null> => {
    try {
      const plan = await treatmentPlanningEngine.generateTreatmentPlan(profile);
      return plan;
    } catch (error) {
      console.error('Error generating treatment plan:', error);
      return null;
    }
  };

  const handleUpdatePlan = async () => {
    Alert.alert(
      'Planı Güncelle',
      'Tedavi planınızı güncel verilerinize göre yenilemek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Güncelle',
          onPress: async () => {
            setIsLoading(true);
            try {
              if (userProfile) {
                const newPlan = await generateTreatmentPlan(userProfile);
                if (newPlan) {
                  setTreatmentPlan(newPlan);
                  if (user?.id) {
                    await secureSet(`ai_treatment_plan_${user.id}`, newPlan, true);
                    // Özet bilgileri de güncelle (user-scoped)
                    const summary = {
                      id: newPlan.id || 'plan_1',
                      currentPhase: newPlan.phases?.[0]?.type || 'assessment',
                      phaseName: newPlan.phases?.[0]?.name || 'Değerlendirme',
                      progress: 0.15,
                      totalPhases: newPlan.phases?.length || 5,
                      estimatedWeeks: Math.ceil(newPlan.estimatedDuration / 7) || 12,
                      lastUpdated: newPlan.createdAt || new Date().toISOString()
                    } as any;
                    await AsyncStorage.setItem(`treatment_plan_summary_${user.id}`, JSON.stringify(summary));
                  } else {
                    await AsyncStorage.setItem('ai_treatment_plan', JSON.stringify(newPlan));
                  }
                  
                  Alert.alert('Başarılı', 'Tedavi planınız güncellendi.');
                  setHasUpdates(false);
                }
              }
            } catch (error) {
              console.error('Error updating plan:', error);
              Alert.alert('Hata', 'Plan güncellenirken bir hata oluştu.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleExportPlan = async () => {
    // TODO: Tedavi planını PDF olarak dışa aktarma
    Alert.alert('Yakında', 'Tedavi planınızı PDF olarak dışa aktarma özelliği yakında eklenecek.');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Tedavi Planım',
            headerBackTitle: 'Geri',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#1F2937',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Tedavi planınız yükleniyor...</Text>
        </View>
      </View>
    );
  }

  if (!userProfile || !treatmentPlan) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Tedavi Planım',
            headerBackTitle: 'Geri',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#1F2937',
          }}
        />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Tedavi Planı Bulunamadı</Text>
          <Text style={styles.emptyText}>
            Kişiselleştirilmiş tedavi planınızı oluşturmak için önce değerlendirme sürecini tamamlamanız gerekiyor.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/onboarding');
            }}
          >
            <Text style={styles.primaryButtonText}>Değerlendirmeyi Başlat</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tedavi Planım',
          headerBackTitle: 'Geri',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#1F2937',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerButton}
                onPress={handleExportPlan}
              >
                <MaterialCommunityIcons name="download" size={24} color="#6B7280" />
              </Pressable>
              <Pressable
                style={styles.headerButton}
                onPress={handleUpdatePlan}
              >
                <MaterialCommunityIcons name="refresh" size={24} color="#6B7280" />
              </Pressable>
            </View>
          ),
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(32, insets.bottom + 16) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Güncelleme Bildirimi */}
        {hasUpdates && (
          <View style={styles.updateBanner}>
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
            <Text style={styles.updateText}>
              Yeni verilerinize göre planınız güncellenebilir
            </Text>
            <Pressable onPress={handleUpdatePlan}>
              <Text style={styles.updateAction}>Güncelle</Text>
            </Pressable>
          </View>
        )}

        {/* Tedavi Planı Detayları */}
        <View style={styles.planContainer}>
          <TreatmentPlanPreview
            userProfile={userProfile}
            treatmentPlan={treatmentPlan}
            isLoading={false}
            userId={user?.id}
          />
        </View>

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>
              Bu tedavi planı, verdiğiniz bilgiler doğrultusunda AI tarafından oluşturulmuştur. 
              Profesyonel bir tedavinin yerini tutmaz. Lütfen bir uzmana danışmayı ihmal etmeyin.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  updateText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  updateAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  planContainer: {
    marginHorizontal: 16,
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
