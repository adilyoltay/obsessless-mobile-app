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


