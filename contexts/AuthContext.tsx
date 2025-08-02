/**
 * AuthContext Alias
 * 
 * Bu dosya SupabaseAuthContext'in alias'ı olarak çalışır
 * Import uyumluluğu sağlar
 */

export { 
  SupabaseAuthProvider as AuthProvider,
  useAuth as useAuthContext,
  type AuthContextType
} from './SupabaseAuthContext';

// Default export for backwards compatibility
export { useAuth as default } from './SupabaseAuthContext'; 