import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
// ✅ REMOVED: LinearGradient moved to dashboard
import * as Haptics from 'expo-haptics';


// Components
import ScreenLayout from '@/components/layout/ScreenLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

// MoodQuickEntry removed - mood entry now only through Today page check-in
// TranscriptConfirmationModal removed - using direct empty mood form

// Services & Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';
import { moodDeletionCache } from '@/services/moodDeletionCache';
import { UUID_REGEX } from '@/utils/validators';
import moodTracker from '@/services/moodTrackingService';
// 🚫 AI Pipeline - DISABLED (Sprint 2: Minimal AI Cleanup)
// import * as pipeline from '@/features/ai-fallbacks/pipeline';
// import { unifiedGamificationService } from '@/features/ai-fallbacks/gamification';
// import { moodDataFlowTester } from '@/features/ai-fallbacks/moodDataFlowTester';
import { useGamificationStore } from '@/store/gamificationStore';
import achievementService from '@/services/achievementService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import type { MoodEntry as ServiceMoodEntry } from '@/services/moodTrackingService';
import { sanitizePII } from '@/utils/privacy';
import { secureDataService } from '@/services/encryption/secureDataService';
// 🚫 AI Telemetry & Risk - DISABLED (Sprint 2: Minimal AI Cleanup) 
// import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';
// import { advancedRiskAssessmentService } from '@/features/ai-fallbacks/riskAssessmentService';
import patternPersistenceService from '@/services/patternPersistenceService';
import { getAdvancedMoodColor } from '@/utils/colorUtils';
import voiceCheckInHeuristicService from '@/services/voiceCheckInHeuristicService';
import optimizedStorage from '@/services/optimizedStorage';

// 🚫 Adaptive Suggestions - DISABLED (Sprint 2: Minimal AI Cleanup)
// import { useAdaptiveSuggestion, AdaptiveSuggestion } from '@/features/ai-fallbacks/hooks';
// import AdaptiveSuggestionCard from '@/components/ui/AdaptiveSuggestionCard';  
// import { mapUnifiedResultToRegistryItems, extractUIQualityMeta } from '@/features/ai-fallbacks/insights';


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

function MoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() || {};
  const { user } = useAuth();
  const { t } = useTranslation();

  // State
  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [displayLimit, setDisplayLimit] = useState(5);
  const [accentColor, setAccentColor] = useState<string>('#10B981');
  
  // ✅ REMOVED: Pattern analysis and predictive insights state moved to dashboard
  const [moodPatterns, setMoodPatterns] = useState<any[]>([]); // Still needed for dashboard data generation
  const [predictiveInsights, setPredictiveInsights] = useState<any>(null); // Still needed for dashboard data generation
  
  // 🚫 Adaptive Suggestions State - DISABLED (Hard Stop AI Cleanup)
  // const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<AdaptiveSuggestion | null>(null);
  // const [adaptiveMeta, setAdaptiveMeta] = useState<any>(null); 
  // const { generateSuggestionFromPipeline, trackSuggestionClick, trackSuggestionDismissal, snoozeSuggestion } = useAdaptiveSuggestion();
  
  // 🧪 DEBUG: Mood Data Flow Testing
  const [showMoodDebug, setShowMoodDebug] = useState(false);
  const [debugReport, setDebugReport] = useState<any>(null);

  // 🛡️ RISK ASSESSMENT: Enhanced prediction state
  const [riskAssessmentData, setRiskAssessmentData] = useState<any>(null);

  // Voice Transcript Modal removed - using direct empty mood form

  // Pre-fill from voice check-in if available
  useEffect(() => {
    console.log('📝 Mood page params updated:', {
      prefill: params.prefill,
      source: params.source
    });
    
    // Voice check-in is now handled through VAMoodCheckin in Today page
    if (params.prefill === 'true') {
      console.log('📝 Processing pre-filled data:', params);
      
      // Handle voice check-in specific pre-fill
      if (params.source === 'voice_checkin_analyzed') {
        console.log('🎤 Voice check-in with analysis pre-fill detected:', {
          mood: params.mood,
          energy: params.energy, 
          anxiety: params.anxiety,
          emotion: params.emotion,
          trigger: params.trigger,
          notes: params.notes,
          confidence: params.confidence,
          notesLength: params.notes ? (params.notes as string).length : 0
        });
        
        // 🚀 CRITICAL UX FIX: Auto-save for high confidence voice analysis
        const confidence = params.confidence ? parseFloat(Array.isArray(params.confidence) ? params.confidence[0] : params.confidence) : 0;
        const hasRichContent = params.notes && (params.notes as string).length > 20;
        
        if (confidence >= 0.9 && hasRichContent && user?.id) {
          console.log('🤖 High confidence voice analysis - auto-saving mood entry!', {
            confidence,
            noteLength: (params.notes as string)?.length,
            autoSave: true
          });
          
          // Auto-save for seamless UX
          setTimeout(async () => {
            try {
              const moodScore = params.mood ? parseInt(Array.isArray(params.mood) ? params.mood[0] : params.mood) : 50;
              const energy = params.energy ? parseInt(Array.isArray(params.energy) ? params.energy[0] : params.energy) : 5;
              const anxiety = params.anxiety ? parseInt(Array.isArray(params.anxiety) ? params.anxiety[0] : params.anxiety) : 5;
              
              await handleMoodSubmit({
                mood: moodScore,
                energy,
                anxiety,
                notes: params.notes || '',
                trigger: (Array.isArray(params.trigger) ? params.trigger[0] : params.trigger) || ''
              });
              
              setToastMessage(`🎤 Sesli analiz otomatik kaydedildi! ${params.emotion} mood tespit edildi.`);
              
            } catch (autoSaveError) {
              console.error('❌ Auto-save failed:', autoSaveError);
              setToastMessage(`🎤 Sesli analiz tamamlandı! ${params.emotion} mood tespit edildi. Lütfen kaydetin.`);
              // setShowQuickEntry(true); // Removed - mood entry now through Today page
            }
          }, 1000);
        } else {
          console.log('🎤 Voice analysis - manual confirmation required', {
            confidence,
            noteLength: (params.notes as string)?.length,
            requiresManual: true
          });
          setToastMessage(`🎤 Sesli analiz tamamlandı! ${params.emotion} mood tespit edildi. Lütfen kontrol edin.`);
          // setShowQuickEntry(true); // Removed - mood entry now through Today page
        }
        
        setShowToast(true);
      } else if (params.source === 'voice_checkin_manual') {
        console.log('📝 Voice check-in manual entry (transcript failed)');
        setToastMessage('🎤 Ses kaydınız alındı. Lütfen detayları tamamlayın.');
        setShowToast(true);
        // setShowQuickEntry(true); // Removed - mood entry now through Today page
      } else {
        // setShowQuickEntry(true); // Removed - mood entry now through Today page
      }
      // voice_transcript_needed source removed - no longer using TranscriptConfirmationModal
    }
  }, [params.prefill, params.source]); // Trigger when prefill or source changes

  // Voice Transcript Handlers removed - using direct empty mood form




  // Load mood entries
  // 🔄 FOCUS REFRESH: Reload data when tab gains focus (after multi-intent saves)  
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        console.log('🔄 Mood tab focused, refreshing mood entries...');
        loadMoodEntries();
      }
    }, [user?.id, selectedTimeRange])
  );

  useEffect(() => {
    if (user?.id) {
      loadMoodEntries();
    }
  }, [user?.id, selectedTimeRange]);

  // Load UI color from settings
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('app_settings');
        let mode: 'static' | 'today' | 'weekly' = 'today';
        if (saved) {
          const parsed = JSON.parse(saved);
          mode = (parsed?.colorMode as any) || 'today';
        }
        let score = 55;
        const s = await AsyncStorage.getItem('ui_color_score');
        if (s && !isNaN(Number(s))) score = Number(s);
        const color = mode === 'static' ? '#10B981' : getAdvancedMoodColor(score);
        setAccentColor(color);
      } catch {}
    })();
  }, [user?.id]);

  // Ensure color updates when returning to this tab after settings change
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('app_settings');
          let mode: 'static' | 'today' | 'weekly' = 'today';
          if (saved) {
            const parsed = JSON.parse(saved);
            mode = (parsed?.colorMode as any) || 'today';
          }
          let score = 55;
          const s = await AsyncStorage.getItem('ui_color_score');
          if (s && !isNaN(Number(s))) score = Number(s);
          const color = mode === 'static' ? '#10B981' : getAdvancedMoodColor(score);
          setAccentColor(color);
        } catch {}
      })();
    }, [user?.id])
  );

  // AI pattern persistence removed

  // AI pattern analysis removed

  /**
   * 🧠 PATTERN PERSISTENCE: Load cached patterns from storage
   */
  // AI pattern loading removed

  // AI analytics functions removed
  const loadMoodEntries = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      console.log(`🔄 Loading mood entries (range: ${selectedTimeRange}, user: ${user.id.slice(0, 8)}...)`);
      
      // 🌍 TIMEZONE-AWARE: Get extended period to ensure we capture all entries 
      // then filter by user's timezone to prevent edge cases
      const extendedPeriodDays = selectedTimeRange === 'today' ? 2 : 
                                selectedTimeRange === 'week' ? 10 : 35;
      
      // 🚨 CRITICAL FIX: Add loading context for merge operations
      console.log('📡 Starting mood data fetch and merge...');
      const startTime = Date.now();
      
      // 🔄 Use intelligent merge service to get extended range
      const rawEntries = await moodTracker.getMoodEntries(user.id, extendedPeriodDays);
      
      const loadDuration = Date.now() - startTime;
      console.log(`⚡ Mood data loaded in ${loadDuration}ms (${rawEntries?.length || 0} entries)`);
      
      // 🔍 CONSISTENCY CHECK: Log storage method used
      if (loadDuration < 100) {
        console.log('⚡ Fast load - likely optimized storage path');
      } else {
        console.log('🔄 Slower load - likely traditional storage + merge path');
      }
      
      // Map service MoodEntry to screen MoodEntry format
      const allEntries = (rawEntries || []).map(entry => ({
        id: entry.id,
        mood_score: entry.mood_score,
        energy_level: entry.energy_level,
        anxiety_level: entry.anxiety_level,
        notes: entry.notes || '',
        trigger: entry.triggers && entry.triggers.length > 0 ? entry.triggers[0] : undefined,
        created_at: entry.timestamp,
        user_id: entry.user_id
      }));
      
      // 🌍 TIMEZONE-AWARE: Filter entries by selected time range in user's timezone
      const { filterEntriesByUserTimeRange } = require('@/utils/timezoneUtils');
      const filteredEntries = filterEntriesByUserTimeRange(allEntries, selectedTimeRange);
      
      console.log(`📊 Final mood entries: ${filteredEntries.length} (after timezone filter)`);
      setMoodEntries(filteredEntries);
      
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
    console.log('🔄 Manual refresh triggered by user');
    
    try {
      // 🧹 CRITICAL FIX: Clear cache before refresh for fresh data
      try {
        await optimizedStorage.clearMemoryCache();
        console.log('🧹 Cleared optimized storage cache before refresh');
      } catch (cacheError) {
        console.warn('⚠️ Cache clear failed during refresh:', cacheError);
      }
      
      await loadMoodEntries();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      console.log('✅ Manual refresh completed successfully');
    } catch (refreshError) {
      console.error('❌ Manual refresh failed:', refreshError);
      setToastMessage('Yenileme başarısız');
      setShowToast(true);
    } finally {
      setRefreshing(false);
    }
  };

    // ✅ REMOVED: analyzeMoodPatterns function moved to dashboard

    // ✅ REMOVED: runPredictiveMoodIntervention function moved to dashboard

  // ✅ MOVED TO DASHBOARD: Helper functions moved to UserCentricMoodDashboard

  // Helper function to get mood color based on score
  const getMoodColor = (score: number): string => {
    if (score >= 90) return '#EC4899'; // Heyecanlı
    if (score >= 80) return '#8B5CF6'; // Enerjik
    if (score >= 70) return '#10B981'; // Mutlu
    if (score >= 60) return '#06B6D4'; // Sakin
    if (score >= 50) return '#84CC16'; // Normal
    if (score >= 40) return '#EAB308'; // Endişeli
    if (score >= 30) return '#F97316'; // Sinirli
    if (score >= 20) return '#3B82F6'; // Üzgün
    return '#EF4444'; // Kızgın
  };

  // Helper function to get mood label based on score
  const getMoodLabel = (score: number): string => {
    if (score >= 90) return 'Heyecanlı';
    if (score >= 80) return 'Enerjik';
    if (score >= 70) return 'Mutlu';
    if (score >= 60) return 'Sakin';
    if (score >= 50) return 'Normal';
    if (score >= 40) return 'Endişeli';
    if (score >= 30) return 'Sinirli';
    if (score >= 20) return 'Üzgün';
    return 'Kızgın';
  };

  // 🧪 DEBUG: Test mood data flow

  // Edit functionality removed - mood entries can only be added through Today page check-in

  const handleDeleteEntry = async (entryId: string) => {
    try {
      console.log('🗑️ Deleting mood entry:', entryId);

      // Confirm delete with user
      Alert.alert(
        'Kaydı Sil',
        'Bu mood kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
        [
          {
            text: 'İptal',
            style: 'cancel',
          },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              try {
                const entryToDelete = moodEntries.find(e => e.id === entryId);
                if (!entryToDelete) {
                  setToastMessage('Kayıt bulunamadı');
                  setShowToast(true);
                  return;
                }

                // Track delete action before deletion
                // await trackAIInteraction('MOOD_ENTRY_DELETE', {
                //   entryId: entryId,
                //   mood: entryToDelete.mood_score,
                //   energy: entryToDelete.energy_level,
                //   anxiety: entryToDelete.anxiety_level
                // });

                if (user) {
                  // 🔄 CRITICAL FIX: Remote-First Deletion for Intelligent Merge
                  console.log('🌐 DELETION FLOW: Remote → Local (prevents intelligent merge restore)');
                  
                  try {
                    // 🟢 STEP 1: Delete from REMOTE first (prevents intelligent merge restore)
                    console.log('🌐 Step 1: Deleting from remote server...');
                    await supabaseService.deleteMoodEntry(entryId);
                    console.log('✅ Remote deletion successful - intelligent merge safe');

                  } catch (serverError) {
                    console.warn('⚠️ Remote deletion failed, using PRIORITY sync queue:', serverError);
                    
                    // 🚨 PRIORITY SYNC: Add to front of queue for immediate retry
                    if (UUID_REGEX.test(entryId)) {
                      await offlineSyncService.addToSyncQueue({
                        type: 'DELETE',
                        entity: 'mood_entry',
                        data: {
                          id: entryId,
                          user_id: user.id,
                          priority: 'high', // High priority for deletions
                          deleteReason: 'user_initiated' // Track deletion reason
                        }
                      });
                      console.log('📤 Added to HIGH PRIORITY delete queue');
                      
                      // 🔥 IMMEDIATE PROCESSING: Try to sync deletion right away
                      try {
                        console.log('⚡ Triggering immediate sync queue processing...');
                        await offlineSyncService.processSyncQueue();
                        console.log('🔥 Immediate sync queue processing completed');
                      } catch (immediateError) {
                        console.warn('⚠️ Immediate sync failed, will retry later:', immediateError);
                      }
                      
                      try {
                        // await trackAIInteraction(AIEventType.DELETE_QUEUED_OFFLINE, {
                        //   entity: 'mood_entry', id: entryId, userId: user.id, priority: 'high'
                        // }, user.id);
                      } catch {}
                    } else {
                      console.log('⏭️ Skipping remote queue for local-only ID:', entryId);
                    }
                  }

                  // Delete from local service
                  await moodTracker.deleteMoodEntry(entryId);
                  console.log('✅ Mood entry deleted from local storage');

                  // 🗑️ MARK AS DELETED: Prevent IntelligentMerge from restoring
                  await moodDeletionCache.markAsDeleted(entryId, user.id, 'user_initiated');
                  console.log('✅ Entry marked as deleted in cache - IntelligentMerge will ignore');

                  // 🔍 DEBUG: Verify deletion worked
                  console.log(`🔍 Verifying deletion of entry: ${entryId}`);
                  
                  // Remove from current state immediately
                  setMoodEntries(prev => {
                    const filtered = prev.filter(entry => entry.id !== entryId);
                    console.log(`🔍 UI state updated: ${prev.length} -> ${filtered.length} entries`);
                    return filtered;
                  });

                  // Show success message
                  setToastMessage('Mood kaydı silindi');
                  setShowToast(true);

                  // Haptic feedback
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                  // 🔄 DELAY: Give time for deletion to propagate before refresh
                  console.log('⏳ Waiting for deletion to propagate...');
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // 🔍 DEBUG: Check LOCAL storage only (bypass intelligent merge)
                  try {
                    console.log('🔍 Verifying deletion in local storage only...');
                    const localOnlyExists = await moodTracker.checkEntryExistsInLocalStorage(entryId);
                    console.log(`🔍 Local storage check: Entry ${entryId} still exists: ${localOnlyExists}`);
                    
                    if (localOnlyExists) {
                      console.error('❌ DELETION BUG: Entry still exists in local storage after deletion!');
                      // Try to delete again with force flag
                      console.log('🔄 Attempting FORCE deletion...');
                      await moodTracker.forceDeleteMoodEntry(entryId);
                    } else {
                      console.log('✅ Entry successfully removed from local storage');
                    }
                  } catch (checkError) {
                    console.warn('⚠️ Could not verify local deletion:', checkError);
                  }

                  // Trigger refresh to update any dependent data
                  await loadMoodEntries();

                  // 💾 PATTERN PERSISTENCE: Invalidate pattern cache after entry deletion
                  try {
                    await patternPersistenceService.invalidateCache(user.id);
                    console.log('💾 Pattern cache invalidated after mood entry deletion');
                    
                    // 📊 TELEMETRY: Track cache invalidation for delete
                    // await trackAIInteraction(AIEventType.PATTERN_CACHE_INVALIDATED, {
                    //   userId: user.id,
                    //   reason: 'mood_entry_deleted',
                    //   entryId: entryId,
                    //   timestamp: Date.now()
                    // });
                    
                  } catch (patternCacheError) {
                    console.warn('⚠️ Pattern cache invalidation failed after delete (non-blocking):', patternCacheError);
                  }

                } else {
                  // 📱 OFFLINE MODE: Local deletion + Queue for later remote sync
                  console.log('📱 DELETION FLOW: Offline mode - Local → Queue');
                  
                  // Queue remote deletion for when connection returns
                  if (UUID_REGEX.test(entryId)) {
                    await offlineSyncService.addToSyncQueue({
                      type: 'DELETE',
                      entity: 'mood_entry',
                      data: {
                        id: entryId,
                        user_id: user.id,
                        priority: 'high',
                        deleteReason: 'user_initiated_offline'
                      }
                    });
                    console.log('📤 Added offline deletion to priority queue');
                  }
                  
                  // Remove from local storage
                  await moodTracker.deleteMoodEntry(entryId);
                  
                  // 🗑️ MARK AS DELETED: Prevent IntelligentMerge from restoring (offline mode)
                  await moodDeletionCache.markAsDeleted(entryId, user.id, 'user_initiated_offline');
                  console.log('✅ Entry marked as deleted in cache (offline mode)');
                  
                  // Remove from UI state immediately
                  setMoodEntries(prev => prev.filter(entry => entry.id !== entryId));
                  
                  setToastMessage('Mood kaydı offline silindi (senkronizasyon bekliyor)');
                  setShowToast(true);

                  // 💾 PATTERN PERSISTENCE: Invalidate pattern cache after offline deletion
                  try {
                    await patternPersistenceService.invalidateCache(user.id);
                    console.log('💾 Pattern cache invalidated after offline mood entry deletion');
                    
                    // 📊 TELEMETRY: Track cache invalidation for offline delete
                    // await trackAIInteraction(AIEventType.PATTERN_CACHE_INVALIDATED, {
                    //   userId: user.id,
                    //   reason: 'mood_entry_deleted_offline',
                    //   entryId: entryId,
                    //   timestamp: Date.now()
                    // });
                    
                  } catch (patternCacheError) {
                    console.warn('⚠️ Pattern cache invalidation failed after offline delete (non-blocking):', patternCacheError);
                  }
                }

              } catch (deleteError) {
                console.error('❌ Failed to delete mood entry:', deleteError);
                setToastMessage('Kayıt silinemedi');
                setShowToast(true);
              }
            },
          },
        ],
        { cancelable: true }
      );

    } catch (error) {
      console.error('❌ Failed to initiate delete:', error);
      setToastMessage('Silme işlemi başlatılamadı');
      setShowToast(true);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    if (moodEntries.length === 0) {
      return {
        avgMood: 0,
        avgEnergy: 0,
        avgAnxiety: 0,
        totalEntries: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      };
    }

    const avgMood = moodEntries.reduce((sum, e) => sum + e.mood_score, 0) / moodEntries.length;
    const avgEnergy = moodEntries.reduce((sum, e) => sum + e.energy_level, 0) / moodEntries.length;
    const avgAnxiety = moodEntries.reduce((sum, e) => sum + e.anxiety_level, 0) / moodEntries.length;

    // Calculate trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (moodEntries.length >= 2) {
      const recent = moodEntries.slice(0, Math.ceil(moodEntries.length / 2));
      const older = moodEntries.slice(Math.ceil(moodEntries.length / 2));
      
      const recentAvg = recent.reduce((sum, e) => sum + e.mood_score, 0) / recent.length;
      const olderAvg = older.reduce((sum, e) => sum + e.mood_score, 0) / older.length;
      
      trend = recentAvg > olderAvg + 5 ? 'up' : 
              recentAvg < olderAvg - 5 ? 'down' : 'stable';
    }

    return { 
      avgMood: Math.round(avgMood), 
      avgEnergy: Math.round(avgEnergy), 
      avgAnxiety: Math.round(avgAnxiety),
      totalEntries: moodEntries.length, 
      trend 
    };
  };

  const stats = calculateStats();

  // 🔒 RISK ASSESSMENT: Enhanced prediction with riskAssessmentService integration



  // Handler Functions - Mood submission now only through Today page check-in
  const handleMoodSubmit = async (moodData: any) => {
    // This function is deprecated - mood entries are now only created through Today page check-in
    console.warn('⚠️ handleMoodSubmit called but mood entries should only be created through Today page check-in');
    return;
    /* Disabled - mood entries now only through Today page
    try {
      if (!user?.id) {
        setToastMessage('Kullanıcı oturumu bulunamadı');
        setShowToast(true);
        return;
      }

      // Map field names to match database schema
      const entryData = {
        mood_score: moodData.mood || moodData.mood_score,
        energy_level: moodData.energy || moodData.energy_level || 50,
        anxiety_level: moodData.anxiety || moodData.anxiety_level || 50,
        notes: moodData.notes || '',
        trigger: moodData.trigger || '',
        user_id: user.id,
        created_at: new Date().toISOString()
      };

      /* Editing disabled
      if (editingEntry) {
        // 🚨 CRITICAL FIX: Ensure we have valid user ID for edit operations
        if (!user?.id) {
          console.error('❌ No authenticated user for mood entry edit');
          setToastMessage('Kullanıcı doğrulanamadı, giriş yapın');
          setShowToast(true);
          return;
        }
        
        console.log('📝 Updating mood entry:', editingEntry.id, {
          userId: user.id.slice(0, 8) + '...',
          newData: entryData
        });
        
        // 🔄 CONSISTENCY FIX: Use moodTracker for both create AND edit to ensure local+remote sync
        try {
          // 🚨 CRITICAL FIX: Pass user ID as override parameter to prevent "unknown" error
          await moodTracker.updateMoodEntry(editingEntry.id, {
            mood_score: entryData.mood_score,
            energy_level: entryData.energy_level,
            anxiety_level: entryData.anxiety_level,
            notes: entryData.notes,
            triggers: entryData.trigger ? [entryData.trigger] : []
          }, user.id); // Pass user.id as third parameter to override internal getCurrentUserId()
          
          setToastMessage('Mood kaydı güncellendi ✅');
          
          // Refresh mood entries to reflect changes
          await handleRefresh();
        } catch (updateError) {
          console.error('❌ Edit via moodTracker failed, trying direct Supabase:', updateError);
          
          // Enhanced error context
          const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
          if (errorMessage.includes('User authentication required')) {
            setToastMessage('Düzenleme için giriş gerekli');
          } else if (errorMessage.includes('not found')) {
            setToastMessage('Kayıt bulunamadı - sayfa yenilenecek');
            await handleRefresh(); // Refresh to sync state
          } else {
            // Fallback to direct Supabase update
            try {
              await supabaseService.updateMoodEntry(editingEntry.id, entryData);
              setToastMessage('Mood kaydı güncellendi (direct) ✅');
              
              // Update local state manually  
              setMoodEntries(prev => prev.map(entry => 
                entry.id === editingEntry.id ? { ...entry, ...entryData } : entry
              ));
            } catch (directUpdateError) {
              console.error('❌ Direct Supabase update also failed:', directUpdateError);
              setToastMessage('Güncelleme başarısız - tekrar deneyin');
            }
          }
        }
        } else {
        // Create new entry
        try {
          // 🔄 VOICE CHECK-IN FIX: Add source tracking to prevent duplicate creation
          const moodEntryData = {
            mood_score: entryData.mood_score,
            energy_level: entryData.energy_level || 50,
            anxiety_level: entryData.anxiety_level || 50,
            notes: entryData.notes || '',
            triggers: entryData.trigger ? [entryData.trigger] : [], // Convert string to array
            activities: [], // Default empty array
            user_id: user.id,
            // 🎙️ VOICE SOURCE TRACKING: Track if this came from voice check-in
            ...(params.source === 'voice_checkin_analyzed' && {
              source: 'voice_checkin_analyzed',
              voice_confidence: params.confidence ? parseFloat(Array.isArray(params.confidence) ? params.confidence[0] : params.confidence) : undefined,
              voice_duration: params.voice_duration ? parseInt(Array.isArray(params.voice_duration) ? params.voice_duration[0] : params.voice_duration) : undefined,
            })
          };
          
          console.log('💾 Creating mood entry:', {
            source: params.source,
            hasVoiceData: !!params.voice_duration,
            noteLength: entryData.notes?.length || 0
          });
          
          const savedEntry = await moodTracker.saveMoodEntry(moodEntryData);
          
          if (savedEntry) {
            setToastMessage('Mood kaydı oluşturuldu ✅');
            await loadMoodEntries();
      } else {
            throw new Error('Failed to save mood entry');
          }
        } catch (createError: any) {
          // 🛡️ DUPLICATE HANDLING: Handle idempotency prevention gracefully
          if (createError.code === 'DUPLICATE_PREVENTED') {
            console.log('🛡️ UI: Duplicate prevented, showing user-friendly message');
            setToastMessage('Bu kayıt zaten mevcut! Benzer bir entry az önce yapılmış 🔄');
            
            // DON'T reload - prevents duplicate UI entries
          } else {
            console.error('❌ Mood creation failed:', createError);
            setToastMessage('Kayıt oluşturma başarısız: ' + (createError.message || 'Bilinmeyen hata'));
          }
        }
      }

      setShowToast(true);
      // setShowQuickEntry(false);
      // setEditingEntry(null);
      
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to save mood entry:', error);
      setToastMessage('Mood kaydı kaydedilemedi ❌');
      setShowToast(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    */
  };

  // Helper function moved inline to fix scope
  const filteredEntries = moodEntries.slice(0, displayLimit);

  return (
    <ScreenLayout>
      {/* Header - Mood Takibi */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Mood Takibi</Text>
          <View style={styles.headerRight} />
        </View>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('today');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'today' && [styles.tabTextActive, { color: accentColor }]]}>
              Bugün
            </Text>
            {selectedTimeRange === 'today' && <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('week');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'week' && [styles.tabTextActive, { color: accentColor }]]}>
              Hafta
            </Text>
            {selectedTimeRange === 'week' && <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} />}
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => {
              setSelectedTimeRange('month');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedTimeRange === 'month' && [styles.tabTextActive, { color: accentColor }]]}>
              Ay
            </Text>
            {selectedTimeRange === 'month' && <View style={[styles.tabIndicator, { backgroundColor: accentColor }]} />}
          </Pressable>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EC4899"
          />
        }
      >
        {/* Date Display */}
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}
        </Text>

        {/* Mood Entries List */}
        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Mood Kayıtları</Text>
          </View>

          {filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="emoticon-sad-outline" size={48} color="#E5E7EB" />
              <Text style={styles.emptyText}>Henüz mood kaydı yok</Text>
              <Text style={styles.emptySubtext}>
                Today sayfasından "Check-in Yap" butonuna tıklayarak mood kaydı oluşturabilirsiniz
              </Text>
            </View>
          ) : (
            <View style={styles.recordingsContainer}>
              {filteredEntries.map((entry) => {
                const moodColor = entry.mood_score >= 70 ? '#10B981' : 
                                 entry.mood_score >= 40 ? '#F59E0B' : '#EF4444';
                
                return (
                  <View key={`${entry.id}-${entry.created_at}`} style={styles.recordingCard}>
                    <View style={styles.recordingContent}>
                      <View style={styles.recordingHeader}>
                        <View style={styles.recordingInfo}>
                          <MaterialCommunityIcons 
                            name="emoticon-outline" 
                            size={20} 
                            color={moodColor} 
                          />
                          <Text style={styles.recordingTime}>
                            {new Date(entry.created_at).toLocaleTimeString('tr-TR', { 
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </Text>
                        </View>
                        <View style={styles.recordingScores}>
                          <Text style={[styles.moodScore, { color: moodColor }]}>
                            {entry.mood_score}/100
                          </Text>
                        </View>
                      </View>
                      {entry.notes && (
                        <Text style={styles.recordingNotes} numberOfLines={2}>
                          {entry.notes}
                        </Text>
                      )}
                      <View style={styles.recordingMetrics}>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="lightning-bolt" size={16} color="#6B7280" />
                          <Text style={styles.metricText}>Enerji: {entry.energy_level}</Text>
                    </View>
                        <View style={styles.metricItem}>
                          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#6B7280" />
                          <Text style={styles.metricText}>Kaygı: {entry.anxiety_level}</Text>
                        </View>
                      </View>
                      <View style={styles.recordingActions}>
                        <Pressable 
                          style={styles.actionButton}
                          onPress={() => handleDeleteEntry(entry.id)}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Load More Button */}
          {moodEntries.length > displayLimit && (
              <Pressable
              style={styles.loadMoreButton}
              onPress={() => setDisplayLimit(displayLimit + 5)}
            >
              <Text style={styles.loadMoreText}>Daha Fazla Göster</Text>
              </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Mood entry modal removed - now only through Today page check-in */}

      {/* Toast Notification */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type="success"
        onHide={() => setShowToast(false)}
      />

      {/* Debug Modal */}
      {showMoodDebug && debugReport && (
        <Modal
          visible={showMoodDebug}
          transparent
          animationType="slide"
          onRequestClose={() => setShowMoodDebug(false)}
        >
          <View style={styles.debugModal}>
            <View style={styles.debugContent}>
              <Text style={styles.debugTitle}>Mood Data Flow Test</Text>
              <ScrollView>
                <Text style={styles.debugText}>{JSON.stringify(debugReport, null, 2)}</Text>
              </ScrollView>
              <Button
                title="Kapat"
                onPress={() => setShowMoodDebug(false)}
              />
            </View>
          </View>
        </Modal>
      )}
    </ScreenLayout>
  );
}

export default MoodScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#EC4899',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '80%',
    backgroundColor: '#EC4899',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },

  listSection: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  addMoodButton: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 110,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  recordingsContainer: {
    marginTop: 8,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  recordingContent: {
    padding: 16,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  recordingScores: {
    flexDirection: 'row',
    gap: 8,
  },
  moodScore: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordingNotes: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  recordingMetrics: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: '#6B7280',
  },
  recordingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  loadMoreButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EC4899',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
  },
  debugModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  debugContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: 'monospace',
  },
});

// No additional exports needed
