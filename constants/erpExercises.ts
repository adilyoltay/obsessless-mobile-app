import { ERPExercise as ERPExerciseType, ERPCategoryInfo, ERPCategory, ERPDifficulty } from '@/types/erp';

// ERP Categories
export const ERP_CATEGORIES: ERPCategoryInfo[] = [
  {
    id: 'exposure',
    name: 'Maruz Kalma',
    nameEn: 'Exposure',
    description: 'Kaygı yaratan durumlara kasıtlı olarak maruz kalma',
    descriptionEn: 'Deliberately exposing yourself to anxiety-provoking situations',
    icon: '👁️',
    color: '#3B82F6',
    difficulty: 'beginner',
    recommendedOrder: 1,
  },
  {
    id: 'response_prevention',
    name: 'Tepki Önleme',
    nameEn: 'Response Prevention',
    description: 'Kompulsif davranışları yapmama pratiği',
    descriptionEn: 'Practice of not performing compulsive behaviors',
    icon: '🛑',
    color: '#EF4444',
    difficulty: 'intermediate',
    recommendedOrder: 2,
  },
  {
    id: 'in_vivo',
    name: 'Gerçek Yaşam',
    nameEn: 'In Vivo',
    description: 'Gerçek yaşam durumlarında uygulanan egzersizler',
    descriptionEn: 'Exercises applied in real-life situations',
    icon: '🌍',
    color: '#10B981',
    difficulty: 'intermediate',
    recommendedOrder: 3,
  },
  {
    id: 'imaginal',
    name: 'Hayali Maruz Kalma',
    nameEn: 'Imaginal Exposure',
    description: 'Zihinsel imajlarla yapılan maruz kalma egzersizleri',
    descriptionEn: 'Exposure exercises using mental imagery',
    icon: '🧠',
    color: '#8B5CF6',
    difficulty: 'advanced',
    recommendedOrder: 4,
  },
  {
    id: 'interoceptive',
    name: 'İçsel Duyum',
    nameEn: 'Interoceptive',
    description: 'Vücut sensasyonlarına maruz kalma',
    descriptionEn: 'Exposure to bodily sensations',
    icon: '💓',
    color: '#F59E0B',
    difficulty: 'advanced',
    recommendedOrder: 5,
  },
  {
    id: 'cognitive',
    name: 'Bilişsel',
    nameEn: 'Cognitive',
    description: 'Düşünce ve inançlarla çalışma',
    descriptionEn: 'Working with thoughts and beliefs',
    icon: '🤔',
    color: '#6366F1',
    difficulty: 'expert',
    recommendedOrder: 6,
  },
  {
    id: 'behavioral',
    name: 'Davranışsal',
    nameEn: 'Behavioral',
    description: 'Davranış değişikliği egzersizleri',
    descriptionEn: 'Behavior modification exercises',
    icon: '🎯',
    color: '#EC4899',
    difficulty: 'intermediate',
    recommendedOrder: 7,
  },
];

export interface ERPExercise {
  id: string;
  name: string;
  category: 'in_vivo' | 'imaginal' | 'interoceptive' | 'response_prevention';
  targetCompulsion: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  duration: number; // minutes
  description: string;
  instructions: string[];
  safetyNotes?: string[];
  expectedAnxiety: {
    initial: number;
    peak: number;
    final: number;
  };
}

