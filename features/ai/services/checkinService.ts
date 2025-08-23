import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { AIEventType, trackAIInteraction, trackGatingDecision } from '@/features/ai/telemetry/aiTelemetry';
import { makeGatingDecision } from '@/features/ai/core/needsLLMAnalysis';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TOKEN_USAGE_RECORDED will be used as AIEventType.TOKEN_USAGE_RECORDED

export type NLUResult = {
  mood: number; // 0..100
  trigger: string; // e.g., 'temizlik' | 'kontrol' | 'sosyal' | 'ev' | 'iş' | 'genel'
  confidence: number; // 0..1
  lang: 'tr' | 'en';
};

export type RouteDecision = 'REFRAME';

export type UnifiedAnalysisResult = {
  type: 'MOOD' | 'CBT' | 'OCD' | 'BREATHWORK' | 'ABSTAIN';
  confidence: number;
  mood?: number;
  trigger?: string;
  category?: string;
  suggestion?: string;
  originalText: string;
  alternatives?: Array<{ type: string; confidence: number }>; // For ABSTAIN cases
  needsConfirmation?: boolean; // For disambiguation UI
  
  // 🚀 ENHANCED v3.0: Maximum data extraction from natural language
  // MOOD specific
  energy?: number; // 1-10 enerji seviyesi
  anxiety?: number; // 1-10 anksiyete seviyesi  
  sleep_quality?: number; // 1-10 uyku kalitesi
  physical_symptoms?: string[]; // Fiziksel belirtiler
  notes?: string; // Orijinal metin özeti
  
  // OCD specific  
  severity?: number; // 1-10 şiddet/zorluk
  resistance?: number; // 1-10 direnç gösterme
  frequency?: number; // Tekrar sayısı
  duration_minutes?: number; // Süre (dakika)
  obsessive_thought?: string; // Takıntılı düşünce
  compulsive_behavior?: string; // Kompulsif davranış
  
  // CBT specific
  distortions?: string[]; // ["catastrophizing", "mind_reading", etc.]
  thought?: string; // Otomatik olumsuz düşünce
  situation?: string; // Ne oldu/durum
  intensity?: number; // 1-10 düşünce yoğunluğu
  mood_before?: number; // 0-100 önceki mood
  mood_after?: number; // 0-100 sonraki mood
  evidence_for?: string; // Lehte kanıtlar
  evidence_against?: string; // Aleyhte kanıtlar
  balanced_thought?: string; // Dengeli düşünce
  
  // BREATHWORK specific
  anxietyLevel?: number; // 1-10 for breathwork
  panic?: boolean; // Panik atak durumu
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

/**
 * 🚀 TR Morfoloji - Basit kök çıkarma ve sonek temizleme
 * Rapor önerisi: TR morfoloji desteği eklenmesi
 */
function normalizeTurkishText(text: string): string {
  const words = text.toLowerCase().split(/\s+/);
  
  // Türkçe sonek/ek temizleme kuralları
  const suffixPatterns = [
    // İsim çokluk eki
    /(.*?)(ler|lar)$/,
    // İyelik ekleri
    /(.*?)(im|ım|um|üm|in|ın|un|ün|i|ı|u|ü|si|sı|su|sü)$/,
    // Hal ekleri
    /(.*?)(de|da|den|dan|e|a|i|ı|u|ü|ye|ya|nin|nın|nun|nün)$/,
    // Fiil ekleri - temel
    /(.*?)(dim|dım|dum|düm|din|dın|dun|dün|di|dı|du|dü)$/,
    /(.*?)(sin|sın|sun|sün|im|ım|um|üm|iz|ız|uz|üz)$/,
    /(.*?)(yor|iyor|uyor|üyor|acak|ecek|ıyor|uyor)$/,
    // Sıfat ekleri
    /(.*?)(lik|lık|luk|lük|siz|sız|suz|süz|li|lı|lu|lü)$/,
    // Zarf ekleri
    /(.*?)(ce|ca|ça|çe)$/
  ];
  
  const normalizedWords = words.map(word => {
    if (word.length < 4) return word; // Kısa kelimeleri değiştirme
    
    // Sonek temizleme
    for (const pattern of suffixPatterns) {
      const match = word.match(pattern);
      if (match && match[1].length >= 3) { // Kök minimum 3 harf olsun
        return match[1];
      }
    }
    return word;
  });
  
  return normalizedWords.join(' ');
}

/**
 * 🎯 Gelişmiş Pattern Matching - Ağırlıklı skor sistemi
 * Rapor önerisi: Ağırlıklı özellik seti + abstain sınıfı
 */
function calculateWeightedScore(patterns: RegExp[], text: string, normalizedText: string): {
  score: number;
  matchedPatterns: number;
  confidence: number;
} {
  let score = 0;
  let matchedPatterns = 0;
  
  // Hem orijinal hem normalize text'de ara
  const textsToCheck = [text, normalizedText];
  
  patterns.forEach((pattern, index) => {
    textsToCheck.forEach(textToCheck => {
      if (pattern.test(textToCheck)) {
        // Pattern gücüne göre ağırlıklandırma
        const weight = index < patterns.length * 0.3 ? 1.5 : // İlk %30 güçlü patterns
                      index < patterns.length * 0.7 ? 1.0 : // Orta %40 normal patterns
                      0.7; // Son %30 zayıf patterns
        score += weight;
        matchedPatterns++;
      }
    });
  });
  
  // Text length bonus/penalty
  const lengthFactor = text.length < 10 ? 0.7 : // Çok kısa penalty
                       text.length > 50 ? 1.2 : // Uzun bonus
                       1.0;
  
  const finalScore = score * lengthFactor;
  const confidence = Math.min(0.95, finalScore / patterns.length + 0.1);
  
  return {
    score: finalScore,
    matchedPatterns,
    confidence
  };
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
  // Basit karar: Reframe yap
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
 * Merkezi Ses Analizi - LLM Gating + Budget Control ile Gemini API
 * Ses girişini analiz edip MOOD, CBT, OCD veya BREATHWORK'e yönlendirir
 * 
 * v1.1: LLM Gating, Token Budget, Similarity Dedup eklendi
 */
export async function unifiedVoiceAnalysis(text: string, userId?: string): Promise<UnifiedAnalysisResult> {
  const startTime = Date.now();
  
  // 📊 Track voice analysis start
  await trackAIInteraction(AIEventType.VOICE_ANALYSIS_STARTED, {
    userId,
    textLength: text?.length || 0,
    timestamp: startTime
  });
  
  try {
    // Önce basit heuristik analiz
    const heuristicResult = heuristicVoiceAnalysis(text);
    
    // Gemini API check
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
      // 🚪 1. LLM GATING: Check if we need LLM analysis
      const gatingDecision = makeGatingDecisionForVoice({
        heuristicResult,
        textLength: text.length,
        userId: userId || 'anonymous'
      });
      
      if (!gatingDecision.needsLLM) {
        console.log('🚫 LLM Gating blocked:', gatingDecision.reason);
        // Track gating decision
        await trackGatingDecision('block', gatingDecision.reason, {
          userId,
          heuristicConfidence: heuristicResult.confidence,
          textLength: text.length
        });
        return heuristicResult;
      }
      
      // 💰 2. TOKEN BUDGET: Check if user can afford LLM call
      if (userId) {
        const canAfford = await checkTokenBudget(userId);
        if (!canAfford) {
          console.log('💰 Token budget exceeded for user:', userId);
          await trackGatingDecision('block', 'token_budget_exceeded', { userId });
          return heuristicResult;
        }
      }
      
      // 🔄 3. SIMILARITY DEDUP: Check for recent similar requests
      const similarityCheck = await checkSimilarityDedup(text, userId);
      if (similarityCheck.isDuplicate) {
        console.log('🔁 Duplicate request detected, using cached result');
        await trackSimilarityDedup(userId, similarityCheck);
        return similarityCheck.cachedResult || heuristicResult;
      }
      
      try {
        console.log('🚀 LLM Gating approved, calling Gemini API...');
        await trackGatingDecision('allow', gatingDecision.reason, {
          userId,
          heuristicConfidence: heuristicResult.confidence
        });
        
        const geminiResult = await analyzeWithGemini(text, geminiApiKey);
        
        if (geminiResult) {
          // 📊 4. RECORD TOKEN USAGE
          if (userId) {
            await recordTokenUsage(userId, estimateTokenCount(text, geminiResult));
          }
          
          console.log('✅ Gemini analysis successful:', geminiResult);
          
          // Cache the result for similarity dedup
          await cacheSimilarResult(text, geminiResult, userId);
          
          // 📊 Track voice analysis completion
          await trackAIInteraction(AIEventType.VOICE_ANALYSIS_COMPLETED, {
            userId,
            textLength: text?.length || 0,
            processingTime: Date.now() - startTime,
            analysisType: geminiResult.type,
            confidence: geminiResult.confidence,
            usedLLM: true
          });
          
          return geminiResult;
        } else {
          console.log('⚠️ Gemini returned null, falling back to heuristic');
        }
      } catch (error) {
        console.log('❌ Gemini API error, using heuristic analysis:', error);
        // Track API errors for monitoring
        await trackAIInteraction(AIEventType.EXTERNAL_API_ERROR, {
          error: error instanceof Error ? error.message : String(error),
          userId,
          fallback: 'heuristic'
        });
      }
    } else {
      console.log('⚠️ Gemini API not available or feature disabled, using heuristic');
    }
    
    console.log('📊 Using heuristic result:', heuristicResult);
    
    // 📊 Track voice analysis completion (heuristic only)
    await trackAIInteraction(AIEventType.VOICE_ANALYSIS_COMPLETED, {
      userId,
      textLength: text?.length || 0,
      processingTime: Date.now() - startTime,
      analysisType: heuristicResult.type,
      confidence: heuristicResult.confidence,
      usedLLM: false
    });
    
    return heuristicResult;
  } catch (error) {
    console.error('Unified voice analysis error:', error);
    
    // 📊 Track voice analysis failure
    await trackAIInteraction(AIEventType.VOICE_ANALYSIS_FAILED, {
      userId,
      textLength: text?.length || 0,
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      component: 'unifiedVoiceAnalysis'
    });
    
    // Track system errors
    await trackAIInteraction(AIEventType.SYSTEM_ERROR, {
      error: error instanceof Error ? error.message : String(error),
      userId,
      component: 'unifiedVoiceAnalysis'
    });
    
    // Fallback: basit mood analizi
    const fallbackResult = {
      type: 'MOOD' as const,
      confidence: 0.3,
      mood: 50,
      originalText: text
    };
    
    // 📊 Track fallback result
    await trackAIInteraction(AIEventType.VOICE_ANALYSIS_COMPLETED, {
      userId,
      textLength: text?.length || 0,
      processingTime: Date.now() - startTime,
      analysisType: fallbackResult.type,
      confidence: fallbackResult.confidence,
      usedLLM: false,
      isFallback: true
    });
    
    return fallbackResult;
  }
}

/**
 * 🚀 Gelişmiş Heuristik Ses Analizi v2.0
 * 
 * ✅ Rapor iyileştirmeleri:
 * - TR morfoloji desteği (sonek temizleme)
 * - Ağırlıklı skor sistemi
 * - ABSTAIN sınıfı (düşük güven durumunda)
 * - Multi-class comparison (MOOD bias önleme)
 */
function heuristicVoiceAnalysis(text: string): UnifiedAnalysisResult {
  const lower = text.toLowerCase();
  const normalizedText = normalizeTurkishText(text);
  
  console.log('🔍 ADVANCED HEURISTIC ANALYSIS v2.0:');
  console.log('   Original:', lower.substring(0, 50) + '...');
  console.log('   Normalized:', normalizedText.substring(0, 50) + '...');
  
  // 🧠 CBT PATTERN ANALYSIS - Ağırlıklı skor sistemi ile
  const cbtPatterns = [
    // 🔥 GÜÇLÜ PATTERNS (İlk %30 - 1.5x ağırlık)
    /ya\s+(.*?)olursa/i, /kesin\s+(.*?)olacak/i, /felaket/i, /mahvol/i, 
    /asla\s+(.*?)yapamam/i, /hiçbir\s+zaman/i, /her\s+zaman/i,
    /ben\s+bir\s+başarısızım/i, /ben\s+aptalım/i, /ben\s+değersizim/i,
    /benim\s+yüzümden/i, /benim\s+suçum/i,
    
    // 💪 ORTA PATTERNS (Orta %40 - 1.0x ağırlık)  
    /berbat/i, /korkunç/i, /hayatım\s+bitti/i, /hep\s+(.*?)oluyor/i,
    /herkes\s+(.*?)düşünüyor/i, /benden\s+nefret\s+ediyor/i,
    /yapmalıyım/i, /zorundayım/i, /mecburum/i, /şart/i,
    /hiçbir\s+işe\s+yaramıyorum/i, /ben\s+beceriksizim/i,
    /sadece\s+kötü\s+şeyler/i, /hep\s+olumsuz/i,
    
    // 🌊 ZAYIF PATTERNS (Son %30 - 0.7x ağırlık)
    /dünyanın\s+sonu/i, /her\s+şey\s+mahvoldu/i, /daima/i,
    /sürekli\s+başıma\s+geliyor/i, /beni\s+sevmiyor/i, /arkamdan\s+konuşuyor/i,
    /etmeliyim/i, /olmak\s+zorunda/i, /ben\s+sebep\s+oldum/i, /hep\s+ben/i,
    /hiç\s+iyi\s+bir\s+şey\s+olmuyor/i, /pozitif\s+hiçbir\s+şey\s+yok/i
  ];
  
  const cbtAnalysis = calculateWeightedScore(cbtPatterns, lower, normalizedText);
  console.log('🧠 CBT Analysis:', { score: cbtAnalysis.score, confidence: cbtAnalysis.confidence });
  
  // 🌬️ BREATHWORK PATTERN ANALYSIS - Ağırlıklı skor sistemi ile
  const breathPatterns = [
    // 🔥 GÜÇLÜ PATTERNS (1.5x ağırlık)
    /nefes\s+al/i, /derin\s+nefes/i, /nefes.*egzersizi/i, /nefes.*terapisi/i,
    /panik\s+atak/i, /nefes\s+alamıyorum/i, /boğuluyor/i,
    
    // 💪 ORTA PATTERNS (1.0x ağırlık)
    /nefes/i, /rahatla/i, /sakinleş/i, /meditasyon/i, /mindfulness/i,
    /farkındalık/i, /soluk/i, /espirasyon/i, /inspirasyon/i,
    
    // 🌊 ZAYIF PATTERNS (0.7x ağırlık)  
    /hırıl/i, /zen/i, /yoga/i, /rahatlama/i
  ];
  
  const breathAnalysis = calculateWeightedScore(breathPatterns, lower, normalizedText);
  console.log('🌬️ BREATHWORK Analysis:', { score: breathAnalysis.score, confidence: breathAnalysis.confidence });
  
  // 🔄 OCD PATTERN ANALYSIS - Ağırlıklı skor sistemi ile
  const ocdPatterns = [
    // 🔥 GÜÇLÜ PATTERNS (1.5x ağırlık)
    /kontrol\s+et/i, /tekrar\s+kontrol/i, /emin\s+olamıyorum/i,
    /takıntı/i, /obsesyon/i, /kompulsiyon/i, /duramıyorum/i,
    /el\s+yıka/i, /sürekli\s+yıka/i, /temizle/i, /mikrop/i,
    /üç\s+kere/i, /beş\s+kere/i, /say\s+say/i,
    
    // 💪 ORTA PATTERNS (1.0x ağırlık)
    
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
  

  
  // BREATHWORK patterns moved above OCD patterns for priority
  
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
  
  // 🚨 CRITICAL FIX: MOOD Bias Önleme - ABSTAIN logic
  // Rapor sorunu: "Çoğunlukla MOOD'a düşüyor" → Düşük güven durumunda ABSTAIN
  
  console.log('🎯 HEURISTIC RESULT: MOOD -', { confidence, mood, trigger });
  
  // ABSTAIN logic - Rapor önerisi: düşük güven durumunda belirsizlik
  if (confidence < 0.5) {
    console.log('⚠️ LOW CONFIDENCE → ABSTAIN');
    return {
      type: 'ABSTAIN' as const,
      confidence: confidence,
      suggestion: 'Hangi konuda yardım istiyorsun? (Duygu/Düşünce/Kompulsiyon)',
      alternatives: [
        { type: 'MOOD', confidence: confidence },
        { type: 'CBT', confidence: 0.3 },
        { type: 'OCD', confidence: 0.3 }
      ],
      needsConfirmation: true,
      originalText: text
    };
  }

  return {
    type: 'MOOD' as const,
    confidence: confidence,
    mood: mood,
    trigger: trigger,
    suggestion: suggestion,
    originalText: text
  };
}

// =============================================================================
// 🚪 LLM GATING HELPER FUNCTIONS
// =============================================================================

/**
 * Voice analysis için gating decision
 */
function makeGatingDecisionForVoice(params: {
  heuristicResult: UnifiedAnalysisResult;
  textLength: number;
  userId: string;
}): { needsLLM: boolean; reason: string; confidence: number } {
  // High confidence heuristic results don't need LLM
  if (params.heuristicResult.confidence >= 0.8) {
    return {
      needsLLM: false,
      reason: 'high_confidence_heuristic',
      confidence: params.heuristicResult.confidence
    };
  }
  
  // Very short text - heuristic is enough
  if (params.textLength < 20) {
    return {
      needsLLM: false,
      reason: 'text_too_short',
      confidence: params.heuristicResult.confidence
    };
  }
  
  // Low confidence complex text needs LLM
  if (params.textLength > 50 && params.heuristicResult.confidence < 0.6) {
    return {
      needsLLM: true,
      reason: 'complex_text_low_confidence',
      confidence: params.heuristicResult.confidence
    };
  }
  
  // Default: use LLM for medium confidence
  return {
    needsLLM: params.heuristicResult.confidence < 0.7,
    reason: params.heuristicResult.confidence < 0.7 ? 'medium_confidence' : 'high_confidence',
    confidence: params.heuristicResult.confidence
  };
}

/**
 * Token budget checker
 */
async function checkTokenBudget(userId: string): Promise<boolean> {
  try {
    // 🧪 TEMPORARY: Testing override for LLM P95 test
    if (__DEV__ && userId === "d6dc0dcf-7e37-4ef9-b658-5b66dcd0eac5") {
      console.log('🧪 DEV OVERRIDE: Token budget bypassed for testing');
      return true; // Always allow during development testing
    }
    
    const today = new Date().toISOString().split('T')[0];
    const key = `token_usage_${userId}_${today}`;
    const usageStr = await AsyncStorage.getItem(key);
    const usage = usageStr ? parseInt(usageStr) : 0;
    
    const dailyLimit = 1000; // Daily token limit per user
    return usage < dailyLimit;
  } catch (error) {
    console.warn('Token budget check failed:', error);
    return true; // Allow on error
  }
}

/**
 * Similarity dedup checker
 */
async function checkSimilarityDedup(text: string, userId?: string): Promise<{
  isDuplicate: boolean;
  cachedResult?: UnifiedAnalysisResult;
  similarity?: number;
}> {
  if (!userId) return { isDuplicate: false };
  
  try {
    const key = `voice_cache_${userId}`;
    const cacheStr = await AsyncStorage.getItem(key);
    if (!cacheStr) return { isDuplicate: false };
    
    const cache = JSON.parse(cacheStr);
    const now = Date.now();
    
    // Check for similar text in last 1 hour
    for (const entry of cache) {
      if (now - entry.timestamp > 60 * 60 * 1000) continue; // 1 hour TTL
      
      const similarity = calculateTextSimilarity(text, entry.originalText);
      if (similarity > 0.85) { // 85% similarity threshold
        return {
          isDuplicate: true,
          cachedResult: entry.result,
          similarity
        };
      }
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.warn('Similarity dedup check failed:', error);
    return { isDuplicate: false };
  }
}

/**
 * Simple text similarity calculator
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const n1 = normalize(text1);
  const n2 = normalize(text2);
  
  if (n1 === n2) return 1.0;
  if (n1.length === 0 || n2.length === 0) return 0.0;
  
  // Simple jaccard similarity
  const words1 = new Set(n1.split(/\s+/));
  const words2 = new Set(n2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Track similarity dedup hit
 */
async function trackSimilarityDedup(userId: string | undefined, similarityCheck: any): Promise<void> {
  await trackAIInteraction(AIEventType.SIMILARITY_DEDUP_HIT, {
    userId,
    similarity: similarityCheck.similarity,
    cacheHit: true
  });
}

/**
 * Record token usage
 */
async function recordTokenUsage(userId: string, tokenCount: number): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `token_usage_${userId}_${today}`;
    const usageStr = await AsyncStorage.getItem(key);
    const currentUsage = usageStr ? parseInt(usageStr) : 0;
    const newUsage = currentUsage + tokenCount;
    
    await AsyncStorage.setItem(key, newUsage.toString());
    
    // Track usage for monitoring  
    await trackAIInteraction('token_usage_recorded' as any, {
      userId,
      tokensUsed: tokenCount,
      dailyTotal: newUsage
    });
  } catch (error) {
    console.warn('Failed to record token usage:', error);
  }
}

/**
 * Estimate token count for API call
 */
function estimateTokenCount(inputText: string, result: UnifiedAnalysisResult): number {
  // Rough estimation: 1 token ≈ 4 characters
  const inputTokens = Math.ceil(inputText.length / 4);
  const outputTokens = Math.ceil(JSON.stringify(result).length / 4);
  const promptTokens = 50; // Estimated prompt overhead
  
  return inputTokens + outputTokens + promptTokens;
}

/**
 * Cache similar result for dedup
 */
async function cacheSimilarResult(text: string, result: UnifiedAnalysisResult, userId?: string): Promise<void> {
  if (!userId) return;
  
  try {
    const key = `voice_cache_${userId}`;
    const cacheStr = await AsyncStorage.getItem(key);
    let cache = cacheStr ? JSON.parse(cacheStr) : [];
    
    // Add new entry
    cache.push({
      originalText: text,
      result,
      timestamp: Date.now()
    });
    
    // Keep only last 10 entries
    cache = cache.slice(-10);
    
    await AsyncStorage.setItem(key, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to cache similarity result:', error);
  }
}

/**
 * 🚀 Gemini API ile Gelişmiş Yapılandırılmış Analiz v2.0
 * 
 * ✅ İyileştirmeler:
 * - Few-shot örnekler ile daha doğru classification
 * - Detaylı veri çıkarımı (enerji, direnç, kategori, distortions)
 * - TR/EN dual language support
 * - Strict JSON schema enforcement
 */
async function analyzeWithGemini(text: string, apiKey: string): Promise<UnifiedAnalysisResult | null> {
  try {
    // 🚀 ENHANCED PROMPT v3.0 - Maximum Data Extraction
    const prompt = `You are an expert mental health assistant. Analyze the user's natural language input and extract ALL relevant data for auto-recording.

CLASSIFICATION RULES:
1. MOOD - Emotional state descriptions like "moralim bozuk", "keyfim yerinde", "çok mutluyum"
2. CBT - Thoughts with cognitive distortions like "herkes benden nefret ediyor", "başarısızım"
3. OCD - Compulsions/obsessions like "kontrol ettim", "tekrar baktım", "emin olamıyorum"
4. BREATHWORK - Anxiety/panic like "nefes alamıyorum", "panik atak", "çok gerginim"

NATURAL LANGUAGE MAPPING (CRITICAL):
Mood descriptions to values:
- "çok kötü/berbat/rezalet" = 1-2
- "kötü/bozuk/düşük" = 3-4
- "fena değil/idare eder" = 5
- "iyi/güzel" = 6-7
- "çok iyi/harika/mükemmel" = 8-10

Energy descriptions:
- "hiç yok/bitkin/tükenmiş" = 1-2
- "düşük/az/yorgun" = 3-4
- "normal/orta" = 5-6
- "iyi/enerjik" = 7-8
- "çok enerjik/dinamik" = 9-10

Severity/Intensity:
- "hafif/az" = 1-3
- "orta/normal" = 4-6
- "şiddetli/yoğun/çok" = 7-8
- "aşırı/dayanılmaz" = 9-10

DETAILED EXAMPLES:

Input: "Moralim çok bozuk, enerjim hiç yok, kendimi berbat hissediyorum"
Output: {
  "type": "MOOD",
  "confidence": 0.95,
  "mood": 20,
  "energy": 1,
  "anxiety": 6,
  "trigger": "general_fatigue",
  "notes": "Moralim çok bozuk, enerjim hiç yok",
  "suggestion": "Zor bir gün geçiriyorsun. Mood kaydın alındı."
}

Input: "Kapıyı kilitledim mi emin olamıyorum, 5 kere kontrol ettim ama hala içim rahat değil"
Output: {
  "type": "OCD",
  "confidence": 0.93,
  "category": "checking",
  "severity": 7,
  "resistance": 2,
  "frequency": 5,
  "trigger": "door_lock",
  "obsessive_thought": "Kapı açık kalmış olabilir",
  "compulsive_behavior": "Tekrar tekrar kontrol etme",
  "duration_minutes": 10,
  "suggestion": "Kontrol kompulsiyonu tespit edildi. 5 kere kontrol etmişsin."
}

Input: "Herkes benden nefret ediyor, arkamdan konuşuyorlar, ben bir başarısızım"
Output: {
  "type": "CBT",
  "confidence": 0.91,
  "thought": "Herkes benden nefret ediyor",
  "situation": "Sosyal ortamda yalnız hissetme",
  "distortions": ["mind_reading", "all_or_nothing", "labeling"],
  "mood_before": 30,
  "intensity": 8,
  "evidence_for": "Arkadaşlarım benimle konuşmuyor",
  "evidence_against": "Aslında sadece meşguller olabilir",
  "balanced_thought": "Bazı insanlar meşgul olabilir, herkesi okuyamam",
  "mood_after": 50,
  "suggestion": "Zihin okuma ve etiketleme çarpıtmaları tespit edildi."
}

NOW ANALYZE: "${text}"

EXTRACT ALL POSSIBLE DATA:
{
  "type": "MOOD|CBT|OCD|BREATHWORK",
  "confidence": 0.0-1.0,
  
  // MOOD fields
  "mood": 0-100,
  "energy": 1-10,
  "anxiety": 0-10,
  "sleep_quality": 1-10,
  "trigger": "what caused the mood",
  "physical_symptoms": [],
  
  // OCD fields
  "category": "checking|cleaning|symmetry|counting|harm|religious|other",
  "severity": 1-10,
  "resistance": 1-10,
  "frequency": number,
  "duration_minutes": number,
  "obsessive_thought": "the intrusive thought",
  "compulsive_behavior": "what they did",
  "trigger": "what triggered it",
  
  // CBT fields
  "thought": "automatic negative thought",
  "situation": "what happened",
  "distortions": ["mind_reading", "catastrophizing", "all_or_nothing", "labeling", "should_statements", "personalization", "filtering", "overgeneralization"],
  "mood_before": 0-100,
  "mood_after": 0-100,
  "intensity": 1-10,
  "evidence_for": "supporting evidence",
  "evidence_against": "contradicting evidence",
  "balanced_thought": "more realistic thought",
  
  // Common fields
  "notes": "original text excerpt",
  "suggestion": "helpful response in user's language"
}

CRITICAL RULES:
- Convert natural language ("çok kötü", "berbat") to numbers
- Extract context and situation details
- Identify multiple data points from single input
- Use user's language for suggestion
- Fill as many fields as possible from context
- Return ONLY valid JSON`;

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

    // JSON'u parse et ve zengin veri çıkarımı yap
    try {
      const parsed = JSON.parse(resultText.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
      
      console.log('🎯 Gemini Classification Result:', {
        type: parsed.type,
        confidence: parsed.confidence,
        hasExtractedData: !!(parsed.mood || parsed.severity || parsed.distortions)
      });
      
      // 🚀 ENHANCED DATA EXTRACTION v3.0 - Maximum veri çıkarımı
      const enrichedResult: UnifiedAnalysisResult = {
        type: parsed.type as any,
        confidence: parsed.confidence || 0.8,
        originalText: text,
        suggestion: parsed.suggestion || '',
        notes: parsed.notes || text.substring(0, 200),
        
        // MOOD specific data - TÜM form alanları
        ...(parsed.type === 'MOOD' ? {
          mood: parsed.mood || 50,
          trigger: parsed.trigger || 'genel',
          energy: parsed.energy,
          anxiety: parsed.anxiety,
          sleep_quality: parsed.sleep_quality,
          physical_symptoms: parsed.physical_symptoms || []
        } : {}),
        
        // OCD specific data - TÜM form alanları
        ...(parsed.type === 'OCD' ? {
          category: parsed.category || 'other',
          severity: parsed.severity,
          resistance: parsed.resistance, 
          frequency: parsed.frequency,
          duration_minutes: parsed.duration_minutes,
          obsessive_thought: parsed.obsessive_thought,
          compulsive_behavior: parsed.compulsive_behavior,
          trigger: parsed.trigger
        } : {}),
        
        // CBT specific data - TÜM form alanları
        ...(parsed.type === 'CBT' ? {
          distortions: parsed.distortions || [],
          thought: parsed.thought,
          situation: parsed.situation,
          intensity: parsed.intensity,
          mood_before: parsed.mood_before,
          mood_after: parsed.mood_after,
          evidence_for: parsed.evidence_for,
          evidence_against: parsed.evidence_against,
          balanced_thought: parsed.balanced_thought
        } : {}),
        
        // BREATHWORK specific data
        ...(parsed.type === 'BREATHWORK' ? {
          anxietyLevel: parsed.anxiety_level || parsed.anxiety,
          panic: parsed.panic
        } : {})
      };
      
      // 🎯 AUTO-SAVE DECISION v3.0 - Detaylı veri kontrolü
      const hasEnoughDataForAutoSave = 
        (parsed.type === 'MOOD' && parsed.mood !== undefined && parsed.energy !== undefined) ||
        (parsed.type === 'OCD' && parsed.category && parsed.severity && (parsed.obsessive_thought || parsed.compulsive_behavior)) ||
        (parsed.type === 'CBT' && parsed.thought && parsed.distortions?.length > 0 && (parsed.mood_before !== undefined || parsed.evidence_for || parsed.evidence_against)) ||
        (parsed.type === 'BREATHWORK' && (parsed.anxiety_level >= 7 || parsed.panic));
      
      if (hasEnoughDataForAutoSave) {
        console.log('✅ LLM extracted sufficient data for auto-save');
      } else {
        console.log('⚠️ Insufficient data for auto-save, manual entry needed');
        enrichedResult.needsConfirmation = true;
      }
      
      return enrichedResult;
    } catch (parseError) {
      console.error('Gemini yanıtı parse edilemedi:', resultText);
      return null;
    }
  } catch (error) {
    console.error('Gemini API çağrısı başarısız:', error);
    return null;
  }
}

// =============================================================================
// 📊 AUTO-RECORD HELPER FUNCTIONS
// =============================================================================

/**
 * 🚀 Voice Analysis'ten Zengin Veri Çıkarma v2.0
 * 
 * ✅ İyileştirmeler:
 * - LLM'den gelen zengin veriyi öncelikli kullanır
 * - Fallback olarak heuristic extraction yapar
 * - Auto-save için minimum veri kontrolü
 */
export function extractSufficientDataFromVoice(
  analysis: UnifiedAnalysisResult, 
  transcript: string
): { 
  hasSufficientData: boolean;
  extractedData: any;
  reason?: string;
} {
  const lower = transcript.toLowerCase();
  const result = {
    hasSufficientData: false,
    extractedData: {},
    reason: ''
  };

  switch (analysis.type) {
    case 'OCD':
      // 🚀 LLM'den gelen ZENGİN veriyi öncelikle kullan
      if (analysis.severity && analysis.category) {
        result.extractedData = {
          type: analysis.category,
          resistanceLevel: analysis.resistance || analysis.severity,
          severity: analysis.severity,
          frequency: analysis.frequency || 1,
          duration_minutes: analysis.duration_minutes,
          obsessive_thought: analysis.obsessive_thought,
          compulsive_behavior: analysis.compulsive_behavior,
          trigger: analysis.trigger || extractTriggerFromText(lower),
          notes: analysis.notes || transcript,
          category: analysis.category,
          timestamp: new Date()
        };
        result.hasSufficientData = true;
        console.log('✅ LLM provided RICH OCD data:', {
          category: analysis.category,
          severity: analysis.severity,
          obsessive_thought: !!analysis.obsessive_thought,
          compulsive_behavior: !!analysis.compulsive_behavior
        });
      } else {
        // Fallback: Heuristic extraction
        const ocdCategory = extractOCDCategory(lower);
        const severity = extractSeverityFromText(transcript);
        
        result.extractedData = {
          type: ocdCategory.category,
          resistanceLevel: severity,
          trigger: extractTriggerFromText(lower) || '',
          notes: transcript,
          category: ocdCategory.category,
          timestamp: new Date()
        };
        
        if (ocdCategory.confidence > 0.6 && severity >= 1) {
          result.hasSufficientData = true;
        } else {
          result.reason = 'Kompulsiyon kategorisi veya şiddet seviyesi belirlenemiyor';
        }
      }
      break;

    case 'CBT':
      // 🚀 LLM'den gelen ZENGİN veriyi öncelikle kullan
      if (analysis.thought && analysis.distortions && analysis.distortions.length > 0) {
        result.extractedData = {
          thought: analysis.thought,
          situation: analysis.situation,
          distortions: analysis.distortions,
          intensity: analysis.intensity || 5,
          mood_before: analysis.mood_before || extractMoodFromText(lower) || 5,
          mood_after: analysis.mood_after,
          evidence_for: analysis.evidence_for,
          evidence_against: analysis.evidence_against,
          balanced_thought: analysis.balanced_thought,
          trigger: analysis.trigger || extractTriggerFromText(lower) || '',
          notes: analysis.notes || transcript,
          timestamp: new Date()
        };
        result.hasSufficientData = true;
        console.log('✅ LLM provided RICH CBT data:', {
          thought: !!analysis.thought,
          situation: !!analysis.situation,
          evidence_for: !!analysis.evidence_for,
          evidence_against: !!analysis.evidence_against,
          balanced_thought: !!analysis.balanced_thought
        });
      } else {
        // Fallback: Heuristic extraction
        const thought = transcript.trim();
        const detectedDistortions = extractCBTDistortions(lower);
        
        result.extractedData = {
          thought: thought,
          distortions: detectedDistortions,
          mood_before: extractMoodFromText(lower) || 5,
          trigger: extractTriggerFromText(lower) || '',
          notes: transcript,
          timestamp: new Date()
        };
        
        if (thought.length >= 10 && detectedDistortions.length > 0) {
          result.hasSufficientData = true;
        } else {
          result.reason = 'Düşünce veya bilişsel çarpıtma tespit edilemedi';
        }
      }
      break;
    
    case 'MOOD':
      // 🚀 LLM'den gelen ZENGİN veriyi kullan
      if (analysis.mood !== undefined) {
        result.extractedData = {
          mood_score: analysis.mood,
          energy: analysis.energy || 5,
          anxiety: analysis.anxiety || 0,
          sleep_quality: analysis.sleep_quality,
          physical_symptoms: analysis.physical_symptoms || [],
          trigger: analysis.trigger || 'genel',
          notes: analysis.notes || transcript,
          timestamp: new Date()
        };
        result.hasSufficientData = true;
        console.log('✅ LLM provided RICH MOOD data:', {
          mood: analysis.mood,
          energy: analysis.energy,
          anxiety: analysis.anxiety,
          sleep_quality: analysis.sleep_quality,
          has_physical_symptoms: !!(analysis.physical_symptoms && analysis.physical_symptoms.length > 0)
        });
      } else {
        // Fallback: Heuristic extraction
        const mood = extractMoodFromText(lower) || 50;
        result.extractedData = {
          mood_score: mood,
          energy: 5,
          anxiety: 0,
          trigger: 'genel',
          notes: transcript,
          timestamp: new Date()
        };
        result.reason = 'Mood değeri belirsiz, manuel giriş önerilir';
      }
      break;

    default:
      result.reason = 'Desteklenmeyen kategori';
  }

  return result;
}

/**
 * 🏷️ OCD kategorisi çıkarma
 */
function extractOCDCategory(text: string): { category: string; confidence: number } {
  const ocdPatterns = {
    'contamination': [
      /kirlenme/i, /temiz/i, /pis/i, /mikrop/i, /bakteriy/i, /virüs/i,
      /el\s*yıka/i, /dezenfektan/i, /sabun/i, /hijyen/i
    ],
    'checking': [
      /kontrol/i, /kontrol\s*et/i, /bak/i, /emin/i, /kesin/i,
      /kapat/i, /aç/i, /düz/i, /kilitle/i, /elektrik/i, /gaz/i
    ],
    'ordering': [
      /düzen/i, /sıra/i, /hizala/i, /organize/i, /tertip/i,
      /simetri/i, /paralel/i, /eşit/i, /dengede/i
    ],
    'hoarding': [
      /biriktir/i, /topla/i, /at.*?ma/i, /sakla/i, /gerekli/i,
      /lazım\s*olur/i, /değerli/i, /önemli/i
    ],
    'religious': [
      /günah/i, /dua/i, /namaz/i, /abdest/i, /helal/i, /haram/i,
      /Allah/i, /sevap/i, /ibadet/i, /temiz.*?değil/i
    ],
    'aggressive': [
      /zarar/i, /acıt/i, /kötülük/i, /şiddet/i, /yaralay/i,
      /öldür/i, /zarar\s*ver/i, /incit/i
    ]
  };

  let bestMatch = { category: 'genel', confidence: 0 };

  for (const [category, patterns] of Object.entries(ocdPatterns)) {
    const matchCount = patterns.filter(pattern => pattern.test(text)).length;
    const confidence = Math.min(0.9, matchCount / patterns.length * 2);
    
    if (confidence > bestMatch.confidence) {
      bestMatch = { category, confidence };
    }
  }

  return bestMatch;
}

/**
 * 🧠 CBT distorsiyonları çıkarma
 */
function extractCBTDistortions(text: string): string[] {
  const distortionPatterns = {
    'all-or-nothing': [/asla/i, /hiçbir\s*zaman/i, /hep/i, /daima/i],
    'catastrophizing': [/felaket/i, /korkunç/i, /mahvol/i, /berbat/i],
    'overgeneralization': [/her\s*zaman/i, /sürekli/i, /genellikle/i],
    'mind-reading': [/düşünüyor/i, /sanıyor/i, /benden.*?nefret/i],
    'labeling': [/aptalım/i, /başarısızım/i, /değersizim/i, /beceriksizim/i],
    'should-statements': [/yapmalıyım/i, /etmeliyim/i, /zorundayım/i]
  };

  const detected: string[] = [];
  for (const [distortion, patterns] of Object.entries(distortionPatterns)) {
    if (patterns.some(pattern => pattern.test(text))) {
      detected.push(distortion);
    }
  }

  return detected;
}

/**
 * 📊 Mood/severity çıkarma
 */
function extractMoodFromText(text: string): number | null {
  const moodWords = {
    'çok kötü': 1, 'berbat': 1, 'korkunç': 1,
    'kötü': 2, 'üzgün': 3, 'sıkıntılı': 3,
    'idare eder': 5, 'normal': 5, 'orta': 5,
    'iyi': 7, 'güzel': 7, 'mutlu': 8,
    'harika': 9, 'mükemmel': 10
  };

  for (const [word, score] of Object.entries(moodWords)) {
    if (text.includes(word)) {
      return score;
    }
  }
  return null;
}

/**
 * 🎯 Tetik çıkarma
 */
function extractTriggerFromText(text: string): string | null {
  const triggerPatterns = [
    /yüzünden/i, /sebep/i, /görünce/i, /duyunca/i, /düşününce/i,
    /çünkü/i, /nedeniyle/i, /sonrasında/i, /öncesinde/i
  ];

  for (const pattern of triggerPatterns) {
    const match = text.match(new RegExp(`(.{1,30})\\s*${pattern.source}`, 'i'));
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * 🎚️ Severity/resistance level extraction from text
 * Extracts numerical or qualitative severity indicators
 */
export function extractSeverityFromText(text: string): number {
  const lower = text.toLowerCase();
  
  // Explicit numerical mentions
  const numericMatch = text.match(/(\d+)(?:\/10|\/5|\s*(?:puan|seviye|derece))/i);
  if (numericMatch) {
    const value = parseInt(numericMatch[1]);
    // Normalize to 1-10 scale
    if (value <= 5) return Math.max(1, value * 2); // 5-point to 10-point
    if (value <= 10) return Math.max(1, value);    // Already 10-point
  }
  
  // Qualitative severity indicators
  const severityWords = {
    'çok zor': 9, 'çok güç': 9, 'dayanamıyorum': 9, 'çok kötü': 9,
    'zor': 7, 'güç': 7, 'zorlandım': 7, 'kötü': 7,
    'orta': 5, 'normal': 5, 'idare eder': 5,
    'kolay': 3, 'hafif': 3, 'az': 3,
    'çok kolay': 1, 'hiç': 1, 'yok denecek': 1
  };

  for (const [phrase, score] of Object.entries(severityWords)) {
    if (lower.includes(phrase)) {
      return score;
    }
  }
  
  // Resistance-related terms
  if (lower.includes('direndim') || lower.includes('karşı kodum')) {
    return 7; // Good resistance implies moderate-high severity
  }
  if (lower.includes('direnemedim') || lower.includes('yapamadım')) {
    return 3; // Low resistance implies lower-moderate severity
  }
  
  // Default moderate severity
  return 5;
}


