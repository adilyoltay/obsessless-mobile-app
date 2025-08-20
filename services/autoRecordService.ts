/**
 * Otomatik Kayıt Servisi
 * Ses analizi sonuçlarına göre otomatik kayıt önerileri oluşturur
 */

import { UnifiedAnalysisResult } from '@/features/ai/services/checkinService';
import supabaseService from '@/services/supabase';
import { offlineSyncService } from '@/services/offlineSync';
import * as Haptics from 'expo-haptics';

interface AutoRecordData {
  type: 'OCD' | 'CBT' | 'MOOD' | 'ERP';
  data: any;
  confidence: number;
  shouldAutoSave: boolean;
}

/**
 * Analiz sonucunu otomatik kayıt verisine dönüştürür
 */
export function prepareAutoRecord(
  analysis: UnifiedAnalysisResult,
  userId: string
): AutoRecordData | null {
  
  // Güven eşiği - Yüksek güven = otomatik kayıt
  const CONFIDENCE_THRESHOLD = 0.8; // Yüksek güven gerekli
  
  console.log('📊 prepareAutoRecord - confidence check:', {
    analysisConfidence: analysis.confidence,
    threshold: CONFIDENCE_THRESHOLD,
    willPrepare: analysis.confidence >= CONFIDENCE_THRESHOLD
  });
  
  if (analysis.confidence < CONFIDENCE_THRESHOLD) {
    console.log('📊 Confidence not high enough for auto record, will redirect to form');
    return null;
  }

  switch (analysis.type) {
    case 'OCD':
      return {
        type: 'OCD',
        data: {
          userId,
          category: analysis.category || 'other',
          resistanceLevel: estimateResistanceLevel(analysis.originalText),
          trigger: analysis.trigger || '',
          notes: '',
          timestamp: new Date().toISOString(),
        },
        confidence: analysis.confidence,
        shouldAutoSave: analysis.confidence >= 0.85,
      };

    case 'CBT':
      return {
        type: 'CBT',
        data: {
          userId,
          thought: analysis.originalText,
          distortionType: detectDistortionType(analysis.originalText),
          emotions: '',
          reframe: '',
          moodBefore: 50,
          moodAfter: 50,
          timestamp: new Date().toISOString(),
        },
        confidence: analysis.confidence,
        shouldAutoSave: false, // CBT her zaman kullanıcı düzenlemeli
      };

    case 'MOOD':
      return {
        type: 'MOOD',
        data: {
          userId,
          mood: analysis.mood || 50,
          energy: estimateEnergyLevel(analysis.originalText),
          anxiety: estimateAnxietyLevel(analysis.originalText),
          trigger: analysis.trigger || '',
          notes: '',
          timestamp: new Date().toISOString(),
        },
        confidence: analysis.confidence,
        shouldAutoSave: analysis.confidence >= 0.8,
      };

    case 'ERP':
      return {
        type: 'ERP',
        data: {
          userId,
          category: analysis.category || detectERPCategory(analysis.originalText),
          suggestedExercise: suggestERPExercise(analysis.originalText),
        },
        confidence: analysis.confidence,
        shouldAutoSave: false, // ERP yönlendirme yapılacak
      };

    default:
      return null;
  }
}

/**
 * OCD direnç seviyesini tahmin eder
 */
function estimateResistanceLevel(text: string): number {
  const lower = text.toLowerCase();
  
  // Yüksek direnç göstergeleri
  if (/başardım|dirençli|güçlü|kontrol.*ettim|yapma.*dım/i.test(lower)) {
    return 7 + Math.floor(Math.random() * 3); // 7-9
  }
  
  // Orta direnç
  if (/zorlandım|biraz|kısmen|yarım/i.test(lower)) {
    return 4 + Math.floor(Math.random() * 3); // 4-6
  }
  
  // Düşük direnç
  if (/yapamadım|mecbur|zorunda|duramadım|başaramadım/i.test(lower)) {
    return 1 + Math.floor(Math.random() * 3); // 1-3
  }
  
  return 5; // Varsayılan orta seviye
}

/**
 * Enerji seviyesini tahmin eder
 */
function estimateEnergyLevel(text: string): number {
  const lower = text.toLowerCase();
  
  if (/enerjik|dinç|güçlü|dinamik|canlı/i.test(lower)) {
    return 7 + Math.floor(Math.random() * 3); // 7-9
  }
  
  if (/yorgun|bitkin|tükenmiş|güçsüz|halsiz/i.test(lower)) {
    return 2 + Math.floor(Math.random() * 3); // 2-4
  }
  
  return 5; // Varsayılan orta
}

/**
 * Anksiyete seviyesini tahmin eder
 */
function estimateAnxietyLevel(text: string): number {
  const lower = text.toLowerCase();
  
  if (/endişeli|kaygılı|gergin|stresli|panik|korkuyor/i.test(lower)) {
    return 6 + Math.floor(Math.random() * 4); // 6-9
  }
  
  if (/sakin|rahat|huzurlu|dingin/i.test(lower)) {
    return 1 + Math.floor(Math.random() * 3); // 1-3
  }
  
  return 5; // Varsayılan orta
}

/**
 * Bilişsel çarpıtma tipini tespit eder
 */
