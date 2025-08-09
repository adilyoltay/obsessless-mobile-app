import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseService, UserProfile, SignUpResult, AuthResult } from '@/services/supabase';
import { useGamificationStore } from '@/store/gamificationStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { migrateToUserSpecificStorage } from '@/utils/storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// ===========================
// CONTEXT TYPE DEFINITION
// ===========================

export interface AuthContextType {
  // State
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Email Auth
  signUpWithEmail: (email: string, password: string, name: string) => Promise<SignUpResult>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  
  // Google Auth  
  signInWithGoogle: () => Promise<any>;
  
  // Common Auth
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  
  // Utility
  clearError: () => void;
  
  // AI Enhancement Methods
  getAIEnhancedProfile: () => Promise<UserProfile & { aiMetadata?: any } | null>;
  updateAIPreferences: (preferences: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================
// AUTH PROVIDER COMPONENT
// ===========================

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { initializeGamification, setUserId } = useGamificationStore();
  const { resetOnboarding } = useOnboardingStore();

  // ===========================
  // INITIALIZATION
  // ===========================

  useEffect(() => {
    console.log('🚀 SupabaseAuthProvider initialized');
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      
      // Get current session
      const currentUser = await supabaseService.initialize();
      
      if (currentUser) {
        setUser(currentUser);
        await loadUserProfile(currentUser);
      }
      
      // Setup URL scheme listener for OAuth callbacks
      const handleUrl = async (url: string) => {
        console.log('🔗 Received URL:', url);
        
        // Handle both custom scheme and Expo Go deep links
        const callbackPath = 'auth/callback';
        const isCallback = url.includes(callbackPath);
        if (isCallback) {
          try {
            console.log('🔐 Processing OAuth callback...');
            const callbackUrl = new URL(url.replace('#', '?'));
            const accessToken = callbackUrl.searchParams.get('access_token');
            const refreshToken = callbackUrl.searchParams.get('refresh_token');
            
            if (accessToken && refreshToken) {
              await supabaseService.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              await WebBrowser.dismissBrowser();
            }
            
          } catch (error) {
            console.error('❌ OAuth callback processing failed:', error);
          }
        } else {
          console.log('🔗 Non-OAuth URL received:', url);
        }
      };

      // Listen for URL changes
      const subscription = Linking.addEventListener('url', ({ url }) => {
        handleUrl(url);
      });

      // Check if app was opened with a URL
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleUrl(initialUrl);
      }
      
      // Setup auth state listener
      const { data: authListener } = supabaseService.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth event:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setUserId('');
          console.log('🔐 User signed out, state cleared');
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          // Profile should already be loaded, no need to reload
        }
        
        setLoading(false);
      });
      
      setLoading(false);
      
      // Cleanup listener on unmount
      return () => {
        subscription?.remove?.();
        authListener?.subscription?.unsubscribe?.();
      };
      
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      setError('Kimlik doğrulama başlatılamadı');
      setLoading(false);
    }
  };

  // ===========================
  // PROFILE LOADING
  // ===========================
  
  const loadUserProfile = useCallback(async (user: User) => {
    try {
      console.log('👤 Loading user profile for:', user.email);
      
      // Set user ID for all stores
      setUserId(user.id);
      
      // Initialize user-specific data migration
      await migrateToUserSpecificStorage(user.id);
      
      // Initialize gamification for this user
      await initializeGamification(user.id);
      
      // Check if onboarding profile exists in user_profiles table
      let userProfile = await supabaseService.getUserProfile(user.id);
      
      if (!userProfile) {
        console.log('📝 No onboarding profile found - user needs to complete onboarding');
      } else {
        console.log('✅ User profile loaded:', user.email);
      }
      
      // Initialize gamification profile (create if doesn't exist)
      const gamificationProfile = await supabaseService.createGamificationProfile(user.id);
      if (gamificationProfile) {
        console.log('✅ Gamification profile initialized successfully! 🎮');
      } else {
        console.warn('⚠️ Gamification profile initialization failed, but app can continue');
      }
      
      // Profile will be set properly during onboarding completion
      setProfile(null);
    } catch (error) {
      console.error('❌ Load user profile failed:', error);
      setProfile(null);
    }
  }, [setUserId, initializeGamification]);

  // ===========================
  // AUTH METHODS
  // ===========================

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string): Promise<SignUpResult> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📧 Starting email signup...');
      const result = await supabaseService.signUpWithEmail(email, password, name);
      
      if (result.needsConfirmation) {
        setError('Kayıt başarılı! Email adresinizi kontrol edin ve doğrulama linkine tıklayın.');
        console.log('📧 Email confirmation required');
      } else {
        console.log('✅ Immediate signup success, auth state will update');
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Email signup failed:', error);
      setError(error.message || 'Kayıt başarısız');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Starting email login...');
      await supabaseService.signInWithEmail(email, password);
      
      // Auth state change will handle the rest
      console.log('✅ Email login initiated, waiting for auth state');
      
    } catch (error: any) {
      console.error('❌ Email login failed:', error);
      
      // Handle specific error messages
      if (error.message?.includes('Email not confirmed')) {
        setError('Email adresinizi doğrulamanız gerekiyor. Email kutunuzu kontrol edin.');
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Email veya şifre hatalı');
      } else {
        setError(error.message || 'Giriş başarısız');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<any> => {
    try {
      // setLoading(true); // RE-RENDER SORUNU
      setError(null);
      
      console.log('🔐 Starting Google OAuth...');
      const result = await supabaseService.signInWithGoogle();
      
      console.log('🔐 Google OAuth data ready for WebView');
      return result; // Return the OAuth data with URL
      
    } catch (error: any) {
      console.error('❌ Google OAuth failed:', error);
      setError(error.message || 'Google ile giriş başarısız');
      throw error;
    } finally {
      // setLoading(false); // RE-RENDER SORUNU
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('🔐 Signing out...');
      
      // Reset onboarding state before signout
      resetOnboarding();
      console.log('🔄 Onboarding state reset on signout');
      
      await supabaseService.signOut();
      
      // Auth state change will handle cleanup
      console.log('✅ Sign out initiated');
      
    } catch (error: any) {
      console.error('❌ Sign out failed:', error);
      setError(error.message || 'Çıkış başarısız');
    } finally {
      setLoading(false);
    }
  }, [resetOnboarding]);

  const resendConfirmation = useCallback(async (email: string): Promise<void> => {
    try {
      await supabaseService.resendEmailConfirmation(email);
      setError('Doğrulama emaili tekrar gönderildi. Email kutunuzu kontrol edin.');
    } catch (error: any) {
      console.error('❌ Resend confirmation failed:', error);
      setError(error.message || 'Email gönderimi başarısız');
    }
  }, []);

  // ===========================
  // UTILITY METHODS
  // ===========================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ===========================
  // AI ENHANCEMENT METHODS
  // ===========================

  const getAIEnhancedProfile = useCallback(async (): Promise<UserProfile & { aiMetadata?: any } | null> => {
    if (!profile) return null;

    try {
      // Combine user profile with AI metadata from AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const aiMetadata = await AsyncStorage.getItem(`ai_user_metadata_${user?.id}`);
      
      return {
        ...profile,
        aiMetadata: aiMetadata ? JSON.parse(aiMetadata) : null
      };
    } catch (error) {
      console.error('❌ Failed to get AI enhanced profile:', error);
      return profile;
    }
  }, [profile, user?.id]);

  const updateAIPreferences = useCallback(async (preferences: any): Promise<void> => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Store AI preferences in AsyncStorage for now
      await AsyncStorage.setItem(
        `ai_preferences_${user.id}`, 
        JSON.stringify({
          ...preferences,
          updatedAt: new Date().toISOString()
        })
      );

      console.log('✅ AI preferences updated successfully');
    } catch (error) {
      console.error('❌ Failed to update AI preferences:', error);
      throw error;
    }
  }, [user?.id]);

  // ===========================
  // CONTEXT VALUE
  // ===========================

  const contextValue = useMemo(() => ({
    user,
    profile,
    // Authenticated sayılmak için sadece geçerli bir Supabase user yeterli
    isAuthenticated: !!user,
    isLoading: loading,
    error,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    resendConfirmation,
    clearError,
    getAIEnhancedProfile,
    updateAIPreferences,
  }), [
    user,
    profile,
    loading,
    error,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    resendConfirmation,
    clearError,
    getAIEnhancedProfile,
    updateAIPreferences,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ===========================
// HOOK
// ===========================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

// ===========================
// EXPORT
// ===========================

export { SupabaseAuthProvider as AuthProvider };
