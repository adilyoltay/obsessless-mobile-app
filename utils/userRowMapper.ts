import type { User } from '@supabase/supabase-js';

export function buildUsersUpsertRow(authUser: User) {
  const name = authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User';
  const provider = (authUser.app_metadata as any)?.provider || 'email';
  return {
    id: authUser.id,
    email: authUser.email || '',
    name,
    provider,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

