import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

interface NavigationGuardProps {
  children: React.ReactNode;
}

// Cache for onboarding check results to prevent excessive remote calls
const onboardingCheckCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 seconds cache

/**
 * 🔄 Clear onboarding check cache for a specific user
 * Called when user's onboarding status changes (e.g., new user signup)
 */
export function clearOnboardingCache(userId: string): void {
  const keys = Array.from(onboardingCheckCache.keys()).filter(key => key.includes(userId));
  keys.forEach(key => onboardingCheckCache.delete(key));
  console.log(`🔄 Cleared onboarding cache for user ${userId}: ${keys.length} entries removed`);
}

/**
 * 🛡️ Robust Onboarding Completion Check (Cached)
 * 
 * Implements multi-layer validation with caching:
 * 1. Check cache first (prevent excessive calls)
 * 2. Local AsyncStorage cache (fast)
 * 3. Remote Supabase verification (authoritative, cached)
 * 4. Integrity validation and recovery
 */
async function checkOnboardingCompletion(userId: string, localKey: string): Promise<boolean> {
  try {
    // LAYER 0: Memory cache check (prevent excessive calls)
    const cacheKey = `${userId}_${localKey}`;
    const cached = onboardingCheckCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('🔍 Layer 0 - Cache hit:', { result: cached.result });
      return cached.result;
    }

    // LAYER 1: Local storage check (fast path)
    const localValue = await AsyncStorage.getItem(localKey);
    let localCompleted = localValue === 'true';
    
    console.log('🔍 Layer 1 - Local check:', { localKey, localValue, localCompleted });
    
    // Check generic fallback key if local is not completed
    if (!localCompleted) {
      const generic = await AsyncStorage.getItem('ai_onboarding_completed');
      if (generic === 'true') {
        console.log('🔄 Generic fallback key confirms completion');
        localCompleted = true;
        // Update specific key for future
        await AsyncStorage.setItem(localKey, 'true');
      }
    }
    
    // LAYER 2: Remote verification (only when needed)  
    let remoteCompleted = false;
    let remoteCheckFailed = false;
    
    // EARLY RETURN: If local is definitively true and we're not forcing remote check
    if (localCompleted && !remoteCheckFailed) {
      // Cache the positive result
      onboardingCheckCache.set(cacheKey, { result: true, timestamp: Date.now() });
      console.log('✅ Early return - Local completed, cached');
      return true;
    }
    
    // Only do remote check if local is false or we need verification
    if (!localCompleted || (!cached && Math.random() < 0.1)) { // 10% chance for periodic verification
      try {
        // Check if user has a profile in Supabase (indicates completed onboarding)
        const { data: profile, error } = await supabaseService.supabaseClient
          .from('ai_profiles')
          .select('user_id, created_at, profile_data')
          .eq('user_id', userId)
          .single();
          
        if (!error && profile) {
          // Profile exists - onboarding was completed
          remoteCompleted = true;
          console.log('✅ Layer 2 - Remote verification: Profile found, onboarding completed');
          
          // Also check for onboarding metadata
          if (profile.profile_data?.onboarding_completed) {
            console.log('✅ Explicit onboarding completion flag found in profile');
          }
        } else {
          console.log('⚠️ Layer 2 - Remote verification: No profile found');
        }
      } catch (remoteError) {
        console.warn('⚠️ Layer 2 - Remote verification failed (network/auth issue):', remoteError);
        remoteCheckFailed = true;
      }
    } else {
      console.log('⚡ Skipping remote check - local completed and cached recently');
      remoteCompleted = localCompleted;
    }

    // Final decision: prioritize remote when available, fallback to local
    const finalDecision = remoteCheckFailed ? localCompleted : (remoteCompleted || localCompleted);
    
    // Update cache with result
    onboardingCheckCache.set(cacheKey, { result: finalDecision, timestamp: Date.now() });
    
    console.log('🎯 Final onboarding decision:', {
      localCompleted,
      remoteCompleted,
      remoteCheckFailed,
      finalDecision,
      cached: true
    });
    
    return finalDecision;
    
  } catch (error) {
    console.error('❌ Onboarding check failed completely:', error);
    
    // Last resort: check generic key and cache negative result briefly
    try {
      const generic = await AsyncStorage.getItem('ai_onboarding_completed');
      const fallback = generic === 'true';
      console.log('🆘 Last resort fallback:', { generic, fallback });
      
      // Cache negative results for a shorter period to avoid infinite checks
      onboardingCheckCache.set(cacheKey, { result: fallback, timestamp: Date.now() });
      
      return fallback;
    } catch (fallbackError) {
      console.error('❌ Even fallback check failed:', fallbackError);
      // Cache false result briefly to prevent rapid retries
      onboardingCheckCache.set(cacheKey, { result: false, timestamp: Date.now() });
      return false; // Fail safe - require onboarding
    }
  }
}

