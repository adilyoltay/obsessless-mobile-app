/**
 * 🛡️ Safety Plan V2 - Minimalist Full-Screen Design
 * 
 * Anayasa v2.0 ilkelerine uygun güvenlik planı:
 * - Temiz, sakinleştirici görünüm
 * - Net acil durum bilgileri
 * - Tek onay aksiyonu
 * 
 * Features:
 * ✅ Full-screen safety information
 * ✅ Emergency contacts setup
 * ✅ Crisis resources
 * ✅ Turkish crisis hotlines
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// UI Components
import Button from '@/components/ui/Button';

// Types
import {
  RiskAssessment,
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

interface SafetyPlanV2Props {
  riskAssessment: RiskAssessment | null;
  onApprove: () => void;
  isLoading?: boolean;
}

// Turkish Crisis Resources
const CRISIS_RESOURCES = [
  {
    name: 'İntihar Önleme Hattı',
    number: '182',
    description: '7/24 psikolojik destek',
    icon: 'phone-alert',
  },
  {
    name: 'Acil Tıbbi Yardım',
    number: '112',
    description: 'Acil sağlık durumları',
    icon: 'ambulance',
  },
  {
    name: 'KADES',
    number: '155',
    description: 'Kadın destek uygulaması',
    icon: 'shield-account',
  },
];

const COPING_STRATEGIES = [
  {
    title: '4-7-8 Nefes Tekniği',
    description: '4 saniye nefes al, 7 saniye tut, 8 saniye ver',
    icon: 'meditation',
  },
  {
    title: 'Güvenli Yer Görselleştirme',
    description: 'Kendinizi güvende hissettiğiniz bir yeri hayal edin',
    icon: 'home-heart',
  },
  {
    title: '5-4-3-2-1 Tekniği',
    description: '5 şey gör, 4 şey dokun, 3 ses duy, 2 koku al, 1 tat',
    icon: 'eye-check',
  },
];

export const SafetyPlanV2: React.FC<SafetyPlanV2Props> = ({
  riskAssessment,
  onApprove,
  isLoading,
}) => {
  const handleCallNumber = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="shield-check" size={48} color={COLORS.primary} />
          <Text style={styles.title}>Güvenlik Planınız</Text>
          <Text style={styles.subtitle}>
            Zorlu anlarda size destek olacak kaynaklar
          </Text>
        </View>

        {/* Emergency Notice */}
        <View style={styles.emergencyCard}>
          <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.error} />
          <Text style={styles.emergencyText}>
            Kendinize zarar verme düşünceniz varsa, lütfen hemen{' '}
            <Text style={styles.emergencyNumber} onPress={() => handleCallNumber('182')}>
              182
            </Text>
            {' '}numaralı hattı arayın.
          </Text>
        </View>

        {/* Crisis Resources */}
        <Text style={styles.sectionTitle}>Acil Durum Hatları</Text>
        {CRISIS_RESOURCES.map((resource) => (
          <TouchableOpacity
            key={resource.number}
            style={styles.resourceCard}
            onPress={() => handleCallNumber(resource.number)}
          >
            <MaterialCommunityIcons 
              name={resource.icon as any} 
              size={24} 
              color={COLORS.primary} 
            />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceName}>{resource.name}</Text>
              <Text style={styles.resourceDescription}>{resource.description}</Text>
            </View>
            <View style={styles.resourceNumber}>
              <Text style={styles.resourceNumberText}>{resource.number}</Text>
              <MaterialCommunityIcons name="phone" size={20} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Coping Strategies */}
        <Text style={styles.sectionTitle}>Hızlı Sakinleşme Teknikleri</Text>
        {COPING_STRATEGIES.map((strategy) => (
          <View key={strategy.title} style={styles.strategyCard}>
            <MaterialCommunityIcons 
              name={strategy.icon as any} 
              size={24} 
              color={COLORS.primary} 
            />
            <View style={styles.strategyContent}>
              <Text style={styles.strategyTitle}>{strategy.title}</Text>
              <Text style={styles.strategyDescription}>{strategy.description}</Text>
            </View>
          </View>
        ))}

        {/* Personal Safety Steps */}
        <View style={styles.safetyStepsCard}>
          <Text style={styles.safetyStepsTitle}>Kriz Anında Yapılacaklar</Text>
          <View style={styles.safetyStep}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Güvenli bir yere geçin</Text>
          </View>
          <View style={styles.safetyStep}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Derin nefes alın (4-7-8 tekniği)</Text>
          </View>
          <View style={styles.safetyStep}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Güvendiğiniz birini arayın</Text>
          </View>
          <View style={styles.safetyStep}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>Gerekirse 182&apos;yi arayın</Text>
          </View>
        </View>

        {/* App Features */}
        <View style={styles.featuresCard}>
          <MaterialCommunityIcons name="cellphone-check" size={24} color={COLORS.primary} />
          <Text style={styles.featuresTitle}>Uygulama İçi Destek</Text>
          <Text style={styles.featuresText}>
            • 7/24 AI destekli sohbet asistanı{'\n'}
            • Otomatik kriz algılama sistemi{'\n'}
            • Acil durum kişilerinize hızlı erişim{'\n'}
            • Sakinleştirici egzersizler
          </Text>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        <Button
          title="Güvenlik Planını Onayla"
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
    marginBottom: 24,
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
  emergencyCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  emergencyText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.error,
    lineHeight: 20,
    marginLeft: 12,
  },
  emergencyNumber: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 16,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  resourceContent: {
    flex: 1,
    marginLeft: 12,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 2,
  },
  resourceDescription: {
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  resourceNumber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resourceNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 6,
  },
  strategyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  strategyContent: {
    flex: 1,
    marginLeft: 12,
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 2,
  },
  strategyDescription: {
    fontSize: 14,
    color: COLORS.secondaryText,
    lineHeight: 18,
  },
  safetyStepsCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  safetyStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginBottom: 16,
  },
  safetyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryText,
  },
  featuresCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryText,
    marginTop: 8,
    marginBottom: 12,
  },
  featuresText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    lineHeight: 20,
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

export default SafetyPlanV2;
