import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import supabaseService from '@/services/supabase';
import { generatePrefixedId } from '@/utils/idGenerator';

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
  // 🧹 MEMORY LEAK FIX: Store NetInfo listener for cleanup
  private netInfoUnsubscribe?: () => void;

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
        // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
        storedDeviceId = generatePrefixedId('device');
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
    // 🧹 MEMORY LEAK FIX: Store unsubscribe function for cleanup
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
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
    const dataTypes = ['voice_checkins', 'mood_entries'];
    
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
      // compulsion sync removed
      // ✅ REMOVED: erp_sessions case - ERP module deleted
      // thought_records sync removed
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
    console.log('🧹 CrossDeviceSyncService: Starting cleanup...');
    
    // 1. Clear sync interval to prevent recurring syncs
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('✅ Sync interval cleared');
    }
    
    // 2. Remove NetInfo listener to prevent memory leak
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = undefined;
      console.log('✅ NetInfo listener removed');
    }
    
    // 3. Stop any active sync operations
    this.isSyncing = false;
    
    // 4. Reset sync timestamp
    this.lastSyncTimestamp = 0;
    
    console.log('✅ CrossDeviceSyncService cleanup completed');
  }
}

export const crossDeviceSync = CrossDeviceSyncService.getInstance();
export default CrossDeviceSyncService;