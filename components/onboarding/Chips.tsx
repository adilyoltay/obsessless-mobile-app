import React from 'react';
import { View, Pressable, Text } from 'react-native';

export default function Chips({
  options,
  value,
  onChange,
  multiple = true,
}: {
  options: { key: string; label: string }[];
  value: string[];
  onChange: (val: string[]) => void;
  multiple?: boolean;
}) {
  const toggle = (k: string) => {
    if (multiple) {
      const exists = value.includes(k);
      const next = exists ? value.filter((x) => x !== k) : [...value, k];
      onChange(next);
    } else {
      onChange(value.includes(k) ? [] : [k]);
    }
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {options.map((o) => {
        const active = value.includes(o.key);
        return (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            onPress={() => toggle(o.key)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: active ? '#10B981' : '#E5E7EB',
              backgroundColor: active ? '#ECFDF5' : '#FFFFFF',
            }}
          >
            <Text style={{ color: active ? '#065F46' : '#374151' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


