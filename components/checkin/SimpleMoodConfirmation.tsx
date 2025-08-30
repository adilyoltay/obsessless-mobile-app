/**
 * SimpleMoodConfirmation - Minimal mood confirmation interface
 * 
 * Karmaşık analiz detayları olmadan, sadece temel mood bilgileri
 * ve kullanıcı onayı için basit arayüz
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { MoodAnalysisResult } from '@/services/voiceCheckInHeuristicService';

interface SimpleMoodConfirmationProps {
  analysis: MoodAnalysisResult;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SimpleMoodConfirmation({
  analysis,
  onConfirm,
  onCancel,
}: SimpleMoodConfirmationProps) {

  // 🎯 Score to emoji mapping
  const getMoodEmoji = (score: number): string => {
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    return '😔';
  };

  const getEnergyEmoji = (score: number): string => {
    if (score >= 8) return '⚡';
    if (score >= 6) return '🔋';
    if (score >= 4) return '🪫';
    return '😴';
  };

  const getAnxietyEmoji = (score: number): string => {
    if (score <= 3) return '😌';
    if (score <= 6) return '😬';
    return '😰';
  };

  // 🎨 Emotion display name (simplified)
  const getSimpleEmotion = (emotion: string): string => {
    const simpleMap: { [key: string]: string } = {
      'çok_mutlu': 'Çok Mutlu',
      'mutlu': 'Mutlu',
      'enerjik': 'Enerjik',
      'sakin': 'Sakin',
      'kararlı': 'Kararlı',
      'heyecanlı': 'Heyecanlı',
      'kaygılı': 'Kaygılı',
      'üzgün': 'Üzgün',
      'yorgun': 'Yorgun',
      'sinirli': 'Sinirli',
      'nötr': 'Normal',
    };
    return simpleMap[emotion] || 'Normal';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sesli Check-in Sonucu</Text>
        <Text style={styles.headerSubtitle}>Bu bilgilerle mood kaydınızı oluşturalım mı?</Text>
      </View>

      {/* Main Results Card */}
      <Card style={styles.resultsCard}>
        <View style={styles.resultsGrid}>
          {/* Mood */}
          <View style={styles.resultItem}>
            <Text style={styles.resultEmoji}>{getMoodEmoji(analysis.moodScore)}</Text>
            <Text style={styles.resultLabel}>Ruh Hali</Text>
            <Text style={styles.resultValue}>{analysis.moodScore}/10</Text>
          </View>

          {/* Energy */}
          <View style={styles.resultItem}>
            <Text style={styles.resultEmoji}>{getEnergyEmoji(analysis.energyLevel)}</Text>
            <Text style={styles.resultLabel}>Enerji</Text>
            <Text style={styles.resultValue}>{analysis.energyLevel}/10</Text>
          </View>

          {/* Anxiety */}
          <View style={styles.resultItem}>
            <Text style={styles.resultEmoji}>{getAnxietyEmoji(analysis.anxietyLevel)}</Text>
            <Text style={styles.resultLabel}>Anksiyete</Text>
            <Text style={styles.resultValue}>{analysis.anxietyLevel}/10</Text>
          </View>
        </View>

        {/* Dominant Emotion */}
        <View style={styles.emotionContainer}>
          <Text style={styles.emotionLabel}>Ana duygu:</Text>
          <Text style={styles.emotionValue}>
            {getSimpleEmotion(analysis.dominantEmotion)}
          </Text>
        </View>

        {/* Triggers (if any) */}
        {analysis.triggers.length > 0 && analysis.triggers[0] !== 'sesli_checkin' && (
          <View style={styles.triggersContainer}>
            <Text style={styles.triggersLabel}>Tetikleyici:</Text>
            <Text style={styles.triggersValue}>
              {analysis.triggers.slice(0, 2).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
          <Text style={styles.cancelButtonText}>İptal</Text>
        </Pressable>
        
        <Pressable style={styles.confirmButton} onPress={onConfirm}>
          <MaterialCommunityIcons name="check-bold" size={20} color="#FFFFFF" />
          <Text style={styles.confirmButtonText}>Mood Kaydet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Results
  resultsCard: {
    marginBottom: 24,
  },
  resultsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  resultEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'Inter',
  },

  // Emotion
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 12,
  },
  emotionLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginRight: 8,
  },
  emotionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'Inter',
  },

  // Triggers
  triggersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  triggersLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginRight: 8,
  },
  triggersValue: {
    fontSize: 13,
    color: '#F59E0B',
    fontFamily: 'Inter',
    fontWeight: '500',
  },

  // Actions
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
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
    paddingVertical: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
