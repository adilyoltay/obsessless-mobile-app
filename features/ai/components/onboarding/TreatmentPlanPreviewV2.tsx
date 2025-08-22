/**
 * 📋 Treatment Plan Preview V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun tedavi planı önizlemesi:
 * - Temiz, minimal görünüm
 * - Net bilgi hiyerarşisi
 * - Tek onay aksiyonu
 * 
 * Features:
 * ✅ Full-screen preview
 * ✅ Clear information hierarchy
 * ✅ Single approval action
 * ✅ Turkish adaptation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';

// Types
import {
  UserProfile,
  TreatmentPlan,
} from '@/features/ai/types';

// Anayasa v2.0 Renk Paleti
const COLORS = {
  background: '#F9FAFB',
  primary: '#10B981',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  border: '#E5E7EB',
  white: '#FFFFFF',
  error: '#EF4444',
  warning: '#F59E0B',
};

interface TreatmentPlanPreviewV2Props {
  userProfile: UserProfile | null;
  treatmentPlan: TreatmentPlan | null;
  onApprove: () => void;
  isLoading?: boolean;
}

export const TreatmentPlanPreviewV2: React.FC<TreatmentPlanPreviewV2Props> = ({
  userProfile,
  treatmentPlan,
  onApprove,
  isLoading,
}) => {
  // Mock treatment plan if not provided
  const plan = treatmentPlan || {
    id: 'mock-plan',
    userId: userProfile?.userId || '',
    phases: [
      {
        id: 'phase-1',
        name: 'Farkındalık ve Kabul',
        weekNumber: 1,
        goals: [
          'OKB semptomlarını tanıma',
          'Tetikleyicileri belirleme',
          'Günlük takip alışkanlığı',
        ],
        exercises: [
          'Günlük kompulsiyon kaydı',
          'Farkındalık meditasyonu (5 dk)',
          'Düşünce günlüğü tutma',
        ],
      },
      {
        id: 'phase-2',
        name: 'Temel Terapi Egzersizleri',
        weekNumber: 2,
        goals: [
          'Hafif tetikleyicilere maruz kalma',
          'Kompulsiyonları geciktirme',
          'Anksiyete toleransı geliştirme',
        ],
        exercises: [
          'ERP Seviye 1 egzersizleri',
          'Nefes egzersizleri',
          'Progresif kas gevşemesi',
        ],
      },
      {
        id: 'phase-3',
        name: 'İlerleme ve Güçlendirme',
        weekNumber: 3,
        goals: [
          'Orta seviye tetikleyiciler',
          'Kompulsiyon süresini azaltma',
          'Sosyal aktivitelere katılım',
        ],
        exercises: [
          'ERP Seviye 2 egzersizleri',
          'Değer odaklı aktiviteler',
          'Sosyal maruz kalma',
        ],
      },
      {
        id: 'phase-4',
        name: 'Bağımsızlık ve Sürdürme',
        weekNumber: 4,
        goals: [
          'Bağımsız başa çıkma',
          'Relaps önleme stratejileri',
          'Uzun vadeli hedefler',
        ],
        exercises: [
          'ERP Seviye 3 egzersizleri',
          'Kendi kendine yönetim',
          'Haftalık değerlendirme',
        ],
      },
    ],
    culturalAdaptations: [
      'Türk kültürüne uygun örnekler',
      'Aile desteği entegrasyonu',
      'Dini/manevi yaklaşımlar (isteğe bağlı)',
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="clipboard-check" size={48} color={COLORS.primary} />
          <Text style={styles.title}>Kişisel Tedavi Planınız</Text>
          <Text style={styles.subtitle}>
            4 haftalık, size özel hazırlanmış tedavi programı
          </Text>
        </View>

        {/* Plan Overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>Plan Özeti</Text>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
            <Text style={styles.overviewText}>4 hafta / 28 gün</Text>
          </View>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons name="target" size={20} color={COLORS.primary} />
            <Text style={styles.overviewText}>12 hedef</Text>
          </View>
          <View style={styles.overviewItem}>
            <MaterialCommunityIcons name="dumbbell" size={20} color={COLORS.primary} />
            <Text style={styles.overviewText}>Günlük egzersizler</Text>
          </View>
        </View>

        {/* Phases */}
        <Text style={styles.sectionTitle}>Haftalık Aşamalar</Text>
        {plan.phases.map((phase, index) => (
          <View key={phase.id} style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <View style={styles.phaseNumber}>
                <Text style={styles.phaseNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.phaseName}>{phase.name}</Text>
            </View>
            
            <Text style={styles.phaseLabel}>Hedefler:</Text>
            {(phase.goals || []).map((goal, i) => (
              <View key={i} style={styles.goalItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.goalText}>{goal}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Cultural Adaptations */}
        <View style={styles.adaptationCard}>
          <MaterialCommunityIcons name="account-heart" size={24} color={COLORS.primary} />
          <Text style={styles.adaptationTitle}>Size Özel Uyarlamalar</Text>
          {plan.culturalAdaptations.map((item, i) => (
            <Text key={i} style={styles.adaptationText}>• {item}</Text>
          ))}
        </View>

        {/* AI Note */}
        <View style={styles.aiNote}>
          <MaterialCommunityIcons name="robot" size={20} color={COLORS.secondaryText} />
          <Text style={styles.aiNoteText}>
            Bu plan, Y-BOCS değerlendirmeniz ve kişisel bilgileriniz 
            temel alınarak AI tarafından özelleştirilmiştir.
          </Text>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <Button
          title="Planı Onayla ve Devam Et"
          onPress={onApprove}
          style={styles.primaryButton}
          disabled={isLoading}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 16,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewText: {
    fontSize: 15,
    color: COLORS.primaryText,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 16,
  },
  phaseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  phaseNumberText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  phaseName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.primaryText,
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.secondaryText,
    marginTop: 8,
    marginBottom: 8,
  },
  goalItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.primary,
    marginRight: 8,
  },
  goalText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.primaryText,
    lineHeight: 20,
  },
  adaptationCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  adaptationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginTop: 8,
    marginBottom: 12,
  },
  adaptationText: {
    fontSize: 14,
    color: COLORS.primaryText,
    lineHeight: 20,
    marginBottom: 4,
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    marginBottom: 20,
  },
  aiNoteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.secondaryText,
    lineHeight: 18,
    marginLeft: 8,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
});

export default TreatmentPlanPreviewV2;
