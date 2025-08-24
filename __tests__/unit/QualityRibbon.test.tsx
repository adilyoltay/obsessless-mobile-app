/**
 * 🧪 Unit Tests - QualityRibbon Component
 * 
 * Tests for QualityRibbon formatting, badge rendering,
 * age calculation, and accessibility
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import QualityRibbon from '@/components/ui/QualityRibbon';
import type { ProvenanceSource, QualityLevel } from '@/features/ai/insights/insightRegistry';
import { mockDateNow } from '../fixtures/qualityRibbonFixtures';

describe('QualityRibbon Component', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Badge Rendering', () => {
    it('should render source badge with correct text and color', () => {
      const testCases = [
        { source: 'unified' as ProvenanceSource, expectedText: 'Fresh', expectedColor: '#10B981' },
        { source: 'llm' as ProvenanceSource, expectedText: 'LLM', expectedColor: '#8B5CF6' },
        { source: 'cache' as ProvenanceSource, expectedText: 'Cache', expectedColor: '#6B7280' },
        { source: 'heuristic' as ProvenanceSource, expectedText: 'Fast', expectedColor: '#F59E0B' }
      ];

      testCases.forEach(({ source, expectedText, expectedColor }) => {
        const { getByText } = render(
          <QualityRibbon 
            source={source} 
            qualityLevel="medium" 
          />
        );

        const sourceBadge = getByText(expectedText);
        expect(sourceBadge).toBeTruthy();
        expect(sourceBadge.props.style).toMatchObject({
          color: expectedColor
        });
      });
    });

    it('should render quality level badge with correct text and color', () => {
      const testCases = [
        { quality: 'high' as QualityLevel, expectedText: 'High', expectedColor: '#059669' },
        { quality: 'medium' as QualityLevel, expectedText: 'Med', expectedColor: '#D97706' },
        { quality: 'low' as QualityLevel, expectedText: 'Low', expectedColor: '#DC2626' }
      ];

      testCases.forEach(({ quality, expectedText, expectedColor }) => {
        const { getByText } = render(
          <QualityRibbon 
            source="unified" 
            qualityLevel={quality} 
          />
        );

        const qualityBadge = getByText(expectedText);
        expect(qualityBadge).toBeTruthy();
        expect(qualityBadge.props.style).toMatchObject({
          color: expectedColor
        });
      });
    });

    it('should render sample size badge when provided', () => {
      const { getByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={15} 
        />
      );

      expect(getByText('n=15')).toBeTruthy();
    });

    it('should not render sample size badge when not provided', () => {
      const { queryByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
        />
      );

      expect(queryByText(/n=\d+/)).toBeNull();
    });

    it('should not render sample size badge when zero', () => {
      const { queryByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={0} 
        />
      );

      expect(queryByText('n=0')).toBeNull();
    });
  });

  describe('Age Formatting', () => {
    beforeEach(() => {
      mockDateNow(1640995200000); // Fixed timestamp for consistent testing
    });

    it('should format age correctly for different time periods', () => {
      const testCases = [
        { freshnessMs: 30 * 1000, expectedAge: 'now' }, // 30 seconds
        { freshnessMs: 2 * 60 * 1000, expectedAge: '2m' }, // 2 minutes
        { freshnessMs: 90 * 60 * 1000, expectedAge: '1h' }, // 1.5 hours -> 1h
        { freshnessMs: 25 * 60 * 60 * 1000, expectedAge: '1d' }, // 25 hours -> 1d
        { freshnessMs: 3 * 24 * 60 * 60 * 1000, expectedAge: '3d' } // 3 days
      ];

      testCases.forEach(({ freshnessMs, expectedAge }) => {
        const { queryByText } = render(
          <QualityRibbon 
            source="unified" 
            qualityLevel="high" 
            freshnessMs={freshnessMs} 
          />
        );

        if (expectedAge === 'now') {
          // Should not render age badge for 'now'
          expect(queryByText('now')).toBeNull();
        } else {
          expect(queryByText(expectedAge)).toBeTruthy();
        }
      });
    });

    it('should not render age badge when not provided', () => {
      const { queryByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
        />
      );

      expect(queryByText(/\d+[mhd]/)).toBeNull();
    });

    it('should handle edge cases in age calculation', () => {
      const testCases = [
        { freshnessMs: 0, expected: null }, // Exactly now
        { freshnessMs: 59 * 1000, expected: null }, // Just under 1 minute
        { freshnessMs: 60 * 1000, expected: '1m' }, // Exactly 1 minute
        { freshnessMs: 59 * 60 * 1000, expected: '59m' }, // Just under 1 hour
        { freshnessMs: 60 * 60 * 1000, expected: '1h' }, // Exactly 1 hour
        { freshnessMs: 23 * 60 * 60 * 1000, expected: '23h' }, // Just under 1 day
        { freshnessMs: 24 * 60 * 60 * 1000, expected: '1d' } // Exactly 1 day
      ];

      testCases.forEach(({ freshnessMs, expected }) => {
        const { queryByText } = render(
          <QualityRibbon 
            source="unified" 
            qualityLevel="high" 
            freshnessMs={freshnessMs} 
          />
        );

        if (expected) {
          expect(queryByText(expected)).toBeTruthy();
        } else {
          expect(queryByText(/\d+[mhd]/)).toBeNull();
        }
      });
    });
  });

  describe('Layout and Styling', () => {
    it('should apply custom styles correctly', () => {
      const customStyle = { marginTop: 10, backgroundColor: 'red' };
      
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          style={customStyle}
        />
      );

      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon.props.style).toContainEqual(customStyle);
    });

    it('should have proper flexbox layout for badges', () => {
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={15} 
          freshnessMs={300000} 
        />
      );

      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon.props.style).toMatchObject({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap'
      });
    });

    it('should render badges in correct order', () => {
      const { getAllByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={15} 
          freshnessMs={300000} 
        />
      );

      const badges = getAllByTestId(/badge-/);
      
      // Should have: source, quality, sample size, age
      expect(badges).toHaveLength(4);
      
      // Check order through accessibility labels or text content
      const badgeTexts = badges.map(badge => badge.props.children[1]?.props?.children || badge.props.children);
      expect(badgeTexts).toContain('Fresh'); // Source first
      expect(badgeTexts).toContain('High');  // Quality second
      expect(badgeTexts).toContain('n=15');  // Sample size third
      expect(badgeTexts).toContain('5m');    // Age fourth
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility role', () => {
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
        />
      );

      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon.props.accessibilityRole).toBe('text');
    });

    it('should be accessible with screen readers', () => {
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={15} 
          freshnessMs={300000} 
        />
      );

      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon).toBeTruthy();
      
      // Should contain all relevant information for screen readers
      const ribbonContent = ribbon.props.children;
      expect(ribbonContent).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should render efficiently with minimal props', () => {
      const startTime = performance.now();
      
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(getByTestId('quality-ribbon')).toBeTruthy();
      expect(renderTime).toBeLessThan(50); // Should render in < 50ms
    });

    it('should render efficiently with all props', () => {
      const startTime = performance.now();
      
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={15} 
          freshnessMs={300000}
          style={{ margin: 10 }}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(getByTestId('quality-ribbon')).toBeTruthy();
      expect(renderTime).toBeLessThan(50); // Should render in < 50ms
    });
  });

  describe('Icon Integration', () => {
    it('should display correct icons for different sources', () => {
      const testCases = [
        { source: 'unified' as ProvenanceSource, expectedIcon: 'flash' },
        { source: 'llm' as ProvenanceSource, expectedIcon: 'brain' },
        { source: 'cache' as ProvenanceSource, expectedIcon: 'cached' },
        { source: 'heuristic' as ProvenanceSource, expectedIcon: 'lightning-bolt' }
      ];

      testCases.forEach(({ source, expectedIcon }) => {
        const { getAllByTestId } = render(
          <QualityRibbon 
            source={source} 
            qualityLevel="high" 
          />
        );

        // Check for MaterialCommunityIcons with correct name
        const icons = getAllByTestId(/icon-/);
        expect(icons.some(icon => icon.props.name === expectedIcon)).toBe(true);
      });
    });

    it('should show clock icon for age badge', () => {
      const { getAllByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          freshnessMs={300000} 
        />
      );

      const icons = getAllByTestId(/icon-/);
      expect(icons.some(icon => icon.props.name === 'clock-outline')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid source gracefully', () => {
      const { getByTestId } = render(
        <QualityRibbon 
          source={'invalid' as ProvenanceSource} 
          qualityLevel="high" 
        />
      );

      // Should render with fallback
      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon).toBeTruthy();
      expect(getByTestId('source-badge')).toBeTruthy();
    });

    it('should handle invalid quality level gracefully', () => {
      const { getByTestId } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel={'invalid' as QualityLevel} 
        />
      );

      // Should render with fallback
      const ribbon = getByTestId('quality-ribbon');
      expect(ribbon).toBeTruthy();
      expect(getByTestId('quality-badge')).toBeTruthy();
    });

    it('should handle negative sample size', () => {
      const { queryByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          sampleSize={-5} 
        />
      );

      // Should not render negative sample size
      expect(queryByText('n=-5')).toBeNull();
    });

    it('should handle negative freshness time', () => {
      const { queryByText } = render(
        <QualityRibbon 
          source="unified" 
          qualityLevel="high" 
          freshnessMs={-300000} 
        />
      );

      // Should not render negative age
      expect(queryByText(/-\d+[mhd]/)).toBeNull();
    });
  });
});
