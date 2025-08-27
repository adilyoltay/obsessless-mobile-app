import React from 'react';
import Welcome from './welcome';

export default function OnboardingIndex() {
  // Don't redirect, just show welcome directly
  // This prevents navigation loops
  return <Welcome />;
}


