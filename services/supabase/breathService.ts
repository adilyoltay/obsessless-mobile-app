import type { SupabaseClient } from '@supabase/supabase-js';
import type { BreathSessionDB } from '@/types/supabase';

export class BreathService {
  constructor(private client: SupabaseClient) {}

  async saveBreathSession(session: BreathSessionDB): Promise<void> {
    const { error } = await this.client
      .from('breath_sessions')
      .upsert(session as any, { onConflict: 'id' });
    if (error) throw error;
  }
}

