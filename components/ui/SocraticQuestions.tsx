import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * 🤔 Socratic Questions Component
 * 
 * CBT Thought Record sürecinde kullanıcıya yönlendirici sorular sunar.
 * Her adımda uygun Sokratik sorular gösterilir.
 */

interface SocraticQuestionsProps {
  step: 'thought' | 'distortions' | 'evidence' | 'reframe';
  distortions?: string[];
  onQuestionSelect?: (question: string) => void;
  currentThought?: string;
}

const SOCRATIC_QUESTIONS = {
  thought: [
    "Bu düşünceyi tam olarak nasıl ifade ederdin?",
    "O anda aklından geçen ilk şey neydi?",
    "Bu durumda kendine ne söylüyorsun?",
    "En çok hangi kısım seni rahatsız ediyor?",
  ],
  distortions: [
    "Bu düşüncede hangi kalıpları fark ediyorsun?",
    "Bu şekilde düşünmek sana yardımcı mı oluyor?",
    "Geçmişte de benzer şekilde düşündün mü?",
    "Bu düşünce gerçekleri mi yansıtıyor?",
  ],
  evidence: [
    "Bu düşünceyi destekleyen somut kanıtlar neler?",
    "Bu durumu farklı yorumlayabilir misin?",
    "En yakın arkadaşın bu durumda ne derdi?",
    "Bu olayı 10 yıl sonra nasıl değerlendirirsin?",
    "Bu düşüncenin alternatif açıklamaları var mı?",
    "Geçmişte benzer durumlar nasıl sonuçlandı?",
  ],
  reframe: [
    "Bu düşünceyi daha dengeli nasıl ifade edebilirsin?",
    "Kendine nasıl şefkatle yaklaşabilirsin?",
    "Bu durumdan ne öğrenebilirsin?",
    "İlerleme için hangi küçük adımları atabilirsin?",
  ]
};

const DISTORTION_SPECIFIC_QUESTIONS = {
  'catastrophizing': [
    "En kötü senaryonun gerçekleşme olasılığı nedir?",
    "Bu durumun sonuçları gerçekten o kadar korkunç mu?",
    "Daha mı ası senaryolar neler olabilir?",
  ],
  'all_or_nothing': [
    "Bu durumda gri alanlar var mı?",
    "Orta yol seçenekleri neler olabilir?",
    "Başarı ve başarısızlık arasında başka seçenekler var mı?",
  ],
  'mind_reading': [
    "Bu kişinin ne düşündüğünü gerçekten bilebilir misin?",
    "Başka açıklamaları da olabilir mi?",
    "Bu konuda onunla konuşmayı denedin mi?",
  ],
  'personalization': [
    "Bu durumda sorumluluğun ne kadarı sende?",
    "Başka hangi faktörler etkili olmuş olabilir?",
    "Kontrolünde olmayan etkenler nelerdi?",
  ],
  'should_statements': [
    "Bu 'zorunluluk' gerçekten ne kadar gerekli?",
    "Kendine daha esnek hedefler koyabilir misin?",
    "Bu kurala istisna durumlar olabilir mi?",
  ]
};

