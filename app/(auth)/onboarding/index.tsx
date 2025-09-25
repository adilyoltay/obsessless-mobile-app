import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import Welcome from './welcome';
import { useMoodOnboardingStore } from '@/store/moodOnboardingStore';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const STEP_ROUTES: Record<number, string> = {
  1: '/(auth)/onboarding/motivation',
  2: '/(auth)/onboarding/first-mood',
  3: '/(auth)/onboarding/lifestyle',
  4: '/(auth)/onboarding/notifications',
  5: '/(auth)/onboarding/summary',
};

const SUMMARY_ROUTE = '/(auth)/onboarding/summary';
const STEP_ROUTE_KEYS = Object.keys(STEP_ROUTES).map((key) => Number(key)).filter((value) => Number.isFinite(value));
const MAX_ROUTE_STEP = STEP_ROUTE_KEYS.length ? Math.max(...STEP_ROUTE_KEYS) : 0;

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const step = useMoodOnboardingStore((state) => state.step);
  const isHydrated = useMoodOnboardingStore((state) => state.isHydrated);
  const isLoading = useMoodOnboardingStore((state) => state.isLoading);
  const hydrateFromStorage = useMoodOnboardingStore((state) => state.hydrateFromStorage);

  const hydrationStateRef = useRef<{ userKey: string | null; pending: boolean }>({
    userKey: null,
    pending: false,
  });

  useEffect(() => {
    if (isHydrated || isLoading) return;

    const userKey = user?.id ? String(user.id) : 'anonymous';
    const current = hydrationStateRef.current;
    if (current.pending && current.userKey === userKey) return;

    hydrationStateRef.current = { userKey, pending: true };
    Promise.resolve(hydrateFromStorage(user?.id)).finally(() => {
      hydrationStateRef.current = { userKey, pending: false };
    });
  }, [hydrateFromStorage, isHydrated, isLoading, user?.id]);

  const targetRoute = useMemo(() => {
    if (!isHydrated) return null;
    const numericStep = Number.isFinite(step) ? Math.floor(step) : 0;
    if (numericStep <= 0) return null;
    if (STEP_ROUTES[numericStep]) return STEP_ROUTES[numericStep];
    if (numericStep > 0 && MAX_ROUTE_STEP > 0) {
      return STEP_ROUTES[MAX_ROUTE_STEP] || SUMMARY_ROUTE;
    }
    return SUMMARY_ROUTE;
  }, [isHydrated, step]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!targetRoute) return;
    router.replace(targetRoute as any);
  }, [isHydrated, targetRoute, router]);


  if (!isHydrated) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (step > 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color="#10B981" />
      </View>
    );
  }

  return <Welcome />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
