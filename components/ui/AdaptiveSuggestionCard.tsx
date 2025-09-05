/**
 * 🎯 AdaptiveSuggestionCard Component
 * 
 * JITAI/Adaptive Interventions için non-intrusive öneri kartı.
 * Today sayfasındaki diğer kartlarla uyumlu tasarım.
 * 
 * Features:
 * - Compact, clean design
 * - Two action buttons: Accept / Dismiss  
 * - Consistent styling with Today cards
 * - Accessibility support
 * - Smooth animations
 */

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AdaptiveSuggestion } from '@/features/ai-fallbacks/hooks';
import QualityRibbon from './QualityRibbon';
// QualityLevel types - fallback
type ProvenanceSource = string;
type QualityLevel = 'high' | 'medium' | 'low';

// Props interface
interface AdaptiveSuggestionCardProps {
  suggestion: AdaptiveSuggestion;
  onAccept: (suggestion: AdaptiveSuggestion) => void;
  onDismiss: (suggestion: AdaptiveSuggestion) => void;
  style?: ViewStyle;
  meta?: {
    source?: ProvenanceSource;
    qualityLevel?: QualityLevel;
    sampleSize?: number;
    freshnessMs?: number;
  };
}

/**
 * Get icon name based on suggestion category
 */
const getIconForCategory = (category?: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  switch (category) {
    case 'breathwork':
      return 'meditation';
    // 'cbt' removed
    case 'mood':
      return 'emoticon-happy-outline';
    case 'tracking':
      return 'chart-line';
    default:
      return 'lightbulb-on-outline';
  }
};

/**
 * Get accent color based on suggestion category
 */
const getColorForCategory = (category?: string): string => {
  switch (category) {
    case 'breathwork':
      return '#8B5CF6'; // Purple
    // 'cbt' removed
    case 'mood':
      return '#F59E0B'; // Amber
    case 'tracking':
      return '#10B981'; // Green
    default:
      return '#6B7280'; // Gray
  }
};

export function AdaptiveSuggestionCard({ 
  suggestion, 
  onAccept, 
  onDismiss,
  style,
  meta
}: AdaptiveSuggestionCardProps) {
  const theme = useThemeColors();
  // 🔍 DEBUG: Monitor meta prop changes
  useEffect(() => {
    console.log('🎯 AdaptiveSuggestionCard meta check:', { 
      meta, 
      hasSource: !!meta?.source, 
      source: meta?.source,
      qualityLevel: meta?.qualityLevel,
      suggestionTitle: suggestion.title
    });
  }, [meta, suggestion.title]);

  // Don't render if suggestion should not be shown
  if (!suggestion.show || !suggestion.title || !suggestion.content) {
    return null;
  }

  const accentColor = getColorForCategory(suggestion.category);
  const iconName = getIconForCategory(suggestion.category);

  const handleAccept = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAccept(suggestion);
  };

  const handleDismiss = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss(suggestion);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: accentColor }, style]}>
      {/* Header with icon and category */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons 
            name={iconName} 
            size={20} 
            color={accentColor} 
          />
          <Text style={[styles.category, { color: accentColor }]}>
            {suggestion.category === 'breathwork' ? 'Nefes Egzersizi' :
             suggestion.category === 'mood' ? 'Mood Check-in' :
             suggestion.category === 'tracking' ? 'Takip' : 'Öneri'}
          </Text>
          
          {/* AI badge */}
          <View style={styles.aiBadge}>
            <MaterialCommunityIcons 
              name="robot-outline" 
              size={12} 
              color="#10B981" 
            />
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        </View>
        
        {/* Quality Ribbon (right-aligned) */}
        {meta && meta.source && (
          <QualityRibbon
            source={meta.source}
            qualityLevel={meta.qualityLevel || 'medium'}
            sampleSize={meta.sampleSize}
            freshnessMs={meta.freshnessMs}
            style={styles.qualityRibbon}
          />
        )}
      </View>

      {/* Title and content */}
      <Text style={styles.title}>{suggestion.title}</Text>
      <Text style={styles.content}>{suggestion.content}</Text>
      
      {/* Confidence indicator (if available) */}
      {suggestion.confidence && suggestion.confidence > 0.7 && (
        <View style={styles.confidenceIndicator}>
          <MaterialCommunityIcons 
            name="check-circle" 
            size={14} 
            color="#10B981" 
          />
          <Text style={styles.confidenceText}>
            Güven: %{Math.round(suggestion.confidence * 100)}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable 
          style={[styles.button, styles.acceptButton, { backgroundColor: accentColor }]}
          onPress={handleAccept}
          accessibilityLabel={`${suggestion.title} önerisini kabul et`}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons 
            name="play" 
            size={16} 
            color="white" 
          />
          <Text style={styles.acceptButtonText}>Şimdi Dene</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.button, styles.dismissButton]}
          onPress={handleDismiss}
          accessibilityLabel="Öneriyi ertele"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons 
            name="clock-outline" 
            size={16} 
            color="#6B7280" 
          />
          <Text style={styles.dismissButtonText}>Daha Sonra</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  } as ViewStyle,

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,

  qualityRibbon: {
    marginTop: 2, // Slight offset for visual balance
  } as ViewStyle,

  category: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  } as ViewStyle,

  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    fontFamily: 'Inter-Bold',
  } as TextStyle,

  content: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'Inter',
  } as TextStyle,

  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  } as ViewStyle,

  confidenceText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  actions: {
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  } as ViewStyle,

  acceptButton: {
    // backgroundColor set dynamically based on category color
  } as ViewStyle,

  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Inter-Medium',
  } as TextStyle,

  dismissButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  } as ViewStyle,

  dismissButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    fontFamily: 'Inter-Medium',
  } as TextStyle,
});

export default AdaptiveSuggestionCard;
