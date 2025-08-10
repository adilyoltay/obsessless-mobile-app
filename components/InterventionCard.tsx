import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';

interface Props {
  title: string;
  description: string;
  instructions?: string[];
}

export default function InterventionCard({ title, description, instructions = [] }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {instructions.map((item, idx) => (
        <Text key={idx} style={styles.instruction}>• {item}</Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
  },
  instruction: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
  },
});

