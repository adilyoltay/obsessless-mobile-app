/**
 * Debug Voice Analysis Screen
 * 
 * Heuristic mood analysis servisini test etmek için debug ekranı.
 * /debug-voice-analysis URL'i ile erişim.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Card } from '@/components/ui/Card';
import voiceCheckInHeuristicService, { type MoodAnalysisResult } from '@/services/voiceCheckInHeuristicService';

export default function DebugVoiceAnalysis() {
  const [inputText, setInputText] = useState('');
  const [analysisResult, setAnalysisResult] = useState<MoodAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const sampleTexts = [
    'Bugün kendimi çok mutlu ve enerjik hissediyorum. Arkadaşlarımla buluştuk ve harika zaman geçirdik.',
    'Biraz kaygılı ve stresli hissediyorum. İş yerindeki projeler kafamı meşgul ediyor.',
    'Çok yorgun ve bitkinim. Enerji seviyem düşük, sadece dinlenmek istiyorum.',
    'Üzgün ve melankolik hissediyorum. Bazı kararlar vermekte zorlanıyorum.',
    'Karışık duygularım var. Bir yandan mutlu ama diğer yandan da endişeliyim.',
    'Harika bir gün! Spor yaptım, arkadaşlarla buluştum ve kendimi süper hissediyorum.',
    'Aşırı sinirli ve gerginim. Her şey kafamda, odaklanamıyorum.',
    'Sakin ve huzurluyum. Meditasyon yaptım ve nefes egzersizleri çok iyi geldi.',
  ];

  const runAnalysis = async (text: string) => {
    if (!text.trim()) {
      Alert.alert('Hata', 'Lütfen analiz edilecek metin girin.');
      return;
    }

    setLoading(true);
    try {
      const result = await voiceCheckInHeuristicService.testAnalysis(text);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      Alert.alert('Hata', 'Analiz başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    const { analysisDetails } = analysisResult;

    return (
      <Card style={styles.resultCard}>
        <Text style={styles.resultTitle}>📊 Analiz Sonucu</Text>
        
        {/* Main Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Mood Score</Text>
            <Text style={styles.metricValue}>{analysisResult.moodScore}/10</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Enerji</Text>
            <Text style={styles.metricValue}>{analysisResult.energyLevel}/10</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Anksiyete</Text>
            <Text style={styles.metricValue}>{analysisResult.anxietyLevel}/10</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Güven</Text>
            <Text style={styles.metricValue}>{(analysisResult.confidence * 100).toFixed(0)}%</Text>
          </View>
        </View>

        {/* Emotion & Sentiment */}
        <View style={styles.emotionContainer}>
          <Text style={styles.emotionText}>
            🎭 <Text style={styles.emotionValue}>{analysisResult.dominantEmotion}</Text>
          </Text>
          <Text style={styles.sentimentText}>
            📊 Genel: <Text style={styles.sentimentValue}>{analysisDetails.sentiment}</Text>
          </Text>
          <Text style={styles.intensityText}>
            🌡️ Yoğunluk: <Text style={styles.intensityValue}>{analysisDetails.intensity}</Text>
          </Text>
        </View>

        {/* Triggers & Activities */}
        {analysisResult.triggers.length > 0 && (
          <View style={styles.entitySection}>
            <Text style={styles.entityTitle}>🎯 Tetikleyiciler:</Text>
            {analysisResult.triggers.map((trigger, index) => (
              <Text key={index} style={styles.entityItem}>• {trigger}</Text>
            ))}
          </View>
        )}

        {analysisResult.activities.length > 0 && (
          <View style={styles.entitySection}>
            <Text style={styles.entityTitle}>💪 Aktiviteler:</Text>
            {analysisResult.activities.map((activity, index) => (
              <Text key={index} style={styles.entityItem}>• {activity}</Text>
            ))}
          </View>
        )}

        {/* Keywords */}
        {analysisDetails.keywords.length > 0 && (
          <View style={styles.entitySection}>
            <Text style={styles.entityTitle}>🔍 Bulunan Anahtar Kelimeler:</Text>
            <Text style={styles.keywordsList}>
              {analysisDetails.keywords.join(', ')}
            </Text>
          </View>
        )}

        {/* Emotion Signals */}
        {analysisDetails.emotionSignals.length > 0 && (
          <View style={styles.entitySection}>
            <Text style={styles.entityTitle}>💝 Duygu İşaretleri:</Text>
            <Text style={styles.keywordsList}>
              {analysisDetails.emotionSignals.join(', ')}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: '🧠 Voice Analysis Test',
          headerShown: true,
          headerBackVisible: true,
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Input Section */}
        <Card style={styles.inputCard}>
          <Text style={styles.inputTitle}>Test Metni Girin</Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Örnek: Bugün kendimi çok mutlu hissediyorum..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          
          <Pressable
            style={[styles.analyzeButton, loading && styles.analyzeButtonDisabled]}
            onPress={() => runAnalysis(inputText)}
            disabled={loading}
          >
            <MaterialCommunityIcons 
              name="brain" 
              size={20} 
              color="#FFFFFF" 
            />
            <Text style={styles.analyzeButtonText}>
              {loading ? 'Analiz Ediliyor...' : 'Analiz Et'}
            </Text>
          </Pressable>
        </Card>

        {/* Sample Texts */}
        <Card style={styles.samplesCard}>
          <Text style={styles.samplesTitle}>📝 Örnek Metinler</Text>
          {sampleTexts.map((sample, index) => (
            <Pressable
              key={index}
              style={styles.sampleItem}
              onPress={() => setInputText(sample)}
            >
              <Text style={styles.sampleText}>{sample}</Text>
            </Pressable>
          ))}
        </Card>

        {/* Analysis Result */}
        {renderAnalysisResult()}

        <View style={styles.footer}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color="#6B7280" />
            <Text style={styles.backButtonText}>Geri</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  inputCard: {
    margin: 16,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter',
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    marginBottom: 16,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  samplesCard: {
    margin: 16,
    marginTop: 0,
  },
  samplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  sampleItem: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginBottom: 8,
  },
  sampleText: {
    fontSize: 13,
    color: '#4B5563',
    fontFamily: 'Inter',
    lineHeight: 18,
  },
  resultCard: {
    margin: 16,
    marginTop: 0,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    fontFamily: 'Inter',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  emotionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  emotionText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  emotionValue: {
    fontWeight: '600',
    color: '#1D4ED8',
  },
  sentimentText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  sentimentValue: {
    fontWeight: '600',
    color: '#059669',
  },
  intensityText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter',
  },
  intensityValue: {
    fontWeight: '600',
    color: '#DC2626',
  },
  entitySection: {
    marginBottom: 16,
  },
  entityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  entityItem: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  keywordsList: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontStyle: 'italic',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 4,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
});
