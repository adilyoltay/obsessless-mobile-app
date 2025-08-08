/**
 * 🎨 Art Therapy Screen - AI-Enhanced Creative Expression
 * 
 * Sprint 8 Ana Ekranı: Dijital Canvas ve AI Analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// AI Services
import { artTherapyEngine } from '@/features/ai/artTherapy/artTherapyEngine';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';

// UI Components
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Types
import type { ArtSessionConfig, TherapeuticPrompt, ArtTechnique, GuidanceLevel, PrivacyLevel } from '@/features/ai/artTherapy/artTherapyEngine';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ArtTherapyScreen() {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [availablePrompts, setAvailablePrompts] = useState<TherapeuticPrompt[]>([]);
  const [selectedTechnique, setSelectedTechnique] = useState<ArtTechnique | null>(null);

  useEffect(() => {
    loadTherapeuticPrompts();
  }, []);

  const loadTherapeuticPrompts = async () => {
    try {
      setIsLoading(true);
      
      // Check if Art Therapy is enabled
      if (!FEATURE_FLAGS.isEnabled('AI_ART_THERAPY')) {
        Alert.alert(
          '🎨 Sanat Terapisi',
          'Bu özellik şu anda devre dışı. Lütfen daha sonra tekrar deneyin.',
          [{ text: 'Tamam', onPress: () => router.back() }]
        );
        return;
      }

      // Get personalized prompts
      const prompts = await artTherapyEngine.generatePrompts({
        culturalContext: 'turkish'
      });
      
      setAvailablePrompts(prompts);
      
      await trackAIInteraction(AIEventType.SERVICE_ACCESSED, {
        service: 'ArtTherapy',
        promptsLoaded: prompts.length
      });
    } catch (error) {
      console.error('❌ Failed to load therapeutic prompts:', error);
      Alert.alert('Hata', 'Sanat terapisi önerileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  const startArtSession = useCallback(async (prompt: TherapeuticPrompt) => {
    try {
      setIsLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const config: ArtSessionConfig = {
        technique: prompt.technique,
        duration: prompt.estimatedDuration,
        guidance: GuidanceLevel.MODERATE,
        privacy: PrivacyLevel.PRIVATE,
        culturalContext: 'turkish'
      };

      // Create art session
      const session = await artTherapyEngine.createArtSession('current_user', config);
      
      console.log('🎨 Art session created:', session.sessionId);

      // Navigate to canvas (will implement next)
      Alert.alert(
        '🎨 Sanat Seansı Başladı',
        `"${prompt.title}" seansınız başlıyor. Dijital canvas yakında hazır olacak!`,
        [
          { text: 'Devam Et', style: 'default' },
          { text: 'İptal', style: 'cancel', onPress: () => router.back() }
        ]
      );

      await trackAIInteraction(AIEventType.SESSION_STARTED, {
        sessionId: session.sessionId,
        technique: prompt.technique,
        estimatedDuration: prompt.estimatedDuration
      });

    } catch (error) {
      console.error('❌ Failed to start art session:', error);
      Alert.alert('Hata', 'Sanat seansı başlatılamadı.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderPromptCard = (prompt: TherapeuticPrompt) => (
    <Card key={prompt.id} style={styles.promptCard}>
      <View style={styles.promptHeader}>
        <MaterialCommunityIcons 
          name={getIconForTechnique(prompt.technique)} 
          size={28} 
          color="#8b5cf6" 
        />
        <View style={styles.promptInfo}>
          <Text style={styles.promptTitle}>{prompt.title}</Text>
          <Text style={styles.promptDuration}>
            ⏱️ {prompt.estimatedDuration} dakika • {getDifficultyText(prompt.difficultyLevel)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.promptDescription}>{prompt.description}</Text>
      
      {prompt.culturalAdaptation && (
        <View style={styles.culturalTag}>
          <MaterialCommunityIcons name="star-circle" size={16} color="#f59e0b" />
          <Text style={styles.culturalText}>Türk kültürüne uyarlanmış</Text>
        </View>
      )}

      <View style={styles.therapeuticGoals}>
        {prompt.therapeuticGoals.slice(0, 3).map((goal, index) => (
          <View key={index} style={styles.goalTag}>
            <Text style={styles.goalText}>{getGoalText(goal)}</Text>
          </View>
        ))}
      </View>

      <Button
        onPress={() => startArtSession(prompt)}
        variant="primary"
        disabled={isLoading}
        style={styles.startButton}
      >
        🎨 Başlat
      </Button>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1f2937" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🎨 Sanat Terapisi</Text>
          <Text style={styles.headerSubtitle}>Duygularınızı görselleştirin</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <Card style={styles.introCard}>
          <View style={styles.introHeader}>
            <MaterialCommunityIcons name="brush" size={32} color="#8b5cf6" />
            <Text style={styles.introTitle}>Sanatla İyileşin</Text>
          </View>
          <Text style={styles.introText}>
            Duygularınızı renkler, şekiller ve desenlerle ifade ederek iç huzurunuzu bulun. 
            AI destekli terapötik rehberlik ile size özel sanat deneyimleri yaşayın.
          </Text>
        </Card>

        {/* Therapeutic Prompts */}
        <View style={styles.promptsSection}>
          <Text style={styles.sectionTitle}>Sizin İçin Öneriler</Text>
          <Text style={styles.sectionSubtitle}>
            Mevcut durumunuza göre hazırlanmış terapötik sanat etkinlikleri
          </Text>
          
          {isLoading ? (
            <Card style={styles.loadingCard}>
              <MaterialCommunityIcons name="loading" size={32} color="#9ca3af" />
              <Text style={styles.loadingText}>Terapötik öneriler yükleniyor...</Text>
            </Card>
          ) : (
            availablePrompts.map(renderPromptCard)
          )}
        </View>

        {/* Feature Coming Soon */}
        <Card style={styles.comingSoonCard}>
          <MaterialCommunityIcons name="construction" size={24} color="#f59e0b" />
          <Text style={styles.comingSoonTitle}>Yakında Geliyor</Text>
          <Text style={styles.comingSoonText}>
            • Dijital Canvas ve Çizim Araçları{'\n'}
            • AI Sanat Analizi{'\n'}
            • İlerleme Takibi{'\n'}
            • Geleneksel Türk Motifları
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

