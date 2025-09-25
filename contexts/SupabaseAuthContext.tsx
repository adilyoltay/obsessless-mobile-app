import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Session } from '@supabase/supabase-js';
import { supabaseService, UserProfile, SignUpResult, AuthResult } from '@/services/supabase';
import { registerAuthBridge } from '@/contexts/authBridge';
import { useGamificationStore } from '@/store/gamificationStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { migrateToUserSpecificStorage } from '@/utils/storage';
import SecureStorageMigration from '@/utils/secureStorageMigration';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { isValidEmail } from '@/utils/validators';

// Ensure pending auth sessions are completed (iOS 13+)
WebBrowser.maybeCompleteAuthSession();

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
  const lastProfileLoadRef = React.useRef<{ userId: string; ts: number } | null>(null);
  const isProfileLoadInFlightRef = React.useRef<boolean>(false);
  const oauthAppStateRef = React.useRef<string | null>(null);

  // ===========================
  // INITIALIZATION
  // ===========================

  useEffect(() => {
    let isMounted = true;
    console.log('🚀 SupabaseAuthProvider initialized');

    // Register bridge so other modules (e.g., onboarding) can update profile in AuthContext safely
    try {
      registerAuthBridge({
        setProfile: (p: UserProfile | null) => setProfile(p),
        getUserId: () => user?.id ?? null,
      });
    } catch (error) {
      console.warn('Auth bridge registration failed (non-critical):', error);
    }

    const handleUrl = async (url: string) => {
      try {
        if (!url) return;
        console.log('🔗 Received URL:', url);
        const callbackUrl = new URL(url.replace('#', '?'));
        const isCallback = callbackUrl.pathname?.includes('auth/callback') || url.includes('auth/callback');
        if (!isCallback) return;

        const errorParam = callbackUrl.searchParams.get('error');
        const errorDescription = callbackUrl.searchParams.get('error_description');
        const appState = callbackUrl.searchParams.get('app_state');
        const accessToken = callbackUrl.searchParams.get('access_token');
        const refreshToken = callbackUrl.searchParams.get('refresh_token');
        const authCode = callbackUrl.searchParams.get('code');

        // State validation
        const expected = oauthAppStateRef.current || null;
        if (expected && appState && expected !== appState) {
          console.warn('⚠️ OAuth state mismatch');
          setError('Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin.');
          await WebBrowser.dismissBrowser();
          return;
        }

        if (errorParam) {
          console.error('❌ OAuth error:', errorParam, errorDescription);
          setError('Google ile giriş iptal edildi veya başarısız oldu.');
          await WebBrowser.dismissBrowser();
          return;
        }

        if (accessToken && refreshToken) {
          await supabaseService.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          await WebBrowser.dismissBrowser();
        } else if (authCode) {
          // Authorization Code flow with PKCE
          const { data, error: exchError } = await supabaseService.supabaseClient.auth.exchangeCodeForSession(authCode as any);
          if (exchError) {
            console.error('❌ Code exchange failed:', exchError);
            setError('Giriş başarısız. Lütfen tekrar deneyin.');
          } else if (data?.user) {
            setUser(data.user);
            await loadUserProfile(data.user);
          }
          await WebBrowser.dismissBrowser();
        } else {
          console.error('❌ OAuth callback missing tokens');
          setError('Giriş tamamlanamadı. Lütfen tekrar deneyin.');
          await WebBrowser.dismissBrowser();
        }
      } catch (err) {
        console.error('❌ OAuth callback processing failed:', err);
        setError('Giriş tamamlanamadı.');
      } finally {
        // Clear transient OAuth state to avoid leaking across attempts
        oauthAppStateRef.current = null;
        try { await WebBrowser.dismissBrowser(); } catch {}
      }
    };

    // Kick off auth init
    (async () => {
      try {
        setLoading(true);
        const currentUser = await supabaseService.initialize();
        if (currentUser && isMounted) {
          setUser(currentUser);
          await loadUserProfile(currentUser);
        }
      } catch (e) {
        console.error('❌ Auth initialization failed:', e);
        setError('Kimlik doğrulama başlatılamadı');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // URL listener
    const urlSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    // Initial URL
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) handleUrl(initialUrl);
    });

    // Auth state listener
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
        
        // 🧹 CRITICAL FIX: Cleanup services to prevent memory leaks
        try {
          console.log('🧹 Cleaning up services on user logout...');
          const { offlineSyncService } = await import('@/services/offlineSync');
          const { crossDeviceSync } = await import('@/services/crossDeviceSync');
          
          // Clean up all long-running services
          offlineSyncService.cleanup();
          crossDeviceSync.cleanup();
          
          console.log('✅ Service cleanup completed on logout');
        } catch (cleanupError) {
          console.error('⚠️ Service cleanup failed on logout (non-critical):', cleanupError);
        }
        
        // Clear persisted user id
        try { await AsyncStorage.removeItem('currentUserId'); } catch {}
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      urlSub?.remove?.();
      authListener?.subscription?.unsubscribe?.();
    };
  }, [setUserId]);

  // ===========================
  // PROFILE LOADING
  // ===========================
  
  const loadUserProfile = useCallback(async (user: User) => {
    try {
      console.log('👤 Loading user profile for:', user.email);
      // Debounce duplicate loads on rapid auth events
      const now = Date.now();
      if (isProfileLoadInFlightRef.current) {
        if (__DEV__) console.log('⏳ Profile load in flight, skipping');
        return;
      }
      if (
        lastProfileLoadRef.current &&
        lastProfileLoadRef.current.userId === user.id &&
        now - lastProfileLoadRef.current.ts < 60_000
      ) {
        if (__DEV__) console.log('🗄️ Using recent profile load, skipping duplicate');
        return;
      }
      isProfileLoadInFlightRef.current = true;
      
      // Set user ID for all stores
      setUserId(user.id);
      // Persist current user id for offline-first services (e.g., OfflineSync)
      try { await AsyncStorage.setItem('currentUserId', user.id); } catch {}
      
      // Initialize user-specific data migration
      await migrateToUserSpecificStorage(user.id);
      // Migrate sensitive plain-text keys to encrypted storage
      try { await SecureStorageMigration.migrate(user.id); } catch (e) { console.warn('Secure storage migration skipped:', e); }
      
      // Initialize gamification for this user (idempotent at store level)
      await initializeGamification(user.id);
      
      // Hydrate onboarding store from storage
      try {
        const { useMoodOnboardingStore } = await import('@/store/moodOnboardingStore');
        await useMoodOnboardingStore.getState().hydrateFromStorage(user.id);
        console.log('🔄 Onboarding store hydrated for user:', user.id);
      } catch (error) {
        console.error('❌ Failed to hydrate onboarding store:', error);
      }

      // ✅ NEW: Auto-recover unsynced mood entries on user login
      try {
        const { default: moodTrackingService } = await import('@/services/moodTrackingService');
        const recoveryResult = await moodTrackingService.autoRecoverUnsyncedEntries(user.id);
        if (recoveryResult.recovered > 0 || recoveryResult.failed > 0) {
          console.log(`🔄 Mood auto-recovery completed: ${recoveryResult.recovered} queued, ${recoveryResult.failed} failed`);
        }
      } catch (error) {
        console.error('❌ Failed to auto-recover mood entries:', error);
        // Non-critical error - don't prevent user login
      }
      
      // Check if onboarding profile exists in user_profiles table
      let userProfile = await supabaseService.getUserProfile(user.id, { cacheMs: 120000 });
      
      if (!userProfile) {
        console.log('📝 No onboarding profile found - user needs to complete onboarding');
        
        // 🚀 ONBOARDING FIX: Clear onboarding completion flags for new users
        console.log('🔄 New user detected - clearing onboarding flags for:', user.id);
        try {
          await AsyncStorage.removeItem(`ai_onboarding_completed_${user.id}`);
          await AsyncStorage.removeItem('ai_onboarding_completed'); // Generic fallback
          
          // 🔄 CACHE CLEAR: Reset NavigationGuard cache to force fresh check
          // Import dynamically to avoid circular dependencies
          try {
            const navigationModule = await import('@/components/navigation/NavigationGuard');
            // Clear the onboarding check cache for immediate effect
            if (typeof (navigationModule as any).clearOnboardingCache === 'function') {
              (navigationModule as any).clearOnboardingCache(user.id);
              console.log('🔄 NavigationGuard cache cleared for fresh onboarding check');
            }
          } catch (cacheError) {
            console.log('ℹ️ NavigationGuard cache clear not available (expected)');
          }
          
          console.log('✅ Onboarding flags cleared - NavigationGuard will redirect to onboarding');
        } catch (flagError) {
          console.warn('⚠️ Failed to clear onboarding flags in loadUserProfile:', flagError);
        }
      } else {
        console.log('✅ User profile loaded:', user.email);
        // 🔧 Drift correction: if local completion flags missing but server profile exists, set them silently
        try {
          const aiKey = `ai_onboarding_completed_${user.id}`;
          const localCompleted = await AsyncStorage.getItem(aiKey);
          if (localCompleted !== 'true') {
            await AsyncStorage.setItem(aiKey, 'true');
            await AsyncStorage.setItem('ai_onboarding_completed', 'true');
            await AsyncStorage.setItem('ai_onboarding_completed_at', new Date().toISOString());
            await AsyncStorage.setItem(`onboarding_server_confirmed_${user.id}`, 'true');
            console.log('🔧 Local onboarding flags restored from server profile');
          }
        } catch (e) {
          console.warn('⚠️ Failed to set local onboarding flags from server profile:', e);
        }
      }
      
      // Initialize gamification profile (create/update if needed)
      const gamificationProfile = await supabaseService.createGamificationProfile(user.id);
      if (gamificationProfile) {
        console.log('✅ Gamification profile initialized successfully! 🎮');
      } else {
        console.warn('⚠️ Gamification profile initialization failed, but app can continue');
      }
      
      // Set profile state so dependent screens render correctly (compat cast)
      setProfile((userProfile as any) ?? null);
      lastProfileLoadRef.current = { userId: user.id, ts: now };
    } catch (error) {
      console.error('❌ Load user profile failed:', error);
      setProfile(null);
    } finally {
      isProfileLoadInFlightRef.current = false;
    }
  }, [setUserId, initializeGamification]);

  // ===========================
  // AUTH METHODS
  // ===========================

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string): Promise<SignUpResult> => {
    try {
      setLoading(true);
      setError(null);
      const normalizedEmail = email.trim();
      if (!isValidEmail(normalizedEmail)) {
        setError('Lütfen geçerli bir email adresi girin.');
        throw Object.assign(new Error('INVALID_EMAIL_FORMAT'), { code: 'invalid_email_format' });
      }
      
      console.log('📧 Starting email signup...');
      const result = await supabaseService.signUpWithEmail(normalizedEmail, password, name);
      
      if (result.needsConfirmation) {
        setError('Kayıt başarılı! Email adresinizi kontrol edin ve doğrulama linkine tıklayın.');
        console.log('📧 Email confirmation required');
      } else {
        console.log('✅ Immediate signup success, auth state will update');
        
        // 🚀 ONBOARDING FIX: Clear onboarding completion flags for new users
        if (result.user?.id) {
          console.log('🔄 New user signup - clearing onboarding flags for:', result.user.id);
          try {
            await AsyncStorage.removeItem(`ai_onboarding_completed_${result.user.id}`);
            await AsyncStorage.removeItem('ai_onboarding_completed'); // Generic fallback
            console.log('✅ Onboarding flags cleared - user will be directed to onboarding');
          } catch (flagError) {
            console.warn('⚠️ Failed to clear onboarding flags:', flagError);
          }
        }
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Email signup failed:', error);
      const code = error?.code ?? error?.status ?? null;
      const message = String(error?.message || '').toLowerCase();
      let friendlyMessage = 'Kayıt başarısız';

      switch (code) {
        case 'invalid_email_format':
        case 'invalid_email':
          friendlyMessage = 'Lütfen geçerli bir email adresi girin.';
          break;
        case 'user_already_exists':
        case 'email_exists':
          friendlyMessage = 'Bu e-posta zaten kayıtlı.';
          break;
        case 'weak_password':
          friendlyMessage = 'Şifreniz çok zayıf. Daha güçlü bir şifre belirleyin.';
          break;
        case 400:
          if (message.includes('already') || message.includes('kayıtlı')) {
            friendlyMessage = 'Bu e-posta zaten kayıtlı.';
            break;
          }
          if (message.includes('password')) {
            friendlyMessage = 'Şifreniz güvenlik kriterlerini karşılamıyor.';
            break;
          }
          friendlyMessage = 'Kayıt bilgilerini kontrol edip tekrar deneyin.';
          break;
        default:
          if (message.includes('already registered') || message.includes('duplicate')) {
            friendlyMessage = 'Bu e-posta zaten kayıtlı.';
          } else if (message.includes('weak password') || message.includes('password is too weak')) {
            friendlyMessage = 'Şifreniz çok zayıf. Daha güçlü bir şifre belirleyin.';
          } else if (message.includes('rate limit') || message.includes('too many requests')) {
            friendlyMessage = 'Çok fazla deneme yaptınız. Bir süre sonra tekrar deneyin.';
          }
      }

      setError(friendlyMessage);
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
      const normalizedEmail = email.trim();
      if (!isValidEmail(normalizedEmail)) {
        setError('Lütfen geçerli bir email adresi girin.');
        throw new Error('INVALID_EMAIL_FORMAT');
      }
      await supabaseService.signInWithEmail(normalizedEmail, password);
      
      // Auth state change will handle the rest
      console.log('✅ Email login initiated, waiting for auth state');
      
    } catch (error: any) {
      console.error('❌ Email login failed:', error);
      // Map Supabase Auth errors to stable i18n keys
      const code = error?.code || error?.status || '';
      switch (code) {
        case 'email_not_confirmed':
        case 400:
          if (String(error?.message || '').toLowerCase().includes('confirm')) {
            setError('Email adresinizi doğrulamanız gerekiyor. Email kutunuzu kontrol edin.');
            break;
          }
          // fallthrough
        default:
          if (String(error?.message || '').toLowerCase().includes('invalid login')) {
            setError('Email veya şifre hatalı');
          } else {
            setError('Giriş başarısız');
          }
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔐 Starting Google OAuth via AuthSession...');

      // Request provider URL from Supabase
      const supa = await supabaseService.signInWithGoogle();
      const providerUrl: string | undefined = supa?.url;
      if (!providerUrl) throw new Error('GOOGLE_OAUTH_URL_MISSING');

      // Generate cryptographic app_state and append to auth URL
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const appState = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      oauthAppStateRef.current = appState;
      const authUrlWithState = providerUrl + (providerUrl.includes('?') ? '&' : '?') + `app_state=${appState}`;

      // Compute return URL (must match service redirect). Prefer provider URL's redirect_to
      let returnUrl: string;
      try {
        const parsed = new URL(providerUrl);
        const redirectTo = parsed.searchParams.get('redirect_to');
        returnUrl = redirectTo ? decodeURIComponent(redirectTo) : Linking.createURL('auth/callback');
      } catch {
        const isExpoGo = Constants.appOwnership === 'expo';
        returnUrl = isExpoGo
          ? makeRedirectUri({ path: 'auth/callback' })
          : Linking.createURL('auth/callback');
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrlWithState, returnUrl);
      if (__DEV__) console.log('🔐 AuthSession result:', result);

      if (result.type === 'cancel') {
        setError('Giriş iptal edildi.');
        return;
      }
      // openAuthSessionAsync returns { type: 'success' | 'cancel', url?: string }
      if (result.type !== 'success' || !('url' in result) || !result.url) {
        setError('Giriş başarısız. Lütfen tekrar deneyin.');
        return;
      }

      const urlObj = new URL(result.url.replace('#', '?'));
      const cbState = urlObj.searchParams.get('app_state');
      const errorParam = urlObj.searchParams.get('error');
      const errorDesc = urlObj.searchParams.get('error_description');
      const accessToken = urlObj.searchParams.get('access_token');
      const refreshToken = urlObj.searchParams.get('refresh_token');
      const authCode = urlObj.searchParams.get('code');
      if (__DEV__) console.log('🔐 Parsed callback params:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken, hasCode: !!authCode, cbState });

      // Enforce state only if both are present and mismatch
      if (oauthAppStateRef.current && cbState && oauthAppStateRef.current !== cbState) {
        setError('Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin.');
        return;
      }
      if (errorParam) {
        setError('Google ile giriş başarısız veya iptal edildi.');
        if (__DEV__) console.error('OAuth error:', errorParam, errorDesc);
        return;
      }
      if (accessToken && refreshToken) {
        await supabaseService.setSession({ access_token: accessToken, refresh_token: refreshToken });
        return;
      }
      if (authCode) {
        const { data, error: exchError } = await supabaseService.supabaseClient.auth.exchangeCodeForSession(authCode as any);
        if (exchError) {
          setError('Giriş başarısız. Lütfen tekrar deneyin.');
          if (__DEV__) console.error('Code exchange error:', exchError);
          return;
        }
        if (data?.user) {
          setUser(data.user);
          await loadUserProfile(data.user);
          return;
        }
      }
      // Fallback: attempt to refresh session (Supabase may have already set session)
      const { data: refreshed } = await supabaseService.supabaseClient.auth.getSession();
      if (refreshed?.session?.user) {
        setUser(refreshed.session.user);
        await loadUserProfile(refreshed.session.user);
        return;
      }
      setError('Giriş tamamlanamadı. Lütfen tekrar deneyin.');
    } catch (error: any) {
      console.error('❌ Google OAuth failed:', error);
      setError(error.message || 'Google ile giriş başarısız');
      throw error;
    } finally {
      // Clear transient OAuth state regardless of outcome
      oauthAppStateRef.current = null;
      try { await WebBrowser.dismissBrowser(); } catch {}
      setLoading(false);
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
