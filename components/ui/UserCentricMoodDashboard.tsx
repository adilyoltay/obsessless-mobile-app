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
  moodJourney: UserMoodJourney;
  moodEntries: MoodEntry[];
  onStartAction?: (actionId: string) => void;
}

export default function UserCentricMoodDashboard({
  visible,
  onClose,
  moodJourney,
  moodEntries,
  onStartAction
}: UserCentricMoodDashboardProps) {
  
  const [selectedSection, setSelectedSection] = useState<'journey' | 'spectrum' | 'patterns' | 'prediction'>('journey');

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
    const growthBadge = getGrowthBadge(moodJourney.moodStory.emotionalGrowth);
    
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
              <Text style={styles.statNumber}>{moodJourney.moodStory.daysTracking}</Text>
              <Text style={styles.statLabel}>Gün</Text>
              <Text style={styles.statNote}>Takip ettin</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{moodJourney.moodStory.entriesCount}</Text>
              <Text style={styles.statLabel}>Kayıt</Text>
              <Text style={styles.statNote}>Oluşturdun</Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{moodJourney.moodStory.currentStreak}</Text>
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
                backgroundColor: getMoodColor(moodJourney.moodStory.averageMood) 
              }]}>
                <Text style={styles.progressNumber}>{moodJourney.moodStory.averageMood}</Text>
              </View>
            </View>
          </View>
          
          <Text style={styles.progressImprovement}>
            {moodJourney.moodStory.moodTrend === 'yükseliyor' && 'Mood eğiliminiz pozitif yönde. Bu güzel bir gelişim.'}
            {moodJourney.moodStory.moodTrend === 'stabil' && 'İstikrarlı bir mood düzeyindesin. Bu da değerli.'}
            {moodJourney.moodStory.moodTrend === 'düşüyor' && 'Zorlu bir dönemdesin. Bu geçici, kendine sabırlı ol.'}
          </Text>
        </View>

        {/* Personal Insights */}
        <View style={styles.insightCard}>
          <Text style={styles.cardTitle}>🧠 Sana Özel İçgörüler</Text>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#4CAF50" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>En Güçlü Pattern'in:</Text>
              <Text style={styles.insightText}>{moodJourney.personalInsights.strongestPattern}</Text>
            </View>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="target" size={20} color="#FF7043" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Odaklanılacak Alan:</Text>
              <Text style={styles.insightText}>{moodJourney.personalInsights.challengeArea}</Text>
            </View>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color="#7E57C2" />
            <View style={styles.insightContent}>
              <Text style={styles.insightLabel}>Sıradaki Hedefin:</Text>
              <Text style={styles.insightText}>{moodJourney.personalInsights.nextMilestone}</Text>
            </View>
          </View>
        </View>

        {/* Encouragement */}
        <View style={styles.encouragementCard}>
          <Text style={styles.encouragementIcon}>🌟</Text>
          <Text style={styles.encouragementTitle}>Motivasyon Mesajın</Text>
          <Text style={styles.encouragementText}>
            {moodJourney.personalInsights.encouragement}
          </Text>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsCard}>
          <Text style={styles.cardTitle}>🏆 Duygusal Başarıların</Text>
          {moodJourney.achievements.map((achievement, index) => (
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

  // 🎯 ENHANCED: Calculate min/max mood days with highlights
  /**
   * 🛡️ ROBUST DATA VALIDATION: Enhanced weekly colors with comprehensive validation
   * Fixes placeholder detection and handles corrupted data gracefully
   */
  const getEnhancedWeeklyColors = () => {
    const colors = moodJourney.emotionalSpectrum.weeklyColors;
    
    if (!colors || colors.length === 0) {
      return { enhancedColors: [], minDay: null, maxDay: null, hasData: false };
    }
    
    // 🔍 ENHANCED: Multi-criteria placeholder detection
    const isPlaceholderDay = (day: any) => {
      // Null or undefined mood
      if (day.mood == null) return true;
      
      // Invalid mood range (must be 0-100)
      if (typeof day.mood !== 'number' || day.mood < 0 || day.mood > 100) return true;
      
      // Common placeholder values
      if (day.mood === 50 || day.mood === 0) return true;
      
      // Missing or invalid day identifier
      if (!day.day || typeof day.day !== 'string') return true;
      
      // Invalid color (suggests generated placeholder)
      if (!day.color || day.color === '#66BB6A' || day.color === '#E5E7EB') return true;
      
      return false;
    };
    
    // 🔍 ENHANCED: Find actual mood days with robust validation
    const realDays = colors.filter(day => {
      try {
        return !isPlaceholderDay(day);
      } catch (error) {
        console.warn('⚠️ Invalid day data detected, treating as placeholder:', day);
        return false;
      }
    });
    
    console.log(`📊 Spectrum validation: ${realDays.length}/${colors.length} real days, ${colors.length - realDays.length} placeholders`);
    
    if (realDays.length === 0) {
      console.log('📊 No real mood data found - all days are placeholders');
      return { 
        enhancedColors: colors.map(day => ({ ...day, isPlaceholder: true })), 
        minDay: null, 
        maxDay: null, 
        hasData: false,
        validationWarning: 'No valid mood data found'
      };
    }
    
    // 🔍 ENHANCED: Safe min/max calculation with error handling
    let minMoodDay, maxMoodDay;
    try {
      minMoodDay = realDays.reduce((min, current) => {
        if (typeof current.mood !== 'number' || typeof min.mood !== 'number') {
          console.warn('⚠️ Invalid mood data in min calculation:', { current, min });
          return min;
        }
        return current.mood < min.mood ? current : min;
      });
      
      maxMoodDay = realDays.reduce((max, current) => {
        if (typeof current.mood !== 'number' || typeof max.mood !== 'number') {
          console.warn('⚠️ Invalid mood data in max calculation:', { current, max });
          return max;
        }
        return current.mood > max.mood ? current : max;
      });
    } catch (error) {
      console.error('❌ Error calculating min/max mood days:', error);
      return { 
        enhancedColors: colors.map(day => ({ ...day, isPlaceholder: isPlaceholderDay(day) })), 
        minDay: null, 
        maxDay: null, 
        hasData: false,
        validationError: 'Failed to calculate min/max values'
      };
    }
    
    // 🎯 ENHANCED: Mood difference threshold for meaningful highlights
    const moodDifference = maxMoodDay.mood - minMoodDay.mood;
    const shouldHighlight = moodDifference >= 10; // Only highlight if there's significant difference
    
    // 🎨 ENHANCED: Enhanced colors with better validation
    const enhancedColors = colors.map(day => {
      const isPlaceholder = isPlaceholderDay(day);
      let enhancedHighlight = day.highlight;
      let isMinDay = false;
      let isMaxDay = false;
      
      // Only highlight real days with significant mood differences
      if (!isPlaceholder && shouldHighlight) {
        try {
          if (day.day === minMoodDay.day && Math.abs(day.mood - minMoodDay.mood) < 0.1) {
            enhancedHighlight = `📉 En düşük (${Math.round(day.mood)})`;
            isMinDay = true;
          } else if (day.day === maxMoodDay.day && Math.abs(day.mood - maxMoodDay.mood) < 0.1) {
            enhancedHighlight = `📈 En yüksek (${Math.round(day.mood)})`;
            isMaxDay = true;
          }
        } catch (error) {
          console.warn('⚠️ Error enhancing day highlight:', day, error);
        }
      }
      
      return {
        ...day,
        highlight: enhancedHighlight,
        isMinDay,
        isMaxDay,
        isPlaceholder,
        // 🛡️ VALIDATION: Ensure mood is within valid range
        mood: isPlaceholder ? (day.mood || 50) : Math.max(0, Math.min(100, day.mood || 50))
      };
    });
    
    console.log('✅ Enhanced weekly colors calculated:', {
      total: colors.length,
      real: realDays.length,
      minMood: minMoodDay.mood,
      maxMood: maxMoodDay.mood,
      difference: moodDifference,
      highlighted: shouldHighlight
    });
    
    return {
      enhancedColors,
      minDay: minMoodDay,
      maxDay: maxMoodDay,
      hasData: realDays.length > 0,
      realDaysCount: realDays.length,
      moodDifference,
      shouldHighlight,
      validationPassed: true
    };
  };

  const renderSpectrumSection = () => {
    const weeklyData = getEnhancedWeeklyColors();
    const hasEmotionData = moodJourney.emotionalSpectrum.emotionDistribution.length > 0;

    return (
      <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
        {/* 🚨 EMPTY STATE: No mood data */}
        {!hasEmotionData && !weeklyData.hasData && (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateIcon}>🎨</Text>
            <Text style={styles.emptyStateTitle}>Renk Spektrumunu Keşfet</Text>
            <Text style={styles.emptyStateText}>
              Mood kayıtları yaptıkça burada güzel bir renk spektrumu oluşacak. 
              Her duygu farklı bir renge karşılık geliyor!
            </Text>
            <Text style={styles.emptyStateHint}>
              💡 En az 3 mood kaydı yap ki spektrumun şekillensin
            </Text>
          </View>
        )}

        {/* Color Spectrum Analysis */}
        {hasEmotionData && (
          <View style={styles.spectrumCard}>
            <Text style={styles.cardTitle}>🎨 Duygu Renk Spektrumun</Text>
            
            {/* Dominant Emotion */}
            <View style={styles.dominantEmotionCard}>
              <Text style={styles.dominantEmotionTitle}>Baskın Duygun</Text>
              <Text style={styles.dominantEmotionValue}>{moodJourney.emotionalSpectrum.dominantEmotion}</Text>
            </View>
            
            {/* Color Spectrum Bar */}
            <LinearGradient
              colors={['#F06292', '#FF7043', '#FFA726', '#66BB6A', '#4CAF50', '#26A69A', '#5C6BC0', '#7E57C2', '#C2185B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.spectrumBar}
            />
            
            {/* Emotion Distribution */}
            <View style={styles.emotionDistribution}>
              {moodJourney.emotionalSpectrum.emotionDistribution.map((emotion, index) => (
                <View key={index} style={styles.emotionItem}>
                  <View style={[styles.emotionDot, { backgroundColor: emotion.color }]} />
                  <Text style={styles.emotionLabel}>{emotion.emotion}</Text>
                  <Text style={styles.emotionPercentage}>{emotion.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Weekly Color Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>📅 Haftalık Renk Hikayesi</Text>
          
          {!weeklyData.hasData ? (
            // 🚨 EMPTY STATE: No weekly data
            <View style={styles.weeklyEmptyState}>
              <Text style={styles.weeklyEmptyIcon}>📅</Text>
              <Text style={styles.weeklyEmptyTitle}>Haftalık Hikayeni Oluştur</Text>
              <Text style={styles.weeklyEmptyText}>
                Bu hafta mood kayıtları yap ve her günün kendine özgü rengini keşfet!
              </Text>
              <View style={styles.weeklyPlaceholder}>
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, index) => (
                  <View key={index} style={styles.placeholderDay}>
                    <View style={[styles.placeholderDot, { opacity: 0.3 }]} />
                    <Text style={[styles.timelineDayLabel, { opacity: 0.5 }]}>{day}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <>
              {/* 📊 WEEKLY SUMMARY: Min/Max insights */}
              {weeklyData.hasData && weeklyData.minDay && weeklyData.maxDay && (
                <View style={styles.weeklySummary}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>📈 En iyi gün:</Text>
                    <Text style={styles.summaryValue}>
                      {weeklyData.maxDay.day} ({weeklyData.maxDay.mood}/100)
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>📉 Zorlu gün:</Text>
                    <Text style={styles.summaryValue}>
                      {weeklyData.minDay.day} ({weeklyData.minDay.mood}/100)
                    </Text>
                  </View>
                  <Text style={styles.summaryNote}>
                    {weeklyData.realDaysCount}/7 gün kaydedildi
                  </Text>
                </View>
              )}
              
              <View style={styles.weeklyTimeline}>
                {weeklyData.enhancedColors.map((day, index) => (
                  <View key={index} style={styles.timelineDay}>
                    <View style={[
                      styles.timelineDot, 
                      { 
                        backgroundColor: day.isPlaceholder ? '#E0E0E0' : day.color,
                        borderWidth: day.isMinDay || day.isMaxDay ? 2 : 0,
                        borderColor: day.isMaxDay ? '#4CAF50' : day.isMinDay ? '#FF7043' : 'transparent'
                      }
                    ]}>
                      <Text style={[
                        styles.timelineMood,
                        { opacity: day.isPlaceholder ? 0.5 : 1 }
                      ]}>
                        {day.isPlaceholder ? '?' : day.mood}
                      </Text>
                    </View>
                    <Text style={styles.timelineDayLabel}>{day.day}</Text>
                    {day.highlight && (
                      <Text style={[
                        styles.timelineHighlight,
                        { 
                          color: day.isMaxDay ? '#4CAF50' : day.isMinDay ? '#FF7043' : '#7E57C2'
                        }
                      ]}>
                        {day.highlight}
                      </Text>
                    )}
                    {day.isPlaceholder && (
                      <Text style={styles.placeholderNote}>Kayıt yok</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
          
          <Text style={styles.timelineNote}>
            {weeklyData.hasData 
              ? 'Her renk o günkü baskın duygunu temsil ediyor. Yeşil çerçeve en yüksek, kırmızı çerçeve en düşük mood.'
              : 'Mood kayıtları yaptıkça her gün farklı renklerle dolacak!'
            }
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderPatternsSection = () => (
    <ScrollView style={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Pattern Analysis */}
      <View style={styles.patternsCard}>
        <Text style={styles.cardTitle}>🔍 Mood Pattern Analizin</Text>
        
        {moodJourney.patterns.length > 0 ? (
          moodJourney.patterns.map((pattern, index) => (
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
              moodJourney.prediction.riskLevel === 'high' ? '#FF7043' :
              moodJourney.prediction.riskLevel === 'medium' ? '#FFA726' : '#4CAF50'
            } 
          />
          <Text style={styles.predictionTitle}>Mood Öngörüsü</Text>
          <View style={[
            styles.riskBadge,
            {
              backgroundColor: 
                moodJourney.prediction.riskLevel === 'high' ? '#FFE0DB' :
                moodJourney.prediction.riskLevel === 'medium' ? '#FFF3E0' : '#E8F5E8'
            }
          ]}>
            <Text style={[
              styles.riskText,
              {
                color:
                  moodJourney.prediction.riskLevel === 'high' ? '#D84315' :
                  moodJourney.prediction.riskLevel === 'medium' ? '#E65100' : '#2E7D32'
              }
            ]}>
              {moodJourney.prediction.riskLevel === 'high' ? 'Yüksek Risk' :
               moodJourney.prediction.riskLevel === 'medium' ? 'Orta Risk' : 'Düşük Risk'}
            </Text>
          </View>
        </View>
        
        {/* Early Warning */}
        {moodJourney.prediction.earlyWarning?.triggered && (
          <View style={styles.warningSection}>
            <MaterialCommunityIcons name="alert" size={20} color="#FFA726" />
            <Text style={styles.warningText}>
              {moodJourney.prediction.earlyWarning.message}
            </Text>
          </View>
        )}
        
        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <Text style={styles.recommendationTitle}>💡 Öneriler</Text>
          <Text style={styles.recommendationText}>
            {moodJourney.prediction.recommendation}
          </Text>
        </View>
        
        {/* Interventions */}
        <View style={styles.interventionsSection}>
          <Text style={styles.interventionsTitle}>🛡️ Destekleyici Adımlar</Text>
          {moodJourney.prediction.interventions.map((intervention, index) => (
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
          {moodJourney.personalInsights.actionableStep}
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

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <Pressable
            style={[styles.tabButton, selectedSection === 'journey' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('journey');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'journey' && styles.tabTextActive]}>
              🌟 Yolculuk
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabButton, selectedSection === 'spectrum' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('spectrum');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'spectrum' && styles.tabTextActive]}>
              🎨 Spektrum
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabButton, selectedSection === 'patterns' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('patterns');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'patterns' && styles.tabTextActive]}>
              🔍 Pattern
            </Text>
          </Pressable>
          
          <Pressable
            style={[styles.tabButton, selectedSection === 'prediction' && styles.tabButtonActive]}
            onPress={() => {
              setSelectedSection('prediction');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[styles.tabText, selectedSection === 'prediction' && styles.tabTextActive]}>
              🔮 Öngörü
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        {selectedSection === 'journey' && renderJourneySection()}
        {selectedSection === 'spectrum' && renderSpectrumSection()}
        {selectedSection === 'patterns' && renderPatternsSection()}
        {selectedSection === 'prediction' && renderPredictionSection()}
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
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 4,
    paddingVertical: 4,
    margin: 16,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  tabTextActive: {
    color: '#374151',
    fontWeight: '600',
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
  
  // Spectrum Card
  spectrumCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dominantEmotionCard: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  dominantEmotionTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  dominantEmotionValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'Inter',
  },
  spectrumBar: {
    height: 40,
    borderRadius: 20,
    marginBottom: 20,
  },
  emotionDistribution: {
    gap: 12,
  },
  emotionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  emotionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  emotionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  emotionPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
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
