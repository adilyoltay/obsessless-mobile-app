import React from 'react';
import renderer from 'react-test-renderer';
import SafeModeBanner from '@/components/ui/SafeModeBanner';

jest.mock('@/contexts/AIContext', () => {
  const actual = jest.requireActual('@/contexts/AIContext');
  return {
    ...actual,
    useAIStatus: () => ({ isInitialized: false, initializationError: 'x', availableFeatures: [] }),
    useAI: () => ({ safeMode: true })
  };
});

describe('SafeModeBanner', () => {
  it('renders when safeMode or init error', async () => {
    const tree = renderer.create(<SafeModeBanner />).toJSON();
    expect(tree).toBeTruthy();
  });
});


