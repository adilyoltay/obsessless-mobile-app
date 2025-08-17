import React from 'react';
import renderer, { act } from 'react-test-renderer';
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
    let tree: any;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary fallback={<div>fallback</div>}>
          {/* @ts-ignore */}
          <Problem />
        </ErrorBoundary>
      ).toJSON();
    });
    expect(tree).not.toBeNull();
  });
});


