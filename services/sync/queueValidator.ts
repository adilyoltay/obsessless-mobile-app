/**
 * 🔍 Queue Item Validation Service
 * Validates sync queue items before processing to prevent invalid data propagation
 */

import { isUUID } from '@/utils/validators';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SyncQueueItem {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  data: any;
  timestamp: number;
  retryCount: number;
  deviceId?: string;
  lastModified?: number;
}

export class QueueValidator {
  private static instance: QueueValidator;
  
  // Supported entities and operations
  private readonly SUPPORTED_ENTITIES = new Set([
    'achievement', 'mood_entry', 'ai_profile', 'treatment_plan', 'voice_checkin', 'user_profile'
  ]);
  
  private readonly SUPPORTED_OPERATIONS = new Set(['CREATE', 'UPDATE', 'DELETE']);
  
  // Required fields per entity type
  private readonly ENTITY_REQUIRED_FIELDS: Record<string, string[]> = {
    mood_entry: ['user_id', 'mood_score'],
    voice_checkin: ['user_id', 'content'],
    user_profile: ['user_id'],
    ai_profile: ['user_id', 'profile_data'],
    treatment_plan: ['user_id', 'plan_data'],
    achievement: ['user_id', 'achievement_id']
  };

  static getInstance(): QueueValidator {
    if (!QueueValidator.instance) {
      QueueValidator.instance = new QueueValidator();
    }
    return QueueValidator.instance;
  }

