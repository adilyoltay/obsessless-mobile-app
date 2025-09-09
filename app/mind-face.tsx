import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import ScreenLayout from '@/components/layout/ScreenLayout';
import MoodFaceCard, { DayMetrics } from '@/components/MoodFaceCard';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import moodTracker from '@/services/moodTrackingService';
import { getUserDateString } from '@/utils/timezoneUtils';
import { useGamificationStore } from '@/store/gamificationStore';

export default function MindFaceScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [week, setWeek] = useState<DayMetrics[]>([]);
  const { profile, initializeGamification } = useGamificationStore();

  const load = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const entries = await moodTracker.getMoodEntries(user.id, 7);
      const mapped: DayMetrics[] = (entries || [])
        .map((e) => ({
          date: getUserDateString(e.timestamp),
          mood: Number.isFinite(e.mood_score) && e.mood_score > 0 ? Number(e.mood_score) : null,
          energy: Number.isFinite(e.energy_level) && e.energy_level > 0 ? Number(e.energy_level) : null,
          anxiety: Number.isFinite(e.anxiety_level) && e.anxiety_level > 0 ? Number(e.anxiety_level) : null,
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      setWeek(mapped);
    } catch (e) {
      console.warn('MindFace load failed', e);
      setWeek([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      initializeGamification(user.id);
      load();
    }
  }, [user?.id]);

  return (
    <ScreenLayout edges={['top','left','right']}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.container}
      >
        <MoodFaceCard
          week={week}
          title="Zihin Skoru"
          streakCurrent={profile.streakCurrent}
          streakLevel={profile.streakLevel}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { paddingVertical: 16 },
});

