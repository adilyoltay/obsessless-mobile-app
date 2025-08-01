/**
 * ObsessLess Kişiselleştirilmiş Tedavi Planlayıcısı
 * 
 * Kullanıcı profiline göre özelleştirilmiş, aşamalı ve esnek tedavi planları oluşturur.
 * "Zahmetsizlik Esastır" ilkesine uygun olarak küçük, başarılabilir adımlar önerir.
 */

import { UserProfileAnalysis } from './profileAnalyzer';
import { trackAIInteraction } from '@/telemetry/aiTelemetry';

// Tedavi planı tipleri
export interface PersonalizedTreatmentPlan {
  // Plan özeti
  summary: {
    title: string;
    description: string;
    estimatedDuration: number; // Hafta cinsinden
    primaryApproach: 'cbt' | 'erp' | 'act' | 'mixed';
    intensityLevel: 'light' | 'moderate' | 'intensive';
  };
  
  // Haftalık fazlar
  phases: TreatmentPhase[];
  
  // Günlük rutin önerileri
  dailyRoutine: {
    morning: RoutineItem[];
    afternoon: RoutineItem[];
    evening: RoutineItem[];
  };
  
  // Kişiselleştirilmiş egzersizler
  exercises: PersonalizedExercise[];
  
  // Milestone'lar ve ödüller
  milestones: Milestone[];
  
  // Acil durum planı
  crisisManagement: {
    warningSignsToWatch: string[];
    copingStrategies: CopingStrategy[];
    emergencyContacts: EmergencyContact[];
    safetyPlan: string[];
  };
  
  // İlerleme metrikleri
  progressMetrics: {
    primaryMetric: string;
    secondaryMetrics: string[];
    assessmentSchedule: 'daily' | 'weekly' | 'biweekly';
    expectedProgress: ProgressExpectation[];
  };
  
  // Kişiselleştirme notları
  personalizationNotes: {
    strengthsUtilized: string[];
    barriersAddressed: string[];
    culturalConsiderations: string[];
    motivationalStrategies: string[];
  };
}

// Tedavi fazı
export interface TreatmentPhase {
  weekNumber: number;
  title: string;
  focus: string;
  goals: string[];
  exercises: string[]; // Exercise ID'leri
  expectedChallenges: string[];
  successCriteria: string[];
}

// Rutin öğesi
interface RoutineItem {
  time: string;
  activity: string;
  duration: number; // Dakika
  type: 'exercise' | 'self_care' | 'reflection' | 'social';
  isOptional: boolean;
}

// Kişiselleştirilmiş egzersiz
export interface PersonalizedExercise {
  id: string;
  baseExerciseId: string;
  title: string;
  description: string;
  personalizedInstructions: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number; // Dakika
  frequency: 'daily' | 'weekly' | 'as_needed';
  adaptations: string[]; // Kullanıcıya özel uyarlamalar
}

// Milestone
interface Milestone {
  id: string;
  title: string;
  description: string;
  targetWeek: number;
  criteria: string[];
  reward: {
    type: 'badge' | 'unlock' | 'message';
    value: string;
  };
}

// Başa çıkma stratejisi
interface CopingStrategy {
  name: string;
  description: string;
  steps: string[];
  whenToUse: string;
  effectiveness: 'high' | 'medium' | 'low';
}

// Acil durum kişisi
interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  availability: string;
}

// İlerleme beklentisi
interface ProgressExpectation {
  week: number;
  expectedLevel: string;
  indicators: string[];
}

// Plan oluşturma parametreleri
interface PlanGenerationParams {
  userProfile: UserProfileAnalysis;
  ocdSeverity: 'mild' | 'moderate' | 'severe';
  preferredApproach: 'cbt' | 'erp' | 'act' | 'mixed';
  timeCommitment?: 'minimal' | 'moderate' | 'full';
  specificGoals?: string[];
}

/**
 * Kişiselleştirilmiş tedavi planı oluşturur
 * @param params Plan oluşturma parametreleri
 * @returns Kişiselleştirilmiş tedavi planı
 */
