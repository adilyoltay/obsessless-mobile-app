import { SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { trackAIInteraction, AIEventType } from '@/features/ai/telemetry/aiTelemetry';
import deadLetterQueue from '@/services/sync/deadLetterQueue';
import { mapToCanonicalCategory, mapToDatabaseCategory } from '@/utils/categoryMapping';
import { isUUID } from '@/utils/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase as sharedClient } from '@/lib/supabase';
import { sanitizePII } from '@/utils/privacy'; // ✅ F-06 FIX: Add PII sanitization

// 🔐 SECURE CONFIGURATION - Environment variables are REQUIRED
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 🚨 CRITICAL SECURITY CHECK: No fallback values for security
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('🚨 CRITICAL: Supabase credentials missing from environment variables');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  
  // Production'da güvenli bir şekilde app'i kapatmak yerine hata fırlat
  if (!__DEV__) {
    throw new Error('SUPABASE_CREDENTIALS_MISSING: Application cannot start without proper credentials');
  }
  
  console.warn('⚠️ Development mode: Using demo credentials for testing');
  // Development'da fallback sadece test için
}

// ===========================
// DATABASE TYPES
// ===========================

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  provider: 'email' | 'google';
  created_at: string;
  updated_at: string;
}

// OCDProfile removed; keep minimal placeholder to avoid breakage if referenced
export interface OCDProfile {
  id: string;
  user_id: string;
  ocd_symptoms: string[];
  daily_goal: number;
  ybocs_score: number;
  ybocs_severity: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface CompulsionRecord {
  id: string;
  user_id: string;
  category: string;
  subcategory?: string;
  resistance_level: number;
  trigger?: string;
  notes?: string;
  timestamp: string;
}



export interface TherapySession {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  category: string;
  duration_seconds: number;
  anxiety_initial: number;
  anxiety_final: number;
  anxiety_readings: any[];
  completed: boolean;
  timestamp: string;
}

export interface GamificationProfile {
  user_id: string;
  streak_count: number;
  healing_points_total: number;
  healing_points_today: number;
  streak_last_update: string; // date (YYYY-MM-DD)
  level: number;
  achievements: string[];
  micro_rewards: any[];
  // created_at Supabase şemasında yok; updated_at trigger ile güncellenir
  updated_at?: string;
}

export interface VoiceCheckinRecord {
  id?: string;
  user_id: string;
  text: string;
  mood: number;
  trigger: string;
  confidence: number;
  lang: string;
  created_at?: string;
}

export interface ThoughtRecordItem {
  id?: string;
  user_id: string;
  automatic_thought: string;
  evidence_for?: string;
  evidence_against?: string;
  distortions: string[];
  new_view?: string;
  lang: string;
  created_at?: string;
}

export interface VoiceSessionDB {
  id?: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  transcription_count?: number;
  error_count?: number;
  created_at?: string;
}

export type BreathSessionDB = {
  user_id: string;
  protocol: 'box' | '478' | 'paced';
  duration_ms: number;
  started_at: string;
  completed_at?: string | null;
};

// ===========================
// AUTH RESULT TYPES
// ===========================

export interface AuthResult {
  user: User | null;
  session: Session | null;
  needsConfirmation?: boolean;
}

export interface SignUpResult extends AuthResult {
  needsConfirmation: boolean;
}

// ===========================
// SUPABASE SERVICE CLASS
// ===========================

class SupabaseNativeService {
  private client: SupabaseClient;
  private currentUser: User | null = null;
  private userProfileCache: Map<string, { data: OCDProfile | null; fetchedAt: number }> = new Map();

  constructor() {
    // Tek supabase client kullanımı (lib/supabase.ts)
    // Ortak istemci, storage/refresh ayarlarını zaten içerir
    // Ortam değişkenleri lib içinde doğrulanır
    this.client = sharedClient as unknown as SupabaseClient;
    console.log('✅ Supabase Native Service initialized (shared client)');
  }

  // ===========================
  // CORE AUTH METHODS
  // ===========================

  async initialize(): Promise<User | null> {
    try {
      console.log('🔐 Initializing Supabase auth...');
      
      // First, try to refresh the session to catch any OAuth callbacks
      console.log('🔐 Attempting session refresh...');
      const { data: { session }, error } = await this.client.auth.refreshSession();
      
      if (error) {
        console.log('🔐 Session refresh error (normal if no session):', error.message);
      }
      
      if (session?.user) {
        this.currentUser = session.user;
        console.log('✅ Refreshed session found:', {
          email: session.user.email,
          provider: session.user.app_metadata?.provider,
          confirmed: !!session.user.email_confirmed_at
        });
        return session.user;
      } else {
        console.log('🔐 No session from refresh, checking current session...');
      }
      
      // If no refreshed session, get current session
      console.log('🔐 Getting current session...');
      const { data: { session: currentSession }, error: sessionError } = await this.client.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError);
        return null;
      }
      
      if (currentSession?.user) {
        this.currentUser = currentSession.user;
        console.log('✅ Existing session found:', {
          email: currentSession.user.email,
          provider: currentSession.user.app_metadata?.provider,
          confirmed: !!currentSession.user.email_confirmed_at
        });
        return currentSession.user;
      }
      
