import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { isValidEmail } from '@/utils/validators';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const theme = useThemeColors();
  const { signUpWithEmail, signInWithGoogle, isLoading, error, clearError, user } = useAuth() as any;

  const combinedError = formError || error;

  const makeFieldChangeHandler = useCallback(
    (setter: (value: string) => void) =>
      (value: string) => {
        if (formError) {
          setFormError(null);
        }
        clearError();
        setter(value);
      },
    [formError, clearError]
  );

  // After auth (immediate signup or Google), route based on onboarding completion
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const aiKey = `ai_onboarding_completed_${user.id}`;
        for (let i = 0; i < 4; i++) {
          const v = await AsyncStorage.getItem(aiKey);
          if (cancelled) return;
          if (v === 'true') {
            router.replace('/(tabs)');
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        try {
          const supabaseService = (await import('@/services/supabase')).default;
          const { data: profile, error } = await supabaseService.supabaseClient
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .single();
          if (!cancelled && profile && !error) {
            router.replace('/(tabs)');
            return;
          }
        } catch {}
        if (!cancelled) router.replace('/(auth)/onboarding');
      } catch {
        if (!cancelled) router.replace('/(auth)/onboarding');
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleEmailSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Eksik Bilgi', 'Tüm alanları doldurunuz');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır');
      return;
    }

    try {
      clearError();
      setFormError(null);

      const normalizedEmail = email.trim();
      if (!isValidEmail(normalizedEmail)) {
        setFormError('Lütfen geçerli bir email adresi girin.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (normalizedEmail !== email) {
        setEmail(normalizedEmail);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await signUpWithEmail(normalizedEmail, password, name);
      
      if (result.needsConfirmation) {
        Alert.alert(
          'Email Doğrulama Gerekli',
          'Email adresinize doğrulama linki gönderildi. Lütfen email kutunuzu kontrol edin ve linke tıklayın.',
          [
            { text: 'Tamam', onPress: () => router.push('/(auth)/login') }
          ]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Başarılı kayıt sonrası yönlendirme (eğer onboarding gerekiyorsa)
        // router.push('/onboarding') veya ana sayfaya git
      }
    } catch (error: any) {
      console.error('❌ Signup form error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Hata mesajını kullanıcıya göster
      const errorMessage = error?.message || 'Kayıt işlemi başarısız oldu. Lütfen tekrar deneyin.';
      Alert.alert('Kayıt Hatası', errorMessage);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      clearError();
      await signInWithGoogle();
    } catch (error: any) {
      console.error('❌ Google signup error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Hata mesajını kullanıcıya göster
      const errorMessage = error?.message || 'Google ile kayıt başarısız oldu. Lütfen tekrar deneyin.';
      Alert.alert('Google Kayıt Hatası', errorMessage);
    }
  };

  const navigateToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Header */}
          <Animated.View 
            entering={FadeInDown.duration(800)}
            style={styles.header}
          >
            <MaterialCommunityIcons 
              name="heart-circle" 
              size={80} 
              color="#10B981" 
            />
            <Text style={styles.title}>Kayıt Ol</Text>
            <Text style={styles.subtitle}>Yolculuğunuza başlayın</Text>
          </Animated.View>

          {/* Signup Form */}
          <Animated.View 
            entering={FadeInDown.duration(800).delay(200)}
            style={styles.form}
          >
            {/* Name Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialCommunityIcons name="account" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Adınız Soyadınız"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={makeFieldChangeHandler(setName)}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            {/* Email Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialCommunityIcons name="email" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Email adresiniz"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={makeFieldChangeHandler(setEmail)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: theme.card }]}>
              <MaterialCommunityIcons name="lock" size={20} color="#6B7280" />
              <TextInput
                style={styles.input}
                placeholder="Şifreniz (en az 6 karakter)"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={makeFieldChangeHandler(setPassword)}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
              <Pressable 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <MaterialCommunityIcons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#6B7280" 
                />
              </Pressable>
            </View>

            {/* Error Message */}
            {combinedError && (
              <Animated.View 
                entering={FadeInDown.duration(300)}
                style={styles.errorContainer}
              >
                <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{combinedError}</Text>
              </Animated.View>
            )}

            {/* Signup Button */}
            <Pressable
              style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
              onPress={handleEmailSignup}
              disabled={isLoading}
            >
              <Text style={styles.signupButtonText}>
                {isLoading ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}
              </Text>
            </Pressable>

            {/* Google Signup */}
            <View style={{ height: 12 }} />
            <GoogleSignInButton onPress={handleGoogleSignup} disabled={isLoading} loading={isLoading} mode="signup" />
          </Animated.View>
        </View>

        {/* Login Link */}
        <Animated.View 
          entering={FadeInDown.duration(800).delay(400)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            Zaten hesabınız var mı?{' '}
            <Text style={styles.loginLink} onPress={navigateToLogin}>
              Giriş Yapın
            </Text>
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontFamily: 'Inter_400Regular',
  },
  eyeButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#DC2626',
    fontFamily: 'Inter_400Regular',
  },
  signupButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  loginLink: {
    color: '#10B981',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