export async function generatePersonalizedPlan(
  params: PlanGenerationParams
): Promise<PersonalizedTreatmentPlan> {
  const startTime = Date.now();
  
  try {
    // Temel plan yapısını oluştur
    const basePlan = createBasePlan(params);
    
    // Fazları oluştur
    basePlan.phases = generatePhases(params);
    
    // Günlük rutini kişiselleştir
    basePlan.dailyRoutine = generateDailyRoutine(params);
    
    // Egzersizleri kişiselleştir
    basePlan.exercises = personalizeExercises(params);
    
    // Milestone'ları belirle
    basePlan.milestones = generateMilestones(params);
    
    // Kriz yönetimi planı
    basePlan.crisisManagement = generateCrisisManagement(params);
    
    // İlerleme metriklerini ayarla
    basePlan.progressMetrics = defineProgressMetrics(params);
    
    // Kişiselleştirme notları ekle
    basePlan.personalizationNotes = addPersonalizationNotes(params);
    
    // Telemetri kaydet
    await trackAIInteraction('treatment_plan.generated', {
      duration: Date.now() - startTime,
      approach: params.preferredApproach,
      severity: params.ocdSeverity,
      phaseCount: basePlan.phases.length,
    });
    
    return basePlan;
    
  } catch (error) {
    console.error('Treatment plan generation error:', error);
    throw error;
  }
}

/**
 * Temel plan yapısını oluşturur
 */
function createBasePlan(params: PlanGenerationParams): PersonalizedTreatmentPlan {
  const { userProfile, ocdSeverity, preferredApproach } = params;
  
  // Plan süresi ve yoğunluğu belirleme
  let duration = 12; // Varsayılan 12 hafta
  let intensity: 'light' | 'moderate' | 'intensive' = 'moderate';
  
  if (ocdSeverity === 'severe') {
    duration = 16;
    intensity = 'intensive';
  } else if (ocdSeverity === 'mild') {
    duration = 8;
    intensity = 'light';
  }
  
  // Motivasyon düşükse daha hafif başla
  if (userProfile.psychologicalProfile.motivationLevel === 'low') {
    intensity = 'light';
    duration += 4; // Daha uzun ama daha yavaş
  }
  
  return {
    summary: {
      title: generatePlanTitle(userProfile, preferredApproach),
      description: generatePlanDescription(userProfile, preferredApproach),
      estimatedDuration: duration,
      primaryApproach: preferredApproach,
      intensityLevel: intensity,
    },
    phases: [],
    dailyRoutine: {
      morning: [],
      afternoon: [],
      evening: [],
    },
    exercises: [],
    milestones: [],
    crisisManagement: {
      warningSignsToWatch: [],
      copingStrategies: [],
      emergencyContacts: [],
      safetyPlan: [],
    },
    progressMetrics: {
      primaryMetric: '',
      secondaryMetrics: [],
      assessmentSchedule: 'weekly',
      expectedProgress: [],
    },
    personalizationNotes: {
      strengthsUtilized: [],
      barriersAddressed: [],
      culturalConsiderations: [],
      motivationalStrategies: [],
    },
  };
}

/**
 * Plan başlığı oluşturur
 */
function generatePlanTitle(
  profile: UserProfileAnalysis,
  approach: string
): string {
  const approachTitles = {
    cbt: 'Düşünce Dönüşümü Yolculuğu',
    erp: 'Cesaret ve Özgürlük Planı',
    act: 'Değerlerle Yaşam Programı',
    mixed: 'Bütünsel İyileşme Yolu',
  };
  
  return approachTitles[approach as keyof typeof approachTitles] || 'Kişisel İyileşme Planın';
}

/**
 * Plan açıklaması oluşturur
 */
function generatePlanDescription(
  profile: UserProfileAnalysis,
  approach: string
): string {
  const base = 'Bu plan, senin benzersiz ihtiyaçların ve güçlü yönlerin göz önünde bulundurularak hazırlandı. ';
  
  if (profile.psychologicalProfile.motivationLevel === 'high') {
    return base + 'Motivasyonun yüksek, bu harika! Birlikte büyük adımlar atabiliriz.';
  } else if (profile.ocdProfile.severity === 'severe') {
    return base + 'Zorlukların farkındayım. Küçük ama anlamlı adımlarla ilerleyeceğiz.';
  } else {
    return base + 'Dengeli ve sürdürülebilir bir yaklaşımla hedeflerine ulaşacaksın.';
  }
}

/**
 * Tedavi fazlarını oluşturur
 */
