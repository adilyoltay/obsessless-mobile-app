/**
 * 🧭 Onboarding Screen - Entry Point
 * 
 * Anayasa v2.0 ilkelerine uygun onboarding giriş noktası
 * AI Onboarding V2 veya basit onboarding arasında seçim yapar
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
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
  const [useAIOnboarding, setUseAIOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingType();
  }, []);

  const checkOnboardingType = async () => {
    try {
      // Check if AI onboarding is enabled
      const aiEnabled = FEATURE_FLAGS.isEnabled('AI_ONBOARDING_V2');
      setUseAIOnboarding(aiEnabled);
      
      // Check if already completed
      if (user?.id) {
        const completed = await AsyncStorage.getItem(`onboarding_completed_${user.id}`);
        if (completed === 'true') {
          console.log('✅ Onboarding already completed, redirecting...');
          router.replace('/(tabs)');
          return;
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async (userProfile: UserProfile, treatmentPlan: TreatmentPlan) => {
    console.log('✅ Onboarding completed:', { userProfile, treatmentPlan });
    
    try {
      // Mark onboarding as completed
      if (user?.id) {
        await AsyncStorage.setItem(`onboarding_completed_${user.id}`, 'true');
        await AsyncStorage.setItem(`user_profile_${user.id}`, JSON.stringify(userProfile));
        await AsyncStorage.setItem(`treatment_plan_${user.id}`, JSON.stringify(treatmentPlan));
      }
      
      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      router.replace('/(tabs)');
    }
  };

  const handleOnboardingExit = () => {
    console.log('❌ Onboarding exited');
    router.back();
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
        
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => router.back()}
        >
          <Text style={styles.skipButtonText}>Şimdi değil</Text>
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
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});