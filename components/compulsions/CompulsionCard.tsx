import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Chip, IconButton, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COMPULSION_TYPES, getResistanceLevel } from '@/constants/compulsions';

interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  duration: number;
  timestamp: string;
  userId?: string;
}

interface Props {
  entry: CompulsionEntry;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function CompulsionCard({ entry, onEdit, onDelete, showActions = true }: Props) {
  const compulsionType = COMPULSION_TYPES.find(type => type.id === entry.type);
  const resistanceInfo = getResistanceLevel(entry.resistanceLevel);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins} dk önce`;
    } else if (diffHours < 24) {
      return `${diffHours} saat önce`;
    } else if (diffDays === 1) {
      return 'Dün';
    } else if (diffDays < 7) {
      return `${diffDays} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getResistanceColor = (level: number) => {
    if (level >= 8) return '#10B981'; // Green - High resistance
    if (level >= 6) return '#F59E0B'; // Orange - Medium resistance
    if (level >= 4) return '#EF4444'; // Red - Low resistance
    return '#6B7280'; // Gray - Very low resistance
  };

  const getDurationColor = (duration: number) => {
    if (duration <= 5) return '#10B981'; // Green - Short duration
    if (duration <= 15) return '#F59E0B'; // Orange - Medium duration
    return '#EF4444'; // Red - Long duration
  };

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.content}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.typeContainer}>
            <Surface style={[styles.iconContainer, { backgroundColor: compulsionType?.color + '20' || '#F3F4F6' }]}>
                              <MaterialCommunityIcons 
                  name={compulsionType?.icon as any || 'refresh'} 
                  size={20} 
                  color="#6B7280" 
                />
            </Surface>
            <View style={styles.typeInfo}>
              <Text style={styles.typeName}>{compulsionType?.title || 'Bilinmeyen'}</Text>
              <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp)}</Text>
            </View>
          </View>

          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(entry.timestamp)}</Text>
          </View>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          {/* Resistance Level */}
          <View style={styles.metricContainer}>
            <Surface style={[styles.metricChip, { backgroundColor: getResistanceColor(entry.resistanceLevel) + '20' }]}>
              <MaterialCommunityIcons 
                name="shield-outline" 
                size={16} 
                color={getResistanceColor(entry.resistanceLevel)} 
              />
              <Text style={[styles.metricText, { color: getResistanceColor(entry.resistanceLevel) }]}>
                Direnç {entry.resistanceLevel}/10
              </Text>
            </Surface>
            <Text style={styles.metricLabel}>{resistanceInfo.label}</Text>
          </View>

          {/* Duration */}
          <View style={styles.metricContainer}>
            <Surface style={[styles.metricChip, { backgroundColor: getDurationColor(entry.duration) + '20' }]}>
              <MaterialCommunityIcons 
                name="clock-outline" 
                size={16} 
                color={getDurationColor(entry.duration)} 
              />
              <Text style={[styles.metricText, { color: getDurationColor(entry.duration) }]}>
                {entry.duration} dk
              </Text>
            </Surface>
            <Text style={styles.metricLabel}>
              {entry.duration <= 5 ? 'Kısa süre' : 
               entry.duration <= 15 ? 'Orta süre' : 'Uzun süre'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {showActions && (
          <View style={styles.actionRow}>
            <IconButton
              icon="pencil-outline"
              size={20}
              onPress={onEdit}
              style={styles.actionButton}
              iconColor="#6B7280"
            />
            <IconButton
              icon="delete-outline"
              size={20}
              onPress={onDelete}
              style={styles.actionButton}
              iconColor="#EF4444"
            />
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
  },
  content: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#6B7280',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metricContainer: {
    flex: 1,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginBottom: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    margin: 0,
  },
});