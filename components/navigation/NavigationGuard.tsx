import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import supabaseService from '@/services/supabase';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

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
    if (authLoading) {
      console.log('🧭 Auth still loading, waiting...');
      return;
    }
    
    const checkNavigation = async () => {
      // Check if we should skip navigation
      const currentPath = segments.join('/');
      const inTabsGroup = segments[0] === '(tabs)';
      const inAuthGroup = segments[0] === '(auth)';
      
      // If already in tabs group, don't navigate again
      if (hasNavigatedRef.current && inTabsGroup) {
        console.log('🧭 Already in correct group, skipping navigation...');
        return;
      }
      
      // Wait for router to be ready
      if (!router || typeof router.replace !== 'function') {
        console.log('🧭 Router not ready yet, waiting...');
        setIsChecking(false);
        return;
      }

      try {
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
            setTimeout(() => {
              try {
                hasNavigatedRef.current = true;
                router.push('/(auth)/login');
              } catch (error) {
                console.error('Login navigation error:', error);
                hasNavigatedRef.current = true;
                router.push('/login');
              }
            }, 100);
            return;
          }
        } else {
          // User is authenticated, check profile completion
          let isProfileComplete = false;
          let aiOnboardingCompleted = false;
          
          try {
            console.log('🧭 Checking profile completion for user:', user.id);
            
            // First, check AsyncStorage for faster response (offline-first)
            const profileCompleted = await AsyncStorage.getItem('profileCompleted');
            const localProfile = await AsyncStorage.getItem(`ocd_profile_${user.id}`);
            
            console.log('🧭 AsyncStorage check:', {
              profileCompleted,
              hasLocalProfile: !!localProfile
            });
            
            if (profileCompleted === 'true' && localProfile) {
              const parsedProfile = JSON.parse(localProfile);
              if (parsedProfile.onboardingCompleted) {
                isProfileComplete = true;
                console.log('✅ Profile completion confirmed from AsyncStorage');
              }
            }

            // AI Onboarding v2 status (Sprint 7)
            try {
              const aiOnboardingKey = `ai_onboarding_completed_${user.id || 'anon'}`;
              const aiOnboarding = await AsyncStorage.getItem(aiOnboardingKey);
              aiOnboardingCompleted = aiOnboarding === 'true';
              if (aiOnboardingCompleted) {
                isProfileComplete = true; // Treat AI onboarding completion as profile completion
              }
              console.log('🧭 AI Onboarding v2 status:', aiOnboardingCompleted);
            } catch (e) {
              console.warn('⚠️ AI onboarding status check failed');
            }

            // If not complete locally, check database for verification
            if (!isProfileComplete) {
              console.log('🧭 Checking database for profile completion...');
              try {
                const userProfile = await supabaseService.getUserProfile(user.id, { cacheMs: 120000 });
                console.log('🧭 Database profile result:', {
                  hasProfile: !!userProfile,
                  onboardingCompleted: userProfile?.onboarding_completed
                });
                
                isProfileComplete = !!(userProfile && userProfile.onboarding_completed);
                
                if (isProfileComplete) {
                  // Update AsyncStorage cache
                  await AsyncStorage.setItem('profileCompleted', 'true');
                  console.log('✅ Profile completion confirmed from database and cached');
                }
              } catch (dbError) {
                console.warn('⚠️ Database profile check failed, using AsyncStorage only:', dbError);
                // Continue with AsyncStorage result
              }
            }

            console.log('🧭 Final profile check result:', { isProfileComplete });
            
            // Onboarding her zaman kullanılabilir: AI flags sadece ek modülleri kontrol eder
            if (true) {
              if (!aiOnboardingCompleted) {
                if (currentPath !== '(auth)/onboarding') {
                  console.log('👤 Redirecting to AI Onboarding v2 - not completed');
                  console.log('🔄 Navigation details:', { currentPath, inAuthGroup, hasNavigated: hasNavigatedRef.current });

                  setTimeout(() => {
                    try {
                      console.log('🚀 Attempting navigation to AI onboarding...');
                      hasNavigatedRef.current = true;
                      router.push('/(auth)/onboarding');
                      console.log('✅ Navigation command sent successfully');
                    } catch (error) {
                      console.error('❌ AI Onboarding navigation error:', error);
                      console.log('🔄 Trying fallback navigation...');
                      hasNavigatedRef.current = true;
                      router.push('/(auth)/onboarding');
                    }
                  }, 200);
                  return;
                } else {
                  console.log('🧭 Already in AI onboarding, staying here');
                }
              } else {
                // AI onboarding completed: ensure we are in tabs
                if (inAuthGroup || currentPath === '+not-found' || currentPath === '' || currentPath === 'index') {
                  console.log('✅ Redirecting to main app - AI onboarding complete');
                  setTimeout(() => {
                    try {
                      hasNavigatedRef.current = true;
                      router.push('/(tabs)');
                    } catch (error) {
                      console.error('Navigation error, trying fallback:', error);
                      hasNavigatedRef.current = true;
                      router.push('/');
                    }
                  }, 100);
                  return;
                }
              }
            } else if (!isProfileComplete) {
              // Fallback: Classic onboarding
              if (currentPath !== '(auth)/onboarding') {
                console.log('👤 Redirecting to classic onboarding - profile incomplete');
                setTimeout(() => {
                  try {
                    hasNavigatedRef.current = true;
                    router.push('/(auth)/onboarding');
                  } catch (error) {
                    console.error('Onboarding navigation error:', error);
                    hasNavigatedRef.current = true;
                    router.push('/onboarding');
                  }
                }, 100);
                return;
              } else {
                console.log('🧭 Already in onboarding or auth group, staying here');
              }
            } else {
              // Profile completed - redirect to main app
              if (inAuthGroup || currentPath === '+not-found' || currentPath === '' || currentPath === 'index') {
                console.log('✅ Redirecting to main app - profile complete');
                setTimeout(() => {
                  try {
                    hasNavigatedRef.current = true;
                    router.push('/(tabs)');
                  } catch (error) {
                    console.error('Navigation error, trying fallback:', error);
                    hasNavigatedRef.current = true;
                    router.push('/');
                  }
                }, 100);
                return;
              } else {
                console.log('🧭 Already in tabs group, staying here');
              }
            }
          } catch (error) {
            console.error('❌ Profile check error:', error);
            // Fallback to onboarding on error
            if (currentPath !== '(auth)/onboarding' && !inAuthGroup) {
              console.log('👤 Redirecting to onboarding - profile check failed');
              setTimeout(() => {
                hasNavigatedRef.current = true;
                router.replace('/(auth)/onboarding');
              }, 100);
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