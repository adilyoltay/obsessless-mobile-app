/**
 * 🧪 ObsessLess Sistem Sağlığı Test Raporu
 * Bu dosya, uygulamanın kritik veri akışı zincirini test eder
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import supabaseService from './services/supabase';
import { moodTracker } from './services/moodTrackingService';
import { erpService } from './services/erpService';
import { offlineSyncService } from './services/offlineSync';
import enhancedAIDataAggregator from './features/ai/pipeline/enhancedDataAggregation';

export interface SystemHealthReport {
  timestamp: string;
  checks: {
    authentication: boolean;
    profileCreation: boolean;
    onboarding: boolean;
    compulsionRecording: boolean;
    erpSessions: boolean;
    moodCheckin: boolean;
    offlineStorage: boolean;
    onlineSync: boolean;
    aiAnalysis: boolean;
    userSpecificKeys: boolean;
    dataStandardization: boolean;
  };
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const report: SystemHealthReport = {
    timestamp: new Date().toISOString(),
    checks: {
      authentication: false,
      profileCreation: false,
      onboarding: false,
      compulsionRecording: false,
      erpSessions: false,
      moodCheckin: false,
      offlineStorage: false,
      onlineSync: false,
      aiAnalysis: false,
      userSpecificKeys: false,
      dataStandardization: false,
    },
    errors: [],
    warnings: [],
    recommendations: [],
  };

  try {
    // 1. Authentication Check
    console.log('🔍 1. Authentication sistemini kontrol ediyorum...');
    try {
      const currentUser = supabaseService.getCurrentUser();
      if (currentUser) {
        report.checks.authentication = true;
        console.log('✅ Authentication çalışıyor. User ID:', currentUser.id);
      } else {
        report.warnings.push('Kullanıcı oturumu bulunamadı');
      }
    } catch (error) {
      report.errors.push(`Authentication hatası: ${error}`);
    }

    // 2. Profile & Onboarding Check
    console.log('🔍 2. Profil ve Onboarding verilerini kontrol ediyorum...');
    try {
      const userId = supabaseService.getCurrentUser()?.id;
      if (userId) {
        // Check onboarding completion
        const onboardingCompleted = await AsyncStorage.getItem(`ai_onboarding_completed_${userId}`);
        const userProfile = await AsyncStorage.getItem(`ai_user_profile_${userId}`);
        const treatmentPlan = await AsyncStorage.getItem(`ai_treatment_plan_${userId}`);
        
        if (onboardingCompleted === 'true') {
          report.checks.onboarding = true;
          console.log('✅ Onboarding tamamlanmış');
        } else {
          report.warnings.push('Onboarding tamamlanmamış');
        }
        
        if (userProfile) {
          report.checks.profileCreation = true;
          const profile = JSON.parse(userProfile);
          console.log('✅ Kullanıcı profili mevcut:', {
            hasName: !!profile.name,
            hasSymptoms: !!profile.ocdSymptoms,
            hasSeverity: !!profile.severity,
          });
        } else {
          report.warnings.push('Kullanıcı profili bulunamadı');
        }
      }
    } catch (error) {
      report.errors.push(`Profil/Onboarding hatası: ${error}`);
    }

    // 3. Kompulsiyon Kayıt Check
    console.log('🔍 3. Kompulsiyon kayıt sistemini kontrol ediyorum...');
    try {
      const userId = supabaseService.getCurrentUser()?.id;
      if (userId) {
        const compulsionsKey = `compulsions_${userId}`;
        const compulsions = await AsyncStorage.getItem(compulsionsKey);
        
        if (compulsions) {
          const data = JSON.parse(compulsions);
          report.checks.compulsionRecording = true;
          console.log(`✅ Kompulsiyon kayıtları mevcut: ${data.length} kayıt`);
        } else {
          report.warnings.push('Kompulsiyon kaydı bulunamadı');
        }
        
        // Check Supabase sync
        try {
          const remoteCompulsions = await supabaseService.getCompulsions(userId);
          console.log(`📊 Supabase'de ${remoteCompulsions.length} kompulsiyon kaydı var`);
        } catch (e) {
          report.warnings.push('Supabase kompulsiyon senkronizasyonu başarısız');
        }
      }
    } catch (error) {
      report.errors.push(`Kompulsiyon kayıt hatası: ${error}`);
    }

    // 4. ERP Sessions Check
    console.log('🔍 4. ERP oturum sistemini kontrol ediyorum...');
    try {
      const exercises = await erpService.getExercises();
      if (exercises && exercises.length > 0) {
        report.checks.erpSessions = true;
        console.log(`✅ ERP egzersizleri mevcut: ${exercises.length} egzersiz`);
      } else {
        report.warnings.push('ERP egzersizi bulunamadı');
      }
    } catch (error) {
      report.errors.push(`ERP sistem hatası: ${error}`);
    }

    // 5. Mood Check-in Check
    console.log('🔍 5. Mood check-in sistemini kontrol ediyorum...');
    try {
      const userId = supabaseService.getCurrentUser()?.id;
      if (userId) {
        const today = new Date().toISOString().split('T')[0];
        const moodKey = `mood_entries_${userId}_${today}`;
        const moodData = await AsyncStorage.getItem(moodKey);
        
        if (moodData) {
          report.checks.moodCheckin = true;
          const entries = JSON.parse(moodData);
          console.log(`✅ Bugünkü mood kayıtları: ${entries.length} kayıt`);
        } else {
          report.warnings.push('Bugün mood check-in yapılmamış');
        }
      }
    } catch (error) {
      report.errors.push(`Mood tracking hatası: ${error}`);
    }

    // 6. Offline Storage Check
    console.log('🔍 6. Offline depolama sistemini kontrol ediyorum...');
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userSpecificKeys = keys.filter(k => k.includes('_'));
      
      if (userSpecificKeys.length > 0) {
        report.checks.offlineStorage = true;
        report.checks.userSpecificKeys = true;
        console.log(`✅ Offline depolama çalışıyor: ${userSpecificKeys.length} kullanıcı anahtarı`);
        
        // Anahtar kategorileri
        const categories = {
          compulsions: keys.filter(k => k.includes('compulsions_')).length,
          mood: keys.filter(k => k.includes('mood_entries_')).length,
          erp: keys.filter(k => k.includes('erp_')).length,
          ai: keys.filter(k => k.includes('ai_')).length,
          sync: keys.filter(k => k.includes('sync')).length,
        };
        console.log('📊 Depolama kategorileri:', categories);
      } else {
        report.warnings.push('Kullanıcıya özel depolama anahtarı bulunamadı');
      }
    } catch (error) {
      report.errors.push(`Offline depolama hatası: ${error}`);
    }

    // 7. Online Sync Check
    console.log('🔍 7. Online senkronizasyon sistemini kontrol ediyorum...');
    try {
      const userId = supabaseService.getCurrentUser()?.id;
      if (userId) {
        const syncQueueKey = `syncQueue_${userId}`;
        const syncQueue = await AsyncStorage.getItem(syncQueueKey);
        
        if (syncQueue) {
          const queue = JSON.parse(syncQueue);
          if (queue.length > 0) {
            report.warnings.push(`${queue.length} adet senkronize edilmemiş veri var`);
            console.log(`⚠️ Sync kuyruğunda ${queue.length} öğe bekliyor`);
          } else {
            report.checks.onlineSync = true;
            console.log('✅ Tüm veriler senkronize');
          }
        } else {
          report.checks.onlineSync = true;
          console.log('✅ Sync kuyruğu temiz');
        }
        
        // Check last sync
        const lastSync = await AsyncStorage.getItem('last_sync_summary');
        if (lastSync) {
          const summary = JSON.parse(lastSync);
          console.log('📊 Son senkronizasyon:', summary);
        }
      }
    } catch (error) {
      report.errors.push(`Senkronizasyon hatası: ${error}`);
    }

    // 8. AI Analysis Pipeline Check
    console.log('🔍 8. AI analiz pipeline sistemini kontrol ediyorum...');
    try {
      const userId = supabaseService.getCurrentUser()?.id;
      if (userId) {
        const aggregatedData = await enhancedAIDataAggregator.aggregateComprehensiveData(userId);
        
        if (aggregatedData) {
          report.checks.aiAnalysis = true;
          console.log('✅ AI veri aggregation çalışıyor:', {
            hasProfile: !!aggregatedData.profile,
            hasSymptoms: !!aggregatedData.symptoms,
            hasPerformance: !!aggregatedData.performance,
            hasPatterns: !!aggregatedData.patterns,
            hasInsights: !!aggregatedData.insights,
            hasRecommendations: !!aggregatedData.recommendations,
          });
          
          // Check AI profile in Supabase
          try {
            const aiProfile = await supabaseService.getAIProfile(userId);
            if (aiProfile) {
              console.log('✅ Supabase AI profili mevcut');
            } else {
              report.warnings.push('Supabase AI profili bulunamadı');
            }
          } catch (e) {
            report.warnings.push('Supabase AI profil erişimi başarısız');
          }
        } else {
          report.warnings.push('AI veri aggregation başarısız');
        }
      }
    } catch (error) {
      report.errors.push(`AI analiz hatası: ${error}`);
    }

    // 9. Data Standardization Check
    console.log('🔍 9. Veri standardizasyonu kontrolü...');
    try {
      // Check if data standardization utilities exist
      const { default: dataStandardizer } = await import('./utils/dataStandardization');
      if (dataStandardizer) {
        report.checks.dataStandardization = true;
        console.log('✅ Veri standardizasyon servisi mevcut');
      }
    } catch (error) {
      report.errors.push(`Veri standardizasyon hatası: ${error}`);
    }

    // Generate Recommendations
    const totalChecks = Object.keys(report.checks).length;
    const passedChecks = Object.values(report.checks).filter(c => c).length;
    const healthScore = (passedChecks / totalChecks) * 100;

    console.log(`\n📊 GENEL SAĞLIK SKORU: ${healthScore.toFixed(1)}%`);
    console.log(`✅ Başarılı: ${passedChecks}/${totalChecks}`);
    console.log(`⚠️ Uyarılar: ${report.warnings.length}`);
    console.log(`❌ Hatalar: ${report.errors.length}`);

    // Add recommendations based on failures
    if (!report.checks.authentication) {
      report.recommendations.push('Kullanıcı girişi yapılmalı');
    }
    if (!report.checks.onboarding) {
      report.recommendations.push('Onboarding süreci tamamlanmalı');
    }
    if (!report.checks.compulsionRecording) {
      report.recommendations.push('En az bir kompulsiyon kaydı oluşturulmalı');
    }
    if (!report.checks.moodCheckin) {
      report.recommendations.push('Günlük mood check-in yapılmalı');
    }
    if (!report.checks.aiAnalysis) {
      report.recommendations.push('AI analiz sistemi aktifleştirilmeli');
    }
    if (report.warnings.some(w => w.includes('senkronize edilmemiş'))) {
      report.recommendations.push('Bekleyen veriler senkronize edilmeli');
    }

    // Save report
    await AsyncStorage.setItem('last_health_check', JSON.stringify(report));
    console.log('\n📄 Rapor kaydedildi: last_health_check');

  } catch (error) {
    report.errors.push(`Genel sistem hatası: ${error}`);
  }

  return report;
}

// Export for testing
export default {
  runSystemHealthCheck,
};