import { SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { trackAIInteraction, AIEventType } from '@/services/telemetry/noopTelemetry';
import deadLetterQueue from '@/services/sync/deadLetterQueue';
import { mapToCanonicalCategory, mapToDatabaseCategory } from '@/utils/categoryMapping';
import { isUUID } from '@/utils/validators';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase as sharedClient } from '@/lib/supabase';
import { sanitizePII } from '@/utils/privacy'; // ✅ F-06 FIX: Add PII sanitization
import { mapOnboardingPayloadToUserProfileRow } from '@/utils/onboardingMapper';
import { buildUsersUpsertRow } from '@/utils/userRowMapper';
import { generatePrefixedId } from '@/utils/idGenerator';
// Re-export types for backward compatibility with existing imports
export type {
  UserProfile,
  OCDProfile,
  CompulsionRecord,
  TherapySession,
  GamificationProfile,
  VoiceCheckinRecord,
  ThoughtRecordItem,
  VoiceSessionDB,
  BreathSessionDB,
  AuthResult,
  SignUpResult,
} from '@/types/supabase';

// 🔐 SECURE CONFIGURATION - Environment variables are REQUIRED
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 🚨 CRITICAL SECURITY CHECK: No fallback values for security
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('🚨 CRITICAL: Supabase credentials missing from environment variables');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  // CRASH PREVENTION: Do not throw at top-level; allow app to boot and surface user-friendly errors.
}

// ===========================
// DATABASE TYPES (moved to types/supabase)
// ===========================
import type {
  UserProfile,
  OCDProfile,
  CompulsionRecord,
  TherapySession,
  GamificationProfile,
  VoiceCheckinRecord,
  ThoughtRecordItem,
  VoiceSessionDB,
  BreathSessionDB,
  AuthResult,
  SignUpResult,
} from '@/types/supabase';

// Auth types now imported above

// ===========================
// SUPABASE SERVICE CLASS
// ===========================

class SupabaseNativeService {
  private client: SupabaseClient;
  private currentUser: User | null = null;
  private userProfileCache: Map<string, { data: OCDProfile | null; fetchedAt: number }> = new Map();
  // Segmented services
  private authSvc: import('@/services/supabase/authService').AuthService;
  private profileSvc: import('@/services/supabase/profileService').ProfileService;
  private moodSvc: import('@/services/supabase/moodService').MoodService;
  private voiceSvc: import('@/services/supabase/voiceService').VoiceService;
  private thoughtSvc: import('@/services/supabase/thoughtService').ThoughtService;
  private compulsionSvc: import('@/services/supabase/compulsionService').CompulsionService;
  private breathSvc: import('@/services/supabase/breathService').BreathService;
  private aiSvc: import('@/services/supabase/aiService').AIService;

  constructor(client?: SupabaseClient) {
    // Tek supabase client kullanımı (lib/supabase.ts)
    // Ortak istemci, storage/refresh ayarlarını zaten içerir
    // Ortam değişkenleri lib içinde doğrulanır
    this.client = (client || (sharedClient as unknown as SupabaseClient));
    console.log('✅ Supabase Native Service initialized (shared client)');
    // Initialize segmented services
    const { AuthService } = require('@/services/supabase/authService');
    const { ProfileService } = require('@/services/supabase/profileService');
    const { MoodService } = require('@/services/supabase/moodService');
    const { VoiceService } = require('@/services/supabase/voiceService');
    const { ThoughtService } = require('@/services/supabase/thoughtService');
    const { CompulsionService } = require('@/services/supabase/compulsionService');
    const { BreathService } = require('@/services/supabase/breathService');
    const { AIService } = require('@/services/supabase/aiService');
    this.authSvc = new AuthService(this.client, (u: User | null) => { this.currentUser = u; });
    this.profileSvc = new ProfileService(this.client);
    this.moodSvc = new MoodService(this.client);
    this.voiceSvc = new VoiceService(this.client);
    this.thoughtSvc = new ThoughtService(this.client);
    this.compulsionSvc = new CompulsionService(this.client);
    this.breathSvc = new BreathService(this.client);
    this.aiSvc = new AIService(this.client);
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
    console.log('📧 Supabase signup (delegated):', email);
    return this.authSvc.signUpWithEmail(email, password, name);
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    console.log('🔐 Supabase login (delegated):', email);
    return this.authSvc.signInWithEmail(email, password);
  }

