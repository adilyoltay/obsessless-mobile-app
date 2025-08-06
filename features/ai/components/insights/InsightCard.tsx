/**
 * Insight Card Component
 * 
 * Terapötik içgörüleri gösteren kart komponenti
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Share
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  EnhancedInsight, 
  InsightCategory, 
  InsightPriority,
  InsightAction 
} from '@/features/ai/engines/insightsEngine';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import * as Haptics from 'expo-haptics';

interface InsightCardProps {
  insight: EnhancedInsight;
  onActionPress: (action: InsightAction) => void;
  onFeedback: (helpful: boolean) => void;
  onDismiss?: () => void;
  style?: any;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  onActionPress,
  onFeedback,
  onDismiss,
  style
}) => {
  const [expanded, setExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const animatedHeight = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const getCategoryIcon = () => {
    const icons = {
      [InsightCategory.PROGRESS]: 'trending-up',
      [InsightCategory.PATTERN]: 'radar',
      [InsightCategory.TRIGGER]: 'alert-circle',
      [InsightCategory.COPING]: 'shield-check',
      [InsightCategory.MOTIVATION]: 'heart',
      [InsightCategory.EDUCATION]: 'school',
      [InsightCategory.WARNING]: 'alert',
      [InsightCategory.CELEBRATION]: 'party-popper'
    };
    return icons[insight.category] || 'information';
  };

  const getCategoryColor = () => {
    const colors = {
      [InsightCategory.PROGRESS]: '#10B981',
      [InsightCategory.PATTERN]: '#3B82F6',
      [InsightCategory.TRIGGER]: '#F59E0B',
      [InsightCategory.COPING]: '#8B5CF6',
      [InsightCategory.MOTIVATION]: '#EC4899',
      [InsightCategory.EDUCATION]: '#06B6D4',
      [InsightCategory.WARNING]: '#EF4444',
      [InsightCategory.CELEBRATION]: '#10B981'
    };
    return colors[insight.category] || '#6B7280';
  };

  const getPriorityBadge = () => {
    if (insight.priority === InsightPriority.CRITICAL) {
      return (
        <View style={[styles.priorityBadge, styles.criticalBadge]}>
          <Text style={styles.priorityText}>Kritik</Text>
        </View>
      );
    }
    if (insight.priority === InsightPriority.HIGH) {
      return (
        <View style={[styles.priorityBadge, styles.highBadge]}>
          <Text style={styles.priorityText}>Önemli</Text>
        </View>
      );
    }
    return null;
  };

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
    
    Animated.timing(animatedHeight, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  const handleFeedback = (helpful: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFeedbackGiven(true);
    onFeedback(helpful);
    
    // Feedback animasyonu
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: insight.content,
        title: 'ObsessLess İçgörü'
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      onDismiss?.();
    });
  };

  return (
    <Animated.View style={[{ opacity: fadeAnim }, style]}>
      <Card style={[styles.container, { borderLeftColor: getCategoryColor() }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name={getCategoryIcon()}
              size={24}
              color={getCategoryColor()}
            />
            <Text style={styles.categoryText}>
              {getCategoryLabel(insight.category)}
            </Text>
            {getPriorityBadge()}
          </View>
          
          {onDismiss && (
            <Pressable onPress={handleDismiss} style={styles.dismissButton}>
              <MaterialCommunityIcons name="close" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <Pressable onPress={insight.actionable ? toggleExpand : undefined}>
          <Text style={styles.content}>{insight.content}</Text>
        </Pressable>

        {/* Confidence Indicator */}
        <View style={styles.confidenceContainer}>
          <View style={styles.confidenceBar}>
            <View 
              style={[
                styles.confidenceFill, 
                { 
                  width: `${insight.confidence * 100}%`,
                  backgroundColor: getCategoryColor() 
                }
              ]} 
            />
          </View>
          <Text style={styles.confidenceText}>
            %{Math.round(insight.confidence * 100)} güven
          </Text>
        </View>

        {/* Actions (Expandable) */}
        {insight.actionable && insight.actions && insight.actions.length > 0 && (
          <Animated.View
            style={[
              styles.actionsContainer,
              {
                maxHeight: animatedHeight.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 200]
                }),
                opacity: animatedHeight
              }
            ]}
          >
            {insight.actions.map((action) => (
              <Pressable
                key={action.id}
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onActionPress(action);
                }}
              >
                <MaterialCommunityIcons
                  name={getActionIcon(action.type)}
                  size={20}
                  color={getCategoryColor()}
                />
                <Text style={styles.actionText}>{action.label}</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#9CA3AF"
                />
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Expand Indicator */}
        {insight.actionable && insight.actions && insight.actions.length > 0 && (
          <View style={styles.expandIndicator}>
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#9CA3AF"
            />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            {formatTimestamp(insight.timestamp)}
          </Text>
          
          <View style={styles.footerActions}>
            {/* Share */}
            <Pressable onPress={handleShare} style={styles.footerButton}>
              <MaterialCommunityIcons name="share-variant" size={18} color="#9CA3AF" />
            </Pressable>

            {/* Feedback */}
            {!feedbackGiven ? (
              <>
                <Pressable 
                  onPress={() => handleFeedback(true)} 
                  style={styles.footerButton}
                >
                  <MaterialCommunityIcons name="thumb-up-outline" size={18} color="#9CA3AF" />
                </Pressable>
                <Pressable 
                  onPress={() => handleFeedback(false)} 
                  style={styles.footerButton}
                >
                  <MaterialCommunityIcons name="thumb-down-outline" size={18} color="#9CA3AF" />
                </Pressable>
              </>
            ) : (
              <Text style={styles.feedbackText}>Geri bildirim için teşekkürler!</Text>
            )}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
};

// Helper functions
function getCategoryLabel(category: InsightCategory): string {
  const labels = {
    [InsightCategory.PROGRESS]: 'İlerleme',
    [InsightCategory.PATTERN]: 'Pattern',
    [InsightCategory.TRIGGER]: 'Tetikleyici',
    [InsightCategory.COPING]: 'Başa Çıkma',
    [InsightCategory.MOTIVATION]: 'Motivasyon',
    [InsightCategory.EDUCATION]: 'Bilgi',
    [InsightCategory.WARNING]: 'Uyarı',
    [InsightCategory.CELEBRATION]: 'Kutlama'
  };
  return labels[category] || 'İçgörü';
}

function getActionIcon(type: string): string {
  const icons = {
    exercise: 'dumbbell',
    reminder: 'bell',
    goal: 'target',
    resource: 'book-open-variant',
    tracking: 'chart-line'
  };
  return icons[type] || 'arrow-right';
}

function formatTimestamp(date?: Date): string {
  if (!date) return '';
  
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} dakika önce`;
  } else if (hours < 24) {
    return `${hours} saat önce`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  }
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  criticalBadge: {
    backgroundColor: '#FEE2E2',
  },
  highBadge: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  dismissButton: {
    padding: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
    marginBottom: 12,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionsContainer: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  expandIndicator: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerButton: {
    padding: 4,
    marginLeft: 12,
  },
  feedbackText: {
    fontSize: 12,
    color: '#10B981',
    fontStyle: 'italic',
  },
}); 