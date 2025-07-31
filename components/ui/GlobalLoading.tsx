import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, Animated } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useLoading } from '@/contexts/LoadingContext';

export function GlobalLoading() {
  const { isLoading, loadingMessage } = useLoading();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading, fadeAnim, scaleAnim]);

  if (!isLoading) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={isLoading}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <ActivityIndicator 
            size="large" 
            color="#10B981" 
            style={styles.spinner}
            accessibilityLabel="Yükleniyor"
          />
          {loadingMessage && (
            <Text 
              variant="bodyMedium" 
              style={styles.message}
              accessibilityLiveRegion="polite"
            >
              {loadingMessage}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 120,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 16,
    maxWidth: 200,
  },
}); 