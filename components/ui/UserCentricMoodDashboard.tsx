import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions, Alert, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { MoodEntry as ServiceMoodEntry } from '@/services/moodTrackingService';

/**
 * 🎭 User-Centric Mood Dashboard
 * 
 * Kullanıcının mood yolculuğunu motivasyonel, AI destekli ve anlaşılır şekilde sunar.
 * CBT Dashboard'ı gibi sakin, anxiety-friendly tasarım ile.
 */

const { width } = Dimensions.get('window');

interface MoodEntry {
  id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes: string;
  trigger?: string;
  created_at: string;
  user_id: string;
}

interface UserMoodJourney {
  // User-friendly progress
  moodStory: {
    daysTracking: number;
    entriesCount: number;
    emotionalGrowth: 'başlangıç' | 'gelişiyor' | 'stabil' | 'uzman';
    currentStreak: number;
    averageMood: number;
    moodTrend: 'yükseliyor' | 'stabil' | 'düşüyor';
  };
  
  // Personal insights
  personalInsights: {
    strongestPattern: string;
    challengeArea: string;
    nextMilestone: string;
    encouragement: string;
    actionableStep: string;
  };
  
  // Emotional spectrum data
  emotionalSpectrum: {
    dominantEmotion: string;
    emotionDistribution: Array<{
      emotion: string;
      percentage: number;
      color: string;
    }>;
    weeklyColors: Array<{
      day: string;
      color: string;
      mood: number;
      highlight?: string;
    }>;
  };
  
  // Pattern analysis
  patterns: Array<{
    type: 'temporal' | 'trigger' | 'environmental' | 'mea_correlation';
    title: string;
    description: string;
    suggestion: string;
    severity: 'high' | 'medium' | 'low';
    actionable: boolean;
  }>;
  
  // Predictive insights
  prediction: {
    riskLevel: 'high' | 'medium' | 'low';
    earlyWarning?: {
      triggered: boolean;
      message: string;
    };
    interventions: Array<{
      type: 'immediate' | 'preventive' | 'supportive';
      action: string;
    }>;
    recommendation: string;
  };
  
  // Achievements
  achievements: Array<{
    title: string;
    description: string;
    date: Date;
    celebration: string;
    impact: string;
  }>;
}

interface UserCentricMoodDashboardProps {
  visible: boolean;
  onClose: () => void;
  moodJourney?: UserMoodJourney | null; // Allow null/undefined
  moodEntries?: MoodEntry[] | null; // Allow null/undefined
  onStartAction?: (actionId: string) => void;
}

