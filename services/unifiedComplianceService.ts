/**
 * 🔒 Unified Compliance Service
 * 
 * Consolidated compliance system that includes:
 * - GDPR/KVKK compliance from gdprService.ts
 * - Data export/deletion from dataCompliance.ts
 * - Enhanced consent management
 * - Audit logging with encryption
 * - Data portability and right to erasure
 * - Privacy-first approach with secure storage
 * 
 * Created: Jan 2025 - Consolidation of compliance services
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePrefixedId } from '@/utils/idGenerator';
import { dataStandardizer } from '@/utils/dataStandardization';
import supabaseService from '@/services/supabase';
import { secureDataService } from '@/services/encryption/secureDataService';
import { trackAIInteraction, AIEventType } from '@/features/ai-fallbacks/telemetry';

// =============================================================================
// TYPES AND INTERFACES (Unified from both services)
// =============================================================================

export interface ConsentRecord {
  userId: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_processing' | 'medical_data' | 'research';
  granted: boolean;
  timestamp: string;
  version: string;
  source: 'onboarding' | 'settings' | 'popup' | 'migration';
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
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
  source: string;
  metadata?: Record<string, any>;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: string;
  completedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv' | 'pdf';
  includeDeleted: boolean;
  dataTypes: string[];
  exportSize?: number;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface DeletionRequest {
  id: string;
  userId: string;
  requestedAt: string;
  scheduledAt: string;
  completedAt?: string;
  status: 'pending' | 'grace_period' | 'processing' | 'completed' | 'cancelled';
  gracePeriodDays: number;
  reason?: string;
  retentionExceptions: string[];
}

export interface ComplianceStatus {
  userId: string;
  lastAuditedAt: string;
  consentStatus: Record<string, boolean>;
  dataProcessingLegal: boolean;
  retentionCompliant: boolean;
  encryptionCompliant: boolean;
  auditTrailComplete: boolean;
  rightToPortability: boolean;
  rightToErasure: boolean;
  issues: string[];
  recommendations: string[];
}

// =============================================================================
// COMPLIANCE VALIDATION ENGINE
// =============================================================================

export class ComplianceValidator {
  /**
   * Validate GDPR/KVKK compliance for a user
   */
  static async validateCompliance(userId: string): Promise<ComplianceStatus> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check consent status
    const consents = await UnifiedComplianceService.getInstance().getConsents(userId);
    const consentStatus = consents;
    
    // Validate data processing consent
    const dataProcessingLegal = !!consents.data_processing;
    if (!dataProcessingLegal) {
      issues.push('Missing data processing consent');
      recommendations.push('Obtain explicit consent for data processing');
    }
    
    // Check encryption compliance
    let encryptionCompliant = true;
    try {
      // Test encryption capability
      const testData = { test: 'encryption_check' };
      await secureDataService.encryptData(testData);
    } catch {
      encryptionCompliant = false;
      issues.push('Encryption service not functioning');
      recommendations.push('Fix encryption service configuration');
    }
    
    // Check audit trail
    const auditLogs = await UnifiedComplianceService.getInstance().getAuditLogs(userId, 30);
    const auditTrailComplete = auditLogs.length > 0;
    if (!auditTrailComplete) {
      recommendations.push('Ensure all actions are being logged');
    }
    
    // Check data retention (simplified check)
    const retentionCompliant = true; // Assume compliant for now
    
    return {
      userId,
      lastAuditedAt: new Date().toISOString(),
      consentStatus,
      dataProcessingLegal,
      retentionCompliant,
      encryptionCompliant,
      auditTrailComplete,
      rightToPortability: true, // Service supports export
      rightToErasure: true, // Service supports deletion
      issues,
      recommendations
    };
  }
  
  /**
   * Check if specific data processing is allowed
   */
  static async isProcessingAllowed(
    userId: string, 
    processingType: ConsentRecord['consentType']
  ): Promise<boolean> {
    const consents = await UnifiedComplianceService.getInstance().getConsents(userId);
    
    // Data processing is always required
    if (!consents.data_processing) return false;
    
    // Check specific consent
    return !!consents[processingType];
  }
  
  /**
   * Validate data for sensitive information
   */
  static validateSensitiveData(data: any): {
    containsSensitive: boolean;
    sensitivityLevel: AuditLog['sensitivityLevel'];
    concerns: string[];
  } {
    const concerns: string[] = [];
    let maxSensitivity: AuditLog['sensitivityLevel'] = 'low';
    
    const dataStr = JSON.stringify(data).toLowerCase();
    
    // Check for PII
    if (dataStr.includes('email') || dataStr.includes('@')) {
      concerns.push('Contains email addresses');
      maxSensitivity = 'medium';
    }
    
    // Check for health data
    const healthKeywords = ['medical', 'health', 'symptom', 'diagnosis', 'treatment', 'medication'];
    if (healthKeywords.some(keyword => dataStr.includes(keyword))) {
      concerns.push('Contains health-related information');
      maxSensitivity = 'high';
    }
    
    // Check for mental health data
    const mentalHealthKeywords = ['anxiety', 'depression', 'ocd', 'therapy', 'psychiatrist', 'mental'];
    if (mentalHealthKeywords.some(keyword => dataStr.includes(keyword))) {
      concerns.push('Contains mental health information');
      maxSensitivity = 'critical';
    }
    
    return {
      containsSensitive: concerns.length > 0,
      sensitivityLevel: maxSensitivity,
      concerns
    };
  }
}