function generatePhases(params: PlanGenerationParams): TreatmentPhase[] {
  const { userProfile, ocdSeverity, preferredApproach } = params;
  const phases: TreatmentPhase[] = [];
  
  // Faz 1: Temel ve Hazırlık (1-2 hafta)
  phases.push({
    weekNumber: 1,
    title: 'Tanışma ve Temel Atma',
    focus: 'OKB'yi anlamak ve motivasyon oluşturmak',
    goals: [
      'OKB döngüsünü öğrenmek',
      'Kişisel tetikleyicileri belirlemek',
      'Günlük takip alışkanlığı kazanmak',
      'Gevşeme teknikleri öğrenmek',
    ],
    exercises: ['psychoeducation_1', 'trigger_identification', 'breathing_4_7_8'],
    expectedChallenges: ['İlk adımın zorluğu', 'Belirsizlik kaygısı'],
    successCriteria: ['3 gün üst üste takip yapma', 'Bir gevşeme tekniği öğrenme'],
  });
  
  phases.push({
    weekNumber: 2,
    title: 'Farkındalık Geliştirme',
    focus: 'Obsesyon ve kompulsiyonları tanıma',
    goals: [
      'Düşünce-duygu-davranış bağlantısını görmek',
      'Kompulsiyon öncesi anları fark etmek',
      'İlk direniş denemesi',
    ],
    exercises: ['thought_record', 'urge_surfing', 'mindful_observation'],
    expectedChallenges: ['Artan kaygı', 'Kontrol kaybı korkusu'],
    successCriteria: ['5 düşünce kaydı', '1 başarılı direniş'],
  });
  
  // Approach'e göre orta fazlar
  if (preferredApproach === 'erp' || preferredApproach === 'mixed') {
    // ERP fazları
    phases.push({
      weekNumber: 3,
      title: 'Hafif Maruz Bırakma',
      focus: 'Düşük kaygılı durumlarla yüzleşme',
      goals: [
        'Kaygı hiyerarşisi oluşturmak',
        'İlk maruz bırakma egzersizi',
        'Kaygı toleransı geliştirmek',
      ],
      exercises: ['hierarchy_building', 'erp_level_1', 'anxiety_tracking'],
      expectedChallenges: ['Kaçınma dürtüsü', 'Fiziksel belirtiler'],
      successCriteria: ['Hiyerarşi tamamlama', '3 maruz bırakma seansı'],
    });
    
    // Daha fazla ERP fazı ekle...
  }
  
  if (preferredApproach === 'cbt' || preferredApproach === 'mixed') {
    // CBT fazları
    phases.push({
      weekNumber: 4,
      title: 'Düşünce Yapılandırma',
      focus: 'Olumsuz düşünce kalıplarını değiştirme',
      goals: [
        'Bilişsel çarpıtmaları tanıma',
        'Alternatif düşünceler geliştirme',
        'Kanıt toplama tekniği',
      ],
      exercises: ['thought_challenging', 'evidence_for_against', 'balanced_thinking'],
      expectedChallenges: ['Düşüncelere inanma', 'Değişime direnç'],
      successCriteria: ['5 düşünce meydan okuma', 'Mood iyileşmesi'],
    });
  }
  
  // Son faz: Sürdürme ve Önleme
  phases.push({
    weekNumber: phases.length + 1,
    title: 'Güçlendirme ve Sürdürme',
    focus: 'Kazanımları pekiştirme ve relaps önleme',
    goals: [
      'Kişisel başa çıkma planı oluşturma',
      'Erken uyarı işaretlerini belirleme',
      'Destek sistemini güçlendirme',
      'Uzun vadeli hedefler koyma',
    ],
    exercises: ['relapse_prevention', 'support_mapping', 'future_visioning'],
    expectedChallenges: ['Motivasyon düşüşü', 'Aşırı güven'],
    successCriteria: ['Yazılı önleme planı', 'Destek ağı oluşturma'],
  });
  
  return phases;
}

/**
 * Günlük rutin oluşturur
 */
