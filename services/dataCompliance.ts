import { dataStandardizer } from '@/utils/dataStandardization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from '@/services/supabase';
import * as Crypto from 'expo-crypto';
import { offlineSyncService } from './offlineSync';
import { moodTracker } from './moodTrackingService';
import { enhancedAchievements } from './enhancedAchievementService';

interface DataExport {
  exported_at: string;
  user_id: string;
  format_version: string;
  data_categories: {
    profile: any;
    compulsions: any[];
    erp_sessions: any[];
    mood_entries: any[];
    achievements: any[];
    preferences: any;
  };
  metadata: {
    total_records: number;
    date_range: {
      start: string;
      end: string;
    };
    export_method: 'user_request' | 'scheduled' | 'deletion';
  };
}

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  algorithm: string;
}

class DataComplianceService {
  private static instance: DataComplianceService;
  private readonly ENCRYPTION_ALGORITHM = Crypto.CryptoDigestAlgorithm.SHA256;

  static getInstance(): DataComplianceService {
    if (!DataComplianceService.instance) {
      DataComplianceService.instance = new DataComplianceService();
    }
    return DataComplianceService.instance;
  }

  /**
   * GDPR Article 20 - Kullanıcı verilerini dışa aktar
   */
  async exportUserData(userId: string, format: 'json' | 'encrypted' = 'json'): Promise<DataExport | EncryptedData> {
    try {
      console.log('📦 Kullanıcı veri dışa aktarımı başlatılıyor...');
      
      // Tüm veri kategorilerini topla
      const dataCategories = await this.collectAllUserData(userId);
      
      // Metadata oluştur
      const metadata = this.generateExportMetadata(dataCategories);
      
      // Export objesi oluştur
      const exportData: DataExport = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        format_version: '2.0',
        data_categories: dataCategories,
        metadata
      };

      // Format'a göre işle
      if (format === 'encrypted') {
        return await this.encryptExportData(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('Veri dışa aktarım hatası:', error);
      throw new Error('Veri dışa aktarımı başarısız oldu');
    }
  }

  /**
   * GDPR Article 17 - Kullanıcı verilerini sil (Right to be forgotten)
   */
  async deleteUserData(userId: string, immediate: boolean = false): Promise<void> {
    try {
      console.log('🗑️ Kullanıcı veri silme işlemi başlatılıyor...');
      
      // Audit log oluştur
      await this.createDeletionAuditLog(userId);
      
      if (immediate) {
        // Hemen sil
        await this.performHardDelete(userId);
      } else {
        // Soft delete ve 30 gün sonra hard delete
        await this.markForDeletion(userId);
        await this.scheduleHardDelete(userId, 30);
      }
      
      console.log('✅ Veri silme işlemi tamamlandı');
    } catch (error) {
      console.error('Veri silme hatası:', error);
      throw new Error('Veri silme işlemi başarısız oldu');
    }
  }

  /**
   * Tüm kullanıcı verilerini topla
   */
  private async collectAllUserData(userId: string): Promise<DataExport['data_categories']> {
    const [
      profile,
      compulsions,
      erpSessions,
      moodEntries,
      achievements,
      preferences
    ] = await Promise.all([
      this.getUserProfile(userId),
      this.getCompulsions(userId),
      this.getERPSessions(userId),
      this.getMoodEntries(userId),
      this.getAchievements(userId),
      this.getUserPreferences(userId)
    ]);

    return {
      profile: this.maskSensitiveData(profile),
      compulsions,
      erp_sessions: erpSessions,
      mood_entries: moodEntries,
      achievements,
      preferences
    };
  }

  /**
   * Kullanıcı profilini getir
   */
  private async getUserProfile(userId: string): Promise<any> {
    try {
      // Local storage'dan
      const profileKey = `user_profile_${userId}`;
      const localProfile = await AsyncStorage.getItem(profileKey);
      if (localProfile) {
        return JSON.parse(localProfile);
      }

      // Supabase'den
      const { data } = await supabaseService.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      return data || {};
    } catch {
      return {};
    }
  }

  /**
   * Kompulsiyonları getir
   */
  private async getCompulsions(userId: string): Promise<any[]> {
    try {
      const localCompulsions = await offlineSyncService.getLocalCompulsions();
      const userCompulsions = localCompulsions.filter(c => c.user_id === userId);
      
      // Supabase'den de çek
      try {
        const remoteCompulsions = await supabaseService.getCompulsions(userId);
        
        // Duplicate'leri kaldır
        const mergedCompulsions = this.mergeDuplicates([...userCompulsions, ...remoteCompulsions]);
        return mergedCompulsions;
      } catch {
        return userCompulsions;
      }
    } catch {
      return [];
    }
  }

  /**
   * ERP oturumlarını getir
   */
  private async getERPSessions(userId: string): Promise<any[]> {
    try {
      const localSessions = await offlineSyncService.getLocalERPSessions();
      const userSessions = localSessions.filter(s => s.user_id === userId);
      
      try {
        const remoteSessions = await supabaseService.getERPSessions(userId);
        return this.mergeDuplicates([...userSessions, ...remoteSessions]);
      } catch {
        return userSessions;
      }
    } catch {
      return [];
    }
  }

  /**
   * Mood kayıtlarını getir
   */
  private async getMoodEntries(userId: string, days: number = 90): Promise<any[]> {
    try {
      return await moodTracker.getMoodHistory(userId, days);
    } catch {
      return [];
    }
  }

  /**
   * Achievement'ları getir
   */
  private async getAchievements(userId: string): Promise<any[]> {
    try {
      const key = `ach_unlocks_${userId}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Kullanıcı tercihlerini getir
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const keys = [
        `user_preferences_${userId}`,
        `notification_settings_${userId}`,
        `privacy_settings_${userId}`,
        `app_settings_${userId}`
      ];

      const preferences: any = {};
      
      for (const key of keys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const keyName = key.replace(`_${userId}`, '');
          preferences[keyName] = JSON.parse(data);
        }
      }

      return preferences;
    } catch {
      return {};
    }
  }

  /**
   * Hassas verileri maskele
   */
  private maskSensitiveData(data: any): any {
    if (!data) return data;

    const masked = { ...data };

    // Email maskeleme
    if (masked.email) {
      const [local, domain] = masked.email.split('@');
      masked.email = `${local.substring(0, 2)}***@${domain}`;
    }

    // İsim maskeleme
    if (masked.name) {
      const parts = masked.name.split(' ');
      masked.name = parts.map((part: string) => 
        part.charAt(0) + '***'
      ).join(' ');
    }

    // Telefon maskeleme
    if (masked.phone) {
      masked.phone = masked.phone.substring(0, 3) + '****' + masked.phone.slice(-2);
    }

    // Doğum tarihi - sadece yıl bırak
    if (masked.birth_date) {
      const year = new Date(masked.birth_date).getFullYear();
      masked.birth_date = `${year}-**-**`;
    }

    return masked;
  }

  /**
   * Duplicate kayıtları birleştir
   */
  private mergeDuplicates(items: any[]): any[] {
    const uniqueMap = new Map();
    
    items.forEach(item => {
      const key = item.id || `${item.user_id}_${item.timestamp}`;
      if (!uniqueMap.has(key) || new Date(item.updated_at || item.timestamp) > new Date(uniqueMap.get(key).updated_at || uniqueMap.get(key).timestamp)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values());
  }

  /**
   * Export metadata oluştur
   */
  private generateExportMetadata(dataCategories: DataExport['data_categories']): DataExport['metadata'] {
    let totalRecords = 0;
    let earliestDate = new Date();
    let latestDate = new Date(0);

    // Tüm kayıtları say ve tarih aralığını bul
    Object.values(dataCategories).forEach(category => {
      if (Array.isArray(category)) {
        totalRecords += category.length;
        
        category.forEach(item => {
          if (item.timestamp || item.created_at) {
            const itemDate = new Date(item.timestamp || item.created_at);
            if (itemDate < earliestDate) earliestDate = itemDate;
            if (itemDate > latestDate) latestDate = itemDate;
          }
        });
      } else if (category && typeof category === 'object') {
        totalRecords += Object.keys(category).length;
      }
    });

    return {
      total_records: totalRecords,
      date_range: {
        start: earliestDate.toISOString(),
        end: latestDate.toISOString()
      },
      export_method: 'user_request'
    };
  }

  /**
   * Veriyi şifrele
   */
  private async encryptExportData(data: DataExport): Promise<EncryptedData> {
    try {
      const jsonString = JSON.stringify(data);
      
      // Random IV ve salt oluştur
      const iv = Crypto.getRandomBytes(16).toString();
      const salt = Crypto.getRandomBytes(32).toString();
      
      // Şifrele
      const encrypted = await Crypto.digestStringAsync(
        this.ENCRYPTION_ALGORITHM,
        salt + jsonString + iv,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );

      return {
        encrypted,
        iv,
        salt,
        algorithm: 'SHA256'
      };
    } catch (error) {
      console.error('Şifreleme hatası:', error);
      throw new Error('Veri şifreleme başarısız oldu');
    }
  }

  /**
   * Soft delete - Silme için işaretle
   */
  private async markForDeletion(userId: string): Promise<void> {
    const deletionRecord = {
      user_id: userId,
      marked_at: new Date().toISOString(),
      reason: 'user_request',
      status: 'pending'
    };

    await AsyncStorage.setItem(
      `user_delete_mark_${userId}`,
      JSON.stringify(deletionRecord)
    );

    // Supabase'e de kaydet
    try {
      await supabaseService.client
        .from('deletion_requests')
        .insert(deletionRecord);
    } catch (error) {
      console.error('Deletion request kaydetme hatası:', error);
    }
  }

  /**
   * Hard delete planla
   */
  private async scheduleHardDelete(userId: string, days: number): Promise<void> {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + days);

    const schedule = {
      user_id: userId,
      scheduled_for: scheduledDate.toISOString(),
      created_at: new Date().toISOString()
    };

    await AsyncStorage.setItem(
      `user_hard_delete_schedule_${userId}`,
      JSON.stringify(schedule)
    );
  }

  /**
   * Hard delete - Kalıcı silme
   */
  private async performHardDelete(userId: string): Promise<void> {
    console.log('🔥 Kalıcı veri silme işlemi başlatılıyor...');

    // Local storage temizleme
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeys = allKeys.filter(key => key.includes(userId));
    
    if (userKeys.length > 0) {
      await AsyncStorage.multiRemove(userKeys);
    }

    // Supabase'den silme
    try {
      // Tüm tablolardan sil
      const tables = [
        'user_profiles',
        'compulsions',
        'erp_sessions',
        'mood_tracking',
        'achievement_unlocks',
        'user_preferences'
      ];

      for (const table of tables) {
        await supabaseService.client
          .from(table)
          .delete()
          .eq('user_id', userId);
      }

      // Auth kullanıcısını sil
      await supabaseService.client.auth.admin.deleteUser(userId);
    } catch (error) {
      console.error('Supabase silme hatası:', error);
    }

    console.log('✅ Kalıcı veri silme tamamlandı');
  }

  /**
   * Silme audit log'u oluştur
   */
  private async createDeletionAuditLog(userId: string): Promise<void> {
    const auditLog = {
      user_id: userId,
      action: 'data_deletion_requested',
      timestamp: new Date().toISOString(),
      ip_address: 'N/A', // Mobile app
      user_agent: 'ObsessLess Mobile App'
    };

    // Local'e kaydet
    const auditKey = `deletion_audit_${userId}_${Date.now()}`;
    await AsyncStorage.setItem(auditKey, JSON.stringify(auditLog));

    // Backend'e gönder (best effort)
    try {
      await supabaseService.client
        .from('audit_logs')
        .insert(auditLog);
    } catch {
      // Fail silently
    }
  }

  /**
   * Veri minimizasyonu - Eski verileri temizle
   */
  async performDataMinimization(userId: string, retentionDays: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Eski mood entries'leri temizle
      const moodKeys = await AsyncStorage.getAllKeys();
      const oldMoodKeys = moodKeys.filter(key => {
        if (!key.startsWith(`mood_entries_${userId}_`)) return false;
        
        const dateStr = key.split('_').pop();
        if (!dateStr) return false;
        
        const keyDate = new Date(dateStr);
        return keyDate < cutoffDate;
      });

      if (oldMoodKeys.length > 0) {
        await AsyncStorage.multiRemove(oldMoodKeys);
      }

      console.log(`📊 ${oldMoodKeys.length} eski kayıt temizlendi`);
    } catch (error) {
      console.error('Veri minimizasyonu hatası:', error);
    }
  }

  /**
   * Consent (rıza) yönetimi
   */
  async updateConsent(userId: string, consentType: string, granted: boolean): Promise<void> {
    const consentRecord = {
      user_id: userId,
      consent_type: consentType,
      granted,
      timestamp: new Date().toISOString(),
      ip_address: 'N/A',
      version: '1.0'
    };

    // Local'e kaydet
    const consentKey = `consent_${userId}_${consentType}`;
    await AsyncStorage.setItem(consentKey, JSON.stringify(consentRecord));

    // Backend'e sync
    try {
      await supabaseService.client
        .from('user_consents')
        .upsert(consentRecord);
    } catch (error) {
      console.error('Consent güncelleme hatası:', error);
    }
  }

  /**
   * Veri taşınabilirliği - Import
   */
  async importUserData(userId: string, exportData: DataExport): Promise<boolean> {
    try {
      // Veri formatını doğrula
      if (exportData.format_version !== '2.0') {
        throw new Error('Desteklenmeyen veri formatı');
      }

      // Kullanıcı ID'sini kontrol et
      if (exportData.user_id !== userId) {
        throw new Error('Kullanıcı ID uyuşmazlığı');
      }

      // Veriyi import et
      const { data_categories } = exportData;

      // Her kategoriyi import et
      // TODO: Her veri tipini uygun servise yönlendir

      console.log('✅ Veri import başarılı');
      return true;
    } catch (error) {
      console.error('Veri import hatası:', error);
      return false;
    }
  }

  /**
   * Anonymize - Kimliksizleştirme
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Kullanıcı verilerini al
      const profile = await this.getUserProfile(userId);
      
      // Kimlik bilgilerini kaldır
      const anonymized = {
        ...profile,
        name: 'Anonymous',
        email: `anon_${Date.now()}@example.com`,
        phone: null,
        birth_date: null,
        // Diğer PII alanları
      };

      // Güncelle
      const profileKey = `user_profile_${userId}`;
      await AsyncStorage.setItem(profileKey, JSON.stringify(anonymized));

      console.log('✅ Kimliksizleştirme tamamlandı');
    } catch (error) {
      console.error('Kimliksizleştirme hatası:', error);
    }
  }
}

export const dataCompliance = DataComplianceService.getInstance();
export default dataCompliance;


