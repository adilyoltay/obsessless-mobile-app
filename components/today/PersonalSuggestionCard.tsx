import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  icon?: string;
  title: string;
  text: string;
  ctaText: string;
  onPress: () => void;
};

export default function PersonalSuggestionCard({ icon = 'lightbulb-on-outline', title, text, ctaText, onPress }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name={icon as any} size={22} color="#0EA5E9" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
      <Pressable style={styles.button} onPress={onPress} accessibilityRole="button" accessibilityLabel={ctaText}>
        <Text style={styles.buttonText}>{ctaText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C4A6E'
  },
  text: {
    fontSize: 14,
    color: '#075985',
    marginBottom: 10
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});

