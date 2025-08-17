import AsyncStorage from '@react-native-async-storage/async-storage';
import secureDataService from '@/services/encryption/secureDataService';

export interface ConsentRecord {
  userId: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_processing';
  granted: boolean;
  timestamp: string;
  version: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * GDPR/KVKK Compliance Service
 * - Consent yönetimi
 * - Audit logging
 * - Veri taşınabilirliği (export)
 * - Silme talebi (soft → scheduled hard delete)
 */
class GDPRComplianceService {
  private static instance: GDPRComplianceService;
  private readonly CONSENT_VERSION = '1.0.0';

  static getInstance(): GDPRComplianceService {
    if (!GDPRComplianceService.instance) {
      GDPRComplianceService.instance = new GDPRComplianceService();
    }
    return GDPRComplianceService.instance;
  }

  // =============== CONSENT MANAGEMENT ===============
  async recordConsent(userId: string, consentType: ConsentRecord['consentType'], granted: boolean): Promise<void> {
    const consent: ConsentRecord = {
      userId,
      consentType,
      granted,
      timestamp: new Date().toISOString(),
      version: this.CONSENT_VERSION,
    };
    const key = `consent_${userId}_${consentType}`;
    await secureDataService.encryptData(consent).then(async (enc) => {
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(enc));
    });
    await this.auditLog(userId, 'consent_updated', 'consent', consentType, { granted });
  }

  async getConsents(userId: string): Promise<Record<string, boolean>> {
    const types: ConsentRecord['consentType'][] = ['data_processing', 'marketing', 'analytics', 'ai_processing'];
    const result: Record<string, boolean> = {};
    for (const t of types) {
      const key = `encrypted_consent_${userId}_${t}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) { result[t] = false; continue; }
        const enc = JSON.parse(raw);
        const dec = (await secureDataService.decryptData(enc)) as ConsentRecord;
        result[t] = !!dec.granted;
      } catch { result[t] = false; }
    }
    return result;
  }

  // =============== DATA PORTABILITY (EXPORT) ===============
  async exportUserData(userId: string): Promise<string> {
    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      profile: await this.exportProfile(userId),
      compulsions: await this.exportCompulsions(userId),
      erpSessions: await this.exportERPSessions(userId),
      moodEntries: await this.exportMoodEntries(userId),
      consents: await this.getConsents(userId),
      metadata: { version: '1.0.0', format: 'json', gdprCompliant: true },
    };
    await this.auditLog(userId, 'data_exported', 'user_data', userId);
    return JSON.stringify(exportData, null, 2);
  }

  // =============== RIGHT TO ERASURE ===============
  async deleteAllUserData(userId: string): Promise<void> {
    await this.markForDeletion(userId);
    await this.scheduleHardDelete(userId, 30);
    await this.auditLog(userId, 'deletion_requested', 'user_data', userId);
  }

  private async markForDeletion(userId: string): Promise<void> {
    await AsyncStorage.setItem(
      `deletion_request_${userId}`,
      JSON.stringify({ requestedAt: new Date().toISOString(), status: 'pending', gracePeriodDays: 30 })
    );
  }

  private async scheduleHardDelete(userId: string, days: number): Promise<void> {
    const scheduledDate = new Date(Date.now() + days * 86400000).toISOString();
    await AsyncStorage.setItem(`hard_delete_scheduled_${userId}`, scheduledDate);
  }

  // =============== AUDIT LOGGING ===============
  async auditLog(userId: string, action: string, entity: string, entityId?: string, metadata?: Record<string, any>): Promise<void> {
    const log: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      metadata,
    };
    const key = `audit_${userId}_${new Date().toISOString().split('T')[0]}`;
    try {
      const existingRaw = await AsyncStorage.getItem(`encrypted_${key}`);
      const list: AuditLog[] = existingRaw
        ? (await secureDataService.decryptData(JSON.parse(existingRaw))) as AuditLog[]
        : [];
      list.push(log);
      const enc = await secureDataService.encryptData(list);
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(enc));
    } catch {
      // Best-effort plaintext fallback
      try {
        const fallbackRaw = await AsyncStorage.getItem(key);
        const arr = fallbackRaw ? JSON.parse(fallbackRaw) : [];
        arr.push(log);
        await AsyncStorage.setItem(key, JSON.stringify(arr));
      } catch {}
    }
  }

  async getAuditLogs(userId: string, days: number = 30): Promise<AuditLog[]> {
    const logs: AuditLog[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      const key = `encrypted_audit_${userId}_${date}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const dec = (await secureDataService.decryptData(JSON.parse(raw))) as AuditLog[];
          if (Array.isArray(dec)) logs.push(...dec);
        }
      } catch {}
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // =============== STATUS & HISTORY HELPERS ===============
  async getDeletionStatus(userId: string): Promise<{ status: 'none' | 'pending'; requestedAt?: string; scheduledAt?: string; remainingDays?: number }> {
    try {
      const reqRaw = await AsyncStorage.getItem(`deletion_request_${userId}`);
      if (!reqRaw) return { status: 'none' };
      const req = JSON.parse(reqRaw) as { requestedAt: string; status: string; gracePeriodDays: number };
      const scheduledAt = await AsyncStorage.getItem(`hard_delete_scheduled_${userId}`);
      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
      const remainingDays = scheduledDate ? Math.max(0, Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000)) : undefined;
      return { status: 'pending', requestedAt: req.requestedAt, scheduledAt: scheduledAt || undefined, remainingDays };
    } catch { return { status: 'none' }; }
  }

  async getConsentHistory(userId: string, days: number = 180): Promise<ConsentRecord[]> {
    // We derive history from audit logs tagged with consent updates for simplicity
    try {
      const logs = await this.getAuditLogs(userId, days);
      const items = logs
        .filter(l => l.action === 'consent_updated' && l.entity === 'consent')
        .map(l => ({
          userId,
          consentType: (l.entityId as any) as ConsentRecord['consentType'],
          granted: !!(l.metadata?.granted),
          timestamp: l.timestamp,
          version: this.CONSENT_VERSION,
        } as ConsentRecord));
      return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch { return []; }
  }

  // =============== HELPERS FOR EXPORT ===============
  private async exportProfile(userId: string): Promise<any> {
    try {
      const raw = await AsyncStorage.getItem(`encrypted_ai_user_profile_${userId}`);
      if (raw) return await secureDataService.decryptData(JSON.parse(raw));
    } catch {}
    try { const plain = await AsyncStorage.getItem(`ai_user_profile_${userId}`); return plain ? JSON.parse(plain) : null; } catch { return null; }
  }
  private async exportCompulsions(userId: string): Promise<any[]> {
    try { const raw = await AsyncStorage.getItem(`compulsions_${userId}`); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }
  private async exportERPSessions(userId: string): Promise<any[]> {
    try { const raw = await AsyncStorage.getItem(`erp_sessions_${userId}`); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }
  private async exportMoodEntries(userId: string): Promise<any[]> {
    const list: any[] = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      try {
        const raw = await AsyncStorage.getItem(`mood_entries_${userId}_${date}`);
        if (raw) list.push(...JSON.parse(raw));
      } catch {}
    }
    return list;
  }
}

export const gdprService = GDPRComplianceService.getInstance();
export default gdprService;


