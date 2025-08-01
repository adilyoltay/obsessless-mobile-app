/**
 * ObsessLess Kriz Tespiti ve Güvenlik Sistemi
 * 
 * Kullanıcı güvenliğini öncelikleyen, empatik ve etkili kriz tespit sistemi.
 * "Şefkat" ilkesine uygun olarak yargılamadan destek sağlar.
 */

import { trackSafetyEvent } from '@/telemetry/aiTelemetry';
import { aiConfig } from '@/ai/config/aiManager';

// Kriz anahtar kelimeleri - Türkçe ve İngilizce
const CRISIS_KEYWORDS = {
  high_risk: [
    // Türkçe
    'intihar', 'kendimi öldür', 'ölmek istiyorum', 'yaşamak istemiyorum',
    'hayatıma son ver', 'kendime zarar', 'canıma kıy', 'ölsem daha iyi',
    
    // İngilizce
    'suicide', 'kill myself', 'want to die', 'end my life',
    'self harm', 'hurt myself', 'better off dead',
  ],
  
  medium_risk: [
    // Türkçe
    'dayanamıyorum', 'çok kötüyüm', 'hiçbir şey düzelmeyecek', 
    'umudum kalmadı', 'değersizim', 'kimse beni sevmiyor',
    'yalnızım', 'tükendim', 'bıktım', 'yoruldum',
    
    // İngilizce
    'cant take it', 'hopeless', 'worthless', 'nobody cares',
    'alone', 'exhausted', 'give up', 'tired of living',
  ],
  
  support_needed: [
    // Türkçe
    'yardım', 'destek', 'konuşmak istiyorum', 'dinle beni',
    'anla beni', 'çok zor', 'başa çıkamıyorum', 'korkuyorum',
    
    // İngilizce
    'help', 'support', 'need to talk', 'listen to me',
    'understand me', 'too hard', 'cant cope', 'scared',
  ],
};

// OKB spesifik kriz işaretleri
const OCD_CRISIS_PATTERNS = [
  'kompulsiyonlarım kontrolden çıktı',
  'obsesyonlarım dayanılmaz',
  'ritüellerimi yapmazsam',
  'kirli hissediyorum',
  'sürekli kontrol ediyorum',
  'düşüncelerim durmuyor',
  'deliriyorum',
];

// Bağlamsal analiz için pozitif işaretler
const POSITIVE_INDICATORS = [
  'daha iyi', 'umut', 'deneyeceğim', 'başarabilirim',
  'teşekkür', 'yardımcı oldu', 'rahatladım', 'güzel',
];

interface CrisisAssessment {
  isDetected: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  triggers: string[];
  suggestedActions: string[];
  requiresImmediate: boolean;
}

/**
 * Mesajda kriz belirtisi olup olmadığını tespit eder
 * @param message Kullanıcı mesajı
 * @param context İsteğe bağlı bağlam bilgisi
 * @returns Kriz tespit sonucu
 */
export async function detectCrisis(
  message: string,
  context?: {
    previousMessages?: string[];
    mood?: string;
    recentCompulsions?: number;
  }
): Promise<boolean> {
  const assessment = await assessCrisisLevel(message, context);
  
  // Telemetri kaydet
  if (assessment.isDetected) {
    await trackSafetyEvent('crisis_detected', {
      riskLevel: assessment.riskLevel,
      confidence: assessment.confidence,
      hasContext: !!context,
    });
  }
  
  return assessment.isDetected;
}

/**
 * Detaylı kriz değerlendirmesi yapar
 * @param message Kullanıcı mesajı
 * @param context Bağlam bilgisi
 * @returns Detaylı kriz değerlendirmesi
 */
