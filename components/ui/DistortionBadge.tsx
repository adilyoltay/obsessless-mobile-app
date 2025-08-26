import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
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
  
  // ✅ NEW: Subtle pulsing animation for high confidence (Master Prompt: Sakinlik)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Only pulse for high confidence distortions, and very subtly
    if (confidence >= 0.8 && !selected) {
      const pulse = Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,     // Very subtle scale
          duration: 2000,    // Slow, calming rhythm
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]);
      
      const loop = Animated.loop(pulse);
      loop.start();
      
      return () => loop.stop();
    }
  }, [confidence, selected, pulseAnim]);
  
  // ✅ FIXED: Calm confidence colors (Master Prompt: Sakinlik)
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#BE123C'; // Soft rose - Yüksek güven (anxiety-friendly)
    if (confidence >= 0.6) return '#D97706'; // Soft amber - Orta güven  
    return '#059669'; // Soft emerald - Düşük güven
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

  // ✅ FIXED: Calm accessibility labels (Master Prompt: Sakinlik)
  const accessibilityLabel = `${label} çarpıtması, ${
    confidenceLevel === 'high' ? 'yüksek olasılık' : 
    confidenceLevel === 'medium' ? 'orta olasılık' : 'düşük olasılık'
  }, ${percentage}%${selected ? ', seçildi' : ''}`;

  return (
    <Animated.View 
      style={[
        styles.badge, 
        dynamicStyles.badge,
        { transform: [{ scale: pulseAnim }] } // Apply subtle scale animation
      ]}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ✅ FIXED: Calm badge design (Master Prompt: Sakinlik)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Slightly more padding
    paddingVertical: 6,    // More vertical space
    borderRadius: 8,       // Softer corners
    marginRight: 6,
    marginBottom: 4,
    maxWidth: 160,         // More space for text
    shadowColor: '#000',   // Subtle shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    marginRight: 4,
  },
  // ✅ FIXED: Improved readability (Master Prompt: Zahmetsizlik)
  text: {
    fontSize: 12,        // Slightly larger for better readability
    fontFamily: 'Inter',
    flex: 1,
  },
  percentage: {
    fontSize: 11,        // Slightly larger percentage
    fontFamily: 'Inter',
    fontWeight: '600',   // Less bold for calm appearance
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
    <View style={(styles as any).multiAnalysisContainer}>
      {primaryDistortions.length > 0 && (
        <View style={(styles as any).distortionLevel}>
          <Text style={(styles as any).levelTitle}>● Birincil Çarpıtmalar</Text>
          <View style={(styles as any).badgeContainer}>
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
        <View style={(styles as any).distortionLevel}>
          <Text style={(styles as any).levelTitle}>◐ İkincil Çarpıtmalar</Text>
          <View style={(styles as any).badgeContainer}>
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
        <View style={(styles as any).distortionLevel}>
          <Text style={(styles as any).levelTitle}>○ Olası Çarpıtmalar</Text>
          <View style={(styles as any).badgeContainer}>
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
const merged: any = { ...styles };
Object.assign(merged, multiStyles);
(styles as any).multiAnalysisContainer = multiStyles.multiAnalysisContainer;
(styles as any).distortionLevel = multiStyles.distortionLevel;
(styles as any).levelTitle = multiStyles.levelTitle;
(styles as any).badgeContainer = multiStyles.badgeContainer;