      console.log('ℹ️ No existing session');
      return null;
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      return null;
    }
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<SignUpResult> {
    try {
      console.log('📧 Supabase native signup:', email);
      
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            full_name: name,
            provider: 'email'
          }
        }
      });

      if (error) {
        console.error('❌ Signup error:', error);
        throw error;
      }

      // Check if email confirmation is needed
      if (data.user && !data.session) {
        console.log('📧 Email confirmation required for:', email);
        return {
          user: data.user,
          session: null,
          needsConfirmation: true
        };
      }

      // Immediate login (email confirmation disabled)
      if (data.user && data.session) {
        this.currentUser = data.user;
        console.log('✅ Immediate signup success:', email);
        return {
          user: data.user,
          session: data.session,
          needsConfirmation: false
        };
      }

      throw new Error('Unexpected signup result');
    } catch (error) {
      console.error('❌ Supabase signup failed:', error);
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('🔐 Supabase native login:', email);
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        throw error;
      }

      if (data.user && data.session) {
        this.currentUser = data.user;
        console.log('✅ Login successful:', email);
        return {
          user: data.user,
          session: data.session
        };
      }

      throw new Error('Login failed: No user or session');
    } catch (error) {
      console.error('❌ Supabase login failed:', error);
      throw error;
    }
  }

  async signInWithGoogle(): Promise<any> {
    try {
      console.log('🔐 Google OAuth initiation...');
      // Use proxy redirect in Expo Go to avoid IP-based deep links and loops
      const isExpoGo = Constants.appOwnership === 'expo';
      const redirectUrl = isExpoGo
        ? makeRedirectUri({ path: 'auth/callback' })
        : Linking.createURL('auth/callback');
      console.log('🔐 Redirect URL will be:', redirectUrl);
      
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: true,
        }
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }
      
      console.log('🔐 Google OAuth data received:', JSON.stringify(data, null, 2));
      
      // Return the URL for in-app WebView instead of opening browser
      if (data.url) {
        console.log('🔐 OAuth URL ready for WebView:', data.url);
        return data; // Return data with URL for WebView
      } else {
        console.error('❌ No OAuth URL received from Supabase');
        throw new Error('No OAuth URL received');
      }
      
    } catch (error) {
      console.error('❌ Google OAuth failed:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      console.log('🔐 Signing out...');
      const net = await NetInfo.fetch();
      const isOnline = !!net.isConnected && net.isInternetReachable !== false;

      const tryGlobal = async () => {
        let attempt = 0;
        const max = 3;
        while (attempt < max) {
          try {
            attempt++;
            if (attempt > 1) {
              try { await trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'auth_signout_retry', attempt }); } catch {}
            }
            const { error } = await this.client.auth.signOut({ scope: 'global' } as any);
            if (error) throw error;
            return true;
          } catch (e) {
            if (attempt >= max) return false;
            await new Promise(r => setTimeout(r, 300 * attempt));
          }
        }
        return false;
      };

      let globalOk = false;
      if (isOnline) globalOk = await tryGlobal();

      if (!globalOk) {
        try { await this.client.auth.signOut({ scope: 'local' } as any); } catch {}
      }

      this.currentUser = null;
      console.log(`✅ Sign out successful (${globalOk ? 'global' : 'local'})`);
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      // Ensure local state cleared even if error thrown
      this.currentUser = null;
      try { await this.client.auth.signOut({ scope: 'local' } as any); } catch {}
      throw error;
    }
  }

  async setSession(tokens: { access_token: string; refresh_token: string }): Promise<void> {
    try {
      if (__DEV__) console.log('🔐 Setting session with tokens (masked)...');
      
      const { data, error } = await this.client.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      });
      
      if (error) {
        console.error('❌ Set session error:', error);
        throw error;
      }
      
      if (data.user) {
        this.currentUser = data.user;
        console.log('✅ Session set successfully, user:', data.user.email);
      }
      
    } catch (error) {
      console.error('❌ Set session failed:', error);
      throw error;
    }
  }

  async resendEmailConfirmation(email: string): Promise<void> {
    try {
      const { error } = await this.client.auth.resend({
        type: 'signup',
        email: email
      });

      if (error) throw error;
      console.log('✅ Email confirmation resent to:', email);
    } catch (error) {
      console.error('❌ Resend email confirmation failed:', error);
      throw error;
    }
  }

  // ===========================
  // AUTH STATE MANAGEMENT
  // ===========================

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event, 'User:', session?.user?.email || 'none');
      console.log('🔐 Session details:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        email: session?.user?.email,
        provider: session?.user?.app_metadata?.provider,
        confirmed: session?.user?.email_confirmed_at,
        accessToken: session?.access_token ? 'present' : 'missing'
      });
      this.currentUser = session?.user || null;
      callback(event, session);
    });
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Public getter: return current user id or null
   */
  getCurrentUserId(): string | null {
    return this.currentUser?.id ?? null;
  }

  // ===========================
  // DATABASE OPERATIONS
  // ===========================

  async getUserProfile(userId: string, options?: { forceRefresh?: boolean; cacheMs?: number }): Promise<OCDProfile | null> {
    try {
      const cacheMs = options?.cacheMs ?? 60_000;
      const forceRefresh = options?.forceRefresh === true;
      const cached = this.userProfileCache.get(userId);
      if (!forceRefresh && cached && Date.now() - cached.fetchedAt < cacheMs) {
        if (__DEV__) console.log('🗄️ Using cached user profile for', userId);
        return cached.data;
      }
      console.log('🔍 Fetching user profile from database...', userId);
      
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      console.log('✅ User profile fetched from database');
      this.userProfileCache.set(userId, { data: data ?? null, fetchedAt: Date.now() });
      return data ?? null;
    } catch (error) {
      console.error('❌ Get user profile failed:', error);
      
      // 🔧 DEV MODE: Return fallback profile to prevent app crashes
      if (__DEV__) {
        console.log('🔧 DEV: Returning fallback profile to continue app functionality');
        return { id: userId, user_id: userId, created_at: new Date().toISOString() } as any;
      }
      
      return null;
    }
  }

  /**
   * Update current auth user's metadata/preferences and persist locally.
   * Note: Supabase auth.updateUser updates the currently authenticated user; userId is for validation/logging.
   */
  async updateUser(userId: string, updates: { metadata?: any; locale?: string }): Promise<void> {
    try {
      // Ensure user row exists for cross-table consistency (no-op if already exists)
      await this.ensureUserProfileExists(userId);

      // Only proceed if we have a logged-in user matching userId
      const current = this.currentUser || (await this.client.auth.getUser()).data.user;
      if (!current || current.id !== userId) {
        console.warn('⚠️ updateUser called without matching authenticated user; skipping auth metadata update');
      } else {
        const data: any = { ...(updates?.metadata || {}) };
        if (updates?.locale) data.locale = updates.locale;
        const { error } = await this.client.auth.updateUser({ data } as any);
        if (error) throw error;
      }

      // Persist locally for offline-first access
      try {
        await AsyncStorage.setItem(
          `ai_user_metadata_${userId}`,
          JSON.stringify({ ...(updates?.metadata || {}), locale: updates?.locale, updatedAt: new Date().toISOString() })
        );
      } catch {}
    } catch (error) {
      console.error('❌ updateUser failed:', error);
      throw error;
    }
  }

  async createUserProfile(userId: string, email: string, name: string, provider: 'email' | 'google'): Promise<UserProfile> {
    try {
      const { data, error } = await this.client
        .from('users')
        .insert({
          id: userId,
          email,
          name,
          provider,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ User profile created:', email);
      return data;
    } catch (error) {
      console.error('❌ Create user profile failed:', error);
      throw error;
    }
  }

  // ===========================
  // USER PROFILE METHODS
  // ===========================

  async saveUserProfile(profile: Omit<OCDProfile, 'id' | 'created_at'>): Promise<OCDProfile> {
    try {
      console.log('🔄 Saving user profile to database...', profile);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(profile.user_id);
      
      const { data, error } = await this.client
        .from('user_profiles')
        .upsert({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ User profile saved to database:', data.user_id);
      return data;
    } catch (error) {
      console.error('❌ Save user profile failed:', error);
      throw error;
    }
  }

  // ===========================
  // AI PROFILES & TREATMENT PLANS
  // ===========================
  /**
   * AI profili upsert eder. Onboarding tamamlandıysa completed_at set edilir.
   */
  async upsertAIProfile(
    userId: string,
    profileData: any,
    onboardingCompleted: boolean = true
  ): Promise<void> {
    try {
      await this.ensureUserProfileExists(userId);

      const payload: any = {
        user_id: userId,
        profile_data: profileData,
        onboarding_completed: onboardingCompleted,
        updated_at: new Date().toISOString(),
      };
      if (onboardingCompleted) {
        payload.completed_at = new Date().toISOString();
      }

      const { error } = await this.client
        .from('ai_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      console.log('✅ AI profile upserted:', userId);
    } catch (error) {
      console.error('❌ upsertAIProfile failed:', error);
      throw error;
    }
  }

  /**
   * AI tedavi planını upsert eder.
   */
  async upsertAITreatmentPlan(
    userId: string,
    planData: any,
    status: string = 'active'
  ): Promise<void> {
    try {
      await this.ensureUserProfileExists(userId);

      const payload = {
        user_id: userId,
        plan_data: planData,
        status,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.client
        .from('ai_treatment_plans')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      console.log('✅ AI treatment plan upserted:', userId);
    } catch (error) {
      console.error('❌ upsertAITreatmentPlan failed:', error);
      throw error;
    }
  }

  // ===========================
  // COMPULSION METHODS
  // ===========================

  private mapCategoryForDatabase(category: string): string {
    // DB CHECK constraint ile uyumlu kategoriye indirger
    return mapToDatabaseCategory(category);
  }

  // ✅ F-06 FIX: Add PII sanitization for server-bound writes
  async saveCompulsion(compulsion: Omit<CompulsionRecord, 'id' | 'timestamp'>): Promise<CompulsionRecord> {
    try {
      console.log('🔄 Saving compulsion to database...', compulsion);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(compulsion.user_id);
      
      // ✅ Sanitize PII fields before server write
      const sanitizedCompulsion = {
        ...compulsion,
        notes: sanitizePII(compulsion.notes || ''),
        trigger: sanitizePII(compulsion.trigger || ''),
      };
      
      // Map to compulsion_records table schema
      const { mapToDatabaseCategory } = require('@/utils/categoryMapping');
      const compulsionType = sanitizedCompulsion.subcategory || 
                            mapToDatabaseCategory(sanitizedCompulsion.category);
      
      // Combine trigger and notes into description
      let description = sanitizedCompulsion.notes || '';
      if (sanitizedCompulsion.trigger && sanitizedCompulsion.trigger.trim()) {
        description = `Trigger: ${sanitizedCompulsion.trigger}\n${description}`;
      }
      
      // Map resistance_level (0-10) to intensity (0-100)
      const intensity = Math.min(100, Math.max(0, 
        (sanitizedCompulsion.resistance_level || 5) * 10
      ));
      
      const recordPayload = {
        user_id: compulsion.user_id,
        compulsion_type: compulsionType,
        description: description,
        intensity: intensity,
        created_at: new Date().toISOString(),
      };
      
      // Compute content_hash for idempotency (user_id + type + day + description normalized)
      const baseText = `${recordPayload.user_id}|${(recordPayload.compulsion_type || '').toLowerCase()}|${(recordPayload.description || '').trim().toLowerCase()}|${new Date().toISOString().slice(0,10)}`;
      const content_hash = this.computeContentHash(baseText);
      
      const { data, error } = await this.client
        .from('compulsion_records')
        .upsert({ ...recordPayload, content_hash }, { onConflict: 'user_id,content_hash', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (error) throw error;
      console.log('✅ Compulsion saved to database:', data.id);
      
      // Map back to CompulsionRecord format
      return {
        id: data.id,
        user_id: data.user_id,
        category: sanitizedCompulsion.category,
        subcategory: data.compulsion_type,
        resistance_level: sanitizedCompulsion.resistance_level || 5,
        trigger: sanitizedCompulsion.trigger || '',
        notes: sanitizedCompulsion.notes || '',
        timestamp: data.created_at,
      };
    } catch (error) {
      console.error('❌ Save compulsion failed:', error);
      throw error;
    }
  }

  async getCompulsions(userId: string, startDate?: string, endDate?: string): Promise<CompulsionRecord[]> {
    try {
      console.log('🔍 Fetching compulsions from database...', { userId, startDate, endDate });
      
      let query = this.client
        .from('compulsion_records')
        .select('id, user_id, compulsion_type, description, intensity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query;

      if (error) throw error;
      
      console.log(`✅ Fetched ${data?.length || 0} compulsions`);
      
      // Map from compulsion_records to CompulsionRecord format
      const { mapToCanonicalCategory } = require('@/utils/categoryMapping');
      
      return (data || []).map((record: any) => {
        // Extract trigger from description if present
        let trigger = '';
        let notes = record.description || '';
        
        const triggerMatch = notes.match(/^Trigger: (.*)\n(.*)$/s);
        if (triggerMatch) {
          trigger = triggerMatch[1] || '';
          notes = triggerMatch[2] || '';
        }
        
        // Map intensity (0-100) back to resistance_level (0-10)
        const resistance_level = Math.round((record.intensity || 50) / 10);
        
        return {
          id: record.id,
          user_id: record.user_id,
          category: mapToCanonicalCategory(record.compulsion_type),
          subcategory: record.compulsion_type,
          resistance_level: resistance_level,
          trigger: trigger,
          notes: notes,
          timestamp: record.created_at,
        } as CompulsionRecord;
      });
    } catch (error) {
      console.error('❌ Get compulsions failed:', error);
      return [];
    }
  }

  async deleteCompulsion(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting compulsion from database...', id);
      
      // Check if ID is a valid UUID (Supabase format)
      if (!isUUID(id)) {
        console.log('⚠️ Skipping database delete - ID is not a valid UUID (likely a local-only record):', id);
        return; // Skip database delete for local-only records
      }
      
      const { error } = await this.client
        .from('compulsion_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('✅ Compulsion deleted from database:', id);
    } catch (error) {
      console.error('❌ Delete compulsion failed:', error);
      throw error;
    }
  }

  // ===========================
  // ✅ REMOVED: ERP SESSION METHODS - ERP module deleted
  // ===========================

  // ✅ REMOVED: deleteERPSession method - ERP module deleted

  // ===========================
  // GAMIFICATION METHODS
  // ===========================

  async createGamificationProfile(userId: string): Promise<GamificationProfile | null> {
    try {
      // First ensure user exists in public.users table
      await this.ensureUserProfileExists(userId);
      
      const { data, error } = await this.client
        .from('gamification_profiles')
        .upsert({
          user_id: userId,
          streak_count: 0,
          healing_points_total: 0,
          healing_points_today: 0,
          streak_last_update: new Date().toISOString().split('T')[0],
          level: 1,
          achievements: [],
          micro_rewards: [],
          // created_at DB'de yok; updated_at trigger ile güncellenir
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Gamification profile created/updated:', userId);
      return data;
    } catch (error) {
      console.error('❌ Create gamification profile failed:', error);
      // Don't throw error, return null to prevent app crash
      return null;
    }
  }

  private async ensureUserProfileExists(userId: string): Promise<void> {
    try {
      // Check if user exists in public.users
      const { data: existingUser } = await this.client
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingUser) {
        // Get user info from auth.users
        const { data: authUser } = await this.client.auth.getUser();
        
        if (authUser.user && authUser.user.id === userId) {
          // Upsert user profile (avoid duplicate key with triggers)
          const { error } = await this.client
            .from('users')
            .upsert({
              id: userId,
              email: authUser.user.email || '',
              name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'User',
              provider: authUser.user.app_metadata?.provider || 'email',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (error) throw error;
          console.log('✅ User profile upserted in public.users:', userId);
        }
      }
    } catch (error) {
      console.error('❌ Ensure user profile failed:', error);
      throw error;
    }
  }

  async updateGamificationProfile(userId: string, updates: Partial<Omit<GamificationProfile, 'user_id' | 'updated_at'>>): Promise<void> {
    try {
      console.log('🔄 Updating gamification profile...', { userId, updates });
      
      const { error } = await this.client
        .from('gamification_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      console.log('✅ Gamification profile updated:', userId);
    } catch (error) {
      console.error('❌ Update gamification profile failed:', error);
      // Offline-first fallback: enqueue for retry and proceed without throwing
      try {
        await deadLetterQueue.addToDeadLetter({
          id: `gpf_${Date.now()}`,
          type: 'update',
          entity: 'gamification_profiles',
          data: { user_id: userId, updates },
          errorMessage: 'update_gamification_profile_failed',
        } as any, error);
        await trackAIInteraction(AIEventType.STORAGE_RETRY_SUCCESS, { key: 'gamification_profile_dead_letter', attempts: 0 });
      } catch {}
      // Do not rethrow to avoid redbox; UI continues and sync will retry later
    }
  }

  // ===========================
  // COMPULSION MANAGEMENT  
  // ===========================

  async createCompulsion(compulsion: Omit<CompulsionRecord, 'id' | 'timestamp'>): Promise<CompulsionRecord | null> {
    try {
      console.log('📝 Creating compulsion:', compulsion);
      // User profile existence is ensured inside saveCompulsion; no need to duplicate here
      // Reuse saveCompulsion to avoid duplication
      const saved = await this.saveCompulsion(compulsion);
      console.log('✅ Compulsion created via saveCompulsion:', saved?.id);
      return saved;
    } catch (error) {
      console.error('❌ Failed to create compulsion:', error);
      return null;
    }
  }

  async getUserCompulsions(userId: string, limit: number = 50): Promise<CompulsionRecord[]> {
    try {
      const { data, error } = await this.client
        .from('compulsion_records')
        .select('id, user_id, compulsion_type, description, intensity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Error fetching compulsions:', error);
        return [];
      }
      
      // Map from compulsion_records to CompulsionRecord format (same as getCompulsions)
      const { mapToCanonicalCategory } = require('@/utils/categoryMapping');
      
      return (data || []).map((record: any) => {
        // Extract trigger from description if present
        let trigger = '';
        let notes = record.description || '';
        
        const triggerMatch = notes.match(/^Trigger: (.*)\n(.*)$/s);
        if (triggerMatch) {
          trigger = triggerMatch[1] || '';
          notes = triggerMatch[2] || '';
        }
        
        // Map intensity (0-100) back to resistance_level (0-10)
        const resistance_level = Math.round((record.intensity || 50) / 10);
        
        return {
          id: record.id,
          user_id: record.user_id,
          category: mapToCanonicalCategory(record.compulsion_type),
          subcategory: record.compulsion_type,
          resistance_level: resistance_level,
          trigger: trigger,
          notes: notes,
          timestamp: record.created_at,
        } as CompulsionRecord;
      });
    } catch (error) {
      console.error('❌ Failed to fetch compulsions:', error);
      return [];
    }
  }

  // ===========================
  // NEW: VOICE CHECK-IN / THOUGHT RECORD / VOICE SESSION
  // ===========================

  /**
   * Compute content hash for text (client-side SHA-256)
   */
  private computeContentHash(text: string): string {
    // Normalize text: trim, collapse spaces, lowercase
    const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
    
    // Simple hash function for client-side (not cryptographic)
    // In production, use a proper SHA-256 library
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // ✅ F-06 FIX: Add PII sanitization for voice checkin fields
  async saveVoiceCheckin(record: VoiceCheckinRecord): Promise<void> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      
      // ✅ Sanitize PII fields before server write
      const sanitizedRecord = {
        ...record,
        text: sanitizePII(record.text || ''),
        trigger: sanitizePII(record.trigger || ''),
      };
      
      // Compute content hash for idempotency using sanitized text
      const contentHash = this.computeContentHash(sanitizedRecord.text);
      
      const payload = {
        user_id: sanitizedRecord.user_id,
        text: sanitizedRecord.text,
        mood: sanitizedRecord.mood,
        trigger: sanitizedRecord.trigger,
        confidence: sanitizedRecord.confidence,
        lang: sanitizedRecord.lang,
        content_hash: contentHash,
        created_at: sanitizedRecord.created_at || new Date().toISOString(),
      };
      
      // Use idempotent upsert with content_hash
      const { error } = await this.client
        .from('voice_checkins')
        .upsert(payload, { 
          onConflict: 'user_id,content_hash',
          ignoreDuplicates: true 
        });
        
      if (error && !error.message?.includes('duplicate')) {
        console.warn('⚠️ saveVoiceCheckin error:', error);
      }
    } catch (error) {
      console.warn('⚠️ saveVoiceCheckin skipped:', (error as any)?.message);
    }
  }

  // ✅ F-06 FIX: Add PII sanitization for thought record fields
  async saveThoughtRecord(record: ThoughtRecordItem): Promise<void> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      
      // ✅ Sanitize PII fields before server write
      const sanitizedRecord = {
        ...record,
        automatic_thought: sanitizePII(record.automatic_thought || ''),
        evidence_for: sanitizePII(record.evidence_for || ''),
        evidence_against: sanitizePII(record.evidence_against || ''),
        new_view: sanitizePII(record.new_view || ''),
      };
      
      // Compute content hash from sanitized automatic thought
      const contentHash = this.computeContentHash(sanitizedRecord.automatic_thought);
      
      const payload = {
        user_id: sanitizedRecord.user_id,
        automatic_thought: sanitizedRecord.automatic_thought,
        evidence_for: sanitizedRecord.evidence_for,
        evidence_against: sanitizedRecord.evidence_against,
        distortions: sanitizedRecord.distortions,
        new_view: sanitizedRecord.new_view,
        lang: sanitizedRecord.lang,
        content_hash: contentHash,
        created_at: sanitizedRecord.created_at || new Date().toISOString(),
      };
      // Use idempotent upsert with content_hash
      const { error } = await this.client
        .from('thought_records')
        .upsert(payload, { 
          onConflict: 'user_id,content_hash',
          ignoreDuplicates: true 
        });
        
      if (error && !error.message?.includes('duplicate')) {
        console.warn('⚠️ saveThoughtRecord error:', error);
      }
    } catch (error) {
      console.warn('⚠️ saveThoughtRecord skipped (table may not exist):', (error as any)?.message);
    }
  }

  // ===========================
  // CBT THOUGHT RECORDS
  // ===========================

  // ✅ F-06 FIX: Add PII sanitization for CBT record fields
  async saveCBTRecord(record: {
    user_id: string;
    thought: string;
    distortions: string[];
    evidence_for?: string;
    evidence_against?: string;
    reframe: string;
    mood_before: number;
    mood_after: number;
    trigger?: string;
    notes?: string;
    content_hash?: string; // Allow manual content_hash to bypass trigger
  }): Promise<{ id: string } | null> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      
      // ✅ Sanitize PII fields before server write
      const sanitizedRecord = {
        ...record,
        thought: sanitizePII(record.thought || ''),
        evidence_for: sanitizePII(record.evidence_for || ''),
        evidence_against: sanitizePII(record.evidence_against || ''),
        reframe: sanitizePII(record.reframe || ''),
        trigger: sanitizePII(record.trigger || ''),
        notes: sanitizePII(record.notes || ''),
      };
      
      // Generate content_hash if not provided (to bypass problematic trigger)
      const contentHash = sanitizedRecord.content_hash || `cbt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await this.client
        .from('thought_records')
        .insert({
          user_id: sanitizedRecord.user_id,
          thought: sanitizedRecord.thought,
          distortions: sanitizedRecord.distortions || [],
          evidence_for: sanitizedRecord.evidence_for || null,
          evidence_against: sanitizedRecord.evidence_against || null,
          reframe: sanitizedRecord.reframe,
          mood_before: sanitizedRecord.mood_before,
          mood_after: sanitizedRecord.mood_after,
          trigger: sanitizedRecord.trigger || null,
          notes: sanitizedRecord.notes || null,
          content_hash: contentHash, // Manual hash to bypass trigger
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      console.log('✅ CBT record saved:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Failed to save CBT record:', error);
      // Offline fallback
      await deadLetterQueue.addToDeadLetter({
        id: `cbt_${Date.now()}`,
        type: 'create',
        entity: 'thought_records',
        data: record,
        errorMessage: 'save_cbt_record_failed',
      } as any, error);
      return null;
    }
  }

  async getCBTRecords(userId: string, dateRange?: { start: Date; end: Date }): Promise<any[]> {
    try {
      let query = this.client
        .from('thought_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch CBT records:', error);
      return [];
    }
  }

  async deleteCBTRecord(recordId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('thought_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      console.log('✅ CBT record deleted:', recordId);
    } catch (error) {
      console.error('❌ Failed to delete CBT record:', error);
      // Queue for retry
      await deadLetterQueue.addToDeadLetter({
        id: `cbt_del_${Date.now()}`,
        type: 'delete',
        entity: 'thought_records',
        data: { id: recordId },
        errorMessage: 'delete_cbt_record_failed',
      } as any, error);
    }
  }

  async saveVoiceSessionSummary(session: VoiceSessionDB): Promise<void> {
    try {
      await this.ensureUserProfileExists(session.user_id);
      const payload = {
        user_id: session.user_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_ms: session.duration_ms,
        transcription_count: session.transcription_count,
        error_count: session.error_count,
        created_at: session.created_at || new Date().toISOString(),
      };
      await this.client
        .from('voice_sessions')
        .upsert(payload, { onConflict: 'user_id,started_at' });
    } catch (error) {
      console.warn('⚠️ saveVoiceSessionSummary skipped (table may not exist):', (error as any)?.message);
    }
  }

  async saveBreathSession(session: BreathSessionDB): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('breath_sessions')
        .upsert(session, { onConflict: 'id' });
      if (error) throw error;
    } catch (error) {
      console.warn('⚠️ saveBreathSession skipped (table may not exist):', (error as any)?.message);
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================
  
  // ===========================
  // MOOD METHODS
  // ===========================
  
  // ✅ F-02 FIX: Standardize idempotency with content_hash and upsert
  async saveMoodEntry(entry: any): Promise<any> {
    if (!isUUID(entry.user_id)) {
      throw Object.assign(new Error('invalid user_id'), { code: 'CLIENT_INVALID_USER_ID' });
    }
    try {
      console.log('🔄 Saving mood entry...', entry);
      
      // Ensure user exists
      await this.ensureUserProfileExists(entry.user_id);
      
      // ✅ F-06 FIX: Sanitize PII fields before server write
      const sanitizedEntry = {
        ...entry,
        notes: sanitizePII(entry.notes || ''),
        trigger: sanitizePII(entry.trigger || ''),
        // ✅ NEW: Handle triggers array properly
        triggers: entry.triggers?.map(t => sanitizePII(t)) || (entry.trigger ? [sanitizePII(entry.trigger)] : []),
        activities: entry.activities?.map(a => sanitizePII(a)) || [],
      };
      
      // ✅ Generate content_hash for idempotency (client-side) using sanitized data
      const triggerText = sanitizedEntry.triggers.join(',').toLowerCase();
      const activityText = sanitizedEntry.activities.join(',').toLowerCase();
      const contentText = `${sanitizedEntry.user_id}|${Math.round(sanitizedEntry.mood_score)}|${Math.round(sanitizedEntry.energy_level)}|${Math.round(sanitizedEntry.anxiety_level)}|${sanitizedEntry.notes.trim().toLowerCase()}|${triggerText}|${activityText}|${new Date().toISOString().slice(0,10)}`;
      const content_hash = this.computeContentHash(contentText);
      
      const payload = {
        user_id: sanitizedEntry.user_id,
        mood_score: sanitizedEntry.mood_score,
        energy_level: sanitizedEntry.energy_level,
        anxiety_level: sanitizedEntry.anxiety_level,
        notes: sanitizedEntry.notes,
        triggers: sanitizedEntry.triggers,
        activities: sanitizedEntry.activities,
        content_hash,
        created_at: new Date().toISOString(),
      };
      
      // ✅ Use upsert with conflict resolution on (user_id, content_hash)
      // NOTE: Use maybeSingle() to avoid PGRST116 when no rows are returned (duplicate prevented)
      const { data, error } = await this.client
        .from('mood_entries')
        .upsert(payload, { 
          onConflict: 'user_id,content_hash',
          ignoreDuplicates: true 
        })
        .select()
        .maybeSingle();
      
      if (error) {
        // ✅ Handle unique/duplicate or no-row return cases gracefully
        if (
          error.code === '23505' ||
          error.message?.includes('duplicate') ||
          error.code === 'PGRST116' ||
          /multiple \(or no\) rows returned/i.test(error.message || '')
        ) {
          console.log('ℹ️ Mood entry already exists or not returned (idempotent upsert)');
          return null;
        }
        throw error;
      }
      
      console.log('✅ Mood entry saved:', data?.id || 'duplicate_prevented');
      return data;
    } catch (error) {
      console.error('❌ Save mood entry failed:', error);
      throw error;
    }
  }
  
  async getMoodEntries(userId: string, days: number = 7): Promise<any[]> {
    try {
      console.log('🔍 Fetching mood entries...', { userId, days });
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await this.client
        .from('mood_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log(`✅ Fetched ${data?.length || 0} mood entries`);
      return data || [];
    } catch (error) {
      console.error('❌ Get mood entries failed:', error);
      
      // Additional error context for debugging
      if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.code) {
          console.error('🔍 Supabase Error Details:', {
            code: supabaseError.code,
            message: supabaseError.message,
            details: supabaseError.details,
            hint: supabaseError.hint
          });
        }
      }
      
      return [];
    }
  }
  
  async updateMoodEntry(entryId: string, updates: Partial<{
    mood_score: number;
    energy_level: number;
    anxiety_level: number;
    notes: string;
    trigger: string;
  }>): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('mood_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Update mood entry failed:', error);
      throw error;
    }
  }
  
  async deleteMoodEntry(entryId: string): Promise<void> {
    try {
      console.log('🗑️ Attempting to delete mood entry:', entryId);
      
      // ✅ Use shared UUID validator
      if (!isUUID(entryId)) {
        console.warn('⚠️ Invalid UUID format detected:', entryId);
        console.log('💡 This appears to be a client-generated ID (mood_timestamp_random)');
        console.log('🔄 Skipping server delete - entry was likely never synced or already deleted');
        // Gracefully skip - client-generated IDs don't exist on server
        return;
      }
      
      const { error } = await this.client
        .from('mood_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
      console.log('✅ Mood entry deleted successfully from server:', entryId);
      
    } catch (error) {
      console.error('❌ Delete mood entry failed:', error);
      throw error;
    }
  }

  // ✅ F-04 FIX: Add missing deleteVoiceCheckin method
  // 🚨 HOTFIX: Handle potential UUID validation issues
  async deleteVoiceCheckin(checkinId: string): Promise<void> {
    try {
      console.log('🗑️ Attempting to delete voice checkin:', checkinId);
      
      // ✅ Use shared UUID validator
      if (!isUUID(checkinId)) {
        console.warn('⚠️ Invalid UUID format detected for voice checkin:', checkinId);
        console.log('🔄 Skipping server delete - entry may not exist on server');
        return;
      }
      
      const { error } = await this.client
        .from('voice_checkins')
        .delete()
        .eq('id', checkinId);

      if (error) throw error;
      console.log('✅ Voice checkin deleted successfully from server:', checkinId);
    } catch (error) {
      console.error('❌ Failed to delete voice checkin:', error);
      throw error;
    }
  }

  // ✅ F-04 FIX: Add missing deleteThoughtRecord method (separate from deleteCBTRecord)
  // 🚨 HOTFIX: Handle potential UUID validation issues
  async deleteThoughtRecord(recordId: string): Promise<void> {
    try {
      console.log('🗑️ Attempting to delete thought record:', recordId);
      
      // ✅ Use shared UUID validator
      if (!isUUID(recordId)) {
        console.warn('⚠️ Invalid UUID format detected for thought record:', recordId);
        console.log('🔄 Skipping server delete - entry may not exist on server');
        return;
      }
      
      const { error } = await this.client
        .from('thought_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      console.log('✅ Thought record deleted successfully from server:', recordId);
    } catch (error) {
      console.error('❌ Failed to delete thought record:', error);
      throw error;
    }
  }

  // ===========================

  get supabaseClient() {
    return this.client;
  }

  /**
   * Upsert user profile with onboarding v2 payload
   */
  async upsertUserProfile(userId: string, payload: any): Promise<void> {
    const mapEnum = (val: any, allowed: string[], normalize?: (s: string) => string): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      const base = (normalize ? normalize(val) : val).trim().toLowerCase().replace(/-/g, '_');
      return allowed.includes(base) ? base : undefined;
    };

    const gender = mapEnum(payload?.profile?.gender, ['female','male','non_binary','prefer_not_to_say']);
    const lifestyle_exercise = mapEnum(payload?.lifestyle?.exercise, ['none','light','moderate','intense']);
    const lifestyle_social = mapEnum(payload?.lifestyle?.social, ['low','medium','high']);
    const motivations = Array.isArray(payload?.motivation) ? payload.motivation.filter((m: any) => typeof m === 'string') : [];
    const firstMoodScoreRaw = payload?.first_mood?.score;
    const first_mood_score = typeof firstMoodScoreRaw === 'number' ? Math.min(5, Math.max(1, firstMoodScoreRaw)) : (firstMoodScoreRaw != null ? Number(firstMoodScoreRaw) : null);
    const first_mood_tags = Array.isArray(payload?.first_mood?.tags) ? payload.first_mood.tags.filter((t: any) => typeof t === 'string') : [];

    const body: any = {
      user_id: userId,
      age: payload?.profile?.age,
      gender,
      locale: payload?.profile?.locale,
      timezone: payload?.profile?.timezone || payload?.reminders?.timezone,
      motivations,
      first_mood_score: first_mood_score != null ? Number(first_mood_score) : null,
      first_mood_tags,
      lifestyle_sleep_hours: payload?.lifestyle?.sleep_hours,
      lifestyle_exercise,
      lifestyle_social,
      reminder_enabled: !!payload?.reminders?.enabled,
      reminder_time: payload?.reminders?.time || null,
      reminder_days: payload?.reminders?.days || [],
      feature_flags: payload?.feature_flags || {},
      consent_accepted: !!payload?.consent?.accepted,
      consent_at: payload?.consent?.accepted ? new Date().toISOString() : null,
      onboarding_version: 2,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Remove undefined to avoid constraint issues
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k]; });

    const { error } = await this.client
      .from('user_profiles')
      .upsert(body, { onConflict: 'user_id' })
      .single();
    if (error) throw error;
  }
}

// ===========================
// INITIALIZATION HELPER
// ===========================

export async function initializeSupabase(): Promise<User | null> {
  return await supabaseService.initialize();
}

// ===========================
// EXPORT SINGLETON
// ===========================

export const supabaseService = new SupabaseNativeService();
export default supabaseService;