export default function UserCentricMoodDashboard({
  visible,
  onClose,
  moodJourney,
  moodEntries,
  onStartAction
}: UserCentricMoodDashboardProps) {
  
  /**
   * 🛡️ CRITICAL FIX: Safe moodJourney access with comprehensive null safety
   * Prevents render crashes when API returns incomplete data
   */
  const safeMoodJourney = {
    moodStory: {
      daysTracking: moodJourney?.moodStory?.daysTracking ?? 0,
      entriesCount: moodJourney?.moodStory?.entriesCount ?? 0,
      emotionalGrowth: moodJourney?.moodStory?.emotionalGrowth ?? 'başlangıç',
      currentStreak: moodJourney?.moodStory?.currentStreak ?? 0,
      averageMood: moodJourney?.moodStory?.averageMood ?? 50,
      moodTrend: moodJourney?.moodStory?.moodTrend ?? 'stabil'
    },
    personalInsights: {
      strongestPattern: moodJourney?.personalInsights?.strongestPattern ?? 'Henüz yeterli veri yok',
      challengeArea: moodJourney?.personalInsights?.challengeArea ?? 'Düzenli kayıt tutmaya odaklan',
      nextMilestone: moodJourney?.personalInsights?.nextMilestone ?? 'İlk hafta mood kaydını tamamla',
      encouragement: moodJourney?.personalInsights?.encouragement ?? 'Her yeni gün yeni bir fırsat ✨',
      actionableStep: moodJourney?.personalInsights?.actionableStep ?? 'Bugün mood kaydını yapmaya devam et'
    },
    emotionalSpectrum: {
      dominantEmotion: moodJourney?.emotionalSpectrum?.dominantEmotion ?? 'Henüz belirlenemiyor',
      emotionDistribution: moodJourney?.emotionalSpectrum?.emotionDistribution ?? [],
      weeklyColors: moodJourney?.emotionalSpectrum?.weeklyColors ?? []
    },
    patterns: moodJourney?.patterns ?? [],
    prediction: {
      riskLevel: moodJourney?.prediction?.riskLevel ?? 'low',
      earlyWarning: moodJourney?.prediction?.earlyWarning ?? undefined,
      interventions: moodJourney?.prediction?.interventions ?? [],
      recommendation: moodJourney?.prediction?.recommendation ?? 'Mood takibine devam et, her şey yolunda görünüyor.'
    },
    achievements: moodJourney?.achievements ?? []
  };

  /**
   * 🛡️ CRITICAL FIX: Safe moodEntries access
   * Prevents crashes when moodEntries is null/undefined
   */
  const safeMoodEntries = moodEntries ?? [];
  
  const [selectedSection, setSelectedSection] = useState<'insights'>('insights');

  // ✅ Calm mood color mapping (Master Prompt: Sakinlik)
  const getMoodColor = (score: number): string => {
    if (score >= 90) return '#C2185B'; // Soft pink - Heyecanlı (anxiety-friendly)
    if (score >= 80) return '#7E57C2'; // Soft purple - Enerjik
    if (score >= 70) return '#4CAF50'; // Soft green - Mutlu
    if (score >= 60) return '#26A69A'; // Soft teal - Sakin
    if (score >= 50) return '#66BB6A'; // Light green - Normal
    if (score >= 40) return '#FFA726'; // Soft orange - Endişeli
    if (score >= 30) return '#FF7043'; // Soft red-orange - Sinirli
    if (score >= 20) return '#5C6BC0'; // Soft indigo - Üzgün
    return '#F06292'; // Soft rose - Kızgın
  };

  const getMoodLabel = (score: number): string => {
    if (score >= 90) return 'Heyecanlı';
    if (score >= 80) return 'Enerjik';
    if (score >= 70) return 'Mutlu';
    if (score >= 60) return 'Sakin';
    if (score >= 50) return 'Normal';
    if (score >= 40) return 'Endişeli';
    if (score >= 30) return 'Sinirli';
    if (score >= 20) return 'Üzgün';
    return 'Kızgın';
  };

  // Generate growth badge
  const getGrowthBadge = (growth: string) => {
    const badges = {
      'başlangıç': { icon: '🌱', color: '#4CAF50', message: 'Mood takip yolculuğun başladı' },
      'gelişiyor': { icon: '🌿', color: '#26A69A', message: 'Duygusal farkındalığın gelişiyor' },
      'stabil': { icon: '🌳', color: '#2E7D32', message: 'İstikrarlı bir mood pattern\'i oluşturdun' },
      'uzman': { icon: '✨', color: '#1565C0', message: 'Duygusal zekanda ustalaştın' }
    };
    return badges[growth as keyof typeof badges] || badges.başlangıç;
  };

  // Helper functions for today's hours and week days
  const getTodayHours = () => {
    const hours = [];
    for (let i = 6; i <= 23; i++) {
      hours.push({
        label: `${i.toString().padStart(2, '0')}:00`,
        hour: i
      });
    }
    return hours;
  };

  const getWeekDays = () => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    return days.map((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        label: day,
        date: date
      };
    });
  };

  const renderJourneySection = () => {
    const growthBadge = getGrowthBadge(safeMoodJourney.moodStory.emotionalGrowth);
    
    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        {/* Hero Story Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroIcon}>{growthBadge.icon}</Text>
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Mood Yolculuğun</Text>
              <Text style={styles.heroSubtitle}>{growthBadge.message}</Text>
            </View>
          </View>
          
          {/* Journey Stats */}
          <View style={styles.journeyStats}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{safeMoodJourney.moodStory.daysTracking}</Text>
              <Text style={styles.statLabel}>Gün</Text>
              <Text style={styles.statNote}>Takip ettin</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{safeMoodJourney.moodStory.entriesCount}</Text>
              <Text style={styles.statLabel}>Kayıt</Text>
              <Text style={styles.statNote}>Oluşturdun</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{safeMoodJourney.moodStory.currentStreak}</Text>
              <Text style={styles.statLabel}>Gün</Text>
              <Text style={styles.statNote}>Sürekli</Text>
            </View>
          </View>
        </View>

        {/* Emotional Wellbeing Progress */}
        <View style={styles.wellbeingCard}>
          <Text style={styles.cardTitle}>💭 Duygusal İyilik Halin</Text>
          
          <View style={styles.progressComparison}>
            <View style={styles.progressSingle}>
              <Text style={styles.progressLabel}>Ortalama Ruh Hali</Text>
              <View style={[styles.progressCircle, { 
                backgroundColor: getMoodColor(safeMoodJourney.moodStory.averageMood) 
              }]}>
                <Text style={styles.progressNumber}>{safeMoodJourney.moodStory.averageMood}</Text>
              </View>
            </View>
          </View>
          
          <Text style={styles.progressImprovement}>
            {safeMoodJourney.moodStory.moodTrend === 'yükseliyor' && 'Mood eğiliminiz pozitif yönde. Bu güzel bir gelişim.'}
            {safeMoodJourney.moodStory.moodTrend === 'stabil' && 'İstikrarlı bir mood düzeyindesin. Bu da değerli.'}
            {safeMoodJourney.moodStory.moodTrend === 'düşüyor' && 'Zorlu bir dönemdesin. Bu geçici, kendine sabırlı ol.'}
          </Text>
        </View>

        {/* Personal Insights */}
        <View style={styles.insightCard}>
          <Text style={styles.cardTitle}>🧠 Sana Özel İçgörüler</Text>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#4CAF50" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>En Güçlü Pattern'in:</Text>
              <Text style={styles.insightText}>{safeMoodJourney.personalInsights.strongestPattern}</Text>
            </View>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="target" size={20} color="#FF7043" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Odaklanılacak Alan:</Text>
              <Text style={styles.insightText}>{safeMoodJourney.personalInsights.challengeArea}</Text>
            </View>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color="#7E57C2" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Sıradaki Hedefin:</Text>
              <Text style={styles.insightText}>{safeMoodJourney.personalInsights.nextMilestone}</Text>
            </View>
          </View>
        </View>

        {/* Encouragement */}
        <View style={styles.encouragementCard}>
          <Text style={styles.encouragementIcon}>🌟</Text>
          <Text style={styles.encouragementTitle}>Motivasyon Mesajın</Text>
          <Text style={styles.encouragementText}>
            {safeMoodJourney.personalInsights.encouragement}
          </Text>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsCard}>
          <Text style={styles.cardTitle}>🏆 Duygusal Başarıların</Text>
          {safeMoodJourney.achievements.map((achievement, index) => (
            <View key={index} style={styles.achievementRow}>
              <Text style={styles.achievementIcon}>{achievement.celebration}</Text>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
                <Text style={styles.achievementImpact}>💫 {achievement.impact}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };






  const renderPatternsSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Pattern Analysis */}
      <View style={styles.patternsCard}>
        <Text style={styles.cardTitle}>🔍 Mood Pattern Analizin</Text>
        
        {safeMoodJourney.patterns.length > 0 ? (
          safeMoodJourney.patterns.map((pattern, index) => (
            <View key={index} style={styles.patternItem}>
              <View style={styles.patternHeader}>
                <MaterialCommunityIcons 
                  name={
                    pattern.type === 'temporal' ? 'clock-outline' :
                    pattern.type === 'trigger' ? 'alert-circle-outline' :
                    pattern.type === 'environmental' ? 'earth' : 'chart-line'
                  } 
                  size={20} 
                  color={
                    pattern.severity === 'high' ? '#FF7043' :
                    pattern.severity === 'medium' ? '#FFA726' : '#4CAF50'
                  } 
                />
                <Text style={styles.patternTitle}>{pattern.title}</Text>
                <View style={[
                  styles.severityBadge,
                  {
                    backgroundColor: 
                      pattern.severity === 'high' ? '#FFE0DB' :
                      pattern.severity === 'medium' ? '#FFF3E0' : '#E8F5E8'
                  }
                ]}>
                  <Text style={[
                    styles.severityText,
                    {
                      color:
                        pattern.severity === 'high' ? '#D84315' :
                        pattern.severity === 'medium' ? '#E65100' : '#2E7D32'
                    }
                  ]}>
                    {pattern.severity === 'high' ? 'Yüksek' : 
                     pattern.severity === 'medium' ? 'Orta' : 'Düşük'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.patternDescription}>{pattern.description}</Text>
              
              {pattern.actionable && (
                <View style={styles.patternSuggestion}>
                  <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#7E57C2" />
                  <Text style={styles.patternSuggestionText}>{pattern.suggestion}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.noPatternsFound}>
            <MaterialCommunityIcons name="chart-line-variant" size={48} color="#E0E0E0" />
            <Text style={styles.noPatternsText}>
              Henüz yeterli veri toplanmadı.{'\n'}
              Daha fazla kayıt ile pattern'ler ortaya çıkacak.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderPredictionSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Risk Assessment */}
      <View style={styles.predictionCard}>
        <View style={styles.predictionHeader}>
          <MaterialCommunityIcons 
            name="crystal-ball" 
            size={24} 
            color={
              safeMoodJourney.prediction.riskLevel === 'high' ? '#FF7043' :
              safeMoodJourney.prediction.riskLevel === 'medium' ? '#FFA726' : '#4CAF50'
            } 
          />
          <Text style={styles.predictionTitle}>Mood Öngörüsü</Text>
          <View style={[
            styles.riskBadge,
            {
              backgroundColor: 
                safeMoodJourney.prediction.riskLevel === 'high' ? '#FFE0DB' :
                safeMoodJourney.prediction.riskLevel === 'medium' ? '#FFF3E0' : '#E8F5E8'
            }
          ]}>
            <Text style={[
              styles.riskText,
              {
                color:
                  safeMoodJourney.prediction.riskLevel === 'high' ? '#D84315' :
                  safeMoodJourney.prediction.riskLevel === 'medium' ? '#E65100' : '#2E7D32'
              }
            ]}>
              {safeMoodJourney.prediction.riskLevel === 'high' ? 'Yüksek Risk' :
               safeMoodJourney.prediction.riskLevel === 'medium' ? 'Orta Risk' : 'Düşük Risk'}
            </Text>
          </View>
        </View>
        
        {/* Early Warning */}
        {safeMoodJourney.prediction.earlyWarning?.triggered && (
          <View style={styles.warningSection}>
            <MaterialCommunityIcons name="alert" size={20} color="#FFA726" />
            <Text style={styles.warningText}>
              {safeMoodJourney.prediction.earlyWarning.message}
            </Text>
          </View>
        )}
        
        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <Text style={styles.recommendationTitle}>💡 Öneriler</Text>
          <Text style={styles.recommendationText}>
            {safeMoodJourney.prediction.recommendation}
          </Text>
        </View>
        
        {/* Interventions */}
        <View style={styles.interventionsSection}>
          <Text style={styles.interventionsTitle}>🛡️ Destekleyici Adımlar</Text>
          {safeMoodJourney.prediction.interventions.map((intervention, index) => (
            <View key={index} style={styles.interventionItem}>
              <MaterialCommunityIcons 
                name={
                  intervention.type === 'immediate' ? 'lightning-bolt-outline' :
                  intervention.type === 'preventive' ? 'shield-check-outline' : 'heart-outline'
                } 
                size={16} 
                color="#7E57C2" 
              />
              <Text style={styles.interventionText}>{intervention.action}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Next Action */}
      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>🎯 Bir Sonraki Adımın</Text>
        <Text style={styles.actionDescription}>
          {safeMoodJourney.personalInsights.actionableStep}
        </Text>
        
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStartAction?.('next_mood_step');
          }}
        >
          <MaterialCommunityIcons name="emoticon-happy-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Mood Kaydı Yap</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  // Combined Insights Section (Patterns + Prediction)
  const renderInsightsSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Pattern Analysis */}
      <View style={styles.patternsCard}>
        <Text style={styles.cardTitle}>🔍 Mood Pattern Analizin</Text>
        
        {safeMoodJourney.patterns.length > 0 ? (
          safeMoodJourney.patterns.map((pattern, index) => (
            <View key={index} style={styles.patternItem}>
              <View style={styles.patternHeader}>
                <MaterialCommunityIcons 
                  name={
                    pattern.type === 'temporal' ? 'clock-outline' :
                    pattern.type === 'trigger' ? 'alert-circle-outline' :
                    pattern.type === 'environmental' ? 'earth' : 'chart-line'
                  } 
                  size={20} 
                  color={
                    pattern.severity === 'high' ? '#FF7043' :
                    pattern.severity === 'medium' ? '#FFA726' : '#4CAF50'
                  } 
                />
                <Text style={styles.patternTitle}>{pattern.title}</Text>
                <View style={[
                  styles.severityBadge,
                  {
                    backgroundColor: 
                      pattern.severity === 'high' ? '#FFE0DB' :
                      pattern.severity === 'medium' ? '#FFF3E0' : '#E8F5E8'
                  }
                ]}>
                  <Text style={[
                    styles.severityText,
                    {
                      color:
                        pattern.severity === 'high' ? '#D84315' :
                        pattern.severity === 'medium' ? '#E65100' : '#2E7D32'
                    }
                  ]}>
                    {pattern.severity === 'high' ? 'Yüksek' : 
                     pattern.severity === 'medium' ? 'Orta' : 'Düşük'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.patternDescription}>{pattern.description}</Text>
              
              {pattern.actionable && (
                <View style={styles.patternSuggestion}>
                  <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#7E57C2" />
                  <Text style={styles.patternSuggestionText}>{pattern.suggestion}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.noPatternsFound}>
            <MaterialCommunityIcons name="chart-line-variant" size={48} color="#E0E0E0" />
            <Text style={styles.noPatternsText}>
              Henüz yeterli veri toplanmadı.{'\n'}
              Daha fazla kayıt ile pattern'ler ortaya çıkacak.
            </Text>
          </View>
        )}
      </View>

      {/* Risk Assessment & Prediction */}
      <View style={styles.predictionCard}>
        <View style={styles.predictionHeader}>
          <MaterialCommunityIcons 
            name="crystal-ball" 
            size={24} 
            color={
              safeMoodJourney.prediction.riskLevel === 'high' ? '#FF7043' :
              safeMoodJourney.prediction.riskLevel === 'medium' ? '#FFA726' : '#4CAF50'
            } 
          />
          <Text style={styles.predictionTitle}>Mood Öngörüsü</Text>
          <View style={[
            styles.riskBadge,
            {
              backgroundColor: 
                safeMoodJourney.prediction.riskLevel === 'high' ? '#FFE0DB' :
                safeMoodJourney.prediction.riskLevel === 'medium' ? '#FFF3E0' : '#E8F5E8'
            }
          ]}>
            <Text style={[
              styles.riskText,
              {
                color:
                  safeMoodJourney.prediction.riskLevel === 'high' ? '#D84315' :
                  safeMoodJourney.prediction.riskLevel === 'medium' ? '#E65100' : '#2E7D32'
              }
            ]}>
              {safeMoodJourney.prediction.riskLevel === 'high' ? 'Yüksek Risk' :
               safeMoodJourney.prediction.riskLevel === 'medium' ? 'Orta Risk' : 'Düşük Risk'}
            </Text>
          </View>
        </View>
        
        {/* Early Warning */}
        {safeMoodJourney.prediction.earlyWarning?.triggered && (
          <View style={styles.warningSection}>
            <MaterialCommunityIcons name="alert" size={20} color="#FFA726" />
            <Text style={styles.warningText}>
              {safeMoodJourney.prediction.earlyWarning.message}
            </Text>
          </View>
        )}
        
        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <Text style={styles.recommendationTitle}>💡 Öneriler</Text>
          <Text style={styles.recommendationText}>
            {safeMoodJourney.prediction.recommendation}
          </Text>
        </View>
        
        {/* Interventions */}
        <View style={styles.interventionsSection}>
          <Text style={styles.interventionsTitle}>🛡️ Destekleyici Adımlar</Text>
          {safeMoodJourney.prediction.interventions.map((intervention, index) => (
            <View key={index} style={styles.interventionItem}>
              <MaterialCommunityIcons 
                name={
                  intervention.type === 'immediate' ? 'lightning-bolt-outline' :
                  intervention.type === 'preventive' ? 'shield-check-outline' : 'heart-outline'
                } 
                size={16} 
                color="#7E57C2" 
              />
              <Text style={styles.interventionText}>{intervention.action}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Mood Dashboard</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        {renderInsightsSection()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 4,
  },

  sectionContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  
  // Hero Card
  heroCard: {
    backgroundColor: '#F8FAFC',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  journeyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'Inter',
  },
  statNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Wellbeing Card
  wellbeingCard: {
    backgroundColor: '#FAFAFA',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  progressComparison: {
    alignItems: 'center',
    marginBottom: 16,
  },
  progressSingle: {
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  progressImprovement: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Insight Card
  insightCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  insightText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
  },
  
  // Encouragement Card
  encouragementCard: {
    backgroundColor: '#FEF7FF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  encouragementIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7C3AED',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  encouragementText: {
    fontSize: 16,
    color: '#6B46C1',
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  
  // Achievements Card
  achievementsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    fontFamily: 'Inter',
  },
  achievementImpact: {
    fontSize: 14,
    color: '#059669',
    fontFamily: 'Inter',
  },
  

  
  // Timeline Card
  timelineCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weeklyTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  timelineDay: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  timelineMood: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  timelineDayLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  timelineHighlight: {
    fontSize: 10,
    color: '#059669',
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  timelineNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },
  
  // Patterns Card
  patternsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  patternItem: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  patternDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  patternSuggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7E57C2',
  },
  patternSuggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  noPatternsFound: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPatternsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Inter',
  },
  
  // Prediction Card
  predictionCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  predictionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    fontFamily: 'Inter',
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA726',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#E65100',
    fontFamily: 'Inter',
  },
  recommendationSection: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  recommendationText: {
    fontSize: 14,
    color: '#0284C7',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  interventionsSection: {
    marginBottom: 16,
  },
  interventionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  interventionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  interventionText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  
  // Action Card
  actionCard: {
    backgroundColor: '#DBEAFE',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  actionDescription: {
    fontSize: 14,
    color: '#1D4ED8',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },

  // 🎨 ENHANCED: Empty States & Enhanced Spectrum Styles
  // Empty State for no emotion data
  emptyStateCard: {
    backgroundColor: '#F8FAFC',
    padding: 32,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#7E57C2',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },

  // Weekly Empty State
  weeklyEmptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  weeklyEmptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  weeklyEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  weeklyEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Inter',
  },
  weeklyPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  placeholderDay: {
    alignItems: 'center',
  },
  placeholderDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  placeholderNote: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
  },

  // Weekly Summary (Min/Max insights)
  weeklySummary: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  summaryNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Inter',
  },
});
