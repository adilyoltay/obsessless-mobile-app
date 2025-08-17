
import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  edgeToEdge?: boolean; // Ekranı enine tam kapla (OKB/ERP sheet'leri gibi)
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  edgeToEdge = true,
}) => {
  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <BlurView intensity={20} style={[styles.blurContainer, edgeToEdge && styles.fullWidth]}>
        <View style={[styles.content, edgeToEdge && styles.contentEdgeToEdge]}>
          <View style={styles.handle} />
          {children}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  blurContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
    minHeight: 200,
  },
  contentEdgeToEdge: {
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
});
