/**
 * 🧭 Onboarding Screen - Entry Point
 * 
 * Anayasa v2.0 ilkelerine uygun onboarding giriş noktası
 * AI Onboarding V2 veya basit onboarding arasında seçim yapar
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AI Onboarding V2
import { OnboardingFlowV3 } from '@/features/ai/components/onboarding/OnboardingFlowV3';

// Feature Flags
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Auth Context
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Types
import { UserProfile, TreatmentPlan } from '@/features/ai/types';

// Anayasa v2.0 Renk Paleti
const COLORS = {
  background: '#F9FAFB',
  primary: '#10B981',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  error: '#EF4444',
};

export default function OnboardingScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [useAIOnboarding, setUseAIOnboarding] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const params = useLocalSearchParams();

  useEffect(() => {
    checkOnboardingType();
  }, []);

  const checkOnboardingType = async () => {
    try {
      // Onboarding her zaman V3 ile çalışacak
      setUseAIOnboarding(true);
      
      // Force param ile onboarding'i her zaman aç
      const force = String(params?.force || '').toLowerCase() === 'true';
      if (!force) {
        // Check if already completed
        if (user?.id) {
          const completed = await AsyncStorage.getItem(`onboarding_completed_${user.id}`);
          if (completed === 'true') {
            console.log('✅ Onboarding already completed, redirecting...');
            router.replace('/(tabs)');
            return;
          }
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async (userProfile: UserProfile, treatmentPlan: TreatmentPlan) => {
    // Prevent multiple completions
    if (isCompleting) {
      console.log('⚠️ Already completing onboarding, ignoring duplicate call');
      return;
    }
    
    setIsCompleting(true);
    console.log('✅ Onboarding completed:', { userProfile, treatmentPlan });
    
    try {
      // Mark onboarding as completed
      if (user?.id) {
        await AsyncStorage.multiSet([
          [`onboarding_completed_${user.id}`, 'true'], // legacy flag (back-compat)
          [`ai_onboarding_completed_${user.id}`, 'true'],
          [`user_profile_${user.id}`, JSON.stringify(userProfile)], // legacy (back-compat)
          [`ai_user_profile_${user.id}`, JSON.stringify(userProfile)],
          [`treatment_plan_${user.id}`, JSON.stringify(treatmentPlan)], // legacy (back-compat)
          [`ai_treatment_plan_${user.id}`, JSON.stringify(treatmentPlan)],
        ]);

        // Persist to Supabase AI tables (best-effort)
        try {
          const { supabaseService: svc } = await import('@/services/supabase');
          await Promise.all([
            svc.upsertAIProfile(user.id, userProfile as any, true),
            svc.upsertAITreatmentPlan(user.id, treatmentPlan as any, 'active'),
          ]);
        } catch (dbErr) {
          console.warn('⚠️ AI tables upsert failed (local data saved, will sync later):', (dbErr as any)?.message);
          // Queue onboarding artifacts for offline sync
          try {
            const { offlineSyncService } = await import('@/services/offlineSync');
            await offlineSyncService.addToSyncQueue({
              type: 'CREATE',
              entity: 'ai_profile' as any,
              data: {
                user_id: user.id,
                profile_data: userProfile,
                onboarding_completed: true,
                created_at: new Date().toISOString(),
              },
            });
            await offlineSyncService.addToSyncQueue({
              type: 'CREATE',
              entity: 'treatment_plan' as any,
              data: {
                user_id: user.id,
                plan_data: treatmentPlan,
                status: 'active',
                created_at: new Date().toISOString(),
              },
            });
          } catch (queueErr) {
            console.warn('⚠️ Failed to enqueue onboarding data for offline sync:', queueErr);
          }
        }
      }
      
      // Redirect after completion (prefer explicit flow source)
      const fromTP = String(params?.fromTreatmentPlan || '').toLowerCase() === 'true';
      const redirect = typeof params?.redirect === 'string' ? (params.redirect as string) : '/(tabs)';
      router.replace(fromTP ? '/treatment-plan' : redirect);
      // Defensive: bazı guardlar tabs'a yönlendirebiliyor; kısa gecikmeyle tekrar hedefe yönlendir
      if (fromTP) {
        setTimeout(() => {
          try { router.replace('/treatment-plan'); } catch {}
        }, 50);
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      setIsCompleting(false);
      router.replace('/(tabs)');
    }
  };

  const handleOnboardingExit = () => {
    console.log('❌ Onboarding exit attempted - not allowed');
    // Onboarding tamamlanmadan çıkışa izin verme
    Alert.alert(
      'Onboarding Zorunludur',
      'Uygulamayı kullanmaya başlamak için lütfen tüm adımları tamamlayın.',
      [{ text: 'Tamam', style: 'default' }]
    );
    // Çıkışa izin verme - kullanıcı onboarding'de kalacak
  };

  const handleSimpleStart = async () => {
    try {
      // Mark simple onboarding as completed
      if (user?.id) {
        await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');
      }
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error completing simple onboarding:', error);
      router.replace('/(tabs)');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Kullanıcı bilgisi bulunamadı</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Use AI Onboarding V3 if enabled
  if (useAIOnboarding) {
    return (
      <OnboardingFlowV3
        userId={user.id}
        onComplete={handleOnboardingComplete}
        onExit={handleOnboardingExit}
        resumeSession={true}
      />
    );
  }

  // Fallback to simple onboarding
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.simpleContainer}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🧠</Text>
        </View>
        
        <Text style={styles.title}>Hoş Geldiniz</Text>
        <Text style={styles.subtitle}>
          ObsessLess ile OKB yolculuğunuzda{'\n'}yanınızdayız
        </Text>
        
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>Günlük takip ve analiz</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>ERP egzersizleri</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>Kişiselleştirilmiş destek</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.startButton}
          onPress={handleSimpleStart}
        >
          <Text style={styles.startButtonText}>Başla</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.secondaryText,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  simpleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  featureList: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureBullet: {
    fontSize: 20,
    color: COLORS.primary,
    marginRight: 12,
    fontWeight: '600',
  },
  featureText: {
    fontSize: 16,
    color: COLORS.primaryText,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 200,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },

});