import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Chip, SegmentedButtons } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CompulsionCard } from './CompulsionCard';
import { COMPULSION_TYPES } from '@/constants/compulsions';

interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  duration: number;
  timestamp: string;
  userId?: string;
}

export function CompulsionHistory() {
  const [entries, setEntries] = useState<CompulsionEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const stored = await AsyncStorage.getItem('compulsion_logs');
      if (stored) {
        const parsed = JSON.parse(stored);
        setEntries(parsed);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEntries = () => {
    let filtered = [...entries];

    if (filter !== 'all') {
      filtered = filtered.filter(entry => entry.type === filter);
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  };

  const getTodayEntries = () => {
    const today = new Date().toDateString();
    return entries.filter(entry => 
      new Date(entry.timestamp).toDateString() === today
    );
  };

  const getWeekEntries = () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return entries.filter(entry => 
      new Date(entry.timestamp) >= weekAgo
    );
  };

  const filteredEntries = getFilteredEntries();
  const todayCount = getTodayEntries().length;
  const weekCount = getWeekEntries().length;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Kayıtlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard} mode="outlined">
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="calendar-today" size={20} color="#10B981" />
            <Text style={styles.statNumber}>{todayCount}</Text>
            <Text style={styles.statLabel}>Bugün</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard} mode="outlined">
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="calendar-week" size={20} color="#3B82F6" />
            <Text style={styles.statNumber}>{weekCount}</Text>
            <Text style={styles.statLabel}>Bu Hafta</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard} mode="outlined">
          <Card.Content style={styles.statContent}>
            <MaterialCommunityIcons name="format-list-numbered" size={20} color="#8B5CF6" />
            <Text style={styles.statNumber}>{entries.length}</Text>
            <Text style={styles.statLabel}>Toplam</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Filter Controls */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Tür Filtresi:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipContainer}>
            <Chip
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
              style={styles.filterChip}
            >
              Tümü
            </Chip>
            {COMPULSION_TYPES.map(type => (
              <Chip
                key={type.id}
                selected={filter === type.id}
                onPress={() => setFilter(type.id)}
                style={styles.filterChip}
                icon={type.icon}
              >
                {type.title}
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Sort Controls */}
      <View style={styles.sortContainer}>
        <SegmentedButtons
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as 'desc' | 'asc')}
          buttons={[
            {
              value: 'desc',
              label: 'Yeni → Eski',
              icon: 'sort-calendar-descending',
            },
            {
              value: 'asc',
              label: 'Eski → Yeni',
              icon: 'sort-calendar-ascending',
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Entries List */}
      <View style={styles.entriesContainer}>
        {filteredEntries.length === 0 ? (
          <Card style={styles.emptyCard} mode="outlined">
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons name="inbox-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all' 
                  ? 'İlk kompülsiyonunuzu kaydetmek için Takip sekmesini kullanın'
                  : `${COMPULSION_TYPES.find(t => t.id === filter)?.title} türünde henüz kayıt bulunmuyor`
                }
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredEntries.map((entry) => (
            <CompulsionCard
              key={entry.id}
              entry={entry}
              onDelete={() => {
                // Implement delete functionality
                setEntries(prev => prev.filter(e => e.id !== entry.id));
              }}
              onEdit={() => {
                // Implement edit functionality
                console.log('Edit entry:', entry.id);
              }}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  sortContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  segmentedButtons: {
    backgroundColor: '#F3F4F6',
  },
  entriesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 32,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});