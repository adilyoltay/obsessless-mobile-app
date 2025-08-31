/**
 * Voice Check-in Heuristic Analysis Service
 * 
 * Özel olarak geliştirilen rule-based mood analiz sistemi.
 * Speech-to-text'ten gelen Türkçe metin üzerinde emotion, mood score, 
 * anxiety level, triggers gibi bilgileri otomatik çıkarır.
 * 
 * Bu algoritma sadece voice check-in işine özel geliştirilmiştir.
 */

import { TranscriptionResult } from './speechToTextService';

// 🔧 Lightweight logging control
const DEBUG = __DEV__ && process.env.VOICE_CHECKIN_DEBUG === '1';

// 🔧 Constants - Magic numbers replaced with named constants
const Constants = {
  // EMA Smoothing
  SMOOTHING_FACTOR: 0.25,
  
  // Recency weighting  
  RECENCY_DECAY: 8,
  
  // Signal strength gating
  WEAK_SIGNAL_THRESHOLD: 0.25,
  GATE_MS: 350,
  
  // Coordinate mapping (5.5 center for perfect VA mapping)
  CENTER: 5.5,
  SPAN: 4.5,
  
  // Score bounds
  MIN_SCORE: 1,
  MAX_SCORE: 10,
  
  // Default baselines
  MOOD_BASELINE: 5.0,
  ENERGY_BASELINE: 5.0,
  ANXIETY_BASELINE: 4.0,
  
  // Incremental analysis
  BASE_CONFIDENCE: 0.8,
  SIGNAL_DECAY_RATE: 6,
  
  // Gating and explicit override rules
  EXPLICIT_GATE_BYPASS: true,     // Explicit declarations bypass neural gate
  RECENCY_WINDOW_SIZE: 15,         // Words in recency window for explicit detection
  MIN_CHUNK_WORDS: 2,              // Minimum words for analysis
  MIN_CHUNK_CHARS: 8,              // Minimum characters for analysis
} as const;

// 🔧 CONFIG - All configurations grouped in-file for easy management  
const CONFIG = {
  // Note: Will be populated after class definition to maintain existing content
  patterns: [] as any[],
  intensityModifiers: {} as any,
  crisis: [] as any[],
  synonymGroups: {} as any,
  negationWords: [] as any[],
  uncertaintyWords: [] as any[],
};

interface MoodAnalysisResult {
  moodScore: number;        // 1-10 arası mood skoru
  energyLevel: number;      // 1-10 arası enerji seviyesi  
  anxietyLevel: number;     // 1-10 arası anksiyete seviyesi
  dominantEmotion: string;  // Ana duygu (mutlu, üzgün, kaygılı, etc)
  triggers: string[];       // Tetikleyici faktörler
  activities: string[];     // Belirtilen aktiviteler
  notes: string;           // Orijinal metin (temizlenmiş)
  confidence: number;      // Analiz güven skoru (0-1)
  analysisDetails: {
    keywords: string[];     // Bulunan anahtar kelimeler
    emotionSignals: string[]; // Duygu işaretleri
    intensity: 'low' | 'medium' | 'high'; // Yoğunluk seviyesi
    sentiment: 'negative' | 'neutral' | 'positive'; // Genel sentiment
  };
}

interface KeywordPattern {
  keywords: string[];
  moodImpact: number;     // -5 to +5
  energyImpact: number;   // -5 to +5  
  anxietyImpact: number;  // -5 to +5
  emotion?: string;
  trigger?: string;
  activity?: string;
  weight: number;         // Pattern ağırlığı
}

interface PatternMatch extends KeywordPattern {
  matchedKeywords: string[];
  intensity: number;
  negationDetected: boolean;
}

type CompiledPattern = KeywordPattern & {
  rx: RegExp[];      // keywords için ek toleranslı regexler
  rxSyn: RegExp[];   // sinonimler için regexler
};

// 🔧 Type Safety - Impact field type for better type checking
type ImpactField = 'moodImpact' | 'energyImpact' | 'anxietyImpact';

// 🎯 RealtimeCtx - Mini class for realtime state management
class RealtimeCtx {
  text: string = '';
  tokens: string[] = [];
  mood: number = 5;
  energy: number = 5;
  anxiety: number = 5;
  
  // Private fields for echo tracking and gating
  private _lastPartialNorm?: string;
  private _lastCoord?: { x: number; y: number };
  private _gateUntilMs?: number;

  constructor(
    private preprocessText: (text: string) => string,
    private tokenize: (text: string) => string[],
    private lcpLen: (a: string, b: string) => number,
    private dropRepeatedNgrams: (text: string, base: string) => string
  ) {}

  /**
   * 📊 Append new chunk with echo protection (computeIncrement logic)
   */
  appendChunk(rawChunk: string): string {
    const norm = this.preprocessText(rawChunk);
    const prev = this._lastPartialNorm ?? '';
    let delta = norm;

    if (prev) {
      const l = this.lcpLen(prev, norm);
      delta = norm.slice(l);

      // Rewind/echo protection
      if (l < 5) {
        const head = norm.slice(0, Math.min(24, norm.length));
        if (head && this.text.includes(head)) {
          delta = '';
        }
      }
    }
    
    delta = this.dropRepeatedNgrams(delta, this.text);
    this._lastPartialNorm = norm;
    
    if (delta) {
      this.text = [this.text, delta].filter(Boolean).join(' ').trim();
      this.tokens = this.tokenize(this.text);
    }
    
    return delta.trim();
  }

  /**
   * 🎯 Convert mood/energy to coordinates (5.5 center)
   */
  toCoord(mood: number, energy: number) {
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const x = clamp((mood - Constants.CENTER) / Constants.SPAN, -1, 1);
    const y = clamp((energy - Constants.CENTER) / Constants.SPAN, -1, 1);
    return { x, y };
  }

  /**
   * 🧰 Gate management
   */
  setGate(durationMs: number) {
    this._gateUntilMs = Date.now() + durationMs;
  }

  clearGate() {
    this._gateUntilMs = undefined;
  }

  isGateActive(): boolean {
    return !!(this._gateUntilMs && Date.now() < this._gateUntilMs);
  }

  getLastCoord() {
    return this._lastCoord ?? { x: 0, y: 0 };
  }

  setLastCoord(coord: { x: number; y: number }) {
    this._lastCoord = coord;
  }
}

export type RealtimeState = {
  text: string;
  tokens: string[];
  mood: number;
  energy: number;
  anxiety: number;

  // 👇 incremental echo/gating için ek alanlar
  _lastPartialNorm?: string;      // son partial snapshot (normalize)
  _lastCoord?: { x: number; y: number }; // son gönderilen koordinat
  _gateUntilMs?: number;          // neutral gate bitiş zamanı
};

class VoiceCheckInHeuristicService {
  private static instance: VoiceCheckInHeuristicService;
  private compiled!: CompiledPattern[];
  private cfg = CONFIG; // Centralized config access
  
  // 🔧 Türkçe ek toleranslı kelime/ibare eşleme yardımcıları
  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildLemmaRegex(keyword: string): RegExp {
    // Çok kelimeli ifadelerde yalnızca SON kelimeye ek izin ver
    const toks = keyword.trim().split(/\s+/);
    const last = toks.pop()!;
    const head = toks.map(this.escapeRegex).join('\\s+');
    const lastWithSuffix = `${this.escapeRegex(last)}(?:[a-zçğıöşüâîû]+)?`;
    const body = head ? `${head}\\s+${lastWithSuffix}` : lastWithSuffix;
    // \b sınırı + Unicode
    return new RegExp(`\\b${body}\\b`, 'iu');
  }

  private includesWord(text: string, keyword: string): boolean {
    return this.buildLemmaRegex(keyword).test(text);
  }
  