function detectDistortionType(text: string): string {
  const lower = text.toLowerCase();
  
  if (/ya.*olursa|kesin.*olacak|felaket|mahvol/i.test(lower)) {
    return 'catastrophizing';
  }
  
  if (/asla|her zaman|hiçbir zaman|hep|daima/i.test(lower)) {
    return 'overgeneralization';
  }
  
  if (/herkes.*düşünüyor|benden.*nefret|beni.*sevmiyor/i.test(lower)) {
    return 'mind_reading';
  }
  
  if (/ben.*başarısız|ben.*aptal|ben.*değersiz/i.test(lower)) {
    return 'labeling';
  }
  
  if (/yapmalıyım|etmeliyim|zorundayım|mecburum/i.test(lower)) {
    return 'should_statements';
  }
  
  if (/benim.*yüzümden|benim.*suçum|ben.*sebep/i.test(lower)) {
    return 'personalization';
  }
  
  return 'other';
}

/**
 * ERP kategorisini tespit eder
 */
function detectERPCategory(text: string): string {
  const lower = text.toLowerCase();
  
  if (/temiz|mikrop|kirli|bulaş|yıka/i.test(lower)) {
    return 'contamination';
  }
  
  if (/kontrol|emin|kapat|kilitle/i.test(lower)) {
    return 'checking';
  }
  
  if (/simetri|düzen|yerleştir/i.test(lower)) {
    return 'symmetry';
  }
  
  return 'general';
}

/**
 * ERP egzersizi önerir
 */
function suggestERPExercise(text: string): string {
  const category = detectERPCategory(text);
  
  const exercises: Record<string, string[]> = {
    contamination: [
      'Kirli yüzeye dokunma',
      'El yıkamayı geciktirme',
      'Dezenfektan kullanmama',
    ],
    checking: [
      'Kapıyı kontrol etmeme',
      'Ocağı bir kere kontrol',
      'Telefonu kontrol etmeme',
    ],
    symmetry: [
      'Eşyaları düzensiz bırakma',
      'Asimetrik yerleştirme',
      'Düzeni bozma',
    ],
    general: [
      'Genel maruz kalma',
      'Kompulsiyonu erteleme',
      'Direnç gösterme',
    ],
  };
  
  const categoryExercises = exercises[category] || exercises.general;
  return categoryExercises[Math.floor(Math.random() * categoryExercises.length)];
}

/**
 * Otomatik kaydı veritabanına kaydeder
 */
export async function saveAutoRecord(
  recordType: 'OCD' | 'CBT' | 'MOOD',
  data: any
): Promise<{ success: boolean; error?: string; recordId?: string }> {
  try {
    let savedRecord;
    switch (recordType) {
      case 'OCD':
        console.log('📝 Saving OCD compulsion:', data);
        savedRecord = await supabaseService.saveCompulsion({
          user_id: data.userId,
          category: data.category,
          subcategory: data.category,
          resistance_level: data.resistanceLevel,
          trigger: data.trigger,
          notes: data.notes,
        });
        console.log('✅ OCD compulsion saved:', savedRecord);
        break;

      case 'CBT':
        console.log('📝 Saving CBT record:', data);
        savedRecord = await supabaseService.saveCBTRecord({
          user_id: data.userId,
          thought: data.thought,
          distortions: [data.distortionType],
          evidence_for: '',
          evidence_against: '',
          reframe: data.reframe || '',
          mood_before: data.moodBefore,
          mood_after: data.moodAfter,
          trigger: '',
          notes: '',
        });
        console.log('✅ CBT record saved:', savedRecord);
        break;

      case 'MOOD':
        console.log('📝 Saving MOOD entry:', data);
        savedRecord = await supabaseService.saveMoodEntry({
          user_id: data.userId,
          mood_score: data.mood,
          energy_level: data.energy,
          anxiety_level: data.anxiety,
          notes: data.notes,
        });
        console.log('✅ MOOD entry saved:', savedRecord);
        break;
    }

    // Gamification - handled in the component that calls this service
    // await awardMicroReward('auto_record');
    // await updateStreak();
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    return { success: true, recordId: savedRecord?.id };
  } catch (error) {
    console.error('Auto record save failed:', error);
    
    // Offline queue'ya ekle
    try {
      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity: recordType === 'OCD' ? 'compulsion' : 
                recordType === 'CBT' ? 'thought_record' : 
                'mood_entry',
        data,
      });
      
      return { success: true };
    } catch (syncError) {
      console.error('Failed to add to offline queue:', syncError);
      return { 
        success: false, 
        error: 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.' 
      };
    }
  }
}

/**
 * Otomatik kayıt önerisinin kullanıcıya gösterilip gösterilmeyeceğini belirler
 */
export function shouldShowAutoRecord(
  analysis: UnifiedAnalysisResult,
  userPreferences?: { autoRecordEnabled?: boolean }
): boolean {
  console.log('📊 shouldShowAutoRecord called with:', {
    type: analysis.type,
    confidence: analysis.confidence,
    hasOriginalText: !!analysis.originalText
  });
  
  // Kullanıcı tercihi kapalıysa gösterme
  if (userPreferences?.autoRecordEnabled === false) {
    console.log('📊 Auto record disabled by user preference');
    return false;
  }
  
  // ERP her zaman göster (yönlendirme için)
  if (analysis.type === 'ERP') {
    console.log('📊 Showing auto record for ERP');
    return true;
  }
  
  // Güven eşiği kontrolü - TEST için düşük ayarlandı
  const SHOW_THRESHOLD = 0.3; // Normalde 0.65
  const shouldShow = analysis.confidence >= SHOW_THRESHOLD;
  console.log(`📊 Confidence ${analysis.confidence} vs threshold ${SHOW_THRESHOLD}: ${shouldShow}`);
  return shouldShow;
}
