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
    backgroundColor: '#10B981', // Sakin Yeşil - Primary color
    justifyContent: 'center',
    alignItems: 'center',
    elevation: Platform.OS === 'android' ? 8 : 0,
    shadowColor: '#10B981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Sığınak hissi için yumuşak gölge
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FAB; 