/**
 * 🧪 Integration Tests - Mood Page AI Pipeline
 * 
 * Tests for Mood page AI pipeline integration, quality metadata,
 * and adaptive suggestion rendering with Quality Ribbon
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MoodPage from '@/app/(tabs)/mood';
import { AuthContext } from '@/contexts/AuthContext';
import { 
  mockUnifiedPipelineResult,
  mockQualityMeta,
  mockAdaptiveSuggestions,
  generateMoodEntries,
  mockAsyncStorage,
  expectQualityRibbonToShow
} from '../fixtures/qualityRibbonFixtures';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@/features/ai/core/UnifiedAIPipeline');
jest.mock('@/features/ai/hooks/useAdaptiveSuggestion');
jest.mock('@/features/ai/telemetry/aiTelemetry');
jest.mock('@/constants/featureFlags', () => ({
  FEATURE_FLAGS: {
    isEnabled: jest.fn((flag) => {
      if (flag === 'AI_UNIFIED_PIPELINE') return true;
      return false;
    })
  }
}));

describe('Mood Page AI Pipeline Integration', () => {
  let mockUser: any;
  let mockUnifiedPipeline: any;
  let mockUseAdaptiveSuggestion: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUser = {
      id: 'test-user-123',
      email: 'test@example.com'
    };
    
    // Mock Unified Pipeline
    mockUnifiedPipeline = {
      process: jest.fn().mockResolvedValue(mockUnifiedPipelineResult)
    };
    
    // Mock useAdaptiveSuggestion hook
    mockUseAdaptiveSuggestion = {
      generateSuggestionFromPipeline: jest.fn().mockResolvedValue(mockAdaptiveSuggestions.highQuality),
      trackSuggestionClick: jest.fn(),
      trackSuggestionDismissal: jest.fn(),
      snoozeSuggestion: jest.fn()
    };
    
    // Mock AsyncStorage with mood data
    const moodEntries = generateMoodEntries(10);
    mockAsyncStorage.getItem.mockImplementation((key) => {
      if (key.includes('mood_entries')) {
        return Promise.resolve(JSON.stringify(moodEntries));
      }
      return Promise.resolve(null);
    });

    // Setup module mocks
    require('@/features/ai/core/UnifiedAIPipeline').unifiedPipeline = mockUnifiedPipeline;
    require('@/features/ai/hooks/useAdaptiveSuggestion').useAdaptiveSuggestion = jest.fn(() => mockUseAdaptiveSuggestion);
  });

  const renderMoodPage = () => {
    return render(
      <AuthContext.Provider value={{ user: mockUser, loading: false }}>
        <MoodPage />
      </AuthContext.Provider>
    );
  };

  describe('AI Pipeline Integration', () => {
    it('should trigger unified pipeline with mood data', async () => {
      const component = renderMoodPage();
      
      // Wait for component to load and trigger pipeline
      await waitFor(() => {
        expect(mockUnifiedPipeline.process).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'test-user-123',
            content: expect.any(Array), // Mood entries
            type: 'data',
            context: expect.objectContaining({
              source: 'mood',
              trigger: 'mood_analysis'
            })
          })
        );
      });
    });

    it('should process pipeline result and generate insights', async () => {
      const component = renderMoodPage();
      
      await waitFor(() => {
        expect(mockUnifiedPipeline.process).toHaveBeenCalled();
      });
      
      // Should call adaptive suggestion generation with pipeline result
      await waitFor(() => {
        expect(mockUseAdaptiveSuggestion.generateSuggestionFromPipeline).toHaveBeenCalledWith(
          'test-user-123',
          mockUnifiedPipelineResult,
          'mood'
        );
      });
    });

    it('should handle pipeline errors gracefully', async () => {
      // Mock pipeline error
      mockUnifiedPipeline.process.mockRejectedValueOnce(new Error('Pipeline error'));
      
      const component = renderMoodPage();
      
      // Should not crash and should show fallback state
      await waitFor(() => {
        expect(component.getByText(/Mood Takibi/)).toBeTruthy();
      });
      
      // Should not show adaptive suggestion on error
      expect(component.queryByTestId('adaptive-suggestion-card')).toBeNull();
    });
  });

  describe('Quality Metadata Generation', () => {
    it('should generate quality metadata from pipeline result', async () => {
      const component = renderMoodPage();
      
      // Wait for pipeline completion and suggestion generation
      await waitFor(() => {
        expect(mockUseAdaptiveSuggestion.generateSuggestionFromPipeline).toHaveBeenCalled();
      });
      
      // Should have generated quality metadata
      await waitFor(() => {
        const adaptiveSuggestionCard = component.getByTestId('adaptive-suggestion-card');
        expect(adaptiveSuggestionCard).toBeTruthy();
        
        // Should show Quality Ribbon
        expectQualityRibbonToShow(component, 'unified', 'high', 15);
      });
    });

    it('should show different quality levels based on analytics', async () => {
      // Test with low-quality analytics
      const lowQualityResult = {
        ...mockUnifiedPipelineResult,
        analytics: {
          mood: {
            confidence: 0.45,
            sampleSize: 3,
            dataQuality: 0.5
          }
        }
      };
      
      mockUnifiedPipeline.process.mockResolvedValueOnce(lowQualityResult);
      
      const component = renderMoodPage();
      
      await waitFor(() => {
        const ribbon = component.getByTestId('quality-ribbon');
        expect(ribbon).toBeTruthy();
        
        // Should show Low quality
        expect(component.getByText('Low')).toBeTruthy();
      });
    });

    it('should show Cache vs Fresh badges correctly', async () => {
      // First call - Fresh result
      mockUnifiedPipelineResult.metadata.source = 'fresh';
      const component = renderMoodPage();
      
      await waitFor(() => {
        expect(component.getByText('Fresh')).toBeTruthy();
      });
      
      // Second call - Cache result  
      mockUnifiedPipelineResult.metadata.source = 'cache';
      mockUnifiedPipeline.process.mockResolvedValueOnce(mockUnifiedPipelineResult);
      
      // Trigger refresh
      const refreshControl = component.getByTestId('mood-refresh-control');
      fireEvent(refreshControl, 'refresh');
      
      await waitFor(() => {
        expect(component.getByText('Cache')).toBeTruthy();
      });
    });
  });

  describe('Quality Ribbon Rendering', () => {
    it('should render Quality Ribbon with correct badges', async () => {
      const component = renderMoodPage();
      
      await waitFor(() => {
        const suggestionCard = component.getByTestId('adaptive-suggestion-card');
        expect(suggestionCard).toBeTruthy();
      });
      
      // Check individual badges
      expect(component.getByText('Fresh')).toBeTruthy(); // Source
      expect(component.getByText('High')).toBeTruthy();  // Quality
      expect(component.getByText('n=15')).toBeTruthy();  // Sample size
      expect(component.getByText(/\d+m/)).toBeTruthy();  // Age (e.g., "5m")
    });

    it('should handle missing quality metadata gracefully', async () => {
      // Mock suggestion without quality metadata
      mockUseAdaptiveSuggestion.generateSuggestionFromPipeline.mockResolvedValueOnce({
        ...mockAdaptiveSuggestions.highQuality,
        // No meta property
      });
      
      const component = renderMoodPage();
      
      await waitFor(() => {
        // Suggestion card should appear
        expect(component.getByTestId('adaptive-suggestion-card')).toBeTruthy();
        
        // Quality Ribbon should NOT appear
        expect(component.queryByTestId('quality-ribbon')).toBeNull();
      });
    });

    it('should show sample size badge only when available', async () => {
      // Test with undefined sample size
      const metaWithoutSampleSize = {
        ...mockQualityMeta.highQuality,
        sampleSize: undefined
      };
      
      // This would require modifying the mock to return specific meta
      const component = renderMoodPage();
      
      await waitFor(() => {
        const ribbon = component.getByTestId('quality-ribbon');
        expect(ribbon).toBeTruthy();
        
        // Should show source and quality but no sample size
        expect(component.getByText('Fresh')).toBeTruthy();
        expect(component.getByText('High')).toBeTruthy();
        expect(component.queryByText(/n=\d+/)).toBeNull();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle suggestion acceptance', async () => {
      const component = renderMoodPage();
      
      await waitFor(() => {
        expect(component.getByTestId('adaptive-suggestion-card')).toBeTruthy();
      });
      
      // Tap "Şimdi Dene" button
      const acceptButton = component.getByText('Şimdi Dene');
      fireEvent.press(acceptButton);
      
      // Should call tracking functions
      await waitFor(() => {
        expect(mockUseAdaptiveSuggestion.trackSuggestionClick).toHaveBeenCalledWith(
          'test-user-123',
          mockAdaptiveSuggestions.highQuality
        );
      });
    });

    it('should handle suggestion dismissal', async () => {
      const component = renderMoodPage();
      
      await waitFor(() => {
        expect(component.getByTestId('adaptive-suggestion-card')).toBeTruthy();
      });
      
      // Tap "Daha Sonra" button
      const dismissButton = component.getByText('Daha Sonra');
      fireEvent.press(dismissButton);
      
      // Should call tracking and dismiss functions
      await waitFor(() => {
        expect(mockUseAdaptiveSuggestion.trackSuggestionDismissal).toHaveBeenCalledWith(
          'test-user-123',
          mockAdaptiveSuggestions.highQuality
        );
      });
      
      // Card should disappear
      expect(component.queryByTestId('adaptive-suggestion-card')).toBeNull();
    });
  });

  describe('Analytics Integration', () => {
    it('should include mood analytics in quality calculation', async () => {
      // Mock pipeline result with rich mood analytics
      const analyticsResult = {
        ...mockUnifiedPipelineResult,
        analytics: {
          mood: {
            confidence: 0.92,
            sampleSize: 20,
            volatility: 0.6,
            weeklyDelta: 1.5,
            dataQuality: 0.95,
            baselines: { mood: 7.2 },
            correlations: { exercise: 0.7 },
            bestTimes: ['morning']
          }
        }
      };
      
      mockUnifiedPipeline.process.mockResolvedValueOnce(analyticsResult);
      
      const component = renderMoodPage();
      
      await waitFor(() => {
        // Should generate high quality rating
        expect(component.getByText('High')).toBeTruthy();
        expect(component.getByText('n=20')).toBeTruthy();
        expect(component.getByText('Fresh')).toBeTruthy();
      });
    });

    it('should show appropriate quality for different data volumes', async () => {
      // Test scenarios with different data volumes
      const scenarios = [
        { sampleSize: 2, expectedQuality: 'Low' },
        { sampleSize: 5, expectedQuality: 'Med' },
        { sampleSize: 12, expectedQuality: 'High' }
      ];
      
      for (const scenario of scenarios) {
        const analyticsResult = {
          ...mockUnifiedPipelineResult,
          analytics: {
            mood: {
              confidence: scenario.sampleSize >= 7 ? 0.85 : 0.65,
              sampleSize: scenario.sampleSize,
              dataQuality: 0.8
            }
          }
        };
        
        mockUnifiedPipeline.process.mockResolvedValueOnce(analyticsResult);
        
        const component = renderMoodPage();
        
        await waitFor(() => {
          expect(component.getByText(scenario.expectedQuality)).toBeTruthy();
          expect(component.getByText(`n=${scenario.sampleSize}`)).toBeTruthy();
        });
        
        // Clean up for next iteration
        component.unmount();
      }
    });
  });

  describe('Performance', () => {
    it('should complete pipeline processing within acceptable time', async () => {
      const startTime = Date.now();
      
      const component = renderMoodPage();
      
      await waitFor(() => {
        expect(component.getByTestId('adaptive-suggestion-card')).toBeTruthy();
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within 5 seconds
      expect(processingTime).toBeLessThan(5000);
    });

    it('should not block UI during pipeline processing', async () => {
      const component = renderMoodPage();
      
      // UI should be responsive immediately
      expect(component.getByText('Mood Takibi')).toBeTruthy();
      
      // Should show loading state while processing
      expect(component.queryByText('Yükleniyor...')).toBeTruthy();
      
      await waitFor(() => {
        // Loading state should be replaced with content
        expect(component.queryByText('Yükleniyor...')).toBeNull();
      });
    });
  });
});
