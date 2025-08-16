import React from 'react';
import renderer, { act } from 'react-test-renderer';
import OfflineBanner from '@/components/ui/OfflineBanner';

// Using global setup mock from jest.setup.js. No per-file NetInfo mock to avoid divergence.

describe('OfflineBanner', () => {
  it('renders when offline', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<OfflineBanner />).toJSON();
    });
    expect(tree).not.toBeNull();
  });
});


