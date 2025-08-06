import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';

interface NavigationGuardProps {
  children: React.ReactNode;
}

export function NavigationGuard({ children }: NavigationGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading: authLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const hasNavigatedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset navigation flag when auth state changes
    const currentUserId = user?.id || null;
    if (lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;
      hasNavigatedRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    
    const checkNavigation = async () => {
      if (hasNavigatedRef.current) return;
      
      // Wait for router to be ready
      if (!router || typeof router.replace !== 'function') {
        console.log('🧭 Router not ready yet, waiting...');
        setIsChecking(false);
        return;
      }

      try {
        const currentPath = segments.join('/');
        const inAuthGroup = segments[0] === '(auth)';
        const inTabsGroup = segments[0] === '(tabs)';

        console.log('🧭 Navigation Guard Check:', {
          isAuthenticated: !!user,
          currentPath,
          inAuthGroup,
          inTabsGroup
        });

        if (!user) {
          // User not authenticated
          if (!inAuthGroup && currentPath !== '(auth)/login') {
            console.log('🔐 Redirecting to login - not authenticated');
            hasNavigatedRef.current = true;
            setTimeout(() => {
              try {
                router.push('/(auth)/login');
              } catch (error) {
                console.error('Login navigation error:', error);
                router.push('/login');
              }
            }, 100);
            return;
          }
        } else {
          // User is authenticated, check profile completion
          try {
            // Check database for onboarding completion
            const userProfile = await supabaseService.getUserProfile(user.id);
            const isProfileComplete = userProfile && userProfile.onboarding_completed;

            if (!isProfileComplete) {
              // Profile not completed - redirect to onboarding
              if (currentPath !== '(auth)/onboarding' && !inAuthGroup) {
                console.log('👤 Redirecting to onboarding - profile incomplete');
                hasNavigatedRef.current = true;
                setTimeout(() => {
                  try {
                    router.push('/(auth)/onboarding');
                  } catch (error) {
                    console.error('Onboarding navigation error:', error);
                    router.push('/onboarding');
                  }
                }, 100);
                return;
              }
            } else {
              // Profile completed - redirect to main app
              if (inAuthGroup || currentPath === '+not-found' || currentPath === '' || currentPath === 'index') {
                console.log('✅ Redirecting to main app - profile complete');
                hasNavigatedRef.current = true;
                // Use push instead of replace for better navigation
                setTimeout(() => {
                  try {
                    router.push('/(tabs)/index');
                  } catch (error) {
                    console.error('Navigation error, trying fallback:', error);
                    router.push('/');
                  }
                }, 100);
                return;
              }
            }
          } catch (error) {
            console.error('❌ Profile check error:', error);
            // Fallback to onboarding on error
            if (currentPath !== '(auth)/onboarding' && !inAuthGroup) {
              console.log('👤 Redirecting to onboarding - profile check failed');
              hasNavigatedRef.current = true;
              setTimeout(() => router.replace('/(auth)/onboarding'), 100);
              return;
            }
          }
        }
      } catch (error) {
        console.error('❌ Navigation check error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Only run once per auth state change with longer delay
    const timer = setTimeout(checkNavigation, 500);
    return () => clearTimeout(timer);
  }, [user, authLoading, segments.join('/')]);

  if (authLoading || isChecking) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#F9FAFB'
      }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <>{children}</>;
}