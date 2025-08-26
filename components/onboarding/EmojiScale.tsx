import React from 'react';
import { View, Pressable, Text } from 'react-native';

const EMOJIS = [
  { score: 1 as const, label: '😔' },
  { score: 2 as const, label: '🙁' },
  { score: 3 as const, label: '😐' },
  { score: 4 as const, label: '🙂' },
  { score: 5 as const, label: '😄' },
];

export default function EmojiScale({ value, onChange }: { value?: 1|2|3|4|5; onChange: (s: 1|2|3|4|5) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
      {EMOJIS.map((e) => (
        <Pressable
          key={e.score}
          accessibilityRole="button"
          accessibilityLabel={`Mood ${e.score}`}
          onPress={() => onChange(e.score)}
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: value === e.score ? '#10B981' : '#E5E7EB',
            backgroundColor: value === e.score ? '#ECFDF5' : '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 28 }}>{e.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}


