// ERP Categories and Exercises - Master Prompt aligned
export interface ERPExercise {
  id: string;
  name: string;
  duration: number; // in minutes
  difficulty: number; // 1-5 scale
  category: string;
}

export interface ERPCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  exercises: ERPExercise[];
}

export const ERP_CATEGORIES: ERPCategory[] = [
  {
    id: 'contamination',
    title: 'Bulaşma/Temizlik',
    icon: 'hand-wash',
    color: '#3B82F6',
    exercises: [
      { id: 'cont-1', name: 'Kapı kollarına dokunma', duration: 5, difficulty: 3, category: 'contamination' },
      { id: 'cont-2', name: 'El Yıkama Direnci', duration: 10, difficulty: 3, category: 'contamination' },
      { id: 'cont-3', name: 'Ortak kullanım alanları', duration: 7, difficulty: 4, category: 'contamination' },
      { id: 'cont-4', name: 'Para ve metal eşyalar', duration: 6, difficulty: 5, category: 'contamination' },
      { id: 'cont-5', name: 'Toplu taşıma kullanımı', duration: 15, difficulty: 4, category: 'contamination' },
      { id: 'cont-6', name: 'Yemek hazırlama hijyeni', duration: 20, difficulty: 5, category: 'contamination' }
    ]
  },
  {
    id: 'checking',
    title: 'Kontrol Etme',
    icon: 'lock-check',
    color: '#10B981',
    exercises: [
      { id: 'check-1', name: 'Kapı kilidi kontrolü yapmama', duration: 10, difficulty: 4, category: 'checking' },
      { id: 'check-2', name: 'Elektrik/gaz kontrolü yapmama', duration: 8, difficulty: 5, category: 'checking' },
      { id: 'check-3', name: 'Mesajları tekrar okumama', duration: 5, difficulty: 3, category: 'checking' },
      { id: 'check-4', name: 'Alarm kurduğunu kontrol etmeme', duration: 3, difficulty: 2, category: 'checking' },
      { id: 'check-5', name: 'İş teslimi kontrol etmeme', duration: 30, difficulty: 5, category: 'checking' }
    ]
  },
  {
    id: 'ordering',
    title: 'Düzenleme/Simetri',
    icon: 'shape-outline',
    color: '#8B5CF6',
    exercises: [
      { id: 'order-1', name: 'Eşyaları düzensiz bırakma', duration: 5, difficulty: 2, category: 'ordering' },
      { id: 'order-2', name: 'Asimetrik düzenleme', duration: 10, difficulty: 4, category: 'ordering' },
      { id: 'order-3', name: 'Mükemmeliyetçilikten kaçınma', duration: 15, difficulty: 5, category: 'ordering' },
      { id: 'order-4', name: 'Sayıları tamamlamama', duration: 8, difficulty: 3, category: 'ordering' },
      { id: 'order-5', name: 'Çift/tek sayı kurallarını bozma', duration: 12, difficulty: 4, category: 'ordering' }
    ]
  },
  {
    id: 'mental',
    title: 'Zihinsel Ritüeller',
    icon: 'head-cog',
    color: '#EC4899',
    exercises: [
      { id: 'mental-1', name: 'Düşünce durdurma', duration: 10, difficulty: 4, category: 'mental' },
      { id: 'mental-2', name: 'Zihinsel tekrarları engelleme', duration: 8, difficulty: 5, category: 'mental' },
      { id: 'mental-3', name: 'Belirsizliğe dayanma', duration: 12, difficulty: 5, category: 'mental' },
      { id: 'mental-4', name: 'Kötü düşünceleri kabul etme', duration: 15, difficulty: 5, category: 'mental' },
      { id: 'mental-5', name: 'Zihinsel kontrol bırakma', duration: 20, difficulty: 5, category: 'mental' }
    ]
  },
  {
    id: 'harm',
    title: 'Zarar Verme Korkuları',
    icon: 'shield-alert',
    color: '#F59E0B',
    exercises: [
      { id: 'harm-1', name: 'Keskin eşya yakınında durma', duration: 5, difficulty: 4, category: 'harm' },
      { id: 'harm-2', name: 'Araba kullanırken düşüncelere izin verme', duration: 30, difficulty: 5, category: 'harm' },
      { id: 'harm-3', name: 'Yüksek yerlerden bakma', duration: 8, difficulty: 3, category: 'harm' },
      { id: 'harm-4', name: 'Bebek/çocuk yakınında olma', duration: 15, difficulty: 5, category: 'harm' }
    ]
  },
  {
    id: 'religious',
    title: 'Dini/Ahlaki Kaygılar',
    icon: 'heart-outline',
    color: '#EF4444',
    exercises: [
      { id: 'relig-1', name: 'Kutsal kitap yanında olumsuz düşünce', duration: 10, difficulty: 4, category: 'religious' },
      { id: 'relig-2', name: 'İbadet sırasında dikkati dağıtma', duration: 15, difficulty: 5, category: 'religious' },
      { id: 'relig-3', name: 'Ahlaki şüpheleri kabul etme', duration: 12, difficulty: 4, category: 'religious' }
    ]
  }
];

// Helper functions
export const getAllExercises = (): ERPExercise[] => {
  return ERP_CATEGORIES.flatMap(cat => cat.exercises);
};

export const getExerciseById = (id: string): ERPExercise | undefined => {
  return getAllExercises().find(exercise => exercise.id === id);
};

export const getExercisesByCategory = (categoryId: string): ERPExercise[] => {
  const category = ERP_CATEGORIES.find(cat => cat.id === categoryId);
  return category ? category.exercises : [];
};

export const getExercisesByDifficulty = (difficulty: number): ERPExercise[] => {
  return getAllExercises().filter(exercise => exercise.difficulty === difficulty);
};

export const getCategoryColor = (categoryId: string): string => {
  const category = ERP_CATEGORIES.find(cat => cat.id === categoryId);
  return category ? category.color : '#6B7280';
}; 