export function NavigationGuard({ children }: NavigationGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [navigationCompleted, setNavigationCompleted] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Reset navigation when user changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    if (lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;
      setNavigationCompleted(false);
      console.log('🔄 User changed, reset navigation flag:', currentUserId);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) {
      console.log('⏳ Auth loading, waiting...');
      return;
    }

    // Skip if navigation already completed for stability
    if (navigationCompleted) {
      console.log('✅ Navigation already completed, skipping checks');
      setIsChecking(false);
      return;
    }

    const performNavigation = async () => {
      const currentPath = segments.join('/');
      const inTabsGroup = segments[0] === '(tabs)';
      const inAuthGroup = segments[0] === '(auth)';
      const inOnboardingRoute = inAuthGroup && (segments[1] === 'onboarding' || currentPath.includes('onboarding'));

      console.log('🔍 NavigationGuard - Simple check:', {
        currentPath,
        inTabsGroup,
        inAuthGroup,
        inOnboardingRoute,
        hasUser: !!user,
        userId: user?.id
      });

      if (!router || typeof router.replace !== 'function') {
        console.log('⚠️ Router not ready');
        setIsChecking(false);
        return;
      }

      try {
        // No user → Login
        if (!user) {
          if (!inAuthGroup) {
            console.log('🚀 No user, redirect to login');
            router.replace('/(auth)/login');
            setNavigationCompleted(true);
          } else {
            console.log('✅ No user, already in auth group');
            setNavigationCompleted(true);
          }
          return;
        }

        // User exists → Check onboarding
        console.log('👤 User exists, checking onboarding status...');
        
        // Simple onboarding check - local first, fast
        const aiKey = `ai_onboarding_completed_${user.id}`;
        const localCompleted = await AsyncStorage.getItem(aiKey);
        const isOnboardingCompleted = localCompleted === 'true';

        console.log('🔍 Simple onboarding check:', {
          userId: user.id,
          aiKey,
          localCompleted,
          isOnboardingCompleted
        });

        if (!isOnboardingCompleted) {
          // Need onboarding
          if (!inOnboardingRoute) {
            console.log('🚀 Onboarding needed, redirect to onboarding');
            router.replace('/(auth)/onboarding');
            setNavigationCompleted(true);
          } else {
            console.log('✅ Already in onboarding route');
            setNavigationCompleted(true);
          }
        } else {
          // Onboarding completed
          if (inAuthGroup) {
            console.log('🚀 Onboarding complete, redirect to tabs');
            router.replace('/(tabs)');
            setNavigationCompleted(true);
          } else if (inTabsGroup) {
            console.log('✅ Already in tabs, navigation complete');
            setNavigationCompleted(true);
          } else {
            console.log('🚀 Unknown route, redirect to tabs');
            router.replace('/(tabs)');
            setNavigationCompleted(true);
          }
        }
      } catch (error) {
        console.error('❌ Navigation error:', error);
        // Fallback - go to login
        router.replace('/(auth)/login');
        setNavigationCompleted(true);
      } finally {
        setIsChecking(false);
      }
    };

    // Small delay to let routes settle
    const timer = setTimeout(performNavigation, 100);
    return () => clearTimeout(timer);
  }, [user?.id, authLoading, segments, navigationCompleted, router]);

  if (authLoading || isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <>{children}</>;
}