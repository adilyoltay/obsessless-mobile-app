import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useSecurityStore } from '@/store/securityStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LockOverlay() {
  const { locked, biometricEnabled, unlockWithBiometrics } = useSecurityStore();

  useEffect(() => {
    let active = true;
    if (locked && biometricEnabled) {
      (async () => {
        const ok = await unlockWithBiometrics();
        if (!ok && active) {
          // Keep overlay; user can press button to retry
        }
      })();
    }
    return () => { active = false; };
  }, [locked, biometricEnabled]);

  if (!biometricEnabled) return null;

  return (
    <Modal visible={locked} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="lock" size={28} color="#111827" />
          <Text style={styles.title}>Uygulama Kilitli</Text>
          <Text style={styles.subtitle}>Devam etmek için kimlik doğrulaması yapın</Text>
          <Pressable style={styles.button} onPress={unlockWithBiometrics} accessibilityRole="button" accessibilityLabel="Kilidi aç">
            <MaterialCommunityIcons name="fingerprint" size={20} color="#FFF" />
            <Text style={styles.buttonText}>Kilidi Aç</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '84%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
  },
});

