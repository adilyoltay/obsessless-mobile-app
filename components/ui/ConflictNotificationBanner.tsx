import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

type ConflictLog = {
  id: string;
  localData: any;
  remoteData: any;
  conflictType: string;
  timestamp: string;
  resolved_at?: string;
};

export default function ConflictNotificationBanner() {
  const [visible, setVisible] = React.useState(false);
  const [latest, setLatest] = React.useState<ConflictLog | null>(null);

  const loadConflicts = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('conflict_logs');
      const logs: ConflictLog[] = raw ? JSON.parse(raw) : [];
      if (!logs.length) {
        setVisible(false);
        setLatest(null);
        return;
      }
      const last = logs[logs.length - 1];
      // Show only recent conflicts (last 24h) and not dismissed in this session
      const withinDay = Date.now() - new Date(last.timestamp).getTime() < 24 * 60 * 60 * 1000;
      if (withinDay) {
        setLatest(last);
        setVisible(true);
      } else {
        setVisible(false);
        setLatest(null);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  React.useEffect(() => {
    loadConflicts();
    const interval = setInterval(loadConflicts, 10000);
    return () => clearInterval(interval);
  }, [loadConflicts]);

  if (!visible || !latest) return null;

  const onView = () => {
    setVisible(false);
    router.push('/sync-conflicts');
  };

  return (
    <View accessibilityRole="status" accessibilityLabel="Senkronizasyon çatışması bildirimi" style={styles.container}>
      <Text style={styles.text} numberOfLines={2}>
        Veri senkronizasyonunda bir çatışma tespit edildi. İncelemek için dokunun.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onView} style={styles.button}>
          <Text style={styles.buttonText}>Detay</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setVisible(false)} style={[styles.button, styles.secondary]}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Gizle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E6F4FF',
    borderBottomColor: '#1E90FF',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: '#0B3D91',
    fontSize: 12,
  },
  actions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E90FF',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondary: {
    backgroundColor: '#E6F4FF',
    borderWidth: 1,
    borderColor: '#1E90FF',
  },
  secondaryText: {
    color: '#1E90FF',
  },
});