// Helper functions
function getIconForTechnique(technique: ArtTechnique): string {
  const icons = {
    free_drawing: 'draw',
    mandala: 'circle-outline',
    color_therapy: 'palette',
    pattern_drawing: 'vector-square',
    emotion_mapping: 'heart',
    breathing_visualization: 'air-filter',
    traditional_motifs: 'flower'
  };
  return icons[technique] || 'brush';
}

function getDifficultyText(level: string): string {
  const texts = {
    beginner: 'Başlangıç',
    intermediate: 'Orta',
    advanced: 'İleri',
    therapeutic: 'Terapötik'
  };
  return texts[level] || 'Orta';
}

function getGoalText(goal: string): string {
  const texts = {
    stress_reduction: 'Stres Azaltma',
    mindfulness: 'Farkındalık',
    focus_improvement: 'Odaklanma',
    emotional_awareness: 'Duygusal Farkındalık',
    self_reflection: 'Özrefleksiyon',
    cultural_connection: 'Kültürel Bağ',
    creativity: 'Yaratıcılık'
  };
  return texts[goal] || goal;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  introCard: {
    marginBottom: 24,
    padding: 20,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  introText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
  },
  promptsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  promptCard: {
    marginBottom: 16,
    padding: 16,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promptInfo: {
    flex: 1,
    marginLeft: 12,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  promptDuration: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  promptDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    marginBottom: 12,
  },
  culturalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  culturalText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 4,
  },
  therapeuticGoals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  goalTag: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  goalText: {
    fontSize: 11,
    color: '#6b46c1',
    fontWeight: '500',
  },
  startButton: {
    marginTop: 8,
  },
  loadingCard: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  comingSoonCard: {
    padding: 16,
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    borderWidth: 1,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 8,
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
});
