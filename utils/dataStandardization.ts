import { z } from 'zod';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Veri standardizasyon ve validation katmanı
 * Tüm veri formatlarını tutarlı hale getirir
 */
class DataStandardizationService {
  private static instance: DataStandardizationService;

  static getInstance(): DataStandardizationService {
    if (!DataStandardizationService.instance) {
      DataStandardizationService.instance = new DataStandardizationService();
    }
    return DataStandardizationService.instance;
  }

  /**
   * Tarih standardizasyonu - Tüm tarihler ISO 8601 formatında
   */
  standardizeDate(date: any): string {
    if (!date) {
      return new Date().toISOString();
    }

    // String tarih
    if (typeof date === 'string') {
      try {
        const parsed = parseISO(date);
        if (isValid(parsed)) {
          return parsed.toISOString();
        }
      } catch {
        // Fallback
      }
    }

    // Timestamp
    if (typeof date === 'number') {
      return new Date(date).toISOString();
    }

    // Date object
    if (date instanceof Date) {
      return date.toISOString();
    }

    // Fallback
    return new Date().toISOString();
  }

  /**
   * OKB kategori standardizasyonu
   * Türkçe ve İngilizce varyasyonları canonical forma dönüştürür
   */
  standardizeCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      // Türkçe -> Canonical
      'kontrol': 'checking',
      'kirlilik': 'contamination',
      'simetri': 'symmetry',
      'düzen': 'ordering',
      'sayma': 'counting',
      'dini': 'religious',
      'cinsel': 'sexual',
      'zarar': 'harm',
      'biriktirme': 'hoarding',
      
      // Variations -> Canonical
      'contamination_fears': 'contamination',
      'checking_behaviors': 'checking',
      'symmetry_ordering': 'symmetry',
      'religious_scrupulosity': 'religious',
      'sexual_obsessions': 'sexual',
      'harm_ocd': 'harm',
      
