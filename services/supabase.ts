import { SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import { mapToCanonicalCategory } from '@/utils/categoryMapping';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase as sharedClient } from '@/lib/supabase';

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



export interface ERPSession {
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
  streak_last_update: string;
  level: number;
  achievements: string[];
  micro_rewards: any[];
  created_at: string;
  updated_at: string;
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
      console.log('�� Signing out...');
      
      const { error } = await this.client.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      throw error;
    }
  }

  async setSession(tokens: { access_token: string; refresh_token: string }): Promise<void> {
    try {
      console.log('🔐 Setting session with tokens...');
      
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
      return null;
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
    // Yeni strateji: Tüm uygulama kategorilerini kanonik OKB kategorilerine indirger
    // ve DB tarafında bu kanonik değerleri kullanır.
    return mapToCanonicalCategory(category);
  }

  async saveCompulsion(compulsion: Omit<CompulsionRecord, 'id' | 'timestamp'>): Promise<CompulsionRecord> {
    try {
      console.log('🔄 Saving compulsion to database...', compulsion);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(compulsion.user_id);
      
      // Map category to canonical and preserve original label in subcategory if provided
      const mappedCompulsion = {
        ...compulsion,
        subcategory: compulsion.subcategory ?? compulsion.category, // keep caller-provided subcategory if exists
        category: this.mapCategoryForDatabase(compulsion.category),
        timestamp: new Date().toISOString(),
      };
      
      const { data, error } = await this.client
        .from('compulsions')
        .insert(mappedCompulsion)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Compulsion saved to database:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Save compulsion failed:', error);
      throw error;
    }
  }

  async getCompulsions(userId: string, startDate?: string, endDate?: string): Promise<CompulsionRecord[]> {
    try {
      console.log('🔍 Fetching compulsions from database...', { userId, startDate, endDate });
      
      let query = this.client
        .from('compulsions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (startDate) query = query.gte('timestamp', startDate);
      if (endDate) query = query.lte('timestamp', endDate);

      const { data, error } = await query;

      if (error) throw error;
      
      // Restore original categories from subcategory field
      const compulsions = (data || []).map(record => ({
        ...record,
        category: record.subcategory || record.category, // Use subcategory if available, fallback to category
      }));

      console.log(`✅ Fetched ${compulsions.length} compulsions from database`);
      return compulsions;
    } catch (error) {
      console.error('❌ Get compulsions failed:', error);
      return [];
    }
  }

  async deleteCompulsion(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting compulsion from database...', id);
      
      // Check if ID is a valid UUID (Supabase format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        console.log('⚠️ Skipping database delete - ID is not a valid UUID (likely a local-only record):', id);
        return; // Skip database delete for local-only records
      }
      
      const { error } = await this.client
        .from('compulsions')
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
  // ERP SESSION METHODS
  // ===========================

  async getERPSession(sessionId: string): Promise<ERPSession | null> {
    try {
      const { data, error } = await this.client
        .from('erp_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - session doesn't exist
          return null;
        }
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('❌ Get ERP session failed:', error);
      return null; // Return null if session doesn't exist or error occurs
    }
  }

  async saveERPSession(session: Omit<ERPSession, 'timestamp'> & { id?: string }): Promise<ERPSession> {
    try {
      console.log('🔄 Saving ERP session to database...', session);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(session.user_id);
      
      const sessionData = {
        ...session,
        timestamp: new Date().toISOString(),
      };
      
      // Include ID if provided for duplicate prevention
      if (session.id) {
        sessionData.id = session.id;
      }
      
      const { data, error } = await this.client
        .from('erp_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ ERP session saved to database:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Save ERP session failed:', error);
      throw error;
    }
  }

  async getERPSessions(userId: string, startDate?: string, endDate?: string): Promise<ERPSession[]> {
    try {
      console.log('🔍 Fetching ERP sessions from database...', { userId, startDate, endDate });
      
      let query = this.client
        .from('erp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (startDate) query = query.gte('timestamp', startDate);
      if (endDate) query = query.lte('timestamp', endDate);

      const { data, error } = await query;

      if (error) throw error;
      console.log(`✅ Fetched ${data?.length || 0} ERP sessions from database`);
      return data || [];
    } catch (error) {
      console.error('❌ Get ERP sessions failed:', error);
      return [];
    }
  }

  async deleteERPSession(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting ERP session from database...', id);
      
      const { error } = await this.client
        .from('erp_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('✅ ERP session deleted from database:', id);
    } catch (error) {
      console.error('❌ Delete ERP session failed:', error);
      throw error;
    }
  }

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
          streak_last_update: new Date().toISOString(),
          level: 1,
          achievements: [],
          micro_rewards: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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

  async updateGamificationProfile(userId: string, updates: Partial<Omit<GamificationProfile, 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
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
      throw error;
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
        .from('compulsions')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Error fetching compulsions:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch compulsions:', error);
      return [];
    }
  }

  // ===========================
  // NEW: VOICE CHECK-IN / THOUGHT RECORD / VOICE SESSION
  // ===========================

  async saveVoiceCheckin(record: VoiceCheckinRecord): Promise<void> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      await this.client.from('voice_checkins').insert({
        user_id: record.user_id,
        text: record.text,
        mood: record.mood,
        trigger: record.trigger,
        confidence: record.confidence,
        lang: record.lang,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('⚠️ saveVoiceCheckin skipped (table may not exist):', (error as any)?.message);
    }
  }

  async saveThoughtRecord(record: ThoughtRecordItem): Promise<void> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      await this.client.from('thought_records').insert({
        user_id: record.user_id,
        automatic_thought: record.automatic_thought,
        evidence_for: record.evidence_for,
        evidence_against: record.evidence_against,
        distortions: record.distortions,
        new_view: record.new_view,
        lang: record.lang,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('⚠️ saveThoughtRecord skipped (table may not exist):', (error as any)?.message);
    }
  }

  async saveVoiceSessionSummary(session: VoiceSessionDB): Promise<void> {
    try {
      await this.ensureUserProfileExists(session.user_id);
      await this.client.from('voice_sessions').insert({
        user_id: session.user_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_ms: session.duration_ms,
        transcription_count: session.transcription_count,
        error_count: session.error_count,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('⚠️ saveVoiceSessionSummary skipped (table may not exist):', (error as any)?.message);
    }
  }

  async saveBreathSession(session: BreathSessionDB): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('breath_sessions')
        .insert(session);
      if (error) throw error;
    } catch (error) {
      console.warn('⚠️ saveBreathSession skipped (table may not exist):', (error as any)?.message);
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  get supabaseClient() {
    return this.client;
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
