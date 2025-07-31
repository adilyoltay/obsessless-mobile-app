import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  mode?: 'signin' | 'signup';
}

export function GoogleSignInButton({ onPress, disabled = false, loading = false, mode = 'signin' }: Props) {
  const { language } = useLanguage();
  
  const buttonText = language === 'tr' 
    ? (mode === 'signin' ? 'Google ile Giriş Yap' : 'Google ile Kayıt Ol')
    : (mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google');

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.googleIcon}>G</Text>
      </View>
      <Text style={[styles.text, disabled && styles.textDisabled]}>
        {loading ? (language === 'tr' ? 'Bağlanıyor...' : 'Connecting...') : buttonText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: 12,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  textDisabled: {
    color: '#9CA3AF',
  },
}); 