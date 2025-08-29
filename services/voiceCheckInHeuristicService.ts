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

class VoiceCheckInHeuristicService {
  private static instance: VoiceCheckInHeuristicService;
  
  // 🎯 ENHANCED Türkçe Mood Analiz Patterns (v2.0)
  private readonly moodPatterns: KeywordPattern[] = [
    // 😊 High Positive Patterns
    {
      keywords: ['çok mutlu', 'aşırı mutlu', 'son derece mutlu', 'harika', 'mükemmel', 'fantastik', 'muhteşem'],
      moodImpact: +5, energyImpact: +4, anxietyImpact: -3,
      emotion: 'çok_mutlu', weight: 1.3
    },
    {
      keywords: ['mutlu', 'neşeli', 'sevinçli', 'keyifli', 'güzel', 'süper', 'iyi hissediyorum', 'çok iyi', 'gayet iyi', 'oldukça iyi'],
      moodImpact: +3, energyImpact: +2, anxietyImpact: -2,
      emotion: 'mutlu', weight: 1.0
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
      keywords: ['enflasyon', 'zam', 'pahalılık', 'geçim', 'hayat pahalı'],
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

  // 🔗 Sinonim Eşleştirme Tablosu (NEW)
  private readonly synonymGroups: { [key: string]: string[] } = {
    'mutlu': ['sevinçli', 'neşeli', 'keyifli', 'memnun', 'hoşnut'],
    'üzgün': ['kederli', 'mahzun', 'buruk', 'hüzünlü', 'mutsuz'],
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

  static getInstance(): VoiceCheckInHeuristicService {
    if (!VoiceCheckInHeuristicService.instance) {
      VoiceCheckInHeuristicService.instance = new VoiceCheckInHeuristicService();
    }
    return VoiceCheckInHeuristicService.instance;
  }

  /**
   * 🎯 Ana analiz fonksiyonu - Speech-to-text sonucunu mood verisine çevirir
   */
  async analyzeMoodFromVoice(
    transcriptionResult: TranscriptionResult
  ): Promise<MoodAnalysisResult> {
    console.log('🧠 Starting heuristic mood analysis...', {
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
        text.length
      );

      // 6. Build result
      const result: MoodAnalysisResult = {
        moodScore: this.normalizeScore(metrics.mood, 5), // Base 5, range 1-10
        energyLevel: this.normalizeScore(metrics.energy, 5),
        anxietyLevel: this.normalizeScore(metrics.anxiety, 5),
        dominantEmotion: entities.dominantEmotion || 'nötr',
        triggers: entities.triggers,
        activities: entities.activities,
        notes: transcriptionResult.text, // Original text
        confidence,
        analysisDetails: {
          keywords: entities.foundKeywords,
          emotionSignals: entities.emotionSignals,
          intensity: this.determineIntensity(metrics.totalIntensity),
          sentiment: this.determineSentiment(metrics.mood)
        }
      };

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
  private findPatternMatches(text: string): Array<KeywordPattern & { matchedKeywords: string[]; intensity: number }> {
    const matches: Array<KeywordPattern & { matchedKeywords: string[]; intensity: number }> = [];
    
    // 🔄 TEKRAR DETECTION: "çok çok mutlu", "aşırı aşırı üzgün"
    const repetitionMultiplier = this.detectRepetition(text);

    for (const pattern of this.moodPatterns) {
      const matchedKeywords: string[] = [];
      let totalIntensity = 1.0;
      let negationDetected = false;

      // Check each keyword in pattern (+ sinonim eşleştirme)
      for (const keyword of pattern.keywords) {
        let keywordFound = false;
        
        // 1. Direct match
        if (text.includes(keyword)) {
          keywordFound = true;
          matchedKeywords.push(keyword);
        }
        
        // 2. 🔗 SINONIM EŞLEŞTIRME
        if (!keywordFound) {
          for (const [baseWord, synonyms] of Object.entries(this.synonymGroups)) {
            if (keyword === baseWord) {
              for (const synonym of synonyms) {
                if (text.includes(synonym)) {
                  keywordFound = true;
                  matchedKeywords.push(`${keyword} (${synonym})`);
                  break;
                }
              }
            }
            if (keywordFound) break;
          }
        }

        if (keywordFound) {
          // 3. 🎚️ INTENSITY MODIFIERS
          const intensityMod = this.findIntensityModifier(text, keyword);
          totalIntensity = Math.max(totalIntensity, intensityMod);

          // 4. ❌ NEGATIF BAĞLAM ALGILAMA
          const hasNegation = this.detectNegationContext(text, keyword);
          if (hasNegation) {
            negationDetected = true;
            totalIntensity *= 0.3; // Negatif bağlamda çok düşük etki
          }
        }
      }

      if (matchedKeywords.length > 0) {
        // 5. 🔄 TEKRAR MULTIPLIER uygula
        if (repetitionMultiplier > 1.0) {
          totalIntensity *= repetitionMultiplier;
        }

        matches.push({
          ...pattern,
          matchedKeywords,
          intensity: totalIntensity,
          negationDetected
        } as any);
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
    const keywordIndex = text.indexOf(keyword);
    if (keywordIndex === -1) return false;

    // Keyword'den sonraki 10 kelimeye bak
    const afterText = text.substring(keywordIndex, keywordIndex + 50);
    const beforeText = text.substring(Math.max(0, keywordIndex - 30), keywordIndex);

    for (const negation of this.negationWords) {
      if (afterText.includes(negation) || beforeText.includes(negation)) {
        return true;
      }
    }

    return false;
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
   * 📊 Calculate mood metrics from pattern matches
   */
  private calculateMoodMetrics(matches: Array<KeywordPattern & { intensity: number }>, text: string): {
    mood: number;
    energy: number;
    anxiety: number;
    totalIntensity: number;
  } {
    let moodSum = 0;
    let energySum = 0;
    let anxietySum = 0;
    let totalWeight = 0;
    let totalIntensity = 0;

    for (const match of matches) {
      const weight = match.weight * match.intensity;
      
      moodSum += match.moodImpact * weight;
      energySum += match.energyImpact * weight;
      anxietySum += match.anxietyImpact * weight;
      totalWeight += weight;
      totalIntensity += match.intensity;
    }

    // Normalize by total weight, or use defaults if no matches
    if (totalWeight === 0) {
      return { mood: 0, energy: 0, anxiety: 0, totalIntensity: 1 };
    }

    return {
      mood: moodSum / totalWeight,
      energy: energySum / totalWeight,
      anxiety: anxietySum / totalWeight,
      totalIntensity: totalIntensity / matches.length
    };
  }

  /**
   * 🔍 Extract entities (emotions, triggers, activities)
   */
  private extractEntities(matches: Array<KeywordPattern & { matchedKeywords: string[] }>, text: string): {
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
        triggers.push(match.trigger);
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
    matches: Array<KeywordPattern & { matchedKeywords: string[]; negationDetected?: boolean }>,
    transcriptionConfidence: number,
    textLength: number
  ): number {
    // Base confidence from transcription
    let confidence = transcriptionConfidence;

    // 1. 🔤 KEYWORD DIVERSITY (different groups > same group repeats)
    const keywordCount = matches.reduce((sum, match) => sum + match.matchedKeywords.length, 0);
    const emotionKeywords = matches.filter(m => m.emotion).length;
    const triggerKeywords = matches.filter(m => m.trigger).length;
    const activityKeywords = matches.filter(m => m.activity).length;
    
    // Çeşitlilik > Tekrar
    const diversityScore = [emotionKeywords, triggerKeywords, activityKeywords].filter(c => c > 0).length;
    const diversityBoost = Math.min(0.25, diversityScore * 0.08); // More categories = higher confidence
    
    // 2. 📏 TEXT LENGTH FACTOR (longer = more reliable)
    const lengthFactor = Math.min(1.0, Math.sqrt(textLength / 50)); // Square root for diminishing returns
    
    // 3. ❌ NEGATION PENALTY
    const negationCount = matches.filter(m => m.negationDetected).length;
    const negationPenalty = negationCount * 0.15; // Each negation -0.15 confidence
    
    // 4. 🎭 UNCERTAINTY DETECTION
    const uncertaintyPenalty = this.detectUncertainty(matches, textLength);
    
    // 5. 🔄 PATTERN CONSISTENCY (similar patterns reinforce each other)
    const consistencyBoost = this.calculatePatternConsistency(matches);
    
    // 6. 🎚️ INTENSITY CONSISTENCY (extreme words need high intensity)
    const intensityConsistency = this.calculateIntensityConsistency(matches);
    
    // Combine all factors
    confidence = confidence + diversityBoost + consistencyBoost + intensityConsistency;
    confidence *= lengthFactor;
    confidence -= (negationPenalty + uncertaintyPenalty);
    
    // Bounds: 0.2 - 0.95
    return Math.max(0.2, Math.min(0.95, confidence));
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
  private calculatePatternConsistency(matches: any[]): number {
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
  private calculateIntensityConsistency(matches: any[]): number {
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
   * 🎯 Normalize score to 1-10 range
   */
  private normalizeScore(value: number, baseline: number): number {
    const adjusted = baseline + value;
    return Math.max(1, Math.min(10, Math.round(adjusted)));
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
   * 😊 Determine overall sentiment
   */
  private determineSentiment(moodScore: number): 'negative' | 'neutral' | 'positive' {
    if (moodScore >= 1) return 'positive';
    if (moodScore <= -1) return 'negative';
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
}

// Export singleton instance
const voiceCheckInHeuristicService = VoiceCheckInHeuristicService.getInstance();
export default voiceCheckInHeuristicService;

// Export types
export type { MoodAnalysisResult };
