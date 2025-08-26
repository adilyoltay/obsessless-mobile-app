
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router';
import { useCallback } from 'react';

// Ana navigation hook'u
export function useAppNavigation() {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();

  const navigateToAuth = useCallback((screen?: string) => {
    if (screen) {
      router.push(`/(auth)/${screen}` as any);
    } else {
      router.push('/(auth)/login');
    }
  }, [router]);

  const navigateToMain = useCallback((tab?: string) => {
    if (tab) {
      router.push(`/(tabs)/${tab}` as any);
    } else {
      router.push('/(tabs)');
    }
  }, [router]);

  const navigateToModal = useCallback((modalName: string, params?: Record<string, any>) => {
    const paramString = params ? `?${new URLSearchParams(params).toString()}` : '';
    router.push(`/${modalName}${paramString}` as any);
  }, [router]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)');
    }
  }, [router]);

  return {
    router,
    segments,
    params,
    navigateToAuth,
    navigateToMain,
    navigateToModal,
    goBack,
    currentScreen: segments[segments.length - 1] || 'index',
    isInAuthFlow: segments.includes('(auth)'),
    isInMainFlow: segments.includes('(tabs)'),
  };
}

// Tracking navigation hook'u
export function useTrackingNavigation() {
  const { router } = useAppNavigation();

  const navigateToCompulsionDetail = useCallback((id: string) => {
    router.push(`/tracking/compulsion-detail?id=${id}` as any);
  }, [router]);

  const navigateToAddCompulsion = useCallback(() => {
    router.push('/tracking/add-compulsion' as any);
  }, [router]);

  const navigateToCompulsionHistory = useCallback((compulsionId: string) => {
    router.push(`/tracking/compulsion-history?compulsionId=${compulsionId}` as any);
  }, [router]);

  return {
    navigateToCompulsionDetail,
    navigateToAddCompulsion,
    navigateToCompulsionHistory,
  };
}


// (Removed) ERP navigation hook

// Deep linking utilities
export function useDeepLinking() {
  const { router } = useAppNavigation();

  const handleDeepLink = useCallback((url: string) => {
    // obsessless://dashboard -> /(tabs)/
    // obsessless://tracking -> /(tabs)/breathwork (remapped)
    // obsessless://assessment -> /ybocs-assessment
    
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    switch (path) {
      case '/dashboard':
        router.push('/(tabs)/');
        break;
      case '/tracking':
        router.push('/(tabs)/breathwork');
        break;
      // case '/erp': // Removed ERP
      case '/settings':
        router.push('/(tabs)/settings');
        break;
      case '/assessment':
        router.push('/ybocs-assessment' as any);
        break;
      case '/achievements':
        router.push('/achievements' as any);
        break;
      default:
        router.push('/(tabs)/');
    }
  }, [router]);

  return { handleDeepLink };
}
