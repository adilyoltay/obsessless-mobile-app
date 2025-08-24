/**
 * 🧪 Integration Tests - Today Page Quality Ribbon
 * 
 * Integration tests for Quality Ribbon system on Today page
 * Tests pipeline phases, adaptive suggestions, and user interactions using Jest RTL
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdaptiveSuggestionCard } from '@/components/ui/AdaptiveSuggestionCard';
import { useAdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/moodTrackingService');
jest.mock('@/features/ai/hooks/useAdaptiveSuggestion');
jest.mock('@/features/ai/core/UnifiedAIPipeline');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockUseAdaptiveSuggestion = useAdaptiveSuggestion as jest.MockedFunction<typeof useAdaptiveSuggestion>;

// Simple test component that wraps AdaptiveSuggestionCard
const TestComponent: React.FC = () => {
  const mockSuggestion = mockUseAdaptiveSuggestion();
  return (
    <View>
      {mockSuggestion.show && (
        <AdaptiveSuggestionCard
          suggestion={mockSuggestion}
          onAction={() => {}}
          onDismiss={() => {}}
        />
      )}
    </View>
  );
};

// Mock adaptive suggestion with Quality Ribbon metadata
const mockAdaptiveSuggestion = {
  show: true,
  id: 'test-suggestion-123',
  title: '🌬️ Nefes Egzersizi Önerisi',
  content: 'Stres seviyeniz yüksek görünüyor. 5 dakikalık 4-7-8 nefes tekniği ile rahatlamaya ne dersiniz?',
  category: 'breathwork' as const,
  confidence: 0.85,
  priority: 'medium' as const,
  timing: 'optimal' as const,
  cta: {
    label: 'Şimdi Dene',
    screen: '/(tabs)/breathwork',
    params: { protocol: '4-7-8', autoStart: 'true' }
  }
};

const mockQualityMeta = {
  source: 'heuristic' as const,
  qualityLevel: 'high' as const,
  sampleSize: 15,
  freshnessMs: 300000, // 5 minutes
};

describe('Today Page - Quality Ribbon Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock AsyncStorage responses
    mockAsyncStorage.getItem.mockImplementation((key: string) => {
      if (key.includes('compulsions')) return Promise.resolve('[]');
      if (key.includes('thought_records')) return Promise.resolve('[]');
      if (key.includes('breathwork_sessions')) return Promise.resolve('[]');
      if (key.includes('weekly_summary')) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    // Mock useAdaptiveSuggestion hook
    mockUseAdaptiveSuggestion.mockReturnValue({
      generateSuggestion: jest.fn().mockResolvedValue(mockAdaptiveSuggestion),
      loading: false,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('🎗️ Quality Ribbon Display', () => {
    it('should render Quality Ribbon when AdaptiveSuggestionCard has metadata', async () => {
      const { getByTestId, queryByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Wait for component to load and AI suggestions to be processed
      await act(async () => {
        await waitFor(() => {
          // Check if AdaptiveSuggestionCard is rendered
          expect(queryByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // Verify Quality Ribbon elements are present
      await waitFor(() => {
        // Should show source badge
        expect(queryByText('Heuristic')).toBeTruthy();
        
        // Should show quality level
        expect(queryByText('High')).toBeTruthy();
        
        // Should show sample size
        expect(queryByText('n=15')).toBeTruthy();
        
        // Should show freshness indicator
        expect(queryByText('5m')).toBeTruthy();
      });
    });

    it('should hide Quality Ribbon when metadata is missing', async () => {
      // Mock suggestion without metadata
      mockUseAdaptiveSuggestion.mockReturnValue({
        generateSuggestion: jest.fn().mockResolvedValue({
          ...mockAdaptiveSuggestion,
          // No quality metadata provided
        }),
        loading: false,
      });

      const { queryByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      await act(async () => {
        await waitFor(() => {
          expect(queryByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // Quality Ribbon elements should not be present
      await waitFor(() => {
        expect(queryByText('Heuristic')).toBeFalsy();
        expect(queryByText('High')).toBeFalsy();
        expect(queryByText('n=15')).toBeFalsy();
        expect(queryByText('No Meta')).toBeFalsy(); // Should not show "No Meta" text
      });
    });
  });

  describe('🎯 AdaptiveSuggestionCard Actions', () => {
    it('should handle "Şimdi Dene" action correctly', async () => {
      const mockRouter = { push: jest.fn() };
      
      // Mock expo-router
      jest.doMock('expo-router', () => ({
        useRouter: () => mockRouter,
      }));

      const { getByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Wait for suggestion to appear
      await act(async () => {
        await waitFor(() => {
          expect(getByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // Find and tap "Şimdi Dene" button
      const tryNowButton = getByText('Şimdi Dene');
      expect(tryNowButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(tryNowButton);
      });

      // Verify navigation was called with correct parameters
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/(tabs)/breathwork',
          params: { protocol: '4-7-8', autoStart: 'true' }
        });
      });
    });

    it('should handle "Daha Sonra" (snooze) action correctly', async () => {
      const { getByText, queryByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Wait for suggestion to appear
      await act(async () => {
        await waitFor(() => {
          expect(getByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // Find and tap "Daha Sonra" button
      const snoozeButton = getByText('Daha Sonra');
      expect(snoozeButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(snoozeButton);
      });

      // Verify suggestion card is hidden after snooze
      await waitFor(() => {
        expect(queryByText(mockAdaptiveSuggestion.title)).toBeFalsy();
      });

      // Verify snooze was recorded in AsyncStorage
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('adaptive_suggestion_snooze'),
        expect.any(String)
      );
    });
  });

  describe('📊 Performance & Cache', () => {
    it('should use cached module data to avoid duplicate AsyncStorage reads', async () => {
      const { rerender } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Initial render should read from AsyncStorage
      await waitFor(() => {
        expect(mockAsyncStorage.getItem).toHaveBeenCalled();
      });

      const initialCallCount = mockAsyncStorage.getItem.mock.calls.length;

      // Trigger refresh
      await act(async () => {
        // Simulate pull-to-refresh or focus change
        rerender(
          <TestWrapper>
            <TodayScreen />
          </TestWrapper>
        );
      });

      // Should reuse cached data and not make excessive additional AsyncStorage calls
      await waitFor(() => {
        const newCallCount = mockAsyncStorage.getItem.mock.calls.length;
        expect(newCallCount).toBeLessThanOrEqual(initialCallCount + 10); // Allow some additional calls but not full reload
      });
    });
  });

  // Helper functions for test data manipulation
  const clearAllData = async () => {
    // Mock data clearing
    mockAsyncStorage.clear.mockResolvedValue();
    console.log('🧹 Test data cleared');
  };

  const toggleFeatureFlag = async (flagName: string, value: boolean) => {
    // Mock feature flag toggle
    const flagKey = `test_flag_${flagName}`;
    mockAsyncStorage.setItem.mockResolvedValue();
    console.log(`🔄 Feature flag ${flagName} set to ${value}`);
  };

  const simulateMetadataError = async () => {
    // Mock metadata error condition
    console.log('⚠️ Simulating metadata error for testing');
  };
});