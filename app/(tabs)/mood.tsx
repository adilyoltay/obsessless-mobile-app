import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { MoodQuickEntry } from '@/components/mood/MoodQuickEntry';
import { MoodChart } from '@/components/mood/MoodChart';
import { MoodList } from '@/components/mood/MoodList';

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';

const { width } = Dimensions.get('window');

interface MoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes: string;
  trigger?: string;
  created_at: string;
  user_id: string;
}

export default function MoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();

  // State
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 30>(7);

  // Pre-fill from voice trigger if available
  useEffect(() => {
    if (params.prefill === 'true') {
      console.log('📝 Opening mood form with pre-filled data:', params);
      setShowQuickEntry(true);
    }
  }, [params]);

  // Load mood entries
  useEffect(() => {
    if (user?.id) {
      loadMoodEntries();
    }
  }, [user?.id]);

  const loadMoodEntries = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const entries = await supabaseService.getMoodEntries(user.id, selectedPeriod);
      setMoodEntries(entries || []);
    } catch (error) {
      console.error('Failed to load mood entries:', error);
      setToastMessage('Mood kayıtları yüklenemedi');
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMoodEntries();
    setRefreshing(false);
  };

  const handleQuickEntry = async (data: {
    mood: number;
    energy: number;
    anxiety: number;
    notes: string;
    trigger?: string;
  }) => {
    if (!user?.id) return;

    try {
      const entry = {
        user_id: user.id,
        mood_score: data.mood,
        energy_level: data.energy,
        anxiety_level: data.anxiety,
        notes: data.notes,
        trigger: data.trigger,
      };

      await supabaseService.saveMoodEntry(entry);
      
      setToastMessage('Mood kaydı oluşturuldu ✅');
      setShowToast(true);
      setShowQuickEntry(false);
      
      // Reload entries
      await loadMoodEntries();
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save mood entry:', error);
      
      // Add to offline queue
      try {
        await offlineSyncService.addToSyncQueue({
          type: 'CREATE',
          entity: 'mood_entry',
          data: {
            user_id: user.id,
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            notes: data.notes,
            trigger: data.trigger,
            created_at: new Date().toISOString(),
          },
        });
        
        setToastMessage('Mood kaydı offline kaydedildi 📱');
        setShowToast(true);
        setShowQuickEntry(false);
      } catch (syncError) {
        setToastMessage('Kayıt oluşturulamadı');
        setShowToast(true);
      }
    }
  };

  const handleEditEntry = async (entry: MoodEntry) => {
    // TODO: Implement edit functionality
    console.log('Edit entry:', entry);
  };

  const handleDeleteEntry = async (entryId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete entry:', entryId);
  };

  // Calculate statistics
  const calculateStats = () => {
    if (moodEntries.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        avgAnxiety: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      };
    }

    const avgMood = moodEntries.reduce((sum, e) => sum + e.mood_score, 0) / moodEntries.length;
    const avgEnergy = moodEntries.reduce((sum, e) => sum + e.energy_level, 0) / moodEntries.length;
    const avgAnxiety = moodEntries.reduce((sum, e) => sum + e.anxiety_level, 0) / moodEntries.length;

    // Calculate trend
    if (moodEntries.length >= 2) {
      const recent = moodEntries.slice(0, Math.ceil(moodEntries.length / 2));
      const older = moodEntries.slice(Math.ceil(moodEntries.length / 2));
      
      const recentAvg = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
      const olderAvg = older.reduce((sum, e) => sum + e.mood_score, 0) / older.length;
      
      const trend = recentAvg > olderAvg + 5 ? 'up' : 
                    recentAvg < olderAvg - 5 ? 'down' : 'stable';
      
      return { avgMood, avgEnergy, avgAnxiety, trend };
    }

    return { avgMood, avgEnergy, avgAnxiety, trend: 'stable' as const };
  };

  const stats = calculateStats();

  return (
    <ScreenLayout>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#10B981"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Mood Takibi</Text>
          <Text style={styles.subtitle}>Duygularını takip et, farkındalığını artır</Text>
        </View>

        {/* Quick Entry Button */}
        <Pressable
          style={styles.quickEntryButton}
          onPress={() => {
            setShowQuickEntry(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.quickEntryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <Text style={styles.quickEntryText}>Yeni Mood Kaydı</Text>
          </LinearGradient>
        </Pressable>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <Pressable
            style={[
              styles.periodButton,
              selectedPeriod === 7 && styles.periodButtonActive,
            ]}
            onPress={() => {
              setSelectedPeriod(7);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.periodText,
              selectedPeriod === 7 && styles.periodTextActive,
            ]}>Son 7 Gün</Text>
          </Pressable>
          <Pressable
            style={[
              styles.periodButton,
              selectedPeriod === 30 && styles.periodButtonActive,
            ]}
            onPress={() => {
              setSelectedPeriod(30);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.periodText,
              selectedPeriod === 30 && styles.periodTextActive,
            ]}>Son 30 Gün</Text>
          </Pressable>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <MaterialCommunityIcons 
              name="emoticon-outline" 
              size={24} 
              color="#10B981" 
            />
            <Text style={styles.statValue}>{Math.round(stats.avgMood)}</Text>
            <Text style={styles.statLabel}>Ort. Mood</Text>
          </Card>

          <Card style={styles.statCard}>
            <MaterialCommunityIcons 
              name="lightning-bolt-outline" 
              size={24} 
              color="#F59E0B" 
            />
            <Text style={styles.statValue}>{Math.round(stats.avgEnergy)}</Text>
            <Text style={styles.statLabel}>Ort. Enerji</Text>
          </Card>

          <Card style={styles.statCard}>
            <MaterialCommunityIcons 
              name="heart-pulse" 
              size={24} 
              color="#EF4444" 
            />
            <Text style={styles.statValue}>{Math.round(stats.avgAnxiety)}</Text>
            <Text style={styles.statLabel}>Ort. Anksiyete</Text>
          </Card>
        </View>

        {/* Mood Chart */}
        {moodEntries.length > 0 && (
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Mood Grafiği</Text>
            <MoodChart entries={moodEntries} period={selectedPeriod} />
          </Card>
        )}

        {/* Mood Entries List */}
        <Card style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Son Kayıtlar</Text>
            {stats.trend !== 'stable' && (
              <View style={[
                styles.trendBadge,
                stats.trend === 'up' ? styles.trendUp : styles.trendDown,
              ]}>
                <MaterialCommunityIcons 
                  name={stats.trend === 'up' ? 'trending-up' : 'trending-down'} 
                  size={16} 
                  color="#FFFFFF" 
                />
                <Text style={styles.trendText}>
                  {stats.trend === 'up' ? 'Yükseliş' : 'Düşüş'}
                </Text>
              </View>
            )}
          </View>
          
          {moodEntries.length > 0 ? (
            <MoodList
              entries={moodEntries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
            />
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons 
                name="emoticon-sad-outline" 
                size={64} 
                color="#D1D5DB" 
              />
              <Text style={styles.emptyText}>Henüz mood kaydı yok</Text>
              <Text style={styles.emptySubtext}>
                Yukarıdaki butona tıklayarak ilk kaydını oluştur
              </Text>
            </View>
          )}
        </Card>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Quick Entry Modal */}
      <MoodQuickEntry
        visible={showQuickEntry}
        onClose={() => setShowQuickEntry(false)}
        onSubmit={handleQuickEntry}
        initialData={params.prefill === 'true' ? {
          mood: params.mood ? Number(params.mood) : 50,
          notes: params.text as string || '',
          trigger: params.trigger as string || ''
        } : undefined}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type={toastMessage.includes('✅') ? 'success' : 'info'}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  quickEntryButton: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  quickEntryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  quickEntryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  periodText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  listCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendUp: {
    backgroundColor: '#10B981',
  },
  trendDown: {
    backgroundColor: '#EF4444',
  },
  trendText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
});