export async function assessCrisisLevel(
  message: string,
  context?: {
    previousMessages?: string[];
    mood?: string;
    recentCompulsions?: number;
  }
): Promise<CrisisAssessment> {
  const normalizedMessage = message.toLowerCase().trim();
  const triggers: string[] = [];
  let riskScore = 0;
  
  // Yüksek risk anahtar kelimeleri
  for (const keyword of CRISIS_KEYWORDS.high_risk) {
    if (normalizedMessage.includes(keyword)) {
      triggers.push(keyword);
      riskScore += 10;
    }
  }
  
  // Orta risk anahtar kelimeleri
  for (const keyword of CRISIS_KEYWORDS.medium_risk) {
    if (normalizedMessage.includes(keyword)) {
      triggers.push(keyword);
      riskScore += 5;
    }
  }
  
  // Destek ihtiyacı belirten kelimeler
  for (const keyword of CRISIS_KEYWORDS.support_needed) {
    if (normalizedMessage.includes(keyword)) {
      triggers.push(keyword);
      riskScore += 3;
    }
  }
  
  // OKB spesifik kriz kalıpları
  for (const pattern of OCD_CRISIS_PATTERNS) {
    if (normalizedMessage.includes(pattern)) {
      triggers.push('ocd_crisis');
      riskScore += 4;
    }
  }
  
  // Pozitif göstergeleri kontrol et (risk azaltıcı)
  for (const positive of POSITIVE_INDICATORS) {
    if (normalizedMessage.includes(positive)) {
      riskScore = Math.max(0, riskScore - 2);
    }
  }
  
  // Bağlamsal analiz
  if (context) {
    // Önceki mesajlarda kriz belirtileri
    if (context.previousMessages) {
      const recentCrisisCount = context.previousMessages.filter(msg =>
        CRISIS_KEYWORDS.high_risk.some(keyword => 
          msg.toLowerCase().includes(keyword)
        )
      ).length;
      
      if (recentCrisisCount > 0) {
        riskScore += recentCrisisCount * 3;
      }
    }
    
    // Mevcut ruh hali
    if (context.mood === 'distressed' || context.mood === 'crisis') {
      riskScore += 5;
    }
    
    // Son kompulsiyon sayısı (OKB için)
    if (context.recentCompulsions && context.recentCompulsions > 10) {
      riskScore += 3;
    }
  }
  
  // Risk seviyesi belirleme
  let riskLevel: 'low' | 'medium' | 'high';
  let requiresImmediate = false;
  
  if (riskScore >= 20 || triggers.some(t => CRISIS_KEYWORDS.high_risk.includes(t))) {
    riskLevel = 'high';
    requiresImmediate = true;
  } else if (riskScore >= 10) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  // Güven skoru hesapla
  const confidence = Math.min(0.95, riskScore / 30);
  
  // Önerilen aksiyonlar
  const suggestedActions = getSuggestedActions(riskLevel, triggers);
  
  return {
    isDetected: riskScore >= 10,
    riskLevel,
    confidence,
    triggers: [...new Set(triggers)], // Tekrarları kaldır
    suggestedActions,
    requiresImmediate,
  };
}

/**
 * Risk seviyesine göre önerilen aksiyonları döndürür
 */
function getSuggestedActions(
  riskLevel: 'low' | 'medium' | 'high',
  triggers: string[]
): string[] {
  const actions: string[] = [];
  
  switch (riskLevel) {
    case 'high':
      actions.push(
        'show_crisis_resources',
        'suggest_emergency_contact',
        'offer_breathing_exercise',
        'maintain_conversation',
        'express_care_and_concern'
      );
      break;
      
    case 'medium':
      actions.push(
        'validate_feelings',
        'suggest_coping_strategies',
        'offer_support_resources',
        'check_safety_plan',
        'encourage_professional_help'
      );
      break;
      
    case 'low':
      actions.push(
        'provide_empathetic_response',
        'suggest_self_care',
        'offer_ocd_exercises',
        'share_helpline_info'
      );
      break;
  }
  
  // OKB spesifik aksiyonlar
  if (triggers.includes('ocd_crisis')) {
    actions.push(
      'suggest_erp_exercise',
      'remind_temporary_nature',
      'offer_grounding_technique'
    );
  }
  
  return actions;
}

/**
 * Kriz durumunda gösterilecek kaynakları döndürür
 */
