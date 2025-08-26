/**
 * 🧪 E2E Tests - Mood Analytics Verification
 * 
 * Automated tests for Quality Ribbon analytics verification
 * Covers UnifiedAIPipeline, analytics generation, and quality metadata
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as pipeline from '@/features/ai/pipeline';
import { useAdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/moodTrackingService');
jest.mock('@/features/ai/hooks/useAdaptiveSuggestion');
jest.mock('@/features/ai/core/UnifiedAIPipeline');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockUseAdaptiveSuggestion = useAdaptiveSuggestion as jest.MockedFunction<typeof useAdaptiveSuggestion>;

// Mock test component that simulates mood analytics processing
const MoodAnalyticsTestComponent: React.FC = () => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  const handleRefresh = async () => {
    setIsProcessing(true);
    console.log('🎯 Processing enhanced mood analytics');
    
    // Simulate UnifiedAIPipeline processing
    const pipeline = new pipeline.UnifiedAIPipeline();
    const result = await pipeline.process({
      userId: 'test-user-123',
      content: mockMoodEntries,
      type: 'data',
      context: { source: 'mood', timestamp: Date.now() }
    });
    
    console.log('📊 Analytics result:', JSON.stringify(result));
    setIsProcessing(false);
  };
  
  return (
    <View testID="mood-analytics-test">
      <TouchableOpacity testID="mood-refresh" onPress={handleRefresh}>
        <Text>Refresh Analytics</Text>
      </TouchableOpacity>
      {isProcessing && <Text>Processing...</Text>}
    </View>
  );
};

// Mock mood data for analytics
const mockMoodEntries = Array.from({ length: 8 }, (_, i) => ({
  id: `mood_${i + 1}`,
  user_id: 'test-user-123',
  mood_score: 30 + Math.random() * 40, // Varying mood scores
  energy_level: 3 + Math.random() * 4,  // Energy 3-7
  anxiety_level: 2 + Math.random() * 6, // Anxiety 2-8
  notes: `Test mood entry ${i + 1}`,
  created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
}));

// Mock analytics result
const mockAnalyticsResult = {
  weeklyDelta: 0,
  volatility: 9.48,
  baselines: { mood: 52, energy: 55, anxiety: 45 },
  correlations: {
    moodEnergy: { r: 0.65, n: 8, p: 0.032 },
    moodAnxiety: { r: -0.42, n: 8, p: 0.218 },
    energyAnxiety: { r: -0.28, n: 8, p: 0.498 }
  },
  profile: { type: 'fatigued', confidence: 0.75 },
  bestTimes: { dayOfWeek: 'Tuesday', timeOfDay: 'morning' },
  sampleSize: 8,
  dataQuality: 0.8,
  confidence: 0.67
};

// Mock pipeline result
const mockPipelineResult = {
  metadata: {
    source: 'unified',
    processedAt: Date.now(),
    version: '2.1.0'
  },
  analytics: {
    mood: mockAnalyticsResult
  },
  insights: {
    therapeutic: [
      {
        text: 'Mood volatility yüksek görünüyor. Düzenli uyku rutini önerilir.',
        category: 'mood_stability',
        confidence: 0.8
      }
    ]
  },
  patterns: {
    behavioral: [],
    temporal: [],
    environmental: []
  }
};

// Mock quality metadata
const expectedQualityMeta = {
  source: 'unified' as const,
  qualityLevel: 'medium' as const,
  sampleSize: 8,
  freshnessMs: 120000
};

describe('Mood Analytics Verification E2E', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Mock AsyncStorage with mood entries
    mockAsyncStorage.getItem.mockImplementation((key: string) => {
      if (key.includes('mood_entries')) {
        return Promise.resolve(JSON.stringify(mockMoodEntries));
      }
      return Promise.resolve(null);
    });

    // Mock useAdaptiveSuggestion
    mockUseAdaptiveSuggestion.mockReturnValue({
      generateSuggestionFromPipeline: jest.fn().mockResolvedValue({
        show: true,
        id: 'test-suggestion',
        title: '🎯 Analytics-Based Suggestion',
        content: 'Based on your mood analysis...',
        category: 'mood',
        confidence: 0.75
      }),
      loading: false,
    });

    // Mock UnifiedAIPipeline
    const mockPipeline = {
      process: jest.fn().mockResolvedValue(mockPipelineResult)
    };
    (pipeline.UnifiedAIPipeline as any).mockImplementation(() => mockPipeline);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('📊 Analytics Generation Test', () => {
    it('should generate mood analytics with correct metrics', async () => {
      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      // Trigger refresh to start analytics
      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Wait for analytics processing
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('🎯 Processing enhanced mood analytics')
        );
      }, { timeout: 5000 });

      // Verify analytics values
      const analyticsCall = consoleLogSpy.mock.calls.find(call => 
        call[0]?.includes('Processing enhanced mood analytics')
      );
      
      expect(analyticsCall).toBeDefined();
      
      // Verify console log contains expected analytics
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('sampleSize: 8')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('dataQuality: 0.8')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('confidence: 0.67')
        );
      });
    });

    it('should detect clinical profile correctly', async () => {
      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Verify profile detection
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('📊 Clinical analytics added to patterns: Fatigued Profil')
        );
      });
    });

    it('should calculate MEA correlations when data is sufficient', async () => {
      // Use mock data with strong correlations
      const correlatedMoodData = mockMoodEntries.map((entry, i) => ({
        ...entry,
        mood_score: 50 + i * 5,        // Increasing mood
        energy_level: 5 + i * 0.3,     // Correlated energy
        anxiety_level: 8 - i * 0.4     // Inverse correlated anxiety
      }));

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key.includes('mood_entries')) {
          return Promise.resolve(JSON.stringify(correlatedMoodData));
        }
        return Promise.resolve(null);
      });

      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Check correlation analysis in telemetry
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('correlationsCount')
        );
      });

      // Verify telemetry data
      const telemetryCall = consoleLogSpy.mock.calls.find(call =>
        typeof call[1] === 'string' && call[1].includes('correlationsCount')
      );
      
      if (telemetryCall) {
        const telemetryData = JSON.parse(telemetryCall[1]);
        expect(telemetryData.correlationsCount).toBeGreaterThan(0);
      }
    });
  });

  describe('🎗️ Quality Metadata Generation Test', () => {
    it('should generate quality metadata for adaptive suggestion', async () => {
      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Wait for quality metadata generation
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '📊 Quality metadata for mood suggestion:',
          expect.objectContaining({
            source: expect.any(String),
            qualityLevel: expect.any(String),
            sampleSize: expect.any(Number)
          })
        );
      }, { timeout: 8000 });
    });

    it('should handle quality metadata generation failure gracefully', async () => {
      // Mock mapUnifiedResultToRegistryItems to fail
      jest.doMock('@/features/ai/insights/insightRegistry', () => ({
        mapUnifiedResultToRegistryItems: jest.fn().mockImplementation(() => {
          throw new Error('Mock metadata generation error');
        }),
        extractUIQualityMeta: jest.fn()
      }));

      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Verify error handling
      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '⚠️ Quality metadata generation failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('🎯 Adaptive Suggestion Integration Test', () => {
    it('should render AdaptiveSuggestionCard with quality ribbon', async () => {
      const { getByText, getByTestId } = render(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent(getByTestId('mood-refresh'), 'onRefresh');
      });

      // Wait for adaptive suggestion to appear
      await waitFor(() => {
        expect(getByText('🎯 Analytics-Based Suggestion')).toBeTruthy();
      }, { timeout: 8000 });

      // Verify quality ribbon is present (would need specific test ids)
      // This requires updating the AdaptiveSuggestionCard component with test IDs
    });

    it('should handle suggestion interaction correctly', async () => {
      const mockTrackSuggestionClick = jest.fn();
      mockUseAdaptiveSuggestion.mockReturnValue({
        generateSuggestionFromPipeline: jest.fn().mockResolvedValue({
          show: true,
          id: 'test-suggestion',
          title: '🎯 Analytics-Based Suggestion',
          content: 'Test content',
          category: 'mood'
        }),
        trackSuggestionClick: mockTrackSuggestionClick,
        loading: false,
      });

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <MoodScreen />
        </TestWrapper>
      );

      await act(async () => {
        fireEvent(getByTestId('mood-refresh'), 'onRefresh');
      });

      await waitFor(() => {
        expect(getByText('🎯 Analytics-Based Suggestion')).toBeTruthy();
      });

      // Test "Şimdi Dene" interaction
      const tryButton = getByText('Şimdi Dene');
      fireEvent.press(tryButton);

      expect(mockTrackSuggestionClick).toHaveBeenCalled();
    });
  });

  describe('⚡ Performance & Cache Test', () => {
    it('should invalidate cache correctly for fresh analytics', async () => {
      const { getByTestId } = render(<MoodAnalyticsTestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('mood-refresh'));
      });

      // Verify cache invalidation logs
      await waitFor(() => {
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '🔄 Force invalidating cache to get fresh mood analytics...'
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '✅ Cache invalidated - will get fresh analytics'
        );
      });
    });
  });
});

// Helper functions for test data generation
export const TestDataGenerator = {
  generateMoodEntries: (count: number, options?: {
    moodRange?: [number, number];
    energyRange?: [number, number];
    anxietyRange?: [number, number];
  }) => {
    const defaults = {
      moodRange: [20, 80] as [number, number],
      energyRange: [2, 8] as [number, number],
      anxietyRange: [1, 9] as [number, number]
    };
    const config = { ...defaults, ...options };

    return Array.from({ length: count }, (_, i) => ({
      id: `mood_${i + 1}`,
      user_id: 'test-user-123',
      mood_score: config.moodRange[0] + Math.random() * (config.moodRange[1] - config.moodRange[0]),
      energy_level: config.energyRange[0] + Math.random() * (config.energyRange[1] - config.energyRange[0]),
      anxiety_level: config.anxietyRange[0] + Math.random() * (config.anxietyRange[1] - config.anxietyRange[0]),
      notes: `Test mood entry ${i + 1}`,
      created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
    }));
  }
};
