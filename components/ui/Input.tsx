
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  variant?: 'default' | 'filled' | 'outlined';
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  variant = 'outlined',
  secureTextEntry,
  ...props
}: InputProps) {
  const theme = useThemeColors();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<RNTextInput>(null);
  
  // console.log('🔍 Input render:', { isFocused, label }); // Debug log removed

  const isPassword = secureTextEntry;
  const actuallySecure = isPassword && !showPassword;
  
  const handleFocus = useCallback(() => {
    // console.log('📌 Input focused:', label); // DISABLED - USING NATIVE INSTEAD
    setIsFocused(true);
  }, []);
  
  const handleBlur = useCallback(() => {
    // console.log('📌 Input blurred:', label); // DISABLED - USING NATIVE INSTEAD
    setIsFocused(false);
  }, []);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          styles[variant],
          isFocused && styles.focused,
          error && styles.error,
          { backgroundColor: variant === 'outlined' ? theme.card : undefined },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color="#6B7280"
            style={styles.leftIcon}
          />
        )}
        
        <RNTextInput
          ref={inputRef}
          {...props}
          secureTextEntry={actuallySecure}
          style={[styles.input, leftIcon && styles.inputWithLeftIcon]}
          placeholderTextColor="#9CA3AF"
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="next"
          editable={true}
          scrollEnabled={false}
          multiline={false}
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
        />
        
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && !isPassword && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons name={rightIcon} size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      
      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  labelError: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 48,
  },
  default: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  focused: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  error: {
    borderColor: '#EF4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  leftIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  rightIcon: {
    marginRight: 16,
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  errorText: {
    color: '#EF4444',
  },
});
