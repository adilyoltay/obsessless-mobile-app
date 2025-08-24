/**
 * 🧪 Quality Ribbon Integration Tests
 * Test rehberindeki Quality Ribbon senaryolarını kapsayan testler
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QualityRibbon } from '../../components/ui/QualityRibbon';
import { AdaptiveSuggestionCard } from '../../components/adaptive/AdaptiveSuggestionCard';
import { UnifiedAIPipeline } from '../../services/ai/UnifiedAIPipeline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock UnifiedAIPipeline
jest.mock('../../services/ai/UnifiedAIPipeline');

// Test için QueryClient
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('QualityRibbon Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Badge Rendering', () => {
    it('should display [Fresh][High] for new high-quality analysis', async () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'high',
        sampleSize: 15,
        freshnessMs: 500, // 0.5 saniye önce
        timestamp: Date.now()
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      // Badge'leri kontrol et
      expect(getByText('Fresh')).toBeTruthy();
      expect(getByText('High')).toBeTruthy();
      expect(getByText('n=15')).toBeTruthy();
      expect(getByText('< 1m')).toBeTruthy(); // 1 dakikadan az
    });
    
    it('should display [Cache][Med] for cached medium quality', async () => {
      const metadata = {
        source: 'cache',
        qualityLevel: 'medium',
        sampleSize: 5,
        freshnessMs: 120000, // 2 dakika önce
        timestamp: Date.now() - 120000
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByText('Cache')).toBeTruthy();
      expect(getByText('Med')).toBeTruthy();
      expect(getByText('n=5')).toBeTruthy();
      expect(getByText('2m')).toBeTruthy();
    });
    
    it('should display [Fast][Low] for heuristic fallback', async () => {
      const metadata = {
        source: 'heuristic',
        qualityLevel: 'low',
        sampleSize: 2,
        freshnessMs: 0,
        timestamp: Date.now()
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByText('Fast')).toBeTruthy();
      expect(getByText('Low')).toBeTruthy();
      expect(getByText('n=2')).toBeTruthy();
    });
  });
  
  describe('Color Coding', () => {
    it('should use green for high quality', () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'high',
        sampleSize: 10,
        freshnessMs: 1000,
        timestamp: Date.now()
      };
      
      const { getByTestId } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} testID="quality-ribbon" />
        </TestWrapper>
      );
      
      const qualityBadge = getByTestId('quality-badge-high');
      const style = qualityBadge.props.style;
      
      // Yeşil renk kontrolü
      expect(style).toMatchObject(
        expect.objectContaining({
          backgroundColor: expect.stringMatching(/#4CAF50|green/i)
        })
      );
    });
    
    it('should use yellow for medium quality', () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'medium',
        sampleSize: 5,
        freshnessMs: 1000,
        timestamp: Date.now()
      };
      
      const { getByTestId } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} testID="quality-ribbon" />
        </TestWrapper>
      );
      
      const qualityBadge = getByTestId('quality-badge-medium');
      const style = qualityBadge.props.style;
      
      // Sarı renk kontrolü
      expect(style).toMatchObject(
        expect.objectContaining({
          backgroundColor: expect.stringMatching(/#FFC107|yellow/i)
        })
      );
    });
    
    it('should use gray for low quality', () => {
      const metadata = {
        source: 'heuristic',
        qualityLevel: 'low',
        sampleSize: 1,
        freshnessMs: 0,
        timestamp: Date.now()
      };
      
      const { getByTestId } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} testID="quality-ribbon" />
        </TestWrapper>
      );
      
      const qualityBadge = getByTestId('quality-badge-low');
      const style = qualityBadge.props.style;
      
      // Gri renk kontrolü
      expect(style).toMatchObject(
        expect.objectContaining({
          backgroundColor: expect.stringMatching(/#9E9E9E|gray/i)
        })
      );
    });
  });
  
  describe('Freshness Display', () => {
    it('should show "< 1m" for very fresh data', () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'high',
        sampleSize: 10,
        freshnessMs: 30000, // 30 saniye
        timestamp: Date.now()
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByText('< 1m')).toBeTruthy();
    });
    
    it('should show minutes for data < 1 hour old', () => {
      const metadata = {
        source: 'cache',
        qualityLevel: 'medium',
        sampleSize: 5,
        freshnessMs: 900000, // 15 dakika
        timestamp: Date.now() - 900000
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByText('15m')).toBeTruthy();
    });
    
    it('should show hours for older data', () => {
      const metadata = {
        source: 'cache',
        qualityLevel: 'low',
        sampleSize: 3,
        freshnessMs: 7200000, // 2 saat
        timestamp: Date.now() - 7200000
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByText('2h')).toBeTruthy();
    });
  });
  
  describe('Integration with AdaptiveSuggestionCard', () => {
    it('should display quality ribbon on suggestion card', async () => {
      // Mock UnifiedAIPipeline response
      const mockPipeline = new UnifiedAIPipeline();
      (mockPipeline.process as jest.Mock).mockResolvedValue({
        success: true,
        result: {
          adaptiveSuggestion: {
            type: 'breathing',
            title: 'Nefes Egzersizi Zamanı',
            description: 'Kaygı seviyeniz yüksek görünüyor',
            action: { label: 'Şimdi Dene', route: '/breathwork' }
          }
        },
        metadata: {
          source: 'unified',
          qualityLevel: 'high',
          sampleSize: 12,
          freshnessMs: 1000,
          timestamp: Date.now()
        }
      });
      
      const { getByText, getByTestId } = render(
        <TestWrapper>
          <AdaptiveSuggestionCard
            userId="test-user"
            source="mood"
          />
        </TestWrapper>
      );
      
      // Suggestion yüklenmesini bekle
      await waitFor(() => {
        expect(getByText('Nefes Egzersizi Zamanı')).toBeTruthy();
      });
      
      // Quality ribbon'ın görünür olduğunu kontrol et
      expect(getByText('Fresh')).toBeTruthy();
      expect(getByText('High')).toBeTruthy();
      expect(getByText('n=12')).toBeTruthy();
    });
    
    it('should update quality when data changes', async () => {
      const mockPipeline = new UnifiedAIPipeline();
      
      // İlk response - Low quality
      (mockPipeline.process as jest.Mock).mockResolvedValueOnce({
        success: true,
        result: {
          adaptiveSuggestion: {
            type: 'mood',
            title: 'Duygu Takibi',
            description: 'Bugünkü duygunuzu kaydedin'
          }
        },
        metadata: {
          source: 'heuristic',
          qualityLevel: 'low',
          sampleSize: 2,
          freshnessMs: 0,
          timestamp: Date.now()
        }
      });
      
      const { getByText, rerender } = render(
        <TestWrapper>
          <AdaptiveSuggestionCard userId="test-user" source="today" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(getByText('Fast')).toBeTruthy();
        expect(getByText('Low')).toBeTruthy();
      });
      
      // İkinci response - High quality
      (mockPipeline.process as jest.Mock).mockResolvedValueOnce({
        success: true,
        result: {
          adaptiveSuggestion: {
            type: 'mood',
            title: 'Duygu Takibi',
            description: 'Duygu pattern'iniz iyileşiyor!'
          }
        },
        metadata: {
          source: 'unified',
          qualityLevel: 'high',
          sampleSize: 15,
          freshnessMs: 500,
          timestamp: Date.now()
        }
      });
      
      // Component'i yeniden render et
      rerender(
        <TestWrapper>
          <AdaptiveSuggestionCard userId="test-user" source="today" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(getByText('Fresh')).toBeTruthy();
        expect(getByText('High')).toBeTruthy();
        expect(getByText('n=15')).toBeTruthy();
      });
    });
  });
  
  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'high',
        sampleSize: 10,
        freshnessMs: 60000,
        timestamp: Date.now()
      };
      
      const { getByLabelText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      expect(getByLabelText('AI analiz kalitesi: Yüksek')).toBeTruthy();
      expect(getByLabelText('Veri sayısı: 10')).toBeTruthy();
      expect(getByLabelText('Güncelleme zamanı: 1 dakika önce')).toBeTruthy();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle missing metadata gracefully', () => {
      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={null} />
        </TestWrapper>
      );
      
      // Hiçbir badge görünmemeli
      expect(queryByText('Fresh')).toBeNull();
      expect(queryByText('High')).toBeNull();
    });
    
    it('should handle very large sample sizes', () => {
      const metadata = {
        source: 'unified',
        qualityLevel: 'high',
        sampleSize: 9999,
        freshnessMs: 1000,
        timestamp: Date.now()
      };
      
      const { getByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      // 999+ olarak gösterilmeli
      expect(getByText('n=999+')).toBeTruthy();
    });
    
    it('should handle zero sample size', () => {
      const metadata = {
        source: 'heuristic',
        qualityLevel: 'low',
        sampleSize: 0,
        freshnessMs: 0,
        timestamp: Date.now()
      };
      
      const { queryByText } = render(
        <TestWrapper>
          <QualityRibbon metadata={metadata} />
        </TestWrapper>
      );
      
      // Sample size badge gösterilmemeli
      expect(queryByText(/n=/)).toBeNull();
    });
  });
});