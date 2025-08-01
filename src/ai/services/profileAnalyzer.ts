/**
 * ObsessLess Kullanıcı Profil Analizörü
 * 
 * AI destekli kullanıcı profil analizi. Sohbet geçmişi, değerlendirme sonuçları
 * ve tercihlerden yola çıkarak kapsamlı bir kullanıcı profili oluşturur.
 */

import { AIMessage } from '@/ai/types';
import { trackAIInteraction } from '@/telemetry/aiTelemetry';

// Profil analiz tipleri
export interface UserProfileAnalysis {
  // Demografik ve temel bilgiler
  demographics: {
    ageGroup?: 'teen' | 'young_adult' | 'adult' | 'senior';
    culturalContext?: string;
    language: string;
  };
  
  // OKB profili
  ocdProfile: {
    primaryObsessions: ObsessionType[];
    primaryCompulsions: CompulsionType[];
    severity: 'mild' | 'moderate' | 'severe';
    onset: 'childhood' | 'adolescence' | 'adult';
    triggers: string[];
    avoidanceBehaviors: string[];
    insightLevel: 'good' | 'fair' | 'poor'; // OKB farkındalığı
  };
  
  // Psikolojik profil
  psychologicalProfile: {
    motivationLevel: 'low' | 'medium' | 'high';
    readinessForChange: number; // 1-10
    copingMechanisms: string[];
    strengths: string[];
    challenges: string[];
    comorbidities: string[]; // Eşlik eden durumlar
  };
  
  // İletişim tercihleri
  communicationStyle: {
    preferredTone: 'formal' | 'friendly' | 'empathetic' | 'direct';
    responseLength: 'brief' | 'moderate' | 'detailed';
    metaphorUsage: boolean;
    technicalLanguage: boolean;
    culturalSensitivity: string[];
  };
  
  // Tedavi uygunluğu
  treatmentReadiness: {
    therapyExperience: 'none' | 'some' | 'extensive';
    medicationStatus: 'none' | 'current' | 'past';
    preferredModality: 'cbt' | 'erp' | 'act' | 'mixed';
    barriers: string[]; // Tedaviye engeller
    supportSystem: 'strong' | 'moderate' | 'limited';
  };
  
  // Risk değerlendirmesi
  riskAssessment: {
    suicideRisk: 'low' | 'medium' | 'high';
    selfHarmRisk: 'low' | 'medium' | 'high';
    functionalImpairment: 'minimal' | 'moderate' | 'severe';
    urgencyLevel: 'routine' | 'priority' | 'urgent';
  };
  
  // AI önerileri
  aiRecommendations: {
    primaryApproach: string;
    initialFocus: string[];
    cautionAreas: string[];
    strengthsToLeverage: string[];
    expectedChallenges: string[];
  };
}

// OKB obsesyon tipleri
export type ObsessionType = 
  | 'contamination'      // Kirlenme
  | 'harm'              // Zarar verme
  | 'symmetry'          // Simetri/düzen
  | 'religious'         // Dini
  | 'sexual'            // Cinsel
  | 'relationship'      // İlişkisel
  | 'existential'       // Varoluşsal
  | 'somatic'           // Bedensel
  | 'just_right';       // Tam doğru hissi

// OKB kompulsiyon tipleri
export type CompulsionType =
  | 'washing'           // Yıkama
  | 'checking'          // Kontrol
  | 'ordering'          // Düzenleme
  | 'counting'          // Sayma
  | 'repeating'         // Tekrarlama
  | 'mental'            // Zihinsel
  | 'reassurance'       // Güvence arama
  | 'avoidance';        // Kaçınma

// Analiz parametreleri
interface AnalysisParams {
  chatHistory: AIMessage[];
  assessmentResults?: any;
  preferences?: any;
  behavioralData?: {
    appUsagePatterns?: any;
    exerciseCompletion?: any;
    compulsionLogs?: any;
  };
}

/**
 * Kullanıcı profilini analiz eder
 * @param params Analiz parametreleri
 * @returns Detaylı kullanıcı profil analizi
 */
