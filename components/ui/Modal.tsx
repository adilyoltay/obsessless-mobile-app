
import React from 'react';
import { Modal as RNModal, View, TouchableOpacity, StyleSheet, Platform, Dimensions, ViewStyle } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'none' | 'slide' | 'fade';
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  containerStyle?: ViewStyle;
  closeOnOverlayPress?: boolean;
}

const { height: screenHeight } = Dimensions.get('window');

export function Modal({
  visible,
  onClose,
  children,
  animationType = 'fade',
  presentationStyle = 'overFullScreen',
  containerStyle,
  closeOnOverlayPress = true,
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();

  const handleOverlayPress = () => {
    if (closeOnOverlayPress) {
      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Geçici olarak devre dışı
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType={animationType}
      presentationStyle={presentationStyle}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        {Platform.OS === 'ios' ? (
          <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
        )}
        
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalContent, { backgroundColor: theme.card }, containerStyle]}
          >
            {children}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    maxHeight: screenHeight * 0.8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
      },
      android: {
        elevation: 10,
      },
    }),
  },
});