export const ERP_EXERCISES: ERPExerciseType[] = [
  // Washing/Cleaning Exercises
  {
    id: 'touch_doorknob',
    name: 'Kapı Kolu Dokunma',
    category: 'in_vivo',
    targetCompulsion: ['washing'],
    difficulty: 2,
    duration: 15,
    description: 'Kapı koluna dokunup ellerinizi yıkamadan bekleme',
    instructions: [
      'Kapı koluna dokunun',
      'Ellerinizi yıkama isteğine karşı direnin',
      '15 dakika boyunca bekleyin',
      'Anksiyete seviyenizi takip edin'
    ],
    safetyNotes: [
      'Gerçek sağlık riski oluşturmayan yüzeyler seçin',
      'Yemek yemeden önce değil'
    ],
    expectedAnxiety: {
      initial: 6,
      peak: 8,
      final: 4
    }
  },
  {
    id: 'dirty_hands_timer',
    name: 'Kirli Eller Zamanlayıcı',
    category: 'in_vivo',
    targetCompulsion: ['washing'],
    difficulty: 3,
    duration: 30,
    description: 'Ellerinizi bilinçli olarak kirletip beklemek',
    instructions: [
      'Ellerinizi toprakla veya toz ile kirletin',
      'Yıkama isteğine direnin',
      '30 dakika boyunca bekleyin',
      'Normal aktivitelerinize devam edin'
    ],
    expectedAnxiety: {
      initial: 7,
      peak: 9,
      final: 3
    }
  },

  // Checking Exercises
  {
    id: 'lock_once_only',
    name: 'Kapıyı Tek Kez Kilitleme',
    category: 'response_prevention',
    targetCompulsion: ['checking'],
    difficulty: 2,
    duration: 20,
    description: 'Kapıyı sadece bir kez kilitleyip kontrol etmeme',
    instructions: [
      'Kapıyı normal şekilde kilitleyin',
      'Sadece BİR KEZ kontrol edin',
      'Evden/odadan çıkın',
      'Geri dönüp kontrol etme isteğine direnin'
    ],
    expectedAnxiety: {
      initial: 6,
      peak: 8,
      final: 4
    }
  },
  {
    id: 'stove_single_check',
    name: 'Ocağı Tek Kontrol',
    category: 'response_prevention',
    targetCompulsion: ['checking'],
    difficulty: 3,
    duration: 25,
    description: 'Ocağı sadece bir kez kontrol edip çıkmak',
    instructions: [
      'Ocak düğmelerini kapatın',
      'Sadece BİR KEZ kontrol edin',
      'Mutfaktan çıkın',
      'Tekrar kontrol etme isteğine direnin'
    ],
    safetyNotes: [
      'Gerçekten kapandığından emin olun',
      'Görsel kontrol yeterli'
    ],
    expectedAnxiety: {
      initial: 7,
      peak: 9,
      final: 4
    }
  },

  // Counting Exercises
  {
    id: 'interrupted_counting',
    name: 'Kesintili Sayma',
    category: 'response_prevention',
    targetCompulsion: ['counting'],
    difficulty: 2,
    duration: 15,
    description: 'Saymayı yarıda kesip devam etmeme',
    instructions: [
      'Herhangi bir şeyi saymaya başlayın',
      'Ortada kesin (örn: 7\'de)',
      'Baştan saymama isteğine direnin',
      'Diğer aktivitelere geçin'
    ],
    expectedAnxiety: {
      initial: 5,
      peak: 7,
      final: 3
    }
  },

  // Arranging/Symmetry Exercises
  {
    id: 'asymmetric_objects',
    name: 'Asimetrik Nesneler',
    category: 'in_vivo',
    targetCompulsion: ['arranging'],
    difficulty: 2,
    duration: 20,
    description: 'Nesneleri bilinçli olarak asimetrik bırakma',
    instructions: [
      'Masanızdaki nesneleri düzensiz yerleştirin',
      'Kitapları çapraz koyun',
      'Düzeltme isteğine direnin',
      '20 dakika bekleyin'
    ],
    expectedAnxiety: {
      initial: 6,
      peak: 8,
      final: 4
    }
  },

  // Mental Ritual Exercises
  {
    id: 'incomplete_prayers',
    name: 'Yarım Kalan Dua',
    category: 'response_prevention',
    targetCompulsion: ['mental', 'religious'],
    difficulty: 4,
    duration: 30,
    description: 'Mental ritüeli tamamlamadan bırakma',
    instructions: [
      'Mental ritüelinizi başlatın',
      'Yarıda kesin',
      'Baştan alma isteğine direnin',
      'Diğer düşüncelere odaklanın'
    ],
    safetyNotes: [
      'Dini değerlerinizle çelişirse atla',
      'Danışmanınızla konuşun'
    ],
    expectedAnxiety: {
      initial: 8,
      peak: 9,
      final: 5
    }
  },

  // Interoceptive Exercises
  {
    id: 'heart_rate_increase',
    name: 'Kalp Atışı Hızlandırma',
    category: 'interoceptive',
    targetCompulsion: ['checking'],
    difficulty: 3,
    duration: 10,
    description: 'Fiziksel egzersizle kalp atışını hızlandırma',
    instructions: [
      '2 dakika tempolu yürüyüş yapın',
      'Kalp atışınızın hızlandığını hissedin',
      'Kontrol etme isteğine direnin',
      'Doğal olarak yavaşlamasını bekleyin'
    ],
    safetyNotes: [
      'Kalp sorunu varsa doktorunuza danışın',
      'Aşırıya kaçmayın'
    ],
    expectedAnxiety: {
      initial: 5,
      peak: 7,
      final: 3
    }
  },

  // Imaginal Exercises
  {
    id: 'contamination_imaginal',
    name: 'Kirlenme Hayali',
    category: 'imaginal',
    targetCompulsion: ['washing'],
    difficulty: 3,
    duration: 15,
    description: 'Kirlenme senaryolarını hayal etme',
    instructions: [
      'Gözlerinizi kapatın',
      'Kirli bir yüzeye dokunduğunuzu hayal edin',
      'Kirlenme hissini yaşayın',
      'Yıkama düşüncelerine direnin'
    ],
    expectedAnxiety: {
      initial: 6,
      peak: 8,
      final: 4
    }
  },

  // Advanced Exercises
  {
    id: 'public_mistakes',
    name: 'Kasıtlı Hatalar',
    category: 'in_vivo',
    targetCompulsion: ['checking', 'arranging'],
    difficulty: 4,
    duration: 45,
    description: 'Küçük hatalar yapıp düzeltmeme',
    instructions: [
      'E-posta yazarken küçük bir yazım hatası bırakın',
      'Masanızda bir şey düzensiz kalsın',
      'Düzeltme isteğine direnin',
      'Normal işlerinize devam edin'
    ],
    safetyNotes: [
      'Ciddi sonuçları olmayan hatalar seçin',
      'İş performansınızı etkilemesin'
    ],
    expectedAnxiety: {
      initial: 7,
      peak: 9,
      final: 4
    }
  },

  {
    id: 'uncertainty_tolerance',
    name: 'Belirsizlik Toleransı',
    category: 'imaginal',
    targetCompulsion: ['checking', 'mental'],
    difficulty: 5,
    duration: 30,
    description: 'Belirsizlik yaşayan senaryoları kabul etme',
    instructions: [
      'Bir konuda kesin olmadığınız bir durumu düşünün',
      'Kontrol etme veya araştırma isteğine direnin',
      '"Belki" cümleleriyle düşünün',
      'Belirsizliği kabul etmeye çalışın'
    ],
    expectedAnxiety: {
      initial: 8,
      peak: 9,
      final: 5
    }
  }
];

