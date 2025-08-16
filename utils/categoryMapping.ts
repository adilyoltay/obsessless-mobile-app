// Kanonik OKB kategori eşlemesi ve yardımcı fonksiyonlar

export type CanonicalCategory =
  | 'contamination'
  | 'checking'
  | 'symmetry'
  | 'mental'
  | 'hoarding'
  | 'other';

export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  'contamination',
  'checking',
  'symmetry',
  'mental',
  'hoarding',
  'other',
];

// Uygulamadaki eski/çeşitli etiketleri kanonik sete eşler
const legacyToCanonicalMap: Record<string, CanonicalCategory> = {
  // Temizlik/Bulaşma
  washing: 'contamination',
  cleaning: 'contamination',
  contamination: 'contamination',

  // Kontrol
  checking: 'checking',

  // Simetri/Düzen/Sayma/Dokunma ritüelleri
  ordering: 'symmetry',
  arranging: 'symmetry',
  symmetry: 'symmetry',
  counting: 'symmetry',
  repeating: 'symmetry',
  touching: 'symmetry',

  // Zihinsel ritüeller ve dini/ahlaki temalar
  mental: 'mental',
  religious: 'mental',
  morality: 'mental',

  // Biriktirme
  hoarding: 'hoarding',

  // Diğer/etiketler
  reassurance: 'other',
  avoidance: 'other',
  other: 'other',
  
  // ERP domain legacy IDs mapped to closest canonical OCD category
  harm: 'other',
  sexual: 'other',
};

/**
 * Girilen kategori değerini kanonik OKB kategorisine çevirir.
 * Bilinmeyen değerler "other" olarak döner.
 */
export function mapToCanonicalCategory(input: string): CanonicalCategory {
  const key = (input || '').toLowerCase().trim();
  return legacyToCanonicalMap[key] ?? 'other';
}

/**
 * Kanonik kategori mi kontrol eder.
 */
export function isCanonicalCategory(value: string): value is CanonicalCategory {
  return (CANONICAL_CATEGORIES as string[]).includes((value || '').toLowerCase());
}

// ===============
// DB Kategorileri
// ===============

// Supabase şemasındaki CHECK constraint'e göre izin verilen kategoriler
export type DatabaseCategory = 'contamination' | 'harm' | 'symmetry' | 'religious' | 'sexual' | 'hoarding';

const DB_ALLOWED_CATEGORIES: DatabaseCategory[] = [
  'contamination', 'harm', 'symmetry', 'religious', 'sexual', 'hoarding'
];

/**
 * Uygulama/legacy etiketleri DB'nin kabul ettiği kategorilere eşler.
 * Amaç: CHECK constraint ihlallerini önlemek.
 */
export function mapToDatabaseCategory(input: string): DatabaseCategory {
  const key = (input || '').toLowerCase().trim();

  // Doğrudan eşitlik (zaten DB kategorilerinden biri ise)
  if ((DB_ALLOWED_CATEGORIES as string[]).includes(key)) {
    return key as DatabaseCategory;
  }

  // Legacy → DB mapping
  const legacyToDbMap: Record<string, DatabaseCategory> = {
    // Temizlik/bulaşma
    washing: 'contamination',
    cleaning: 'contamination',
    contamination: 'contamination',

    // Kontrol/Simetri/Düzen/Sayma → symmetry
    checking: 'symmetry',
    ordering: 'symmetry',
    arranging: 'symmetry',
    symmetry: 'symmetry',
    counting: 'symmetry',
    repeating: 'symmetry',
    touching: 'symmetry',

    // Zihinsel/ahlaki/dini temalar → religious
    mental: 'religious',
    religious: 'religious',
    morality: 'religious',

    // Biriktirme
    hoarding: 'hoarding',

    // Diğer geniş temalar
    harm: 'harm',
    sexual: 'sexual',

    // Yakın eşlemeler
    reassurance: 'harm',
    avoidance: 'harm',
    other: 'harm'
  };

  return legacyToDbMap[key] ?? 'harm';
}


