import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  Alert,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import type { RawDataPoint, TimeRange } from '@/types/mood';
import { formatDateInUserTimezone } from '@/utils/timezoneUtils';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import supabaseService from '@/services/supabase';
import moodTracker from '@/services/moodTrackingService';
import { offlineSyncService } from '@/services/offlineSync';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  date: string;
  entries: RawDataPoint[];
  visible: boolean;
  onClose: () => void;
  onDeleted?: (entryId: string) => void;
  range?: TimeRange; // to adapt headings per selected time range
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
  isLast: boolean;
  onDelete?: (entry: RawDataPoint) => void;
}> = ({ entry, isLast, onDelete }) => {
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
            {onDelete && (
              <TouchableOpacity
                onPress={() => onDelete(entry)}
                accessibilityLabel="Kaydı sil"
                style={styles.deleteBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {entry.notes && (
            <Text style={styles.notes}>{entry.notes}</Text>
          )}

          {entry.triggers && entry.triggers.length > 0 && (
            <View style={styles.triggers}>
              {entry.triggers.map((trigger, idx) => (
                <View key={idx} style={styles.triggerChipMuted}>
                  <Text style={styles.triggerTextMuted}>{trigger}</Text>
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
  onClose,
  onDeleted,
  range,
}) => {
  const { user } = useAuth();
  const [localEntries, setLocalEntries] = React.useState<RawDataPoint[]>(entries);
  const [isFull, setIsFull] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Sync internal list when prop changes or modal opens
    setLocalEntries(entries);
  }, [entries, visible]);

  const handleDeleteEntry = React.useCallback((entry: RawDataPoint) => {
    Alert.alert(
      'Kaydı Sil',
      'Bu mood kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Resolve possible remote_id and perform remote-first deletion
              let remoteId: string | null = null;
              try { remoteId = await (moodTracker as any).resolveRemoteIdFor(entry.id); } catch {}
              try {
                await supabaseService.deleteMoodEntry(remoteId || entry.id);
              } catch (remoteErr) {
                // Queue for later if user exists
                try {
                  if (user?.id) {
                    await offlineSyncService.addToSyncQueue({
                      type: 'DELETE',
                      entity: 'mood_entry',
                      data: { id: entry.id, remote_id: remoteId || undefined, user_id: user.id, priority: 'high', deleteReason: 'user_initiated' },
                    } as any);
                  }
                } catch {}
              }
              // Local deletion (handles cache invalidation internally)
              await moodTracker.deleteMoodEntry(entry.id);
              // Update UI
              setLocalEntries(prev => prev.filter(e => e.id !== entry.id));
              onDeleted?.(entry.id);
              try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
            } catch (e) {
              console.error('❌ Delete failed:', e);
              try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
            }
          }
        }
      ]
    );
  }, [onDeleted, user?.id]);
  const [expanded, setExpanded] = React.useState(false);
  
  const formattedDate = formatDateInUserTimezone(
    `${date}T00:00:00.000Z`, 
    'long'
  );

  const headerTitleText = React.useMemo(() => {
    switch (range) {
      case 'day':
        return 'Saatlik Kayıtlar';
      case 'week':
        return 'Gün İçi Dağılım';
      default:
        return 'Kayıtlar';
    }
  }, [range]);

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
        
        <View style={[styles.sheetContainer, isFull && styles.sheetContainerFull]}>
          {/* Handle bar */}
          <View 
            style={styles.handleContainer}
            {...React.useMemo(() => {
              const responder = PanResponder.create({
                onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, g: PanResponderGestureState) => {
                  const dy = Math.abs(g.dy);
                  const dx = Math.abs(g.dx);
                  return dy > dx && dy > 8;
                },
                onPanResponderRelease: (_evt: GestureResponderEvent, g: PanResponderGestureState) => {
                  if (g.dy < -20) setIsFull(true);
                  else if (g.dy > 20) setIsFull(false);
                },
              });
              return responder.panHandlers;
            }, [])}
          >
            <View style={styles.handle} />
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{headerTitleText}</Text>
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
            {/* Zaman Çizelgesi */}
            <View style={styles.section}>
              <View style={styles.timeline}>
                {localEntries.length > 0 ? (() => {
                  const sorted = [...localEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                  const maxItems = 50;
                  const shown = expanded ? sorted : sorted.slice(0, maxItems);
                  return (
                    <>
                      {shown.map((entry, index) => (
                        <TimelineItem
                          key={entry.id}
                          entry={entry}
                          isLast={index === shown.length - 1}
                          onDelete={handleDeleteEntry}
                        />
                      ))}
                      {sorted.length > maxItems && (
                        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>
                            {expanded ? 'Daha az göster' : `Daha fazla göster (${sorted.length - maxItems})`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })() : (
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
  sheetContainerFull: {
    maxHeight: SCREEN_HEIGHT * 0.98,
    minHeight: SCREEN_HEIGHT * 0.98,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerDate: {
    fontSize: 12,
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
  // Stats removed per UX: keep only distribution list
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  timeline: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLeft: {
    width: 52,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  timelineTime: {
    fontSize: 13,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 2,
    marginRight: 12,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#F7F7FB',
    borderRadius: 10,
    padding: 10,
  },
  moodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  moodLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  notes: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginTop: 6,
  },
  triggers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  triggerChipMuted: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  triggerTextMuted: {
    fontSize: 12,
    color: '#374151',
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
