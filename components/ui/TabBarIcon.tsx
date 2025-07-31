
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';

export function TabBarIcon({ style, ...rest }: ComponentProps<typeof Ionicons>) {
  return <Ionicons size={24} style={[{ marginBottom: -3, pointerEvents: 'none' }, style]} {...rest} />;
}
