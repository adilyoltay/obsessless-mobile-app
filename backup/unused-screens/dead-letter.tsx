import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenLayout, { ScreenHeader } from '@/components/layout/ScreenLayout';
import deadLetterQueue, { DeadLetterItem } from '@/services/sync/deadLetterQueue';
import { offlineSyncService } from '@/services/offlineSync';

export default function DeadLetterScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        deadLetterQueue.list(200),
        deadLetterQueue.getStatistics(),
      ]);
      setItems(list);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retryOne = async (it: DeadLetterItem) => {
    await deadLetterQueue.retryDeadLetterItem(it.id, async (data) => {
      await offlineSyncService.addToSyncQueue({ type: it.type as any, entity: it.entity as any, data });
    });
    await load();
  };

  const retryAll = async () => {
    setLoading(true);
    for (const it of items) {
      if (!it.archived && it.canRetry) {
        await retryOne(it);
      }
    }
    setLoading(false);
  };

  const clearArchived = async () => {
    setLoading(true);
    await deadLetterQueue.archiveOldItems();
    await load();
    setLoading(false);
  };

  return (
    <ScreenLayout scrollable={false}>
      <ScreenHeader title="Dead-Letter Queue" subtitle={stats ? `Toplam: ${stats.total} | Tekrar denenebilir: ${stats.retryable} | Arşivli: ${stats.archived}` : undefined} />
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Hepsini tekrar dene" style={[styles.btn, styles.primary]} onPress={retryAll}>
          <Text style={styles.btnText}>Hepsini Tekrar Dene</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Eski öğeleri arşivle" style={[styles.btn, styles.secondary]} onPress={clearArchived}>
          <Text style={styles.btnText}>Eski Öğeleri Arşivle</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.card, item.archived && styles.cardArchived]}
              accessibilityLabel={`DLQ öğesi ${item.entity} ${item.type}`} accessibilityRole="summary">
              <Text style={styles.title}>{item.entity} • {item.type}</Text>
              <Text style={styles.meta}>Hata: {item.errorMessage}</Text>
              <Text style={styles.meta}>Tarih: {new Date(item.failedAt).toLocaleString()}</Text>
              <View style={styles.row}>
                <Text style={[styles.badge, item.canRetry ? styles.badgeOk : styles.badgeWarn]}>{item.canRetry ? 'Tekrar Denenebilir' : 'Tekrar Denenemez'}</Text>
                {item.archived && <Text style={[styles.badge, styles.badgeMuted]}>Arşivli</Text>}
              </View>
              {item.canRetry && !item.archived && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Tekrar dene" style={[styles.btn, styles.small, styles.primary]} onPress={() => retryOne(item)}>
                  <Text style={styles.btnText}>Tekrar Dene</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 32 }}>Kuyruk boş 🎉</Text>}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  small: { alignSelf: 'flex-start', marginTop: 8 },
  primary: { backgroundColor: '#0ea5e9' },
  secondary: { backgroundColor: '#64748b' },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardArchived: { opacity: 0.6 },
  title: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  meta: { color: '#475569', marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 4 },
  badge: { color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  badgeOk: { backgroundColor: '#22c55e' },
  badgeWarn: { backgroundColor: '#ef4444' },
  badgeMuted: { backgroundColor: '#94a3b8' },
});