export async function analyzeUserProfile(
  params: AnalysisParams
): Promise<UserProfileAnalysis> {
  const startTime = Date.now();
  
  try {
    // Sohbet geçmişinden içgörüler çıkar
    const chatInsights = analyzeChatHistory(params.chatHistory);
    
    // Değerlendirme sonuçlarını analiz et
    const assessmentInsights = analyzeAssessmentResults(params.assessmentResults);
    
    // Davranışsal verileri analiz et
    const behavioralInsights = analyzeBehavioralData(params.behavioralData);
    
    // Tüm içgörüleri birleştir
    const profile = synthesizeProfile(
      chatInsights,
      assessmentInsights,
      behavioralInsights
    );
    
    // Risk değerlendirmesi yap
    profile.riskAssessment = assessRisk(profile);
    
    // AI önerileri oluştur
    profile.aiRecommendations = generateRecommendations(profile);
    
    // Telemetri kaydet
    await trackAIInteraction('profile.analyzed', {
      duration: Date.now() - startTime,
      severity: profile.ocdProfile.severity,
      riskLevel: profile.riskAssessment.urgencyLevel,
    });
    
    return profile;
    
  } catch (error) {
    console.error('Profile analysis error:', error);
    throw error;
  }
}

/**
 * Sohbet geçmişini analiz eder
 */
function analyzeChatHistory(messages: AIMessage[]): Partial<UserProfileAnalysis> {
  if (!messages || messages.length === 0) {
    return {};
  }
  
  // Kullanıcı mesajlarını filtrele
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase());
  
  // Dil ve ton analizi
  const communicationStyle = analyzeCommunicationStyle(userMessages);
  
  // OKB belirtileri ara
  const ocdIndicators = detectOCDIndicators(userMessages);
  
  // Duygusal durum analizi
  const emotionalState = analyzeEmotionalState(userMessages);
  
  return {
    communicationStyle,
    ocdProfile: ocdIndicators,
    psychologicalProfile: emotionalState,
  };
}

/**
 * İletişim stilini analiz eder
 */
function analyzeCommunicationStyle(messages: string[]): UserProfileAnalysis['communicationStyle'] {
  const totalLength = messages.reduce((sum, msg) => sum + msg.length, 0);
  const avgLength = totalLength / messages.length;
  
  // Mesaj uzunluğuna göre tercih
  let responseLength: 'brief' | 'moderate' | 'detailed' = 'moderate';
  if (avgLength < 50) responseLength = 'brief';
  else if (avgLength > 150) responseLength = 'detailed';
  
  // Ton analizi için anahtar kelimeler
  const formalWords = ['sayın', 'lütfen', 'rica', 'teşekkür'];
  const friendlyWords = ['ya', 'yaa', ':)', 'haha', '😊'];
  const technicalWords = ['obsesyon', 'kompulsiyon', 'erp', 'cbt'];
  
  let preferredTone: 'formal' | 'friendly' | 'empathetic' | 'direct' = 'empathetic';
  
  const messageText = messages.join(' ');
  const formalCount = formalWords.filter(w => messageText.includes(w)).length;
  const friendlyCount = friendlyWords.filter(w => messageText.includes(w)).length;
  
  if (formalCount > friendlyCount) preferredTone = 'formal';
  else if (friendlyCount > formalCount) preferredTone = 'friendly';
  
  return {
    preferredTone,
    responseLength,
    metaphorUsage: messageText.includes('gibi') || messageText.includes('sanki'),
    technicalLanguage: technicalWords.some(w => messageText.includes(w)),
    culturalSensitivity: [], // TODO: Kültürel hassasiyetleri tespit et
  };
}

/**
 * OKB belirtilerini tespit eder
 */
