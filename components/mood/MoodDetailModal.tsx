import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { RawDataPoint } from '@/types/mood';
import { calculateAverage } from '@/utils/chartUtils';
import { formatDateInUserTimezone } from '@/utils/timezoneUtils';

type Props = {
  date: string;
  entries: RawDataPoint[];
  visible: boolean;
  onClose: () => void;
};

const MetricCard = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{Number.isFinite(value) ? value.toFixed(1) : '—'}</Text>
  </View>
);

const TimelineEntry = ({ entry, isFirst, isLast }: { entry: RawDataPoint; isFirst: boolean; isLast: boolean }) => (
  <View style={styles.timelineItem}>
    <View style={[styles.timelineBar, isFirst && styles.timelineBarStart, isLast && styles.timelineBarEnd]} />
    <View style={styles.timelineContent}>
      <Text style={styles.timelineTime}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text style={styles.timelineText}>Mood: {entry.mood_score} | Enerji: {entry.energy_level}</Text>
    </View>
  </View>
);

export const MoodDetailModal: React.FC<Props> = ({ date, entries, visible, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container} testID="mood-detail-modal">
        <View style={styles.header}>
          <Text style={styles.date}>{formatDateInUserTimezone(`${date}T00:00:00.000Z`, 'long')}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat" testID="mood-detail-close">
            <Text style={styles.closeButton}>Kapat</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Günün Özeti</Text>
            <View style={styles.metricsRow}>
              <MetricCard label="Ortalama Mood" value={calculateAverage(entries, 'mood_score' as any)} />
              <MetricCard label="Enerji" value={calculateAverage(entries, 'energy_level' as any)} />
            </View>
          </View>

          <View style={styles.timeline}>
            <Text style={styles.timelineTitle}>Gün İçi Dağılım</Text>
            {entries.map((entry, index) => (
              <TimelineEntry key={entry.id} entry={entry} isFirst={index === 0} isLast={index === entries.length - 1} />
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  date: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeButton: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  summary: { marginBottom: 16 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
  metricLabel: { fontSize: 12, color: '#6B7280' },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  timeline: { marginBottom: 24 },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  timelineBar: { width: 2, height: 32, backgroundColor: '#E5E7EB', marginRight: 12 },
  timelineBarStart: { borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  timelineBarEnd: { borderBottomLeftRadius: 1, borderBottomRightRadius: 1 },
  timelineContent: { flex: 1 },
  timelineTime: { fontSize: 12, color: '#6B7280' },
  timelineText: { fontSize: 13, color: '#111827' },
});

export default MoodDetailModal;
