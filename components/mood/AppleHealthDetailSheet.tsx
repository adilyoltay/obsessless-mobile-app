import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  Dimensions
} from 'react-native';
import type { RawDataPoint } from '@/types/mood';
import { formatDateInUserTimezone } from '@/utils/timezoneUtils';
import { quantiles } from '@/utils/statistics';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  date: string;
  entries: RawDataPoint[];
  visible: boolean;
  onClose: () => void;
};

// Apple Health renk paleti
const COLORS = {
  background: '#F2F2F7',
  cardBackground: '#FFFFFF',
  primary: '#007AFF',
  secondary: '#34C759',
  tertiary: '#5AC8FA',
  negative: '#FF3B30',
  text: '#000000',
  textSecondary: '#8E8E93',
  separator: '#C6C6C8',
  modalOverlay: 'rgba(0, 0, 0, 0.4)'
};

const getMoodLabel = (score: number): string => {
  if (score >= 80) return 'Çok Keyifli';
  if (score >= 60) return 'Keyifli';
  if (score >= 40) return 'Nötr';
  if (score >= 20) return 'Keyifsiz';
  return 'Çok Keyifsiz';
};

const getMoodColor = (score: number): string => {
  if (score >= 70) return COLORS.secondary;
  if (score >= 40) return COLORS.primary;
  return COLORS.negative;
};

const TimelineItem: React.FC<{ 
  entry: RawDataPoint; 
  isLast: boolean 
}> = ({ entry, isLast }) => {
  const time = new Date(entry.timestamp).toLocaleTimeString('tr-TR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const moodLabel = getMoodLabel(entry.mood_score);
  const moodColor = getMoodColor(entry.mood_score);
  
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <Text style={styles.timelineTime}>{time}</Text>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      
      <View style={styles.timelineContent}>
        <View style={[styles.timelineDot, { backgroundColor: moodColor }]} />
        <View style={styles.timelineCard}>
          <View style={styles.moodHeader}>
            <Text style={[styles.moodLabel, { color: moodColor }]}>
              {moodLabel}
            </Text>
            <View style={styles.moodScores}>
              <Text style={styles.scoreLabel}>Mood: {entry.mood_score}</Text>
              <Text style={styles.scoreLabel}>Enerji: {entry.energy_level}</Text>
            </View>
          </View>
          
          {entry.notes && (
            <Text style={styles.notes}>{entry.notes}</Text>
          )}
          
          {entry.triggers && entry.triggers.length > 0 && (
            <View style={styles.triggers}>
              {entry.triggers.map((trigger, idx) => (
                <View key={idx} style={styles.triggerChip}>
                  <Text style={styles.triggerText}>{trigger}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export const AppleHealthDetailSheet: React.FC<Props> = ({ 
  date, 
  entries, 
  visible, 
  onClose 
}) => {
  // İstatistikler (MEDYAN + IQR) — UI sürücü metrik
  const stats = React.useMemo(() => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return {
        count: 0,
        mood: { p25: NaN, p50: NaN, p75: NaN },
        energy: { p25: NaN, p50: NaN, p75: NaN },
        anxiety: { p25: NaN, p50: NaN, p75: NaN },
        avg: 0,
      } as const;
    }
    const moods = entries.map(e => Number(e.mood_score)).filter(Number.isFinite) as number[];
    const energies = entries.map(e => Number(e.energy_level)).filter(Number.isFinite) as number[];
    const anx = entries.map(e => Number((e as any).anxiety_level ?? 0)).filter(Number.isFinite) as number[];
    const mq = quantiles(moods);
    const eq = quantiles(energies);
    const aq = quantiles(anx);
    const avg = moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : 0;
    return { count: entries.length, mood: mq, energy: eq, anxiety: aq, avg } as const;
  }, [entries]);
  
  const formattedDate = formatDateInUserTimezone(
    `${date}T00:00:00.000Z`, 
    'long'
  );

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent={true}
      onRequestClose={onClose}
      testID="mood-detail-modal"
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.sheetContainer}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Ruh Hali Detayları</Text>
              <Text style={styles.headerDate}>{formattedDate}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={styles.closeButton}
              testID="mood-detail-close"
            >
              <Text style={styles.closeButtonText}>Bitti</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Özet Kartları (MEDYAN + IQR) */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Number.isFinite(stats.mood.p50) ? Math.round(stats.mood.p50) : '—'}</Text>
                <Text style={styles.statLabel}>Mood Medyan</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {Number.isFinite(stats.mood.p25) ? Math.round(stats.mood.p25) : '—'}–{Number.isFinite(stats.mood.p75) ? Math.round(stats.mood.p75) : '—'}
                </Text>
                <Text style={styles.statLabel}>IQR (p25–p75)</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Number.isFinite(stats.energy.p50) ? Math.round(stats.energy.p50) : '—'}</Text>
                <Text style={styles.statLabel}>Enerji Medyan</Text>
              </View>
              
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.count}</Text>
                <Text style={styles.statLabel}>Giriş</Text>
              </View>
            </View>

            {/* Anksiyete kartları */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{Number.isFinite(stats.anxiety.p50) ? Math.round(stats.anxiety.p50) : '—'}</Text>
                <Text style={styles.statLabel}>Anksiyete Medyan</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {Number.isFinite(stats.anxiety.p25) ? Math.round(stats.anxiety.p25) : '—'}–{Number.isFinite(stats.anxiety.p75) ? Math.round(stats.anxiety.p75) : '—'}
                </Text>
                <Text style={styles.statLabel}>Anksiyete IQR</Text>
              </View>
            </View>
            
            {/* Zaman Çizelgesi */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gün İçi Dağılım</Text>
              <View style={styles.timeline}>
                {entries.length > 0 ? (
                  entries
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((entry, index) => (
                      <TimelineItem 
                        key={entry.id} 
                        entry={entry} 
                        isLast={index === entries.length - 1}
                      />
                    ))
                ) : (
                  <Text style={styles.emptyText}>Bu gün için kayıt bulunmuyor</Text>
                )}
              </View>
            </View>
            
            {/* Alt boşluk */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.modalOverlay,
  },
  sheetContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: COLORS.separator,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  timeline: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    width: 50,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  timelineTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  timelineLine: {
    position: 'absolute',
    top: 24,
    right: -6,
    bottom: -20,
    width: 1,
    backgroundColor: COLORS.separator,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
    marginRight: 12,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
  },
  moodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  moodScores: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  notes: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    marginTop: 8,
  },
  triggers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  triggerChip: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  triggerText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

export default AppleHealthDetailSheet;
