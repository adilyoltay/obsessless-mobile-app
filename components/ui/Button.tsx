import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Pressable,
  Platform,
  AccessibilityRole,
} from 'react-native';

interface ButtonProps {
  children?: React.ReactNode;
  title?: string; // Support for legacy title prop
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  // Accessibility props
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}

export default function Button({
  children,
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
}: ButtonProps) {
  const handlePress = () => {
    if (!loading && !disabled && onPress) {
      // console.log('Button pressed!'); // Debug log
      onPress();
    }
  };

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : '#10B981'}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryText : variant === 'outline' ? styles.outlineText : styles.secondaryText,
            textStyle,
          ]}
        >
          {title || children}
        </Text>
      )}
    </>
  );

  // iOS için Pressable kullan, Android için TouchableOpacity
  if (Platform.OS === 'ios') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.button,
          variant === 'primary' ? styles.primaryButton : variant === 'outline' ? styles.outlineButton : styles.secondaryButton,
          (disabled || loading) && styles.disabledButton,
          pressed && styles.pressed,
          style,
        ]}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: disabled || loading,
          busy: loading,
        }}
        testID={testID}
        accessible={true}
      >
        {buttonContent}
      </Pressable>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' ? styles.primaryButton : variant === 'outline' ? styles.outlineButton : styles.secondaryButton,
        (disabled || loading) && styles.disabledButton,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      testID={testID}
      accessible={true}
    >
      {buttonContent}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6B7280",
  },
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#374151',
  outlineText: {
    color: "#6B7280",
  },
  },
});