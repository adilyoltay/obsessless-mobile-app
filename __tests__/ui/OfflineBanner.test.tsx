import React from 'react';
import renderer from 'react-test-renderer';
import OfflineBanner from '@/components/ui/OfflineBanner';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: (cb: any) => ({ remove: () => {} }),
  fetch: async () => ({ isConnected: false, isInternetReachable: false }),
}));

describe('OfflineBanner', () => {
  it('renders when offline', async () => {
    const tree = renderer.create(<OfflineBanner />).toJSON();
    expect(tree).toBeTruthy();
  });
});


