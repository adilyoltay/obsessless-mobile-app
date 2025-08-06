
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, type, visible, onHide, duration = 3000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.spring(translateY, {
      toValue: -100,
      useNativeDriver: true,
    }).start(() => {
      onHide();
    });
  };

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'information-circle';
    }
  };

  const getTypeStyle = () => {
    switch (type) {
      case 'success': return styles.success;
      case 'error': return styles.error;
      case 'warning': return styles.warning;
      case 'info': return styles.info;
      default: return styles.info;
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        getTypeStyle(),
        { transform: [{ translateY }] }
      ]}
    >
      <Ionicons 
        name={getIconName() as any} 
        size={20} 
        color="#FFFFFF" 
        style={styles.icon} 
      />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  success: {
    backgroundColor: '#10B981',
  },
  error: {
    backgroundColor: '#EF4444',
  },
  warning: {
    backgroundColor: '#F59E0B',
  },
  info: {
    backgroundColor: '#3B82F6',
  },
});
