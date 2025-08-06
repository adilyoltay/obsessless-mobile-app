import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Platform,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface FABProps {
  onPress: () => void;
  icon?: string;
  size?: number;
  style?: ViewStyle;
  testID?: string;
}

export const FAB: React.FC<FABProps> = ({
  onPress,
  icon = 'plus',
  size = 56,
  style,
  testID = 'fab-button',
}) => {
  const handlePress = async () => {
    // Hafif haptic feedback - ObsessLess tasarım prensiplerine uygun
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Hızlı kompulsiyon kaydı"
      accessibilityHint="Kompulsiyon kaydı formunu açar"
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={icon as any}
          size={24}
          color="#FFFFFF"
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    backgroundColor: '#10B981', // Daha belirgin yeşil
    justifyContent: 'center',
    alignItems: 'center',
    elevation: Platform.OS === 'android' ? 8 : 0,
    // Sığınak hissi için yumuşak gölge
    ...Platform.select({
      ios: {
        backgroundColor: '#10B981', // Explicit for shadow optimization
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
        backgroundColor: '#10B981', // Explicit for shadow optimization
      },
      web: {
        backgroundColor: '#10B981', // Explicit for shadow optimization
        boxShadow: '0px 6px 16px rgba(16, 185, 129, 0.25)',
      },
    }),
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FAB; 