function generateDailyRoutine(params: PlanGenerationParams): PersonalizedTreatmentPlan['dailyRoutine'] {
  const { userProfile, ocdSeverity } = params;
  const routine: PersonalizedTreatmentPlan['dailyRoutine'] = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  
  // Sabah rutini
  routine.morning.push({
    time: '07:00',
    activity: 'Farkındalık ile Güne Başlama',
    duration: 5,
    type: 'reflection',
    isOptional: false,
  });
  
  if (ocdSeverity !== 'severe') {
    routine.morning.push({
      time: '07:30',
      activity: 'Hafif Egzersiz veya Yürüyüş',
      duration: 20,
      type: 'self_care',
      isOptional: true,
    });
  }
  
  // Öğleden sonra
  routine.afternoon.push({
    time: '14:00',
    activity: 'Günlük OKB Egzersizi',
    duration: 15,
    type: 'exercise',
    isOptional: false,
  });
  
  // Akşam
  routine.evening.push({
    time: '20:00',
    activity: 'Günlük Değerlendirme ve Takip',
    duration: 10,
    type: 'reflection',
    isOptional: false,
  });
  
  routine.evening.push({
    time: '21:00',
    activity: 'Gevşeme veya Meditasyon',
    duration: 15,
    type: 'self_care',
    isOptional: true,
  });
  
  return routine;
}

/**
 * Egzersizleri kişiselleştirir
 */
function personalizeExercises(params: PlanGenerationParams): PersonalizedExercise[] {
  const { userProfile } = params;
  const exercises: PersonalizedExercise[] = [];
  
  // Temel nefes egzersizi - herkes için
  exercises.push({
    id: 'breath_personalized_1',
    baseExerciseId: 'breathing_4_7_8',
    title: '4-7-8 Nefes Tekniği',
    description: 'Kaygıyı azaltan güçlü bir nefes egzersizi',
    personalizedInstructions: [
      userProfile.psychologicalProfile.motivationLevel === 'low' 
        ? 'Günde sadece 1 kez yapman yeterli, kendini zorlama'
        : 'Günde 2-3 kez yapabilirsin',
      'Rahat bir pozisyonda otur veya uzan',
      '4 saniye nefes al, 7 saniye tut, 8 saniye ver',
    ],
    difficulty: 'easy',
    estimatedDuration: 5,
    frequency: 'daily',
    adaptations: userProfile.communicationStyle.responseLength === 'brief'
      ? ['Kısa ve net talimatlar']
      : ['Detaylı açıklamalar'],
  });
  
  // OKB tipine göre özel egzersizler
  if (userProfile.ocdProfile.primaryObsessions.includes('contamination')) {
    exercises.push({
      id: 'contamination_erp_1',
      baseExerciseId: 'contamination_exposure_1',
      title: 'Kirlenme Korkusu ile Yüzleşme',
      description: 'Kademeli olarak kirlenme korkunu azaltma egzersizi',
      personalizedInstructions: [
        'Bugün sadece 5 dakika temiz olmayan bir yüzeye dokun',
        'Ellerini yıkamayı 10 dakika ertele',
        'Bu sürede hissettiğin duyguları not al',
      ],
      difficulty: 'medium',
      estimatedDuration: 15,
      frequency: 'daily',
      adaptations: ['Başlangıç seviyesi düşük tutuldu'],
    });
  }
  
  return exercises;
}

/**
 * Milestone'ları oluşturur
 */
function generateMilestones(params: PlanGenerationParams): Milestone[] {
  const milestones: Milestone[] = [];
  
  // İlk hafta milestone'ı - herkes için
  milestones.push({
    id: 'first_week',
    title: 'İlk Adım Kahramanı',
    description: 'İlk haftanı tamamladın!',
    targetWeek: 1,
    criteria: [
      '7 gün üst üste uygulama kullanımı',
      'En az 3 egzersiz tamamlama',
      'Günlük takip yapma',
    ],
    reward: {
      type: 'badge',
      value: 'first_step_hero',
    },
  });
  
  // Orta dönem milestone
  milestones.push({
    id: 'halfway',
    title: 'Yolun Yarısı',
    description: 'Planının yarısını tamamladın, harikasın!',
    targetWeek: Math.floor(params.userProfile.psychologicalProfile.readinessForChange / 2),
    criteria: [
      'Tüm haftalık hedefleri tamamlama',
      'En az 5 başarılı maruz bırakma',
      'Kaygı seviyesinde %20 azalma',
    ],
    reward: {
      type: 'unlock',
      value: 'advanced_exercises',
    },
  });
  
  return milestones;
}