export const EXPOSURE_CATEGORIES = {
  in_vivo: {
    name: 'Gerçek Yaşam Maruziyeti',
    description: 'Gerçek durumlarla yüzleşme',
    icon: '🌍',
    color: '#4ECDC4'
  },
  imaginal: {
    name: 'Hayal Gücü Maruziyeti',
    description: 'Zihinsel senaryolar oluşturma',
    icon: '🧠',
    color: '#45B7D1'
  },
  interoceptive: {
    name: 'İç Duyum Maruziyeti',
    description: 'Bedensel hisleri yaşama',
    icon: '❤️',
    color: '#FF6B35'
  },
  response_prevention: {
    name: 'Yanıt Engelleme',
    description: 'Kompulsiyonları engelleme',
    icon: '🛡️',
    color: '#96CEB4'
  }
} as const;

export const DIFFICULTY_LEVELS = {
  1: { label: 'Çok Kolay', color: '#27AE60', description: 'Az anksiyete' },
  2: { label: 'Kolay', color: '#F39C12', description: 'Hafif anksiyete' },
  3: { label: 'Orta', color: '#E67E22', description: 'Orta anksiyete' },
  4: { label: 'Zor', color: '#E74C3C', description: 'Yüksek anksiyete' },
  5: { label: 'Çok Zor', color: '#8E44AD', description: 'Çok yüksek anksiyete' }
} as const;

// Exercise Templates by Compulsion Type
export const ERP_EXERCISE_TEMPLATES = {
  washing: [
    'washing-hands-delay',
    'touching-doorknob',
    'contamination-exposure',
  ],
  checking: [
    'checking-reduction',
    'uncertainty-tolerance',
  ],
  ordering: [
    // Will be added
  ],
  mental: [
    'uncertainty-tolerance',
  ],
};

// Helper functions
export const getERPCategory = (id: ERPCategory): ERPCategoryInfo => {
  return ERP_CATEGORIES.find(cat => cat.id === id) || ERP_CATEGORIES[0];
};

export const getERPExercise = (id: string): ERPExercise | undefined => {
  return ERP_EXERCISES.find(exercise => exercise.id === id);
};

export const getERPExercisesByCategory = (category: ERPCategory): ERPExercise[] => {
  return ERP_EXERCISES.filter(exercise => exercise.category === category);
};

export const getERPExercisesByDifficulty = (difficulty: ERPDifficulty): ERPExercise[] => {
  return ERP_EXERCISES.filter(exercise => {
    const difficultyMap = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    return difficultyMap[difficulty] !== undefined ? ERP_EXERCISES.filter(exercise => exercise.difficulty === difficultyMap[difficulty])[0] : false;
  });
};

export const getERPExercisesByCompulsion = (compulsionType: string): ERPExercise[] => {
  return ERP_EXERCISES.filter(exercise =>
    exercise.targetCompulsion.includes(compulsionType)
  );
};

export const getDifficultyColor = (difficulty: ERPDifficulty): string => {
  const colors = {
    beginner: '#10B981',
    intermediate: '#F59E0B',
    advanced: '#EF4444',
    expert: '#8B5CF6',
  };
  return colors[difficulty];
};

export const getDifficultyLabel = (difficulty: ERPDifficulty, isEnglish: boolean = false): string => {
  const labels = {
    beginner: isEnglish ? 'Beginner' : 'Başlangıç',
    intermediate: isEnglish ? 'Intermediate' : 'Orta',
    advanced: isEnglish ? 'Advanced' : 'İleri',
    expert: isEnglish ? 'Expert' : 'Uzman',
  };
  return labels[difficulty];
};