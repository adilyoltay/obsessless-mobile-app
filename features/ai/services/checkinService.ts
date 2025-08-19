import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { AIEventType, trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';

export type NLUResult = {
  mood: number; // 0..100
  trigger: string; // e.g., 'temizlik' | 'kontrol' | 'sosyal' | 'ev' | 'iş' | 'genel'
  confidence: number; // 0..1
  lang: 'tr' | 'en';
};

export type RouteDecision = 'ERP' | 'REFRAME';

export type UnifiedAnalysisResult = {
  type: 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK';
  confidence: number;
  mood?: number;
  trigger?: string;
  category?: string;
  suggestion?: string;
  originalText: string;
};

const TRIGGERS_TR: Record<string, string> = {
  temizlik: 'temizlik',
  kir: 'temizlik',
  mikrop: 'temizlik',
  kontrol: 'kontrol',
  kapı: 'kontrol',
  ocak: 'kontrol',
  sosyal: 'sosyal',
  insan: 'sosyal',
  misafir: 'sosyal',
  ev: 'ev',
  iş: 'iş',
};

const TRIGGERS_EN: Record<string, string> = {
  clean: 'temizlik',
  dirt: 'temizlik',
  germ: 'temizlik',
  check: 'kontrol',
  door: 'kontrol',
  stove: 'kontrol',
  social: 'sosyal',
  people: 'sosyal',
  guest: 'sosyal',
  home: 'ev',
  work: 'iş',
};

function detectLanguage(text: string): 'tr' | 'en' {
  const trHits = ['ğ', 'ş', 'ı', 'ç', 'ö', 'ü', ' de ', ' mi ', ' çok '].filter(k => text.toLowerCase().includes(k)).length;
  const enHits = [' the ', ' and ', ' i ', ' you ', ' not '].filter(k => text.toLowerCase().includes(k)).length;
  return trHits >= enHits ? 'tr' : 'en';
}

export function simpleNLU(text: string): NLUResult {
  const lang = detectLanguage(text);
  const dict = lang === 'tr' ? TRIGGERS_TR : TRIGGERS_EN;
  const lower = text.toLowerCase();
  let trigger = 'genel';
  let triggerHits = 0;
  Object.keys(dict).forEach(key => {
    if (lower.includes(key)) {
      trigger = dict[key];
      triggerHits += 1;
    }
  });
  // Rough mood heuristic based on valence words
  // Kelime haznesi genişletildi (TR/EN karışık, düşük etkili bağlaçlar hariç)
  const negWords = ['korku','kaygı','anksiyete','endişe','gergin','zor','kötü','berbat','panik','bunalmış','yorgun','üzgün','mutsuz','boğucu','anxious','anxiety','panic','worse','bad','tired','sad','overwhelmed'];
  const posWords = ['iyi','rahat','sakin','başardım','ferah','umutlu','mutlu','huzurlu','güçlü','denge','toparladım','iyi hissediyorum','good','calm','ok','better','fine','relaxed','hopeful','grateful','proud'];
  const neg = negWords.filter(w => lower.includes(w)).length;
  const pos = posWords.filter(w => lower.includes(w)).length;
  let mood = Math.max(0, Math.min(100, 60 + (pos - neg) * 12));
  const confidence = Math.max(0.3, Math.min(1, 0.4 + triggerHits * 0.2));
  return { mood, trigger, confidence, lang };
}

export function decideRoute(nlu: NLUResult): RouteDecision {
  // Basit karar: düşük mood veya trigger teması belirgin → ERP, aksi → Reframe
  if (nlu.mood <= 50 || ['temizlik','kontrol'].includes(nlu.trigger)) return 'ERP';
  return 'REFRAME';
}

export async function trackCheckinLifecycle(phase: 'start'|'complete'|'stt_failed', meta: Record<string, any>) {
  if (phase === 'start') {
    await trackAIInteraction(AIEventType.CHECKIN_STARTED, meta);
  } else if (phase === 'complete') {
    await trackAIInteraction(AIEventType.CHECKIN_COMPLETED, meta);
  } else if (phase === 'stt_failed') {
    await trackAIInteraction(AIEventType.STT_FAILED, meta);
  }
}

export async function trackRouteSuggested(route: RouteDecision, meta: Record<string, any>) {
  await trackAIInteraction(AIEventType.ROUTE_SUGGESTED, { route, ...meta });
}

export const LLM_ROUTER_ENABLED = () => FEATURE_FLAGS.isEnabled('LLM_ROUTER');

/**
 * Merkezi Ses Analizi - Gemini API ile otomatik tip tespiti
 * Ses girişini analiz edip MOOD, CBT, OCD, ERP veya BREATHWORK'e yönlendirir
 */
export async function unifiedVoiceAnalysis(text: string): Promise<UnifiedAnalysisResult> {
  try {
    // Önce basit heuristik analiz
    const heuristicResult = heuristicVoiceAnalysis(text);
    
    // Gemini API varsa kullan
    const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (geminiApiKey && FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE')) {
      try {
        const geminiResult = await analyzeWithGemini(text, geminiApiKey);
        if (geminiResult) {
          return geminiResult;
        }
      } catch (error) {
        console.log('Gemini API hatası, heuristik analiz kullanılıyor:', error);
      }
    }
    
    return heuristicResult;
  } catch (error) {
    console.error('Unified voice analysis error:', error);
    // Fallback: basit mood analizi
    return {
      type: 'MOOD',
      confidence: 0.3,
      mood: 50,
      originalText: text
    };
  }
}

/**
 * Heuristik tabanlı ses analizi (Gemini olmadığında fallback)
 */
function heuristicVoiceAnalysis(text: string): UnifiedAnalysisResult {
  const lower = text.toLowerCase();
  
  // CBT tetikleme: bilişsel çarpıtma kalıpları
  const cbtPatterns = [
    /ya\s+(.*?)olursa/i,
    /kesin\s+(.*?)olacak/i,
    /asla\s+(.*?)yapamam/i,
    /herkes\s+(.*?)düşünüyor/i,
    /hep\s+(.*?)oluyor/i,
    /felaket/i,
    /mahvol/i,
    /berbat/i,
    /korkunç/i
  ];
  
  if (cbtPatterns.some(pattern => pattern.test(lower))) {
    return {
      type: 'CBT',
      confidence: 0.7,
      suggestion: 'Düşüncelerini yeniden çerçevelemek ister misin?',
      originalText: text
    };
  }
  
  // OCD tetikleme: kompulsiyon ve obsesyon kalıpları
  const ocdPatterns = [
    /kontrol\s+et/i,
    /tekrar\s+kontrol/i,
    /emin\s+olamıyorum/i,
    /takıntı/i,
    /obsesyon/i,
    /kompulsiyon/i,
    /temizle/i,
    /mikrop/i,
    /kirli/i,
    /bulaş/i
  ];
  
  if (ocdPatterns.some(pattern => pattern.test(lower))) {
    return {
      type: 'OCD',
      confidence: 0.7,
      category: lower.includes('temiz') || lower.includes('mikrop') ? 'temizlik' : 'kontrol',
      originalText: text
    };
  }
  
  // ERP tetikleme: maruz kalma ve direnç
  const erpPatterns = [
    /maruz\s+kal/i,
    /direnç\s+göster/i,
    /erp\s+yap/i,
    /egzersiz/i,
    /pratik/i,
    /alıştırma/i,
    /yüzleş/i
  ];
  
  if (erpPatterns.some(pattern => pattern.test(lower))) {
    return {
      type: 'ERP',
      confidence: 0.7,
      originalText: text
    };
  }
  
  // BREATHWORK tetikleme: nefes ve rahatlama
  const breathPatterns = [
    /nefes/i,
    /rahatla/i,
    /sakinleş/i,
    /meditasyon/i,
    /mindfulness/i,
    /farkındalık/i,
    /derin\s+nefes/i
  ];
  
  if (breathPatterns.some(pattern => pattern.test(lower))) {
    return {
      type: 'BREATHWORK',
      confidence: 0.7,
      originalText: text
    };
  }
  
  // Default: MOOD analizi
  const nlu = simpleNLU(text);
  return {
    type: 'MOOD',
    confidence: nlu.confidence,
    mood: nlu.mood,
    trigger: nlu.trigger,
    originalText: text
  };
}

/**
 * Gemini API ile gelişmiş analiz
 */
async function analyzeWithGemini(text: string, apiKey: string): Promise<UnifiedAnalysisResult | null> {
  try {
    const prompt = `
Sen bir OKB (Obsesif Kompulsif Bozukluk) tedavi asistanısın. Kullanıcının ses kaydından gelen metni analiz edip hangi tedavi modülüne yönlendirilmesi gerektiğini belirle.

Kullanıcı metni: "${text}"

Lütfen aşağıdaki kategorilerden BİRİNİ seç ve JSON formatında yanıtla:

1. MOOD - Genel duygu durumu paylaşımı (günlük his, enerji seviyesi)
2. CBT - Bilişsel çarpıtmalar içeren düşünceler (felaketleştirme, aşırı genelleme, zihin okuma vb.)
3. OCD - Obsesyon veya kompulsiyon bildirimi (takıntılı düşünceler, kontrol etme, temizleme)
4. ERP - Maruz kalma ve tepki önleme egzersizi talebi veya direnç gösterme
5. BREATHWORK - Rahatlama, nefes egzersizi veya meditasyon ihtiyacı

Yanıt formatı:
{
  "type": "MOOD|CBT|OCD|ERP|BREATHWORK",
  "confidence": 0.0-1.0,
  "mood": 0-100 (sadece MOOD için),
  "category": "string (OCD için: temizlik/kontrol/simetri/sayma/diğer)",
  "suggestion": "Kullanıcıya önerilecek kısa mesaj (Türkçe)"
}

Sadece JSON döndür, başka açıklama ekleme.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      console.error('Gemini API boş yanıt döndü');
      return null;
    }

    // JSON'u parse et
    try {
      const parsed = JSON.parse(resultText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
      return {
        ...parsed,
        originalText: text
      };
    } catch (parseError) {
      console.error('Gemini yanıtı parse edilemedi:', resultText);
      return null;
    }
  } catch (error) {
    console.error('Gemini API çağrısı başarısız:', error);
    return null;
  }
}


