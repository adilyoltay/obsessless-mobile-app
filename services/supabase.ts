import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ncniotnzoirwuwwxnipw.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmlvdG56b2lyd3V3d3huaXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzODA2MjIsImV4cCI6MjA2ODk1NjYyMn0.Ks0vevUbys_gGMbYSlTjzqfWXXikAQ74VTJbzCRcbhk';

console.log('🔐 Supabase Native Config:', {
  url: SUPABASE_URL,
  hasKey: !!SUPABASE_ANON_KEY
});

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

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    console.log('✅ Supabase Native Service initialized');
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
      console.log('🔐 Redirect URL will be: obslesstest://auth/callback');
      
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'obslesstest://auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
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

  async getUserProfile(userId: string): Promise<OCDProfile | null> {
    try {
      console.log('🔍 Fetching user profile from database...', userId);
      
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      console.log('✅ User profile fetched from database');
      return data;
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
  // COMPULSION METHODS
  // ===========================

  async saveCompulsion(compulsion: Omit<CompulsionRecord, 'id' | 'timestamp'>): Promise<CompulsionRecord> {
    try {
      console.log('🔄 Saving compulsion to database...', compulsion);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(compulsion.user_id);
      
      const { data, error } = await this.client
        .from('compulsions')
        .insert({
          ...compulsion,
          timestamp: new Date().toISOString(),
        })
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
      console.log(`✅ Fetched ${data?.length || 0} compulsions from database`);
      return data || [];
    } catch (error) {
      console.error('❌ Get compulsions failed:', error);
      return [];
    }
  }

  async deleteCompulsion(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting compulsion from database...', id);
      
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

  async saveERPSession(session: Omit<ERPSession, 'id' | 'timestamp'>): Promise<ERPSession> {
    try {
      console.log('🔄 Saving ERP session to database...', session);
      
      // Ensure user exists in public.users table
      await this.ensureUserProfileExists(session.user_id);
      
      const { data, error } = await this.client
        .from('erp_sessions')
        .insert({
          ...session,
          timestamp: new Date().toISOString(),
        })
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
          // Create user profile
          const { error } = await this.client
            .from('users')
            .insert({
              id: userId,
              email: authUser.user.email || '',
              name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'User',
              provider: authUser.user.app_metadata?.provider || 'email',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (error) throw error;
          console.log('✅ User profile created in public.users:', userId);
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
      
      const { data, error } = await this.client
        .from('compulsions')
        .insert([{
          ...compulsion,
          timestamp: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating compulsion:', error);
        throw error;
      }
      
      console.log('✅ Compulsion created:', data);
      return data;
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
