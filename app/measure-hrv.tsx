import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import healthSignals, { getRecentHeartSignal } from '@/services/heartpy/healthSignals';
import { runOnRecentSignal } from '@/services/heartpy';

type DurationOpt = 60 | 120 | 180;

export default function MeasureHRVScreen() {
  const router = useRouter();
  const [duration, setDuration] = useState<DurationOpt>(120);
  const [remaining, setRemaining] = useState<number>(120);
  const [running, setRunning] = useState<boolean>(false);
  const [quality, setQuality] = useState<{ sampleVar?: number; note?: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const probeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthSignals.ensurePermissions().catch(() => {});
  }, []);

  useEffect(() => {
    setRemaining(duration);
  }, [duration]);

  const start = () => {
    setError(null);
    if (running) return;
    setRunning(true);
    setRemaining(duration);
    // Countdown timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    // Periodic quick probe for a rough quality proxy (variance of HR over last 30s)
    if (probeRef.current) {
      clearInterval(probeRef.current);
      probeRef.current = null;
    }
    probeRef.current = setInterval(async () => {
      try {
        const rec = await getRecentHeartSignal(30);
        const xs = rec?.signal || [];
        if (xs.length >= 10) {
          const m = xs.reduce((a, b) => a + b, 0) / xs.length;
          const v = xs.reduce((s, x) => s + Math.pow(x - m, 2), 0) / xs.length;
          setQuality({ sampleVar: Math.round(v * 100) / 100, note: v < 4 ? 'stabil' : (v < 16 ? 'orta' : 'değişken') });
        }
      } catch {}
    }, 5000);
  };

  const stop = () => {
    setRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (probeRef.current) {
      clearInterval(probeRef.current);
      probeRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const finish = async () => {
    stop();
    try {
      // One final measurement using the selected window
      const out = await runOnRecentSignal(duration);
      // Navigate to Today and open Check‑in; Check‑in prefill will recompute using latest signal
      router.replace({ pathname: '/(tabs)', params: { openCheckin: '1' } } as any);
    } catch (e: any) {
      setError('Ölçüm tamamlanamadı. Tekrar deneyin.');
    }
  };

  const exit = () => {
    stop();
    router.back();
  };

  const DurButton = ({ val }: { val: DurationOpt }) => (
    <TouchableOpacity
      onPress={() => !running && setDuration(val)}
      style={[styles.durBtn, duration === val && styles.durBtnActive, running && styles.durBtnDisabled]}
    >
      <Text style={[styles.durBtnText, duration === val && styles.durBtnTextActive]}>{val}s</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}> 
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>HRV Ölçümü</Text>
          <TouchableOpacity onPress={exit} accessibilityLabel="Kapat">
            <Text style={styles.link}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Telefonu sabit tutun, rahat nefes alın.</Text>

        <View style={styles.durationRow}>
          <DurButton val={60} />
          <DurButton val={120} />
          <DurButton val={180} />
        </View>

        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{remaining}s</Text>
          <Text style={styles.timerSub}>{running ? 'Ölçüm devam ediyor…' : 'Hazır'}</Text>
        </View>

        <View style={styles.qualityBox}>
          <Text style={styles.qualityTitle}>Sinyal Kalitesi (yaklaşık)</Text>
          <Text style={styles.qualityValue}>{quality ? `${quality.note} (var=${quality.sampleVar})` : '—'}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          {!running ? (
            <TouchableOpacity onPress={start} style={[styles.btn, styles.primary]} accessibilityLabel="Ölçümü başlat">
              <Text style={styles.btnText}>Başlat</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={finish} style={[styles.btn, styles.secondary]} accessibilityLabel="Erken bitir">
                <Text style={styles.btnText}>Erken Bitir</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={stop} style={[styles.btn, styles.ghost]} accessibilityLabel="Durdur">
                <Text style={[styles.btnText, { color: '#111827' }]}>Durdur</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#111827' },
  link: { color: '#10B981', fontWeight: '600' },
  subtitle: { color: '#6B7280' },
  durationRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  durBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  durBtnActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  durBtnDisabled: { opacity: 0.5 },
  durBtnText: { color: '#374151' },
  durBtnTextActive: { color: '#065F46', fontWeight: '600' },
  timerBox: { alignItems: 'center', paddingVertical: 32 },
  timerText: { fontSize: 48, fontWeight: '700', color: '#111827' },
  timerSub: { color: '#6B7280', marginTop: 4 },
  qualityBox: { alignItems: 'center', paddingVertical: 8 },
  qualityTitle: { color: '#6B7280' },
  qualityValue: { color: '#111827', fontWeight: '600', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  primary: { backgroundColor: '#10B981' },
  secondary: { backgroundColor: '#059669' },
  ghost: { backgroundColor: '#D1FAE5' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#DC2626', textAlign: 'center' },
});
