import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResult, SignUpResult } from '@/types/supabase';

/**
 * AuthService: focuses only on authentication responsibilities.
 * This is a scaffold; the main facade still lives in services/supabase.ts.
 */
export class AuthService {
  constructor(private client: SupabaseClient, private setCurrentUser: (u: User | null) => void) {}

  async initialize(): Promise<User | null> {
    const { data: { session } } = await this.client.auth.getSession();
    const user = session?.user || null;
    this.setCurrentUser(user);
    return user;
  }

  async signUpWithEmail(email: string, password: string, name: string): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { name, full_name: name, provider: 'email' } }
    });
    if (error) throw error;
    if (data.user && !data.session) return { user: data.user, session: null, needsConfirmation: true };
    if (data.user && data.session) { this.setCurrentUser(data.user); return { user: data.user, session: data.session, needsConfirmation: false }; }
    throw new Error('Unexpected signup result');
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user && data.session) { this.setCurrentUser(data.user); return { user: data.user, session: data.session }; }
    throw new Error('Login failed: No user or session');
  }

  async signInWithGoogle(): Promise<{ url?: string }> {
    const isExpoGo = Constants.appOwnership === 'expo';
    const redirectUrl = isExpoGo ? makeRedirectUri({ path: 'auth/callback' }) : Linking.createURL('auth/callback');
    const { data, error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl, queryParams: { access_type: 'offline', prompt: 'consent' }, skipBrowserRedirect: true } });
    if (error) throw error;
    return data as any;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.setCurrentUser(null);
    try { await AsyncStorage.removeItem('currentUserId'); } catch {}
  }
}

