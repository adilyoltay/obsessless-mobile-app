import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProgressDots from '@/components/onboarding/ProgressDots';

export default function Summary() {
  const theme = useThemeColors();
  const router = useRouter();
  const { step, totalSteps, setStep, payload, complete } = useMoodOnboardingStore();
  const { user } = useAuth();
  
  // ✅ NEW: Enhanced completion state management
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionAttempted, setCompletionAttempted] = useState(false);

  useEffect(() => { setStep(5); }, [setStep]);

  const onFinish = async () => {
    if (isCompleting) return; // Prevent multiple calls
    
    setIsCompleting(true);
    setCompletionAttempted(true);
    
    try {
      // Best-effort: mark generic completion first to avoid loop before auth resolves
      try { await AsyncStorage.setItem('ai_onboarding_completed', 'true'); } catch {}
      
      // Prefer auth user id, else fallback
      const userId = user?.id || (global as any).__OBSESS_USER_ID || 'anon';
      
      // ✅ NEW: Enhanced completion with error management
      const result = await complete(userId);
      
      if (result.success) {
        console.log('✅ Onboarding completed successfully!');
        
        // Show success feedback for warnings if any
        if (result.warnings.length > 0) {
          Alert.alert(
            '✅ Hoş geldin!',
            `Onboarding tamamlandı! Bazı ek özellikler ayarlanırken sorun yaşandı:\n\n• ${result.warnings.join('\n• ')}\n\nBu özellikler daha sonra ayarlardan etkinleştirilebilir.`,
            [{ text: 'Devam Et', onPress: () => router.replace('/(tabs)') }]
          );
        } else {
          // Perfect completion, no warnings
          router.replace('/(tabs)');
        }
      } else {
        // Critical errors occurred
        console.error('❌ Onboarding completion had critical errors:', result.criticalErrors);
        
        Alert.alert(
          '⚠️ Kaydetme Sorunu',
          `Bilgileriniz kaydedilirken bazı sorunlar yaşandı:\n\n• ${result.criticalErrors.join('\n• ')}\n\nYine de uygulamayı kullanmaya başlayabilirsiniz. Verileriniz arka planda senkronize edilmeye devam edecek.`,
          [
            { text: 'Tekrar Dene', onPress: () => { setIsCompleting(false); setCompletionAttempted(false); } },
            { text: 'Devam Et', onPress: () => router.replace('/(tabs)'), style: 'default' }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Unexpected completion error:', error);
      
      Alert.alert(
        '❌ Beklenmeyen Hata',
        'Onboarding tamamlanırken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
        [
          { text: 'Tekrar Dene', onPress: () => { setIsCompleting(false); setCompletionAttempted(false); } },
          { text: 'Devam Et (Risky)', onPress: () => router.replace('/(tabs)'), style: 'destructive' }
        ]
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const flags = payload.feature_flags || {};
  const enabled = Object.keys(flags).filter((k) => (flags as any)[k]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: theme.background }}>
      <ProgressDots current={step} total={totalSteps} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', color: '#111827', marginTop: 16 }}>
        Senin için açılanlar
      </Text>
      <Text style={{ color: '#374151', marginTop: 8 }}>
        {enabled.length > 0 ? enabled.join(', ') : 'Varsayılan akış'}
      </Text>

      <View style={{ flex: 1 }} />
      
      <Pressable 
        accessibilityRole="button" 
        onPress={onFinish} 
        disabled={isCompleting}
        style={{ 
          backgroundColor: isCompleting ? '#9CA3AF' : '#10B981', 
          paddingVertical: 14, 
          borderRadius: 12,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isCompleting && (
          <ActivityIndicator 
            size="small" 
            color="#fff" 
            style={{ marginRight: 8 }} 
          />
        )}
        <Text style={{ 
          color: '#fff', 
          textAlign: 'center', 
          fontWeight: '700' 
        }}>
          {isCompleting ? 'Kaydediliyor...' : completionAttempted ? 'Tekrar Dene' : 'Başla'}
        </Text>
      </Pressable>
    </View>
  );
}