      // Already canonical
      'checking': 'checking',
      'contamination': 'contamination',
      'symmetry': 'symmetry',
      'ordering': 'ordering',
      'counting': 'counting',
      'religious': 'religious',
      'sexual': 'sexual',
      'harm': 'harm',
      'hoarding': 'hoarding',
      'other': 'other'
    };

    const normalized = category.toLowerCase().trim();
    return categoryMap[normalized] || 'other';
  }

  /**
   * Numeric değer validation ve normalizasyon
   */
  standardizeNumeric(value: any, config: {
    min?: number;
    max?: number;
    decimals?: number;
    defaultValue?: number;
  } = {}): number {
    const { 
      min = 0, 
      max = Number.MAX_SAFE_INTEGER, 
      decimals = 2, 
      defaultValue = 0 
    } = config;

    // Parse
    let num = parseFloat(value);
    
    // Validation
    if (isNaN(num)) {
      return defaultValue;
    }

    // Clamp
    num = Math.max(min, Math.min(max, num));

    // Round
    const multiplier = Math.pow(10, decimals);
    num = Math.round(num * multiplier) / multiplier;

    return num;
  }

  /**
   * Kompulsiyon verisi standardizasyonu
   */
  standardizeCompulsionData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      category: z.string().transform(val => this.standardizeCategory(val)),
      subcategory: z.string().optional(),
      resistance_level: z.number().min(1).max(10),
      trigger: z.string().optional(),
      notes: z.string().max(500).optional(),
      timestamp: z.any().transform(val => this.standardizeDate(val))
    });

    try {
      return schema.parse(data);
    } catch (error) {
      console.error('Kompulsiyon verisi validation hatası:', error);
      throw new Error('Geçersiz kompulsiyon veri formatı');
    }
  }

  /**
   * ERP session verisi standardizasyonu
   */
  standardizeERPSessionData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      exercise_id: z.string(),
      exercise_name: z.string(),
      category: z.string().transform(val => this.standardizeCategory(val)),
      duration_seconds: z.number().min(0).max(7200), // Max 2 saat
      anxiety_initial: z.number().min(0).max(10),
      anxiety_final: z.number().min(0).max(10),
      anxiety_readings: z.array(z.object({
        timestamp: z.any().transform(val => this.standardizeDate(val)),
        level: z.number().min(0).max(10)
      })).optional(),
      completed: z.boolean(),
      notes: z.string().max(1000).optional(),
      timestamp: z.any().transform(val => this.standardizeDate(val))
    });

    try {
      return schema.parse(data);
    } catch (error) {
      console.error('ERP session verisi validation hatası:', error);
      throw new Error('Geçersiz ERP session veri formatı');
    }
  }

  /**
   * Mood verisi standardizasyonu
   */
  standardizeMoodData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      mood_score: z.number().min(1).max(10),
      energy_level: z.number().min(1).max(10),
      anxiety_level: z.number().min(1).max(10),
      notes: z.string().max(500).optional(),
      triggers: z.array(z.string()).optional(),
      activities: z.array(z.string()).optional(),
      timestamp: z.any().transform(val => this.standardizeDate(val))
    });

    try {
      return schema.parse(data);
    } catch (error) {
      console.error('Mood verisi validation hatası:', error);
      throw new Error('Geçersiz mood veri formatı');
    }
  }

  /**
   * Batch standardization
   */
  async standardizeBatch<T>(
    items: any[],
    standardizer: (item: any) => T
  ): Promise<{ results: T[], errors: any[] }> {
    const results: T[] = [];
    const errors: any[] = [];

    for (const item of items) {
      try {
        results.push(standardizer.call(this, item));
      } catch (error) {
        errors.push({ item, error });
      }
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} öğe için standardizasyon başarısız:`, errors);
    }

    return { results, errors };
  }

  /**
   * String sanitization - XSS ve zararlı içerik temizleme
   */
  sanitizeString(str: string, maxLength: number = 255): string {
    if (!str || typeof str !== 'string') {
      return '';
    }

    // XSS temizleme
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    
    // Trim ve uzunluk sınırı
    str = str.trim().substring(0, maxLength);
    
    // Control karakterlerini temizle
    str = str.replace(/[\x00-\x1F\x7F]/g, '');
    
    return str;
  }

  /**
   * Bulk veri migration yardımcısı
   */
  async migrateDataFormat(
    oldData: any[],
    entityType: 'compulsion' | 'erp_session' | 'mood_entry'
  ): Promise<{ migrated: any[], failed: any[] }> {
    const standardizer = {
      'compulsion': this.standardizeCompulsionData,
      'erp_session': this.standardizeERPSessionData,
      'mood_entry': this.standardizeMoodData
    }[entityType];

    if (!standardizer) {
      throw new Error(`Bilinmeyen varlık tipi: ${entityType}`);
    }

    const { results, errors } = await this.standardizeBatch(oldData, standardizer);
    
    return {
      migrated: results,
      failed: errors
    };
  }

  /**
   * Anksiyete seviyesi standardizasyonu (0-10 arası)
   */
  standardizeAnxietyLevel(level: any): number {
    return this.standardizeNumeric(level, {
      min: 0,
      max: 10,
      decimals: 1,
      defaultValue: 5
    });
  }

  /**
   * Süre standardizasyonu (saniye cinsinden)
   */
  standardizeDuration(duration: any, unit: 'seconds' | 'minutes' | 'hours' = 'seconds'): number {
    const seconds = this.standardizeNumeric(duration, {
      min: 0,
      max: 86400, // Max 24 saat
      decimals: 0,
      defaultValue: 0
    });

    // Birim dönüşümü
    switch (unit) {
      case 'minutes':
        return seconds * 60;
      case 'hours':
        return seconds * 3600;
      default:
        return seconds;
    }
  }

  /**
   * Y-BOCS skoru standardizasyonu
   */
  standardizeYBOCSScore(score: any): number {
    return this.standardizeNumeric(score, {
      min: 0,
      max: 40,
      decimals: 0,
      defaultValue: 0
    });
  }
}

export const dataStandardizer = DataStandardizationService.getInstance();
export default dataStandardizer;


