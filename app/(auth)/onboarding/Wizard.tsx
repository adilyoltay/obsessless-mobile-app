import React, { useState } from 'react';
import { View, Text, TextInput, Button as RNButton, ScrollView } from 'react-native';
import { YBOCSAssessment } from '@/components/assessment/YBOCSAssessment';
import { SafetyPlanV2 } from '@/features/ai/components/onboarding/SafetyPlanV2';
import { TreatmentPlanPreviewV2 } from '@/features/ai/components/onboarding/TreatmentPlanPreviewV2';
import { adaptiveTreatmentPlanningEngine } from '@/features/ai/engines/treatmentPlanningEngine';
import { userProfilingService } from '@/features/ai/services/userProfilingService';
import { UserProfile, TreatmentPlan } from '@/features/ai/types';

interface WizardProps {
  userId: string;
  onComplete: (profile: UserProfile, plan: TreatmentPlan) => void;
}

export const OnboardingWizard: React.FC<WizardProps> = ({ userId, onComplete }) => {
  const [step, setStep] = useState(0);
  const [ybocs, setYbocs] = useState<{ totalScore: number; severity: string; answers: Record<string, number> } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<TreatmentPlan | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const handleYbocsComplete = (data: { totalScore: number; severity: string; answers: Record<string, number> }) => {
    setYbocs(data);
    setStep(1);
  };

  const handleProfileSubmit = async () => {
    if (!ybocs) return;
    const basicInfo = { name, age: Number(age), gender };
    const prof = await userProfilingService.generateProfile(userId, {
      basicInfo,
      ybocsData: ybocs,
    });
    setProfile(prof as UserProfile);
    setStep(2);
  };

  const handleSafetyApprove = async () => {
    if (!profile || !ybocs) return;
    await adaptiveTreatmentPlanningEngine.initialize();
    const plan = await adaptiveTreatmentPlanningEngine.generateInitialPlan(
      profile as any,
      { totalScore: ybocs.totalScore, severityLevel: ybocs.severity } as any,
      { overallRiskLevel: 'low' } as any,
      { language: 'tr' } as any
    );
    setTreatmentPlan(plan);
    setStep(3);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <YBOCSAssessment onComplete={handleYbocsComplete} />;
      case 1:
        return (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ fontSize: 24, marginBottom: 16 }}>Demografik Bilgiler</Text>
            <TextInput placeholder="İsim" value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 8, marginBottom: 12 }} />
            <TextInput placeholder="Yaş" value={age} onChangeText={setAge} keyboardType="numeric" style={{ borderWidth: 1, padding: 8, marginBottom: 12 }} />
            <TextInput placeholder="Cinsiyet" value={gender} onChangeText={setGender} style={{ borderWidth: 1, padding: 8, marginBottom: 12 }} />
            <RNButton title="Devam" onPress={handleProfileSubmit} />
          </ScrollView>
        );
      case 2:
        return <SafetyPlanV2 riskAssessment={null} onApprove={handleSafetyApprove} />;
      case 3:
        return (
          <ScrollView>
            <TreatmentPlanPreviewV2 userProfile={profile} treatmentPlan={treatmentPlan} onApprove={() => onComplete(profile!, treatmentPlan!)} />
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Güvenlik Planı Özeti</Text>
              <Text>• İntihar Önleme Hattı: 182</Text>
              <Text>• Acil Tıbbi Yardım: 112</Text>
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return <View style={{ flex: 1 }}>{renderStep()}</View>;
};

