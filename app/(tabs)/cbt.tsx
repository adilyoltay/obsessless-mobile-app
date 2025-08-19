import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
  Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import FAB from '@/components/ui/FAB';
import VoiceMoodCheckin from '@/components/checkin/VoiceMoodCheckin';

// Hooks & Context
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { StorageKeys } from '@/utils/storage';

const { width } = Dimensions.get('window');

interface ThoughtRecord {
  id: string;
  thought: string;
  distortions: string[];
  evidenceFor: string;
  evidenceAgainst: string;
  reframe: string;
  timestamp: Date;
  mood_before: number;
  mood_after: number;
}

export default function CBTScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // States
  const [showCheckin, setShowCheckin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [thoughtRecords, setThoughtRecords] = useState<ThoughtRecord[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Animation
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  // Voice trigger'dan gelindiyse otomatik aç
  useEffect(() => {
    if (params.trigger === 'voice' && params.text) {
      setShowCheckin(true);
    }
  }, [params]);
  
  // Load thought records
  useEffect(() => {
    if (user?.id) {
      loadThoughtRecords();
    }
    
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [user?.id]);
  
  const loadThoughtRecords = async () => {
    if (!user?.id) return;
    
    try {
      const key = StorageKeys.THOUGHT_RECORDS?.(user.id) || `thought_records_${user.id}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const records = JSON.parse(data);
        // Son 30 günün kayıtları
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentRecords = records.filter((r: ThoughtRecord) => 
          new Date(r.timestamp) > thirtyDaysAgo
        ).sort((a: ThoughtRecord, b: ThoughtRecord) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setThoughtRecords(recentRecords);
      }
    } catch (error) {
      console.error('Error loading thought records:', error);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadThoughtRecords();
    setRefreshing(false);
  };
  
  const handleFABPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCheckin(true);
  };
  
  const handleRecordSaved = () => {
    setShowCheckin(false);
    loadThoughtRecords();
    setToastMessage('Düşünce kaydı başarıyla eklendi');
    setShowToast(true);
  };
  
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="head-heart-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>Henüz düşünce kaydın yok</Text>
      <Text style={styles.emptyDescription}>
        Olumsuz düşüncelerini kaydet ve yeniden çerçevele.
        CBT teknikleriyle bilişsel çarpıtmalarını fark et.
      </Text>
      <Button
        variant="primary"
        onPress={handleFABPress}
        style={styles.emptyButton}
        leftIcon={<MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />}
      >
        İlk Kaydını Oluştur
      </Button>
    </View>
  );
  
  const renderThoughtCard = (record: ThoughtRecord) => {
    const moodImprovement = record.mood_after - record.mood_before;
    const improvementColor = moodImprovement > 0 ? '#10B981' : '#6B7280';
    
    return (
      <Card key={record.id} style={styles.thoughtCard}>
        <View style={styles.thoughtHeader}>
          <View style={styles.thoughtMeta}>
            <MaterialCommunityIcons name="calendar" size={14} color="#6B7280" />
            <Text style={styles.thoughtDate}>
              {new Date(record.timestamp).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={styles.moodChange}>
            <Text style={styles.moodChangeLabel}>Mood:</Text>
            <Text style={styles.moodBefore}>{record.mood_before}</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#6B7280" />
            <Text style={[styles.moodAfter, { color: improvementColor }]}>
              {record.mood_after}
            </Text>
            {moodImprovement > 0 && (
              <Text style={[styles.moodImprovement, { color: improvementColor }]}>
                +{moodImprovement}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.thoughtContent}>
          <Text style={styles.thoughtLabel}>Olumsuz Düşünce:</Text>
          <Text style={styles.thoughtText}>{record.thought}</Text>
        </View>
        
        {record.distortions.length > 0 && (
          <View style={styles.distortionsContainer}>
            <Text style={styles.thoughtLabel}>Bilişsel Çarpıtmalar:</Text>
            <View style={styles.distortionTags}>
              {record.distortions.map((distortion, index) => (
                <View key={index} style={styles.distortionTag}>
                  <Text style={styles.distortionTagText}>{distortion}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        <View style={styles.reframeContainer}>
          <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#3B82F6" />
          <View style={styles.reframeContent}>
            <Text style={styles.reframeLabel}>Yeniden Çerçeveleme:</Text>
            <Text style={styles.reframeText}>{record.reframe}</Text>
          </View>
        </View>
      </Card>
    );
  };
  
  const renderStats = () => {
    if (thoughtRecords.length === 0) return null;
    
    const totalRecords = thoughtRecords.length;
    const avgMoodImprovement = thoughtRecords.reduce((sum, r) => 
      sum + (r.mood_after - r.mood_before), 0
    ) / totalRecords;
    
    const mostCommonDistortion = thoughtRecords
      .flatMap(r => r.distortions)
      .reduce((acc, d) => {
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const topDistortion = Object.entries(mostCommonDistortion)
      .sort(([,a], [,b]) => b - a)[0];
    
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="file-document-outline" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{totalRecords}</Text>
          <Text style={styles.statLabel}>Toplam Kayıt</Text>
        </View>
        
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="trending-up" size={24} color="#10B981" />
          <Text style={styles.statValue}>+{avgMoodImprovement.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Ort. İyileşme</Text>
        </View>
        
        {topDistortion && (
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="brain" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{topDistortion[1]}</Text>
            <Text style={styles.statLabel}>{topDistortion[0].substring(0, 10)}</Text>
          </View>
        )}
      </View>
    );
  };
  
  return (
    <ScreenLayout>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>CBT Düşünce Kaydı</Text>
              <Text style={styles.headerSubtitle}>
                Olumsuz düşüncelerini yeniden çerçevele
              </Text>
            </View>
            <MaterialCommunityIcons name="head-heart" size={32} color="#3B82F6" />
          </View>
          
          {/* Stats */}
          {renderStats()}
          
          {/* Thought Records */}
          {thoughtRecords.length > 0 ? (
            <View style={styles.recordsList}>
              {thoughtRecords.map(renderThoughtCard)}
            </View>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
        
        {/* FAB */}
        {!showCheckin && (
          <FAB
            icon="plus"
            onPress={handleFABPress}
            style={styles.fab}
            accessibilityLabel="Yeni düşünce kaydı ekle"
          />
        )}
        
        {/* Voice Mood Checkin Modal */}
        {showCheckin && (
          <VoiceMoodCheckin
            isVisible={showCheckin}
            onClose={() => setShowCheckin(false)}
            onSave={handleRecordSaved}
            initialText={params.text as string}
            mode="cbt"
          />
        )}
        
        {/* Toast */}
        <Toast
          message={toastMessage}
          type="success"
          visible={showToast}
          onHide={() => setShowToast(false)}
        />
      </Animated.View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 1,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  recordsList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  thoughtCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thoughtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  thoughtMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thoughtDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  moodChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moodChangeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  moodBefore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  moodAfter: {
    fontSize: 14,
    fontWeight: '700',
  },
  moodImprovement: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  thoughtContent: {
    marginBottom: 12,
  },
  thoughtLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  thoughtText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  distortionsContainer: {
    marginBottom: 12,
  },
  distortionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  distortionTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distortionTagText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  reframeContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  reframeContent: {
    flex: 1,
  },
  reframeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  reframeText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
});
