import { z } from 'zod';
import { parseISO, isValid } from 'date-fns';

class DataStandardizationService {
  private static instance: DataStandardizationService;

  static getInstance(): DataStandardizationService {
    if (!DataStandardizationService.instance) {
      DataStandardizationService.instance = new DataStandardizationService();
    }
    return DataStandardizationService.instance;
  }

  standardizeDate(date: any): string {
    if (!date) return new Date().toISOString();
    if (typeof date === 'string') {
      const parsed = parseISO(date);
      if (isValid(parsed)) return parsed.toISOString();
      const ts = Date.parse(date);
      if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    }
    if (typeof date === 'number') return new Date(date).toISOString();
    if (date instanceof Date) return date.toISOString();
    return new Date().toISOString();
  }

  standardizeCategory(category: string): string {
    const map: Record<string, string> = {
      kontrol: 'checking',
      kirlilik: 'contamination',
      simetri: 'symmetry',
      düzen: 'ordering',
      sayma: 'counting',
      dini: 'religious',
      cinsel: 'sexual',
      zarar: 'harm',
      contamination_fears: 'contamination',
      checking_behaviors: 'checking',
      symmetry_ordering: 'symmetry',
      checking: 'checking',
      contamination: 'contamination',
      symmetry: 'symmetry',
      ordering: 'ordering',
      counting: 'counting',
      religious: 'religious',
      sexual: 'sexual',
      harm: 'harm',
      hoarding: 'hoarding',
      other: 'other',
    };
    const key = (category || '').toLowerCase().trim();
    return map[key] || 'other';
  }

  standardizeNumeric(value: any, config: { min?: number; max?: number; decimals?: number; defaultValue?: number } = {}): number {
    const { min = 0, max = Number.MAX_SAFE_INTEGER, decimals = 2, defaultValue = 0 } = config;
    let num = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(num)) return defaultValue;
    num = Math.max(min, Math.min(max, num));
    const mul = Math.pow(10, decimals);
    return Math.round(num * mul) / mul;
  }

  sanitizeString(str: string, maxLength: number = 255): string {
    if (!str || typeof str !== 'string') return '';
    let s = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    s = s.trim().substring(0, maxLength);
    s = s.replace(/[\x00-\x1F\x7F]/g, '');
    return s;
  }

  /**
   * Mask common PII patterns (email, phone, Turkish ID, credit card) in free text.
   */
  maskPII(input: string): string {
    if (!input || typeof input !== 'string') return '';
    let s = input;
    // Email addresses
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
    // Phone numbers (basic)
    s = s.replace(/(?:(?:\+?90|0)?\s*)?(\d[\s-]?){10,}/g, '[phone]');
    // Turkish ID (11 digits, first non-zero)
    s = s.replace(/(?<!\d)[1-9]\d{10}(?!\d)/g, '[tc_kimlik]');
    // Credit cards (simple 13-19 digits)
    s = s.replace(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g, '[card]');
    return s;
  }

  standardizeCompulsionData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      category: z.string().transform((v) => this.standardizeCategory(v)),
      subcategory: z.string().optional(),
      resistance_level: z.number().min(1).max(10),
      trigger: z.string().optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 200))),
      notes: z.string().max(500).optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 500))),
      timestamp: z.any().transform((v) => this.standardizeDate(v)).optional(),
    });
    return schema.parse(data);
  }

  standardizeTerapiSessionData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      exercise_id: z.string().optional(),
      exercise_name: z.string().optional(),
      category: z.string().transform((v) => this.standardizeCategory(v)),
      // Align with DB constraints: duration_seconds > 0, anxiety 1..10
      duration_seconds: z.number().min(1).max(7200),
      anxiety_initial: z.number().min(1).max(10),
      anxiety_final: z.number().min(1).max(10),
      anxiety_readings: z
        .array(
          z.object({
            timestamp: z.any().transform((v) => this.standardizeDate(v)),
            level: z.number().min(1).max(10),
          })
        )
        .optional(),
      completed: z.boolean().optional(),
      notes: z.string().max(1000).optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 1000))),
      timestamp: z.any().transform((v) => this.standardizeDate(v)).optional(),
    });
    return schema.parse(data);
  }

  async standardizeBatch<T>(items: any[], standardizer: (item: any) => T): Promise<T[]> {
    const results: T[] = [];
    for (const item of items) {
      try {
        results.push(standardizer.call(this, item));
      } catch {
        // skip invalid item
      }
    }
    return results;
  }

  private standardizeMoodData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      mood_score: z.number().min(1).max(10),
      energy_level: z.number().min(1).max(10),
      anxiety_level: z.number().min(1).max(10),
      notes: z.string().max(500).optional(),
      triggers: z.array(z.string()).optional(),
      activities: z.array(z.string()).optional(),
      timestamp: z.any().transform((v) => this.standardizeDate(v)),
    });
    return schema.parse(data);
  }

  async migrateDataFormat(oldData: any[], entityType: 'compulsion' | 'therapy_session' | 'mood_entry'): Promise<any[]> {
    const map = {
      compulsion: this.standardizeCompulsionData,
      therapy_session: this.standardizeTerapiSessionData,
      mood_entry: this.standardizeMoodData,
    } as const;
    const standardizer = (map as any)[entityType];
    if (!standardizer) throw new Error(`Unknown entity type: ${entityType}`);
    return this.standardizeBatch(oldData, standardizer);
  }

  standardizeThoughtRecordData(data: any): any {
    const schema = z.object({
      user_id: z.string(),
      automatic_thought: z.string().transform((v) => this.maskPII(this.sanitizeString(v || '', 1000))),
      evidence_for: z.string().optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 1500))),
      evidence_against: z.string().optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 1500))),
      distortions: z.array(z.string()).optional().default([]),
      new_view: z.string().optional().transform((v) => this.maskPII(this.sanitizeString(v || '', 1000))),
      lang: z.string().optional().default('tr'),
      created_at: z.any().optional().transform((v) => this.standardizeDate(v || new Date())),
    });
    return schema.parse(data);
  }
}

export const dataStandardizer = DataStandardizationService.getInstance();
export default dataStandardizer;


