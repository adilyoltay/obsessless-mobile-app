/**
 * MoodConfirmationCard - Voice Check-in Analysis Result Confirmation
 * 
 * Ses analizi sonrası kullanıcıya analiz sonuçlarını gösterir ve 
 * mood kaydı oluşturma için onay alır.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { MoodAnalysisResult } from '@/services/voiceCheckInHeuristicService';

interface MoodConfirmationCardProps {
  analysis: MoodAnalysisResult;
  transcribedText: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: (field: string, value: any) => void;
}

export default function MoodConfirmationCard({
  analysis,
  transcribedText,
  onConfirm,
  onCancel,
  onEdit,
}: MoodConfirmationCardProps) {

  // 🎯 Score to color mapping
  const getScoreColor = (score: number, type: 'mood' | 'energy' | 'anxiety'): string => {
    if (type === 'anxiety') {
      // Anxiety: Lower is better
      if (score <= 3) return '#10B981'; // Green (low anxiety)
      if (score <= 6) return '#F59E0B'; // Yellow (medium)
      return '#EF4444'; // Red (high anxiety)
    } else {
      // Mood & Energy: Higher is better
      if (score >= 7) return '#10B981'; // Green (good)
      if (score >= 4) return '#F59E0B'; // Yellow (medium)
      return '#EF4444'; // Red (low)
    }
  };

  // 🎭 ENHANCED Emotion icon mapping (v3.0)
  const getEmotionIcon = (emotion: string): string => {
    const iconMap: { [key: string]: string } = {
      // Existing emotions
      'çok_mutlu': 'emoticon-excited',
      'mutlu': 'emoticon-happy',
      'umutlu': 'emoticon-outline',
      'sakin': 'emoticon-cool',
      'enerjik': 'lightning-bolt',
      'karışık': 'emoticon-confused',
      'yorgun': 'emoticon-sad',
      'üzgün': 'emoticon-cry',
      'depresif': 'emoticon-dead',
      'kaygılı': 'emoticon-frown',
      'panik': 'emoticon-dead',
      'sinirli': 'emoticon-angry',
      'öfkeli': 'emoticon-devil',
      'bitkin': 'emoticon-neutral',
      'nötr': 'emoticon-neutral',
      
      // NEW emotions (v3.0)
      'şaşkın': 'emoticon-confused-outline',
      'suçlu': 'emoticon-sad-outline',
      'kıskanç': 'emoticon-angry-outline',
      'kararlı': 'target',
      'boş': 'emoticon-neutral-outline',
      'gururlu': 'crown',
      'utanmış': 'emoticon-sad',
      'heyecanlı': 'emoticon-excited-outline',
      'meraklı': 'help-circle-outline',
    };
    return iconMap[emotion] || 'emoticon-neutral';
  };

  // 🎨 ENHANCED Emotion display name (v3.0)
  const getEmotionDisplayName = (emotion: string): string => {
    const displayMap: { [key: string]: string } = {
      // Existing emotions
      'çok_mutlu': 'Çok Mutlu',
      'mutlu': 'Mutlu',
      'umutlu': 'Umutlu', 
      'sakin': 'Sakin',
      'enerjik': 'Enerjik',
      'karışık': 'Karışık',
      'yorgun': 'Yorgun',
      'üzgün': 'Üzgün',
      'depresif': 'Depresif',
      'kaygılı': 'Kaygılı',
      'panik': 'Panikli',
      'sinirli': 'Sinirli',
      'öfkeli': 'Öfkeli',
      'bitkin': 'Bitkin',
      'nötr': 'Nötr',
      
      // NEW emotions (v3.0)
      'şaşkın': 'Şaşkın',
      'suçlu': 'Suçlu',
      'kıskanç': 'Kıskanç',
      'kararlı': 'Kararlı',
      'boş': 'Boş/Hissiz',
      'gururlu': 'Gururlu',
      'utanmış': 'Utanmış',
      'heyecanlı': 'Heyecanlı',
      'meraklı': 'Meraklı',
    };
    return displayMap[emotion] || emotion;
  };

  // 🔧 ENHANCED Trigger display mapping (v3.0)
  const getTriggerDisplayName = (trigger: string): string => {
    const triggerMap: { [key: string]: string } = {
      // Existing triggers
      'iş_yoğun_stres': 'İş Yoğunluk Stresi',
      'iş_stres': 'İş Stresi',
      'ilişki_krizi': 'İlişki Krizi',
      'aile_ilişki': 'Aile İlişkileri',
      'finansal_kriz': 'Finansal Kriz',
      'finansal_kaygı': 'Finansal Kaygı',
      'ciddi_sağlık': 'Ciddi Sağlık Sorunu',
      'sağlık_endişe': 'Sağlık Endişesi',
      'eğitim_stres': 'Eğitim Stresi',
      'sosyal_kaygı': 'Sosyal Kaygı',
      'gelecek_kaygısı': 'Gelecek Kaygısı',
      'sesli_checkin': 'Sesli Check-in',
      
      // NEW triggers (v3.0)
      'siyasi_gündem': 'Siyasi Gündem',
      'haber_medya': 'Haber/Medya',
      'afet_travma': 'Afet/Travma',
      'ekonomik_durum': 'Ekonomik Durum',
      'dijital_bağlantı': 'Bağlantı Sorunu',
      'teknoloji_arıza': 'Teknoloji Arızası',
      'sosyal_medya': 'Sosyal Medya',
      'dijital_çalışma': 'Dijital Çalışma',
      'yalnızlık_destek': 'Yalnızlık/Destek Eksikliği',
      'sosyal_izolasyon': 'Sosyal İzolasyon',
      'duygusal_ihmal': 'Duygusal İhmal',
      'manevi_ibadet': 'Manevi/İbadet',
      'manevi_destek': 'Manevi Destek',
      'dini_özel_gün': 'Dini Özel Gün',
      'konut_problemi': 'Konut Problemi',
      'ev_sorumluluğu': 'Ev Sorumluluğu',
      'ulaşım_sorunu': 'Ulaşım Sorunu',
      'araç_problemi': 'Araç Problemi',
    };
    return triggerMap[trigger] || trigger;
  };

  // 🏃 ENHANCED Activity display mapping (v3.0)
  const getActivityDisplayName = (activity: string): string => {
    const activityMap: { [key: string]: string } = {
      // Existing activities
      'yoğun_egzersiz': 'Yoğun Egzersiz',
      'egzersiz': 'Egzersiz',
      'kutlama_eğlence': 'Kutlama/Eğlence',
      'sosyal_aktivite': 'Sosyal Aktivite',
      'mindfulness': 'Mindfulness/Meditasyon',
      'nefes_egzersizi': 'Nefes Egzersizi',
      'okuma': 'Okuma',
      'müzik': 'Müzik',
      'doğa_aktivite': 'Doğa Aktivitesi',
      'dinlenme': 'Dinlenme/İstirahat',
      'yemek_yapma': 'Yemek Yapma',
      'ev_düzeni': 'Ev Düzeni',
      
      // NEW activities (v3.0)
      'evcil_hayvan': 'Evcil Hayvan',
      'hayvan_bakım': 'Hayvan Bakımı',
      'resim_sanat': 'Resim/Sanat',
      'yazma_sanat': 'Yazma/Sanat',
      'okuma_detay': 'Okuma',
      'el_sanatı': 'El Sanatı',
      'fotoğrafçılık': 'Fotoğrafçılık',
      'sosyal_yemek': 'Sosyal Yemek',
      'içecek_sohbet': 'İçecek/Sohbet',
      'grup_yemek': 'Grup Yemeği',
      'ev_yemeği': 'Ev Yemeği',
      'dijital_oyun': 'Dijital Oyun',
      'konsol_oyun': 'Konsol Oyunu',
      'mobil_oyun': 'Mobil Oyun',
      'masa_oyunu': 'Masa Oyunu',
      'kültür_sanat': 'Kültür/Sanat',
      'müze_sergi': 'Müze/Sergi',
      'müzik_konser': 'Müzik/Konser',
      'alışveriş': 'Alışveriş',
      'kişisel_bakım': 'Kişisel Bakım',
      'spa_relax': 'Spa/Relax',
      'eğitim_gelişim': 'Eğitim/Gelişim',
      'dil_öğrenme': 'Dil Öğrenme',
    };
    return activityMap[activity] || activity;
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="brain" size={24} color="#3B82F6" />
          <Text style={styles.headerTitle}>Analiz Sonucu</Text>
          <Text style={styles.confidenceText}>
            %{(analysis.confidence * 100).toFixed(0)} güvenlik
          </Text>
        </View>

        {/* Transcribed Text */}
        <Card style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>Söyledikleriniz:</Text>
          <Text style={styles.transcriptText}>"{transcribedText}"</Text>
        </Card>

        {/* Main Metrics */}
        <Card style={styles.metricsCard}>
          <Text style={styles.metricsTitle}>📊 Değerlendirme Sonuçları</Text>
          
          <View style={styles.metricsGrid}>
            {/* Mood Score */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialCommunityIcons name="heart" size={20} color={getScoreColor(analysis.moodScore, 'mood')} />
                <Text style={styles.metricLabel}>Ruh Hali</Text>
              </View>
              <Text style={[styles.metricValue, { color: getScoreColor(analysis.moodScore, 'mood') }]}>
                {analysis.moodScore}/10
              </Text>
            </View>

            {/* Energy Level */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color={getScoreColor(analysis.energyLevel, 'energy')} />
                <Text style={styles.metricLabel}>Enerji</Text>
              </View>
              <Text style={[styles.metricValue, { color: getScoreColor(analysis.energyLevel, 'energy') }]}>
                {analysis.energyLevel}/10
              </Text>
            </View>

            {/* Anxiety Level */}
            <View style={styles.metricItem}>
              <View style={styles.metricHeader}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={getScoreColor(analysis.anxietyLevel, 'anxiety')} />
                <Text style={styles.metricLabel}>Anksiyete</Text>
              </View>
              <Text style={[styles.metricValue, { color: getScoreColor(analysis.anxietyLevel, 'anxiety') }]}>
                {analysis.anxietyLevel}/10
              </Text>
            </View>
          </View>
        </Card>

        {/* Emotion */}
        <Card style={styles.emotionCard}>
          <View style={styles.emotionContainer}>
            <MaterialCommunityIcons 
              name={getEmotionIcon(analysis.dominantEmotion)} 
              size={32} 
              color="#3B82F6" 
            />
            <View>
              <Text style={styles.emotionLabel}>Ana Duygu</Text>
              <Text style={styles.emotionValue}>
                {getEmotionDisplayName(analysis.dominantEmotion)}
              </Text>
            </View>
            <View style={styles.intensityBadge}>
              <Text style={styles.intensityText}>
                {analysis.analysisDetails.intensity === 'high' && '🌡️ Yüksek'}
                {analysis.analysisDetails.intensity === 'medium' && '🌡️ Orta'}
                {analysis.analysisDetails.intensity === 'low' && '🌡️ Düşük'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Triggers */}
        {analysis.triggers.length > 0 && (
          <Card style={styles.entityCard}>
            <Text style={styles.entityTitle}>🎯 Tespit Edilen Tetikleyiciler</Text>
            <View style={styles.entityList}>
              {analysis.triggers.map((trigger, index) => (
                <View key={index} style={styles.entityBadge}>
                  <Text style={styles.entityBadgeText}>
                    {getTriggerDisplayName(trigger)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Activities */}
        {analysis.activities.length > 0 && (
          <Card style={styles.entityCard}>
            <Text style={styles.entityTitle}>💪 Tespit Edilen Aktiviteler</Text>
            <View style={styles.entityList}>
              {analysis.activities.map((activity, index) => (
                <View key={index} style={[styles.entityBadge, styles.activityBadge]}>
                  <Text style={[styles.entityBadgeText, styles.activityBadgeText]}>
                    {getActivityDisplayName(activity)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Analysis Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>🔍 Analiz Detayları</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Genel Sentiment:</Text>
            <View style={[
              styles.sentimentBadge, 
              { backgroundColor: 
                analysis.analysisDetails.sentiment === 'positive' ? '#DCFCE7' :
                analysis.analysisDetails.sentiment === 'negative' ? '#FEE2E2' : '#F3F4F6'
              }
            ]}>
              <Text style={[
                styles.sentimentText,
                { color:
                  analysis.analysisDetails.sentiment === 'positive' ? '#166534' :
                  analysis.analysisDetails.sentiment === 'negative' ? '#991B1B' : '#4B5563'
                }
              ]}>
                {analysis.analysisDetails.sentiment === 'positive' && '😊 Pozitif'}
                {analysis.analysisDetails.sentiment === 'negative' && '😟 Negatif'}
                {analysis.analysisDetails.sentiment === 'neutral' && '😐 Nötr'}
              </Text>
            </View>
          </View>

          {analysis.analysisDetails.keywords.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Anahtar Kelimeler:</Text>
              <Text style={styles.keywordsList}>
                {analysis.analysisDetails.keywords.slice(0, 8).join(', ')}
                {analysis.analysisDetails.keywords.length > 8 && '...'}
              </Text>
            </View>
          )}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <Text style={styles.actionPrompt}>
            Bu bilgilerle mood kaydınızı oluşturalım mı?
          </Text>
          
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
              <Text style={styles.cancelButtonText}>İptal</Text>
            </Pressable>
            
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: '80%',
  },
  scrollView: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },

  // Transcript
  transcriptCard: {
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  transcriptLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Metrics
  metricsCard: {
    marginBottom: 12,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter',
  },

  // Emotion
  emotionCard: {
    marginBottom: 12,
    backgroundColor: '#EFF6FF',
  },
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emotionLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  emotionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D4ED8',
    fontFamily: 'Inter',
  },
  intensityBadge: {
    marginLeft: 'auto',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  intensityText: {
    fontSize: 11,
    color: '#1E40AF',
    fontFamily: 'Inter',
  },

  // Entities
  entityCard: {
    marginBottom: 12,
  },
  entityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  entityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  entityBadgeText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: 'Inter',
  },
  activityBadge: {
    backgroundColor: '#D1FAE5',
  },
  activityBadgeText: {
    color: '#065F46',
  },

  // Details
  detailsCard: {
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    flex: 1,
  },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  sentimentText: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  keywordsList: {
    fontSize: 12,
    color: '#4B5563',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    flex: 2,
    textAlign: 'right',
  },

  // Actions
  actionContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  actionPrompt: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
