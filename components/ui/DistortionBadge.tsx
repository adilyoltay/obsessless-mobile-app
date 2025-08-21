import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * 🎨 Distortion Badge - Confidence-based Visual Indicator
 * 
 * Bilişsel çarpıtmaları confidence score ile birlikte gösterir.
 * Renk kodlaması: Kırmızı (>80%), Turuncu (60-80%), Yeşil (<60%)
 */

interface DistortionBadgeProps {
  distortion: string;
  confidence: number;
  selected?: boolean;
  onPress?: () => void;
  showPercentage?: boolean;
}

const DISTORTION_LABELS: Record<string, string> = {
  'all_or_nothing': 'Hep-Hiç Düşünce',
  'overgeneralization': 'Aşırı Genelleme',
  'mental_filter': 'Zihinsel Filtreleme',
  'catastrophizing': 'Felaketleştirme',
  'mind_reading': 'Zihin Okuma',
  'fortune_telling': 'Falcılık',
  'emotional_reasoning': 'Duygusal Çıkarım',
  'should_statements': 'Olmalı İfadeleri',
  'labeling': 'Etiketleme',
  'personalization': 'Kişiselleştirme',
  // Legacy aliases
  'blackWhite': 'Hep-Hiç Düşünce',
  'mindReading': 'Zihin Okuma',
};

const DISTORTION_ICONS: Record<string, string> = {
  'all_or_nothing': 'circle-slice-8',
  'overgeneralization': 'arrow-expand-all',
  'mental_filter': 'filter',
  'catastrophizing': 'alert-circle',
  'mind_reading': 'head-cog',
  'fortune_telling': 'crystal-ball',
  'emotional_reasoning': 'heart-circle',
  'should_statements': 'scale-balance',
  'labeling': 'tag',
  'personalization': 'account-arrow-right',
  // Legacy aliases
  'blackWhite': 'circle-slice-8',
  'mindReading': 'head-cog',
};

export default function DistortionBadge({ 
  distortion, 
  confidence, 
  selected = false,
  onPress,
  showPercentage = true 
}: DistortionBadgeProps) {
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#EF4444'; // Kırmızı - Yüksek güven
    if (confidence >= 0.6) return '#F59E0B'; // Turuncu - Orta güven
    return '#84CC16'; // Yeşil - Düşük güven
  };
  
  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  const confidenceColor = getConfidenceColor(confidence);
  const confidenceLevel = getConfidenceLevel(confidence);
  const label = DISTORTION_LABELS[distortion] || distortion;
  const icon = DISTORTION_ICONS[distortion] || 'help-circle';
  const percentage = Math.round(confidence * 100);

  const dynamicStyles = {
    badge: {
      backgroundColor: selected ? confidenceColor : '#F3F4F6',
      borderColor: confidenceColor,
      borderWidth: selected ? 2 : 1,
    },
    text: {
      color: selected ? '#FFFFFF' : confidenceColor,
      fontWeight: selected ? '700' as const : '600' as const,
    },
    icon: {
      color: selected ? '#FFFFFF' : confidenceColor,
    },
    percentage: {
      color: selected ? 'rgba(255,255,255,0.9)' : confidenceColor,
    }
  };

  const accessibilityLabel = `${label}, güven oranı ${percentage}%, ${
    confidenceLevel === 'high' ? 'yüksek' : 
    confidenceLevel === 'medium' ? 'orta' : 'düşük'
  } güven seviyesi${selected ? ', seçili' : ''}`;

  return (
    <View 
      style={[styles.badge, dynamicStyles.badge]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons 
        name={icon as any} 
        size={12} 
        style={[styles.icon, dynamicStyles.icon]} 
      />
      
      <Text style={[styles.text, dynamicStyles.text]} numberOfLines={1}>
        {label}
      </Text>
      
      {showPercentage && (
        <Text style={[styles.percentage, dynamicStyles.percentage]}>
          {percentage}%
        </Text>
      )}
      
      {confidenceLevel === 'high' && (
        <MaterialCommunityIcons 
          name="check-circle" 
          size={10} 
          style={[styles.checkIcon, dynamicStyles.icon]} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
    maxWidth: 150,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter',
    flex: 1,
  },
  percentage: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: '700',
    marginLeft: 4,
  },
  checkIcon: {
    marginLeft: 2,
  },
});

/**
 * Multi-Distortion Analysis Component
 * Birden fazla çarpıtmayı confidence sıralamasıyla gösterir
 */
interface MultiDistortionAnalysisProps {
  distortions: Array<{
    id: string;
    confidence: number;
    selected?: boolean;
  }>;
  onDistortionPress?: (distortionId: string) => void;
  maxDisplay?: number;
}

export function MultiDistortionAnalysis({ 
  distortions, 
  onDistortionPress,
  maxDisplay = 5 
}: MultiDistortionAnalysisProps) {
  
  // Sort by confidence (highest first)
  const sortedDistortions = [...distortions]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxDisplay);
  
  const primaryDistortions = sortedDistortions.filter(d => d.confidence >= 0.85);
  const secondaryDistortions = sortedDistortions.filter(d => d.confidence >= 0.60 && d.confidence < 0.85);
  const possibleDistortions = sortedDistortions.filter(d => d.confidence < 0.60);
  
  return (
    <View style={styles.multiAnalysisContainer}>
      {primaryDistortions.length > 0 && (
        <View style={styles.distortionLevel}>
          <Text style={styles.levelTitle}>🔴 Birincil Çarpıtmalar</Text>
          <View style={styles.badgeContainer}>
            {primaryDistortions.map((d) => (
              <DistortionBadge
                key={d.id}
                distortion={d.id}
                confidence={d.confidence}
                selected={d.selected}
                onPress={() => onDistortionPress?.(d.id)}
              />
            ))}
          </View>
        </View>
      )}
      
      {secondaryDistortions.length > 0 && (
        <View style={styles.distortionLevel}>
          <Text style={styles.levelTitle}>🟡 İkincil Çarpıtmalar</Text>
          <View style={styles.badgeContainer}>
            {secondaryDistortions.map((d) => (
              <DistortionBadge
                key={d.id}
                distortion={d.id}
                confidence={d.confidence}
                selected={d.selected}
                onPress={() => onDistortionPress?.(d.id)}
              />
            ))}
          </View>
        </View>
      )}
      
      {possibleDistortions.length > 0 && (
        <View style={styles.distortionLevel}>
          <Text style={styles.levelTitle}>🟢 Olası Çarpıtmalar</Text>
          <View style={styles.badgeContainer}>
            {possibleDistortions.map((d) => (
              <DistortionBadge
                key={d.id}
                distortion={d.id}
                confidence={d.confidence}
                selected={d.selected}
                onPress={() => onDistortionPress?.(d.id)}
                showPercentage={false}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const multiStyles = StyleSheet.create({
  multiAnalysisContainer: {
    gap: 12,
  },
  distortionLevel: {
    gap: 8,
  },
  levelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
});

// Merge styles
Object.assign(styles, multiStyles);