export default function SocraticQuestions({ 
  step, 
  distortions = [], 
  onQuestionSelect,
  currentThought 
}: SocraticQuestionsProps) {
  
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['general']);
  
  const baseQuestions = SOCRATIC_QUESTIONS[step] || [];
  
  // Add distortion-specific questions
  const distortionQuestions = distortions
    .filter(d => DISTORTION_SPECIFIC_QUESTIONS[d as keyof typeof DISTORTION_SPECIFIC_QUESTIONS])
    .map(d => ({
      distortion: d,
      questions: DISTORTION_SPECIFIC_QUESTIONS[d as keyof typeof DISTORTION_SPECIFIC_QUESTIONS] || []
    }))
    .filter(item => item.questions.length > 0);

  const toggleCategory = (category: string) => {
    if (expandedCategories.includes(category)) {
      setExpandedCategories(expandedCategories.filter(c => c !== category));
    } else {
      setExpandedCategories([...expandedCategories, category]);
    }
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'thought': return 'thought-bubble';
      case 'distortions': return 'alert-circle';
      case 'evidence': return 'scale-balance';
      case 'reframe': return 'lightbulb';
      default: return 'help-circle';
    }
  };

  const getStepTitle = (step: string) => {
    switch (step) {
      case 'thought': return 'Düşünceyi Netleştir';
      case 'distortions': return 'Çarpıtmaları Keşfet';
      case 'evidence': return 'Kanıtları İncele';
      case 'reframe': return 'Yeniden Çerçevele';
      default: return 'Sokratik Sorular';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons 
          name={getStepIcon(step) as any} 
          size={20} 
          color="#6366F1" 
        />
        <Text style={styles.title}>
          {getStepTitle(step)}
        </Text>
        <Text style={styles.subtitle}>
          Bu sorular düşünmene yardımcı olabilir
        </Text>
      </View>

      <ScrollView style={styles.questionsContainer} showsVerticalScrollIndicator={false}>
        {/* General Questions */}
        <View style={styles.categorySection}>
          <Pressable 
            style={styles.categoryHeader}
            onPress={() => toggleCategory('general')}
          >
            <Text style={styles.categoryTitle}>Genel Sorular</Text>
            <MaterialCommunityIcons 
              name={expandedCategories.includes('general') ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#6B7280" 
            />
          </Pressable>
          
          {expandedCategories.includes('general') && (
            <View style={styles.questionsList}>
              {baseQuestions.map((question, index) => (
                <Pressable
                  key={index}
                  style={styles.questionCard}
                  onPress={() => onQuestionSelect?.(question)}
                >
                  <MaterialCommunityIcons name="help-circle-outline" size={16} color="#6366F1" />
                  <Text style={styles.questionText}>{question}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Distortion-Specific Questions */}
        {distortionQuestions.map((item) => (
          <View key={item.distortion} style={styles.categorySection}>
            <Pressable 
              style={styles.categoryHeader}
              onPress={() => toggleCategory(item.distortion)}
            >
              <Text style={styles.categoryTitle}>
                {getDistortionLabel(item.distortion)} İçin
              </Text>
              <MaterialCommunityIcons 
                name={expandedCategories.includes(item.distortion) ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#6B7280" 
              />
            </Pressable>
            
            {expandedCategories.includes(item.distortion) && (
              <View style={styles.questionsList}>
                {item.questions.map((question, index) => (
                  <Pressable
                    key={index}
                    style={styles.questionCard}
                    onPress={() => onQuestionSelect?.(question)}
                  >
                    <MaterialCommunityIcons name="help-circle-outline" size={16} color="#F59E0B" />
                    <Text style={styles.questionText}>{question}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function getDistortionLabel(distortion: string): string {
  const labels: Record<string, string> = {
    'catastrophizing': 'Felaketleştirme',
    'all_or_nothing': 'Hep-Hiç Düşünce',
    'mind_reading': 'Zihin Okuma',
    'personalization': 'Kişiselleştirme',
    'should_statements': 'Olmalı İfadeleri',
    'overgeneralization': 'Aşırı Genelleme',
    'mental_filter': 'Zihinsel Filtreleme',
    'fortune_telling': 'Falcılık',
    'emotional_reasoning': 'Duygusal Çıkarım',
    'labeling': 'Etiketleme',
  };
  return labels[distortion] || distortion;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  questionsContainer: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  questionsList: {
    marginTop: 8,
    gap: 6,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontFamily: 'Inter',
  },
});

/**
 * Inline Socratic Questions - Compact version for within forms
 */
interface InlineSocraticQuestionsProps {
  questions: string[];
  onQuestionSelect: (question: string) => void;
  maxDisplay?: number;
}

export function InlineSocraticQuestions({ 
  questions, 
  onQuestionSelect, 
  maxDisplay = 3 
}: InlineSocraticQuestionsProps) {
  const [showAll, setShowAll] = useState(false);
  const displayQuestions = showAll ? questions : questions.slice(0, maxDisplay);

  return (
    <View style={inlineStyles.container}>
      <View style={inlineStyles.header}>
        <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#6366F1" />
        <Text style={inlineStyles.title}>Düşünmen için</Text>
      </View>
      
      <View style={inlineStyles.questionsList}>
        {displayQuestions.map((question, index) => (
          <Pressable
            key={index}
            style={inlineStyles.questionChip}
            onPress={() => onQuestionSelect(question)}
          >
            <Text style={inlineStyles.questionText}>{question}</Text>
          </Pressable>
        ))}
        
        {questions.length > maxDisplay && (
          <Pressable
            style={inlineStyles.showMoreButton}
            onPress={() => setShowAll(!showAll)}
          >
            <Text style={inlineStyles.showMoreText}>
              {showAll ? 'Daha Az' : `+${questions.length - maxDisplay} daha`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const inlineStyles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    fontFamily: 'Inter',
  },
  questionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  questionChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  questionText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Inter',
  },
  showMoreButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  showMoreText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
