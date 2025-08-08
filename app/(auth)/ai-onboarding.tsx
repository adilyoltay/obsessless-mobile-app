/**
 * 🧭 AI-Powered Onboarding Screen
 * 
 * Bu ekran Sprint 7'de geliştirilen OnboardingFlow bileşenini
 * mevcut uygulamanın auth flow'una entegre eder.
 * 
 * Features:
 * ✅ Sprint 7 OnboardingFlow integration
 * ✅ Auth context integration
 * ✅ Feature flag protection
 * ✅ Seamless navigation
 * ✅ Progress persistence
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UI Components
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Auth & Context
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLoading } from '@/contexts/LoadingContext';

// AI Components - Sprint 7 Integration
import { OnboardingFlow } from '@/features/ai/components/onboarding/OnboardingFlow';

// AI Services - Sprint 7 Integration  
import { ybocsAnalysisService } from '@/features/ai/services/ybocsAnalysisService';
import { modernOnboardingEngine as onboardingEngine } from '@/features/ai/engines/onboardingEngine';
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { adaptiveTreatmentPlanningEngine as treatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { advancedRiskAssessmentService as riskAssessmentService } from '@/features/ai/services/riskAssessmentService';

// Types
import type { UserProfile, TreatmentPlan } from '@/features/ai/types';

// Feature Flags
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// UI Components
import { Loading } from '@/components/ui/Loading';

interface OnboardingParams {
  resume?: string; // 'true' if resuming session
  fromSettings?: string; // 'true' if accessed from settings
}

export default function AIOnboardingScreen() {
  const { user } = useAuth();
  const { setLoading } = useLoading();
  const params = useLocalSearchParams<OnboardingParams>();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnboardingEnabled, setIsOnboardingEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 🚀 Initialize AI Services
   */
  useEffect(() => {
    const initializeServices = async () => {
      setIsInitializing(true);
      
      try {
        // Check feature flags
        const onboardingEnabled = FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2');
        const ybocsEnabled = FEATURE_FLAGS.isEnabled('AI_YBOCS_ANALYSIS');
        const profilingEnabled = FEATURE_FLAGS.isEnabled('AI_USER_PROFILING');
        const treatmentEnabled = FEATURE_FLAGS.isEnabled('AI_TREATMENT_PLANNING');
        const riskEnabled = FEATURE_FLAGS.isEnabled('AI_RISK_ASSESSMENT');

        if (!onboardingEnabled) {
          setError('AI Onboarding özelliği şu anda aktif değil.');
          return;
        }

        setIsOnboardingEnabled(true);

        // Initialize AI services if enabled
        const initPromises = [];
        
        if (ybocsEnabled) {
          initPromises.push(ybocsAnalysisService.initialize());
        }
        
        if (profilingEnabled) {
          initPromises.push(userProfilingService.initialize());
        }
        
        if (treatmentEnabled) {
          initPromises.push(treatmentPlanningEngine.initialize());
        }
        
        if (riskEnabled) {
          initPromises.push(riskAssessmentService.initialize());
        }

        // Check if onboardingEngine has initialize method
        if (onboardingEngine && typeof onboardingEngine.initialize === 'function') {
          initPromises.push(onboardingEngine.initialize());
        } else {
          console.warn('⚠️ Onboarding Engine not available');
        }

        // Initialize all services in parallel
        await Promise.all(initPromises);
        
        console.log('✅ All AI services initialized for onboarding');

      } catch (error) {
        console.error('❌ AI services initialization failed:', error);
        setError('AI servisleri başlatılamadı. Lütfen tekrar deneyin.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeServices();
  }, []);

  /**
   * ✅ Handle Onboarding Completion
   */
  const handleOnboardingComplete = async (
    userProfile: UserProfile,
    treatmentPlan: TreatmentPlan
  ) => {
    try {
      setLoading(true, 'Profiliniz kaydediliyor...');

      // Save completed onboarding data
      if (user?.id) {
        await AsyncStorage.multiSet([
          [`ai_onboarding_completed_${user.id}`, 'true'],
          [`ai_user_profile_${user.id}`, JSON.stringify(userProfile)],
          [`ai_treatment_plan_${user.id}`, JSON.stringify(treatmentPlan)],
          [`ai_onboarding_date_${user.id}`, new Date().toISOString()]
        ]);
      }

      // Success feedback
      Alert.alert(
        '🎉 Tebrikler!',
        'AI destekli onboarding süreciniz başarıyla tamamlandı. Size özel tedavi yolculuğunuz başlıyor!',
        [
          {
            text: 'Uygulamaya Geç',
            style: 'default',
            onPress: () => {
              // Navigate to main app
              if (params.fromSettings === 'true') {
                router.back(); // Return to settings
              } else {
                router.replace('/(tabs)'); // Go to main app
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error saving onboarding data:', error);
      Alert.alert(
        'Kayıt Hatası',
        'Verileriniz kaydedilirken bir hata oluştu. Ancak onboarding tamamlandı.',
        [
          {
            text: 'Devam Et',
            onPress: () => {
              if (params.fromSettings === 'true') {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * ❌ Handle Onboarding Exit
   */
  const handleOnboardingExit = () => {
    Alert.alert(
      'Onboarding\'den Çık',
      'AI onboarding sürecini şimdi terk etmek istediğinizden emin misiniz? İlerlemeniz kaydedildi ve daha sonra devam edebilirsiniz.',
      [
        { text: 'Devam Et', style: 'cancel' },
        {
          text: 'Çık',
          style: 'destructive',
          onPress: () => {
            if (params.fromSettings === 'true') {
              router.back(); // Return to settings
            } else {
              router.replace('/(tabs)'); // Go to main app
            }
          }
        }
      ]
    );
  };

  /**
   * 🔙 Handle Hardware Back Button
   */
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleOnboardingExit();
        return true; // Prevent default back behavior
      }
    );

    return () => backHandler.remove();
  }, [params.fromSettings]);

  // Loading state during initialization
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Loading size="large" />
          <Text style={styles.loadingText}>AI servisleri hazırlanıyor...</Text>
          <Text style={styles.loadingSubtext}>
            Kişiselleştirilmiş deneyiminiz oluşturuluyor
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !isOnboardingEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>AI Onboarding Kullanılamıyor</Text>
            <Text style={styles.errorText}>
              {error || 'Bu özellik şu anda aktif değil.'}
            </Text>
            <Button
              title="Geri Dön"
              onPress={() => {
                if (params.fromSettings === 'true') {
                  router.back();
                } else {
                  router.replace('/(tabs)');
                }
              }}
              style={styles.errorButton}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // Main onboarding flow
  return (
    <SafeAreaView style={styles.container}>
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onExit={handleOnboardingExit}
        userId={user?.id || 'anonymous'}
        resumeSession={params.resume === 'true'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 24,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorCard: {
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorButton: {
    minWidth: 120,
  },
});