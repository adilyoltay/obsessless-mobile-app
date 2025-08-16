import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CompulsionSummary } from '@/components/compulsions/CompulsionSummary';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
  }
}));

jest.mock('@/contexts/SupabaseAuthContext', () => {
  return {
    useAuth: () => ({ user: { id: 'u1' } })
  };
});

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'tr' })
}));

describe('CompulsionSummary', () => {
  it('renders empty state without data', async () => {
    let tree: any;
    await act(async () => {
      tree = renderer.create(<CompulsionSummary period="today" />).toJSON();
    });
    expect(tree).toBeTruthy();
  });
});


