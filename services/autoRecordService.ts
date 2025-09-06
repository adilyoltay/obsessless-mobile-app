/**
 * Otomatik Kayıt Servisi
 * Ses analizi sonuçlarına göre otomatik kayıt önerileri oluşturur
 */

import { UnifiedAnalysisResult } from '@/features/ai-fallbacks/checkinService';
import supabaseService from '@/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineSyncService } from '@/services/offlineSync';
import * as Haptics from 'expo-haptics';
import * as pipeline from '@/features/ai-fallbacks/pipeline';

interface AutoRecordData {
  type: 'MOOD';
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

    // Removed ERP case

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

// (Removed) ERP kategorisini tespit eder
// (Removed) detectERPCategory function

// (Removed) Terapi egzersizi önerir
// ✅ REMOVED: suggestERPExercise function - ERP module deleted
// ✅ REMOVED: suggestERPExercise function - ERP module deleted

/**
 * Otomatik kaydı veritabanına kaydeder
 */
export async function saveAutoRecord(
  recordType: 'MOOD',
  data: any
): Promise<{ success: boolean; error?: string; recordId?: string }> {
  try {
    // Idempotency key: user + type + timestamp rounded to minute + hash of content
    const idempotencyKey = `${data.userId || 'anon'}_${recordType}_${new Date(data.timestamp || Date.now()).toISOString().slice(0,16)}_${(data.thought || data.category || data.notes || '').toString().slice(0,32)}`;
    try {
      const existing = await AsyncStorage.getItem(`idemp_${idempotencyKey}`);
      if (existing) {
        console.log('🛡️ Idempotency: duplicate auto-record suppressed');
        return { success: true };
      }
    } catch {}
    let savedRecord;
    switch (recordType) {
      case 'MOOD':
        console.log('📝 Saving MOOD entry:', data);
        {
          const { sanitizePII } = await import('@/utils/privacy');
          savedRecord = await supabaseService.saveMoodEntry({
            user_id: data.userId,
            mood_score: data.mood,
            energy_level: data.energy,
            anxiety_level: data.anxiety,
            notes: sanitizePII(data.notes || ''),
          });
        }
        console.log('✅ MOOD entry saved:', savedRecord);
        break;
    }

    // Gamification - handled in the component that calls this service
    // await awardMicroReward('auto_record');
    // await updateStreak();
    
    // Persist idempotency marker (best-effort)
    try { await AsyncStorage.setItem(`idemp_${idempotencyKey}`, '1'); } catch {}

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // 🗑️ Invalidate AI cache based on record type
    switch (recordType) {
      case 'MOOD':
        pipeline.triggerInvalidation('mood_added', data.userId);
        break;
    }
    
    return { success: true, recordId: savedRecord?.id };
  } catch (error) {
    console.error('Auto record save failed:', error);
    
    // Offline queue'ya ekle
    try {
      // Map camelCase to snake_case for offline sync compatibility
      let entity: 'mood_entry' = 'mood_entry';
      let mapped: any = {};
      if (recordType === 'MOOD') {
        entity = 'mood_entry';
        const { sanitizePII } = await import('@/utils/privacy');
        mapped = {
          user_id: data.userId,
          mood_score: data.mood != null ? data.mood : 50, // FIXED: explicit null check
          energy_level: data.energy || 5,
          anxiety_level: data.anxiety || 5,
          notes: sanitizePII(data.notes || ''),
          trigger: data.trigger || ''
        };
      }

      await offlineSyncService.addToSyncQueue({
        type: 'CREATE',
        entity,
        data: mapped,
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
  
  // ✅ REMOVED: ERP type check - ERP module deleted
  
  // Güven eşiği kontrolü - Production
  const SHOW_THRESHOLD = 0.8; // Üretim değeri
  const shouldShow = analysis.confidence >= SHOW_THRESHOLD;
  console.log(`📊 Confidence ${analysis.confidence} vs threshold ${SHOW_THRESHOLD}: ${shouldShow}`);
  return shouldShow;
}
