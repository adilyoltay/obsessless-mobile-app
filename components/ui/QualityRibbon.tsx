/**
 * 🎗️ Quality Ribbon - AI Insight Provenance & Quality Indicator
 * 
 * Shows source, quality level, sample size, and freshness for AI/heuristic outputs.
 * Minimal, accessible badge system for consistent metadata display.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// QualityLevel types - fallback
type ProvenanceSource = 'unified' | 'llm' | 'cache' | 'heuristic' | 'static' | string;
type QualityLevel = 'high' | 'medium' | 'low';

interface QualityRibbonProps {
  source: ProvenanceSource;
  qualityLevel: QualityLevel;
  sampleSize?: number;
  freshnessMs?: number;
  style?: any;
}

/**
 * 🕒 Format freshness milliseconds to human-readable age
 */
function formatAge(freshnessMs: number): string {
  const seconds = Math.floor(freshnessMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

/**
 * 🎨 Get source badge configuration
 */
function getSourceConfig(source: ProvenanceSource) {
  switch (source) {
    case 'unified':
      return { label: 'Fresh', color: '#10B981', bgColor: '#D1FAE5', icon: 'flash' };
    case 'llm':
      return { label: 'LLM', color: '#8B5CF6', bgColor: '#F3E8FF', icon: 'brain' };
    case 'cache':
      return { label: 'Cache', color: '#6B7280', bgColor: '#F3F4F6', icon: 'cached' };
    case 'heuristic':
      return { label: 'Fast', color: '#F59E0B', bgColor: '#FEF3C7', icon: 'lightning-bolt' };
    default:
      return { label: 'Auto', color: '#6B7280', bgColor: '#F3F4F6', icon: 'auto-fix' };
  }
}

/**
 * 🎨 Get quality level configuration
 */
function getQualityConfig(qualityLevel: QualityLevel) {
  switch (qualityLevel) {
    case 'high':
      return { label: 'High', color: '#059669', bgColor: '#D1FAE5' };
    case 'medium':
      return { label: 'Med', color: '#D97706', bgColor: '#FEF3C7' };
    case 'low':
      return { label: 'Low', color: '#DC2626', bgColor: '#FEE2E2' };
    default:
      return { label: 'Unknown', color: '#6B7280', bgColor: '#F3F4F6' };
  }
}

export default function QualityRibbon({
  source,
  qualityLevel,
  sampleSize,
  freshnessMs,
  style,
}: QualityRibbonProps) {
  const sourceConfig = getSourceConfig(source);
  const qualityConfig = getQualityConfig(qualityLevel);
  const age = freshnessMs !== undefined ? formatAge(freshnessMs) : null;
  
  return (
    <View 
      style={[styles.ribbon, style]} 
      accessibilityRole="text"
      testID="quality-ribbon"
    >
      {/* Source Badge */}
      <View 
        style={[styles.badge, { backgroundColor: sourceConfig.bgColor }]}
        testID="source-badge"
      >
        <MaterialCommunityIcons 
          name={sourceConfig.icon as any} 
          size={10} 
          color={sourceConfig.color}
          testID={`icon-${sourceConfig.icon}`}
        />
        <Text style={[styles.badgeText, { color: sourceConfig.color }]}>
          {sourceConfig.label}
        </Text>
      </View>
      
      {/* Quality Badge */}
      <View 
        style={[styles.badge, { backgroundColor: qualityConfig.bgColor }]}
        testID="quality-badge"
      >
        <Text style={[styles.badgeText, { color: qualityConfig.color }]}>
          {qualityConfig.label}
        </Text>
      </View>
      
      {/* Sample Size Badge */}
      {sampleSize !== undefined && sampleSize > 0 && (
        <View 
          style={[styles.badge, { backgroundColor: '#F3F4F6' }]}
          testID="sample-size-badge"
        >
          <Text style={[styles.badgeText, { color: '#6B7280' }]}>
            n={sampleSize}
          </Text>
        </View>
      )}
      
      {/* Age Badge */}
      {age && age !== 'now' && (
        <View 
          style={[styles.badge, { backgroundColor: '#F3F4F6' }]}
          testID="age-badge"
        >
          <MaterialCommunityIcons 
            name="clock-outline" 
            size={10} 
            color="#6B7280"
            testID="icon-clock-outline"
          />
          <Text style={[styles.badgeText, { color: '#6B7280' }]}>
            {age}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
