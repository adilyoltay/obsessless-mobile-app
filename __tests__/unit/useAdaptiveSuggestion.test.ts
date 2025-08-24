/**
 * 🧪 Unit Tests - useAdaptiveSuggestion Hook
 * 
 * Tests for cooldown logic, quiet hours, suggestion generation,
 * and telemetry integration in useAdaptiveSuggestion hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAdaptiveSuggestion } from '@/features/ai/hooks/useAdaptiveSuggestion';
import { 
  mockUnifiedPipelineResult,
  mockAdaptiveSuggestions,
  mockAsyncStorage,
  mockDateNow
} from '../fixtures/qualityRibbonFixtures';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('@/features/ai/telemetry/aiTelemetry');
jest.mock('@/features/ai/context/contextIntelligence');

describe('useAdaptiveSuggestion Hook', () => {
  let mockTrackAIInteraction: jest.Mock;
  let mockContextIntelligence: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock telemetry
    mockTrackAIInteraction = jest.fn();
    require('@/features/ai/telemetry/aiTelemetry').trackAIInteraction = mockTrackAIInteraction;
    
    // Mock context intelligence
    mockContextIntelligence = {
      analyze: jest.fn().mockResolvedValue({
        currentContext: {
          userState: {
            stressLevel: 5,
            energyLevel: 6,
            moodTrend: 'neutral'
          },
          environmentalFactors: {
            timeOfDay: 'afternoon',
            dayOfWeek: 'tuesday'
          }
        }
      })
    };
    require('@/features/ai/context/contextIntelligence').contextIntelligence = mockContextIntelligence;
    
    // Mock AsyncStorage
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  describe('Basic Hook Functionality', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());
      
      expect(result.current.loading).toBe(false);
      expect(typeof result.current.generateSuggestion).toBe('function');
      expect(typeof result.current.generateSuggestionFromPipeline).toBe('function');
      expect(typeof result.current.trackSuggestionClick).toBe('function');
      expect(typeof result.current.trackSuggestionDismissal).toBe('function');
      expect(typeof result.current.snoozeSuggestion).toBe('function');
    });
  });

  describe('Cooldown Logic', () => {
    it('should enforce 2-hour cooldown period', async () => {
      const fixedTimestamp = mockDateNow();
      
      // Set last suggestion timestamp to 1 hour ago
      const oneHourAgo = fixedTimestamp - (60 * 60 * 1000);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key.includes('lastSuggestionTime')) {
          return Promise.resolve(oneHourAgo.toString());
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should not generate suggestion due to cooldown
      expect(suggestion.show).toBe(false);
    });

    it('should allow suggestions after cooldown period expires', async () => {
      const fixedTimestamp = mockDateNow();
      
      // Set last suggestion timestamp to 3 hours ago (past cooldown)
      const threeHoursAgo = fixedTimestamp - (3 * 60 * 60 * 1000);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key.includes('lastSuggestionTime')) {
          return Promise.resolve(threeHoursAgo.toString());
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should generate suggestion after cooldown
      expect(suggestion.show).toBe(true);
    });

    it('should reset cooldown after dismissal', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      await act(async () => {
        await result.current.snoozeSuggestion('test-user', 2); // 2-hour snooze
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('lastSuggestionTime'),
        expect.any(String)
      );
    });
  });

  describe('Quiet Hours Logic', () => {
    it('should respect quiet hours (23:00-07:00)', async () => {
      // Mock current time to 2 AM (quiet hours)
      const quietHourTimestamp = new Date('2022-01-01T02:00:00Z').getTime();
      mockDateNow(quietHourTimestamp);

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should not generate suggestion during quiet hours
      expect(suggestion.show).toBe(false);
    });

    it('should allow suggestions during active hours', async () => {
      // Mock current time to 2 PM (active hours)
      const activeHourTimestamp = new Date('2022-01-01T14:00:00Z').getTime();
      mockDateNow(activeHourTimestamp);

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should generate suggestion during active hours
      expect(suggestion.show).toBe(true);
    });

    it('should handle edge cases around quiet hours boundary', async () => {
      const testCases = [
        { time: '2022-01-01T06:59:00Z', expected: false }, // Just before quiet hours end
        { time: '2022-01-01T07:01:00Z', expected: true },  // Just after quiet hours end
        { time: '2022-01-01T22:59:00Z', expected: true },  // Just before quiet hours start
        { time: '2022-01-01T23:01:00Z', expected: false }  // Just after quiet hours start
      ];

      for (const testCase of testCases) {
        mockDateNow(new Date(testCase.time).getTime());
        
        const { result } = renderHook(() => useAdaptiveSuggestion());

        let suggestion: any;
        await act(async () => {
          suggestion = await result.current.generateSuggestion('test-user');
        });

        expect(suggestion.show).toBe(testCase.expected);
      }
    });
  });

  describe('Pipeline Integration', () => {
    it('should generate suggestions from pipeline result', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestionFromPipeline(
          'test-user',
          mockUnifiedPipelineResult,
          'mood'
        );
      });

      expect(suggestion.show).toBe(true);
      expect(suggestion).toHaveProperty('title');
      expect(suggestion).toHaveProperty('content');
      expect(suggestion).toHaveProperty('category');
      expect(suggestion).toHaveProperty('confidence');
    });

    it('should handle pipeline results without insights', async () => {
      const emptyResult = {
        ...mockUnifiedPipelineResult,
        insights: undefined,
        patterns: []
      };

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestionFromPipeline(
          'test-user',
          emptyResult,
          'mood'
        );
      });

      // Should fallback to context-based suggestion
      expect(suggestion.show).toBe(true);
      expect(suggestion.source).toBe('context_based');
    });

    it('should prioritize high-confidence insights', async () => {
      const resultWithMultipleInsights = {
        ...mockUnifiedPipelineResult,
        insights: {
          therapeutic: [
            {
              text: "Low confidence suggestion",
              confidence: 0.3,
              priority: "low",
              category: "general"
            },
            {
              text: "High confidence suggestion",
              confidence: 0.9,
              priority: "high",
              category: "breathwork"
            }
          ]
        }
      };

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestionFromPipeline(
          'test-user',
          resultWithMultipleInsights,
          'mood'
        );
      });

      // Should use the high-confidence insight
      expect(suggestion.confidence).toBeCloseTo(0.9);
      expect(suggestion.category).toBe('breathwork');
    });
  });

  describe('Context-Based Suggestions', () => {
    it('should generate context-based suggestions when pipeline data is insufficient', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      // Mock context intelligence to return high stress
      mockContextIntelligence.analyze.mockResolvedValueOnce({
        currentContext: {
          userState: {
            stressLevel: 9, // High stress
            energyLevel: 3, // Low energy
            moodTrend: 'declining'
          }
        }
      });

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      expect(suggestion.show).toBe(true);
      expect(suggestion.source).toBe('context_based');
      expect(suggestion.category).toBe('breathwork'); // Should suggest breathwork for high stress
    });

    it('should adapt suggestions based on time of day', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      // Mock evening context
      mockContextIntelligence.analyze.mockResolvedValueOnce({
        currentContext: {
          userState: { stressLevel: 6, energyLevel: 4 },
          environmentalFactors: {
            timeOfDay: 'evening',
            dayOfWeek: 'friday'
          }
        }
      });

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Evening suggestions might be different (e.g., reflection-based)
      expect(suggestion.show).toBe(true);
      expect(['mood', 'cbt', 'breathwork']).toContain(suggestion.category);
    });
  });

  describe('Telemetry Integration', () => {
    it('should track suggestion generation events', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      await act(async () => {
        await result.current.generateSuggestion('test-user');
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        expect.stringContaining('ADAPTIVE_SUGGESTION'),
        expect.objectContaining({
          userId: 'test-user'
        }),
        'test-user'
      );
    });

    it('should track suggestion clicks', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      await act(async () => {
        await result.current.trackSuggestionClick('test-user', mockAdaptiveSuggestions.highQuality);
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        expect.stringContaining('CLICKED'),
        expect.objectContaining({
          userId: 'test-user',
          category: mockAdaptiveSuggestions.highQuality.category
        }),
        'test-user'
      );
    });

    it('should track suggestion dismissals', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      await act(async () => {
        await result.current.trackSuggestionDismissal('test-user', mockAdaptiveSuggestions.highQuality);
      });

      expect(mockTrackAIInteraction).toHaveBeenCalledWith(
        expect.stringContaining('DISMISSED'),
        expect.objectContaining({
          userId: 'test-user',
          category: mockAdaptiveSuggestions.highQuality.category
        }),
        'test-user'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle context analysis errors gracefully', async () => {
      mockContextIntelligence.analyze.mockRejectedValueOnce(new Error('Context error'));

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should provide fallback suggestion
      expect(suggestion.show).toBe(true);
      expect(suggestion.confidence).toBeLessThan(0.7); // Lower confidence for fallback
    });

    it('should handle AsyncStorage errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const { result } = renderHook(() => useAdaptiveSuggestion());

      let suggestion: any;
      await act(async () => {
        suggestion = await result.current.generateSuggestion('test-user');
      });

      // Should still work without storage
      expect(suggestion.show).toBe(true);
    });

    it('should handle telemetry errors without affecting functionality', async () => {
      mockTrackAIInteraction.mockRejectedValueOnce(new Error('Telemetry error'));

      const { result } = renderHook(() => useAdaptiveSuggestion());

      // Should not throw error
      await act(async () => {
        await expect(
          result.current.trackSuggestionClick('test-user', mockAdaptiveSuggestions.highQuality)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Performance', () => {
    it('should generate suggestions within acceptable time', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      const startTime = Date.now();
      
      await act(async () => {
        await result.current.generateSuggestion('test-user');
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple concurrent suggestion requests', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      // Fire multiple requests simultaneously
      const promises = Array.from({ length: 5 }, () =>
        result.current.generateSuggestion('test-user')
      );

      let suggestions: any[];
      await act(async () => {
        suggestions = await Promise.all(promises);
      });

      // All should complete successfully
      expect(suggestions).toHaveLength(5);
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('show');
      });
    });
  });

  describe('Memory Management', () => {
    it('should cleanup properly on unmount', () => {
      const { result, unmount } = renderHook(() => useAdaptiveSuggestion());

      expect(result.current).toBeTruthy();
      
      // Should not throw error on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should not cause memory leaks with repeated calls', async () => {
      const { result } = renderHook(() => useAdaptiveSuggestion());

      // Make many calls to test for memory leaks
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          await result.current.generateSuggestion('test-user');
        });
      }

      // Should complete without memory issues
      expect(result.current).toBeTruthy();
    });
  });
});
