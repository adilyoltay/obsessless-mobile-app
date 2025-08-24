/**
 * 🧪 Today Page Quality Ribbon E2E Tests
 * 
 * Tests the complete flow of Quality Ribbon display and AdaptiveSuggestionCard actions
 * on the Today page, including user interactions and state changes.
 * 
 * Coverage:
 * - Quality Ribbon rendering with proper metadata
 * - AdaptiveSuggestionCard display and interactions
 * - "Şimdi Dene" / "Daha Sonra" action flows
 * - AI suggestion generation and display
 */

import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TodayScreen from '@/app/(tabs)/index';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { AIProvider } from '@/contexts/AIContext';
import { useAdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/moodTrackingService');
jest.mock('@/features/ai/hooks/useAdaptiveSuggestion');
jest.mock('@/features/ai/core/UnifiedAIPipeline');
jest.mock('@/contexts/SupabaseAuthContext', () => ({
  ...jest.requireActual('@/contexts/SupabaseAuthContext'),
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@example.com' },
    loading: false,
  }),
}));
jest.mock('@/contexts/AIContext', () => ({
  ...jest.requireActual('@/contexts/AIContext'),
  useAI: () => ({
    isInitialized: true,
    availableFeatures: ['AI_INSIGHTS', 'AI_ADAPTIVE_INTERVENTIONS'],
  }),
  useAIUserData: () => ({
    hasCompletedOnboarding: true,
  }),
  useAIActions: () => ({
    generateInsights: jest.fn(),
  }),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockUseAdaptiveSuggestion = useAdaptiveSuggestion as jest.MockedFunction<typeof useAdaptiveSuggestion>;

// Test Wrapper Component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthProvider>
    <AIProvider>
      {children}
    </AIProvider>
  </AuthProvider>
);

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

describe('Today Page Quality Ribbon E2E Tests', () => {
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

    it('should handle dismiss action correctly', async () => {
      const { getByTestId, queryByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Wait for suggestion to appear
      await act(async () => {
        await waitFor(() => {
          expect(queryByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // Find and tap dismiss button (X icon)
      const dismissButton = getByTestId('adaptive-suggestion-dismiss');
      expect(dismissButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(dismissButton);
      });

      // Verify suggestion card is hidden after dismiss
      await waitFor(() => {
        expect(queryByText(mockAdaptiveSuggestion.title)).toBeFalsy();
      });
    });
  });

  describe('🔄 AI Integration Flow', () => {
    it('should generate suggestions after deep analysis phase', async () => {
      const mockGenerateSuggestion = jest.fn().mockResolvedValue(mockAdaptiveSuggestion);
      mockUseAdaptiveSuggestion.mockReturnValue({
        generateSuggestion: mockGenerateSuggestion,
        loading: false,
      });

      render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // Wait for deep analysis to complete (3s timeout + processing)
      await act(async () => {
        jest.advanceTimersByTime(4000);
        await waitFor(() => {
          expect(mockGenerateSuggestion).toHaveBeenCalledWith('test-user-123');
        }, { timeout: 6000 });
      });
    });

    it('should respect cooldown periods', async () => {
      // Mock recent suggestion in AsyncStorage
      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key.includes('adaptive_suggestion_last_')) {
          // Recent suggestion (within cooldown)
          return Promise.resolve((Date.now() - 1800000).toString()); // 30 minutes ago
        }
        return Promise.resolve(null);
      });

      const mockGenerateSuggestion = jest.fn().mockResolvedValue({ show: false });
      mockUseAdaptiveSuggestion.mockReturnValue({
        generateSuggestion: mockGenerateSuggestion,
        loading: false,
      });

      const { queryByText } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      await act(async () => {
        jest.advanceTimersByTime(4000);
      });

      // Should not show suggestion due to cooldown
      await waitFor(() => {
        expect(queryByText(mockAdaptiveSuggestion.title)).toBeFalsy();
      });
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

      // Should reuse cached data and not make additional AsyncStorage calls
      await waitFor(() => {
        const newCallCount = mockAsyncStorage.getItem.mock.calls.length;
        expect(newCallCount).toBeLessThanOrEqual(initialCallCount + 5); // Allow some additional calls but not full reload
      });
    });
  });

  describe('🎨 UI State Management', () => {
    it('should maintain consistent UI state during suggestion lifecycle', async () => {
      const { getByText, queryByText, rerender } = render(
        <TestWrapper>
          <TodayScreen />
        </TestWrapper>
      );

      // 1. Initial state - no suggestion
      expect(queryByText(mockAdaptiveSuggestion.title)).toBeFalsy();

      // 2. Suggestion appears after AI processing
      await act(async () => {
        jest.advanceTimersByTime(4000);
        await waitFor(() => {
          expect(getByText(mockAdaptiveSuggestion.title)).toBeTruthy();
        }, { timeout: 5000 });
      });

      // 3. Quality Ribbon should be visible
      expect(queryByText('High')).toBeTruthy();

      // 4. User interacts with suggestion
      const tryButton = getByText('Şimdi Dene');
      fireEvent.press(tryButton);

      // 5. Component should handle state transition gracefully
      await waitFor(() => {
        // Suggestion might be hidden or updated after interaction
        expect(queryByText(mockAdaptiveSuggestion.title)).toBeTruthy(); // Still there until navigation
      });
    });
  });
});
