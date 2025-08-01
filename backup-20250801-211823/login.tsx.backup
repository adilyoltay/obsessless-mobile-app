import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      clearError();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await login(email, password);
      // Navigation will be handled by NavigationGuard
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const goToSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/signup');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo & Header */}
          <Animated.View 
            entering={FadeInDown.duration(600).delay(100)}
            style={styles.header}
          >
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons 
                name="heart-circle" 
                size={80} 
                color="#10B981" 
              />
            </View>
            <Text style={styles.title}>Hoş Geldin</Text>
            <Text style={styles.subtitle}>
              Dijital sığınağına giriş yap
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View 
            entering={FadeInDown.duration(600).delay(200)}
            style={styles.form}
          >
            {error && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons 
                  name="alert-circle" 
                  size={20} 
                  color="#EF4444" 
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons 
                name="email-outline" 
                size={20} 
                color="#6B7280" 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email adresin"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons 
                name="lock-outline" 
                size={20} 
                color="#6B7280" 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Şifren"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <Pressable
                onPress={() => {
                  setShowPassword(!showPassword);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.eyeButton}
              >
                <MaterialCommunityIcons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#6B7280" 
                />
              </Pressable>
            </View>

            <Pressable 
              style={[
                styles.loginButton,
                (!email || !password || isLoading) && styles.loginButtonDisabled
              ]} 
              onPress={handleLogin}
              disabled={isLoading || !email || !password}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Footer */}
          <Animated.View 
            entering={FadeInDown.duration(600).delay(300)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              Henüz hesabın yok mu?
            </Text>
            <Pressable onPress={goToSignup}>
              <Text style={styles.linkText}>Kayıt Ol</Text>
            </Pressable>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  form: {
    marginBottom: 32,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    flex: 1,
    fontFamily: 'Inter',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter',
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  linkText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});