function detectOCDIndicators(messages: string[]): Partial<UserProfileAnalysis['ocdProfile']> {
  const messageText = messages.join(' ');
  
  // Obsesyon tipleri için anahtar kelimeler
  const obsessionKeywords: Record<ObsessionType, string[]> = {
    contamination: ['kirli', 'mikrop', 'bulaş', 'temiz', 'hijyen', 'hasta'],
    harm: ['zarar', 'incit', 'kötü', 'suç', 'kaza', 'sorumluluk'],
    symmetry: ['düzen', 'simetri', 'düz', 'hizala', 'mükemmel', 'tam'],
    religious: ['günah', 'haram', 'helal', 'dua', 'allah', 'tanrı'],
    sexual: ['cinsel', 'sapkın', 'uygunsuz', 'ahlak'],
    relationship: ['sevgili', 'eş', 'aşk', 'aldatma', 'güven'],
    existential: ['anlam', 'gerçek', 'varoluş', 'ölüm', 'hayat'],
    somatic: ['hastalık', 'belirti', 'ağrı', 'nefes', 'kalp'],
    just_right: ['tam', 'doğru', 'his', 'rahatsız', 'tekrar'],
  };
  
  // Kompulsiyon tipleri için anahtar kelimeler
  const compulsionKeywords: Record<CompulsionType, string[]> = {
    washing: ['yıka', 'temizle', 'dezenfekte', 'sabun', 'el'],
    checking: ['kontrol', 'emin', 'bak', 'kapat', 'kilitle'],
    ordering: ['düzenle', 'sırala', 'hizala', 'yerleştir'],
    counting: ['say', 'rakam', 'sayı', 'kaç', 'hesapla'],
    repeating: ['tekrar', 'yeniden', 'bir daha', 'sürekli'],
    mental: ['düşün', 'hayal', 'zihin', 'kafamda', 'aklımda'],
    reassurance: ['emin misin', 'doğru mu', 'onay', 'söyle'],
    avoidance: ['yapamam', 'gidemem', 'dokunamam', 'kaçın'],
  };
  
  // Tespit edilen obsesyonlar ve kompulsiyonlar
  const detectedObsessions: ObsessionType[] = [];
  const detectedCompulsions: CompulsionType[] = [];
  
  // Anahtar kelime eşleştirmesi
  for (const [type, keywords] of Object.entries(obsessionKeywords)) {
    if (keywords.some(keyword => messageText.includes(keyword))) {
      detectedObsessions.push(type as ObsessionType);
    }
  }
  
  for (const [type, keywords] of Object.entries(compulsionKeywords)) {
    if (keywords.some(keyword => messageText.includes(keyword))) {
      detectedCompulsions.push(type as CompulsionType);
    }
  }
  
  // Şiddet tahmini (basit)
  let severity: 'mild' | 'moderate' | 'severe' = 'moderate';
  const severityIndicators = {
    mild: ['bazen', 'hafif', 'az', 'nadiren'],
    severe: ['sürekli', 'her zaman', 'dayanamıyorum', 'çıldırıyorum', 'hayatım'],
  };
  
  if (severityIndicators.severe.some(word => messageText.includes(word))) {
    severity = 'severe';
  } else if (severityIndicators.mild.some(word => messageText.includes(word))) {
    severity = 'mild';
  }
  
  return {
    primaryObsessions: detectedObsessions,
    primaryCompulsions: detectedCompulsions,
    severity,
    triggers: [], // TODO: Tetikleyicileri tespit et
    avoidanceBehaviors: [], // TODO: Kaçınma davranışlarını tespit et
  };
}

/**
 * Duygusal durumu analiz eder
 */
function analyzeEmotionalState(messages: string[]): Partial<UserProfileAnalysis['psychologicalProfile']> {
  const messageText = messages.join(' ');
  
  // Motivasyon göstergeleri
  const highMotivation = ['başaracağım', 'deneyeceğim', 'hazırım', 'istiyorum'];
  const lowMotivation = ['yapamam', 'olmaz', 'başaramam', 'yoruldum'];
  
  let motivationLevel: 'low' | 'medium' | 'high' = 'medium';
  
  if (highMotivation.some(word => messageText.includes(word))) {
    motivationLevel = 'high';
  } else if (lowMotivation.some(word => messageText.includes(word))) {
    motivationLevel = 'low';
  }
  
  // Güçlü yönler
  const strengths: string[] = [];
  if (messageText.includes('çalış')) strengths.push('Çalışkanlık');
  if (messageText.includes('dene')) strengths.push('Denemeye istekli');
  if (messageText.includes('öğren')) strengths.push('Öğrenmeye açık');
  
  // Zorluklar
  const challenges: string[] = [];
  if (messageText.includes('zor')) challenges.push('Zorluk algısı');
  if (messageText.includes('korku')) challenges.push('Kaygı/korku');
  if (messageText.includes('yalnız')) challenges.push('Yalnızlık hissi');
  
  return {
    motivationLevel,
    readinessForChange: motivationLevel === 'high' ? 8 : motivationLevel === 'low' ? 3 : 5,
    strengths,
    challenges,
    copingMechanisms: [], // TODO: Başa çıkma mekanizmalarını tespit et
  };
}

/**
 * Değerlendirme sonuçlarını analiz eder
 */
function analyzeAssessmentResults(results: any): Partial<UserProfileAnalysis> {
  if (!results) return {};
  
  // TODO: Y-BOCS ve diğer değerlendirme sonuçlarını analiz et
  return {
    ocdProfile: {
      severity: results.severity || 'moderate',
      primaryObsessions: results.obsessions || [],
      primaryCompulsions: results.compulsions || [],
      onset: results.onset || 'adult',
      triggers: results.triggers || [],
      avoidanceBehaviors: results.avoidance || [],
      insightLevel: results.insight || 'fair',
    },
  };
}

/**
 * Davranışsal verileri analiz eder
 */
function analyzeBehavioralData(data: any): Partial<UserProfileAnalysis> {
  if (!data) return {};
  
  // TODO: Uygulama kullanım kalıpları, egzersiz tamamlama vb. analiz et
  return {};
}

/**
 * Tüm içgörüleri birleştirir
 */
