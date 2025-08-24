/**
 * 📋 Tedavi Planı Detay Sayfası
 * 
 * Kullanıcının kişiselleştirilmiş tedavi planının detaylı görünümü
 * Settings ekranından erişilebilir
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSecureStorage } from '@/hooks/useSecureStorage';
// Conditional imports for expo-print (requires dev client rebuild)
let Print: any = null;
let Sharing: any = null;

try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
} catch (error) {
  console.warn('⚠️ expo-print or expo-sharing not available in development build:', error);
}

// AI Components
import { TreatmentPlanPreview } from '@/features/ai/components/onboarding/TreatmentPlanPreview';
import treatmentPlanningEngine from '@/features/ai/engines/treatmentPlanningEngine';

// Types
import {
  UserProfile,
  TreatmentPlan,
} from '@/features/ai/types';

// Hooks
import { useAuth } from '@/contexts/SupabaseAuthContext';

export default function TreatmentPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUpdates, setHasUpdates] = useState(false);
  const { getItem: secureGet, setItem: secureSet } = useSecureStorage();

  useEffect(() => {
    loadTreatmentData();
  }, []);

  const loadTreatmentData = async () => {
    try {
      setIsLoading(true);

      const uid = user?.id;

      // Profil: secure -> user-scoped legacy -> global
      let profile: UserProfile | null = null;
      if (uid) {
        profile = await secureGet<UserProfile>(`ai_user_profile_${uid}`, true);
        if (!profile) {
          const legacyPlain = await AsyncStorage.getItem(`ai_user_profile_${uid}`);
          profile = legacyPlain ? JSON.parse(legacyPlain) : null;
        }
      }
      if (!profile) {
        const plain = await AsyncStorage.getItem('ai_user_profile');
        profile = plain ? JSON.parse(plain) : null;
      }
      if (profile) setUserProfile(profile);

      // Plan: secure -> user-scoped legacy -> global
      let plan: TreatmentPlan | null = null;
      if (uid) {
        plan = await secureGet<TreatmentPlan>(`ai_treatment_plan_${uid}`, true);
        if (!plan) {
          const legacyPlanPlain = await AsyncStorage.getItem(`ai_treatment_plan_${uid}`);
          plan = legacyPlanPlain ? JSON.parse(legacyPlanPlain) : null;
        }
      }
      if (!plan) {
        const plainPlan = await AsyncStorage.getItem('ai_treatment_plan');
        plan = plainPlan ? JSON.parse(plainPlan) : null;
      }

      // Plan yoksa ama profil varsa otomatik oluştur
      if (!plan && profile) {
        const newPlan = await generateTreatmentPlan(profile);
        if (newPlan) {
          plan = newPlan;
          if (uid) {
            await secureSet(`ai_treatment_plan_${uid}`, newPlan, true);
            const summary = {
              id: newPlan.id || 'plan_1',
              currentPhase: newPlan.phases?.[0]?.type || 'assessment',
              phaseName: newPlan.phases?.[0]?.name || 'Değerlendirme',
              progress: 0.15,
              totalPhases: newPlan.phases?.length || 5,
              estimatedWeeks: Math.ceil(newPlan.estimatedDuration / 7) || 12,
              lastUpdated: newPlan.createdAt || new Date().toISOString()
            } as any;
            await AsyncStorage.setItem(`treatment_plan_summary_${uid}`, JSON.stringify(summary));
          } else {
            await AsyncStorage.setItem('ai_treatment_plan', JSON.stringify(newPlan));
          }
        }
      }

      if (plan) setTreatmentPlan(plan);
    } catch (error) {
      console.error('Error loading treatment data:', error);
      Alert.alert('Hata', 'Tedavi planı yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateTreatmentPlan = async (profile: UserProfile): Promise<TreatmentPlan | null> => {
    try {
      const plan = await treatmentPlanningEngine.generateTreatmentPlan(profile);
      return plan;
    } catch (error) {
      console.error('Error generating treatment plan:', error);
      return null;
    }
  };

  const handleUpdatePlan = async () => {
    Alert.alert(
      'Planı Güncelle',
      'Tedavi planınızı güncel verilerinize göre yenilemek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Güncelle',
          onPress: async () => {
            setIsLoading(true);
            try {
              if (userProfile) {
                const newPlan = await generateTreatmentPlan(userProfile);
                if (newPlan) {
                  setTreatmentPlan(newPlan);
                  if (user?.id) {
                    await secureSet(`ai_treatment_plan_${user.id}`, newPlan, true);
                    // Özet bilgileri de güncelle (user-scoped)
                    const summary = {
                      id: newPlan.id || 'plan_1',
                      currentPhase: newPlan.phases?.[0]?.type || 'assessment',
                      phaseName: newPlan.phases?.[0]?.name || 'Değerlendirme',
                      progress: 0.15,
                      totalPhases: newPlan.phases?.length || 5,
                      estimatedWeeks: Math.ceil(newPlan.estimatedDuration / 7) || 12,
                      lastUpdated: newPlan.createdAt || new Date().toISOString()
                    } as any;
                    await AsyncStorage.setItem(`treatment_plan_summary_${user.id}`, JSON.stringify(summary));
                  } else {
                    await AsyncStorage.setItem('ai_treatment_plan', JSON.stringify(newPlan));
                  }
                  
                  Alert.alert('Başarılı', 'Tedavi planınız güncellendi.');
                  setHasUpdates(false);
                }
              }
            } catch (error) {
              console.error('Error updating plan:', error);
              Alert.alert('Hata', 'Plan güncellenirken bir hata oluştu.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleExportPlan = async () => {
    try {
      console.log('📄 Starting treatment plan PDF export...');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Check if expo-print is available
      if (!Print || !Sharing) {
        Alert.alert(
          'Özellik Kullanılamıyor',
          'PDF export özelliği şu anda development build\'de mevcut değil. Production build\'de çalışacaktır.',
          [
            {
              text: 'Tamam',
              style: 'default'
            },
            {
              text: 'Detayları Göster',
              style: 'default',
              onPress: () => {
                Alert.alert(
                  'Teknik Detaylar',
                  'Bu özellik expo-print native modülünü gerektirir. Development client\'ı yeniden build etmeniz gerekiyor:\n\n1. expo install expo-print\n2. expo run:ios\n\nVeya production build\'de kullanabilirsiniz.'
                );
              }
            }
          ]
        );
        return;
      }

      if (!treatmentPlan || !userProfile) {
        Alert.alert('Hata', 'Tedavi planı verileriniz eksik. Lütfen önce planınızı güncelleyin.');
        return;
      }

      // Generate HTML content for PDF
      const htmlContent = generateTreatmentPlanHTML(treatmentPlan, userProfile);
      
      // Create PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 612, // A4 width in points
        height: 792, // A4 height in points
      });

      console.log('✅ PDF created successfully:', uri);

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        // Share the PDF
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Tedavi Planınızı Paylaşın',
          UTI: 'com.adobe.pdf',
        });
        
        console.log('📤 PDF shared successfully');
      } else {
        // Fallback: Show alert with file location
        Alert.alert(
          'PDF Oluşturuldu',
          `Tedavi planınız PDF olarak oluşturuldu.\n\nDosya konumu: ${uri}`,
          [
            { text: 'Tamam', style: 'default' }
          ]
        );
      }

    } catch (error) {
      console.error('❌ Failed to export treatment plan as PDF:', error);
      Alert.alert(
        'Hata', 
        'PDF oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
      );
    }
  };

  /**
   * Generate HTML content for treatment plan PDF
   */
  const generateTreatmentPlanHTML = (plan: TreatmentPlan, profile: UserProfile): string => {
    const currentDate = new Date().toLocaleDateString('tr-TR');
    
    // Extract user details safely
    const userName = profile.name || 'Kullanıcı';
    const userAge = profile.age || '';
    const symptoms = profile.symptoms?.join(', ') || 'Belirtilmedi';
    const severity = profile.severity || 'Belirtilmedi';
    
    // Extract plan details
    const planTitle = plan.title || 'Kişiselleştirilmiş Tedavi Planı';
    const planDescription = plan.description || 'Bu plan sizin özel durumunuz için hazırlanmıştır.';
    const phases = plan.phases || [];
    const goals = plan.goals || [];
    const recommendations = plan.recommendations || [];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${planTitle}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 20px;
            color: #333;
            background: #fff;
          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid #10B981;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .header h1 {
            color: #10B981;
            font-size: 24px;
            margin: 0 0 10px 0;
          }
          
          .header p {
            color: #6B7280;
            margin: 0;
            font-size: 14px;
          }
          
          .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          
          .section h2 {
            color: #1F2937;
            font-size: 18px;
            border-left: 4px solid #10B981;
            padding-left: 12px;
            margin: 0 0 15px 0;
          }
          
          .section h3 {
            color: #374151;
            font-size: 16px;
            margin: 15px 0 8px 0;
          }
          
          .user-info {
            background: #F9FAFB;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #10B981;
          }
          
          .user-info p {
            margin: 5px 0;
          }
          
          .phase {
            background: #F3F4F6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #3B82F6;
          }
          
          .phase-title {
            color: #1F2937;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 8px;
          }
          
          .phase-description {
            color: #4B5563;
            margin-bottom: 10px;
          }
          
          .activities {
            list-style-type: none;
            padding-left: 0;
          }
          
          .activities li {
            background: #FFFFFF;
            padding: 8px 12px;
            margin: 5px 0;
            border-radius: 4px;
            border-left: 3px solid #10B981;
          }
          
          .goal {
            background: #EEF2FF;
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            border-left: 4px solid #6366F1;
          }
          
          .recommendation {
            background: #FEF3C7;
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            border-left: 4px solid #F59E0B;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            text-align: center;
            font-size: 12px;
            color: #6B7280;
          }
          
          ul {
            padding-left: 20px;
          }
          
          li {
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌿 ObsessLess Tedavi Planı</h1>
          <p>Kişiselleştirilmiş OKB Tedavi Programı</p>
          <p>Oluşturulma Tarihi: ${currentDate}</p>
        </div>
        
        <div class="section">
          <h2>👤 Kullanıcı Bilgileri</h2>
          <div class="user-info">
            <p><strong>İsim:</strong> ${userName}</p>
            ${userAge ? `<p><strong>Yaş:</strong> ${userAge}</p>` : ''}
            <p><strong>Belirtiler:</strong> ${symptoms}</p>
            <p><strong>Şiddet Düzeyi:</strong> ${severity}</p>
          </div>
        </div>
        
        <div class="section">
          <h2>🎯 Plan Özeti</h2>
          <h3>${planTitle}</h3>
          <p>${planDescription}</p>
        </div>
        
        ${goals.length > 0 ? `
          <div class="section">
            <h2>🎯 Hedefler</h2>
            ${goals.map(goal => `
              <div class="goal">
                <strong>${goal.title || goal}</strong>
                ${goal.description ? `<p>${goal.description}</p>` : ''}
                ${goal.timeframe ? `<p><em>Süre: ${goal.timeframe}</em></p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${phases.length > 0 ? `
          <div class="section">
            <h2>📋 Tedavi Aşamaları</h2>
            ${phases.map((phase, index) => `
              <div class="phase">
                <div class="phase-title">
                  Aşama ${index + 1}: ${phase.name || phase.title || `Aşama ${index + 1}`}
                </div>
                ${phase.description ? `
                  <div class="phase-description">${phase.description}</div>
                ` : ''}
                
                ${phase.duration ? `<p><strong>Süre:</strong> ${phase.duration}</p>` : ''}
                
                ${phase.activities && phase.activities.length > 0 ? `
                  <h4>Aktiviteler:</h4>
                  <ul class="activities">
                    ${phase.activities.map(activity => `
                      <li>${typeof activity === 'string' ? activity : activity.title || activity.name || 'Aktivite'}</li>
                    `).join('')}
                  </ul>
                ` : ''}
                
                ${phase.goals && phase.goals.length > 0 ? `
                  <h4>Bu Aşamanın Hedefleri:</h4>
                  <ul>
                    ${phase.goals.map(goal => `<li>${goal}</li>`).join('')}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${recommendations.length > 0 ? `
          <div class="section">
            <h2>💡 Öneriler</h2>
            ${recommendations.map(rec => `
              <div class="recommendation">
                <strong>${rec.title || 'Öneri'}</strong>
                ${rec.description ? `<p>${rec.description}</p>` : ''}
                ${rec.importance ? `<p><em>Önem: ${rec.importance}</em></p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="section">
          <h2>⚠️ Önemli Notlar</h2>
          <ul>
            <li>Bu plan, kişiselleştirilmiş bir rehber niteliğindedir ve profesyonel tıbbi tavsiyenin yerini almaz.</li>
            <li>Herhangi bir soru veya endişeniz varsa, lütfen bir sağlık profesyoneline danışın.</li>
            <li>Plan, durumunuza göre güncelleme gerektirebilir.</li>
            <li>Düzenli takip ve değerlendirme önemlidir.</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>ObsessLess Uygulaması ile oluşturuldu</p>
          <p>🌿 Sağlıklı yaşam, mutlu gelecek</p>
        </div>
      </body>
      </html>
    `;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Tedavi Planım',
            headerBackTitle: 'Geri',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#1F2937',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Tedavi planınız yükleniyor...</Text>
        </View>
      </View>
    );
  }

  if (!userProfile || !treatmentPlan) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Tedavi Planım',
            headerBackTitle: 'Geri',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#1F2937',
          }}
        />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Tedavi Planı Bulunamadı</Text>
          <Text style={styles.emptyText}>
            Kişiselleştirilmiş tedavi planınızı oluşturmak için önce değerlendirme sürecini tamamlamanız gerekiyor.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/onboarding');
            }}
          >
            <Text style={styles.primaryButtonText}>Değerlendirmeyi Başlat</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tedavi Planım',
          headerBackTitle: 'Geri',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTintColor: '#1F2937',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerButton}
                onPress={handleExportPlan}
              >
                <MaterialCommunityIcons name="download" size={24} color="#6B7280" />
              </Pressable>
              <Pressable
                style={styles.headerButton}
                onPress={handleUpdatePlan}
              >
                <MaterialCommunityIcons name="refresh" size={24} color="#6B7280" />
              </Pressable>
            </View>
          ),
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(32, insets.bottom + 16) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Güncelleme Bildirimi */}
        {hasUpdates && (
          <View style={styles.updateBanner}>
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
            <Text style={styles.updateText}>
              Yeni verilerinize göre planınız güncellenebilir
            </Text>
            <Pressable onPress={handleUpdatePlan}>
              <Text style={styles.updateAction}>Güncelle</Text>
            </Pressable>
          </View>
        )}

        {/* Tedavi Planı Detayları */}
        <View style={styles.planContainer}>
          <TreatmentPlanPreview
            userProfile={userProfile}
            treatmentPlan={treatmentPlan}
            isLoading={false}
            userId={user?.id}
          />
        </View>

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={20} color="#6B7280" />
            <Text style={styles.infoText}>
              Bu tedavi planı, verdiğiniz bilgiler doğrultusunda AI tarafından oluşturulmuştur. 
              Profesyonel bir tedavinin yerini tutmaz. Lütfen bir uzmana danışmayı ihmal etmeyin.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  updateText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  updateAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  planContainer: {
    marginHorizontal: 16,
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});

export default TreatmentPlanScreen;
