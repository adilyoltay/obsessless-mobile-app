import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

interface OfflineBannerProps {
  message?: string;
}

export default function OfflineBanner({ message }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = React.useState(false);
  const [queueLength, setQueueLength] = React.useState<number>(0);

  React.useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable);
      setIsOffline(offline);
    });
    NetInfo.fetch().then(state => {
      const offline = !(state.isConnected && state.isInternetReachable);
      setIsOffline(offline);
    });
    let timer: any;
    try {
      const { offlineSyncService } = require('@/services/offlineSync');
      timer = setInterval(() => {
        try {
          setQueueLength(offlineSyncService.getSyncQueueLength());
        } catch {}
      }, 5000);
    } catch {}
    return () => unsub();
  }, []);

  if (!isOffline) return null;

  return (
    <View accessibilityRole="text" accessibilityLabel="Çevrimdışı durum bildirimi" style={styles.container}>
      <Text style={styles.text}>
        {message || 'Çevrimdışısınız. Değişiklikler yerel olarak kaydedilecek ve bağlantı kurulduğunda senkronize edilecek.'}
        {queueLength > 0 ? ` (${queueLength} bekleyen senkron öğe)` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF4E5',
    borderBottomColor: '#FFA500',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  text: {
    color: '#7A4D00',
    fontSize: 12,
  },
});


