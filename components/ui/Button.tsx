import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Pressable,
  Platform,
  AccessibilityRole,
} from 'react-native';
import type { StyleProp } from 'react-native';

interface ButtonProps {
  children?: React.ReactNode;
  title?: string; // Support for legacy title prop
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // Accessibility props
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}

export function Button({
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
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const handlePress = () => {
    if (!loading && !disabled && onPress) {
      // console.log('Button pressed!'); // Debug log
      onPress();
    }
  };

  const renderChildrenContent = (): React.ReactNode => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : '#10B981'}
          size="small"
        />
      );
    }

    // Title overrides
    if (typeof title === 'string' && title.length > 0) {
      return (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryText : variant === 'outline' ? styles.outlineText : styles.secondaryText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      );
    }

    // Pure string/number children
    if (typeof children === 'string' || typeof children === 'number') {
      return (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryText : variant === 'outline' ? styles.outlineText : styles.secondaryText,
            textStyle,
          ]}
        >
          {children as any}
        </Text>
      );
    }

    // Array / Fragment children: wrap stray text nodes into <Text>
    if (Array.isArray(children)) {
      return (
        <View style={styles.childrenWrapper}>
          {children.map((child, idx) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <Text
                key={`btn-txt-${idx}`}
                style={[
                  styles.buttonText,
                  variant === 'primary' ? styles.primaryText : variant === 'outline' ? styles.outlineText : styles.secondaryText,
                  textStyle,
                ]}
              >
                {child as any}
              </Text>
            ) : (
              child
            )
          )}
        </View>
      );
    }

    // Fallback render (custom node)
    return <View style={styles.childrenWrapper}>{children}</View>;
  };

  const buttonContent = (
    <View style={styles.contentRow}>
      {!loading && leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
      {renderChildrenContent()}
      {!loading && rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
    </View>
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
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  childrenWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 6,
  },
  iconRight: {
    marginLeft: 6,
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#6B7280",
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
  },
  outlineText: {
    color: "#6B7280",
  },
});

// Default export for backward compatibility
export default Button;