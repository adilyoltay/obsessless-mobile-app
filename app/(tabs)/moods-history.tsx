import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';

export default function MoodsHistoryScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const todayKeyPrefix = `mood_entries_${user.id}_`;
      // naive scan for last 14 days
      const arr: any[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(Date.now() - i * 86400000);
        const key = `${todayKeyPrefix}${d.toISOString().split('T')[0]}`;
        const raw = await AsyncStorage.getItem(key);
        if (raw) arr.push(...JSON.parse(raw));
      }
      setEntries(arr.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    })();
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text>{new Date(item.timestamp).toLocaleString()}</Text>
              <Text>Mod: {item.mood_score} Enerji: {item.energy_level} Anksiyete: {item.anxiety_level}</Text>
              {item.notes ? <Text>Not: {item.notes}</Text> : null}
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F9FAFB' },
  card: { marginBottom: 8 },
});


