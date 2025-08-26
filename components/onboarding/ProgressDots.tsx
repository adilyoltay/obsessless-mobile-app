import React from 'react';
import { View } from 'react-native';

export default function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          accessibilityLabel={`Adım ${i + 1}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginHorizontal: 4,
            backgroundColor: i === current ? '#10B981' : '#D1D5DB',
          }}
        />
      ))}
    </View>
  );
}