  async signInWithGoogle(): Promise<any> {
    console.log('🔐 Google OAuth (delegated)');
    return this.authSvc.signInWithGoogle();
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
              // try { await trackAIInteraction(AIEventType.SYSTEM_STATUS, { event: 'auth_signout_retry', attempt }); } catch {}
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

      // 🌐 Network guard: avoid noisy errors when offline
      try {
        const NetInfo = require('@react-native-community/netinfo').default;
        const net = await NetInfo.fetch();
        const online = net.isConnected && net.isInternetReachable !== false;
        if (!online) {
          console.warn('⚠️ Offline detected - returning cached/fallback user profile');
          if (cached) return cached.data;
          if (__DEV__) {
            console.log('🔧 DEV: Returning fallback profile (offline)');
            return { id: userId, user_id: userId, created_at: new Date().toISOString() } as any;
          }
          return null;
        }
      } catch {}

      console.log('🔍 Fetching user profile from database...', userId);
      const data = await this.profileSvc.getUserProfile(userId);
      console.log('✅ User profile fetched from database');
      this.userProfileCache.set(userId, { data: data ?? null, fetchedAt: Date.now() });
      return data ?? null;
    } catch (error) {
      // In dev, this can be noisy—log as warn and continue with fallback
      if (__DEV__) console.warn('❌ Get user profile failed (DEV fallback will be used):', error);
      else console.error('❌ Get user profile failed:', error);
      
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
      const data = await this.profileSvc.createUserProfile(userId, email, name, provider);
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
      await this.ensureUserProfileExists(profile.user_id);
      const data = await this.profileSvc.saveUserProfile(profile);
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
      await this.aiSvc.upsertAIProfile(userId, profileData, onboardingCompleted);
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
      await this.aiSvc.upsertAITreatmentPlan(userId, planData, status);
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
      await this.ensureUserProfileExists(compulsion.user_id);
      const result = await this.compulsionSvc.saveCompulsion(compulsion);
      console.log('✅ Compulsion saved to database:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Save compulsion failed:', error);
      throw error;
    }
  }

  async getCompulsions(userId: string, startDate?: string, endDate?: string): Promise<CompulsionRecord[]> {
    try {
      console.log('🔍 Fetching compulsions from database...', { userId, startDate, endDate });
      const list = await this.compulsionSvc.getCompulsions(userId, startDate, endDate);
      console.log(`✅ Fetched ${list?.length || 0} compulsions`);
      return list;
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
            .upsert(buildUsersUpsertRow(authUser.user) as any, { onConflict: 'id' });

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
        // await trackAIInteraction(AIEventType.STORAGE_RETRY_SUCCESS, { key: 'gamification_profile_dead_letter', attempts: 0 });
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
      await this.voiceSvc.saveVoiceCheckin(record);
    } catch (error) {
      console.warn('⚠️ saveVoiceCheckin skipped:', (error as any)?.message);
    }
  }

  // ✅ F-06 FIX: Add PII sanitization for thought record fields
  async saveThoughtRecord(record: ThoughtRecordItem): Promise<void> {
    try {
      await this.ensureUserProfileExists(record.user_id);
      await this.thoughtSvc.saveThoughtRecord(record);
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
      // 🔐 SECURITY FIX: Replace insecure Date.now() + Math.random() with crypto-secure UUID
      const contentHash = sanitizedRecord.content_hash || generatePrefixedId('cbt');
      
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
      return await this.thoughtSvc.getCBTRecords(userId, dateRange);
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
      await this.voiceSvc.saveVoiceSessionSummary(session);
    } catch (error) {
      console.warn('⚠️ saveVoiceSessionSummary skipped (table may not exist):', (error as any)?.message);
    }
  }

  async saveBreathSession(session: BreathSessionDB): Promise<void> {
    try {
      await this.breathSvc.saveBreathSession(session);
    } catch (error) {
      console.warn('⚠️ saveBreathSession skipped (table may not exist):', (error as any)?.message);
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================
  
  /**
   * 🌍 Get UTC date string for consistent date keys (YYYY-MM-DD)
   * Fixed to use UTC for cross-device consistency with DB
   */
  private getUtcDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  // ===========================
  // MOOD METHODS
  // ===========================

  async saveMoodEntry(entry: any): Promise<any> {
    if (!isUUID(entry.user_id)) {
      throw Object.assign(new Error('invalid user_id'), { code: 'CLIENT_INVALID_USER_ID' });
    }
    try {
      console.log('🔄 Saving mood entry...', entry);
      await this.ensureUserProfileExists(entry.user_id);
      return await this.moodSvc.saveMoodEntry(entry);
    } catch (error) {
      console.error('❌ Save mood entry failed:', error);
      throw error;
    }
  }

  async getMoodEntries(userId: string, days: number = 7): Promise<any[]> {
    try {
      // Quick offline guard to avoid noisy network errors in RN when disconnected
      try {
        const state = await NetInfo.fetch();
        if (!state.isConnected || state.isInternetReachable === false) {
          console.warn('⚠️ Offline: skipping remote mood fetch');
          return [];
        }
      } catch {}
      const since = new Date();
      since.setDate(since.getDate() - days);
      const list = await this.moodSvc.getMoodEntries(userId, since.toISOString());
      console.log(`✅ Fetched ${list?.length || 0} mood entries`);
      return list;
    } catch (error) {
      console.error('❌ Get mood entries failed:', error);
      return [];
    }
  }
  
  async updateMoodEntry(entryId: string, updates: Partial<{
    mood_score: number;
    energy_level: number;
    anxiety_level: number;
    notes: string;
    triggers: string[];
    activities: string[];
  }>): Promise<any> {
    try {
      return await this.moodSvc.updateMoodEntry(entryId, updates);
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
      await this.voiceSvc.deleteVoiceCheckin(checkinId);
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
      await this.thoughtSvc.deleteThoughtRecord(recordId);
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
    const body: any = mapOnboardingPayloadToUserProfileRow(userId, payload);
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

// ===========================
// TEST FACTORY (non-production use)
// ===========================
/**
 * Factory to create an isolated service instance with an injected client.
 * Intended for unit tests; not used in production code paths.
 */
export function createSupabaseServiceForTest(client: SupabaseClient) {
  return new SupabaseNativeService(client);
}
