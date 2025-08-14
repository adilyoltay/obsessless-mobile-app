import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenLayout, { ScreenHeader } from '@/components/layout/ScreenLayout';

interface ConflictItem {
  entity: string;
  count: number;
  at: string;
  conflicts: Array<{ id: string; local: any; remote: any }>;
}

export default function SyncConflictsScreen() {
  const [items, setItems] = React.useState<ConflictItem[]>([]);

  const load = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('sync_conflicts');
      const arr = raw ? JSON.parse(raw) : [];
      setItems(arr.reverse());
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const clearAll = async () => {
    await AsyncStorage.removeItem('sync_conflicts');
    setItems([]);
  };

  return (
    <ScreenLayout>
      <ScreenHeader title="Senkron Çatışmaları" subtitle="Son eşleşmeyen değişiklikler" />
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.btn}><Text style={styles.btnText}>Yenile</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={clearAll} style={[styles.btn, styles.btnDanger]}><Text style={styles.btnText}>Temizle</Text></TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.entity} ({item.count}) - {new Date(item.at).toLocaleString()}</Text>
            {item.conflicts.slice(0, 3).map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.id}>#{c.id}</Text>
                <Text style={styles.diff}>Yerel ve uzak veriler farklı. LWW uygulandı.</Text>
              </View>
            ))}
            {item.conflicts.length > 3 ? <Text style={styles.more}>+{item.conflicts.length - 3} daha...</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Çatışma kaydı bulunmuyor.</Text>}
        contentContainerStyle={items.length === 0 ? styles.emptyWrap : undefined}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  btn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnDanger: { backgroundColor: '#DC2626' },
  btnText: { color: 'white' },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6' },
  title: { fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  id: { fontFamily: 'monospace' as any, color: '#374151' },
  diff: { color: '#4B5563', flexShrink: 1 },
  more: { color: '#6B7280', marginTop: 4 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#6B7280' }
});


