import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
import ScreenLayout, { ScreenHeader } from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
    <ScreenLayout>
      <View style={styles.container}>
        <ScreenHeader title="Duygu Geçmişi" subtitle="Son 14 gün" />
        <FlatList
          contentContainerStyle={{ paddingVertical: 8 }}
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card variant="outlined" style={styles.card}>
              <View>
                <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
                <View style={styles.row}>
                  <Text style={styles.badgeLabel}>Mod</Text>
                  <Text style={styles.badgeValue}>{item.mood_score}</Text>
                  <Text style={[styles.badgeLabel, { marginLeft: 12 }]}>Enerji</Text>
                  <Text style={styles.badgeValue}>{item.energy_level}</Text>
                  <Text style={[styles.badgeLabel, { marginLeft: 12 }]}>Anksiyete</Text>
                  <Text style={styles.badgeValue}>{item.anxiety_level}</Text>
                </View>
                {item.notes ? <Text style={styles.notes}>“{item.notes}”</Text> : null}
              </View>
            </Card>
          )}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginBottom: 8 },
  time: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  badgeLabel: { fontSize: 12, color: '#64748B' },
  badgeValue: { fontSize: 14, fontWeight: '700', color: '#10B981', marginLeft: 4 },
  notes: { marginTop: 6, fontSize: 13, color: '#374151' },
});


