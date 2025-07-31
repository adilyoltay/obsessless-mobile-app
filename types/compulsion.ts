// ObsessLess - Kompulsiyon Türleri ve Form Tanımları

export type CompulsionCategory = 'cleaning' | 'checking' | 'symmetry' | 'counting' | 'mental' | 'other';

export interface CompulsionType {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: CompulsionCategory;
}

export interface CompulsionEntry {
  id: string;
  type: string;
  resistanceLevel: number; // 0-10 scale
  duration: number; // in minutes
  intensity: number; // 0-10 scale
  notes?: string;
  timestamp: Date;
  mood?: 'anxious' | 'neutral' | 'calm';
  triggers?: string[];
}

export interface CompulsionFormData {
  type: string;
  resistanceLevel: number;
  duration: number;
  intensity: number;
  notes?: string;
}

export interface CompulsionStats {
  totalCompulsions: number;
  avgResistance: number;
  mostCommonType: string;
  improvementTrend: string;
}

export interface DailyCompulsionSummary {
  date: string;
  count: number;
  avgResistance: number;
  types: CompulsionCategory[];
}

// Kompulsiyon türleri - OKB'de en sık görülen obsesyon/kompulsiyon temaları
export const COMPULSION_TYPES: CompulsionType[] = [
  // Temizlik/Bulaşma
  {
    id: 'hand_washing',
    label: 'El Yıkama',
    icon: 'hand-wash',
    description: 'Aşırı el yıkama kompulsiyonu',
    category: 'cleaning',
  },
  {
    id: 'cleaning',
    label: 'Temizlik',
    icon: 'spray-bottle',
    description: 'Aşırı temizlik yapma',
    category: 'cleaning',
  },
  {
    id: 'shower',
    label: 'Duş Alma',
    icon: 'shower',
    description: 'Uzun veya tekrarlı duş alma',
    category: 'cleaning',
  },
  
  // Kontrol Etme
  {
    id: 'door_check',
    label: 'Kapı Kontrolü',
    icon: 'door',
    description: 'Kapıların kilitli olup olmadığını kontrol etme',
    category: 'checking',
  },
  {
    id: 'stove_check',
    label: 'Ocak Kontrolü',
    icon: 'stove',
    description: 'Ocağın kapalı olup olmadığını kontrol etme',
    category: 'checking',
  },
  {
    id: 'appliance_check',
    label: 'Cihaz Kontrolü',
    icon: 'power-plug',
    description: 'Elektrikli cihazların kapalı olup olmadığını kontrol etme',
    category: 'checking',
  },
  
  // Simetri/Düzen
  {
    id: 'symmetry',
    label: 'Simetri',
    icon: 'arrow-left-right',
    description: 'Nesneleri simetriye getirme',
    category: 'symmetry',
  },
  {
    id: 'ordering',
    label: 'Düzenleme',
    icon: 'sort-variant',
    description: 'Nesneleri belirli bir düzene koyma',
    category: 'symmetry',
  },
  
  // Sayma/Tekrar
  {
    id: 'counting',
    label: 'Sayma',
    icon: 'counter',
    description: 'Belirli sayılara kadar sayma',
    category: 'counting',
  },
  {
    id: 'repetitive_actions',
    label: 'Tekrarlı Hareketler',
    icon: 'repeat',
    description: 'Belirli hareketleri tekrar etme',
    category: 'counting',
  },
  
  // Zihinsel Kompulsiyonlar
  {
    id: 'mental_checking',
    label: 'Zihinsel Kontrol',
    icon: 'brain',
    description: 'Zihinsel olarak kontrol etme',
    category: 'mental',
  },
  {
    id: 'mental_repetition',
    label: 'Zihinsel Tekrar',
    icon: 'thought-bubble',
    description: 'Kelimeleri veya cümleleri zihinsel olarak tekrar etme',
    category: 'mental',
  },
  
  // Diğer
  {
    id: 'avoiding',
    label: 'Kaçınma',
    icon: 'run-fast',
    description: 'Belirli yerlerden veya durumlardan kaçınma',
    category: 'other',
  },
  {
    id: 'reassurance',
    label: 'Güvence Arama',
    icon: 'account-question',
    description: 'Başkalarından sürekli güvence arama',
    category: 'other',
  },
];

// Direnç seviyeleri için açıklamalar
export const RESISTANCE_LEVELS = {
  0: 'Hiç direnmeden yaptım',
  1: 'Çok az direndim',
  2: 'Az direndim', 
  3: 'Biraz direndim',
  4: 'Orta derecede direndim',
  5: 'İyi direndim',
  6: 'Oldukça iyi direndim',
  7: 'Çok iyi direndim',
  8: 'Mükemmel direndim',
  9: 'Neredeyse yapmadım',
  10: 'Hiç yapmadım / Tamamen direndi',
};

// Süre seçenekleri (dakika)
export const DURATION_OPTIONS = [1, 2, 5, 10, 15, 30, 45, 60, 90, 120];

// Form validasyon şeması
export const compulsionFormSchema = {
  type: { required: true, message: 'Kompulsiyon türü seçiniz' },
  resistanceLevel: { required: true, min: 0, max: 10 },
  duration: { required: true, min: 1, max: 240 },
  intensity: { required: true, min: 0, max: 10 },
}; 