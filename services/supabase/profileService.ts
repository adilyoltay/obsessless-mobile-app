import type { SupabaseClient } from '@supabase/supabase-js';
import type { OCDProfile, UserProfile } from '@/types/supabase';
import { TableClient } from '@/services/supabase/tableClient';

/**
 * ProfileService: user profile CRUD and helpers.
 * Scaffold only; logic remains in facade until delegated.
 */
export class ProfileService {
  constructor(private client: SupabaseClient) {}

  async getUserProfile(userId: string): Promise<OCDProfile | null> {
    const table = new TableClient<OCDProfile>(this.client, 'user_profiles');
    const res: any = await table
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (res.error) throw res.error;
    return (res.data || null) as OCDProfile | null;
  }

  async createUserProfile(userId: string, email: string, name: string, provider: 'email' | 'google'): Promise<UserProfile> {
    const users = new TableClient<UserProfile>(this.client, 'users');
    const { data, error } = await users
      .insert({ id: userId, email, name, provider, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .select()
      .single();
    if (error) throw error;
    return data as UserProfile;
  }

  async saveUserProfile(profile: Omit<OCDProfile, 'id' | 'created_at'>): Promise<OCDProfile> {
    const table = new TableClient<OCDProfile>(this.client, 'user_profiles');
    const res: any = await table
      .upsert({ ...profile, updated_at: new Date().toISOString() } as any)
      .select()
      .single();
    if (res.error) throw res.error;
    return res.data as OCDProfile;
  }
}
