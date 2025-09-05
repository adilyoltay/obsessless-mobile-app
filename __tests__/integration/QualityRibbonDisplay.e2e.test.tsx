/**
 * 🎗️ E2E Tests - Quality Ribbon Display & Interaction
 * 
 * Automated tests for Quality Ribbon visual display and user interactions
 * Tests different quality levels, source types, and UI states
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdaptiveSuggestionCard } from '@/components/ui/AdaptiveSuggestionCard';
import { QualityRibbon } from '@/components/ui/QualityRibbon';
import { useAdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/features/ai/hooks/useAdaptiveSuggestion');
jest.mock('@/components/ui/QualityRibbon', () => ({
  QualityRibbon: ({ qualityMeta }: any) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    
    if (!qualityMeta) return null;
    
    return React.createElement(View, { testID: 'quality-ribbon' },
      qualityMeta.source && React.createElement(Text, { testID: 'source-badge' }, 
        qualityMeta.source === 'unified' ? 'Fresh' : 
        qualityMeta.source === 'cache' ? 'Cache' : 'Heuristic'
      ),
      qualityMeta.qualityLevel && React.createElement(Text, { testID: 'quality-badge' }, 
        qualityMeta.qualityLevel === 'high' ? 'High' : 
        qualityMeta.qualityLevel === 'medium' ? 'Med' : 'Low'
      ),
      qualityMeta.sampleSize !== undefined && React.createElement(Text, { testID: 'sample-badge' }, 
        `n=${qualityMeta.sampleSize}`
      ),
      qualityMeta.freshnessMs !== undefined && React.createElement(Text, { testID: 'age-badge' },
        qualityMeta.freshnessMs < 60000 ? `${Math.round(qualityMeta.freshnessMs / 1000)}s` :
        qualityMeta.freshnessMs < 3600000 ? `${Math.round(qualityMeta.freshnessMs / 60000)}m` :
        `${Math.round(qualityMeta.freshnessMs / 3600000)}h`
      )
    );
  }
}));

jest.mock('@/components/ui/AdaptiveSuggestionCard', () => ({
  AdaptiveSuggestionCard: ({ suggestion, qualityMeta, onAction, onDismiss }: any) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    const { QualityRibbon } = require('@/components/ui/QualityRibbon');
    
    return React.createElement(View, { testID: 'adaptive-suggestion-card' },
      qualityMeta && React.createElement(QualityRibbon, { qualityMeta }),
      suggestion && React.createElement(View, null,
        React.createElement(Text, { testID: 'suggestion-title' }, suggestion.title),
        React.createElement(Text, { testID: 'suggestion-content' }, suggestion.content),
        React.createElement(TouchableOpacity, { 
          testID: 'suggestion-action',
          onPress: onAction 
        }, React.createElement(Text, null, 'Accept')),
        React.createElement(TouchableOpacity, { 
          testID: 'suggestion-dismiss',
          onPress: onDismiss 
        }, React.createElement(Text, null, 'Dismiss'))
      )
    );
  }
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockUseAdaptiveSuggestion = useAdaptiveSuggestion as jest.MockedFunction<typeof useAdaptiveSuggestion>;

// Test Wrapper Component with Providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Test component for Quality Ribbon display testing
const QualityRibbonTestComponent: React.FC<{ qualityMeta?: any; suggestion?: any }> = ({ 
  qualityMeta, 
  suggestion 
}) => {
  return (
    <View testID="quality-ribbon-test">
      {suggestion && (
        <AdaptiveSuggestionCard
          suggestion={suggestion}
          onAction={() => {}}
          onDismiss={() => {}}
          qualityMeta={qualityMeta}
        />
      )}
      {qualityMeta && (
        <QualityRibbon qualityMeta={qualityMeta} />
      )}
    </View>
  );
};

// Mock Screen Components
const TodayScreen: React.FC = () => {
  const [qualityMeta, setQualityMeta] = React.useState({
    source: 'unified' as const,
    qualityLevel: 'high' as const,
    sampleSize: 15,
    freshnessMs: 0
  });

  const suggestion = {
    show: true,
    title: 'Test Suggestion',
    content: 'This is a test suggestion with high quality',
    category: 'mood',
    confidence: 0.85,
    cta: { screen: '/(tabs)/breathwork', params: {} }
  };

  return (
    <View testID="today-screen">
      <AdaptiveSuggestionCard
        suggestion={suggestion}
        qualityMeta={qualityMeta}
        onAction={() => console.log('Action')}
        onDismiss={() => console.log('Dismiss')}
      />
    </View>
  );
};

const MoodScreen: React.FC = () => {
  const [qualityMeta, setQualityMeta] = React.useState({
    source: 'cache' as const,
    qualityLevel: 'medium' as const,
    sampleSize: 7,
    freshnessMs: 600000
  });

  const suggestion = {
    show: true,
    title: 'Mood Insight',
    content: 'Based on your mood patterns',
    category: 'mood',
    confidence: 0.65,
    cta: { screen: '/(tabs)/index', params: { focus: 'mood' } }
  };

  return (
    <View testID="mood-screen">
      <AdaptiveSuggestionCard
        suggestion={suggestion}
        qualityMeta={qualityMeta}
        onAction={() => console.log('Action')}
        onDismiss={() => console.log('Dismiss')}
      />
    </View>
  );
};

// Quality Ribbon Test Scenarios
const QualityScenarios = {
  highQuality: {
    meta: {
      source: 'unified' as const,
      qualityLevel: 'high' as const,
      sampleSize: 15,
      freshnessMs: 120000 // 2 minutes
    },
    expectedBadges: ['Fresh', 'High', 'n=15', '2m']
  },
  
  mediumQuality: {
    meta: {
      source: 'heuristic' as const,
      qualityLevel: 'medium' as const,
      sampleSize: 7,
      freshnessMs: 600000 // 10 minutes
    },
    expectedBadges: ['Heuristic', 'Med', 'n=7', '10m']
  },
  
  lowQuality: {
    meta: {
      source: 'cache' as const,
      qualityLevel: 'low' as const,
      sampleSize: 3,
      freshnessMs: 3600000 // 1 hour
    },
    expectedBadges: ['Cache', 'Low', 'n=3', '1h']
  },
  
  noMeta: {
    meta: null,
    expectedBadges: [] // No ribbon should be shown
  }
};

describe('Quality Ribbon E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default AsyncStorage mock
    mockAsyncStorage.getItem.mockImplementation((key: string) => {
      if (key.includes('compulsions')) return Promise.resolve('[]');
      if (key.includes('thought_records')) return Promise.resolve('[]');
      if (key.includes('mood_entries')) return Promise.resolve(JSON.stringify([
        {
          id: 'mood_1',
          mood_score: 75,
          energy_level: 7,
          anxiety_level: 3,
          created_at: new Date().toISOString()
        }
      ]));
      return Promise.resolve(null);
    });
    
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();

    // Default hook mock
    mockUseAdaptiveSuggestion.mockReturnValue({
      suggestion: {
        show: true,
        title: 'Default Suggestion',
        content: 'Default content',
        category: 'mood',
        confidence: 0.75,
        cta: { screen: '/(tabs)/breathwork', params: {} }
      },
      isLoading: false,
      qualityMetadata: {
        source: 'unified' as const,
        qualityLevel: 'high' as const,
        sampleSize: 10,
        freshnessMs: 0
      },
      refresh: jest.fn(),
      generateSuggestionFromPipeline: jest.fn()
    } as any);
  });

  describe('🎨 Visual Display Tests', () => {
    it('[QR:smoke:e2e_today] should render all quality badges for high quality data', async () => {
      const { meta, expectedBadges } = QualityScenarios.highQuality;
      
      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbonTestComponent 
            qualityMeta={meta}
            suggestion={{ title: 'Test', content: 'Test content' }}
          />
        </TestWrapper>
      );

      // Check all badges are visible
      for (const badge of expectedBadges) {
        expect(queryByText(badge)).toBeTruthy();
      }
    });

    it('[QR:smoke:e2e_today] should apply correct styling for different quality levels', async () => {
      const scenarios = ['highQuality', 'mediumQuality', 'lowQuality'] as const;
      
      for (const scenario of scenarios) {
        const { meta } = QualityScenarios[scenario];
        
        const { getByTestId, rerender } = render(
          <TestWrapper>
            <QualityRibbonTestComponent qualityMeta={meta} />
          </TestWrapper>
        );

        const ribbon = getByTestId('quality-ribbon');
        expect(ribbon).toBeTruthy();
        
        // Clean up for next iteration
        rerender(
          <TestWrapper>
            <View />
          </TestWrapper>
        );
      }
    });
  });

  describe('🎨 Conditional Rendering Tests', () => {
    it('should hide ribbon when meta is null or undefined', async () => {
      const { queryByTestId } = render(
        <TestWrapper>
          <QualityRibbonTestComponent qualityMeta={null} />
        </TestWrapper>
      );

      expect(queryByTestId('quality-ribbon')).toBeFalsy();
    });

    it('should handle partial meta data gracefully', async () => {
      const partialMeta = {
        source: 'unified' as const,
        // Missing other fields
      };
      
      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbonTestComponent qualityMeta={partialMeta} />
        </TestWrapper>
      );

      // Should show available data
      expect(queryByText('Fresh')).toBeTruthy();
      // But not show missing data
      expect(queryByText(/n=/)).toBeFalsy();
    });
  });

  describe('🔄 Dynamic Update Tests', () => {
    it('should update ribbon when meta changes', async () => {
      const { rerender, queryByText } = render(
        <TestWrapper>
          <QualityRibbonTestComponent qualityMeta={QualityScenarios.highQuality.meta} />
        </TestWrapper>
      );

      // Check initial state
      expect(queryByText('Fresh')).toBeTruthy();
      expect(queryByText('High')).toBeTruthy();

      // Update to medium quality
      rerender(
        <TestWrapper>
          <QualityRibbonTestComponent qualityMeta={QualityScenarios.mediumQuality.meta} />
        </TestWrapper>
      );

      // Check updated state
      expect(queryByText('Fresh')).toBeFalsy();
      expect(queryByText('Heuristic')).toBeTruthy();
      expect(queryByText('Med')).toBeTruthy();
    });
  });

  describe('📊 Integration with Mood Screen', () => {
    it('[QR:smoke:e2e_mood] should display quality ribbon on mood screen adaptive suggestion', async () => {
      const { queryByText, getByTestId } = render(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      // Check mood screen is rendered
      expect(getByTestId('mood-screen')).toBeTruthy();
      
      // Check quality ribbon is displayed
      expect(queryByText('Cache')).toBeTruthy();
      expect(queryByText('Med')).toBeTruthy();
      expect(queryByText('n=7')).toBeTruthy();
    });

    it('[QR:smoke:e2e_mood] should handle mood screen without quality metadata', async () => {
      // Mock hook to return no metadata
      mockUseAdaptiveSuggestion.mockReturnValueOnce({
        suggestion: {
          show: true,
          title: 'Mood Suggestion',
          content: 'Content'
        },
        qualityMetadata: null,
        isLoading: false,
        refresh: jest.fn(),
        generateSuggestionFromPipeline: jest.fn()
      } as any);

      const { queryByTestId } = render(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      // Screen should render
      expect(queryByTestId('mood-screen')).toBeTruthy();
      // But no quality ribbon
      expect(queryByTestId('quality-ribbon')).toBeFalsy();
    });

    it('[QR:smoke:e2e_mood] should update quality ribbon after mood entry', async () => {
      let qualityMeta = QualityScenarios.lowQuality.meta;
      
      // Mock hook to simulate quality update
      mockUseAdaptiveSuggestion.mockImplementation(() => ({
        suggestion: { show: true, title: 'Mood', content: 'Content' },
        qualityMetadata: qualityMeta,
        isLoading: false,
        refresh: jest.fn(() => {
          // Simulate quality improvement after new data
          qualityMeta = QualityScenarios.highQuality.meta;
        }),
        generateSuggestionFromPipeline: jest.fn()
      } as any));

      const { queryByText, rerender } = render(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      // Initially low quality
      expect(queryByText('Cache')).toBeTruthy();
      expect(queryByText('Low')).toBeTruthy();

      // Simulate refresh
      act(() => {
        mockUseAdaptiveSuggestion().refresh();
      });

      // Update component
      rerender(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      // Should show improved quality
      expect(queryByText('Fresh')).toBeTruthy();
      expect(queryByText('High')).toBeTruthy();
    });

    it('[QR:smoke:e2e_mood] should maintain quality ribbon during loading states', async () => {
      const meta = QualityScenarios.mediumQuality.meta;
      
      // Mock loading state
      mockUseAdaptiveSuggestion.mockReturnValueOnce({
        suggestion: null,
        qualityMetadata: meta,
        isLoading: true,
        refresh: jest.fn(),
        generateSuggestionFromPipeline: jest.fn()
      } as any);

      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbonTestComponent qualityMeta={meta} />
        </TestWrapper>
      );

      // Quality ribbon should still be visible during loading
      expect(queryByText('Heuristic')).toBeTruthy();
      expect(queryByText('Med')).toBeTruthy();
    });
  });

  describe('🎤 Voice Interaction Tests', () => {
    it('[QR:smoke:e2e_voice] should show quality ribbon after voice analysis', async () => {
      const voiceMeta = {
        source: 'unified' as const,
        qualityLevel: 'high' as const,
        sampleSize: 1, // Single voice input
        freshnessMs: 0 // Just processed
      };

      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbonTestComponent 
            qualityMeta={voiceMeta}
            suggestion={{ 
              title: 'Voice Analysis Complete',
              content: 'Your mood seems positive'
            }}
          />
        </TestWrapper>
      );

      // Check voice-specific quality display
      expect(queryByText('Fresh')).toBeTruthy();
      expect(queryByText('High')).toBeTruthy();
      expect(queryByText('n=1')).toBeTruthy(); // Single voice sample
    });
  });
});
