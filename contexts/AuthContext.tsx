import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simpleAuthService, UserProfile } from '@/services/simpleAuth';
import { biometricService, BiometricCapability } from '@/services/biometric';
import { useGamificationStore } from '@/store/gamificationStore';
import { migrateToUserSpecificStorage } from '@/utils/storage';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  // Biometric methods
  biometricCapability: BiometricCapability | null;
  isBiometricEnabled: boolean;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  loginWithBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  
  const { initializeGamification, setUserId } = useGamificationStore();

  useEffect(() => {
    console.log('🚀 AuthProvider useEffect triggered - starting initialization...');
    initializeAuth();
    initializeBiometric();
  }, []);

  const initializeBiometric = async () => {
    try {
      console.log('🔒 Biometric initialization starting...');
      const capability = await biometricService.checkBiometricCapability();
      console.log('🔒 Biometric capability:', capability);
      setBiometricCapability(capability);

      const enabled = await biometricService.isBiometricLoginEnabled();
      console.log('🔒 Biometric enabled:', enabled);
      setIsBiometricEnabled(enabled);
      console.log('🔒 Biometric initialization completed!');
    } catch (error) {
      console.error('❌ Biometric initialization failed:', error);
    }
  };

  const initializeAuth = async () => {
    try {
      console.log('🔐 Auth initialization starting...');
      // Check if user is already logged in
      const currentUser = await simpleAuthService.getCurrentUser();
      console.log('🔐 Current user:', currentUser);
      setUser(currentUser);
      
      // Initialize gamification if user exists
      if (currentUser?.uid) {
        setUserId(currentUser.uid);
        await initializeGamification(currentUser.uid);
      }
      
      setLoading(false);
      console.log('🔐 Auth initialization completed!');
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      
      const userProfile = await simpleAuthService.signIn(email, password);
      setUser(userProfile);
      
      // Initialize gamification for the user
      if (userProfile.uid) {
        setUserId(userProfile.uid);
        await initializeGamification(userProfile.uid);
        
        // Migrate old data if exists
        await migrateToUserSpecificStorage(userProfile.uid);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [initializeGamification, setUserId]);

  const signup = async (email: string, password: string, name: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      const userProfile = await simpleAuthService.signUp(email, password, name);
      setUser(userProfile);
      
      // Initialize gamification for new user
      if (userProfile.uid) {
        setUserId(userProfile.uid);
        await initializeGamification(userProfile.uid);
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await simpleAuthService.signOut();
      setUser(null);
      await AsyncStorage.removeItem('authToken');
    } catch (error: any) {
      console.error('Logout error:', error);
      setError('Çıkış yapılırken bir hata oluştu');
      throw error;
    }
  };

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const enableBiometric = async (): Promise<boolean> => {
    try {
      if (!user?.email) {
        setError('Biometric authentication için giriş yapmanız gerekli');
        return false;
      }

      // For demo purposes, we'll use a placeholder for encrypted credentials
      // In production, you would properly encrypt the user's credentials
      const success = await biometricService.enableBiometricLogin(user.email, 'encrypted_credentials_placeholder');

      if (success) {
        setIsBiometricEnabled(true);
      } else {
        setError('Biometric authentication etkinleştirilemedi');
      }

      return success;
    } catch (error: any) {
      console.error('Enable biometric error:', error);
      setError('Biometric authentication etkinleştirme hatası');
      return false;
    }
  };

  const disableBiometric = async (): Promise<void> => {
    try {
      await biometricService.disableBiometricLogin();
      setIsBiometricEnabled(false);
    } catch (error: any) {
      console.error('Disable biometric error:', error);
      setError('Biometric authentication devre dışı bırakma hatası');
    }
  };

  const loginWithBiometric = async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      const authResult = await biometricService.authenticateWithBiometrics();

      if (!authResult.success) {
        setError(authResult.error || 'Biometric doğrulama başarısız');
        return;
      }

      const credentials = await biometricService.getBiometricCredentials();

      if (!credentials) {
        setError('Biometric kimlik bilgileri bulunamadı');
        return;
      }

      // In production, you would decrypt the credentials and use them to sign in
      // For demo purposes, we'll just simulate a successful login
      console.log('Biometric login successful for:', credentials.email);

      // You would call your actual login method here with the decrypted credentials
      // await login(credentials.email, decryptedPassword);

    } catch (error: any) {
      console.error('Biometric login error:', error);
      setError('Biometric giriş hatası');
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading: loading,
    login,
    signup,
    logout,
    error,
    clearError,
    biometricCapability,
    isBiometricEnabled,
    enableBiometric,
    disableBiometric,
    loginWithBiometric,
  }), [
    user,
    loading,
    login,
    signup,
    logout,
    error,
    clearError,
    biometricCapability,
    isBiometricEnabled,
    enableBiometric,
    disableBiometric,
    loginWithBiometric,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};