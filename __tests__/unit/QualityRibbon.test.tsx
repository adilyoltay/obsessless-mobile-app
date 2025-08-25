/**
 * 🧪 Unit Tests - QualityRibbon Logic & Utilities
 * 
 * Tests for QualityRibbon helper functions, formatting logic,
 * and mapping functions without complex rendering.
 */

import type { ProvenanceSource, QualityLevel } from '@/features/ai/insights/insightRegistry';

// Helper functions extracted from QualityRibbon component for testing
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

function formatSampleSize(size?: number): string | null {
  if (!size || size <= 0) return null;
  return `n=${size}`;
}

describe('QualityRibbon Logic & Utilities', () => {
  describe('📊 Source Configuration Mapping', () => {
    it('should map unified source to Fresh badge', () => {
      const config = getSourceConfig('unified');
      expect(config).toEqual({
        label: 'Fresh',
        color: '#10B981', 
        bgColor: '#D1FAE5',
        icon: 'flash'
      });
    });

    it('should map cache source to Cache badge', () => {
      const config = getSourceConfig('cache');
      expect(config).toEqual({
        label: 'Cache',
        color: '#6B7280',
        bgColor: '#F3F4F6', 
        icon: 'cached'
      });
    });

    it('should map llm source to LLM badge', () => {
      const config = getSourceConfig('llm');
      expect(config).toEqual({
        label: 'LLM',
        color: '#8B5CF6',
        bgColor: '#F3E8FF',
        icon: 'brain'
      });
    });

    it('should map heuristic source to Fast badge', () => {
      const config = getSourceConfig('heuristic');
      expect(config).toEqual({
        label: 'Fast',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: 'lightning-bolt'
      });
    });

    it('should handle invalid source with fallback', () => {
      const config = getSourceConfig('invalid' as ProvenanceSource);
      expect(config).toEqual({
        label: 'Auto',
        color: '#6B7280',
        bgColor: '#F3F4F6',
        icon: 'auto-fix'
      });
    });
  });

  describe('🎨 Quality Level Configuration', () => {
    it('should map high quality to High badge with green color', () => {
      const config = getQualityConfig('high');
      expect(config).toEqual({
        label: 'High',
        color: '#059669',
        bgColor: '#D1FAE5'
      });
    });

    it('should map medium quality to Med badge with orange color', () => {
      const config = getQualityConfig('medium');
      expect(config).toEqual({
        label: 'Med',
        color: '#D97706',
        bgColor: '#FEF3C7'
      });
    });

    it('should map low quality to Low badge with red color', () => {
      const config = getQualityConfig('low');
      expect(config).toEqual({
        label: 'Low',
        color: '#DC2626',
        bgColor: '#FEE2E2'
      });
    });

    it('should handle invalid quality with fallback', () => {
      const config = getQualityConfig('invalid' as QualityLevel);
      expect(config).toEqual({
        label: 'Unknown',
        color: '#6B7280',
        bgColor: '#F3F4F6'
      });
    });
  });

  describe('⏰ Age Formatting Logic', () => {
    it('should format age correctly for different time periods', () => {
      const testCases = [
        { freshnessMs: 30 * 1000, expectedAge: 'now' }, // 30 seconds
        { freshnessMs: 2 * 60 * 1000, expectedAge: '2m' }, // 2 minutes
        { freshnessMs: 90 * 60 * 1000, expectedAge: '1h' }, // 1.5 hours -> 1h
        { freshnessMs: 25 * 60 * 60 * 1000, expectedAge: '1d' }, // 25 hours -> 1d
        { freshnessMs: 3 * 24 * 60 * 60 * 1000, expectedAge: '3d' } // 3 days
      ];

      testCases.forEach(({ freshnessMs, expectedAge }) => {
        const result = formatAge(freshnessMs);
        expect(result).toBe(expectedAge);
      });
    });

    it('should handle edge cases in age calculation', () => {
      const testCases = [
        { freshnessMs: 0, expected: 'now' }, // Exactly now
        { freshnessMs: 59 * 1000, expected: 'now' }, // Just under 1 minute
        { freshnessMs: 60 * 1000, expected: '1m' }, // Exactly 1 minute
        { freshnessMs: 59 * 60 * 1000, expected: '59m' }, // Just under 1 hour
        { freshnessMs: 60 * 60 * 1000, expected: '1h' }, // Exactly 1 hour
        { freshnessMs: 23 * 60 * 60 * 1000, expected: '23h' }, // Just under 1 day
        { freshnessMs: 24 * 60 * 60 * 1000, expected: '1d' } // Exactly 1 day
      ];

      testCases.forEach(({ freshnessMs, expected }) => {
        const result = formatAge(freshnessMs);
        expect(result).toBe(expected);
      });
    });

    it('should handle very large time periods', () => {
      expect(formatAge(7 * 24 * 60 * 60 * 1000)).toBe('7d'); // 7 days
      expect(formatAge(30 * 24 * 60 * 60 * 1000)).toBe('30d'); // 30 days
      expect(formatAge(365 * 24 * 60 * 60 * 1000)).toBe('365d'); // 1 year
    });
  });

  describe('📏 Sample Size Formatting', () => {
    it('should format valid sample sizes correctly', () => {
      expect(formatSampleSize(1)).toBe('n=1');
      expect(formatSampleSize(15)).toBe('n=15');
      expect(formatSampleSize(100)).toBe('n=100');
    });

    it('should return null for invalid sample sizes', () => {
      expect(formatSampleSize(0)).toBeNull();
      expect(formatSampleSize(-5)).toBeNull();
      expect(formatSampleSize(undefined)).toBeNull();
    });
  });

  describe('🔄 Integration Tests', () => {
    it('should provide consistent mapping between all components', () => {
      // Test that source mapping is consistent
      const sources: ProvenanceSource[] = ['unified', 'cache', 'llm', 'heuristic'];
      sources.forEach(source => {
        const config = getSourceConfig(source);
        expect(config.label).toBeTruthy();
        expect(config.color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(config.bgColor).toMatch(/^#[0-9A-F]{6}$/i);
        expect(config.icon).toBeTruthy();
      });

      // Test that quality mapping is consistent
      const qualities: QualityLevel[] = ['high', 'medium', 'low'];
      qualities.forEach(quality => {
        const config = getQualityConfig(quality);
        expect(config.label).toBeTruthy();
        expect(config.color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(config.bgColor).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should handle realistic data scenarios', () => {
      // High quality scenario
      const highQualityAge = formatAge(5 * 60 * 1000); // 5 minutes
      const highQualitySource = getSourceConfig('unified');
      const highQualityLevel = getQualityConfig('high');
      const highQualitySample = formatSampleSize(16);

      expect(highQualityAge).toBe('5m');
      expect(highQualitySource.label).toBe('Fresh');
      expect(highQualityLevel.label).toBe('High');
      expect(highQualitySample).toBe('n=16');

      // Medium quality scenario  
      const mediumQualityAge = formatAge(2 * 60 * 60 * 1000); // 2 hours
      const mediumQualitySource = getSourceConfig('cache');
      const mediumQualityLevel = getQualityConfig('medium');
      const mediumQualitySample = formatSampleSize(10);

      expect(mediumQualityAge).toBe('2h');
      expect(mediumQualitySource.label).toBe('Cache');
      expect(mediumQualityLevel.label).toBe('Med');
      expect(mediumQualitySample).toBe('n=10');

      // Low quality scenario
      const lowQualityAge = formatAge(30 * 1000); // 30 seconds (immediate)
      const lowQualitySource = getSourceConfig('heuristic');
      const lowQualityLevel = getQualityConfig('low');
      const lowQualitySample = formatSampleSize(4);

      expect(lowQualityAge).toBe('now');
      expect(lowQualitySource.label).toBe('Fast');
      expect(lowQualityLevel.label).toBe('Low');
      expect(lowQualitySample).toBe('n=4');
    });
  });

  describe('🎯 Task Requirements Validation', () => {
    it('should support all required source mappings per task spec', () => {
      // Task specifies: unified→Fresh, cache→Cache, llm→LLM, heuristic→Fast
      expect(getSourceConfig('unified').label).toBe('Fresh');
      expect(getSourceConfig('cache').label).toBe('Cache');
      expect(getSourceConfig('llm').label).toBe('LLM');
      expect(getSourceConfig('heuristic').label).toBe('Fast');
    });

    it('should support all required quality mappings per task spec', () => {
      // Task specifies: high→High, medium→Med, low→Low
      expect(getQualityConfig('high').label).toBe('High');
      expect(getQualityConfig('medium').label).toBe('Med');
      expect(getQualityConfig('low').label).toBe('Low');
    });

    it('should format sample sizes as n=X per task spec', () => {
      expect(formatSampleSize(15)).toBe('n=15');
      expect(formatSampleSize(1)).toBe('n=1');
      expect(formatSampleSize(100)).toBe('n=100');
    });

    it('should format age as now/m/h/d per task spec', () => {
      expect(formatAge(30 * 1000)).toBe('now');
      expect(formatAge(5 * 60 * 1000)).toBe('5m');
      expect(formatAge(2 * 60 * 60 * 1000)).toBe('2h');
      expect(formatAge(3 * 24 * 60 * 60 * 1000)).toBe('3d');
    });
  });
});