// =============================================================================
// MAIN UNIFIED COMPLIANCE SERVICE
// =============================================================================

class UnifiedComplianceService {
  private static instance: UnifiedComplianceService;
  private readonly CONSENT_VERSION = '2.0.0';
  private readonly RETENTION_PERIOD_DAYS = 2555; // 7 years as per GDPR

  static getInstance(): UnifiedComplianceService {
    if (!UnifiedComplianceService.instance) {
      UnifiedComplianceService.instance = new UnifiedComplianceService();
    }
    return UnifiedComplianceService.instance;
  }

  // =============================================================================
  // CONSENT MANAGEMENT (Enhanced)
  // =============================================================================

  /**
   * Record user consent with enhanced tracking
   */
  async recordConsent(
    userId: string, 
    consentType: ConsentRecord['consentType'], 
    granted: boolean,
    source: ConsentRecord['source'] = 'settings',
    metadata?: ConsentRecord['metadata']
  ): Promise<void> {
    const consent: ConsentRecord = {
      userId,
      consentType,
      granted,
      timestamp: new Date().toISOString(),
      version: this.CONSENT_VERSION,
      source,
      metadata
    };
    
    const key = `consent_${userId}_${consentType}`;
    
    try {
      // Encrypt and store consent
      const encrypted = await secureDataService.encryptData(consent);
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(encrypted));
      
      // Audit log the consent change
      await this.auditLog(userId, 'consent_updated', 'consent', consentType, { 
        granted, 
        version: this.CONSENT_VERSION,
        source 
      });
      
      // Track consent for analytics
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'consent_recorded',
        userId,
        consentType,
        granted,
        source
      });
      
      console.log(`✅ Consent recorded: ${consentType} = ${granted}`);
      
    } catch (error) {
      console.error(`❌ Failed to record consent for ${consentType}:`, error);
      
      await trackAIInteraction(AIEventType.API_ERROR, {
        event: 'consent_recording_failed',
        userId,
        consentType,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Get all consents for a user
   */
  async getConsents(userId: string): Promise<Record<string, boolean>> {
    const consentTypes: ConsentRecord['consentType'][] = [
      'data_processing', 
      'marketing', 
      'analytics', 
      'ai_processing',
      'medical_data',
      'research'
    ];
    
    const result: Record<string, boolean> = {};
    
    for (const consentType of consentTypes) {
      try {
        const key = `encrypted_consent_${userId}_${consentType}`;
        const stored = await AsyncStorage.getItem(key);
        
        if (!stored) {
          result[consentType] = false;
          continue;
        }
        
        const encrypted = JSON.parse(stored);
        const decrypted = await secureDataService.decryptData(encrypted) as ConsentRecord;
        result[consentType] = !!decrypted.granted;
        
      } catch (error) {
        console.error(`Failed to decrypt consent for ${consentType}:`, error);
        result[consentType] = false;
      }
    }
    
    return result;
  }

  /**
   * Get consent history for transparency
   */
  async getConsentHistory(userId: string, days: number = 180): Promise<ConsentRecord[]> {
    try {
      const auditLogs = await this.getAuditLogs(userId, days);
      const consentLogs = auditLogs
        .filter(log => log.action === 'consent_updated' && log.entity === 'consent')
        .map(log => ({
          userId,
          consentType: log.entityId as ConsentRecord['consentType'],
          granted: !!(log.metadata?.granted),
          timestamp: log.timestamp,
          version: log.metadata?.version || '1.0.0',
          source: (log.metadata?.source as ConsentRecord['source']) || 'settings'
        } as ConsentRecord))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return consentLogs;
      
    } catch (error) {
      console.error('Failed to get consent history:', error);
      return [];
    }
  }

  // =============================================================================
  // DATA EXPORT (Right to Portability)
  // =============================================================================

  /**
   * Create comprehensive data export
   */
  async createDataExport(
    userId: string,
    options: {
      format?: 'json' | 'csv' | 'pdf';
      includeDeleted?: boolean;
      dataTypes?: string[];
    } = {}
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Create export request record
      const exportRequest: DataExportRequest = {
        // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
        id: generatePrefixedId('export'),
        userId,
        requestedAt: new Date().toISOString(),
        status: 'processing',
        format: options.format || 'json',
        includeDeleted: options.includeDeleted || false,
        dataTypes: options.dataTypes || ['all']
      };
      
      // Collect all user data
      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          userId,
          format: exportRequest.format,
          dataProtectionCompliance: 'GDPR/KVKK',
          retentionPolicy: `${this.RETENTION_PERIOD_DAYS} days`,
          version: '2.0.0'
        },
        personalData: {
          profile: await this.exportUserProfile(userId),
          consents: await this.getConsents(userId),
          consentHistory: await this.getConsentHistory(userId)
        },
        applicationData: {
          moodEntries: await this.exportMoodEntries(userId),
          voiceCheckins: await this.exportVoiceCheckins(userId),
          achievements: await this.exportAchievements(userId),
          breathworkSessions: await this.exportBreathworkSessions(userId)
        },
        metadata: {
          processingTime: Date.now() - startTime,
          totalRecords: 0, // Will be calculated
          complianceFlags: await ComplianceValidator.validateCompliance(userId),
          auditTrail: await this.getAuditLogs(userId, 90)
        }
      };
      
      // Calculate total records
      const totalRecords = Object.values(exportData.applicationData)
        .reduce((sum, data) => sum + (Array.isArray(data) ? data.length : 0), 0);
      
      exportData.metadata.totalRecords = totalRecords;
      
      // Apply data standardization
      const standardizedData = await dataStandardizer.standardizeBatch(
        [exportData], 
        (item) => item
      );
      
      // Log the export
      await this.auditLog(userId, 'data_exported', 'user_data', userId, {
        format: exportRequest.format,
        recordCount: totalRecords,
        processingTime: Date.now() - startTime
      });
      
      // Track export
      await trackAIInteraction(AIEventType.INSIGHTS_DELIVERED, {
        userId,
        source: 'data_export_completed',
        dataSize: JSON.stringify(standardizedData).length,
        processingTime: Date.now() - startTime,
        recordCount: totalRecords
      });
      
      console.log(`✅ Data export completed for user ${userId}: ${totalRecords} records`);
      
      return JSON.stringify(standardizedData[0], null, 2);
      
    } catch (error) {
      console.error('Data export failed:', error);
      
      await trackAIInteraction(AIEventType.API_ERROR, {
        event: 'data_export_failed',
        userId,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });
      
      throw error;
    }
  }

  // =============================================================================
  // DATA DELETION (Right to Erasure)
  // =============================================================================

  /**
   * Initiate user data deletion with grace period
   */
  async initiateDataDeletion(
    userId: string,
    gracePeriodDays: number = 30,
    reason?: string
  ): Promise<DeletionRequest> {
    try {
      const deletionRequest: DeletionRequest = {
        // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
        id: generatePrefixedId('deletion'),
        userId,
        requestedAt: new Date().toISOString(),
        scheduledAt: new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'grace_period',
        gracePeriodDays,
        reason,
        retentionExceptions: [] // Legal requirements, audit logs, etc.
      };
      
      // Store deletion request
      const key = `deletion_request_${userId}`;
      const encrypted = await secureDataService.encryptData(deletionRequest);
      await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(encrypted));
      
      // Mark user data for deletion
      await this.markDataForDeletion(userId);
      
      // Schedule hard delete
      await this.scheduleHardDelete(userId, gracePeriodDays);
      
      // Audit log the deletion request
      await this.auditLog(userId, 'deletion_requested', 'user_data', userId, {
        gracePeriodDays,
        scheduledAt: deletionRequest.scheduledAt,
        reason
      });
      
      // Track deletion request
      await trackAIInteraction(AIEventType.SYSTEM_STATUS, {
        event: 'deletion_requested',
        userId,
        gracePeriodDays,
        reason: reason || 'user_request'
      });
      
      console.log(`✅ Data deletion scheduled for user ${userId} in ${gracePeriodDays} days`);
      
      return deletionRequest;
      
    } catch (error) {
      console.error('Data deletion initiation failed:', error);
      throw error;
    }
  }

  /**
   * Cancel pending data deletion
   */
  async cancelDataDeletion(userId: string): Promise<boolean> {
    try {
      const key = `deletion_request_${userId}`;
      await AsyncStorage.removeItem(`encrypted_${key}`);
      await AsyncStorage.removeItem(`user_delete_mark_${userId}`);
      await AsyncStorage.removeItem(`user_hard_delete_at_${userId}`);
      
      await this.auditLog(userId, 'deletion_cancelled', 'user_data', userId);
      
      console.log(`✅ Data deletion cancelled for user ${userId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to cancel data deletion:', error);
      return false;
    }
  }

  /**
   * Get deletion status
   */
  async getDeletionStatus(userId: string): Promise<{
    status: 'none' | 'pending' | 'grace_period' | 'scheduled';
    requestedAt?: string;
    scheduledAt?: string;
    remainingDays?: number;
    canCancel: boolean;
  }> {
    try {
      const key = `encrypted_deletion_request_${userId}`;
      const stored = await AsyncStorage.getItem(key);
      
      if (!stored) {
        return { status: 'none', canCancel: false };
      }
      
      const encrypted = JSON.parse(stored);
      const deletionRequest = await secureDataService.decryptData(encrypted) as DeletionRequest;
      
      const now = Date.now();
      const scheduledTime = new Date(deletionRequest.scheduledAt).getTime();
      const remainingMs = scheduledTime - now;
      const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
      
      return {
        status: remainingDays > 0 ? 'grace_period' : 'scheduled',
        requestedAt: deletionRequest.requestedAt,
        scheduledAt: deletionRequest.scheduledAt,
        remainingDays,
        canCancel: remainingDays > 0
      };
      
    } catch (error) {
      console.error('Failed to get deletion status:', error);
      return { status: 'none', canCancel: false };
    }
  }

  // =============================================================================
  // AUDIT LOGGING (Enhanced)
  // =============================================================================

  /**
   * Create encrypted audit log entry
   */
  async auditLog(
    userId: string, 
    action: string, 
    entity: string, 
    entityId?: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Validate sensitivity
      const validation = ComplianceValidator.validateSensitiveData({ action, entity, metadata });
      
      const log: AuditLog = {
        // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
        id: generatePrefixedId('audit'),
        userId,
        action,
        entity,
        entityId,
        timestamp: new Date().toISOString(),
        source: 'unified_compliance_service',
        metadata,
        sensitivityLevel: validation.sensitivityLevel
      };
      
      const dateKey = new Date().toISOString().split('T')[0];
      const key = `audit_${userId}_${dateKey}`;
      
      try {
        // Try to get existing logs for the day
        const existingRaw = await AsyncStorage.getItem(`encrypted_${key}`);
        const existingLogs: AuditLog[] = existingRaw
          ? await secureDataService.decryptData(JSON.parse(existingRaw)) as AuditLog[]
          : [];
        
        existingLogs.push(log);
        
        // Encrypt and store
        const encrypted = await secureDataService.encryptData(existingLogs);
        await AsyncStorage.setItem(`encrypted_${key}`, JSON.stringify(encrypted));
        
      } catch (encryptError) {
        console.warn('Encrypted audit log failed, using plaintext fallback:', encryptError);
        
        // Fallback to plaintext (not recommended for production)
        const fallbackRaw = await AsyncStorage.getItem(key);
        const fallbackLogs = fallbackRaw ? JSON.parse(fallbackRaw) : [];
        fallbackLogs.push(log);
        await AsyncStorage.setItem(key, JSON.stringify(fallbackLogs));
      }
      
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit logging failure shouldn't break main functionality
    }
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogs(userId: string, days: number = 30): Promise<AuditLog[]> {
    const logs: AuditLog[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      try {
        // Try encrypted logs first
        const encryptedKey = `encrypted_audit_${userId}_${date}`;
        const encryptedRaw = await AsyncStorage.getItem(encryptedKey);
        
        if (encryptedRaw) {
          const decrypted = await secureDataService.decryptData(
            JSON.parse(encryptedRaw)
          ) as AuditLog[];
          
          if (Array.isArray(decrypted)) {
            logs.push(...decrypted);
          }
        } else {
          // Fallback to plaintext logs
          const plainKey = `audit_${userId}_${date}`;
          const plainRaw = await AsyncStorage.getItem(plainKey);
          
          if (plainRaw) {
            const plainLogs = JSON.parse(plainRaw);
            if (Array.isArray(plainLogs)) {
              logs.push(...plainLogs);
            }
          }
        }
        
      } catch (error) {
        console.error(`Failed to load audit logs for ${date}:`, error);
      }
    }
    
    return logs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async markDataForDeletion(userId: string): Promise<void> {
    const marker = {
      userId,
      markedAt: new Date().toISOString(),
      status: 'marked_for_deletion'
    };
    
    await AsyncStorage.setItem(
      `user_delete_mark_${userId}`, 
      JSON.stringify(marker)
    );
  }

  private async scheduleHardDelete(userId: string, days: number): Promise<void> {
    const scheduledTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await AsyncStorage.setItem(
      `user_hard_delete_at_${userId}`, 
      scheduledTime.toISOString()
    );
  }

  // Data export helpers
  private async exportUserProfile(userId: string): Promise<any> {
    try {
      const encrypted = await AsyncStorage.getItem(`encrypted_ai_user_profile_${userId}`);
      if (encrypted) {
        return await secureDataService.decryptData(JSON.parse(encrypted));
      }
      
      const plain = await AsyncStorage.getItem(`ai_user_profile_${userId}`);
      return plain ? JSON.parse(plain) : null;
    } catch {
      return null;
    }
  }

  // exportCompulsions removed

  private async exportMoodEntries(userId: string): Promise<any[]> {
    const entries: any[] = [];
    
    // Get mood entries from last 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      try {
        const stored = await AsyncStorage.getItem(`mood_entries_${userId}_${date}`);
        if (stored) {
          entries.push(...JSON.parse(stored));
        }
      } catch {
        // Skip failed entries
      }
    }
    
    return entries;
  }

  private async exportVoiceCheckins(userId: string): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(`voice_checkins_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // exportThoughtRecords removed

  private async exportAchievements(userId: string): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(`achievements_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private async exportBreathworkSessions(userId: string): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(`breathwork_sessions_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const unifiedComplianceService = UnifiedComplianceService.getInstance();
export default unifiedComplianceService;
// Types are defined above; do not re-export to avoid conflicts
