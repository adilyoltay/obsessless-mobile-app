import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { MoodJourneyData } from '@/services/todayService';

type Props = {
  data: MoodJourneyData | null;
};

export default function WeeklySummaryGrid({ data }: Props) {
  const router = useRouter();
  const theme = useThemeColors();

  const moodTodayAvg = data?.todayAverage ?? 0;
  const weeklyEnergyAvg = data?.weeklyEnergyAvg ?? 0;
  const weeklyAnxietyAvg = data?.weeklyAnxietyAvg ?? 0;

  const goMood = () => router.push({ pathname: '/(tabs)/index' as any, params: { focus: 'mood' } });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="view-dashboard" size={20} color="#6B7280" />
        <Text style={styles.sectionTitle}>Haftalık Özet</Text>
      </View>
      <View style={styles.grid}>
        <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={goMood}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="emoticon-happy" size={18} color="#F59E0B" />
            <Text style={styles.cardTitle}>Mood</Text>
          </View>
          <Text style={styles.cardValue}>{moodTodayAvg > 0 ? moodTodayAvg.toFixed(1) : '—'}</Text>
          <Text style={styles.cardSub}>Bugünkü ortalama</Text>
          <View style={styles.cardFooter}><Text style={styles.cardAction}>Görüntüle →</Text></View>
        </Pressable>

        <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={goMood}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#10B981" />
            <Text style={styles.cardTitle}>Enerji</Text>
          </View>
          <Text style={styles.cardValue}>{weeklyEnergyAvg > 0 ? weeklyEnergyAvg.toFixed(1) : '—'}</Text>
          <Text style={styles.cardSub}>Haftalık ortalama</Text>
          <View style={styles.cardFooter}><Text style={styles.cardAction}>Görüntüle →</Text></View>
        </Pressable>

        <Pressable style={[styles.card, { backgroundColor: theme.card }]} onPress={goMood}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={18} color="#EF4444" />
            <Text style={styles.cardTitle}>Anksiyete</Text>
          </View>
          <Text style={styles.cardValue}>{weeklyAnxietyAvg > 0 ? weeklyAnxietyAvg.toFixed(1) : '—'}</Text>
          <Text style={styles.cardSub}>Haftalık ortalama</Text>
          <View style={styles.cardFooter}><Text style={styles.cardAction}>Görüntüle →</Text></View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Bold',
    marginLeft: 8,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    marginLeft: 6,
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  cardSub: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  cardFooter: {
    marginTop: 8,
  },
  cardAction: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '600',
  },
});