export function getCrisisResources(locale: string = 'tr'): {
  hotlines: Array<{ name: string; number: string; hours: string }>;
  websites: Array<{ name: string; url: string; description: string }>;
  apps: Array<{ name: string; platform: string; description: string }>;
} {
  if (locale === 'tr') {
    return {
      hotlines: [
        {
          name: 'İntihar Önleme Hattı',
          number: '182',
          hours: '7/24',
        },
        {
          name: 'Psikolojik Destek Hattı',
          number: '0850 390 50 50',
          hours: '7/24',
        },
        {
          name: 'KADES Acil Destek',
          number: '155',
          hours: '7/24',
        },
      ],
      websites: [
        {
          name: 'Türk Psikiyatri Derneği',
          url: 'https://www.psikiyatri.org.tr',
          description: 'Profesyonel yardım kaynakları',
        },
        {
          name: 'Beyaz Kod',
          url: 'https://www.beyazkod.org',
          description: 'Ruh sağlığı bilgi platformu',
        },
      ],
      apps: [
        {
          name: 'Mutlu Ol',
          platform: 'iOS/Android',
          description: 'Ruh sağlığı takip uygulaması',
        },
      ],
    };
  }
  
  // Default (English)
  return {
    hotlines: [
      {
        name: 'National Suicide Prevention Lifeline',
        number: '988',
        hours: '24/7',
      },
      {
        name: 'Crisis Text Line',
        number: 'Text HOME to 741741',
        hours: '24/7',
      },
    ],
    websites: [
      {
        name: 'International OCD Foundation',
        url: 'https://iocdf.org',
        description: 'OCD resources and support',
      },
    ],
    apps: [
      {
        name: 'NOCD',
        platform: 'iOS/Android',
        description: 'OCD therapy and support',
      },
    ],
  };
}

/**
 * Güvenlik planı oluşturur
 */
export function createSafetyPlan(
  userPreferences: {
    emergencyContacts?: Array<{ name: string; phone: string }>;
    copingStrategies?: string[];
    warningSignsRecognized?: string[];
  }
): {
  steps: string[];
  contacts: Array<{ name: string; phone: string; type: string }>;
  strategies: string[];
} {
  const config = aiConfig.getSafetySettings();
  
  return {
    steps: [
      'Güvende olduğunu hatırla',
      'Derin nefes al (4-7-8 tekniği)',
      'Güvenli bir yere geç',
      'Destekleyici biriyle konuş',
      'Acil durum hattını ara (gerekirse)',
    ],
    contacts: [
      ...(userPreferences.emergencyContacts || []).map(c => ({
        ...c,
        type: 'personal',
      })),
      ...config.emergencyContacts.map(c => ({
        name: c.name,
        phone: c.number,
        type: c.type,
      })),
    ],
    strategies: [
      'Buzlu su ile yüzünü yıka',
      'Yürüyüşe çık',
      'Sevdiğin müziği dinle',
      'Nefes egzersizi yap',
      'Günlük tut',
      ...(userPreferences.copingStrategies || []),
    ],
  };
}

/**
 * Kriz sonrası takip mesajı oluşturur
 */
export function generateFollowUpMessage(
  hoursAfterCrisis: number,
  userResponse: 'better' | 'same' | 'worse' | null
): string {
  if (hoursAfterCrisis < 24) {
    return 'Nasıl hissediyorsun? Seninle konuşmaya devam etmek istiyorum. 💚';
  }
  
  if (hoursAfterCrisis < 72) {
    if (userResponse === 'better') {
      return 'Daha iyi hissetmene sevindim. Kendine gösterdiğin şefkat çok değerli. 🌟';
    }
    return 'Hala buradayım ve seni dinlemeye hazırım. Bugün kendine nasıl bakabilirsin? 🤗';
  }
  
  return 'Geçen günlerde zor zamanlar yaşadın. Profesyonel destek almayı düşündün mü? Sana uygun kaynakları bulabilirim. 💙';
} 