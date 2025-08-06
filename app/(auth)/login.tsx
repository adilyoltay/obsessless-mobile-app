import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabaseService } from '@/services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { signInWithEmail, isLoading, error } = useAuth();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Eksik Bilgi', 'Email ve şifre gerekli');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signInWithEmail(email, password);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await supabaseService.signInWithGoogle();
      
      if (result?.url) {
        await WebBrowser.openBrowserAsync(result.url);
      } else {
        Alert.alert('Hata', 'Google girişi başlatılamadı');
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Google girişi başarısız');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.logoContainer}>
            <View style={styles.logo}>
              <MaterialCommunityIcons name="brain" size={48} color="#10B981" />
            </View>
            <Text style={styles.title}>ObsessLess</Text>
            <Text style={styles.subtitle}>Dijital Sığınağınız</Text>
          </Animated.View>

          {/* Email Input */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.inputContainer}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor="#9CA3AF"
            />
          </Animated.View>

          {/* Password Input */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              placeholderTextColor="#9CA3AF"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#6B7280"
              />
            </Pressable>
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Animated.View entering={FadeInDown} style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Login Button */}
          <Animated.View entering={FadeInDown.delay(400)}>
            <Pressable
              style={[styles.loginButton, isLoading && styles.buttonDisabled]}
              onPress={handleEmailLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Google Login Button */}
          <Animated.View entering={FadeInDown.delay(500)}>
            <Pressable
              style={[styles.googleButton, isLoading && styles.buttonDisabled]}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="google" size={20} color="#4285f4" />
              <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
            </Pressable>
          </Animated.View>

          {/* Signup Link */}
          <Animated.View entering={FadeInDown.delay(600)} style={styles.footer}>
            <Text style={styles.footerText}>
              Hesabınız yok mu?{' '}
              <Text style={styles.signupLink} onPress={() => router.push('/signup')}>
                Kayıt Olun
              </Text>
            </Text>
          </Animated.View>
        </View>
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
    paddingVertical: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter_400Regular',
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
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
  loginButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    fontFamily: 'Inter_500Medium',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  signupLink: {
    color: '#10B981',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