  /**
   * 🔍 Comprehensive validation of sync queue item
   */
  validateItem(item: SyncQueueItem): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!item.id || typeof item.id !== 'string') {
      errors.push('Missing or invalid item ID');
    }

    if (!this.SUPPORTED_OPERATIONS.has(item.type)) {
      errors.push(`Unsupported operation type: ${item.type}`);
    }

    if (!this.SUPPORTED_ENTITIES.has(item.entity)) {
      errors.push(`Unsupported entity type: ${item.entity}`);
    }

    if (!item.data || typeof item.data !== 'object') {
      errors.push('Missing or invalid data payload');
    }

    if (!item.timestamp || typeof item.timestamp !== 'number') {
      errors.push('Missing or invalid timestamp');
    }

    // Data payload validation
    if (item.data && typeof item.data === 'object') {
      const dataValidation = this.validateDataPayload(item.entity, item.type, item.data);
      errors.push(...dataValidation.errors);
      warnings.push(...dataValidation.warnings);
    }

    // Age validation (warn if item is very old)
    if (item.timestamp && Date.now() - item.timestamp > 7 * 24 * 60 * 60 * 1000) {
      warnings.push('Item is older than 7 days');
    }

    // Retry count validation
    if (item.retryCount && item.retryCount > 10) {
      warnings.push(`High retry count: ${item.retryCount}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 🔍 Validate data payload based on entity type and operation
   */
  private validateDataPayload(entity: string, operation: string, data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // User ID validation (required for all entities)
    const userId = data.user_id || data.userId;
    if (!userId) {
      errors.push('Missing user_id in data payload');
    } else if (!isUUID(userId)) {
      errors.push(`Invalid user_id format: ${userId}`);
    }

    // DELETE operations only need ID
    if (operation === 'DELETE') {
      if (!data.id && entity !== 'user_profile') {
        errors.push('DELETE operation requires item ID');
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Entity-specific validation
    const requiredFields = this.ENTITY_REQUIRED_FIELDS[entity] || [];
    for (const field of requiredFields) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Entity-specific data validation
    switch (entity) {
      case 'mood_entry':
        this.validateMoodEntry(data, errors, warnings);
        break;
      case 'voice_checkin':
        this.validateVoiceCheckin(data, errors, warnings);
        break;
      case 'user_profile':
        this.validateUserProfile(data, errors, warnings);
        break;
      case 'ai_profile':
        this.validateAIProfile(data, errors, warnings);
        break;
      case 'treatment_plan':
        this.validateTreatmentPlan(data, errors, warnings);
        break;
      case 'achievement':
        this.validateAchievement(data, errors, warnings);
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateMoodEntry(data: any, errors: string[], warnings: string[]): void {
    if (data.mood_score !== undefined) {
      if (typeof data.mood_score !== 'number' || data.mood_score < 0 || data.mood_score > 100) {
        errors.push('mood_score must be a number between 0-100');
      }
    }

    if (data.energy_level !== undefined) {
      if (typeof data.energy_level !== 'number' || data.energy_level < 0 || data.energy_level > 10) {
        errors.push('energy_level must be a number between 0-10');
      }
    }

    if (data.anxiety_level !== undefined) {
      if (typeof data.anxiety_level !== 'number' || data.anxiety_level < 0 || data.anxiety_level > 10) {
        errors.push('anxiety_level must be a number between 0-10');
      }
    }

    if (data.notes && typeof data.notes !== 'string') {
      errors.push('notes must be a string');
    }

    if (data.triggers && !Array.isArray(data.triggers)) {
      warnings.push('triggers should be an array');
    }

    if (data.activities && !Array.isArray(data.activities)) {
      warnings.push('activities should be an array');
    }
  }

  private validateVoiceCheckin(data: any, errors: string[], warnings: string[]): void {
    if (!data.content || typeof data.content !== 'string') {
      errors.push('voice_checkin requires content string');
    }

    if (data.duration !== undefined && (typeof data.duration !== 'number' || data.duration <= 0)) {
      warnings.push('duration should be a positive number');
    }

    if (data.analysis && typeof data.analysis !== 'object') {
      warnings.push('analysis should be an object');
    }
  }

  private validateUserProfile(data: any, errors: string[], warnings: string[]): void {
    if (data.payload && typeof data.payload !== 'object') {
      errors.push('user_profile payload must be an object');
    }

    // Check for common profile fields
    const payload = data.payload || data;
    if (payload.age !== undefined && (typeof payload.age !== 'number' || payload.age < 0 || payload.age > 150)) {
      warnings.push('age should be a reasonable number');
    }

    if (payload.motivations && !Array.isArray(payload.motivations)) {
      warnings.push('motivations should be an array');
    }
  }

  private validateAIProfile(data: any, errors: string[], warnings: string[]): void {
    if (!data.profile_data || typeof data.profile_data !== 'object') {
      errors.push('ai_profile requires profile_data object');
    }

    if (data.onboarding_completed !== undefined && typeof data.onboarding_completed !== 'boolean') {
      warnings.push('onboarding_completed should be a boolean');
    }
  }

  private validateTreatmentPlan(data: any, errors: string[], warnings: string[]): void {
    if (!data.plan_data || typeof data.plan_data !== 'object') {
      errors.push('treatment_plan requires plan_data object');
    }

    if (data.status && !['active', 'inactive', 'completed'].includes(data.status)) {
      warnings.push('status should be active, inactive, or completed');
    }
  }

  private validateAchievement(data: any, errors: string[], warnings: string[]): void {
    if (!data.achievement_id || typeof data.achievement_id !== 'string') {
      errors.push('achievement requires achievement_id string');
    }

    if (data.progress !== undefined && (typeof data.progress !== 'number' || data.progress < 0 || data.progress > 100)) {
      warnings.push('progress should be a number between 0-100');
    }

    if (data.unlocked_at && isNaN(Date.parse(data.unlocked_at))) {
      warnings.push('unlocked_at should be a valid date string');
    }
  }

  /**
   * 🔧 Sanitize and fix common data issues
   */
  sanitizeItem(item: SyncQueueItem): SyncQueueItem {
    const sanitized = { ...item };

    // Normalize user_id field
    if (sanitized.data && typeof sanitized.data === 'object') {
      const data = { ...sanitized.data };
      
      // Consolidate user_id fields
      if (data.userId && !data.user_id) {
        data.user_id = data.userId;
        delete data.userId;
      }

      // Remove invalid user_id values
      if (data.user_id && !isUUID(data.user_id)) {
        const invalidValues = ['anon', 'anonymous', 'null', 'undefined', ''];
        if (invalidValues.includes(String(data.user_id).toLowerCase())) {
          delete data.user_id;
        }
      }

      // Sanitize mood_entry specific fields
      if (item.entity === 'mood_entry') {
        if (data.mood_score !== undefined) {
          data.mood_score = Math.max(0, Math.min(100, Number(data.mood_score) != null ? Number(data.mood_score) : 50)); // FIXED: explicit null check
        }
        if (data.energy_level !== undefined) {
          data.energy_level = Math.max(0, Math.min(10, Number(data.energy_level) || 5));
        }
        if (data.anxiety_level !== undefined) {
          data.anxiety_level = Math.max(0, Math.min(10, Number(data.anxiety_level) || 5));
        }
        if (data.notes && typeof data.notes !== 'string') {
          data.notes = String(data.notes || '');
        }
      }

      sanitized.data = data;
    }

    // Ensure required fields
    if (!sanitized.retryCount) {
      sanitized.retryCount = 0;
    }

    if (!sanitized.timestamp) {
      sanitized.timestamp = Date.now();
    }

    return sanitized;
  }

  /**
   * 📊 Batch validation for multiple items
   */
  validateBatch(items: SyncQueueItem[]): {
    valid: SyncQueueItem[];
    invalid: Array<{ item: SyncQueueItem; validation: ValidationResult }>;
    warnings: Array<{ item: SyncQueueItem; validation: ValidationResult }>;
  } {
    const valid: SyncQueueItem[] = [];
    const invalid: Array<{ item: SyncQueueItem; validation: ValidationResult }> = [];
    const warnings: Array<{ item: SyncQueueItem; validation: ValidationResult }> = [];

    for (const item of items) {
      const validation = this.validateItem(item);
      
      if (validation.isValid) {
        valid.push(item);
        if (validation.warnings.length > 0) {
          warnings.push({ item, validation });
        }
      } else {
        invalid.push({ item, validation });
      }
    }

    return { valid, invalid, warnings };
  }
}

export const queueValidator = QueueValidator.getInstance();
