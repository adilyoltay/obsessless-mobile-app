import React from 'react';
import renderer from 'react-test-renderer';
import ErrorBoundary from '@/components/ErrorBoundary';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  }
}));

describe('ErrorBoundary', () => {
  const Problem = () => { throw new Error('boom'); };
  it('catches errors and renders fallback UI', () => {
    const tree = renderer.create(
      <ErrorBoundary>
        {/* @ts-ignore */}
        <Problem />
      </ErrorBoundary>
    ).toJSON();
    expect(tree).toBeTruthy();
  });
});