  // 🎯 ENHANCED Türkçe Mood Analiz Patterns (v2.0)
  private readonly moodPatterns: KeywordPattern[] = [
    // 😊 High Positive Patterns
    {
      keywords: ['çok mutlu', 'aşırı mutlu', 'son derece mutlu', 'harika', 'mükemmel', 'fantastik', 'muhteşem'],
      moodImpact: +5, energyImpact: +4, anxietyImpact: -3,
      emotion: 'çok_mutlu', weight: 1.3
    },
    {
      keywords: ['mutlu', 'neşeli', 'sevinçli', 'keyifli', 'keyifliyim', 'keyfim yerinde', 'keyfim iyi', 'keyfim var', 'güzel', 'süper', 'iyi hissediyorum', 'çok iyi', 'gayet iyi', 'oldukça iyi'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -2,
      emotion: 'mutlu', weight: 1.0
    },
    {
      keywords: ['keyfim yerinde', 'keyifliyim', 'çok keyifliyim'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -1,
      emotion: 'mutlu', weight: 1.0
    },
    {
      // daha genel ama düşük ağırlık—ambiguous olabilir
      keywords: ['keyif'],
      moodImpact: +1, energyImpact: +1, anxietyImpact: -1,
      emotion: 'mutlu', weight: 0.6
    },
    {
      keywords: ['enerjik', 'dinamik', 'aktif', 'canlı', 'zinde', 'motivasyonum yüksek', 'şevkli', 'enerjim yüksek', 'enerjim var', 'motivasyonum iyi', 'motivasyonum tam'],
      moodImpact: +3, energyImpact: +5, anxietyImpact: -1,
      emotion: 'enerjik', weight: 1.2
    },
    {
      keywords: ['sakin', 'huzurlu', 'rahat', 'dingin', 'sükûnet', 'ferah', 'rahatlıyım'],
      moodImpact: +2, energyImpact: 0, anxietyImpact: -4,
      emotion: 'sakin', weight: 1.0
    },
    {
      keywords: ['umutlu', 'iyimser', 'pozitif', 'başarabilirim', 'güvenliyim', 'kendime güveniyorum'],
      moodImpact: +4, energyImpact: +2, anxietyImpact: -3,
      emotion: 'umutlu', weight: 1.1
    },
    {
      keywords: ['şaşırdım', 'şaşkın', 'inanamıyorum', 'hayret ettim', 'şok oldum', 'inanılmaz'],
      moodImpact: 0, energyImpact: +1, anxietyImpact: +2,
      emotion: 'şaşkın', weight: 0.9
    },
    {
      keywords: ['pişmanım', 'pişman', 'hata yaptım', 'keşke', 'vicdan azabı', 'suçluluk'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +3,
      emotion: 'suçlu', weight: 1.2
    },
    {
      keywords: ['kıskanıyorum', 'kıskançlık', 'imreniyorum', 'haset', 'çekemiyorum'],
      moodImpact: -2, energyImpact: +1, anxietyImpact: +3,
      emotion: 'kıskanç', weight: 1.1
    },
    {
      keywords: ['azimliyim', 'kararlıyım', 'odaklandım', 'motivasyonum tam', 'hedef odaklı', 'yapacak çok şey var', 'çok şey yapacağım', 'işler çok iyi'],
      moodImpact: +4, energyImpact: +4, anxietyImpact: -2,
      emotion: 'kararlı', weight: 1.3
    },
    {
      keywords: ['hiçbir şey hissetmiyorum', 'boşlukta', 'anlamsız', 'hissizim', 'kayıtsız'],
      moodImpact: -4, energyImpact: -3, anxietyImpact: +1,
      emotion: 'boş', weight: 1.2
    },
    {
      keywords: ['gurur duyuyorum', 'gururlu', 'övünç', 'başarı hissi', 'kendimle gurur'],
      moodImpact: +4, energyImpact: +3, anxietyImpact: -2,
      emotion: 'gururlu', weight: 1.2
    },
    {
      keywords: ['utandım', 'utanıyorum', 'mahcup', 'rezil oldum', 'sıkıldım'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      emotion: 'utanmış', weight: 1.1
    },
    {
      keywords: ['heyecan', 'heyecanlı', 'çok istiyorum', 'sabırsız', 'coşku'],
      moodImpact: +3, energyImpact: +4, anxietyImpact: +1,
      emotion: 'heyecanlı', weight: 1.1
    },
    {
      keywords: ['merak ediyorum', 'merakı', 'ilgimi çekti', 'sormak istiyorum'],
      moodImpact: +1, energyImpact: +2, anxietyImpact: 0,
      emotion: 'meraklı', weight: 0.8
    },

    // 😰 High Anxiety Patterns
    {
      keywords: ['çok kaygılı', 'aşırı endişeli', 'panik halinde', 'korku duyuyorum', 'dehşet', 'çok korkuyorum'],
      moodImpact: -5, energyImpact: -2, anxietyImpact: +5,
      emotion: 'panik', weight: 1.5
    },
    {
      keywords: ['kaygılı', 'endişeli', 'tedirgin', 'gergin', 'stresli', 'korkuyorum', 'endişe'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      emotion: 'kaygılı', weight: 1.2
    },
    
    // 😢 Depression/Sadness Patterns
    {
      keywords: ['çok üzgün', 'depresyondayım', 'çaresiz', 'umutsuz', 'hayata küsmüş', 'boş'],
      moodImpact: -5, energyImpact: -4, anxietyImpact: +2,
      emotion: 'depresif', weight: 1.4
    },
    {
      keywords: ['üzgün', 'kederli', 'mahzun', 'buruk', 'melankolik', 'hüzünlü', 'mutsuz'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +1,
      emotion: 'üzgün', weight: 1.1
    },
    
    // 😞 Keyflessness/Low Mood Patterns (Enhanced for better valence detection)
    {
      keywords: ['keyifsiz', 'keyifsizim', 'keyfim yok', 'keyfim hiç yok', 'hevesim yok', 
                 'canım sıkkın', 'moralsiz', 'moralim bozuk', 'ruh halim kötü', 'hiç isteksizim',
                 'motivem yok', 'zevk almıyorum', 'sıkıldım', 'bıktım'],
      moodImpact: -5, energyImpact: 0, anxietyImpact: +1, // energyImpact: 0 - sadece valans etkisi
      emotion: 'keyifsiz', weight: 1.3
    },
    
    // 😴 Low Energy Patterns
    {
      keywords: ['aşırı yorgun', 'bitap', 'tükenmiş', 'enerjim sıfır', 'hiçbir şey yapmak istemiyorum'],
      moodImpact: -3, energyImpact: -5, anxietyImpact: +1,
      emotion: 'bitkin', weight: 1.3
    },
    {
      keywords: ['yorgun', 'bitkin', 'halsiz', 'enerjim yok', 'yorgunum', 'bezgin'],
      moodImpact: -2, energyImpact: -4, anxietyImpact: +1,
      emotion: 'yorgun', weight: 1.0
    },
    
    // 😡 Anger Patterns
    {
      keywords: ['çok sinirli', 'öfke', 'hiddetli', 'çileden çıkmış', 'deliriyorum', 'patlatacağım'],
      moodImpact: -4, energyImpact: +3, anxietyImpact: +4,
      emotion: 'öfkeli', weight: 1.3
    },
    {
      keywords: ['sinirli', 'kızgın', 'rahatsız', 'canım sıkkın', 'bıktım', 'darıldım'],
      moodImpact: -3, energyImpact: +1, anxietyImpact: +2,
      emotion: 'sinirli', weight: 1.0
    },

    // 🔄 Neutral/Mixed Patterns
    {
      keywords: ['karışık', 'karmakarışık', 'belirsiz', 'emin değil', 'ne bileyim'],
      moodImpact: 0, energyImpact: -1, anxietyImpact: +2,
      emotion: 'karışık', weight: 0.8
    },

    // 🎯 ENHANCED Specific Triggers
    {
      keywords: ['iş stresi', 'patron baskısı', 'işten çıkarma', 'performans değerlendirme', 'deadline stresi'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'iş_yoğun_stres', weight: 1.2
    },
    {
      keywords: ['iş', 'çalışma', 'ofis', 'patron', 'toplantı', 'proje', 'deadline', 'mesai'],
      moodImpact: -1, energyImpact: 0, anxietyImpact: +2,
      trigger: 'iş_stres', weight: 0.9
    },
    {
      keywords: ['aile kavgası', 'boşanma', 'ilişki problemi', 'eş sorunu', 'evlilik krizi'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +3,
      trigger: 'ilişki_krizi', weight: 1.3
    },
    {
      keywords: ['aile', 'annem', 'babam', 'eş', 'çocuk', 'kardeş', 'aile problem', 'evlilik'],
      moodImpact: -1, energyImpact: 0, anxietyImpact: +1,
      trigger: 'aile_ilişki', weight: 0.8
    },
    {
      keywords: ['borç batağı', 'iflas', 'kredi kartı', 'maaş yetersiz', 'ekonomik kriz'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +5,
      trigger: 'finansal_kriz', weight: 1.4
    },
    {
      keywords: ['para', 'maaş', 'borç', 'fatura', 'ekonomik', 'finansal', 'banka'],
      moodImpact: -2, energyImpact: -1, anxietyImpact: +3,
      trigger: 'finansal_kaygı', weight: 1.0
    },
    {
      keywords: ['kanser', 'kalp krizi', 'ameliyat', 'ölüm korkusu', 'hastalık teşhisi'],
      moodImpact: -5, energyImpact: -3, anxietyImpact: +5,
      trigger: 'ciddi_sağlık', weight: 1.5
    },
    {
      keywords: ['sağlık', 'hastalık', 'doktor', 'ameliyat', 'ağrı', 'hasta', 'acil'],
      moodImpact: -2, energyImpact: -2, anxietyImpact: +4,
      trigger: 'sağlık_endişe', weight: 1.2
    },
    {
      keywords: ['okul stresi', 'sınav kaygısı', 'not korkusu', 'ders çalışma', 'akademik başarısızlık'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'eğitim_stres', weight: 1.1
    },
    {
      keywords: ['sosyal anksiyete', 'utanıyorum', 'herkesle sorunu var', 'dışlanmış', 'yalnızlık'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +4,
      trigger: 'sosyal_kaygı', weight: 1.2
    },
    {
      keywords: ['gelecek korkusu', 'belirsizlik', 'ne olacak', 'geleceğim yok', 'plan yapamıyorum'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'gelecek_kaygısı', weight: 1.1
    },
    
    // 🌍 Gündem / Toplumsal Triggers (NEW)
    {
      keywords: ['siyaset', 'seçim', 'politika', 'hükümet', 'başkan', 'oy kullandım'],
      moodImpact: -2, energyImpact: 0, anxietyImpact: +3,
      trigger: 'siyasi_gündem', weight: 1.0
    },
    {
      keywords: ['haberler', 'haber izledim', 'gazete okudum', 'kötü haberler', 'gündem'],
      moodImpact: -2, energyImpact: -1, anxietyImpact: +3,
      trigger: 'haber_medya', weight: 0.9
    },
    {
      keywords: ['deprem', 'savaş', 'felaket', 'afet', 'terör', 'kaza'],
      moodImpact: -4, energyImpact: -2, anxietyImpact: +5,
      trigger: 'afet_travma', weight: 1.4
    },
    {
      keywords: ['enflasyon', 'zam', 'pahalılık', 'geçim sıkıntısı', 'hayat pahalı', 'kira ödemek', 'fatura ödemek', 'ekonomik kriz', 'para sıkıntısı', 'maddi zorluk', 'gelir gider', 'bütçe sıkıntısı'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +4,
      trigger: 'ekonomik_durum', weight: 1.3
    },
    
    // 📱 Teknoloji / Dijital Stres (NEW)
    {
      keywords: ['internet yok', 'bağlantı koptu', 'wifi problemi', 'sinyal yok', 'çekmez'],
      moodImpact: -2, energyImpact: -1, anxietyImpact: +3,
      trigger: 'dijital_bağlantı', weight: 1.0
    },
    {
      keywords: ['telefon bozuldu', 'bilgisayar çöktü', 'sistem hatası', 'virüs', 'format'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +4,
      trigger: 'teknoloji_arıza', weight: 1.2
    },
    {
      keywords: ['sosyal medya', 'instagram', 'facebook', 'twitter', 'like almadım'],
      moodImpact: -1, energyImpact: 0, anxietyImpact: +2,
      trigger: 'sosyal_medya', weight: 0.8
    },
    {
      keywords: ['online toplantı', 'zoom', 'uzaktan çalışma', 'home office'],
      moodImpact: -1, energyImpact: -1, anxietyImpact: +2,
      trigger: 'dijital_çalışma', weight: 0.9
    },
    
    // 😔 Yalnızlık / Destek Eksikliği (NEW)
    {
      keywords: ['kimsem yok', 'kimse anlamıyor', 'desteksizim', 'tek başıma', 'yalnız'],
      moodImpact: -4, energyImpact: -3, anxietyImpact: +3,
      trigger: 'yalnızlık_destek', weight: 1.4
    },
    {
      keywords: ['arkadaş yok', 'sosyal çevrem dar', 'insanlardan uzak', 'izole'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +3,
      trigger: 'sosyal_izolasyon', weight: 1.2
    },
    {
      keywords: ['anlaşılamıyor', 'dinlenmiyor', 'önemsiz', 'görülmüyor'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +2,
      trigger: 'duygusal_ihmal', weight: 1.1
    },
    
    // 🕌 Kültürel / Manevi (NEW)
    {
      keywords: ['dua ettim', 'namaz kıldım', 'ibadet', 'camii', 'kilise', 'dini'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -3,
      trigger: 'manevi_ibadet', weight: 1.0
    },
    {
      keywords: ['ruhsal', 'manevi güç', 'kadere inanıyorum', 'şükrettim'],
      moodImpact: +1, energyImpact: 0, anxietyImpact: -2,
      trigger: 'manevi_destek', weight: 0.9
    },
    {
      keywords: ['ramazan', 'bayram', 'oruç', 'dini gün', 'kutsal'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      trigger: 'dini_özel_gün', weight: 0.8
    },
    
    // 🏠 Ev / Yaşam Alanı (NEW)
    {
      keywords: ['ev kiralanmıyor', 'taşınma', 'komşu problemi', 'gürültü'],
      moodImpact: -3, energyImpact: -1, anxietyImpact: +4,
      trigger: 'konut_problemi', weight: 1.2
    },
    {
      keywords: ['ev işleri', 'temizlik yapmak zorunda', 'çamaşır', 'bulaşık'],
      moodImpact: -1, energyImpact: -2, anxietyImpact: +1,
      trigger: 'ev_sorumluluğu', weight: 0.7
    },
    
    // 🚗 Ulaşım / Trafik (NEW)
    {
      keywords: ['trafik', 'otobüs gecikti', 'metro arızası', 'yol kapandı'],
      moodImpact: -2, energyImpact: -1, anxietyImpact: +3,
      trigger: 'ulaşım_sorunu', weight: 0.9
    },
    {
      keywords: ['araba bozuldu', 'lastik patladı', 'yakıt bitti', 'park yeri yok'],
      moodImpact: -3, energyImpact: -2, anxietyImpact: +4,
      trigger: 'araç_problemi', weight: 1.1
    },

    // 💪 ENHANCED Activities (Positive Impact)
    {
      keywords: ['maraton', 'jimnastik', 'yüzme', 'bisiklet', 'dağcılık', 'ekstrem spor'],
      moodImpact: +4, energyImpact: +5, anxietyImpact: -3,
      activity: 'yoğun_egzersiz', weight: 1.2
    },
    {
      keywords: ['spor', 'koşu', 'yürüyüş', 'gym', 'egzersiz', 'fitness', 'antrenman'],
      moodImpact: +2, energyImpact: +3, anxietyImpact: -2,
      activity: 'egzersiz', weight: 0.9
    },
    {
      keywords: ['parti', 'doğum günü', 'konser', 'festival', 'kutlama', 'eğlence'],
      moodImpact: +4, energyImpact: +3, anxietyImpact: -2,
      activity: 'kutlama_eğlence', weight: 1.1
    },
    {
      keywords: ['arkadaş', 'sosyal', 'buluştuk', 'sohbet', 'gezi', 'kafe', 'sinema'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      activity: 'sosyal_aktivite', weight: 0.8
    },
    {
      keywords: ['meditasyon', 'mindfulness', 'derin nefes', 'yoga', 'gevşeme egzersizi'],
      moodImpact: +2, energyImpact: 0, anxietyImpact: -4,
      activity: 'mindfulness', weight: 1.2
    },
    {
      keywords: ['nefes', 'nefes aldım', 'soluk', 'nefes egzersizi'],
      moodImpact: +1, energyImpact: 0, anxietyImpact: -3,
      activity: 'nefes_egzersizi', weight: 1.0
    },
    {
      keywords: ['kitap okudum', 'okuma', 'dergi', 'gazete', 'araştırma'],
      moodImpact: +1, energyImpact: +1, anxietyImpact: -2,
      activity: 'okuma', weight: 0.8
    },
    {
      keywords: ['müzik dinledim', 'şarkı', 'konser', 'çalgı', 'enstrüman'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'müzik', weight: 0.9
    },
    {
      keywords: ['doğa', 'park', 'orman', 'deniz', 'göl', 'dağ', 'piknik'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -3,
      activity: 'doğa_aktivite', weight: 1.1
    },
    {
      keywords: ['uyudum', 'dinlendim', 'istirahat', 'uzandım', 'vücudumu dinlendirdim'],
      moodImpact: +1, energyImpact: +4, anxietyImpact: -2,
      activity: 'dinlenme', weight: 0.9
    },
    {
      keywords: ['yemek yaptım', 'aşçılık', 'tarif', 'pişirme', 'mutfak'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      activity: 'yemek_yapma', weight: 0.8
    },
    {
      keywords: ['temizlik', 'düzen', 'organize', 'toplama', 'ev işi'],
      moodImpact: +1, energyImpact: +2, anxietyImpact: -2,
      activity: 'ev_düzeni', weight: 0.7
    },
    
    // 🐕 Evcil Hayvan Aktiviteleri (NEW)
    {
      keywords: ['köpeğimle oynadım', 'köpek gezdirdim', 'kedi', 'evcil hayvan', 'miş miş'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -3,
      activity: 'evcil_hayvan', weight: 1.1
    },
    {
      keywords: ['kuş', 'balık', 'hamster', 'tavşan', 'hayvan sevgisi'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'hayvan_bakım', weight: 0.9
    },
    
    // 🎨 Sanat / Hobi (NEW)
    {
      keywords: ['resim yaptım', 'çizim', 'boyama', 'suluboya', 'karakalem'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -3,
      activity: 'resim_sanat', weight: 1.0
    },
    {
      keywords: ['yazı yazdım', 'günlük tuttum', 'şiir yazdım', 'hikaye'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'yazma_sanat', weight: 1.0
    },
    {
      keywords: ['şiir okudum', 'kitap okudum', 'roman', 'dergi okudum'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'okuma_detay', weight: 0.9
    },
    {
      keywords: ['el işi', 'örgü', 'nakış', 'takı yapma', 'hobi'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -3,
      activity: 'el_sanatı', weight: 1.0
    },
    {
      keywords: ['fotoğraf çektim', 'fotoğrafçılık', 'kamera', 'görsel sanat'],
      moodImpact: +2, energyImpact: +2, anxietyImpact: -1,
      activity: 'fotoğrafçılık', weight: 0.9
    },
    
    // 🍽️ Yemek / Sosyal Paylaşımlar (ENHANCED)
    {
      keywords: ['dışarıda yemek', 'restoran', 'cafe gittim', 'yemek keşfi'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -1,
      activity: 'sosyal_yemek', weight: 1.1
    },
    {
      keywords: ['kahve içtim', 'çay içtim', 'sohbet ettim', 'keyifli sohbet'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'içecek_sohbet', weight: 0.8
    },
    {
      keywords: ['arkadaşlarla yemek', 'aile yemeği', 'beraber yemek'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -2,
      activity: 'grup_yemek', weight: 1.2
    },
    {
      keywords: ['ev yemeği', 'anne yemeği', 'kendi pişirdim', 'lezzetli'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -1,
      activity: 'ev_yemeği', weight: 0.9
    },
    
    // 🎮 Oyun Aktiviteleri (NEW)
    {
      keywords: ['bilgisayar oyunu', 'pc oyun', 'online oyun', 'gaming'],
      moodImpact: +1, energyImpact: +2, anxietyImpact: -1,
      activity: 'dijital_oyun', weight: 0.8
    },
    {
      keywords: ['playstation', 'xbox', 'konsol oyunu', 'fifa', 'pes'],
      moodImpact: +2, energyImpact: +2, anxietyImpact: -1,
      activity: 'konsol_oyun', weight: 0.8
    },
    {
      keywords: ['mobil oyun', 'telefon oyunu', 'puzzle', 'bulmaca'],
      moodImpact: +1, energyImpact: +1, anxietyImpact: -2,
      activity: 'mobil_oyun', weight: 0.6
    },
    {
      keywords: ['kart oyunu', 'tavla', 'satranç', 'masa oyunu'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: -2,
      activity: 'masa_oyunu', weight: 0.9
    },
    
    // 🎭 Kültür / Sanat Etkinlikleri (NEW)
    {
      keywords: ['tiyatro', 'opera', 'bale', 'sahne sanatı', 'kültür merkezi'],
      moodImpact: +4, energyImpact: +2, anxietyImpact: -2,
      activity: 'kültür_sanat', weight: 1.2
    },
    {
      keywords: ['müze', 'sergi', 'galeri', 'sanat eseri', 'kültürel gezi'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -1,
      activity: 'müze_sergi', weight: 1.0
    },
    {
      keywords: ['konser', 'müzik dinleme', 'canlı müzik', 'sahne'],
      moodImpact: +4, energyImpact: +3, anxietyImpact: -2,
      activity: 'müzik_konser', weight: 1.1
    },
    
    // 🛍️ Alışveriş / Self Care (NEW)
    {
      keywords: ['alışveriş', 'market', 'mağaza gezdim', 'shopping'],
      moodImpact: +1, energyImpact: +1, anxietyImpact: -1,
      activity: 'alışveriş', weight: 0.7
    },
    {
      keywords: ['kuaför', 'berber', 'makyaj', 'bakım yaptırdım'],
      moodImpact: +2, energyImpact: +2, anxietyImpact: -2,
      activity: 'kişisel_bakım', weight: 0.9
    },
    {
      keywords: ['spa', 'masaj', 'wellness', 'kendime zaman'],
      moodImpact: +3, energyImpact: +3, anxietyImpact: -4,
      activity: 'spa_relax', weight: 1.2
    },
    
    // 📚 Eğitim / Öğrenme (NEW)
    {
      keywords: ['kurs aldım', 'online eğitim', 'sertifika', 'öğrenme'],
      moodImpact: +2, energyImpact: +2, anxietyImpact: -1,
      activity: 'eğitim_gelişim', weight: 1.0
    },
    {
      keywords: ['dil öğrenme', 'ingilizce', 'yabancı dil', 'kelime ezber'],
      moodImpact: +2, energyImpact: +1, anxietyImpact: 0,
      activity: 'dil_öğrenme', weight: 1.0
    }
  ];

  // 🔍 ENHANCED Intensity modifiers (v3.0)
  private readonly intensityModifiers: { [key: string]: number } = {
    // Aşırılaştırıcılar (High Intensifiers)
    'çok': 1.5, 'aşırı': 1.8, 'son derece': 1.7, 'fazla': 1.3,
    'inanılmaz': 1.9, 'acayip': 1.8, 'çılgın': 1.7, 'deli gibi': 1.8,
    'yerle bir': 1.9, 'mahvoldum': 1.8, 'bitirdim': 1.7,
    'resmen': 1.6, 'tam anlamıyla': 1.7, 'kesinlikle': 1.5,
    'oldukça': 1.2, 'epey': 1.3, 'hayli': 1.3,
    'son': 1.4, 'gerçekten': 1.4, 'ciddi': 1.5,
    'büyük': 1.4, 'kocaman': 1.6, 'korkunç': 1.8,
    'müthiş': 1.6, 'dehşetli': 1.7, '엄청': 1.8, // Korean borrowed
    
    // Azaltıcılar (Diminishers)
    'biraz': 0.7, 'az': 0.6, 'hafif': 0.5, 'ufak': 0.5,
    'eh işte': 0.4, 'idare eder': 0.5, 'çok değil': 0.6,
    'fena değil': 0.6, 'bir nebze': 0.5, 'şöyle böyle': 0.4,
    'pek değil': 0.5, 'o kadar da değil': 0.4, 'normal': 0.6,
    'sıradan': 0.5, 'vasat': 0.4, 'orta': 0.6,
    'az çok': 0.6, 'kısmen': 0.5, 'nispeten': 0.6,
    'bazen': 0.7, 'ara sıra': 0.6, 'zaman zaman': 0.6
  };

  // 🚨 Crisis Detection Keywords
  private readonly crisis = [
    'intihar', 'kendime zarar', 'yaşamak istemiyorum', 'ölmek istiyorum', 
    'panik atağım', 'kriz geçirdim', 'kendimi öldürmek', 'canıma kıyarım',
    'hayatı bırakasım', 'çok kötü durumdayım'
  ];

  // 🔗 Sinonim Eşleştirme Tablosu (NEW)
  private readonly synonymGroups: { [key: string]: string[] } = {
    'mutlu': ['sevinçli', 'neşeli', 'keyifli', 'memnun', 'hoşnut'],
    'üzgün': ['kederli', 'mahzun', 'buruk', 'hüzünlü', 'mutsuz', 'keyifsiz', 'moralsiz'],
    'keyifsiz': ['canım sıkkın', 'hevesim yok', 'motivem yok', 'isteksiz', 'sıkıldım'],
    'kaygılı': ['endişeli', 'tedirgin', 'gergin', 'huzursuz'],
    'yorgun': ['bitkin', 'halsiz', 'tükenmiş', 'bezgin'],
    'sinirli': ['kızgın', 'öfkeli', 'rahatsız', 'darılmış'],
    'sakin': ['huzurlu', 'rahat', 'dingin', 'ferah'],
    'enerjik': ['dinamik', 'aktif', 'canlı', 'zinde', 'şevkli'],
    'iyi': ['güzel', 'hoş', 'fena değil', 'olumlu'],
    'kötü': ['berbat', 'fena', 'olumsuz', 'bozuk'],
  };

  // ❌ Negatif Bağlam Belirleyicileri (NEW)
  private readonly negationWords = [
    'değil', 'değilim', 'hiç', 'asla', 'kesinlikle değil',
    'pek değil', 'o kadar da değil', 'değildir', 'olmadı'
  ];

  // 🎭 Belirsizlik Belirleyicileri (NEW)
  private readonly uncertaintyWords = [
    'galiba', 'sanırım', 'herhalde', 'belki', 'gibi geliyor',
    'olabilir', 'muhtemelen', 'sanki', 'gibime geliyor'
  ];

  constructor() {
    this.initializeCompiledPatterns();
  }

  static getInstance(): VoiceCheckInHeuristicService {
    if (!VoiceCheckInHeuristicService.instance) {
      VoiceCheckInHeuristicService.instance = new VoiceCheckInHeuristicService();
    }
    return VoiceCheckInHeuristicService.instance;
  }

  /**
   * 🏭 Static pattern compiler for regex optimization
   */
  private static compilePatterns(
    patterns: KeywordPattern[], 
    synonymGroups: { [key: string]: string[] },
    regexBuilder: (w: string) => RegExp
  ): CompiledPattern[] {
    return patterns.map((p) => {
      const rx = p.keywords.map(regexBuilder);
      const rxSyn = p.keywords
        .map((k) => synonymGroups[k.split(' ').pop()!]?.map(regexBuilder) ?? [])
        .flat();
      return { ...p, rx, rxSyn };
    });
  }

  /**
   * 🔧 Initialize compiled patterns (uses static compiler)
   */
  private initializeCompiledPatterns(): void {
    this.compiled = VoiceCheckInHeuristicService.compilePatterns(
      this.cfg.patterns,
      this.cfg.synonymGroups,
      (w: string) => this.buildLemmaRegex(w)
    );
    if (DEBUG) console.log('🔧 Compiled', this.compiled.length, 'patterns via static compiler');
  }

  /**
   * 🔤 Token penceresi helper methods
   */
  private tokenize(t: string): string[] {
    return t.split(/\s+/).filter(Boolean);
  }

  private windowHasNegation(tokens: string[], from: number, to: number): boolean {
    const w = tokens.slice(Math.max(0, from), Math.min(tokens.length, to + 1));
    return w.some((x) => this.cfg.negationWords.includes(x));
  }

  private windowIntensity(tokens: string[], from: number, to: number): number {
    const w = tokens.slice(Math.max(0, from), Math.min(tokens.length, to + 1));
    let m = 1.0;
    for (const tok of w) {
      if (this.cfg.intensityModifiers[tok]) m = Math.max(m, this.cfg.intensityModifiers[tok]);
    }
    return m;
  }

  /**
   * 🚨 Crisis Detection
   */
  public detectCrisis(t: string): { flagged: boolean; hits: string[] } {
    const lower = t.toLowerCase();
    const hits = this.cfg.crisis.filter((w) => lower.includes(w));
    return { flagged: hits.length > 0, hits };
  }

  /**
   * 🎧 Incremental (Realtime) Analysis API
   */
  public beginRealtime(): RealtimeState {
    // Create RealtimeCtx with bound methods for echo protection and coordinate conversion
    const ctx = new RealtimeCtx(
      (text: string) => this.preprocessText(text),
      (text: string) => this.tokenize(text),
      (a: string, b: string) => this.lcpLen(a, b),
      (delta: string, base: string) => this.dropRepeatedNgrams({ text: base } as any, delta)
    );
    
    return ctx as any; // Compatible with existing RealtimeState interface
  }

  public incrementalAnalyze(
    state: RealtimeState,
    newChunk: string,
    opts?: { isFinal?: boolean }
  ) {
    // Cast to RealtimeCtx for enhanced methods
    const ctx = state as any as RealtimeCtx;
    
    // 🔄 ENHANCED: Use RealtimeCtx appendChunk with echo protection
    const delta = ctx.appendChunk(newChunk);

    // Yeni bilgi yoksa: koordinatı ve float'ları koru, sinyal 0
    if (!delta) {
      const coord = ctx.getLastCoord();
      return {
        moodScore: Math.round(ctx.mood),
        energyLevel: Math.round(ctx.energy),
        anxietyLevel: Math.round(ctx.anxiety),
        moodFloat: ctx.mood,
        energyFloat: ctx.energy,
        anxietyFloat: ctx.anxiety,
        coordX: coord.x,          // 👈 UI için doğrudan koordinat
        coordY: coord.y,
        signalStrength: 0,
        confidence: Constants.BASE_CONFIDENCE,
        gateActive: ctx.isGateActive(),
        finalized: !!opts?.isFinal,
      };
    }

    const newTokens = ctx.tokens;
    const startIdx = newTokens.length - this.tokenize(delta).length;

    // Sadece yeni alanda compiled matcher çalıştır
    const matches: (PatternMatch & { lastIdx?: number })[] = [];
    for (const p of this.compiled) {
      let found = false;
      let localIntensity = 1.0;
      let neg = false;
      let lastIdx: number | undefined;

      for (const rxOriginal of [...p.rx, ...p.rxSyn]) {
        // Tüm eşleşmeler için global regex oluştur
        const rx = new RegExp(rxOriginal.source, rxOriginal.flags.includes('g') ? rxOriginal.flags : (rxOriginal.flags + 'g'));
        
        // Reset regex lastIndex to ensure we scan the full text
        rx.lastIndex = 0;
        
        let m: RegExpExecArray | null;
        while ((m = rx.exec(state.text)) !== null) {
          const before = state.text.slice(0, m.index).trim();
          const idx = this.tokenize(before).length;
          if (idx < startIdx) continue; // sadece yeni bölge

          const intMod = this.windowIntensity(newTokens, idx - 5, idx - 1);
          localIntensity = Math.max(localIntensity, intMod);
          if (this.windowHasNegation(newTokens, idx - 6, idx + 6)) neg = true;

          lastIdx = idx; // Match pozisyonunu kaydet
          found = true;
          
          // Prevent infinite loop for zero-width matches
          if (m[0].length === 0) {
            rx.lastIndex++;
          }
        }
      }

      if (found) {
        matches.push({
          ...p,
          matchedKeywords: p.keywords,
          intensity: neg ? localIntensity * 0.3 : localIntensity,
          negationDetected: neg,
          lastIdx
        });
      }
    }

    // Recency ağırlığı (son taraf daha etkili)
    const recentBoost = (i: number) => 0.4 + 0.6 * Math.exp(-(newTokens.length - i) / Constants.RECENCY_DECAY);

    const scoreAxis = (field: ImpactField, base: number) => {
      let s = 0;
      for (const m of matches) {
        const imp = m[field] || 0; // Type-safe access without 'as any'
        const i = m.lastIdx ?? newTokens.length; // eşleşme index'i varsa onu kullan
        s += imp * m.intensity * m.weight * recentBoost(i);
      }
      return Math.max(Constants.MIN_SCORE, Math.min(Constants.MAX_SCORE, base + s)); // No rounding for micro-movements
    };

    const next = {
      mood: scoreAxis('moodImpact', Constants.MOOD_BASELINE),
      energy: scoreAxis('energyImpact', Constants.ENERGY_BASELINE),
      anxiety: scoreAxis('anxietyImpact', Constants.ANXIETY_BASELINE),
    };

    // 🔹 Recency/explicit: yeni chunk + kuyruk (tekrarları kaçırma)
    const deltaRaw = this.preprocessText(newChunk);
    const tail = this.tokenize(state.text).slice(-Constants.RECENCY_WINDOW_SIZE).join(' ');
    const recencyWindow = [deltaRaw, tail].filter(Boolean).join(' ').trim();

    // 🔹 Filler/short kontrolü (ilk drift'i engelle)
    const deltaWordCnt = deltaRaw ? deltaRaw.split(/\s+/).filter(Boolean).length : 0;
    const FILLERS = /\b(bugün|yani|şey|işte|çok)\b(?:\s+\b(bugün|yani|şey|işte|çok)\b)*$/u;
    const isFillerOnly = !!deltaRaw && FILLERS.test(deltaRaw);
    
    // 🔹 Meta-konuşma filtresi (test/örnek cümle vb.)
    const META = /\b(örnek cümle|test|senaryo|uygulama|başlayalım|devam ediyorum|yardımcı olurum|hazırsan|başlayalım|teste geçelim|deneme|simülasyon|test edebilirsin)\b/iu;
    const isMeta = META.test(recencyWindow);
    
    const deltaIsShort =
      (deltaRaw?.length ?? 0) <= Constants.MIN_CHUNK_CHARS ||
      deltaWordCnt <= Constants.MIN_CHUNK_WORDS ||
      isFillerOnly;

    // 🔹 Explicit yakala + güçlendir
    const explicitDecl = this.extractExplicitDeclarations(recencyWindow);
    const explicitOverride =
      explicitDecl.mood !== undefined ||
      explicitDecl.energy !== undefined ||
      explicitDecl.anxiety !== undefined;

    const hasStrongIntensifier = /\b(çok|aşırı|son derece|inanılmaz|resmen|tam anlamıyla)\b/u.test(recencyWindow);

    if (explicitDecl.energy !== undefined) {
      let v = explicitDecl.energy;
      if (hasStrongIntensifier) v = Math.max(v, 9);
      next.energy = v;
    }
    if (explicitDecl.mood !== undefined) {
      let v = explicitDecl.mood;
      if (hasStrongIntensifier) v = Math.max(v, 9);
      next.mood = v;
    }
    if (explicitDecl.anxiety !== undefined) {
      next.anxiety = explicitDecl.anxiety; // kaygıda boost yok
    }

    // 🔹 Sinyali smoothing'den ÖNCE ölç
    const signalRaw = this.computeSignalStrength(matches);

    // 🔹 Dinamik smoothing (explicit hızlı uçar)
    const alpha = explicitOverride
      ? 0.8
      : Math.min(0.8, Constants.SMOOTHING_FACTOR + 0.55 * signalRaw);

    state.mood   = state.mood   + alpha * (next.mood   - state.mood);
    state.energy = state.energy + alpha * (next.energy - state.energy);
    state.anxiety= state.anxiety+ alpha * (next.anxiety- state.anxiety);

    // 🔹 Çıkış + koordinat
    const outMood   = Math.max(Constants.MIN_SCORE, Math.min(Constants.MAX_SCORE, state.mood));
    const outEnergy = Math.max(Constants.MIN_SCORE, Math.min(Constants.MAX_SCORE, state.energy));
    const outAnx    = Math.max(Constants.MIN_SCORE, Math.min(Constants.MAX_SCORE, state.anxiety));
    const freshCoord = ctx.toCoord(outMood, outEnergy);

    // 🔹 Gate logic: meta-content + weak-signal + short
    let gateActive = false;
    if (!explicitOverride && (signalRaw < Constants.WEAK_SIGNAL_THRESHOLD || deltaIsShort || isMeta)) {
      if (!ctx.isGateActive()) ctx.setGate(Constants.GATE_MS);
      gateActive = ctx.isGateActive();
      if (__DEV__ && isMeta) console.log('🚪 Gate active: meta-content detected');
    } else {
      ctx.clearGate();
    }

    const coord = gateActive ? ctx.getLastCoord() : freshCoord;
    ctx.setLastCoord(coord);

    // 🔹 Sayısal payload + explicit bayrağı + geriye dönük alanlar
    const round3 = (n:number) => Math.round(n * 1000) / 1000;
    const signalStrength = explicitOverride ? Math.max(signalRaw, 0.95) : signalRaw;

    // Debug logging for consistency
    if (__DEV__) {
      console.log('🎧 Realtime analyze:', { 
        chunk: newChunk.slice(0, 30), 
        gateActive, 
        coord: { x: round3(coord.x), y: round3(coord.y) }, 
        signalStrength: round3(signalStrength), 
        explicit: !!explicitOverride,
        meta: isMeta,
        short: deltaIsShort
      });
    }

    return {
      moodScore: Number(outMood.toFixed(1)),
      energyLevel: Number(outEnergy.toFixed(1)),
      anxietyLevel: Number(outAnx.toFixed(1)),

      moodFloat: state.mood,
      energyFloat: state.energy,
      anxietyFloat: state.anxiety,

      coordX: round3(coord.x),   // <-- sayı
      coordY: round3(coord.y),   // <-- sayı

      signalStrength,            // <-- sayı
      explicit: explicitOverride,
      confidence: Constants.BASE_CONFIDENCE,
      gateActive,                // <-- tek isim
      finalized: !!opts?.isFinal,

      // geçici geriye dönük uyumluluk:
      final: !!opts?.isFinal,    // DEPRECATE
      gated: gateActive          // DEPRECATE
    };
  }

  /**
   * 🔄 LCP (Longest Common Prefix) helper
   */
  private lcpLen(a: string, b: string): number {
    const n = Math.min(a.length, b.length);
    let i = 0; 
    while (i < n && a[i] === b[i]) i++;
    return i;
  }

  /**
   * 🧹 Drop repeated n-grams from delta
   */
  private dropRepeatedNgrams(state: RealtimeState, delta: string): string {
    if (!delta) return '';
    const base = this.tokenize(state.text).slice(-30).join(' ');
    const toks = this.tokenize(delta);
    const out: string[] = [];
    
    for (let i = 0; i < toks.length; i++) {
      out.push(toks[i]);
      if (out.length >= 3) {
        const tri = out.slice(-3).join(' ');
        if (base.includes(tri)) {
          out.splice(out.length - 3, 3);
          if (DEBUG) console.log('🧽 Echo dropped: 3-gram already exists');
        }
      }
    }
    return out.join(' ');
  }

  /**
   * 📊 Partial snapshot → gerçek delta (echo/rewind korumalı)
   */
  private computeIncrement(state: RealtimeState, rawChunk: string): string {
    const norm = this.preprocessText(rawChunk);
    const prev = state._lastPartialNorm ?? '';
    let delta = norm;

    if (prev) {
      const l = this.lcpLen(prev, norm);
      delta = norm.slice(l);

      // Rewind/echo: çok küçük LCP + başı zaten geçmişteyse → delta yok
      if (l < 5) {
        const head = norm.slice(0, Math.min(24, norm.length));
        if (head && state.text.includes(head)) {
          delta = '';
          if (DEBUG) console.log('🧽 Echo dropped: head already in state');
        }
      }
    }
    
    delta = this.dropRepeatedNgrams(state, delta);
    state._lastPartialNorm = norm;
    return delta.trim();
  }

  /**
   * 🎯 Enhanced coordinate mapping (Constants.CENTER center, gain/gamma curve)
   */
  private toCoord(mood: number, energy: number) {
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    
    // 1–10 → [-1, +1], merkez Constants.CENTER (tam ortalama), enerji yukarı doğru +y
    const x = clamp((mood - Constants.CENTER) / Constants.SPAN, -1, 1);
    const y = clamp((energy - Constants.CENTER) / Constants.SPAN, -1, 1);
    return { x, y };
  }

  /**
   * 📊 Compute signal strength for gating/animation decisions
   */
  private computeSignalStrength(matches: PatternMatch[]): number {
    const s = matches.reduce((acc, m) =>
      acc + (Math.abs(m.moodImpact) + Math.abs(m.energyImpact) + Math.abs(m.anxietyImpact))
            * m.intensity * m.weight, 0);
    return Math.max(0, Math.min(1, 1 - Math.exp(-s / Constants.SIGNAL_DECAY_RATE)));
  }

  /**
   * 🎵 Apply prosody adjustments (optional)
   */
  public applyProsody(
    state: RealtimeState,
    prosody: { rmsZ?: number; rateZ?: number; pitchZ?: number }
  ): void {
    const { rmsZ = 0, rateZ = 0, pitchZ = 0 } = prosody;
    const delta = Math.max(-0.5, Math.min(0.5, 0.12 * rmsZ + 0.08 * rateZ + 0.05 * pitchZ));
    state.energy = Math.max(1, Math.min(10, Math.round(state.energy + delta)));
  }

  /**
   * 🎯 Ana analiz fonksiyonu - Speech-to-text sonucunu mood verisine çevirir
   */
  async analyzeMoodFromVoice(
    transcriptionResult: TranscriptionResult
  ): Promise<MoodAnalysisResult> {
    if (DEBUG) console.log('🧠 Starting heuristic mood analysis...', {
      text: transcriptionResult.text.substring(0, 100),
      confidence: transcriptionResult.confidence
    });

    try {
      const text = transcriptionResult.text.toLowerCase().trim();
      
      if (!text || text.length < 5) {
        return this.createDefaultResult('Çok kısa metin, analiz yapılamadı.');
      }

      // 1. Text preprocessing
      const cleanText = this.preprocessText(text);
      
      // 2. Pattern matching
      const patternMatches = this.findPatternMatches(cleanText);
      
      // 3. Calculate mood metrics
      const metrics = this.calculateMoodMetrics(patternMatches, cleanText);
      
      // 4. Extract entities (triggers, activities, emotions)
      const entities = this.extractEntities(patternMatches, cleanText);
      
      // 5. Determine confidence
      const confidence = this.calculateConfidence(
        patternMatches,
        transcriptionResult.confidence,
        text.length,
        transcriptionResult.text // RAW TEXT eklendi
      );

      // 6. Build result with normalized scores
      const finalMood = this.normalizeScore(metrics.mood); // Already 1-10, just clamp
      const finalEnergy = this.normalizeScore(metrics.energy);
      const finalAnxiety = this.normalizeScore(metrics.anxiety);
      
      const result: MoodAnalysisResult = {
        moodScore: finalMood,
        energyLevel: finalEnergy,
        anxietyLevel: finalAnxiety,
        dominantEmotion: entities.dominantEmotion || 'nötr',
        triggers: entities.triggers,
        activities: entities.activities,
        notes: transcriptionResult.text, // Original text
        confidence,
        analysisDetails: {
          keywords: entities.foundKeywords,
          emotionSignals: entities.emotionSignals,
          intensity: this.determineIntensity(metrics.totalIntensity),
          sentiment: this.determineSentiment(finalMood) // Use final mood for sentiment
        }
      };

      // Final emotion picker with energy+anxiety combo logic
      result.dominantEmotion = this.pickFinalEmotion({
        mood: result.moodScore,
        energy: result.energyLevel, 
        anxiety: result.anxietyLevel
      });

      console.log('✅ Heuristic analysis complete:', {
        mood: result.moodScore,
        energy: result.energyLevel,
        anxiety: result.anxietyLevel,
        emotion: result.dominantEmotion,
        confidence: result.confidence.toFixed(2)
      });

      return result;

    } catch (error) {
      console.error('❌ Heuristic analysis failed:', error);
      return this.createDefaultResult(
        transcriptionResult.text,
        `Analiz hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      );
    }
  }

  /**
   * 📝 Text preprocessing - cleanup and normalize
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\wşçğıöüâàáéèíóôúûñ\s]/gi, ' ') // Turkish chars allowed
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 🔍 ENHANCED Pattern matching with advanced techniques (v3.0)
   */
  private findPatternMatches(text: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const repetitionMultiplier = this.detectRepetition(text);

    for (const pattern of this.moodPatterns) {
      const matchedKeywords: string[] = [];
      let totalIntensity = 1.0;
      let negationDetected = false;

      for (const keyword of pattern.keywords) {
        let keywordFound = false;

        // 1) Doğrudan (ek toleranslı) eşleşme
        if (this.includesWord(text, keyword)) {
          keywordFound = true;
          matchedKeywords.push(keyword);
        }

        // 2) Sinonim eşleştirme (ek toleranslı)
        if (!keywordFound) {
          const root = keyword.split(' ').pop()!; // son kelime kök gibi
          const syns = this.synonymGroups[root];
          if (syns && syns.some(s => this.includesWord(text, s))) {
            keywordFound = true;
            matchedKeywords.push(`${keyword} (syn)`);
          }
        }

        if (keywordFound) {
          // 3) Yoğunluk belirleyicileri
          const intensityMod = this.findIntensityModifier(text, keyword);
          totalIntensity = Math.max(totalIntensity, intensityMod);

          // 4) Negasyon bağlamı (yakın pencerede "değil", "yok", "hiç" ...)
          if (this.detectNegationContext(text, keyword)) {
            negationDetected = true;
            totalIntensity *= 0.3; // ters bağlamda kuvveti kır
          }
        }
      }

      if (matchedKeywords.length > 0) {
        if (repetitionMultiplier > 1.0) totalIntensity *= repetitionMultiplier;

        matches.push({
          ...pattern,
          matchedKeywords,
          intensity: totalIntensity,
          negationDetected
        });
      }
    }

    return matches;
  }

  /**
   * 🔄 Tekrar Detection - "çok çok", "aşırı aşırı" patterns
   */
  private detectRepetition(text: string): number {
    const repetitionPatterns = [
      /(\b\w+)\s+\1\b/gi, // "çok çok", "aşırı aşırı" 
      /(\b\w+)\s+(\w+)\s+\1\s+\2\b/gi, // "çok ama çok"
    ];

    let repetitionCount = 0;
    for (const pattern of repetitionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        repetitionCount += matches.length;
      }
    }

    // Her tekrar +0.2 multiplier
    return 1.0 + (repetitionCount * 0.2);
  }

  /**
   * ❌ Negatif bağlam detection - "mutlu değilim" 
   */
  private detectNegationContext(text: string, keyword: string): boolean {
    const rx = this.buildLemmaRegex(keyword);
    const m = rx.exec(text);
    if (!m) return false;

    const start = Math.max(0, (m.index ?? 0) - 40);
    const end   = Math.min(text.length, (m.index ?? 0) + m[0].length + 40);
    const window = text.slice(start, end);

    // "hiç … değil", "pek … değil", "yok", "asla" varyantları
    const negs = [
      /\bdeğil(\w*)\b/u, /\byok\b/u, /\bhiç\b/u, /\basla\b/u,
      /\bpek\b/u, /\bo kadar da\b/u, /\bkesinlikle değil\b/u
    ];

    // "değil" genelde sonradan gelir ama önce de çıkabilir
    return negs.some(rx => rx.test(window));
  }

  /**
   * 🎚️ Find intensity modifiers around keywords
   */
  private findIntensityModifier(text: string, keyword: string): number {
    const keywordIndex = text.indexOf(keyword);
    if (keywordIndex === -1) return 1.0;

    // Look for modifiers in 5 words before the keyword
    const beforeText = text.substring(Math.max(0, keywordIndex - 50), keywordIndex);
    const words = beforeText.split(' ');
    
    for (const word of words.slice(-5)) {
      if (this.intensityModifiers[word]) {
        return this.intensityModifiers[word];
      }
    }

    return 1.0;
  }

  /**
   * 📊 ADVANCED: Calculate mood metrics with contradiction detection
   */
  private calculateMoodMetrics(matches: PatternMatch[], text: string): {
    mood: number;
    energy: number;
    anxiety: number;
    totalIntensity: number;
  } {
    console.log('🔍 Advanced mood calculation starting...', { matchCount: matches.length });
    
    // 1️⃣ EXPLICIT DECLARATIONS (En yüksek öncelik)
    const explicitDeclarations = this.extractExplicitDeclarations(text);
    console.log('📣 Explicit declarations found:', explicitDeclarations);
    
    // 2️⃣ CONTRADICTION DETECTION
    const contradictions = this.detectContradictions(text, matches);
    console.log('⚡ Contradictions detected:', contradictions);
    
    // 3️⃣ INDEPENDENT METRIC SCORING
    const independentScores = this.calculateIndependentScores(matches, text, contradictions);
    console.log('🎯 Independent scores:', independentScores);
    
    // 4️⃣ MERGE WITH EXPLICIT DECLARATIONS (Priority override)
    const finalScores = this.mergeWithExplicitDeclarations(independentScores, explicitDeclarations);
    console.log('✅ Final mood metrics:', finalScores);
    
    const totalIntensity = matches.reduce((sum, m) => sum + m.intensity, 0) / Math.max(matches.length, 1);
    
    return {
      mood: finalScores.mood,
      energy: finalScores.energy,
      anxiety: finalScores.anxiety,
      totalIntensity
    };
  }

  /**
   * 📣 Extract explicit mood/energy/anxiety declarations
   * Examples: "modum yüksek", "enerjim düşük", "anksiyetem var"
   */
  private extractExplicitDeclarations(text: string): { mood?: number; energy?: number; anxiety?: number } {
    const t = text.toLowerCase();

    // 1) Sayısal ölçekler: 7/10, %70, "enerjim 8", "anksiyetem 3"
    const out: { mood?: number; energy?: number; anxiety?: number } = {};

    // x/10 kalıbı
    const scale = /(\b(mood|mod|moral|enerji|anksiyete|kaygı)\w*\b)[^\d]{0,6}(\b\d{1,2})\s*\/\s*(10)\b/u.exec(t);
    if (scale) {
      const v = Math.max(1, Math.min(10, parseInt(scale[3], 10)));
      const key = scale[2];
      if (/(mood|mod|moral)/.test(key)) out.mood = v;
      else if (/enerji/.test(key)) out.energy = v;
      else out.anxiety = v;
    }

    // %xx kalıbı (yaklaşık 1–10'a indirgeme)
    const pct = /(\b(mood|mod|moral|enerji|anksiyete|kaygı)\w*\b)[^\d]{0,6}%\s*(\d{1,3})\b/u.exec(t);
    if (pct) {
      const p = Math.max(0, Math.min(100, parseInt(pct[3], 10)));
      const v = Math.max(1, Math.min(10, Math.round(p / 10)));
      const key = pct[2];
      if (/(mood|mod|moral)/.test(key)) out.mood = v;
      else if (/enerji/.test(key)) out.energy = v;
      else out.anxiety = v;
    }

    // "enerjim 8", "anksiyetem 3", "moodum 6"
    const bare = /(\b(mood|mod|moral|enerji|anksiyet(e|em)|kaygı(m|mım|mım|mim)?)\b)[^\d]{0,6}(\d{1,2})\b/u.exec(t);
    if (bare) {
      const v = Math.max(1, Math.min(10, parseInt(bare[4], 10)));
      const key = bare[2];
      if (/(mood|mod|moral)/.test(key)) out.mood = v;
      else if (/enerji/.test(key)) out.energy = v;
      else out.anxiety = v;
    }

    // 2) Sözel açık beyanlar
    if (/\b(modum|moodum|moralim)\b.*\b(yüksek|iyi|çok iyi|süper|harika)\b/u.test(t)) out.mood = 8;
    else if (/\b(modum|moodum|moralim)\b.*\b(düşük|kötü|berbat|çok kötü|bozuk)\b/u.test(t)) out.mood = 3;
    else if (/\b(modum|moodum|moralim)\b.*\b(orta|normal|fena değil)\b/u.test(t)) out.mood = 5;

    if (/\benerji(m|im|me)\b.*\b(yok|düşük|sıfır|hiç|bitmiş|tükenmiş|az)\b/u.test(t)) out.energy = 2;
    else if (/\benerji(m|im|me)\b.*\b(yüksek|var|bol|çok|tam|dolu|iyi)\b/u.test(t)) out.energy = 8;
    else if (/\b(yorgun|bitkin|halsiz|tüken)\b.*\b(çok|aşırı|fazla)\b/u.test(t)) out.energy = 1;

    if (/\banksiyete(m|im|me)\b.*\b(yok|düşük|az|yok gibi)\b/u.test(t) || /\bkaygı\b.*\b(yok|az|düşük)\b/u.test(t)) out.anxiety = 2;
    else if (/\banksiyete(m|im|me)\b.*\b(var|yüksek|çok|fazla|bol)\b/u.test(t) || /\bkaygı\b.*\b(var|çok|yüksek)\b/u.test(t)) out.anxiety = 8;

    return out;
  }

  /**
   * ⚡ Detect contradictions in text using "ama, fakat, ancak" etc.
   */
  private detectContradictions(text: string, matches: PatternMatch[]): {
    hasContradictions: boolean;
    contradictionWords: string[];
    segments: string[];
  } {
    const contradictionKeywords = ['ama', 'fakat', 'ancak', 'lakin', 'ne var ki', 'yalnız', 'sadece', 'bununla birlikte'];
    const foundWords = contradictionKeywords.filter(word => text.toLowerCase().includes(word));
    
    let segments: string[] = [];
    if (foundWords.length > 0) {
      // Split text by contradiction words
      const pattern = new RegExp(`(${foundWords.join('|')})`, 'gi');
      segments = text.split(pattern).filter(s => s.trim().length > 3);
    }
    
    return {
      hasContradictions: foundWords.length > 0,
      contradictionWords: foundWords,
      segments: segments.length > 1 ? segments : [text]
    };
  }

  /**
   * 🎯 Calculate independent scores for each metric
   */
  private calculateIndependentScores(
    matches: PatternMatch[], 
    text: string,
    contradictions: any
  ): { mood: number; energy: number; anxiety: number } {
    
    // 🎯 NEW: Multi-axis contribution model
    // Each pattern contributes to ALL axes based on its impact values
    const moodScore = this.calculateAxisScore(matches, 'moodImpact', 5.0);     // Base: neutral
    const energyScore = this.calculateAxisScore(matches, 'energyImpact', 5.0); // Base: neutral  
    const anxietyScore = this.calculateAxisScore(matches, 'anxietyImpact', 4.0); // Base: slightly low
    
    console.log('🎯 Multi-axis scores calculated:', { 
      mood: moodScore, 
      energy: energyScore, 
      anxiety: anxietyScore,
      totalPatterns: matches.length 
    });
    
    return {
      mood: moodScore,
      energy: energyScore,
      anxiety: anxietyScore
    };
  }

  /**
   * 🎲 Calculate dominant signal for a specific metric
   */
  private calculateDominantSignal(patterns: PatternMatch[], impactField: string, baseline: number): number {
    if (patterns.length === 0) return baseline;
    
    // Find the pattern with highest weighted impact
    let maxImpact = 0;
    let dominantPattern = null;
    
    for (const pattern of patterns) {
      const impact = Math.abs((pattern as any)[impactField] * pattern.intensity * pattern.weight);
      if (impact > maxImpact) {
        maxImpact = impact;
        dominantPattern = pattern;
      }
    }
    
    if (dominantPattern) {
      const rawImpact = (dominantPattern as any)[impactField] * dominantPattern.intensity;
      // Convert to 1-10 scale
      return Math.max(1, Math.min(10, baseline + rawImpact));
    }
    
    return baseline;
  }

  /**
   * 🔗 Merge independent scores with explicit declarations (priority override)
   */
  private mergeWithExplicitDeclarations(
    independent: { mood: number; energy: number; anxiety: number },
    explicit: { mood?: number; energy?: number; anxiety?: number }
  ): { mood: number; energy: number; anxiety: number } {
    return {
      mood: explicit.mood !== undefined ? explicit.mood : independent.mood,
      energy: explicit.energy !== undefined ? explicit.energy : independent.energy,
      anxiety: explicit.anxiety !== undefined ? explicit.anxiety : independent.anxiety
    };
  }

  /**
   * 🔍 Extract entities (emotions, triggers, activities)
   */
  private extractEntities(matches: PatternMatch[], text: string): {
    dominantEmotion: string;
    triggers: string[];
    activities: string[];
    foundKeywords: string[];
    emotionSignals: string[];
  } {
    const emotions: { [key: string]: number } = {};
    const triggers: string[] = [];
    const activities: string[] = [];
    const foundKeywords: string[] = [];
    const emotionSignals: string[] = [];

    for (const match of matches) {
      foundKeywords.push(...match.matchedKeywords);

      if (match.emotion) {
        emotions[match.emotion] = (emotions[match.emotion] || 0) + match.weight;
        emotionSignals.push(...match.matchedKeywords);
      }

      if (match.trigger && !triggers.includes(match.trigger)) {
        // Extra validation for ekonomik_durum - ensure genuine economic content
        if (match.trigger === 'ekonomik_durum') {
          const ECON = /\b(ekonomi(k)?|para|bütçe|fatura(l[ae]r)?|kira|gelir|gider|harcama(l[ae]r)?|enflasyon|zam|pahalılık|geçim|maddi)\b/iu;
          if (ECON.test(text)) {
            triggers.push(match.trigger);
          }
        } else {
          triggers.push(match.trigger);
        }
      }

      if (match.activity && !activities.includes(match.activity)) {
        activities.push(match.activity);
      }
    }

    // Find dominant emotion
    const dominantEmotion = Object.keys(emotions).reduce((a, b) => 
      emotions[a] > emotions[b] ? a : b, Object.keys(emotions)[0] || 'nötr'
    );

    return {
      dominantEmotion,
      triggers,
      activities,
      foundKeywords: [...new Set(foundKeywords)], // Unique keywords
      emotionSignals: [...new Set(emotionSignals)]
    };
  }

  /**
   * 📊 ENHANCED Confidence calculation (v3.0)
   */
  private calculateConfidence(
    matches: PatternMatch[],
    transcriptionConfidence: number,
    textLength: number,
    rawText: string
  ): number {
    let confidence = transcriptionConfidence;

    // 1) Çeşitlilik
    const keywordCount = matches.reduce((s, m) => s + m.matchedKeywords.length, 0);
    const emotionCnt = matches.filter(m => m.emotion).length;
    const triggerCnt = matches.filter(m => m.trigger).length;
    const activityCnt = matches.filter(m => m.activity).length;
    const diversityScore = [emotionCnt, triggerCnt, activityCnt].filter(c => c > 0).length;
    const diversityBoost = Math.min(0.25, diversityScore * 0.08);

    // 2) Uzunluk (kök alma etkisini yumuşatmak için sqrt)
    const lengthFactor = Math.min(1.0, Math.sqrt(textLength / 50));

    // 3) Negasyon cezası
    const negationPenalty = matches.filter(m => m.negationDetected).length * 0.15;

    // 4) Belirsizlik cezası (BUG FIX: raw metinden bak)
    const uncertaintyPenalty = this.detectUncertaintyInRawText(rawText, textLength);

    // 5) Tutarlılık bonusları
    const consistencyBoost = this.calculatePatternConsistency(matches) + this.calculateIntensityConsistency(matches);

    confidence = confidence + diversityBoost + consistencyBoost;
    confidence *= lengthFactor;
    confidence -= (negationPenalty + uncertaintyPenalty);

    return Math.max(0.2, Math.min(0.95, confidence));
  }

  // Belirsizlik kelimeleri ham metinden
  private detectUncertaintyInRawText(rawText: string, textLength: number): number {
    const t = rawText.toLowerCase();
    let count = 0;
    for (const w of this.uncertaintyWords) {
      if (t.includes(w)) count++;
    }
    const textFactor = Math.max(0.5, textLength / 100);
    return (count * 0.1) / textFactor;
  }

  /**
   * 🎭 Belirsizlik detection - "galiba", "sanırım"
   */
  private detectUncertainty(matches: any[], textLength: number): number {
    let uncertaintyCount = 0;
    const fullText = matches.map(m => m.matchedKeywords.join(' ')).join(' ');
    
    for (const uncertainWord of this.uncertaintyWords) {
      if (fullText.includes(uncertainWord)) {
        uncertaintyCount++;
      }
    }
    
    // Longer text more forgiving of uncertainty
    const textFactor = Math.max(0.5, textLength / 100);
    return (uncertaintyCount * 0.1) / textFactor;
  }

  /**
   * 🔄 Pattern consistency - similar emotions reinforce each other
   */
  private calculatePatternConsistency(matches: PatternMatch[]): number {
    const emotionMatches = matches.filter(m => m.emotion);
    if (emotionMatches.length < 2) return 0;

    // Group emotions by sentiment
    const positiveEmotions = ['çok_mutlu', 'mutlu', 'umutlu', 'sakin', 'enerjik', 'kararlı', 'gururlu', 'heyecanlı'];
    const negativeEmotions = ['depresif', 'üzgün', 'kaygılı', 'panik', 'sinirli', 'öfkeli', 'yorgun', 'bitkin', 'suçlu', 'utanmış'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const match of emotionMatches) {
      if (positiveEmotions.includes(match.emotion)) positiveCount++;
      if (negativeEmotions.includes(match.emotion)) negativeCount++;
    }
    
    // Consistent emotions = higher confidence
    const dominantCount = Math.max(positiveCount, negativeCount);
    const totalCount = positiveCount + negativeCount;
    
    if (totalCount === 0) return 0;
    
    const consistency = dominantCount / totalCount;
    return consistency > 0.7 ? 0.1 : 0; // 70%+ consistency = bonus
  }

  /**
   * 🎚️ Intensity consistency check
   */
  private calculateIntensityConsistency(matches: PatternMatch[]): number {
    const highIntensityWords = ['inanılmaz', 'acayip', 'çılgın', 'deli gibi', 'aşırı'];
    const lowIntensityWords = ['biraz', 'az', 'hafif', 'eh işte'];
    
    let highIntensityCount = 0;
    let avgIntensity = 0;
    
    for (const match of matches) {
      avgIntensity += match.intensity || 1.0;
      
      for (const keyword of match.matchedKeywords) {
        if (highIntensityWords.some(w => keyword.includes(w))) {
          highIntensityCount++;
        }
      }
    }
    
    avgIntensity /= matches.length;
    
    // High intensity words with high avg intensity = consistent
    if (highIntensityCount > 0 && avgIntensity > 1.3) {
      return 0.1;
    }
    
    return 0;
  }

  /**
   * 🎯 Calculate axis score with multi-axis contribution model
   */
  private calculateAxisScore(
    patterns: PatternMatch[], 
    field: 'moodImpact' | 'energyImpact' | 'anxietyImpact', 
    baseline: number
  ): number {
    // Semantic saturation - aynı semantik kategori tekrarlarının ağırlığını azalt
    const categoryCount: Record<string, number> = {};
    
    const addWeighted = (score: number, delta: number, emotion: string) => {
      // Semantic categories
      let category = 'other';
      if (['mutlu', 'çok_mutlu', 'sevinçli', 'umutlu'].includes(emotion)) category = 'pozitif_valans';
      else if (['üzgün', 'depresif', 'mutsuz', 'kederli'].includes(emotion)) category = 'negatif_valans';
      else if (['kaygılı', 'endişeli', 'gergin', 'stresli'].includes(emotion)) category = 'kaygı';
      else if (['enerjik', 'aktif', 'dinamik', 'canlı'].includes(emotion)) category = 'enerji';
      
      const count = (categoryCount[category] = (categoryCount[category] || 0) + 1);
      const weight = 1 / Math.min(count, 4); // 1, 1/2, 1/3, 1/4 ... sonra sabit
      return score + delta * weight;
    };

    let sum = 0;
    for (const p of patterns) {
      const impact = (p as any)[field] || 0;
      const contribution = impact * p.intensity * p.weight;
      sum = addWeighted(sum, contribution, p.emotion || 'other');
    }
    const raw = baseline + sum;
    return Math.max(1, Math.min(10, raw)); // No rounding for micro-movements
  }

  /**
   * 🎯 Normalize score to 1-10 range (already calculated metrics)
   */
  private normalizeScore(value: number): number {
    // Metrics are already in 1-10 range, just clamp to ensure bounds
    return Math.max(1, Math.min(10, Math.round(value)));
  }

  /**
   * 🎚️ Determine intensity level
   */
  private determineIntensity(avgIntensity: number): 'low' | 'medium' | 'high' {
    if (avgIntensity >= 1.4) return 'high';
    if (avgIntensity >= 1.1) return 'medium';
    return 'low';
  }

  /**
   * 😊 Determine overall sentiment (1-10 scale)
   */
  private determineSentiment(moodScore: number): 'negative' | 'neutral' | 'positive' {
    if (moodScore >= 7) return 'positive';
    if (moodScore <= 4) return 'negative';
    return 'neutral';
  }

  /**
   * 🔄 Create default result for error cases
   */
  private createDefaultResult(notes: string, error?: string): MoodAnalysisResult {
    return {
      moodScore: 5,
      energyLevel: 5,
      anxietyLevel: 5,
      dominantEmotion: 'nötr',
      triggers: [],
      activities: [],
      notes,
      confidence: 0.3,
      analysisDetails: {
        keywords: [],
        emotionSignals: [],
        intensity: 'low',
        sentiment: 'neutral'
      }
    };
  }

  /**
   * 🧪 Test analysis with sample text
   */
  async testAnalysis(sampleText: string): Promise<MoodAnalysisResult> {
    const mockTranscription: TranscriptionResult = {
      text: sampleText,
      confidence: 0.9,
      duration: 3,
      language: 'tr-TR',
      success: true
    };

    return await this.analyzeMoodFromVoice(mockTranscription);
  }

  /**
   * 🎯 Final emotion picker with energy+anxiety combo logic
   */
  private pickFinalEmotion({mood, energy, anxiety}: {mood:number; energy:number; anxiety:number}): string {
    const nearNeutral = mood >= 4.5 && mood <= 5.5;
    if (nearNeutral) return 'nötr';
    
    // High energy + high anxiety combinations
    if (anxiety >= 8 && energy >= 7 && mood >= 6) return 'heyecanlı/gergin';
    if (anxiety >= 8 && mood <= 4) return 'kaygılı';
    
    // Clear positive/negative with low anxiety  
    if (mood >= 8 && anxiety <= 3) return 'mutlu';
    if (mood <= 3 && anxiety <= 5) return 'üzgün';
    
    // High energy states
    if (energy >= 8 && mood >= 6) return 'enerjik';
    
    // Default to mixed for complex states
    return 'karışık';
  }
}

// 🔧 Populate CONFIG with existing class data (STAGE 2 - Config Consolidation)
// This allows us to centralize config while maintaining all existing values
const tempInstance = new VoiceCheckInHeuristicService();

CONFIG.patterns = (tempInstance as any).moodPatterns || [];
CONFIG.intensityModifiers = (tempInstance as any).intensityModifiers || {};
CONFIG.crisis = (tempInstance as any).crisis || [];
CONFIG.synonymGroups = (tempInstance as any).synonymGroups || {};
CONFIG.negationWords = (tempInstance as any).negationWords || [];
CONFIG.uncertaintyWords = (tempInstance as any).uncertaintyWords || [];

if (DEBUG) console.log('🔧 CONFIG populated with', CONFIG.patterns.length, 'patterns and', Object.keys(CONFIG.intensityModifiers).length, 'intensity modifiers');

// Export singleton instance
const voiceCheckInHeuristicService = VoiceCheckInHeuristicService.getInstance();
export default voiceCheckInHeuristicService;

// Export types
export type { MoodAnalysisResult };
