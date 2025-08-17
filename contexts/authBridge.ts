import type { UserProfile } from '@/services/supabase';

interface AuthBridgeImpl {
  setProfile: (profile: UserProfile | null) => void;
  getUserId: () => string | null;
}

let impl: AuthBridgeImpl | null = null;

export function registerAuthBridge(implementation: AuthBridgeImpl) {
  impl = implementation;
}

export function setAuthProfile(profile: UserProfile | null) {
  impl?.setProfile(profile);
}

export function getAuthUserId(): string | null {
  return impl?.getUserId() ?? null;
}

export default {
  registerAuthBridge,
  setAuthProfile,
  getAuthUserId,
};


