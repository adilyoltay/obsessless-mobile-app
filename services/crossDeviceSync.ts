import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import supabaseService from '@/services/supabase';

// Try to import expo-device, fallback if not available
let Device: any = null;
try {
  Device = require('expo-device');
} catch (e) {
  console.log('expo-device not available, using fallback');
}

export interface SyncResult {
  successful: number;
  failed: number;
  conflicts: number;
  lastSyncTime: number;
}

class CrossDeviceSyncService {
  private static instance: CrossDeviceSyncService;
  private deviceId: string | null = null;
  private deviceName: string = '';
  private lastSyncTimestamp: number = 0;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  public static getInstance(): CrossDeviceSyncService {
    if (!CrossDeviceSyncService.instance) {
      CrossDeviceSyncService.instance = new CrossDeviceSyncService();
    }
    return CrossDeviceSyncService.instance;
  }

  constructor() {
    this.initializeDevice();
    this.setupAutoSync();
  }

  private async initializeDevice(): Promise<void> {
    try {
      let storedDeviceId = await AsyncStorage.getItem('device_id');
      if (!storedDeviceId) {
        storedDeviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', storedDeviceId);
      }
      this.deviceId = storedDeviceId;
      this.deviceName = Device?.deviceName || Device?.modelName || Platform.OS || 'Unknown Device';
      
      const lastSync = await AsyncStorage.getItem('last_sync_time');
      if (lastSync) {
        this.lastSyncTimestamp = parseInt(lastSync, 10);
      }
      console.log(`📱 Device: ${this.deviceName} (${this.deviceId})`);
    } catch (error) {
      console.error('Error initializing device:', error);
    }
  }

  private setupAutoSync(): void {
    NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isSyncing) {
        this.performSync();
      }
    });

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, 5 * 60 * 1000);
  }

  public async performSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        successful: 0,
        failed: 0,
        conflicts: 0,
        lastSyncTime: this.lastSyncTimestamp,
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      successful: 0,
      failed: 0,
      conflicts: 0,
      lastSyncTime: Date.now(),
    };

    try {
      console.log('🔄 Starting cross-device sync...');
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('📵 No network connection');
        return result;
      }

      const currentUser = supabaseService.getCurrentUser();
      if (!currentUser) {
        console.log('👤 No user logged in');
        return result;
      }

      await this.syncData(currentUser.id, result);
      
      this.lastSyncTimestamp = result.lastSyncTime;
      await AsyncStorage.setItem('last_sync_time', this.lastSyncTimestamp.toString());
      
      console.log(`✅ Sync: ${result.successful} OK, ${result.failed} failed`);
    } catch (error) {
      console.error('❌ Sync error:', error);
      result.failed++;
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async syncData(userId: string, result: SyncResult): Promise<void> {
    const dataTypes = ['compulsions', 'erp_sessions', 'thought_records', 'voice_checkins', 'mood_entries'];
    
    for (const dataType of dataTypes) {
      try {
        const localKey = `${dataType}_${userId}`;
        const localData = await AsyncStorage.getItem(localKey);
        const localItems = localData ? JSON.parse(localData) : [];
        
        // Only attempt to upload items that are explicitly marked as unsynced
        // and do NOT already have a remote id. Items loaded from Supabase
        // (and cached locally) include an id and should be treated as synced.
        const unsyncedItems = localItems.filter((item: any) => !item.synced && !item.id);
        
        for (const item of unsyncedItems) {
          try {
            // User ID'yi item'a ekle
            if (!item.userId && !item.user_id) {
              item.userId = userId;
            }
            await this.uploadItem(dataType, item, userId);
            item.synced = true;
            item.deviceId = this.deviceId;
            result.successful++;
          } catch (error) {
            console.error(`Sync failed for ${dataType}:`, error);
            result.failed++;
          }
        }
        
        if (unsyncedItems.length > 0) {
          await AsyncStorage.setItem(localKey, JSON.stringify(localItems));
        }
      } catch (error) {
        console.error(`Error syncing ${dataType}:`, error);
        result.failed++;
      }
    }
  }

  private async uploadItem(dataType: string, item: any, userId: string): Promise<void> {
    const { sanitizePII } = await import('@/utils/privacy');
    switch (dataType) {
      case 'compulsions':
        // Map field names from camelCase to snake_case
        const compulsionData = {
          user_id: item.userId || item.user_id || userId,
          category: item.type || item.category,
          subcategory: item.subcategory || item.type,
          resistance_level: item.resistanceLevel || item.resistance_level || 0,
          trigger: item.trigger || '',
          notes: sanitizePII(item.notes || '')
        };
        await supabaseService.saveCompulsion(compulsionData);
        break;
      case 'erp_sessions':
        // Map field names if needed
        const erpData = {
          user_id: item.userId || item.user_id || userId,
          category: item.category,
          subcategory: item.subcategory || item.category,
          duration: item.duration || 0,
          anxiety_level_before: item.anxietyLevelBefore || item.anxiety_level_before || 0,
          anxiety_level_after: item.anxietyLevelAfter || item.anxiety_level_after || 0,
          notes: sanitizePII(item.notes || '')
        };
        await supabaseService.saveERPSession(erpData);
        break;
      case 'thought_records':
        if (item.thought && item.distortions) {
          // CBT record format - map field names
          const cbtData = {
            user_id: item.userId || item.user_id || userId,
            thought: sanitizePII(item.thought || ''),
            distortions: item.distortions,
            evidence_for: item.evidenceFor || item.evidence_for || '',
            evidence_against: item.evidenceAgainst || item.evidence_against || '',
            reframe: sanitizePII(item.reframe || ''),
            mood_before: item.moodBefore || item.mood_before || 5,
            mood_after: item.moodAfter || item.mood_after || 5,
            trigger: item.trigger || '',
            notes: sanitizePII(item.notes || '')
          };
          await supabaseService.saveCBTRecord(cbtData);
        } else if (item.automatic_thought || item.automaticThought) {
          // Regular thought record format
          const thoughtData = {
            user_id: item.userId || item.user_id || userId,
            automatic_thought: sanitizePII(item.automaticThought || item.automatic_thought || ''),
            emotions: item.emotions || [],
            balanced_thought: sanitizePII(item.balancedThought || item.balanced_thought || '')
          };
          await supabaseService.saveThoughtRecord(thoughtData);
        }
        break;
      case 'voice_checkins':
        // Map field names if needed
        const voiceData = {
          user_id: item.userId || item.user_id || userId,
          text: sanitizePII(item.text || ''),
          mood: item.mood || 0,
          trigger: item.trigger || '',
          confidence: item.confidence || 0,
          lang: item.lang || 'tr-TR',
          created_at: item.created_at || item.timestamp || new Date().toISOString(),
        };
        await supabaseService.saveVoiceCheckin(voiceData);
        break;
      case 'mood_entries':
        // Map field names if needed
        const moodData = {
          user_id: item.userId || item.user_id || userId,
          mood_score: item.moodScore || item.mood_score || 5,
          energy_level: item.energyLevel || item.energy_level || 5,
          anxiety_level: item.anxietyLevel || item.anxiety_level || 5,
          notes: sanitizePII(item.notes || '')
        };
        await supabaseService.saveMoodEntry(moodData);
        break;
    }
  }

  public async triggerManualSync(): Promise<SyncResult> {
    console.log('👆 Manual sync triggered');
    return this.performSync();
  }

  public getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTimestamp,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
    };
  }

  public cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const crossDeviceSync = CrossDeviceSyncService.getInstance();
export default CrossDeviceSyncService;