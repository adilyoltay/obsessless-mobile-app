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
    // React Native'de process.env runtime'da çalışmaz, Constants kullan
    const Constants = require('expo-constants').default;
    const geminiApiKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY || 
                         Constants.manifest?.extra?.EXPO_PUBLIC_GEMINI_API_KEY ||
                         process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    console.log('🤖 Gemini API check:', {
      hasKey: !!geminiApiKey,
      keyLength: geminiApiKey?.length,
      featureEnabled: FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE'),
      text: text.substring(0, 50) + '...'
    });
    
    if (geminiApiKey && FEATURE_FLAGS.isEnabled('AI_UNIFIED_VOICE')) {
      try {
        console.log('🚀 Calling Gemini API for voice analysis...');
        const geminiResult = await analyzeWithGemini(text, geminiApiKey);
        if (geminiResult) {
          console.log('✅ Gemini analysis successful:', geminiResult);
          return geminiResult;
        } else {
          console.log('⚠️ Gemini returned null, falling back to heuristic');
        }
      } catch (error) {
        console.log('❌ Gemini API error, using heuristic analysis:', error);
      }
    } else {
      console.log('⚠️ Gemini API not available or feature disabled, using heuristic');
    }
    
    console.log('📊 Using heuristic result:', heuristicResult);
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
  
  // CBT tetikleme: bilişsel çarpıtma kalıpları (Genişletilmiş)
  const cbtPatterns = [
    // Felaketleştirme
    /ya\s+(.*?)olursa/i,
    /kesin\s+(.*?)olacak/i,
    /felaket/i,
    /mahvol/i,
    /berbat/i,
    /korkunç/i,
    /dünyanın\s+sonu/i,
    /hayatım\s+bitti/i,
    /her\s+şey\s+mahvoldu/i,
    
    // Aşırı genelleme
    /asla\s+(.*?)yapamam/i,
    /asla\s+(.*?)olmaz/i,
    /her\s+zaman/i,
    /hiçbir\s+zaman/i,
    /hep\s+(.*?)oluyor/i,
    /sürekli\s+başıma\s+geliyor/i,
    /daima/i,
    
    // Zihin okuma
    /herkes\s+(.*?)düşünüyor/i,
    /benden\s+nefret\s+ediyor/i,
    /beni\s+sevmiyor/i,
    /arkamdan\s+konuşuyor/i,
    /benimle\s+dalga\s+geçiyor/i,
    /beni\s+aptal\s+sanıyor/i,
    
    // Etiketleme
    /ben\s+bir\s+başarısızım/i,
    /ben\s+aptalım/i,
    /ben\s+değersizim/i,
    /ben\s+beceriksizim/i,
    /hiçbir\s+işe\s+yaramıyorum/i,
    
    // Meli-malı düşünceler
    /yapmalıyım/i,
    /etmeliyim/i,
    /zorundayım/i,
    /mecburum/i,
    /şart/i,
    /olmak\s+zorunda/i,
    
    // Kişiselleştirme
    /benim\s+yüzümden/i,
    /benim\s+suçum/i,
    /ben\s+sebep\s+oldum/i,
    /hep\s+ben/i,
    
    // Filtreleme (olumsuz odaklanma)
    /hiç\s+iyi\s+bir\s+şey\s+olmuyor/i,
    /sadece\s+kötü\s+şeyler/i,
    /hep\s+olumsuz/i,
    /pozitif\s+hiçbir\s+şey\s+yok/i
  ];
  
  if (cbtPatterns.some(pattern => pattern.test(lower))) {
    return {
      type: 'CBT',
      confidence: 0.7,
      suggestion: 'Düşüncelerini yeniden çerçevelemek ister misin?',
      originalText: text
    };
  }
  
  // OCD tetikleme: kompulsiyon ve obsesyon kalıpları (Kapsamlı)
  const ocdPatterns = [
    // Kontrol kompulsiyonları
    /kontrol\s+et/i,
    /tekrar\s+kontrol/i,
    /emin\s+olamıyorum/i,
    /kontrol.*etmeden.*duramıyorum/i,
    /kapıyı.*kilitle/i,
    /ocağı.*kapat/i,
    /fişi.*çek/i,
    /pencereyi.*kapat/i,
    /kilidi.*kontrol/i,
    /açık.*bırak/i,
    /kapalı.*mı/i,
    /kontrol.*etmem.*lazım/i,
    /tekrar.*bak/i,
    /geri.*dön.*kontrol/i,
    
    // Temizlik/bulaş obsesyonları
    /temizle/i,
    /mikrop/i,
    /kirli/i,
    /bulaş/i,
    /yıka/i,
    /el.*yıka/i,
    /sürekli.*yıka/i,
    /dezenfekte/i,
    /hijyen/i,
    /pis/i,
    /iğrenç/i,
    /temiz.*değil/i,
    /duş.*al/i,
    /sabun/i,
    /deterjan/i,
    /alkol/i,
    /kolonya/i,
    /ellerimi.*yıkama/i,
    /dokunma/i,
    /dokunursam/i,
    /temas/i,
    
    // Sayma ve sıralama
    /sayı.*say/i,
    /say.*say/i,
    /üç.*kere/i,
    /beş.*kere/i,
    /yedi.*kere/i,
    /çift.*sayı/i,
    /tek.*sayı/i,
    /sırayla/i,
    /sıralama/i,
    
    // Simetri ve düzen
    /simetri/i,
    /düzen/i,
    /yerleştir/i,
    /düzgün.*değil/i,
    /yamuk/i,
    /eğri/i,
    /düzelt/i,
    /hizala/i,
    /tam.*ortada/i,
    /eşit.*mesafe/i,
    /paralel/i,
    
    // Genel obsesyon/kompulsiyon
    /takıntı/i,
    /obsesyon/i,
    /kompulsiyon/i,
    /duramıyorum/i,
    /yapma.*duramıyorum/i,
    /zorunda.*hissediyorum/i,
    /mecbur.*hissediyorum/i,
    /kafama.*takıl/i,
    /aklımdan.*çıkmıyor/i,
    /sürekli.*düşünüyorum/i,
    /beynimden.*atamıyorum/i,
    /tekrar.*tekrar/i,
    
    // Zarar verme obsesyonları
    /zarar.*ver/i,
    /incit/i,
    /kötü.*bir.*şey.*yap/i,
    /kontrolümü.*kaybet/i,
    /birini.*öldür/i,
    
    // Dini/ahlaki obsesyonlar
    /günah/i,
    /haram/i,
    /küfür/i,
    /lanet/i,
    /kötü.*düşünce/i,
    /ahlaksız/i,
    
    // Mental kompulsiyonlar
    /kafamda.*tekrarla/i,
    /zihnimde.*say/i,
    /dua.*et/i,
    /telkin/i,
    /kendime.*söyle/i
  ];
  
  if (ocdPatterns.some(pattern => pattern.test(lower))) {
    // Geliştirilmiş kategori belirleme
    let category = 'other';
    let confidence = 0.8;
    
    // Temizlik/bulaş obsesyonları
    if (/temiz|mikrop|yıka|el|kirli|bulaş|dezenfekte|hijyen|pis|sabun|deterjan|alkol|kolonya|dokunma|temas/i.test(lower)) {
      category = 'contamination';
      confidence = 0.9;
    }
    // Kontrol kompulsiyonları
    else if (/kontrol|emin|kapat|kilitle|ocak|kapı|fiş|pencere|açık.*bırak|kapalı|geri.*dön/i.test(lower)) {
      category = 'checking';
      confidence = 0.9;
    }
    // Simetri ve düzen
    else if (/simetri|düzen|yerleştir|düzgün|yamuk|eğri|düzelt|hizala|ortada|mesafe|paralel/i.test(lower)) {
      category = 'symmetry';
      confidence = 0.85;
    }
    // Sayma
    else if (/sayı|say|kere|çift|tek|sıra/i.test(lower)) {
      category = 'counting';
      confidence = 0.85;
    }
    // Zarar verme
    else if (/zarar|incit|kötü.*şey|kontrol.*kaybet|öldür/i.test(lower)) {
      category = 'harm';
      confidence = 0.9;
    }
    // Dini/ahlaki
    else if (/günah|haram|küfür|lanet|ahlak/i.test(lower)) {
      category = 'religious';
      confidence = 0.85;
    }
    // Tekrarlama
    else if (/tekrar|yeniden|duramıyorum|zorunda|mecbur/i.test(lower)) {
      category = 'repetition';
      confidence = 0.75;
    }
    
    return {
      type: 'OCD',
      confidence: confidence,
      category: category,
      suggestion: `${category === 'contamination' ? 'Temizlik takıntısı' : 
                   category === 'checking' ? 'Kontrol obsesyonu' :
                   category === 'harm' ? 'Zarar verme obsesyonu' :
                   category === 'symmetry' ? 'Düzen obsesyonu' :
                   category === 'counting' ? 'Sayma kompulsiyonu' :
                   category === 'religious' ? 'Dini obsesyon' :
                   'OKB belirtisi'} kaydediliyor...`,
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
  
  // Geliştirilmiş MOOD analizi
  const moodPatterns = {
    // Pozitif mood göstergeleri
    positive: [
      /mutlu/i, /iyi.*hissediyorum/i, /harika/i, /mükemmel/i, /süper/i,
      /rahat/i, /huzurlu/i, /sakin/i, /dinlenmiş/i, /enerjik/i,
      /umutlu/i, /iyimser/i, /pozitif/i, /başarılı/i, /gururlu/i,
      /keyifli/i, /neşeli/i, /coşkulu/i, /heyecanlı/i, /motive/i,
      /güçlü/i, /kendime.*güveniyorum/i, /kontrolde/i, /dengeli/i,
      /şükür/i, /minnettarım/i, /teşekkür/i, /güzel.*gün/i
    ],
    // Negatif mood göstergeleri  
    negative: [
      /üzgün/i, /mutsuz/i, /kötü.*hissediyorum/i, /berbat/i, /rezalet/i,
      /endişeli/i, /kaygılı/i, /gergin/i, /stresli/i, /bunalmış/i,
      /yorgun/i, /bitkin/i, /tükenmiş/i, /enerjim.*yok/i, /güçsüz/i,
      /umutsuz/i, /karamsarım/i, /negatif/i, /başarısız/i, /değersiz/i,
      /sinirli/i, /öfkeli/i, /kızgın/i, /frustre/i, /hayal.*kırıklığı/i,
      /yalnız/i, /izole/i, /anlaşılmamış/i, /reddedilmiş/i,
      /boşluk/i, /anlamsız/i, /kayıp/i, /çaresiz/i, /aciz/i
    ],
    // Nötr/karışık mood
    neutral: [
      /fena.*değil/i, /idare.*eder/i, /normal/i, /ortalama/i,
      /ne.*iyi.*ne.*kötü/i, /karışık/i, /emin.*değilim/i,
      /bilmiyorum/i, /fark.*etmez/i, /öyle.*böyle/i
    ]
  };
  
  // Mood skoru hesaplama
  const positiveCount = moodPatterns.positive.filter(p => p.test(lower)).length;
  const negativeCount = moodPatterns.negative.filter(p => p.test(lower)).length;
  const neutralCount = moodPatterns.neutral.filter(p => p.test(lower)).length;
  
  let mood = 50; // Başlangıç değeri
  let confidence = 0.5;
  let trigger = 'genel';
  
  if (positiveCount > 0 || negativeCount > 0 || neutralCount > 0) {
    // Mood hesaplama
    mood = Math.max(0, Math.min(100, 
      50 + (positiveCount * 15) - (negativeCount * 15) + (neutralCount * 0)
    ));
    
    // Güven skoru
    const totalPatterns = positiveCount + negativeCount + neutralCount;
    confidence = Math.min(0.95, 0.5 + (totalPatterns * 0.15));
  } else {
    // Basit NLU fallback
    const nlu = simpleNLU(text);
    mood = nlu.mood;
    trigger = nlu.trigger;
    confidence = nlu.confidence * 0.8;
  }
  
  // Mood seviyesine göre öneri
  let suggestion = '';
  if (mood >= 70) {
    suggestion = 'Harika hissediyorsun! Bu pozitif enerjiyi korumaya devam et 🌟';
  } else if (mood >= 50) {
    suggestion = 'Dengeli görünüyorsun. Günün nasıl geçiyor?';
  } else if (mood >= 30) {
    suggestion = 'Biraz zorlu bir gün gibi. Nefes egzersizi yapmak ister misin?';
  } else {
    suggestion = 'Seni anlıyorum. Birlikte bu duyguları keşfedelim mi?';
  }
  
  return {
    type: 'MOOD',
    confidence: confidence,
    mood: mood,
    trigger: trigger,
    suggestion: suggestion,
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

    console.log('📡 Gemini API Request URL:', `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.substring(0, 10)}...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

    console.log('📡 Gemini API Response Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return null;
    }

    const data = await response.json();
    console.log('📡 Gemini API Raw Response:', JSON.stringify(data).substring(0, 200) + '...');
    
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


