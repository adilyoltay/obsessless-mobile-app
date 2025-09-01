import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type QuickStatsRowProps = {
  moodTodayCount: number;
  streakCurrent: number;
  healingPointsToday: number;
};

export default function QuickStatsRow({ moodTodayCount, streakCurrent, healingPointsToday }: QuickStatsRowProps) {
  return (
    <View style={styles.quickStatsSection}>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="calendar-today" size={28} color="#10B981" />
        <Text style={styles.quickStatValue}>{moodTodayCount}</Text>
        <Text style={styles.quickStatLabel}>Mood</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="fire" size={28} color="#F59E0B" />
        <Text style={styles.quickStatValue}>{streakCurrent}</Text>
        <Text style={styles.quickStatLabel}>Streak</Text>
      </View>
      <View style={styles.quickStatCard}>
        <MaterialCommunityIcons name="star-outline" size={28} color="#8B5CF6" />
        <Text style={styles.quickStatValue}>{healingPointsToday}</Text>
        <Text style={styles.quickStatLabel}>Bugün</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickStatsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 24,
  },
  quickStatCard: {
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginTop: 2,
  },
});