function synthesizeProfile(
  ...insights: Partial<UserProfileAnalysis>[]
): UserProfileAnalysis {
  // Varsayılan profil
  const defaultProfile: UserProfileAnalysis = {
    demographics: {
      language: 'tr',
    },
    ocdProfile: {
      primaryObsessions: [],
      primaryCompulsions: [],
      severity: 'moderate',
      onset: 'adult',
      triggers: [],
      avoidanceBehaviors: [],
      insightLevel: 'fair',
    },
    psychologicalProfile: {
      motivationLevel: 'medium',
      readinessForChange: 5,
      copingMechanisms: [],
      strengths: [],
      challenges: [],
      comorbidities: [],
    },
    communicationStyle: {
      preferredTone: 'empathetic',
      responseLength: 'moderate',
      metaphorUsage: true,
      technicalLanguage: false,
      culturalSensitivity: [],
    },
    treatmentReadiness: {
      therapyExperience: 'none',
      medicationStatus: 'none',
      preferredModality: 'mixed',
      barriers: [],
      supportSystem: 'moderate',
    },
    riskAssessment: {
      suicideRisk: 'low',
      selfHarmRisk: 'low',
      functionalImpairment: 'moderate',
      urgencyLevel: 'routine',
    },
    aiRecommendations: {
      primaryApproach: '',
      initialFocus: [],
      cautionAreas: [],
      strengthsToLeverage: [],
      expectedChallenges: [],
    },
  };
  
  // İçgörüleri birleştir
  return insights.reduce((profile, insight) => {
    return deepMerge(profile, insight);
  }, defaultProfile);
}

/**
 * Risk değerlendirmesi yapar
 */
function assessRisk(profile: UserProfileAnalysis): UserProfileAnalysis['riskAssessment'] {
  let urgencyLevel: 'routine' | 'priority' | 'urgent' = 'routine';
  
  // Şiddet bazlı risk
  if (profile.ocdProfile.severity === 'severe') {
    urgencyLevel = 'priority';
  }
  
  // İşlevsellik bozukluğu
  if (profile.psychologicalProfile.challenges.length > 3) {
    urgencyLevel = 'priority';
  }
  
  // Motivasyon düşükse risk artar
  if (profile.psychologicalProfile.motivationLevel === 'low') {
    urgencyLevel = urgencyLevel === 'routine' ? 'priority' : 'urgent';
  }
  
  return {
    suicideRisk: 'low', // TODO: Daha detaylı risk analizi
    selfHarmRisk: 'low',
    functionalImpairment: profile.ocdProfile.severity === 'severe' ? 'severe' : 'moderate',
    urgencyLevel,
  };
}

/**
 * AI önerileri oluşturur
 */
function generateRecommendations(
  profile: UserProfileAnalysis
): UserProfileAnalysis['aiRecommendations'] {
  const recommendations: UserProfileAnalysis['aiRecommendations'] = {
    primaryApproach: '',
    initialFocus: [],
    cautionAreas: [],
    strengthsToLeverage: [],
    expectedChallenges: [],
  };
  
  // Ana yaklaşım önerisi
  if (profile.ocdProfile.severity === 'severe') {
    recommendations.primaryApproach = 'Yoğun ERP + profesyonel destek';
  } else if (profile.psychologicalProfile.motivationLevel === 'high') {
    recommendations.primaryApproach = 'Kendi kendine yardım + haftalık AI desteği';
  } else {
    recommendations.primaryApproach = 'Kademeli maruz bırakma + motivasyon desteği';
  }
  
  // İlk odak alanları
  if (profile.ocdProfile.primaryObsessions.includes('contamination')) {
    recommendations.initialFocus.push('Kirlenme korkusu ile başa çıkma');
  }
  if (profile.ocdProfile.primaryCompulsions.includes('checking')) {
    recommendations.initialFocus.push('Kontrol ritüellerini azaltma');
  }
  
  // Dikkat edilmesi gerekenler
  if (profile.psychologicalProfile.motivationLevel === 'low') {
    recommendations.cautionAreas.push('Motivasyon eksikliği - küçük adımlarla başla');
  }
  if (profile.ocdProfile.insightLevel === 'poor') {
    recommendations.cautionAreas.push('OKB farkındalığı düşük - psikoeğitim önemli');
  }
  
  // Güçlü yönlerden yararlanma
  recommendations.strengthsToLeverage = profile.psychologicalProfile.strengths;
  
  // Beklenen zorluklar
  if (profile.treatmentReadiness.therapyExperience === 'none') {
    recommendations.expectedChallenges.push('İlk terapi deneyimi - sabır gerekli');
  }
  
  return recommendations;
}

/**
 * Derin birleştirme yardımcı fonksiyonu
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
} 