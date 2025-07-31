
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  Pressable,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenLayout from '@/components/layout/ScreenLayout';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Custom UI Components
import FAB from '@/components/ui/FAB';
import { CompulsionQuickEntry } from '@/components/forms/CompulsionQuickEntry';
import { Toast } from '@/components/ui/Toast';

// Gamification
import { useGamificationStore } from '@/store/gamificationStore';

// Constants
import { COMPULSION_CATEGORIES } from '@/constants/compulsions';

// Storage utility
import { StorageKeys } from '@/utils/storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

// Map app categories to database categories
const mapCategoryToDatabase = (appCategory: string): string => {
  const categoryMap: { [key: string]: string } = {
    'washing': 'contamination',
    'checking': 'harm',
    'counting': 'symmetry',
    'ordering': 'symmetry',
    'hoarding': 'hoarding',
    'religious': 'religious',
    'sexual': 'sexual',
    'other': 'contamination', // Default fallback
  };
  
  return categoryMap[appCategory] || 'contamination';
};

interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number;
  timestamp: Date;
  duration?: number;
  trigger?: string;
  notes?: string;
}

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { awardMicroReward, updateStreak } = useGamificationStore();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [todayCompulsions, setTodayCompulsions] = useState<CompulsionEntry[]>([]);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);
  
  const [stats, setStats] = useState({
    totalCompulsions: 0,
    avgResistance: 0,
    todayCount: 0,
    weekCount: 0,
    monthCount: 0,
    typeDistribution: {} as Record<string, number>,
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user?.id]);

  useEffect(() => {
    setDisplayLimit(5);
  }, [selectedTimeRange]);

  const loadAllData = async () => {
    if (!user?.id) return;
    
    try {
      const today = new Date();
      
      // Load all entries from user-specific storage key
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const allEntriesData = await AsyncStorage.getItem(storageKey);
      const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
      
      // Filter today's entries
      const todayKey = today.toDateString();
      const todayEntries = allEntries.filter(entry => 
        new Date(entry.timestamp).toDateString() === todayKey
      );
      setTodayCompulsions(todayEntries);
      
      // Calculate week entries (last 7 days)
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= weekAgo
      );
      
      // Calculate month entries (last 30 days)
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthEntries = allEntries.filter(entry => 
        new Date(entry.timestamp) >= monthAgo
      );
      
      // Calculate stats
      let allResistances: number[] = [];
      let typeDistribution: Record<string, number> = {};
      
      monthEntries.forEach((entry: CompulsionEntry) => {
        allResistances.push(entry.resistanceLevel || 0);
        
        if (entry.type) {
          typeDistribution[entry.type] = (typeDistribution[entry.type] || 0) + 1;
        }
      });
      
      const avgResistance = allResistances.length > 0 
        ? allResistances.reduce((sum, r) => sum + r, 0) / allResistances.length 
        : 0;
      
      setStats({
        totalCompulsions: monthEntries.length,
        avgResistance: Math.round(avgResistance * 10) / 10,
        todayCount: todayEntries.length,
        weekCount: weekEntries.length,
        monthCount: monthEntries.length,
        typeDistribution,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDisplayLimit(5);
    await loadAllData();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(false);
  };

  const handleCompulsionSubmit = async (compulsionData: Omit<CompulsionEntry, 'id' | 'timestamp'>) => {
    if (!user?.id) return;

    try {
      const newEntry: CompulsionEntry = {
        id: Date.now().toString(),
        ...compulsionData,
        timestamp: new Date(),
      };

      // Save to AsyncStorage (offline first)
      const storageKey = StorageKeys.COMPULSIONS(user.id);
      const existingEntries = await AsyncStorage.getItem(storageKey);
      const entries = existingEntries ? JSON.parse(existingEntries) : [];
      entries.push(newEntry);
      await AsyncStorage.setItem(storageKey, JSON.stringify(entries));

      // Save to Supabase database
      try {
        await supabaseService.saveCompulsion({
          user_id: user.id,
          category: mapCategoryToDatabase(compulsionData.type), // Use mapping function
          subcategory: compulsionData.type, // Store original type as subcategory
          resistance_level: compulsionData.resistanceLevel,
          trigger: compulsionData.trigger || '',
          notes: compulsionData.notes || '',
        });
        console.log('✅ Compulsion saved to database');
      } catch (dbError) {
        console.error('❌ Database save failed (offline mode):', dbError);
        // Continue with offline mode - data is already in AsyncStorage
      }

      // Award gamification rewards
      awardMicroReward('compulsion_recorded');
      
      if (compulsionData.resistanceLevel >= 8) {
        awardMicroReward('high_resistance');
      }

      // Check for daily goal achievement
      const today = new Date().toDateString();
      const todayEntries = entries.filter((entry: CompulsionEntry) => 
        new Date(entry.timestamp).toDateString() === today
      );

      if (todayEntries.length >= 3) {
        awardMicroReward('daily_goal_met');
      }

      // Update streak
      updateStreak();

      // Show success toast
      setToastMessage('Kayıt eklendi');
      setShowToast(true);
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh data
      await loadAllData();
    } catch (error) {
      console.error('Error saving compulsion:', error);
    }
  };

  const deleteEntry = async (entryId: string) => {
    Alert.alert(
      'Kaydı Sil',
      'Bu kaydı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;

            try {
              // Delete from AsyncStorage (offline first)
              const storageKey = StorageKeys.COMPULSIONS(user.id);
              const allEntriesData = await AsyncStorage.getItem(storageKey);
              const allEntries: CompulsionEntry[] = allEntriesData ? JSON.parse(allEntriesData) : [];
              const updatedEntries = allEntries.filter(entry => entry.id !== entryId);
              await AsyncStorage.setItem(storageKey, JSON.stringify(updatedEntries));

              // Delete from Supabase database
              try {
                await supabaseService.deleteCompulsion(entryId);
                console.log('✅ Compulsion deleted from database');
              } catch (dbError) {
                console.error('❌ Database delete failed (offline mode):', dbError);
                // Continue with offline mode - data is already removed from AsyncStorage
              }

              await loadAllData();
              
              setToastMessage('Kayıt silindi');
              setShowToast(true);
            } catch (error) {
              console.error('Error deleting entry:', error);
              setToastMessage('Silme işleminde hata oluştu');
              setShowToast(true);
            }
          }
        }
      ]
    );
  };

  const getCompulsionIcon = (type: string) => {
    const category = COMPULSION_CATEGORIES.find(c => c.id === type);
    return category?.icon || 'help-circle';
  };

  const getCompulsionColor = (type: string) => {
    const colors: Record<string, string> = {
      cleaning: '#3B82F6',
      checking: '#10B981',
      counting: '#8B5CF6',
      symmetry: '#F59E0B',
      mental: '#EC4899',
      other: '#6B7280',
    };
    return colors[type] || '#6B7280';
  };

  const getResistanceColor = (level: number) => {
    if (level >= 7) return '#10B981';
    if (level >= 4) return '#F59E0B';
    return '#EF4444';
  };

  const getTimeRangeStats = () => {
    switch (selectedTimeRange) {
      case 'today':
        return { count: stats.todayCount, label: 'Bugün' };
      case 'week':
        return { count: stats.weekCount, label: 'Bu Hafta' };
      case 'month':
        return { count: stats.monthCount, label: 'Bu Ay' };
    }
  };

  const timeRangeStats = getTimeRangeStats();

  const getFilteredCompulsions = () => {
    const today = new Date();
    let entries: CompulsionEntry[] = [];

    switch (selectedTimeRange) {
      case 'today':
        entries = todayCompulsions;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= weekAgo
        );
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        entries = todayCompulsions.filter(entry => 
          new Date(entry.timestamp) >= monthAgo
        );
        break;
    }

    return entries.slice(0, displayLimit);
  };

  const filteredCompulsions = getFilteredCompulsions();

  return (
    <ScreenLayout>
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>OKB Takibi</Text>
          <Text style={styles.headerSubtitle}>
            Kompulsiyonlarını kaydet ve ilerlemeni gör
          </Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'today' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('today')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'today' && styles.timeRangeTextActive]}>
              Bugün
            </Text>
          </Pressable>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'week' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('week')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'week' && styles.timeRangeTextActive]}>
              Bu Hafta
            </Text>
          </Pressable>
          <Pressable
            style={[styles.timeRangeButton, selectedTimeRange === 'month' && styles.timeRangeActive]}
            onPress={() => setSelectedTimeRange('month')}
          >
            <Text style={[styles.timeRangeText, selectedTimeRange === 'month' && styles.timeRangeTextActive]}>
              Bu Ay
            </Text>
          </Pressable>
        </View>

        {/* Summary Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="brain" size={24} color="#10B981" />
            </View>
            <Text style={styles.statNumber}>{timeRangeStats.count}</Text>
            <Text style={styles.statLabel}>Kayıt</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statNumber}>{stats.avgResistance}</Text>
            <Text style={styles.statLabel}>Ort. Direnç</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.statNumber}>
              {Object.keys(stats.typeDistribution).length}
            </Text>
            <Text style={styles.statLabel}>Farklı Tip</Text>
          </View>
        </View>

        {/* Compulsion List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            {selectedTimeRange === 'today' ? 'Bugünün Kayıtları' : 
             selectedTimeRange === 'week' ? 'Bu Haftanın Kayıtları' : 
             'Bu Ayın Kayıtları'}
          </Text>

          {filteredCompulsions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz kayıt yok</Text>
              <Text style={styles.emptySubtext}>
                Aşağıdaki + butonunu kullanarak ilk kaydını ekle
              </Text>
            </View>
          ) : (
            <>
              {filteredCompulsions.map((compulsion) => {
                const category = COMPULSION_CATEGORIES.find(c => c.id === compulsion.type);
                return (
                  <View key={compulsion.id} style={styles.compulsionCard}>
                    <View style={styles.compulsionHeader}>
                      <View style={styles.compulsionInfo}>
                        <View style={[styles.compulsionIcon, { backgroundColor: getCompulsionColor(compulsion.type) + '20' }]}>
                          <MaterialCommunityIcons 
                            name={getCompulsionIcon(compulsion.type) as any} 
                            size={20} 
                            color={getCompulsionColor(compulsion.type)} 
                          />
                        </View>
                        <View style={styles.compulsionDetails}>
                          <Text style={styles.compulsionType}>{category?.name || 'Diğer'}</Text>
                          <Text style={styles.compulsionTime}>
                            {new Date(compulsion.timestamp).toLocaleTimeString('tr-TR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.compulsionActions}>
                        <View style={[styles.resistanceBadge, { backgroundColor: getResistanceColor(compulsion.resistanceLevel) + '20' }]}>
                          <Text style={[styles.resistanceText, { color: getResistanceColor(compulsion.resistanceLevel) }]}>
                            {compulsion.resistanceLevel}/10
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => deleteEntry(compulsion.id)}
                          style={styles.deleteButton}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                    {compulsion.notes && (
                      <Text style={styles.compulsionNotes}>{compulsion.notes}</Text>
                    )}
                  </View>
                );
              })}

              {/* Show More Button */}
              {todayCompulsions.length > displayLimit && (
                <Pressable
                  style={styles.showMoreButton}
                  onPress={() => setDisplayLimit(prev => prev + 5)}
                >
                  <Text style={styles.showMoreText}>Daha Fazla Göster</Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#4F46E5" />
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FAB 
        icon="plus" 
        onPress={() => setShowQuickEntry(true)}
        style={styles.fab}
      />

      {/* Quick Entry Bottom Sheet */}
      <CompulsionQuickEntry
        visible={showQuickEntry}
        onDismiss={() => setShowQuickEntry(false)}
        onSubmit={handleCompulsionSubmit}
      />

      {/* Toast */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timeRangeActive: {
    backgroundColor: '#10B981',
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  listSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  compulsionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compulsionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compulsionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compulsionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compulsionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  compulsionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter',
  },
  compulsionTime: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  compulsionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resistanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resistanceText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deleteButton: {
    padding: 8,
  },
  compulsionNotes: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Inter',
    lineHeight: 20,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginRight: 4,
    fontFamily: 'Inter',
  },
  fab: {
    position: 'absolute',
    bottom: 90, // Tab bar yüksekliği dikkate alındı
    right: 16,
    zIndex: 999,
    elevation: 8,
  },
});