/**
 * Kriz yönetimi planı oluşturur
 */
function generateCrisisManagement(params: PlanGenerationParams): PersonalizedTreatmentPlan['crisisManagement'] {
  const { userProfile } = params;
  
  return {
    warningSignsToWatch: [
      'Uyku düzeninde bozulma',
      'Kompulsiyonlarda ani artış',
      'Sosyal izolasyon',
      'Yoğun umutsuzluk hissi',
      ...(userProfile.ocdProfile.severity === 'severe' ? ['İntihar düşünceleri'] : []),
    ],
    copingStrategies: [
      {
        name: 'STOP Tekniği',
        description: 'Dur, Nefes Al, Gözle, Devam Et',
        steps: [
          'DUR - Ne yapıyorsan dur',
          'NEFES AL - 3 derin nefes al',
          'GÖZLE - Etrafına bak, 5 şey say',
          'DEVAM ET - Sakinleşince devam et',
        ],
        whenToUse: 'Yoğun kaygı anında',
        effectiveness: 'high',
      },
      {
        name: 'Buz Tekniği',
        description: 'Yoğun dürtüleri azaltmak için soğuk kullanma',
        steps: [
          'Bir kase buzlu su hazırla',
          'Yüzünü 10 saniye suya daldır',
          'Veya bileklerine buz koy',
        ],
        whenToUse: 'Kontrol edilemez dürtüler',
        effectiveness: 'high',
      },
    ],
    emergencyContacts: [
      {
        name: 'Kriz Destek Hattı',
        role: 'Profesyonel destek',
        phone: '182',
        availability: '7/24',
      },
    ],
    safetyPlan: [
      'Güvenli bir yere git (odan, park vb.)',
      'Güvendiğin birini ara',
      'Acil ilaçlarını al (varsa)',
      'Kriz kartını oku',
      'Gerekirse 112 veya 182\'yi ara',
    ],
  };
}

/**
 * İlerleme metriklerini tanımlar
 */
function defineProgressMetrics(params: PlanGenerationParams): PersonalizedTreatmentPlan['progressMetrics'] {
  const { ocdSeverity, preferredApproach } = params;
  
  let primaryMetric = 'Y-BOCS skoru';
  const secondaryMetrics = ['Günlük kompulsiyon sayısı', 'Kaygı seviyesi (1-10)'];
  
  if (preferredApproach === 'erp') {
    primaryMetric = 'Başarılı maruz bırakma sayısı';
    secondaryMetrics.push('Kaçınma davranışı sıklığı');
  } else if (preferredApproach === 'act') {
    primaryMetric = 'Değer odaklı aktivite sayısı';
    secondaryMetrics.push('Psikolojik esneklik skoru');
  }
  
  const assessmentSchedule = ocdSeverity === 'severe' ? 'daily' : 'weekly';
  
  return {
    primaryMetric,
    secondaryMetrics,
    assessmentSchedule,
    expectedProgress: [
      {
        week: 2,
        expectedLevel: '%10 iyileşme',
        indicators: ['Farkındalık artışı', 'Takip alışkanlığı'],
      },
      {
        week: 4,
        expectedLevel: '%25 iyileşme',
        indicators: ['Kompulsiyon azalması', 'Kaygı yönetimi'],
      },
      {
        week: 8,
        expectedLevel: '%50 iyileşme',
        indicators: ['Fonksiyonel iyileşme', 'Yaşam kalitesi artışı'],
      },
    ],
  };
}

/**
 * Kişiselleştirme notları ekler
 */
function addPersonalizationNotes(params: PlanGenerationParams): PersonalizedTreatmentPlan['personalizationNotes'] {
  const { userProfile } = params;
  
  return {
    strengthsUtilized: userProfile.psychologicalProfile.strengths,
    barriersAddressed: [
      ...userProfile.psychologicalProfile.challenges,
      ...userProfile.treatmentReadiness.barriers,
    ],
    culturalConsiderations: userProfile.communicationStyle.culturalSensitivity,
    motivationalStrategies: [
      userProfile.psychologicalProfile.motivationLevel === 'low'
        ? 'Küçük başarıları kutlama'
        : 'Zorlu hedefler koyma',
      'Düzenli geri bildirim',
      'İlerleme görselleştirme',
      'Sosyal destek kullanma',
    ],
  };
} 