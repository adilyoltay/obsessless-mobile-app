/**
 * Senkronizasyon Çakışma Stratejileri ve Tipleri
 * Proje Anayasası ile uyumlu; offline-first ve privacy-first.
 */

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins', // Varsayılan
  CLIENT_WINS = 'client_wins',         // Offline veri öncelikli
  SERVER_WINS = 'server_wins',         // Sunucu verisi öncelikli
  MANUAL_MERGE = 'manual_merge'        // Kullanıcıya sor
}

export type SyncEntityType = 'user_profile' | 'mood_entry' | 'voice_checkin' | 'achievement' | 'ai_profile' | 'treatment_plan';

export interface SyncConflict<TLocal = any, TServer = any> {
  id: string;
  entityType: SyncEntityType;
  localData: TLocal;
  serverData: TServer;
  localTimestamp: Date;
  serverTimestamp: Date;
  resolution?: ConflictResolutionStrategy;
}


